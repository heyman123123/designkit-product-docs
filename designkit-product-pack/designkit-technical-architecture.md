# 技术架构文档（Go 后端）

## 1. 总体架构

```text
Web (Next.js)                 App (Expo RN)
      │                              │
      └──────── REST + SSE ──────────┘
                     │
        ┌────────────▼─────────────┐
        │  Go API 服务 (单体)       │
        │  chi · JWT · RBAC         │
        │  auth/workspace/project/  │
        │  asset/job/qc/export/     │
        │  billing                 │
        └───────┬───────────┬───────┘
                │           │
      ┌─────────▼──┐   ┌────▼──────────────┐
      │ PostgreSQL │   │ S3/R2 对象存储     │
      │ + 任务队列 │   │ + CDN             │
      └─────────┬──┘   └───────────────────┘
                │
      ┌─────────▼──────────────────────┐
      │ Go Worker（独立进程）           │
      │ 分析/生成/后处理/QC/导出        │
      └─────────┬──────────────────────┘
                │
      ┌─────────▼──────────┐
      │ AI Provider Adapter │
      └────────────────────┘
```

前端不直接调用 AI；不保存永久对象存储 URL；扣费只在 Go 服务端计算。

## 2. 为什么用 Go

- 单二进制部署，一台小机器即可跑 API + Worker，运维面小。
- 并发模型适合图片批处理、上传流式转发和长任务调度。
- 静态编译 + 强类型，`context` 天然贯穿超时、取消与链路追踪。
- 图像后处理走 libvips，不依赖 Node 侧常驻服务。

## 3. 技术选型

- Web：Next.js、TypeScript、Tailwind/shadcn、TanStack Query。
- App：Expo React Native，复用 API client 与类型生成结果。
- 后端：Go 1.22+，chi 路由，sqlc + pgx。
- 数据库：PostgreSQL 16，业务数据与任务队列同库。
- 队列：River（基于 Postgres），支持重试、定时、唯一任务。
- 迁移：golang-migrate；schema 版本化。
- 鉴权：JWT（access + refresh 轮换）、Argon2id 密码哈希。
- 媒体：S3 兼容存储 + CDN；`imaging` / libvips 做缩略图与裁切。
- 实时：SSE `/v1/events`，断线用 `Last-Event-ID` 续传。
- 可观测：OpenTelemetry + Prometheus + Grafana；`log/slog` 输出结构化 JSON。
- 部署：Docker 多阶段构建，先单机或 Fly/Render。

## 4. 代码结构

```text
cmd/api/main.go        # HTTP 入口
cmd/worker/main.go     # 队列消费者入口
internal/auth/         # JWT、密码、会话
internal/workspace/    # 空间、成员、角色
internal/project/      # 项目、SKU、文件夹树
internal/asset/        # 上传、版本、签名 URL
internal/job/          # 任务与状态机
internal/analysis/     # 视觉分析
internal/generate/     # provider adapter
internal/qc/           # 质检规则
internal/export/       # ZIP 打包、规格校验
internal/billing/      # 配额、用量流水
internal/storage/      # S3 封装
internal/platform/     # 配置、DB、日志、中间件
db/migrations/         # golang-migrate SQL
db/queries/            # sqlc 输入
```

API 与 Worker 共用 `internal/*`，仅入口不同；不拆微服务。

## 5. 数据模型

`workspaces(id, plan, quota)`；`members(workspace_id,user_id,role)`；`projects(workspace_id,platform,category)`；`folders(project_id,parent_id,name,type)`；`skus(project_id,folder_id,sku,attributes)`；`assets(sku_id,type,storage_key,hash)`；`asset_versions(asset_id,parent_version_id,provider,model,prompt_snapshot,metadata)`；`analysis_reports(asset_version_id,labels,ocr,risk_flags)`；`generation_jobs(project_id,analysis_id,type,status,idempotency_key,cost,retry_count)`；`generation_outputs(job_id,asset_version_id,qc_result)`；`review_tasks(output_id,status,reason)`；`exports(project_id,status,rule_version)`；`usage_ledger(workspace_id,event,units,cost)`；`audit_logs(workspace_id,actor,event,target)`。

所有业务表带 `workspace_id`，应用层每条查询强制注入作用域，越权访问用 repository 测试覆盖；敏感表再加 Postgres RLS 作为第二道防线。派生图 immutable，用 `parent_version_id` 追溯，删除为软删除。

## 6. AI 任务链与状态机

`queued → analyzing → awaiting_confirm → generating → post_processing → qc_pending → manual_review/approved/rejected → exported/failed/canceled`。

流程：签名直传 → MIME/大小/hash 校验 → 缩略图 → 视觉分析（主体、属性、OCR、卖点、风险）→ 用户确认 → 拆分三类生成任务 → 唯一键防重、限流、`context` 取消 → 后处理 → QC → 审核 → ZIP 导出。

River 的 unique job 保证同一 `(sku_id, template)` 只入队一次；`idempotency_key` 命中时直接返回原任务。失败重试上限 2 次且不重复扣用户额度。必须保存输入版本、模型版本、参数、提示词快照、费用和操作者。

## 7. 关键接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/auth/login` | 返回 access + refresh |
| GET | `/v1/workspaces/{id}/tree` | 项目/文件夹/SKU 树 |
| POST | `/v1/uploads/presign` | 直传签名 |
| POST | `/v1/assets/confirm` | 确认入库 |
| POST | `/v1/jobs` | 创建生成任务 |
| GET | `/v1/events` | SSE 状态流 |
| POST | `/v1/reviews/{id}` | 通过/驳回 |
| POST | `/v1/exports` | 创建导出 |
| GET | `/v1/usage` | 配额与用量 |

## 8. 安全、合规与成本

私有桶、短期签名 URL、JWT 短有效期 + refresh 轮换、Argon2id、应用层空间隔离 + RLS 兜底、软删除、备份、审计日志、MIME 白名单与病毒扫描。高风险内容、第三方 Logo、未授权肖像、虚假功效和主体严重变形不得导出；检测服务不可用默认人工复核/暂停导出。

按 SKU 和高清导出计费；预览低清；失败重试不重复扣费；每账号设月度成本上限，超出即限流。图像成本目标 ≤订阅收入 35%，provider 调用记录模型、张数、费用与耗时以便对账。

## 9. MVP 交付切片

- M0（3–4 天）：Go 骨架、迁移、JWT 鉴权、Workspace 隔离、Project/SKU/Folder CRUD。
- M1（5–7 天）：上传签名与确认、缩略图、分析任务、SSE 状态流。
- M2（5–7 天）：三类生成、版本链、QC 规则、审核接口。
- M3（3–5 天）：Expo 上传/进度/审核/分享接入同一 API。
- M4（3–5 天）：配额流水、导出打包、Prometheus 指标、E2E。

## 10. 技术验收

20 张上传成功率 ≥95%；同一任务重复提交只产生一个 job 且不重复扣费；Web/App 经 SSE 最终一致；跨 workspace 访问一律 403 且有测试覆盖；未通过 QC 不能导出；失败可读、可重试；导出可追溯到原图、版本、模型、提示词、操作者和时间。
