# DSH AI娘挂件中心（dsh-ai-widget-hub）

> v0.2.5 · **自包含版**：一个插件内置全部 9 只余额桌宠，且 9 只都支持双形态。

DeepSeek Harness（DSH）Web 界面左侧栏的一个入口：**「AI娘」**。
打开后是一页卡片式的「AI娘挂件中心」，把 **9 只显示余额的桌宠挂件**（AI娘，含 MIMO娘）列成卡片，
每张卡片一个开关，**即时开 / 关**，不用再逐个去插件市场里翻。

**从 v0.2 起本插件是自包含的**：9 只挂件的完整运行时（Host 半 + 浏览器脚本 + 美术素材）都内嵌在
本包 `widgets/<id>/` 下（约 **76 MiB / 190 个文件**）。**只安装本插件就够了** —— 仓库里的 8 个独立挂件包（MIMO娘只随本插件提供）
（`dsh-neko-widget` / `dsh-kimi-widget` / `dsh-glm-widget` / `dsh-qwen-widget` / `dsh-grok-widget` /
`dsh-whale-widget` / `dsh-xiaoke-widget` / `dsh-gpt-niang-widget`）**不再需要安装**；它们仍留在仓库里，
只供“只想要其中一只挂件”的用户单独使用。

> 📷 截图占位：`docs/screenshot.png` 待补。当前开发环境没有浏览器自动截图能力，页面样式与交互以实际运行效果为准（见文末「说明与限制」）。

## 它做什么

- 🧭 **一个入口管全部**：左侧栏「AI娘」（panel id `ai-widgets`，order 20）→ 一页列出 9 只挂件
- 📦 **自包含**：9 只挂件的 Host 实现与浏览器脚本原样内嵌，装一个插件等于装齐 9 只
- 🔘 **即时开关**：开关由本插件自己**挂载 / 卸载**内嵌挂件（Cordis child plugin），不用重启 DSH；
  页面里已显示的桌宠会立刻被隐藏，重新打开时再补加载它的浏览器脚本
- 💾 **自动持久化**：开关状态写进 `$DSH_HOME/dsh-ai-widget-hub.json`，下次启动沿用；文件损坏时回落到「9 只全开」
- 🔄 **状态自动同步**：每 5 秒轮询一次真实挂载状态（页面在后台时暂停），窗口重新聚焦时也刷新；以 Host 的实时结果为准
- 🔎 **搜索 / 批量 / 刷新**：按名字 / 风格过滤；「全部开启」「全部关闭」串行逐个切换并显示进度；手动刷新
- ✅ **不再有「未安装」**：9 只全部内置，卡片恒为已安装，`enabled` 表示“此刻有没有被挂载”
- 🌐 **中英双语**：界面文案内置 zh / en 字典，注册到 DSH locale 服务；拿不到 locale 时用中文兜底
- 🛡️ **出错只坏这一页**：加载失败给错误条 + 重试，渲染异常由错误边界接住，不影响 DSH 其它页面

## 支持的挂件（9 只）

| id | 挂件 | 主题 | 路由 | 内嵌版本 |
| --- | --- | --- | --- | --- |
| `neko` | Gemini娘 | 银灰笔记风 · 双形态 | `/dsh-neko/` | 0.4.3 |
| `kimi` | Kimi娘 | 反光银灰 · 双形态 | `/dsh-kimi/` | 0.4.3 |
| `glm` | GLM娘 | 纯黑镜面 · 双形态 | `/dsh-glm/` | 0.4.3 |
| `qwen` | 千问娘 | 浅蓝 · 双形态 | `/dsh-qwen/` | 0.4.3 |
| `grok` | Grok娘 | 金色 · 双形态 | `/dsh-grok/` | 0.4.3 |
| `whale` | DeepSeek娘 | 原版小鲸鱼 · 双形态 | `/dsh-whale/` | 0.4.3 |
| `xiaoke` | Claude娘 | 珊瑚橙 · 双形态 | `/dsh-xiaoke/` | 0.4.3 |
| `gptniang` | GPT娘 | 青绿 · 双形态 | `/dsh-gptniang/` | 0.3.18 |
| `mimo` | **MIMO娘** | **亮橙 · 双形态** | `/dsh-mimo/` | 0.1.1 |

