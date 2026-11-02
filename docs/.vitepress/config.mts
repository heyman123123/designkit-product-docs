import { defineConfig } from 'vitepress'

// GitHub Pages 项目站点部署在 /<repo>/ 子路径下；本地与根域部署回退到 /
const base = process.env.DOCS_BASE || '/'

export default defineConfig({
  base,
  title: 'DesignKit Commerce Visual OS',
  description: 'AI 电商商品视觉资产生产系统产品文档',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: `${base}logo-mark.svg` }]],
  themeConfig: {
    logo: '/logo-mark.svg',
    nav: [
      { text: '总览', link: '/' },
      { text: '产品原型', link: '/prototype' },
      { text: 'UI 设计', link: '/ui-design' },
      { text: '技术架构', link: '/technical-architecture' },
      { text: '多租户', link: '/multi-tenant' },
      { text: '管理后台', link: '/admin-console' },
      { text: '实现规划', link: '/implementation-plan' },
      { text: '商业化', link: '/growth-plan' },
    ],
    sidebar: {
      '/': [
        { text: '项目总览', items: [{ text: '产品总览', link: '/' }, { text: 'PRD', link: '/prd' }] },
        { text: '设计交付', items: [{ text: '需求原型', link: '/prototype' }, { text: 'UI 设计稿', link: '/ui-design' }] },
        { text: '工程交付', items: [{ text: '技术架构', link: '/technical-architecture' }, { text: '多租户与 SaaS', link: '/multi-tenant' }, { text: '管理后台', link: '/admin-console' }, { text: '落地与上线', link: '/delivery-plan' },
            { text: '全功能实现规划', link: '/implementation-plan' }] },
        { text: '商业化', items: [{ text: '推广与增长', link: '/growth-plan' }] },
      ],
    },
    outline: { level: [2, 3] },
    socialLinks: [],
    search: { provider: 'local' },
    footer: { message: 'DesignKit Commerce Visual OS · MVP 产品资料站', copyright: 'Internal planning document' },
  },
})
