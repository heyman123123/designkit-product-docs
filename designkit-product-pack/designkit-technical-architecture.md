# 技术架构文档

## 1. 总体架构

```text
Next.js Web / Expo App
        ↓
共享 TypeScript domain + Zod schema + API Client
        ↓
Next.js BFF / Route Handler / Edge Function
  Auth | Workspace | Assets | Jobs | QC | Export | Billing
        ↓
Supabase Auth/Postgres/Storage/Realtime + RLS
        ↓
AI Provider Adapter（视觉分析/图片生成）
```

前端不直接调用 AI；不保存永久对象存储 URL；扣费只在服务端计算。

## 2. 技术选型

- Monorepo：pnpm + Turborepo。
- Web：Next.js、TypeScript、Tailwind/shadcn、TanStack Query。
- App：Expo React Native，复用 domain、API client、埋点和任务状态。
- 后端：Supabase Auth/Postgres/Storage/RLS/Realtime。
- 异步：MVP 使用 Postgres jobs + 托管 Cron/Worker；规模增长后 Trigger.dev 或 Inngest。
- 图片：R2/S3 + CDN，Sharp 做缩略图/尺寸/压缩。
- 监控：Sentry + PostHog。

## 3. 数据模型

`workspaces(id, plan, quota)`；`members(workspace_id,user_id,role)`；`projects(workspace_id,platform,category)`；`folders(project_id,parent_id,name,type)`；`skus(project_id,folder_id,sku,attributes)`；`assets(sku_id,type,storage_key,hash)`；`asset_versions(asset_id,parent_version_id,provider,model,prompt_snapshot,metadata)`；`analysis_reports(asset_version_id,labels,ocr,risk_flags)`；`generation_jobs(project_id,analysis_id,type,status,idempotency_key,cost,retry_count)`；`generation_outputs(job_id,asset_version_id,qc_result)`；`review_tasks(output_id,status,reason)`；`exports(project_id,status,rule_version)`；`usage_ledger(workspace_id,event,units,cost)`；`audit_logs(workspace_id,actor,event,target)`。

所有业务表含 `workspace_id`、创建/更新时间；RLS 强制空间隔离。派生图 immutable，使用 `parent_version_id` 追溯。

## 4. AI 任务状态

`queued → analyzing → awaiting_confirm → generating → post_processing → qc_pending → manual_review/approved/rejected → exported/failed/canceled`。

流程：直传签名 URL → MIME/大小/hash 校验 → 缩略图 → 视觉分析（主体、属性、OCR、卖点、风险）→ 用户确认 → 拆分三类生成任务 → 限流/租约锁/幂等重试 → 后处理 → QC → 审核 → ZIP 导出。

必须保存输入版本、模型版本、参数、提示词快照、费用和操作者。

## 5. 安全、合规与成本

私有桶、短期签名 URL、RLS、软删除、备份、审计日志、最小权限；上传 MIME 白名单与病毒扫描。高风险内容、第三方 Logo、未授权肖像、虚假功效和主体严重变形不得导出；检测服务不可用默认人工复核/暂停导出。

按 SKU 和高清导出计费；预览低清；失败重试最多2次且不重复扣费；每账号设月度成本上限。图像成本目标 ≤订阅收入35%。

## 6. MVP 交付切片

- M0（2–3天）：Auth、Workspace、RLS、Project/SKU/Folder、Storage。
- M1（5–7天）：Web 上传、缩略图、分析、基础任务状态。
- M2（5–7天）：三类生成、版本链、QC、Web 审核。
- M3（3–5天）：App 上传/进度/审核/分享、Realtime。
- M4（3–5天）：用量流水、高清导出、埋点、Sentry、E2E。

## 7. 技术验收

20张上传成功率≥95%；重复提交不重复生成/扣费；Web/App状态最终一致；非成员无法访问；未通过QC不能导出；失败可读、可重试；导出可追溯到原图、版本、模型、提示词、操作者和时间。
