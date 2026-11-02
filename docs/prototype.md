# 需求原型

<script setup>
import { ref } from 'vue'
const view = ref('web')
const selected = ref('项目文件夹')
const nav = ['工作台', '项目文件夹', '任务队列', '资产库', '设置']
const states = ['上传中', '分析中', '生成中', '待审核', '已完成']
</script>

<div class="prototype-toolbar"><button :class="{active:view==='web'}" @click="view='web'">Web 生产工作台</button><button :class="{active:view==='app'}" @click="view='app'">App 采集 / 审核</button></div>

<div v-if="view==='web'" class="browser-frame">
  <div class="browser-top"><i></i><i></i><i></i><span>app.designkit.local / projects / kitchen-organizer</span></div>
  <div class="app-shell">
    <aside><div class="fake-logo">DK</div><div v-for="item in nav" :key="item" :class="['fake-nav',{selected:selected===item}]" @click="selected=item">{{ item }}</div><div class="fake-user">Starter<br><small>12 SKU 可用</small></div></aside>
    <main><div class="fake-topbar"><span>工作区 / 家居收纳</span><b>高清余额 8</b><button>新建项目</button></div><div class="fake-heading"><div><small>Amazon · Kitchen Organizer</small><h2>{{ selected }}</h2></div><span class="status-chip">进行中</span></div><div class="fake-stats"><div><small>原图</small><b>24</b></div><div><small>分析完成</small><b>18</b></div><div><small>待审核</small><b>6</b></div><div><small>可导出</small><b>12</b></div></div><div class="fake-grid"><div v-for="n in 6" :key="n" class="asset-card"><div class="fake-image" :class="`tone-${n}`"><span>{{ n % 3 === 0 ? '卖点图' : n % 2 === 0 ? '场景图' : '主图' }}</span></div><b>SKU-ORG-00{{ n }}</b><small>{{ n % 2 ? '待审核' : 'QC 通过' }} · v{{ n }}</small></div></div></main>
  </div>
</div>

<div v-else class="phone-row"><div class="phone-frame"><div class="phone-notch"></div><div class="phone-head"><span>9:41</span><b>DesignKit</b><span>•••</span></div><div class="phone-content"><small>今日任务</small><h2>3 个待审核</h2><div class="mobile-action"><b>拍摄上传</b><span>把新品带入工作区 →</span></div><div class="mobile-section"><b>最近项目</b><div class="mobile-project"><div class="mini-image"></div><span>Kitchen Organizer<br><small>6 张待审核</small></span><b>›</b></div></div></div><div class="phone-tabs"><span>任务</span><b>项目</b><span>上传</span><span>我的</span></div></div><div class="phone-frame review"><div class="phone-notch"></div><div class="phone-head"><span>‹</span><b>审核结果</b><span>···</span></div><div class="review-image"><span>v3 · 场景图</span></div><div class="review-meta"><small>SKU-ORG-002 · Kitchen Organizer</small><h3>确认这张图片可发布吗？</h3><p>AI 检查：主体一致 · 尺寸合规 · 无风险标签</p></div><div class="review-actions"><button>需修改</button><button class="approve">通过</button></div></div></div>

## 端到端流程

<div class="flow-table"><div v-for="(state,index) in states" :key="state" class="state-card"><b>0{{index+1}}</b><strong>{{state}}</strong><span>{{ ['直传原图并生成缩略图','识别主体、属性、文字和风险','按模板调用生成模型','Web 批量或 App 快速审核','QC 通过后导出规格包'][index] }}</span></div></div>

## 关键页面与交互

### Web

- `/dashboard`：项目卡片、任务状态、配额和新建项目。
- `/projects/:id`：项目头部、SKU/文件夹树、资产网格和筛选。
- 上传抽屉：`上传中 → 分析中 → 分析完成`，失败保留原图并允许重试。
- 生成配置：主图/场景图/卖点图、模板、数量、站点、预计消耗；提交前二次确认。
- 结果工作台：原图/结果对比、版本切换、通过/驳回、批量操作。
- QC：尺寸、背景、主体、文字、Logo、清晰度的 `pass / review / reject`。
- 导出中心：版本选择、普通/高清导出、进度、失败重试和有效期。

### App

- 首页：今日任务、待审核数量、最近项目。
- 拍摄/上传：相机或相册、多图队列、断点续传、弱网重试。
- 任务进度：上传 → 分析 → 生成 → 待审核 → 完成。
- 审核：全屏预览、左右切图、通过、需修改、备注、原图/版本。
- 分享：只读链接、过期控制、附项目/SKU/版本信息。

## 状态矩阵

| 状态 | 用户看到的反馈 | 可执行操作 |
| --- | --- | --- |
| 空状态 | 创建第一个项目 / 上传第一张商品图 | 主 CTA |
| 加载 | 骨架屏或阶段进度 | 取消（未开始任务） |
| 失败 | 可读的失败原因 | 重试、删除、联系支持 |
| 配额不足 | 本次任务需要多少额度 | 升级或购买 |
| 风控拦截 | 具体风险标签和修改建议 | 修改后重试、人工复核 |
| 冲突 | 已被其他设备更新 | 刷新并查看最新版本 |
