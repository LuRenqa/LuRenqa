# DSH「AI娘挂件中心」插件 —— 实现规格（单一事实来源）

> 目标：在 DSH Web UI 左侧栏新增一个入口「AI娘」，打开后是一个页面，把 GitHub 仓库
> `https://github.com/LuRenqa/LuRenqa.git` 里全部 8 只「显示余额的桌宠挂件」列成卡片，
> 每张卡片有一个开关，用户可自由开启/关闭某只 AI娘。界面风格参考 DSH「插件市场」的
> 「已安装」列表（圆角卡片 + 标题/版本/描述 + 右侧开关 + 启用状态）。
>
> 本文件由 Lead 维护。实现者只改自己负责的文件；接口以本文件为准。

## v0.2 变更（自包含版）

> 以下覆盖本文件第 0–8 节中与之冲突的描述；其余章节保留为 v0.1 的历史记录。

1. **内置挂件**：9 只挂件的运行时（Host 入口 + 浏览器脚本 + `assets/` + `package.json`；v0.2.1 新增 mimo/MIMO娘 0.1.0）
   已复制到本包 `widgets/<id>/`（`id` = `neko/kimi/glm/qwen/grok/whale/xiaoke/gptniang/mimo`，
   版本 0.4.3 ×7、gptniang 0.3.18、mimo 0.1.1；约 76 MiB / 190 个文件），构建清单见 `widgets/manifest.json`。
   `package.json` 的 `files` 增加 `"widgets/**"`。
2. **挂载 / 卸载自己来**：`index.js` 不再依赖 `pluginManager`，改为
   `ctx.plugin(内嵌挂件插件)` 挂载、`fiber.dispose()` 卸载（Cordis child plugin）。
   插件 apply 时按状态文件把已启用的挂件挂上；`POST /dsh-ai-hub/toggle` 现场挂 / 卸并持久化。
3. **状态文件**：`$DSH_HOME/dsh-ai-widget-hub.json`（`{ version:1, enabled:{<id>:bool} }`，默认 9 只全开），
   原子写；运行期诊断 `$DSH_HOME/dsh-ai-widget-hub.runtime.json`（`{ at, pid, mounted, errors }`）。
   因此 §5 中“开关后 Host 不写任何状态文件”“状态由 profile patch 持久化”的旧描述作废。
4. **安装面**：只需安装 `dsh-ai-widget-hub`；8 个独立挂件包（`dsh-neko-widget` 等）降级为
   standalone 版本，**不得与 hub 同时安装**（同一批 `/dsh-*` 路由重复注册）。
5. **HTTP API 不变**：`GET /dsh-ai-hub/state`（新增 `bundled:true`；`installed` 恒 true、
   `entryId` 恒 null）、`POST /dsh-ai-hub/toggle`（`application:'applied' | 'failed'`）、
   `GET /dsh-ai-hub/icon/<id>.png`。Client 半 UI 与交互不变，仅副标题改为“已内置全部 9 只挂件”。
6. **首次安装仍需重启一次桌面客户端**（页面注入表在宿主启动时缓存）；之后开关全部即时生效。
7. **v0.2.1 新增 MIMO娘**（`mimo`，`dsh-mimo-widget` 0.1.1）：亮橙主题（气泡边框 / 气泡文字 / 菜单色块），
   双形态图片 `assets/mimo1.png`（日常形）与 `assets/mimo2.png`（魔女形）；**2 秒内连续点击 3 下**切换一次
   （图一 ↔ 图二，client `mimoToggleForm` + host `/dsh-mimo/image2.png`）；两图均使用源图自带的透明通道裁切（v0.2.2 修复黑底）。
8. **v0.2.3 GPT娘新增状态2**（内嵌 `dsh-gpt-niang-widget` 0.3.18）：`assets/gptniang2.png`（白底 JPG 去底、610×610 底边对齐）；
   切换方式同 MIMO娘（2 秒内连点 3 下，`gptToggleForm` + host `/dsh-gptniang/image2.png`）；
   状态2 默认比状态1 大 3 档（滑块档位 +3 = 0.3 scale）；v0.2.5 起只放大角色图片本体（`applyArtScale`），不改用户保存的基础大小。