上表的路由 / 脚本 / 根 DOM class 以 `catalog.js` 为准，版本号取自内嵌副本的 `package.json`
（`widgets/manifest.json` 是内嵌内容的构建清单，不是运行期数据源）。
每只挂件的功能（余额 / 今日已用 / 峰谷时段 / 每轮消耗、可换角色图、调大小、改气泡与音效）
与独立安装时完全一致，数据文件也仍在原来的位置。

**双形态（v0.2.1 起逐批加入，v0.2.4 覆盖全部 9 只）**：每只挂件都有「形态1 / 形态2」两张角色图，
**2 秒内连续点击 3 下**切换一次（再连点 3 下切回），与气泡开关无关；用户自定义角色 / 动态角色不受影响。
其中 **GPT娘 + 本次 7 只（Gemini / Kimi / GLM / 千问 / Grok / DeepSeek / Claude）的形态2 默认大小比形态1 大 3 档**；
而且 **只放大角色本体（角色图片），气泡、菜单、命中框都保持原尺寸**，仍保持右下角锚点、不覆盖用户保存的基础大小；
MIMO娘只切换形态、不额外放大。

**MIMO娘（v0.2.1 新增）**：亮橙主题——气泡边框、气泡文字、菜单色块渐变、滑杆圆点与投影均为亮橙色。
初始为「日常形态」（图一）；**2 秒内连续点击 MIMO娘 3 下**切换为「魔女形态」（图二），再连点 3 下切回图一。
动态角色（呼吸两帧）取自日常形态；数据文件前缀 `.dshmm-*`，路由 `/dsh-mimo/`。

## v0.2 变更（相对 v0.1）

| 方面 | v0.1 | v0.2（自包含） |
| --- | --- | --- |
| 安装依赖 | 8 只独立挂件包必须各自安装 | **只装本插件**（内置 9 只）；8 只独立包仅保留给 standalone 用法（不得并装；MIMO娘只随本插件） |
| 开关实现 | `pluginManager.setPluginEnabled()` 改 profile 里的插件行 | 本插件用 `ctx.plugin(内嵌挂件)` 挂载 / `fiber.dispose()` 卸载 |
| 是否即时 | 即时（热应用 profile 行） | 即时（Host 半自己挂载 / 卸载，无需重启） |
| 状态保存 | DSH 写在 profile 的 `cordis.patch.yml` | 本插件写 `$DSH_HOME/dsh-ai-widget-hub.json` |
| 未安装状态 | 未安装的卡片显示「未安装」并禁用开关 | 恒为已安装，不再有该状态 |
| 运行期诊断 | 无 | `$DSH_HOME/dsh-ai-widget-hub.runtime.json` |
| 包体积 | 很小（只含面板与图标） | 约 76 MiB（内嵌 9 只挂件运行时） |
| 并存风险 | 无 | **不能**与 8 个独立包同时安装（`/dsh-*` 路由重复注册；MIMO娘无独立包） |

## v0.2.1 ~ v0.2.5 变更（双形态）

- 新增第 9 只内置挂件 **MIMO娘**（`mimo`，路由 `/dsh-mimo/`，内嵌版本 0.1.1），功能与其他 AI娘一致
  （余额 / 今日已用 / 峰谷 / 每轮消耗、气泡系统、音效、角色 / 大小 / 吸附自定义）。
- 主题：**亮橙色** —— 气泡边框、气泡文字、菜单色块、滑杆圆点与投影全部改成橙色系。
- **双形态**：初始「日常形态」（图一）；**2 秒内连续点击 3 下**切换「魔女形态」（图二），再连点 3 下切回图一。
  用户自定义角色 / 动态角色不受影响。
- 美术：两张角色图由仓库作者提供，沿用本仓库 **CC BY-NC-SA 4.0（非商用）** 素材许可。

> **v0.2.2 修复**：MIMO 两张角色图起初因去底脚本把源图自带的透明通道覆盖成不透明，出现了黑底；
> 已改为直接使用源图 alpha 裁切（透明底、底边对齐），并把形态切换从「气泡开关触发」改成「2 秒内连点 3 下」。

> **v0.2.3**：GPT娘 新增第二形态（银白龙娘，`assets/gptniang2.png`），同样用「2 秒内连点 3 下」切换；
> 第二形态默认比第一形态大 3 档（0.3 scale），位置仍锚定右下角。素材由仓库作者提供，透明底处理。

