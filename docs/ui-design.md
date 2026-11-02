# UI 设计稿

<script setup>
import { ref } from 'vue'
const density = ref('comfortable')
const tokens = [
  { name: 'Brand', value: '#2563EB', class: 'swatch-brand' },
  { name: 'Success', value: '#16A34A', class: 'swatch-success' },
  { name: 'Warning', value: '#D97706', class: 'swatch-warning' },
  { name: 'Danger', value: '#DC2626', class: 'swatch-danger' },
  { name: 'Surface', value: '#F8FAFC', class: 'swatch-surface' },
]
</script>

<div class="design-toolbar"><span>组件预览</span><button :class="{active:density==='comfortable'}" @click="density='comfortable'">舒适</button><button :class="{active:density==='compact'}" @click="density='compact'">紧凑</button></div>

## 视觉方向

界面采用中性工作台风格：让商品图片成为视觉主角，蓝色只用于主操作和当前路径；绿色用于通过，橙色用于待确认，红色用于阻断。所有状态同时使用文字，不依赖颜色单独传达信息。

<div class="token-row"><div v-for="token in tokens" :key="token.name" class="token"><i :class="token.class"></i><b>{{ token.name }}</b><code>{{ token.value }}</code></div></div>

## 核心组件稿

<div :class="['component-board', density]">
  <div class="component-section"><small>BUTTONS</small><div class="button-row"><button class="ui-button primary">生成图片</button><button class="ui-button secondary">保存草稿</button><button class="ui-button ghost">取消</button><button class="ui-button danger">删除资产</button></div></div>
  <div class="component-section"><small>STATUS</small><div class="button-row"><span class="ui-status success">QC 通过</span><span class="ui-status warning">待审核</span><span class="ui-status danger">风控拦截</span><span class="ui-status neutral">生成中</span></div></div>
  <div class="component-section"><small>FORM</small><div class="form-row"><label>生成类型<select><option>生活场景图</option><option>白底主图</option><option>卖点图</option></select></label><label>目标站点<input value="Amazon US" /></label><label>批量数量<input value="4" /></label></div></div>
  <div class="component-section"><small>QUOTA</small><div class="quota-box"><div><b>本次生成</b><span>预计消耗 1 SKU 配额 · 高清导出另计</span></div><strong>12 / 20</strong></div></div>
</div>

## 图片网格与审核卡片

<div class="ui-gallery"><div v-for="n in 4" :key="n" class="ui-gallery-card"><div class="ui-product-image" :class="`tone-${n}`"><span>{{ n === 1 ? '原图' : `生成 v${n}` }}</span></div><div class="ui-card-meta"><b>{{ n === 1 ? 'source.jpg' : `scene-v${n}.png` }}</b><span>{{ n === 3 ? '需人工确认' : 'QC 通过' }}</span></div></div></div>

## 响应式规格

| 断点 | 布局 | 关键规则 |
| --- | --- | --- |
| ≥1280px | 固定 240px 侧栏，内容最大 1440px，网格 4–6 列 | 桌面批量生产 |
| 768–1279px | 侧栏抽屉，网格 3–4 列，配置栏改 Sheet | 平板管理 |
| ≤767px | 底部导航，网格 2 列，审核全屏，底部主操作栏 | 移动审核 |

## 组件契约

`AppShell`、`Sidebar`、`Topbar`、`Breadcrumb`、`ProjectCard`、`SkuCard`、`UploadDropzone`、`AnalysisSummary`、`GenerationForm`、`QuotaConfirmDialog`、`TaskProgress`、`ResultGrid`、`ImageCompare`、`VersionSelector`、`QcChecklist`、`ExportDrawer`、`EmptyState`、`Skeleton`、`ErrorState`、`Toast`。

## 可访问性要求

- 触控目标不小于 44×44px。
- 所有输入有可见 Label，错误信息与输入关联。
- 弹窗打开时焦点进入，`Esc` 关闭后回到触发控件。
- 异步状态使用 `aria-live` 通知。
- 键盘可完成主要 Web 流程。
- 状态标签必须包含文字或图标，不能只显示颜色。
