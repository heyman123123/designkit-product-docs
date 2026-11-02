# 管理后台

<script setup>
import { ref } from 'vue'
const view = ref('租户')
const sections = ['租户', '订阅', '成本', '任务', '风控', '配置']
const tenants = [
  { name: 'acme-home', plan: 'Growth', skus: '142 / 300', cost: '$38.20', state: '正常' },
  { name: 'nordic-pet', plan: 'Pro', skus: '88 / 800', cost: '$22.70', state: '正常' },
  { name: 'tiny-shop', plan: 'Free', skus: '1 / 1', cost: '$0.42', state: '试用' },
  { name: 'old-brand', plan: 'Starter', skus: '19 / 40', cost: '$6.10', state: '欠费只读' },
]
const queue = [
  { id: 'job_9f21', type: 'generate', tenant: 'acme-home', tries: '1 / 3', msg: 'provider timeout' },
  { id: 'job_9f3c', type: 'qc', tenant: 'nordic-pet', tries: '2 / 3', msg: 'logo risk pending' },
  { id: 'job_9f4a', type: 'export', tenant: 'acme-home', tries: '3 / 3', msg: 'zip over quota' },
]
</script>

管理后台是**你作为平台运营方**使用的控制台，和租户用户端的 Web 工作台完全分开：不同入口、不同鉴权、不同权限模型。

## 入口与鉴权

- 路径 `/admin`，与用户端 `/w/{slug}` 隔离；服务端 `/v1/admin/*` 独立路由组与中间件。
- 身份是 `platform_admin`，**不属于任何租户**；不能与租户角色混用。
- 强制 2FA；生产环境可加 IP 白名单与单点登录。
- 所有管理操作写 `admin_audit_logs`：谁、何时、对哪个租户、改了什么、改前改后。
- 危险操作（删除租户、强制退款、封禁资产）要求二次确认，后续可加双人复核。

## 功能模块

<div class="prototype-toolbar"><button v-for="s in sections" :key="s" :class="{active:view===s}" @click="view=s">{{ s }}</button></div>

<div v-if="view==='租户'" class="admin-panel">
  <div class="admin-head"><b>租户列表</b><span>共 4 个 · 搜索 / 按套餐与状态筛选</span></div>
  <div class="admin-row admin-row-head"><span>工作区</span><span>套餐</span><span>SKU 用量</span><span>本月成本</span><span>状态</span></div>
  <div v-for="t in tenants" :key="t.name" class="admin-row"><b>{{ t.name }}</b><span>{{ t.plan }}</span><span>{{ t.skus }}</span><span>{{ t.cost }}</span><span class="ui-status" :class="t.state==='欠费只读'?'danger':t.state==='试用'?'warning':'success'">{{ t.state }}</span></div>
  <div class="admin-hint">详情页可：调整配额、变更套餐、暂停/恢复、重置 owner 密码、导出数据、注销租户。</div>
</div>

<div v-else-if="view==='订阅'" class="admin-panel">
  <div class="admin-head"><b>订阅与账单</b><span>订单 · 发票 · 退款 · 试用期</span></div>
  <ul class="admin-list">
    <li>按租户查看当前套餐、周期、下次扣费日、支付渠道外部 ID。</li>
    <li>手动延长试用、发放优惠码、补偿配额，全部写审计。</li>
    <li>退款只登记状态与原因，实际退款在支付渠道执行，避免两套账。</li>
    <li>欠费策略：宽限 3 天 → 只读 → 保留 30 天 → 进入删除流程。</li>
  </ul>
</div>

<div v-else-if="view==='成本'" class="admin-panel">
  <div class="admin-head"><b>用量与毛利</b><span>按租户 / 模型 / 天</span></div>
  <div class="metric-grid admin-metrics">
    <div class="metric"><strong>$67.4</strong><span>本月模型成本</span></div>
    <div class="metric"><strong>$194</strong><span>本月订阅收入</span></div>
    <div class="metric"><strong>34.7%</strong><span>成本占收入</span></div>
    <div class="metric"><strong>11</strong><span>付费租户</span></div>
  </div>
  <ul class="admin-list">
    <li>单租户成本超过其订阅 35% 时标红，并给出该租户的模型、张数与重试分布。</li>
    <li>按模型统计单张成本与失败率，用于切换供应商或收窄模板。</li>
    <li>导出 CSV 对账；所有金额以 `usage_ledger` 为准，不用缓存数。</li>
  </ul>