> **v0.2.5**：①形态2 的「大 3 档」改为**只放大角色图片本体**，气泡/菜单不再跟着变大；
> ② 8 张状态2 素材（含 GPT娘）改用 **isnet-anime 人像分割**重新抠图，并做边缘颜色解混（去白边），
> 修复此前白底去得不够干净、暗色主题下能看到白边/残留的问题（MIMO娘素材原本干净，未改动）。

> **v0.2.4**：Gemini娘 / Kimi娘 / GLM娘 / 千问娘 / Grok娘 / DeepSeek娘 / Claude娘 各新增第二形态
> （`<id>2.png`，610×610 透明底、底边对齐）；切换方式、形态2 +3 档大小与 GPT娘 完全一致。
> 至此 9 只挂件全部支持双形态。素材由仓库作者提供（CC BY-NC-SA 4.0，非商用）。

## 安装

### 1. 只安装本插件

本插件未发布到 npm，按本地包（link）安装：

```bash
# 让 DSH 把 dsh-ai-widget-hub 目录以 link 方式装进当前 profile
dsh plugin --profile <profile> add link:<仓库绝对路径>/dsh-ai-widget-hub
```

也可以在 DSH 里用插件管理（`plugin_manager install_bundle`，target 指向 `dsh-ai-widget-hub` 目录绝对路径）。
桌面客户端的 profile 由宿主管理时，等价做法是在 `~/.dsh/profiles/<profile>` 下建 junction 指向
`dsh-ai-widget-hub` 目录，并把包名加进 profile `package.json` 的 `dependencies` 与 `dsh.profile.bundles`。

### 2. 先卸掉 / 停用 8 个独立挂件包

如果之前装过 `dsh-neko-widget`、`dsh-whale-widget` 等独立包，请先在插件市场里**停用或卸载它们**，
只保留 `dsh-ai-widget-hub`。原因：内嵌副本与独立包注册的是**同一批 `/dsh-*` 路由**，同时存在会重复注册、
互相打架。独立包目录仍留在仓库里，需要时随时可以再单独安装。

### 3. 首次安装后需要重启一次（桌面客户端）

- Host 半**热加载立即生效**：`/dsh-ai-hub/*` 路由可用，默认开启的 9 只挂件路由也会随之注册。
- **左侧栏「AI娘」入口属于 Client 半，桌面客户端需要完整重启一次 DSH 才会出现** —— 桌面端在宿主启动时
  把页面注入表（含各 Client 插件的启动脚本）缓存下来，装好插件后只刷新页面不会重新收集。
  重启一次之后，**以后所有的开关操作都不再需要重启**。
- 网页端（浏览器直接打开 DSH 的 URL）刷新一次页面即可。

## 工作原理

### Host 半（`index.js`）

启动时：读开关状态 → 对每只 `enabled` 的挂件调用 `ctx.plugin(内嵌挂件插件)` 挂载
（挂件自己的 `/dsh-xxx/*` 路由与页面注入行随之注册）→ 注册本插件自己的 3 条 `webServer` 路由
→ 把当前挂载表写进运行期诊断文件。

| 路由 | 作用 |
| --- | --- |
| `GET /dsh-ai-hub/state` | 8 只挂件的目录 + 是否已挂载 + 内嵌版本（`Cache-Control: no-store`） |
| `POST /dsh-ai-hub/toggle` | `{ id, enabled }` → 挂载 / 卸载对应内嵌挂件并持久化状态 |
| `GET /dsh-ai-hub/icon/<id>.png` | 卡片头像，从本包 `assets/icons/` 读取（96×96 PNG） |

`state` 顶层带 `bundled: true`；每只挂件恒为 `installed: true`、`entryId: null`，
`enabled` 反映“此刻有没有被挂载”，`version` 取自 `widgets/<id>/package.json`。

`toggle` 的流程是：开启 → `ctx.plugin(挂件)` → 等它完成加载（路由 / 注入行就绪）→ 写状态文件；
关闭 → `fiber.dispose()`（路由、注入行、定时器全部撤销）→ 写状态文件。
成功返回 `application: 'applied'`；失败返回 `application: 'failed'` 并回滚内存状态（文件不写），
页面据此回滚开关，不让 UI“说谎”。未知 id、非布尔 `enabled`、非法 JSON 均返回 400；请求体超过上限返回 413。