9. **v0.2.4 其余 7 只全部双形态**（内嵌 `dsh-*-widget` 0.4.3）：neko/kimi/glm/qwen/grok/xiaoke/whale 各新增
   `assets/<id>2.png`（白底 JPG/PNG 去底，610×610 底边对齐），host 新增 `GET /dsh-<id>/image2.png`；
   client 增加 `<id>ToggleForm` + 2 秒内连点 3 下计数；v0.2.5 起状态2 的放大只作用于角色图片本体；
   逻辑与 GPT娘一致（不改用户保存的基础大小、只对默认角色生效）。
10. **v0.2.5 修正**：① 状态2 的放大改为只作用于角色 `img`（CSS `width/height: calc(59.45% * var(--dsh<前缀>-art-scale, 1))`，
    `applyArtScale()` 在切换/改大小时设置该变量），root 整体 scale 与气泡 / 菜单 / 命中框均不变；
    ② 8 张状态2 素材改用 isnet-anime ONNX 分割 + 边缘颜色解混（`C = aF + (1-a)W` 反解）重新生成，MIMO娘不变。
11. **v0.2.6 性能**（多只同开）：① 轮询 1000ms → 3000ms + 随机相位；页面 hidden 时跳过；余额刷新错峰；
   ② TTL 巡检 1000ms → 2000ms；③ 形态切换去掉 `setScale`（避免强制回流 + 写配置），改 `applyArtScale()`；
   ④ 状态2 图片延迟预热 `new Image()`；命中图 clip 按 URL 缓存；⑤ hub 面板轮询 5s → 12s。
12. **v0.2.7 性能·第二轮**：① 形态切换去掉 `setupHitTest`（沿用形态1命中图）；② 消耗泡泡 `scheduleCostBubble` 错峰 0.1~2.6s；
    ③ 新增 `POST /dsh-ai-hub/toggle-all`（Host 并行 mount/unmount，一次 `saveState`）；
    ④ Client「全部开启/全部关闭」改为一次批量请求 + 权威状态校正 + 140ms 错峰补脚本。
13. **v0.2.8**：① 形态切换先调用 `applyHitClip("")` 再 120ms 后 `setupHitTest(url)`，避免旧 clip 裁掉形态2；
    ② 每只挂件菜单新增「气泡大小」行（默认 10 档 = 因子 1.0），`root` 上设置 `--<前缀>-bubble-scale`，
    `.pop` CSS `transform:scale(var(...));transform-origin:100% 100%`；localStorage key `<前缀>-bubble-size` 持久化。
14. **v0.2.9 交互/卡顿优化（trace 驱动）**：① 形态切换只清空旧 clip、不再 `setupHitTest`；
    ② 各挂件 pointerdown/up/click 用 `NearCached`（矩形缓存）+ `MaybeHit`（150ms 命中缓存）；
    ③ pointermove 距挂件 >320px 直接返回（不做 elementFromPoint / 命中检测）；
    ④ 点击后的 `refresh(true)` 700ms 去重；⑤ `data-dsh-widget-root` 标记 + 跨挂件事件忽略 + 共享 z-index 置顶，
    修复菜单点击穿透到其它 AI娘的问题。
15. **v0.2.10 点击回归修复**：跨挂件事件忽略从「只要 target 在别的挂件子树里就 return」改为——
    若 target 是对方的角色图（类名 `*-img`，其透明边距可能盖住别的挂件），允许继续坐标命中；
    其它对方 UI（菜单/气泡/面板）仍忽略。避免多只重叠时点击被透明边距“吃掉”。

## 0. 关键结论（已由 Lead 实测/查证，不要再自行推翻）

1. 8 只挂件都已安装并 active，都是**同一类 Host+Client 插件**：Host 注册 `/dsh-xxx/*` 路由，
   并往页面注入 `<script src="/dsh-xxx/widget.js">`；脚本在 `document.body` 里建一个
   `.<prefix>-root` 的桌宠 DOM。
2. 挂件行可以用 Host 服务 `ctx.pluginManager.setPluginEnabled(entryId, enabled)` **热开关**，
   实测返回 `{ changed:true, application:'applied' }`，无需重启。关闭后 Host 半会卸载
   （路由与注入行注销），页面刷新后就不会出现该挂件。
