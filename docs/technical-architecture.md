# 技术架构（Go 后端）

## 总体架构

```text
Web (Next.js)                 App (Expo RN)
      │                              │
      └──────── REST + SSE ──────────┘
                     │
        ┌────────────▼─────────────┐
        │  Go API 服务 (单体)       │
        │  chi/gin · JWT · RBAC     │
        ├───────────────────────────┤
        │  领域模块：               │
        │  auth / workspace /       │
        │  project / folder / sku / │
        │  asset / job / qc /       │
        │  export / billing         │
        └───────┬───────────┬───────┘
                │           │
      ┌─────────▼──┐   ┌────▼──────────────┐
      │ PostgreSQL │   │ S3/R2 对象存储     │
      │ + 任务队列 │   │ + CDN             │
      └─────────┬──┘   └───────────────────┘
                │
      ┌─────────▼──────────────────────┐
      │ Go Worker（独立进程）           │
      │ 分析 / 生成 / 后处理 / QC / 导出 │
      └─────────┬──────────────────────┘
                │
      ┌─────────▼──────────┐
      │ AI Provider Adapter │
      │ 视觉分析 / 图像生成  │
      └────────────────────┘
```

前端不直接调用 AI；不保存永久对象存储 URL；扣费只在 Go 服务端计算。

## 为什么用 Go

- 单二进制部署，一台小机器就能跑 API + Worker，运维面小。
- 并发模型适合图片批处理、上传流式转发和长任务轮询。
- 强类型 + 静态编译，热路径少踩运行时坑；`context` 天然贯穿超时与取消。
- 图像后处理用 `imaging`/`vips` 绑定，缩略图与裁切不依赖 Node 侧服务。

## 技术选型

| 层 | 方案 | 目的 |
| --- | --- | --- |
| Web | Next.js + TypeScript + TanStack Query | 批量生产和管理 |
| App | Expo React Native | 采集、进度、审核、分享 |
| 后端 | Go 1.22+，chi 路由，sqlc + pgx | 单体内聚、类型安全的 SQL |
| 数据库 | PostgreSQL 16 | 业务数据 + 任务队列 |
| 任务队列 | River（基于 Postgres） | 无需 Redis，重试/定时/唯一键 |
| 迁移 | golang-migrate | 版本化 schema |
| 鉴权 | JWT（access + refresh），Argon2id 密码 | 无外部 Auth 依赖 |
| 对象存储 | S3 兼容（R2/MinIO）+ CDN | 原图、缩略图、导出包 |
| 实时 | SSE（`/events`） | 任务状态推送，比 WebSocket 简单 |
| 图像处理 | `disintegration/imaging` + libvips | 缩略图、裁切、压缩、水印 |
| 可观测 | OpenTelemetry + Prometheus + Grafana | 指标、链路、成本 |
| 日志 | `log/slog` 结构化 JSON | 审计与排障 |
| 部署 | Docker 多阶段构建 → 单机 or Fly/Render | 低运维起步 |

## 代码结构

```text
cmd/
  api/main.go          # HTTP 服务入口
  worker/main.go       # 队列 worker 入口
internal/
  auth/                # JWT、密码、会话
  workspace/           # 空间、成员、角色
  project/             # 项目、SKU、文件夹树
  asset/               # 上传、版本、签名 URL
  job/                 # 生成任务、状态机
  analysis/            # 视觉分析
  generate/            # 图像生成 provider adapter
  qc/                  # 自动质检规则
  export/              # ZIP 打包、规格校验
  billing/             # 配额、用量流水
  storage/             # S3 客户端封装
  platform/            # 配置、DB、日志、中间件
db/
  migrations/          # golang-migrate SQL
  queries/             # sqlc 输入
```

原则：API 与 Worker 共享 `internal/*`，只是入口不同；不拆微服务。

## 核心数据模型

