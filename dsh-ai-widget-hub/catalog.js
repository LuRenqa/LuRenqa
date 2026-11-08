/**
 * dsh-ai-widget-hub —— 挂件静态目录（Host 与 Client 共用的单一数据源）。
 *
 * 这里只放**不随运行期变化**的展示信息与定位信息：
 *   - id / title / subtitle / accent / description：卡片展示
 *   - moduleName：到 pluginManager.listPlugins() 的 entries 里按包名匹配
 *   - route / script：Client 半补载挂件脚本时使用
 *   - rootClass：Client 半用全局 CSS 即时隐藏/显示桌宠 DOM 时使用
 *   - iconFile：assets/icons/ 下的文件名，Host 图标路由据此读字节
 *
 * entryId 不写死：由 Host 在运行期按 moduleName 查 listPlugins() 得到。
 */

/** 8 只挂件共用的描述（SPEC §3）。 */
export const SHARED_DESCRIPTION =
  '余额 / 今日已用 / 峰谷时段 / 每轮消耗，点她会冒泡泡；可换角色图、调大小、改气泡与音效。'

/** @typedef {{ id:string, title:string, subtitle:string, accent:string, description:string, moduleName:string, route:string, script:string, rootClass:string, iconFile:string }} WidgetCatalogEntry */

/** @type {WidgetCatalogEntry[]} */
export const WIDGETS = [
  {
    id: 'neko',
    title: 'Gemini娘',
    subtitle: '银灰笔记风',
    accent: '#8e75f0',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-neko-widget',
    route: '/dsh-neko/',
    script: '/dsh-neko/widget.js',
    rootClass: '.dshnkv-root',
    iconFile: 'neko.png',
  },
  {
    id: 'kimi',
    title: 'Kimi娘',
    subtitle: '反光银灰',
    accent: '#9aa7b5',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-kimi-widget',
    route: '/dsh-kimi/',
    script: '/dsh-kimi/widget.js',
    rootClass: '.dshkmv-root',
    iconFile: 'kimi.png',
  },
  {
    id: 'glm',
    title: 'GLM娘',
    subtitle: '纯黑镜面',
    accent: '#6b6b6b',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-glm-widget',
    route: '/dsh-glm/',
    script: '/dsh-glm/widget.js',
    rootClass: '.dshglv-root',
    iconFile: 'glm.png',
  },
  {
    id: 'qwen',
    title: '千问娘',
    subtitle: '浅蓝',
    accent: '#7cc8f0',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-qwen-widget',
    route: '/dsh-qwen/',
    script: '/dsh-qwen/widget.js',
    rootClass: '.dshqwv-root',
    iconFile: 'qwen.png',
  },
  {
    id: 'grok',
    title: 'Grok娘',
    subtitle: '金色',
    accent: '#d4af37',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-grok-widget',
    route: '/dsh-grok/',
    script: '/dsh-grok/widget.js',
    rootClass: '.dshgkv-root',
    iconFile: 'grok.png',
  },
  {
    id: 'whale',
    title: 'DeepSeek娘',
    subtitle: '原版小鲸鱼',
    accent: '#4d6bfe',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-whale-widget',
    route: '/dsh-whale/',
    script: '/dsh-whale/widget.js',
    rootClass: '.dshwv-root',
    iconFile: 'whale.png',
  },
  {
    id: 'xiaoke',
    title: 'Claude娘',
    subtitle: '珊瑚橙',
    accent: '#d97757',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-xiaoke-widget',
    route: '/dsh-xiaoke/',
    script: '/dsh-xiaoke/widget.js',
    rootClass: '.dshxkv-root',
    iconFile: 'xiaoke.png',
  },
  {
    id: 'gptniang',
    title: 'GPT娘',
    subtitle: '青绿',
    accent: '#10a37f',
    description: SHARED_DESCRIPTION,
    moduleName: 'dsh-gpt-niang-widget',
    route: '/dsh-gptniang/',
    script: '/dsh-gptniang/widget.js',
    rootClass: '.dshgnv-root',
    iconFile: 'gptniang.png',
  },
  {
    id: 'mimo',
    title: 'MIMO娘',
    subtitle: '亮橙 · 双形态',
    accent: '#ff6a00',
    description:
      '余额 / 今日已用 / 峰谷时段 / 每轮消耗；亮橙主题，2 秒内连点三下在「日常 / 魔女」两种形态间切换；可换角色图、调大小、改气泡与音效。',
    moduleName: 'dsh-mimo-widget',
    route: '/dsh-mimo/',
    script: '/dsh-mimo/widget.js',
    rootClass: '.dshmmv-root',
    iconFile: 'mimo.png',
  },
]

/** 按 id 查目录；未知 id 返回 undefined。 */
export function findWidget(id) {
  const key = typeof id === 'string' ? id.trim().toLowerCase() : ''
  if (!key) return undefined
  return WIDGETS.find((widget) => widget.id === key)
}