3. 页面已加载时关闭挂件，桌宠 DOM 不会自己消失 → 本插件 Client 半用全局 CSS
   （`html.dshaihub-off-<id> .<prefix>-root{display:none!important}`）即时隐藏；
   重新开启时移除 class；如果该页本次从未加载过它的脚本（页面加载时它是关的），
   则由 Client 动态 `document.body.appendChild(<script src=脚本地址>)` 补加载。
4. 左侧栏入口 = Client 插槽 `sidebar.panellist`（list，注册 `id/order/label` + 图标组件，
   owner 自动渲染按钮并 `selectPanel(id)`）。对应主面板 = 插槽 `main`（keyed，key 相同）。
   已在线上确认：`sidebar.panellist` 现有 occupants: `plugins`(order 0)、`schedules`(order 10)；
   `main` keys: `plugins`、`conversation`、`schedules`。
5. 本插件是**普通 bundle 插件**（`dsh.bundle.patch` + `dsh.client` + `window.__ModuleLoader__.load`），
   不是 cordis 动态包；Client 半是普通页面 JS 模块，可以用 `fetch`/`document`。
   **不要**使用 `host.call`/`harness.handle`（那是动态包的机制）。
6. 不要 import 任何 `@deepseek-ai/dsh-client-*` 包；React 从 `require('react')` 拿。
   不要写 JSX（无构建步骤），用 `React.createElement`。

## 1. 目录与文件所有权

插件包目录：`C:\Users\Administrator\plugins\dsh-neko-widget\dsh-ai-widget-hub\`
（该目录本身会被 `plugin_manager install_bundle` 以 link 方式装进 desktop profile。）

| 文件 | 负责人 | 说明 |
| --- | --- | --- |
| `SPEC.md` | Lead | 本文件 |
| `package.json` | host-dev | 清单，见 §2 |
| `cordis.patch.yml` | host-dev | 插入本插件行，见 §2 |
| `index.js` | host-dev | Host 半：HTTP API + 开关逻辑 + 图标路由 + 静态资源 |
| `catalog.js` | host-dev | 8 只挂件的静态目录（Host 用），见 §3 |
| `client.js` | ui-dev | Client 半：左侧栏入口 + 面板 UI + 开关交互，见 §5/§6 |
| `locale/zh.json`, `locale/en.json` | host-dev | 插件市场/设置里显示用的 meta，见 §2 |
| `icon.svg` | host-dev | 插件图标（原创 SVG） |
| `assets/icons/<id>.png` | host-dev | 8 张卡片头像，从各挂件包取图裁成 96×96，见 §4 |
| `README.md` | verifier | 安装/使用/截图占位说明 |
| 仓库根 `README.md` 索引 | verifier | 在 `LuRenqa` 仓库根 README 增加本插件一节 |

## 2. package.json / cordis.patch.yml / locale

`package.json`（照抄，只允许在 files 里保持一致）：

```json
{
  "name": "dsh-ai-widget-hub",
  "version": "0.1.0",
  "description": "DSH 左侧栏 AI娘挂件中心：一个入口集中开关全部余额桌宠（DeepSeek/Gemini/Kimi/GLM/千问/Grok/Claude/GPT）。",
  "type": "module",
  "main": "index.js",
  "icon": "./icon.svg",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg"
  },
  "files": ["index.js", "catalog.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg", "assets/icons/*.png", "README.md"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true, "inject": [] }
  },
  "license": "MIT"
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: ai-widget-hub
      name: dsh-ai-widget-hub