`workspaces`、`members`、`projects`、`folders`、`skus`、`assets`、`asset_versions`、`analysis_reports`、`generation_jobs`、`generation_outputs`、`review_tasks`、`exports`、`usage_ledger`、`audit_logs`。

- 所有业务表带 `workspace_id`；**应用层强制作用域**，每条查询都由中间件注入的 `workspace_id` 过滤，并有 repository 单测覆盖越权访问。
- 敏感表额外启用 Postgres RLS 作为第二道防线（`SET LOCAL app.workspace_id`）。
- 派生图 immutable，用 `parent_version_id` 追溯；删除为软删除。

## 任务状态机

```text
queued → analyzing → awaiting_confirm → generating
  → post_processing → qc_pending → manual_review / approved / rejected
  → exported / failed / canceled
```

用 River 的 unique job 保证同一 `(sku_id, template)` 不重复入队；`idempotency_key` 存在 `generation_jobs`，重复请求直接返回已有任务。取消通过 `context` 传播到 provider 调用；失败重试上限 2 次，且不重复扣用户额度。

## AI 任务链

1. 客户端向 `POST /v1/uploads/presign` 取签名 URL，直传对象存储。
2. `POST /v1/assets/confirm` 校验 MIME、大小、hash，生成缩略图，落 `assets`。
3. 入队 `analyze` 任务：主体、属性、OCR、卖点、风险标签 → 写 `analysis_reports`。
4. 用户确认后 `POST /v1/jobs`，按模板拆成生成任务入队。
5. Worker 调 provider，写 `generation_outputs`，后处理统一尺寸与背景。
6. `qc` 任务打分 `pass/review/reject`，不合格不进入可导出状态。
7. 审核通过后入队 `export`，生成 ZIP，扣高清额度并写 `usage_ledger`。

SSE 在每个状态变更时推送 `{job_id, status, progress, message}`；断线用 `Last-Event-ID` 续传。

## 关键接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/v1/auth/login` | 返回 access + refresh |
| GET | `/v1/workspaces/{id}/tree` | 项目、文件夹、SKU 树 |
| POST | `/v1/uploads/presign` | 直传签名 |
| POST | `/v1/assets/confirm` | 确认入库 |
| POST | `/v1/jobs` | 创建生成任务 |
| GET | `/v1/jobs/{id}` | 任务详情 |
| GET | `/v1/events` | SSE 状态流 |
| POST | `/v1/reviews/{id}` | 通过/驳回 + 原因 |
| POST | `/v1/exports` | 创建导出 |
| GET | `/v1/usage` | 配额与用量 |

## 安全与成本

私有桶、短期签名 URL、JWT 短有效期 + refresh 轮换、Argon2id 密码哈希、应用层空间隔离 + RLS 兜底、软删除、审计日志、上传 MIME 白名单与病毒扫描。高风险内容、第三方 Logo、未授权肖像、虚假功效和主体严重变形不得导出。

按 SKU 和高清导出计费；预览低清；失败重试不重复扣费；每账号月度成本上限，超出即限流。图像成本目标 ≤订阅收入 35%。所有 provider 调用记录 `model`、`tokens/张数`、`cost`、耗时，便于按天对账。

## MVP 交付切片

- M0（3–4 天）：Go 项目骨架、迁移、JWT 鉴权、Workspace 隔离、Project/SKU/Folder CRUD。
- M1（5–7 天）：上传签名与确认、缩略图、分析任务、SSE 状态流。
- M2（5–7 天）：三类生成、版本链、QC 规则、审核接口。
- M3（3–5 天）：Expo 上传/进度/审核/分享接入同一 API。
- M4（3–5 天）：配额流水、导出打包、Prometheus 指标、端到端验收。

## 技术验收

20 张上传成功率 ≥95%；同一任务重复提交只产生一个 job 且不重复扣费；Web/App 状态经 SSE 最终一致；跨 workspace 访问一律 403 且有测试覆盖；未通过 QC 不能导出；失败可读、可重试；导出可追溯到原图、版本、模型、提示词、操作者和时间。
