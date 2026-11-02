# 技术架构

## 总体架构

```text
Next.js Web / Expo App
        ↓
共享 TypeScript domain + Zod schema + API Client
        ↓
Next.js BFF / Route Handler / Edge Function
        ↓
Supabase Auth / Postgres / Storage / Realtime + RLS
        ↓
AI Provider Adapter（视觉分析 / 图片生成）
```

前端不直接调用 AI；不保存永久对象存储 URL；扣费只在服务端计算。

## 技术选型

| 层 | 方案 | 目的 |
| --- | --- | --- |
| Monorepo | pnpm + Turborepo | 共享类型、API client、埋点 |
| Web | Next.js + TypeScript + TanStack Query | 批量生产和管理 |
| App | Expo React Native | 采集、进度、审核、分享 |
| 后端 | Supabase Auth/Postgres/Storage/RLS/Realtime | 一人团队低运维 |
| 异步 | Postgres jobs + Cron/Worker；后续 Trigger.dev | 生成、重试、取消 |
| 媒体 | R2/S3 + CDN + Sharp | 原图、缩略图、导出包 |
| 监控 | Sentry + PostHog | 错误、漏斗、成本 |

## 核心数据模型

`workspaces`、`members`、`projects`、`folders`、`skus`、`assets`、`asset_versions`、`analysis_reports`、`generation_jobs`、`generation_outputs`、`review_tasks`、`exports`、`usage_ledger`、`audit_logs`。

所有业务表含 `workspace_id`、创建/更新时间；RLS 强制空间隔离。派生图 immutable，使用 `parent_version_id` 追溯。

## AI 任务链

直传签名 URL → MIME/大小/hash 校验 → 缩略图 → 视觉分析（主体、属性、OCR、卖点、风险）→ 用户确认 → 拆分三类生成任务 → 限流、租约锁、幂等重试 → 后处理 → QC → 审核 → ZIP 导出。

状态：`queued → analyzing → awaiting_confirm → generating → post_processing → qc_pending → manual_review/approved/rejected → exported/failed/canceled`。

保存输入版本、模型版本、参数、提示词快照、费用和操作者。

## 安全与成本

私有桶、短期签名 URL、RLS、软删除、备份、审计日志、最小权限；上传 MIME 白名单与病毒扫描。高风险内容、第三方 Logo、未授权肖像、虚假功效和主体严重变形不得导出。

按 SKU 和高清导出计费；预览低清；失败重试最多 2 次且不重复扣费；每账号设月度成本上限。图像成本目标 ≤订阅收入 35%。

## MVP 交付切片

- M0（2–3 天）：认证、Workspace、RLS、Project/SKU/Folder、Storage。
- M1（5–7 天）：Web 上传、缩略图、分析、基础任务状态。
- M2（5–7 天）：三类生成、版本链、QC、Web 审核。
- M3（3–5 天）：App 上传/进度/审核/分享、Realtime。
- M4（3–5 天）：用量流水、高清导出、埋点、Sentry、E2E。

## 技术验收

20 张上传成功率 ≥95%；重复提交不重复生成/扣费；Web/App 状态最终一致；非成员无法访问；未通过 QC 不能导出；失败可读且可重试；导出可追溯到原图、版本、模型、提示词、操作者和时间。