### Client 半（`client.js`）

1. **全局隐藏样式**：往 `<head>` 插一条 `<style>`，内容形如
   `html.dshaihub-off-<id> .<挂件根 class>{display:none!important}`（8 条，`rootClass` 以 Host 返回的为准，
   首帧用内置兜底表）。
2. **即时开关**：
   - **关闭**：`<html>` 加 `dshaihub-off-<id>` → 已存在的桌宠 DOM 立刻隐藏；Host 侧同时卸载该挂件（路由与注入行注销）。
   - **开启**：移除 class；如果页面里没有该挂件的 DOM（本次加载时它是关的，Host 没注入脚本），
     切换返回 `application === 'applied'` 后，由 Client 追加一个 `<script src="/dsh-xxx/widget.js" data-dshaihub="<id>">`
     把它补加载起来（失败静默，下次再点开关还能重试）。
   - 失败或 `application !== 'applied'`：UI 回滚到切换前，并给出提示。
3. **状态同步**：请求前先做乐观更新（开关先动、DOM 先隐藏 / 显示），失败再回滚；
   每 5 秒轮询 + 窗口 focus 刷新会与服务端状态合并，不会把正在切换中的开关打回去。

## 数据与配置

| 文件 | 用途 |
| --- | --- |
| `$DSH_HOME/dsh-ai-widget-hub.json` | **唯一开关状态文件**：`{ "version": 1, "enabled": { "<id>": true/false } }`，缺省 / 损坏时按 9 只全开处理 |
| `$DSH_HOME/dsh-ai-widget-hub.runtime.json` | 运行期诊断：`{ at, pid, mounted: [...], errors: {...} }`，每次挂载 / 卸载覆盖写；仅排障用 |

- 状态文件写入用“临时文件 + rename”的原子替换；写失败时本次开关报失败并回滚，不会留下半份文件。
- 9 只挂件**自己的**数据文件（外观、账本、泡泡配置、自定义角色 / 音效等）位置不变，
  仍在 `$DSH_HOME` 下各自的 `.dshnk-*` / `.dshkm-*` / `.dshgl-*` … 文件与目录里，见各挂件 README。
- 本插件**不修改** profile 的 `package.json` / `cordis.patch.yml`。
- 没有需要填写的插件配置项（无 Config schema）；语言、主题都跟随 DSH。

## 权限与安全

所有路由（state / toggle / 图标）统一走一道 fail-closed 栅栏，任何一步异常都按拒绝处理：

- **Host 必须是回环地址**：`localhost` / `*.localhost` / `127.0.0.0/8` / `::1`，否则 403
- **`sec-fetch-site: cross-site`** 拒绝
- **带 `Origin` 时必须与 Host 同源**（`Origin: null` 也拒绝）
- 额外**委托 DSH 自己的 `connection.requestRejection`**（浏览器会话鉴权）

POST 请求体上限 16 KiB，超过返回 413；方法不对返回 405。

因此：**用普通 shell `curl` 访问这些路由会得到 401**（没有浏览器会话凭据）——这是设计内的安全限制，
不是 bug；页面内的 `fetch` 带 same-origin 凭据，正常工作。

本插件不读取任何凭据、不访问外部网络、不代理第三方接口；余额取数逻辑在内嵌挂件里，行为与独立安装时一致。

## 目录结构

```
dsh-ai-widget-hub/
├── index.js            Host 半：状态 / 开关 / 挂载卸载 / 路由 / 栅栏 / 图标字节
├── catalog.js          9 只挂件的静态目录（id / 名称 / 主题色 / 路由 / 脚本 / 根 class）
├── client.js           Client 半：左侧栏入口 + 挂件中心页面（无构建、无 JSX）
├── package.json        清单（dsh.bundle.patch + dsh.client；files 含 widgets/**）
├── cordis.patch.yml    往 profile 插入本插件行
├── locale/             zh.json / en.json（插件市场里显示的标题与描述）
├── icon.svg            插件图标（原创 SVG）
├── assets/icons/       9 张卡片头像（96×96 PNG）
├── widgets/            v0.2 内嵌的 9 只挂件运行时（每只 lib/ + assets/ + package.json）
│   ├── manifest.json   内嵌内容的构建清单（id / 入口 / 版本 / 路由 / 根 class）
│   └── <id>/           neko kimi glm qwen grok whale xiaoke gptniang mimo
├── SPEC.md             内部实现规格（开发用，不随包发布）
└── README.md
```

