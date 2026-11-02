---
title: 全功能实现与验收
description: DesignKit Commerce Visual OS 已落地的功能、接口清单、验证证据与剩余商业决策
---

# 全功能实现与验收

> 本文是「把所有功能实现」的交付记录：每个模块的状态、对应接口与界面、验证证据，以及**有意不做**的部分和原因。
> 代码仓库：[designkit-commerce](https://github.com/heyman123123/designkit-commerce)

---

## 0. 总览

产品由三个入口 + 一套 Go 后端组成，全部可运行：

| 入口 | 地址 | 使用者 |
| --- | --- | --- |
| Web 工作台 | `/app/` | 租户成员（运营 / 审核 / 设计） |
| 管理后台 | `/admin/` | 平台运营（不属于任何租户） |
| 移动端 PWA | `/m/` | 卖家手机端快速拍摄与审核 |

技术约束与选择：

- **后端**：Go 单体服务（`cmd/api` + `cmd/worker`），chi + GORM v2（pgx / sqlite 驱动），PostgreSQL 16 或 SQLite，JWT + Argon2id，SSE 推送。
- **前端零构建**：原生 ES Module + 共享 CSS，由 Go 直接托管，无 Node 工具链。多进程部署只跑 Go。
- **多租户**：租户 = Workspace，业务表强制 `workspace_id`，跨租户一律 404 不暴露存在性。
- **计费**：后台人工开通 + 标准化支付回调（见 [计费与收款](/payment)）。

---

## 1. 功能矩阵

### 1.1 租户侧 API（`/v1/w/{workspace}/**`）

| 能力 | 接口 |
| --- | --- |
| 项目与文件夹 | `GET/POST /projects`、`GET/POST /folders` |
| SKU | `GET/POST /skus`，配额校验、编码唯一、幂等 |
| 素材上传 | `POST /skus/{id}/assets`（multipart） |
| 直传（S3） | `GET /skus/{id}/presign` → `PUT` 到预签名地址 → `POST /skus/{id}/assets/complete` |
| 素材读取 | `GET /assets`、`GET /assets/{id}/content`（支持 `?access_token=` 供 `<img>`） |
| 生成任务 | `POST /jobs`（幂等键）、`GET /jobs`、`GET /jobs/{id}` |
| 审核 | `POST /jobs/{id}/review`、`POST /jobs/review-batch` |
| 版本链 | `GET /skus/{id}/versions`、`POST /skus/{id}/versions/{jobID}/current` |
| 版本对比 | `GET /skus/{id}/compare?left=&right=` |
| 导出 | `GET /skus/{id}/export`、`POST /exports/batch` |
| 用量 | `GET /usage`（套餐、配额、成本、流水） |
| 成员 | `GET /members`、`POST /members` |
| 实时推送 | `GET /events`（SSE，断线自动重连） |

### 1.2 平台运营 API（`/v1/admin/**`，独立 JWT）

| 能力 | 接口 |
| --- | --- |
| 租户 | `GET /tenants`、`GET /tenants/{id}`、`PATCH /tenants/{id}`、`POST /tenants/{id}/suspend` |
| 套餐 | `GET/POST /plans`、`PATCH /plans/{code}`、`POST /tenants/{id}/apply-plan`、`POST /tenants/{id}/trial` |
| 订单 | `GET/POST /orders`、`POST /orders/{id}/paid`、`POST /orders/{id}/refund` |
| 优惠码 | `GET/POST /coupons`、`PATCH /coupons/{code}` |
| 成本 | `GET /overview`、`GET /costs?days=`、`GET /usage` |
| 任务运维 | `GET /jobs/failed`、`POST /jobs/{id}/retry` |
| 风控 | `GET/POST /risk`、`POST /risk/{id}/resolve` |
| 配置 | `GET/PATCH /config/templates`、`GET/PATCH /config/flags` |
| 审计 | `GET /audit` |

### 1.3 支付回调（无令牌，HMAC 校验）

`POST /v1/webhooks/payments/{provider}`，详见 [计费与收款](/payment)。

### 1.4 前端页面

**Web 工作台**：总览、项目列表、项目详情（文件夹树 + 批量导出）、SKU 详情（素材 / 结果审核 / 任务 / 版本对比 / 信息）、审核队列（批量通过 / 批量驳回）、任务、导出中心、用量与成本、成员、设置。

**管理后台**：登录、租户列表与详情（套餐 / 试用 / 配额 / 风控）、任务运维、计费（套餐 / 订单 / 优惠码）、成本看板、风控、配置（模板与开关）、审计。

**移动端**：登录、SKU 列表、拍照 / 相册上传、生成进度（SSE）、任务与审核、结果预览与分享；Service Worker 预缓存 + 安装到桌面。

---

## 2. 阶段记录

| 阶段 | 状态 | 交付 |
| --- | --- | --- |
| P0 骨架 | DONE | 三入口托管、设计系统、共享核心、启动错误兜底 |
| P1 Web 工作台 | DONE | 10 个页面、端到端 smoke 通过 |
| P2 版本链与 QC | DONE | 版本标记、审核自动设当前、自动质检明细、只导当前版本 |
| P3 管理后台 | DONE | 全部运营接口 + 界面接真数据 |
| P4 移动端 PWA | DONE | 拍照链路、SSE 进度、审核、分享 |
| P5 真实供应商与存储 | DONE | OpenAI 兼容 provider、S3 SigV4（含预签名直传） |
| P6 计费闭环 | DONE | 套餐 / 订单 / 优惠码 / 回调 / 人工到账；在线收银台由商户资质决定 |

P6 的边界说明：**支付网关本身**属于资质与商务动作（商户号、KYC、对账），代码侧已经把回调契约、幂等、配额开通、审计全部做完；接入真实网关只需写一个薄适配层把平台事件转换成统一契约。

---

## 3. 关键实现细节

### 3.1 生成与质检

- 队列：`GenerationJob` 认领用 CAS，失败按 `attempts` 指数退避（5s×2^n，上限 5min），3 次进入死信；不额外加列。
- Provider：`PROVIDER=mock|openai`；`OPENAI_BASE_URL/API_KEY/IMAGE_MODEL/CHAT_MODEL`；分析失败降级启发式，生成 5xx 重试 2 次。
- 质检：分辨率 < 800、长宽比偏离 1:1、真实透明通道、主图四角白底（阈值 225、均匀差 18）、体积 < 2KB 仅告警；结果落 `assets.qc_score` / `qc_issues`。

### 3.2 存储

- `STORAGE_DRIVER=local|s3`；S3 兼容（R2 / MinIO），SigV4 手写实现，`PresignPut/PresignGet` 上限 7 天。
- 直传受运营开关 `s3_direct_upload` 控制，关闭时自动退回服务端上传；前端 PUT 失败也会退回。

### 3.3 计费一致性

- 所有扣减走事务 + `usage_ledger` 不可变流水。
- 订单 `paid` 时按套餐覆盖配额；重复回调幂等；退款只改状态，不自动回收配额。

### 3.4 隔离与鉴权

- 租户接口统一 `Tenant` 中间件解析 slug → workspace，越权 404。
- 平台后台独立 audience 的 JWT，租户令牌无法访问 `/v1/admin/**`（有测试固定）。
- 只读 GET/HEAD 允许 `?access_token=`，写操作只认 Authorization 头。

---

## 4. 验证证据

- `go test -race ./...` 全绿，31 个用例覆盖：跨租户隔离、配额与幂等、版本链与导出、批量审核、批量导出、版本对比、直传登记、支付回调幂等、S3 固定签名向量、Provider 重试与降级、队列退避与死信。
- `go vet ./...` 无告警。
- 端到端 smoke（真实进程）：注册 → 项目 → SKU → 上传 → 生成 → 质检 → 批量审核 → 批量导出（ZIP 两目录）→ 用量成本 > 0。
- 后台 smoke：套餐种子、订单开通配额、成本、优惠码、模板与开关、风控结案全部 2xx。
- 静态入口全 200：`/app/`、`/admin/`、`/m/`、`/assets/app.css`、`/m/events.js` 等。
- 支付回调 smoke：无签名 401、错误签名 401、正确签名 200 且套餐生效、重放 `already_paid=true`、已支付订单 void 409。

---

## 5. 有意留白

| 项 | 原因 | 接续方式 |
| --- | --- | --- |
| 在线收银台 / 支付 SDK | 需要商户资质与对账流程，单人阶段先用人工开通验证付费 | 写适配层转统一回调契约（见 payment 文档） |
| 发票与合同 | 中国区开票依赖主体资质 | 订单 `note` 记录，线下开票 |
| 邮件 / 短信通知 | 需要第三方服务与模板审核 | 现有审计 + 站内状态可替代 |
| 客户端原生 App（iOS/Android） | PWA 已覆盖拍摄与审核短链路，原生上架成本高 | 先验证留存，再决定是否上架 |
| 自动降级 / 自动回收配额 | 避免误伤资产访问 | 运营在租户页手动处理 |

---

## 6. 运行与部署

```bash
# 本地（SQLite + mock provider + 本地存储）
cd apps/api
WEB_DIR=../../web MOBILE_DIR=../../mobile go run ./cmd/api
go run ./cmd/worker

# 生产（PostgreSQL + S3 + 真实 provider）
DB_DRIVER=postgres DB_DSN="postgres://..." \
STORAGE_DRIVER=s3 S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY=... S3_SECRET_KEY=... \
PROVIDER=openai OPENAI_API_KEY=... OPENAI_BASE_URL=... \
JWT_SECRET=... PAYMENT_WEBHOOK_SECRET=... \
WEB_DIR=/app/web MOBILE_DIR=/app/mobile ./api
```

健康检查 `GET /healthz`。Dockerfile 已内置 `web/` 与 `mobile/` 静态目录。

---

## 7. 团队分工（本项目实际执行）

| Bot | 职责 | 文件边界 |
| --- | --- | --- |
| 服务端工程 | Provider、S3、队列可靠性、只读 review | `apps/api/internal/{service,storage,config}` |
| 后台工程 | 管理后台前端 | `web/admin/**` |
| 移动端工程 | 移动端 PWA | `mobile/**` |
| Chief | 规划、Web 工作台、后端业务接口、静态托管、集成、验收、发布 | 其余全部 |

约束：Bot 不执行 `git commit/push`；不跨目录修改；交付前必须跑通自己范围内的检查；我统一集成、测试与发布。