```

`locale/zh.json`：

```json
{ "meta": { "title": "AI娘挂件中心", "description": "在左侧栏集中管理全部余额桌宠（AI娘）的开关。" } }
```

`locale/en.json`：

```json
{ "meta": { "title": "AI Widget Hub", "description": "One sidebar entry to switch all balance pet widgets (AI girls) on or off." } }
```

## 3. 挂件目录（catalog.js，Host 与 Client 都需要同一份数据；Client 从 Host API 拿，不重复硬编码）

字段：`id, title, subtitle, description, accent, moduleName, route, script, rootClass, iconFile`

| id | title | subtitle | accent | moduleName（用 moduleName 匹配 pluginManager 条目） | route | script | rootClass |
| --- | --- | --- | --- | --- | --- | --- | --- |
| neko | Gemini娘 | 银灰笔记风 | #8e75f0 | dsh-neko-widget | /dsh-neko/ | /dsh-neko/widget.js | .dshnkv-root |
| kimi | Kimi娘 | 反光银灰 | #9aa7b5 | dsh-kimi-widget | /dsh-kimi/ | /dsh-kimi/widget.js | .dshkmv-root |
| glm | GLM娘 | 纯黑镜面 | #6b6b6b | dsh-glm-widget | /dsh-glm/ | /dsh-glm/widget.js | .dshglv-root |
| qwen | 千问娘 | 浅蓝 | #7cc8f0 | dsh-qwen-widget | /dsh-qwen/ | /dsh-qwen/widget.js | .dshqwv-root |
| grok | Grok娘 | 金色 | #d4af37 | dsh-grok-widget | /dsh-grok/ | /dsh-grok/widget.js | .dshgkv-root |
| whale | DeepSeek娘 | 原版小鲸鱼 | #4d6bfe | dsh-whale-widget | /dsh-whale/ | /dsh-whale/widget.js | .dshwv-root |
| xiaoke | Claude娘 | 珊瑚橙 | #d97757 | dsh-xiaoke-widget | /dsh-xiaoke/ | /dsh-xiaoke/widget.js | .dshxkv-root |
| gptniang | GPT娘 | 青绿 | #10a37f | dsh-gpt-niang-widget | /dsh-gptniang/ | /dsh-gptniang/widget.js | .dshgnv-root |

共同描述（可用同一句，或在 catalog 里每只单独写）：
`余额 / 今日已用 / 峰谷时段 / 每轮消耗，点她会冒泡泡；可换角色图、调大小、改气泡与音效。`

行 id（entryId）不要写死：Host 用 `listPlugins()` 按 `moduleName` 找到条目，取 `entryId`
（实测：kimi → `include:kimi-widget`，whale → `include:dsh-whale-widget`）。找不到 => `installed:false`。

`catalog.js` 形式（ESM）：

```js
export const WIDGETS = [ { id:'neko', title:'Gemini娘', subtitle:'银灰笔记风', accent:'#8e75f0', description:'…', moduleName:'dsh-neko-widget', route:'/dsh-neko/', script:'/dsh-neko/widget.js', rootClass:'.dshnkv-root', iconFile:'neko.png' }, … ]
```

## 4. 图标资源

把下列源图用 Python(Pillow) 居中方形裁剪 → 缩放到 96×96 → 存为
`assets/icons/<id>.png`（PNG，体积尽量小）：

| id | 源图 |
| --- | --- |
| neko | `C:\Users\Administrator\plugins\dsh-neko-widget\icon.png` |
| kimi | `…\dsh-kimi-widget\icon.png` |
| glm | `…\dsh-glm-widget\icon.png` |
| qwen | `…\dsh-qwen-widget\icon.png` |
| grok | `…\dsh-grok-widget\icon.png` |
| whale | `…\dsh-whale-widget\icon.png` |
| xiaoke | `…\dsh-xiaoke-widget\icon.png` |
| gptniang | `…\dsh-gpt-niang-widget\assets\gptniang1.png` |

可用 bundled Python：先调用 `load_workspace_dependencies` 拿 python 路径（或 `python` / `py` 均可），
脚本写成工作区里的临时 .py 文件再执行。若某源图不存在，就用纯色+首字生成占位 PNG，并在结果里说明。

## 5. Host 半（index.js）接口契约

插件导出：`export default { name: 'ai-widget-hub', apply(ctx) { … } }` 或
`export function apply(ctx, config) {}`（二选一，不要混）。建议在 `apply` 里
`ctx.inject(['webServer', 'pluginManager'], (ctx) => { … })`，可选服务缺失时插件保持不激活而不是抛错。

路由（用 `ctx.webServer.register({ kind:'exact', path, handler })`，清理函数用 `ctx.effect` 收集）：

### GET `/dsh-ai-hub/state`
返回 JSON：
```json
{
  "ok": true,
  "widgets": [
    {
      "id": "kimi",
      "title": "Kimi娘",
      "subtitle": "反光银灰",
      "description": "余额 / 今日已用 / 峰谷时段 / 每轮消耗…",
      "accent": "#9aa7b5",
      "route": "/dsh-kimi/",
      "script": "/dsh-kimi/widget.js",
      "rootClass": ".dshkmv-root",
      "iconUrl": "/dsh-ai-hub/icon/kimi.png",
      "installed": true,
      "enabled": true,
      "fiberPhase": "active",
      "entryId": "include:kimi-widget",
      "version": "0.4.2"
    }
  ]
}
```
数据来源：`await ctx.pluginManager.listPlugins()`（entries 有 entryId/moduleName/enabled/fiberPhase）
+ `await ctx.pluginManager.listBundles()`（BundleInfo 有 name/version/description/enabled/meta）。
按 moduleName 匹配；`version` 取对应 bundle 的 version（找不到就 "0.0.0"）。
`enabled` 以插件条目 enabled 为准（bundle 未启用时条目不存在 → installed:false）。
`Cache-Control: no-store`。

### POST `/dsh-ai-hub/toggle`
请求 JSON：`{ "id": "kimi", "enabled": false }`。
处理：按 id 查 catalog → 用 listPlugins 找 entryId → `await ctx.pluginManager.setPluginEnabled(entryId, enabled)`。
注意 `setPluginEnabled` 返回 `ChangeResult{ changed, application, enabled?, error? }`，且可能抛错；
返回 JSON：`{ ok:true, id, changed, application, enabled, warnings }` 或
`{ ok:false, id, error: { code, message } }`（HTTP 200 即可，错误放 body；参数非法返回 400）。
开关后 Host **不需要**自己写任何状态文件（profile patch 就是持久化）。

### GET `/dsh-ai-hub/icon/<id>.png`
从本包 `assets/icons/<id>.png` 读文件返回 `image/png`；找不到 404 纯文本。
（用 `path.dirname(fileURLToPath(import.meta.url))` 定位包根，不要写死绝对路径。）

### 安全
所有路由先做：Host 头必须是回环地址（`localhost` / `*.localhost` / `127.0.0.0/8` / `::1`），
`sec-fetch-site: cross-site` 拒绝，带 `Origin` 时必须与 Host 同源；否则 403。
POST 额外要求回环 Host（同一条已满足）。
若 `ctx.get('connection')?.requestRejection` 存在则**也**委托它（返回非空即按它拒绝）。
不要引用任何凭据/不需要的服务。

## 6. Client 半（client.js）要求

结构（照 `templates/decoration/client.js` 的写法，无 JSX）：

```js
window.__ModuleLoader__.load({
  id: 'dsh-ai-widget-hub',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // …组件…
    return {
      inject: ['slots'],
      apply(ctx) { … },
    };
  },
});
```

`apply(ctx)` 里做三件事，全部用 `ctx.effect` 登记清理：

1. **全局隐藏样式**：创建 `<style data-dshaihub-gate>` 插到 `document.head`，内容
   `html.dshaihub-off-<id> <rootClass>{display:none!important}`（8 条；id/rootClass 来自 state 请求结果，
   首帧可先用内置兜底表）。`ctx.effect(() => { …; return () => el.remove() })`。
2. **左侧栏入口**：
   ```js
   ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
     name: 'sidebar.panellist', id: 'ai-widgets', order: 20,
     label: () => 'AI娘', locale: 'aiWidgetHub',
   }, HubSidebarIcon));
   ```
   `HubSidebarIcon({ size, active })` 画原创内联 SVG（两只猫耳 + 一颗星，`currentColor`，
   宽高 = size，`aria-hidden`），激活时用 `--dsw-alias-brand-primary`，否则 `currentColor`。
3. **主面板**：
   ```js
   ctx.slots.inject('main', () => ctx.slots.register({
     name: 'main', key: 'ai-widgets', locale: 'aiWidgetHub',
   }, HubPage));
   ```
   若 `ctx.locale` 存在，先 `ctx.locale.register('aiWidgetHub','zh',{…})` 与 `'en'`，
   页面文字用 `ctx.locale.bind('aiWidgetHub')`；拿不到 locale 服务就直接用中文文案（要有兜底）。

### 数据与交互
- 页面 mount 时 `fetch('/dsh-ai-hub/state', { cache:'no-store' })`；失败显示错误条 + 重试按钮。
- 每 5s 轮询一次 state（页面卸载/隐藏时清理 interval）；窗口 focus 时也刷新。
- 把 state 应用到 DOM：对每只 `enabled===false` 的挂件 `document.documentElement.classList.add('dshaihub-off-'+id)`；
  `enabled===true` 则 remove。**首帧不要**对「加载时就关着」的挂件补脚本。
- 用户点开关：乐观更新 UI → `POST /dsh-ai-hub/toggle` → 成功后：
  - 关闭：立刻 `classList.add(...)`（隐藏现有桌宠）。
  - 开启：`classList.remove(...)`；若 `document.querySelector(rootClass)` 为空且
    `application === 'applied'`，则 `document.body.appendChild(<script src=script>)` 补加载
    （`script.dataset.dshaihub = id`；`onerror` 吞掉）。
  - 失败/`application !== 'applied'`：回滚开关、显示一条提示（"需重启后生效"/错误）。
- 顶部工具栏：搜索框（按标题/副标题过滤）、「全部开启」「全部关闭」（逐个调用 toggle，串行，带 loading 态）、「刷新」。
- 卡片布局：两列 grid（窄屏一列），每卡：96? 改为 40px 圆角头像（`iconUrl`，onError 用首字占位）、
  标题 + 版本号小字、副标题、两行截断描述、底部左「● 启用中 / ○ 已关闭 / 未安装」状态位、右侧开关。
- 开关必须是自绘开关（`role="switch"`、`aria-checked`、键盘 Space/Enter 可切），样式用 theme tokens：
  `--dsw-alias-bg-base|bg-layer-1|bg-layer-2|border-l1|border-l2|label-primary|label-secondary|label-tertiary|brand-primary|state-success-primary|state-idle-primary|state-error-primary`。
  强调色 accent 只用在头像描边/小圆点等装饰上（允许字面色）。
- 页面容器：`padding: 24px 28px; box-sizing: border-box; height: 100%; overflow: auto;`，内容最大宽 980px 居中。
  标题「AI娘挂件中心」+ 副标题「选择要在右下角显示的余额桌宠，开关即时生效，下次启动沿用」。
- 空态/未安装：卡片开关 disabled，状态显示「未安装」，hover 提示用 title 属性即可。
- 所有可见文案（除挂件名）通过 t() 走 locale 字典；中英两份。

### 禁止
- 不改 profile 的 `package.json` / `cordis.patch.yml`。
- 不使用 `@deepseek-ai/dsh-client-ui-primitives` 或任何 Harness Client 包。
- 不 import 第三方库、不引入构建步骤、不写 JSX/TS。
- 不把 UI 渲染到 `document.body`（只允许全局 style 与被注入的挂件 script 标签）。

## 7. 自检（实现者交付前必须做）
```
node --check index.js && node --check catalog.js && node --check client.js
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
```
再跑一个 Node 冒烟：用假 ctx mock 调 `apply()`（可选），确认没有语法/导入错误。
禁止在本机执行 `plugin_manager` 安装（由 Lead 统一安装验收）。

## 8. 验收（Lead/verifier）
1. `plugin_manager install_bundle` target = 包目录绝对路径 → `application: applied`。
2. `cordis_inspect_query` client `Slots.listSubTree` root=`sidebar.panellist` 应出现 `ai-widgets`；
   root=`main` 应出现 key `ai-widgets`。
3. `curl`（或 node fetch）`http://127.0.0.1:<GUI端口>/dsh-ai-hub/state` 返回 8 只，enabled 与
   `plugin_manager list_plugins` 一致；`POST toggle {id:'grok',enabled:false}` 返回 applied，
   再 list_plugins 确认 `include:grok-widget` enabled=false，最后恢复 true。
4. 页面/图标资源存在且 `node --check` 通过；视觉验证受限于无浏览器控制，交付报告里要如实说明。
