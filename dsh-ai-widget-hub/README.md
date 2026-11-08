# DSH AI娘挂件中心（dsh-ai-widget-hub）

DeepSeek Harness（DSH）Web 界面左侧栏的一个入口：**「AI娘」**。
打开后是一页卡片式的「AI娘挂件中心」，把本仓库全部 **8 只显示余额的桌宠挂件**（AI娘）列成卡片，
每张卡片一个开关，**即时开 / 关**，不用再逐个去插件市场里翻。

> 📷 截图占位：`docs/screenshot.png` 待补。当前开发环境没有浏览器自动截图能力，页面样式与交互以实际运行效果为准（见文末「说明与限制」）。

## 它做什么

- 🧭 **一个入口管全部**：左侧栏「AI娘」（panel id `ai-widgets`，order 20）→ 一页列出 8 只挂件
- 🔘 **即时开关**：开关走 DSH 的 `pluginManager.setPluginEnabled` 热应用，不用重启 DSH；页面里已经显示着的桌宠会立刻被隐藏 / 重新显示
- 💾 **自动持久化**：开关状态由 DSH 写进当前 profile 的 `cordis.patch.yml`，下次启动沿用；本插件自己**不保存任何状态文件**
- 🔄 **状态自动同步**：每 5 秒轮询一次真实插件状态（页面在后台时暂停），窗口重新聚焦时也刷新；以 `pluginManager` 的实时结果为准，不是本地缓存说了算
- 🔎 **搜索 / 批量 / 刷新**：按名字 / 风格过滤；「全部开启」「全部关闭」串行逐个切换并显示进度；手动刷新
- 🧩 **未安装也能看见**：8 只挂件中没装的会显示「未安装」并禁用开关，不会假装成功
- 🌐 **中英双语**：界面文案内置 zh / en 字典，注册到 DSH locale 服务；拿不到 locale 时用中文兜底
- 🛡️ **出错只坏这一页**：加载失败给错误条 + 重试，渲染异常由错误边界接住，不影响 DSH 其它页面

## 支持的挂件（8 只）

| id | 挂件 | 主题 | 路由 | 对应插件包 |
| --- | --- | --- | --- | --- |
| `neko` | Gemini娘 | 银灰笔记风 | `/dsh-neko/` | `dsh-neko-widget` |
| `kimi` | Kimi娘 | 反光银灰 | `/dsh-kimi/` | `dsh-kimi-widget` |
| `glm` | GLM娘 | 纯黑镜面 | `/dsh-glm/` | `dsh-glm-widget` |
| `qwen` | 千问娘 | 浅蓝 | `/dsh-qwen/` | `dsh-qwen-widget` |
| `grok` | Grok娘 | 金色 | `/dsh-grok/` | `dsh-grok-widget` |
| `whale` | DeepSeek娘 | 原版小鲸鱼 | `/dsh-whale/` | `dsh-whale-widget` |
| `xiaoke` | Claude娘 | 珊瑚橙 | `/dsh-xiaoke/` | `dsh-xiaoke-widget` |
| `gptniang` | GPT娘 | 青绿 | `/dsh-gptniang/` | `dsh-gpt-niang-widget` |

> 本插件**不代替**这些挂件：8 只挂件仍要各自安装；中心只负责集中开关。
> 未安装的挂件卡片显示「未安装」，开关禁用；本插件不修改任何挂件代码，也不共享它们的路由 / 存储 / DOM。

## 工作原理（为什么开关能即时生效）

Host 半（`index.js`）注册 3 条 `webServer` 路由：

| 路由 | 作用 |
| --- | --- |
| `GET /dsh-ai-hub/state` | 8 只挂件的目录 + 运行期状态（`listPlugins()` / `listBundles()` 实时读取，`no-store`） |
| `POST /dsh-ai-hub/toggle` | `{ id, enabled }` → 对对应插件行调用 `pluginManager.setPluginEnabled(entryId, enabled)` |
| `GET /dsh-ai-hub/icon/<id>.png` | 卡片头像，从本包 `assets/icons/` 读取（96×96 PNG） |

`entryId` **不写死**：按目录里的包名（`moduleName`）去 `listPlugins()` 里匹配，所以 `include:kimi-widget`、
`include:grok-widget` 这类 DSH 运行时生成的 id 变化不影响开关。

Client 半（`client.js`）在插槽里注册左侧栏入口和主面板，并做两件"网页侧"的事：

1. **全局隐藏样式**：往 `<head>` 插一条 `<style>`，内容形如
   `html.dshaihub-off-<id> .<挂件根 class>{display:none!important}`（8 条，`rootClass` 以 Host 返回的为准）。
2. **即时开关**：
   - **关闭**：`<html>` 加 `dshaihub-off-<id>` → 已存在的桌宠 DOM 立刻隐藏；Host 侧同时热卸载该插件行（路由与脚本注入行注销）。
   - **开启**：移除 class；如果页面里没有该挂件的 DOM（本次加载时它是关的，Host 没注入脚本）且切换返回
     `application === 'applied'`，再由 Client 追加一个 `<script src="/dsh-xxx/widget.js">` 把它补加载起来。
   - 失败或没能即时应用（例如返回需要重启）：UI 回滚到切换前，并给出提示 —— 不让开关"说谎"。

请求前先做**乐观更新**（开关先动、DOM 先隐藏/显示），请求失败再回滚；5 秒轮询会和服务端状态合并，
不会把正在切换中的开关打回去。

## 界面

