# 多租户与 SaaS 模式

<script setup>
import { ref } from 'vue'
const layers = [
  { name: '平台层', note: '你运营方 · 计费 · 风控 · 后台' },
  { name: '租户层', note: 'Workspace = 一个店铺/品牌' },
  { name: '成员层', note: 'owner / admin / editor / reviewer' },
  { name: '数据层', note: '项目 · SKU · 资产 · 版本' },
]
const lifecycle = ['注册账号', '创建工作区', '邀请成员', '选套餐试用', '正常使用', '超额/降级', '注销与删除']
</script>

## 租户模型

**租户 = Workspace**。一个跨境卖家可以只有一个工作区；代运营可以给每个客户开一个工作区。所有业务数据（项目、SKU、资产、任务、用量、审计）都归属某个 workspace，不存在"无租户"的业务数据。

<div class="stack-grid">
  <div v-for="item in layers" :key="item.name" class="stack-item"><b>{{ item.name }}</b><span>{{ item.note }}</span></div>
</div>

**平台管理员是独立维度**，不属于任何租户：它只操作平台配置、租户生命周期和风控，看不到业务图片内容之外的经营数据要按需授权。

## 隔离策略

| 方案 | 成本 | 适用 |
| --- | --- | --- |
| 共享库 + 行级隔离（`workspace_id`） | 低 | **MVP 采用** |
| 每租户独立 schema | 中 | 大客户合规要求时 |
| 每租户独立数据库 | 高 | 极少数需要物理隔离的客户 |

MVP 用共享库：所有业务表强制 `workspace_id NOT NULL`，复合索引 `(workspace_id, created_at DESC)`；仓储层每条查询注入租户条件，敏感表（资产、导出、用量）在同一事务执行 `SET LOCAL app.workspace_id` 启用 Postgres RLS 兜底。

跨租户访问一律返回 404（不暴露存在性），并有 repository 层越权测试覆盖。升级路径：单租户数据量超过阈值或客户要求物理隔离时，按 workspace 迁移到独立 schema，接口不变。

## 租户解析

- **MVP**：登录后 JWT 里带 `workspace_id`，前端走路径 `/w/{slug}/projects/...`；请求头 `X-Workspace-Id` 可选，服务端以 JWT 为准，避免越权伪造。
- **后续**：支持子域 `{slug}.app.example.com`，用于品牌感和分享链接。
- 切换租户时重新签发 access token，旧 token 立即失效。

```text
GET /w/acme/projects
JWT: { sub: u_123, ws: ws_456, role: editor, plan: growth }
→ 中间件校验成员关系 → ctx 注入 workspace_id → repository 强制过滤
```

## 租户生命周期

<div class="flow-table">
  <div v-for="(step, i) in lifecycle" :key="step" class="state-card"><b>0{{ i + 1 }}</b><strong>{{ step }}</strong><span>{{ ['邮箱或 OAuth 注册，验证邮箱','自动创建默认项目与文件夹','owner 邀请 editor / reviewer','Free 试用：1 个 SKU 低清预览','配额、计费、审计正常运转','超额限流或降级为只读','导出数据后 30 天硬删除'][i] }}</span></div>
</div>

- **创建即用**：新租户自动生成一个默认项目、一个 `SKU` 文件夹和一份示例模板，避免空工作区劝退。
- **降级不是删除**：套餐到期先变只读（可查看、可导出已有结果），保留 30 天后才进入删除流程。
- **注销**：owner 发起 → 邮件二次确认 → 生成数据导出包 → 30 天冷静期 → 硬删除并写审计。
- **所有权转移**：owner 可把租户转给其他成员，需双方确认。

## 租户内角色

| 角色 | 权限 |
| --- | --- |
| owner | 计费、套餐、成员管理、删除租户、全部业务权限 |
| admin | 成员管理、项目与模板配置，不能删租户 |
| editor | 上传、生成、审核、导出 |
| reviewer | 只审核与批注，不能生成和导出 |
| viewer | 只读，可下载已通过 QC 的结果 |

权限在服务端判定，前端只做展示层隐藏。危险操作（删除项目、批量导出）要求二次确认并写审计。

## SaaS 订阅与计费

- 计费主体是**租户**，不是个人账号；成员数量按套餐限制。
- 套餐：Free（1 SKU 试用）、Starter $19、Growth $49、Pro $99；年付 8 折。
- 计量单位：SKU 配额（每 SKU 一套图）、高清导出次数；预览、审核、失败重试不扣费。
- `usage_ledger` 不可变追加，按租户 + 月份聚合；超额时先提示再限流，不静默扣费。
- 支付走第三方（Stripe / 微信支付 / 支付宝），服务端只保存订阅状态与外部 ID，不落卡信息。
- 试用防滥用：同邮箱、同支付指纹、同 IP 段限制重复试用。

## 关键数据约束

```sql
-- 所有业务表统一约束
workspace_id UUID NOT NULL REFERENCES workspaces(id),
created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at   TIMESTAMPTZ
CREATE INDEX ON assets (workspace_id, created_at DESC);

-- 租户内唯一，跨租户互不影响
CREATE UNIQUE INDEX ON projects (workspace_id, slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ON skus (workspace_id, sku_code) WHERE deleted_at IS NULL;
```

任务唯一键也必须带租户：River 的 unique job 用 `(workspace_id, sku_id, template)`，避免 A 租户的任务阻塞 B 租户。

## 验收标准

- 任意两个租户之间，读、写、导出、分享链接互不可见（含越权 ID 猜测）。
- 切换租户后，旧 JWT 无法继续访问原租户资源。
- 配额按租户独立计算，一个租户超额不影响其他租户。
- 降级只读后，已有结果仍可查看和导出，新建任务被拒绝。
- 注销流程可导出全量数据，30 天后主键与对象存储文件均被删除，且审计可查。