</div>

<div v-else-if="view==='任务'" class="admin-panel">
  <div class="admin-head"><b>队列与失败任务</b><span>重试 · 取消 · 死信</span></div>
  <div class="admin-row admin-row-head"><span>任务</span><span>类型</span><span>租户</span><span>重试</span><span>原因</span></div>
  <div v-for="j in queue" :key="j.id" class="admin-row"><b>{{ j.id }}</b><span>{{ j.type }}</span><span>{{ j.tenant }}</span><span>{{ j.tries }}</span><span>{{ j.msg }}</span></div>
  <div class="admin-hint">可单条重试、批量取消未开始任务、把任务标记死信；重试不重复扣用户额度。</div>
</div>

<div v-else-if="view==='风控'" class="admin-panel">
  <div class="admin-head"><b>内容风控与投诉</b><span>待审 · 下架 · 封禁</span></div>
  <ul class="admin-list">
    <li>待人工复核队列：第三方 Logo、肖像、虚假功效、主体变形。</li>
    <li>投诉处理：冻结 SKU、撤销分享链接、保留原图与版本证据。</li>
    <li>租户级封禁：只禁生成与导出，不影响其取回已有数据。</li>
    <li>每一个处置动作都要有原因码，便于复盘与申诉。</li>
  </ul>
</div>

<div v-else class="admin-panel">
  <div class="admin-head"><b>平台配置</b><span>模型 · 模板 · 规则 · 开关</span></div>
  <ul class="admin-list">
    <li>模型供应商与备用供应商、超时与重试上限、单租户月度成本上限。</li>
    <li>Amazon 规则版本：按站点 + 品类配置，历史结果保留旧规则版本。</li>
    <li>模板上架/下架，按品类灰度开放。</li>
    <li>Feature flags：新模板、Team 功能、子域分享，按租户白名单开启。</li>
    <li>公告与维护窗口，支持只影响特定套餐。</li>
  </ul>
</div>

## MVP 范围

先做四件事，其余延后：

1. 租户列表与详情：配额调整、套餐变更、暂停/恢复。
2. 失败任务查看与重试。
3. 用量与成本看板（含成本超 35% 标红）。
4. 风控告警入口与资产冻结。

暂不做：复杂 RBAC 编辑器、自动化营销、完整财务系统、工单系统。

## 技术实现

- 与用户端共用 Go 服务，但 `/v1/admin/*` 使用独立中间件与独立 JWT audience，token 不能互换。
- 复用 `internal/*` 的 service 层，不复制业务逻辑；admin 只多一层编排与审计。
- 前端可作为 Next.js 的 `/admin` 路由，独立布局与权限守卫；也可后续拆成单独应用。
- River 队列管理用 River 自带 UI 或只读接口，不自建队列后台。
- 指标来自 Prometheus + `usage_ledger`，不新增统计表。

## 关键接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/admin/tenants` | 租户列表与筛选 |
| GET | `/v1/admin/tenants/{id}` | 详情、用量、成本 |
| PATCH | `/v1/admin/tenants/{id}` | 套餐、配额、状态 |
| POST | `/v1/admin/tenants/{id}/suspend` | 暂停/恢复 |
| GET | `/v1/admin/jobs?status=failed` | 失败任务 |
| POST | `/v1/admin/jobs/{id}/retry` | 重试任务 |
| GET | `/v1/admin/usage?group=tenant` | 用量与成本 |
| POST | `/v1/admin/assets/{id}/freeze` | 冻结资产 |
| GET | `/v1/admin/audit` | 管理审计 |

## 验收标准

- 租户 token 无法访问任何 `/v1/admin/*` 接口，反之亦然。
- 每次配额或套餐变更都能在审计里查到改前改后值。
- 暂停租户后，其成员只能查看与导出既有数据，不能新建任务。
- 失败任务重试后，用户额度不重复扣减。
- 成本看板与 `usage_ledger` 对账一致，误差为 0。