- 页头：「AI娘挂件中心」+「选择要在右下角显示的余额桌宠，开关即时生效，下次启动沿用」
- 工具栏：搜索框、全部开启、全部关闭、刷新
- 卡片：两列 grid（窄屏一列），每张卡 = 40px 圆角头像（96×96 源图，加载失败用首字占位）+ 标题 + 版本号 +
  副标题 + 两行描述 + 状态点（● 启用中 / ○ 已关闭 / 未安装）+ 右侧自绘开关（`role="switch"`，键盘 Space / Enter 可切）
- 主题：全部使用 DSH theme token（`--dsw-alias-*`），深色 / 浅色跟随宿主；挂件强调色只用于头像描边等装饰
- 空态 / 加载骨架 / 错误条 + 重试 / 操作提示条 / React 错误边界

## 安装

本插件未发布到 npm，按本地包（link）安装：

```bash
# 让 DSH 把本目录以 link 方式装进当前 profile
dsh plugin --profile <profile> add link:<本目录绝对路径>
```

也可以在 DSH 里用插件管理（`plugin_manager install_bundle`，target 指向本目录绝对路径）。
桌面客户端的 profile 由宿主管理时，等价做法是在 `~/.dsh/profiles/<profile>` 下建 junction 指向本目录，
并把包名加进 profile `package.json` 的 `dependencies` 与 `dsh.profile.bundles`。

安装后 **Host 半热加载即生效**（`/dsh-ai-hub/*` 路由、插件行 active）；
**左侧栏入口属于 Client 半，需要刷新一次页面（或重启客户端）才会出现**。

## 数据与配置

- **没有自己的状态 / 数据文件**：本插件不往 `$DSH_HOME` 写任何文件。
- 唯一的持久化状态，是 DSH 在 profile 的 `cordis.patch.yml` 里为各挂件行维护的 `enabled`（由 `pluginManager` 写入，不是本插件写的）。
- 本插件**不修改** profile 的 `package.json` / `cordis.patch.yml`。
- 没有需要填写的插件配置项（无 Config schema）；语言、主题都跟随 DSH。

## 权限与安全

三条路由统一走一道 fail-closed 栅栏，任何一步异常都按拒绝处理：

- **Host 必须是回环地址**：`localhost` / `*.localhost` / `127.0.0.0/8` / `::1`，否则 403
- **`sec-fetch-site: cross-site`** 拒绝
- **带 `Origin` 时必须与 Host 同源**（`Origin: null` 也拒绝）
- 额外**委托 DSH 自己的 `connection.requestRejection`**（浏览器会话鉴权）

因此：**用普通 shell `curl` 访问这些路由会得到 401**（没有浏览器会话凭据）——这是设计内的安全限制，
不是 bug；页面内的 `fetch` 带 same-origin 凭据，正常工作。

本插件不读取任何凭据、不访问外部网络、不代理第三方接口。

## 目录结构

```
dsh-ai-widget-hub/
├── index.js            Host 半：路由 / 栅栏 / pluginManager 开关 / 图标字节
├── catalog.js          8 只挂件的静态目录（id / 名称 / 主题色 / 路由 / 脚本 / 根 class）
├── client.js           Client 半：左侧栏入口 + 挂件中心页面（无构建、无 JSX）
├── package.json        清单（dsh.bundle.patch + dsh.client）
├── cordis.patch.yml    往 profile 插入本插件行
├── locale/             zh.json / en.json（插件市场里显示的标题与描述）
├── icon.svg            插件图标（原创 SVG）
├── assets/icons/       8 张卡片头像（96×96 PNG）
├── SPEC.md             内部实现规格（开发用，不随包发布）
└── README.md
```

## 说明与限制

- **视觉验证受限**：当前环境没有浏览器自动化 / 截图能力，Client 半的页面与开关交互按规格实现并通过了语法与
  静态检查，但没有做像素级验收；实际样式以运行中的 DSH 页面为准。
- **刷新行为**：开关本身即时生效；页面里已显示的桌宠靠全局 CSS 隐藏，重新开启时优先复用现有 DOM、必要时补加载脚本。
  极少数情况下（脚本已被宿主注销等）刷新一次页面最稳。
- **只认识这 8 只**：目录是静态的，其它第三方挂件不会出现在页面里。
- **接管权限**：若某挂件行被 DSH 标记为不可管理（readOnly），开关请求会失败并回滚，页面会给出提示。
- 主要验证环境是 Windows + DSH 桌面客户端；插件运行在 DSH Web UI 里，和挂件本身是否显示余额无关。

## 许可与致谢

- **代码**：MIT，见仓库根 [LICENSE](../LICENSE)。
- **卡片头像**（`assets/icons/*.png`）：从**本仓库各挂件角色的同一份美术素材**居中裁剪并缩放成 96×96 PNG，
  素材遵循 **CC BY-NC-SA 4.0**，**不可商用**；完整素材来源见仓库根 [PROVENANCE.md](../PROVENANCE.md) 与
  各挂件目录的 `ATTRIBUTION.md` / `LICENSE-ARTWORK`。
- **8 只挂件的来源**（本插件只做统一管理，版权归各原作者 / 上游）：
  - Gemini娘 / Kimi娘 / GLM娘 / 千问娘 / Grok娘：本仓库二创，基于 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT），隔离改造底座参考 [aklnaaw/dsh-xiaoke-widget](https://github.com/aklnaaw/dsh-xiaoke-widget)
  - DeepSeek娘（小鲸鱼）：[MeteorNOX](https://github.com/MeteorNOX)（MIT）
  - Claude娘（小克）：[aklnaaw](https://github.com/aklnaaw)（MIT，素材 CC BY-NC-SA 4.0）
  - GPT娘：[xixingyingmie](https://github.com/xixingyingmie)（MIT）

本项目与 Google / 月之暗面 / 智谱 / 阿里 / xAI / DeepSeek / Anthropic / OpenAI 等官方均无隶属关系，
角色名称仅为个人使用习惯。