`widgets/` 里的副本保留了各挂件原来的 `lib/` → `../assets/` 相对布局，所以挂件代码不用改一行即可运行；
但没有复制各挂件的 `README.md`、`LICENSE`、`ATTRIBUTION.md`、上游目录等文档文件（版权说明见下节与仓库根）。

## 说明与限制

- **视觉验证受限**：当前环境没有浏览器自动化 / 截图能力，Client 半的页面与开关交互按规格实现并通过了语法与
  静态检查，但没有做像素级验收；实际样式以运行中的 DSH 页面为准。
- **首次安装要重启一次**（桌面客户端）：原因是桌面端在启动时缓存页面注入表；之后开关都即时生效。
- **不要与 8 个独立挂件包同时安装**：同一批 `/dsh-*` 路由会重复注册。
- **刷新行为**：开关本身即时生效；页面里已显示的桌宠靠全局 CSS 隐藏，重新开启时优先复用现有 DOM、必要时补加载脚本。
  极少数情况下（脚本已被宿主注销等）刷新一次页面最稳。
- **体积**：`widgets/` 约 67 MiB，安装 / 复制本包时会一并带上；这是“装一个插件就有 8 只”的代价。
- **只认识这 8 只**：目录是静态的，其它第三方挂件不会出现在页面里。
- **内嵌副本不带许可证文件**：`widgets/<id>/` 只复制了 `lib/`、`assets/` 和 `package.json`，没有带各挂件的
  `LICENSE` / `ATTRIBUTION.md`；本插件包目录里也没有 `LICENSE` 文件。若要单独分发本包（而不是从本仓库安装），
  请一并带上仓库根的 `LICENSE`、`PROVENANCE.md` 与相关挂件的 `ATTRIBUTION.md` / `LICENSE-ARTWORK`。
- 主要验证环境是 Windows + DSH 桌面客户端；插件运行在 DSH Web UI 里，和挂件本身是否显示余额无关。

## 许可与致谢

- **本插件代码**：MIT，见仓库根 [LICENSE](../LICENSE)；`package.json` 声明 `license: MIT`。
- **内嵌的 9 只挂件代码**：均为 **MIT**，版权归各原作者 / 上游（见下表），本插件只做“打包 + 统一开关”，
  未对挂件功能做修改。
- **角色美术素材**：沿用各挂件原许可，**CC BY-NC-SA 4.0，不可商用**；
  完整素材来源见仓库根 [PROVENANCE.md](../PROVENANCE.md) 与各挂件目录的 `ATTRIBUTION.md` / `LICENSE-ARTWORK`。
- **卡片头像**（`assets/icons/*.png`）：从上述同一份美术素材居中裁剪并缩放成 96×96 PNG，
  因此同样遵循 **CC BY-NC-SA 4.0**，不可商用。

| 内嵌挂件 | 上游 / 原作者 | 许可 |
| --- | --- | --- |
| Gemini娘 / Kimi娘 / GLM娘 / 千问娘 / Grok娘 | 本仓库二创，基于 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)；隔离改造底座参考 [aklnaaw/dsh-xiaoke-widget](https://github.com/aklnaaw/dsh-xiaoke-widget) | MIT（代码）/ CC BY-NC-SA 4.0（美术） |
| DeepSeek娘（小鲸鱼） | [MeteorNOX](https://github.com/MeteorNOX) | MIT |
| Claude娘（小克） | [aklnaaw](https://github.com/aklnaaw) | MIT（素材 CC BY-NC-SA 4.0） |
| GPT娘 | [xixingyingmie](https://github.com/xixingyingmie) | MIT |
| **MIMO娘** | 角色美术由仓库作者提供；挂件代码派生自本仓库 Grok娘 / Gemini娘（上游 MeteorNOX） | MIT（代码）/ CC BY-NC-SA 4.0（美术） |

本项目与 Google / 月之暗面 / 智谱 / 阿里 / xAI / DeepSeek / Anthropic / OpenAI 等官方均无隶属关系，
角色名称仅为个人使用习惯。
