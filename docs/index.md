# DesignKit Commerce Visual OS

<script setup>
import { ref } from 'vue'
const flow = ['上传商品图', 'AI 自动分析', '生成候选图', 'QC / 人工审核', '导出规格包']
const stack = [
  { name: 'Go 后端', note: 'chi · GORM · River 队列', tag: 'server' },
  { name: 'PostgreSQL', note: '业务数据 + 任务', tag: 'data' },
  { name: 'S3 / R2', note: '原图 · 缩略图 · 导出', tag: 'storage' },
  { name: 'Next.js', note: 'Web 生产工作台', tag: 'web' },
  { name: 'Expo RN', note: 'App 采集与审核', tag: 'app' },
  { name: 'SSE', note: '任务状态实时推送', tag: 'realtime' },
]
</script>

<div class="hero-panel">
  <div>
    <div class="eyebrow">PRODUCT BLUEPRINT · MVP</div>
    <h1>电商商品视觉资产生产系统</h1>
    <p>上传商品图，自动分析并生成 Amazon 可发布候选图片，再按店铺、SKU、批次和版本统一管理。</p>
    <div class="hero-actions"><a class="vp-button brand" href="/prototype">查看交互原型</a><a class="vp-button" href="/prd">阅读 PRD</a></div>
  </div>
  <div class="hero-stat"><strong>Amazon</strong><span>首期平台</span><strong>1 个品类</strong><span>低风险品类验证</span></div>
</div>

<div class="metric-grid">
  <div class="metric"><strong>≥60%</strong><span>首轮可发布率目标</span></div>
  <div class="metric"><strong>≥95%</strong><span>主体关键属性一致率</span></div>
  <div class="metric"><strong>≥40%</strong><span>7 日第二 SKU 复用率</span></div>
  <div class="metric"><strong>35%</strong><span>生成成本收入上限</span></div>
</div>

## 产品主链路

<div class="flow-strip">
  <div v-for="(item, index) in flow" :key="item" class="flow-step"><b>0{{ index + 1 }}</b><span>{{ item }}</span></div>
</div>

## 交付资料导航

<div class="doc-grid">
  <a href="/prd"><b>PRD</b><span>目标、场景、功能需求、用户故事和验收标准</span></a>
  <a href="/prototype"><b>需求原型</b><span>Web/App 页面、流程、状态矩阵和交互说明</span></a>
  <a href="/ui-design"><b>UI 设计稿</b><span>视觉 token、组件、响应式和可访问性规范</span></a>
  <a href="/technical-architecture"><b>技术架构</b><span>Go 后端、GORM、任务队列、数据模型和安全</span></a>
  <a href="/multi-tenant"><b>多租户与 SaaS</b><span>租户模型、隔离策略、角色、订阅与生命周期</span></a>
  <a href="/admin-console"><b>管理后台</b><span>租户运营、订阅、成本、任务运维与风控</span></a>
  <a href="/growth-plan"><b>推广与商业化</b><span>定价、付费墙、获客渠道、漏斗和止损</span></a>
  <a href="/delivery-plan"><b>落地与上线</b><span>7/30/60/90 天计划、测试和上线门禁</span></a>
</div>

## 技术栈

<div class="stack-grid">
  <div v-for="item in stack" :key="item.name" class="stack-item"><b>{{ item.name }}</b><span>{{ item.note }}</span></div>
</div>

**后端为 Go 单体服务**：API 与 Worker 共用同一套 `internal/*` 领域代码，两个入口、一次部署；PostgreSQL 同时承载业务数据与任务队列，不额外引入 Redis。

## 产品边界

<div class="split-grid">
  <div class="callout good"><b>首期做什么</b><ul><li>Amazon + 一个低风险品类</li><li>Web 批量生产与项目管理</li><li>App 拍摄、上传、进度、审核、分享</li><li>主图、场景图、卖点图生成</li><li>文件夹、SKU、版本和 QC</li></ul></div>
  <div class="callout warn"><b>首期不做什么</b><ul><li>多平台、多品类通用规则</li><li>自动发布 Amazon</li><li>无限生成和移动端完整画布</li><li>视频、复杂团队权限、开放素材市场</li><li>自动法律或合规承诺</li></ul></div>
</div>

## 现在的执行顺序

1. 冻结首期品类、Amazon 站点和规则版本。
2. 收集 30–50 个真实且已授权的商品 SKU。
3. 完成离线分析与生成质量评测。
4. 先开发 Web 端完整闭环，再开发 App companion。
5. 通过 20 个目标用户、5 次高清导出后开放正式付费。

<div class="source-note">状态：产品方案已完成，价格、质量指标和转化率仍需真实用户验证。</div>
