# DSH Gemini娘挂件（dsh-neko-widget）

DeepSeek Harness（DSH）Web 界面右下角的一只常驻桌宠：**Gemini娘**。
点她会冒出气泡，显示账户余额、今日已用、峰谷时段与每轮对话消耗；气泡内容、字体、颜色、音效、角色图都能自己改。

本项目是二次创作，基于 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT）的小鲸鱼余额挂件，
并沿用 [aklnaaw/dsh-xiaoke-widget](https://github.com/aklnaaw/dsh-xiaoke-widget) 的隔离改造底座（路由 / 存储 / DOM 全部独立），把角色换成了 **Gemini娘**。

![Gemini娘](assets/neko1.png)

## AI娘挂件中心（本仓库插件，自包含）

本仓库还带一个**自包含**的管理插件 [`dsh-ai-widget-hub/`](dsh-ai-widget-hub/README.md)：
**它已经把下面全部 9 只余额桌宠的运行时内置在自己包里**（`widgets/<id>/`，含 MIMO娘；约 76 MiB），
9 只均支持**双形态**（菜单「角色形态」按钮切换）、**角色/气泡大小独立调节**、点击冷却、**显示到电脑桌面**（透明桌面宠物）、**防卡死重新居中**，
在 DSH 左侧栏增加**一个入口「AI娘」**，打开后是一页卡片式的「AI娘挂件中心」，
每张卡片一个开关，**即时开 / 关**，不用再逐个去插件市场里找。

**只安装 `dsh-ai-widget-hub` 就够了**：仓库里的 8 个独立挂件包不再需要安装（MIMO娘只随 hub 提供）。
开关由 hub 自己用 Cordis child plugin **挂载 / 卸载**内置挂件（无需重启），状态存在
`$DSH_HOME/dsh-ai-widget-hub.json`；它与独立挂件包**不要同时安装**（同一批 `/dsh-*` 路由会重复注册）。

- 入口：左侧栏「AI娘」（panel id `ai-widgets`）；当前版本 **v0.3.0**
- 界面：搜索、全部开启 / 全部关闭、刷新；卡片显示头像 / 版本 / 描述 / 启用状态
- 首次安装后桌面客户端需完整重启一次（页面注入表在启动时缓存）；之后开关都即时生效
- 技术细节、安全栅栏、安装与限制见 [`dsh-ai-widget-hub/README.md`](dsh-ai-widget-hub/README.md)

## 本仓库内容

| 位置 | 内容 | 主题 | 路由 | 说明 |
| --- | --- | --- | --- | --- |
| 根目录 | **Gemini娘**（`dsh-neko-widget`） | 紫色 | `/dsh-neko/` | 独立版（装 hub 就不需要） |
| [`dsh-kimi-widget/`](dsh-kimi-widget/README.md) | **Kimi娘**（`dsh-kimi-widget`） | 反光银灰 | `/dsh-kimi/` | 独立版（装 hub 就不需要） |
| [`dsh-glm-widget/`](dsh-glm-widget/README.md) | **GLM娘**（`dsh-glm-widget`） | 纯黑 | `/dsh-glm/` | 独立版（装 hub 就不需要） |
| [`dsh-qwen-widget/`](dsh-qwen-widget/README.md) | **千问娘**（`dsh-qwen-widget`） | 浅蓝 | `/dsh-qwen/` | 独立版（装 hub 就不需要） |
| [`dsh-grok-widget/`](dsh-grok-widget/README.md) | **Grok娘**（`dsh-grok-widget`） | 金色 | `/dsh-grok/` | 独立版（装 hub 就不需要） |
| [`dsh-whale-widget/`](dsh-whale-widget/README.md) | **DeepSeek娘**（`dsh-whale-widget`） | 蓝 | `/dsh-whale/` | 独立版（装 hub 就不需要） |
| [`dsh-xiaoke-widget/`](dsh-xiaoke-widget/README.md) | **Claude娘**（`dsh-xiaoke-widget`） | 珊瑚橙 | `/dsh-xiaoke/` | 独立版（装 hub 就不需要） |
| [`dsh-gpt-niang-widget/`](dsh-gpt-niang-widget/README.md) | **GPT娘**（`dsh-gpt-niang-widget`） | 青绿 | `/dsh-gptniang/` | 独立版（装 hub 就不需要） |
| [`dsh-ai-widget-hub/`](dsh-ai-widget-hub/README.md) | **AI娘挂件中心**（`dsh-ai-widget-hub`）—— 内置全部 9 只，统一开关 | 挂件管理面板 | 左侧栏「AI娘」 | **自包含：装它即可** |

上表前 8 行是挂件本身，功能一致，路由 / 存储 / DOM 全部隔离，彼此可以**同时安装、同时显示**（每只的详细说明见各自目录）。
最后一行「AI娘挂件中心」不是挂件，而是**把 9 只挂件的运行时打包在一起**的管理插件：

- **推荐用法（省事）**：只装 `dsh-ai-widget-hub`，9 只全部自带，左侧栏「AI娘」里逐只开关；
  此时**不要**再装上面 8 个独立包（会重复注册 `/dsh-*` 路由）。
- **独立用法（只想要一两只）**：只装对应的独立挂件包，不使用 hub。

## 第三方挂件收录（标注原作者）

以下为**第三方作者的 MIT 作品**，原样收录在本仓库，版权归原作者；收录目的仅为个人备份与集中安装，**未作功能性修改**。若原作者不希望被收录，提出后可立即移除。

| 目录 | 挂件 | 原作者 | 原仓库 | 许可 |
| --- | --- | --- | --- | --- |
| [`dsh-whale-widget/`](dsh-whale-widget/ATTRIBUTION.md) | DeepSeek娘（小鲸鱼） | [MeteorNOX](https://github.com/MeteorNOX) | [DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) | MIT |
| [`dsh-xiaoke-widget/`](dsh-xiaoke-widget/ATTRIBUTION.md) | Claude娘（小克） | [aklnaaw](https://github.com/aklnaaw) | [dsh-xiaoke-widget](https://github.com/aklnaaw/dsh-xiaoke-widget) | MIT（素材 CC BY-NC-SA 4.0） |
| [`dsh-gpt-niang-widget/`](dsh-gpt-niang-widget/ATTRIBUTION.md) | GPT娘 | [xixingyingmie](https://github.com/xixingyingmie) | [dsh-gpt-niang-widget](https://github.com/xixingyingmie/dsh-gpt-niang-widget) | MIT |

> 本仓库自制的 5 只挂件（Gemini娘 / Kimi娘 / GLM娘 / 千问娘 / Grok娘）均**二创自 MeteorNOX 的上游项目**，
> 隔离改造底座参考了 [aklnaaw/dsh-xiaoke-widget](https://github.com/aklnaaw/dsh-xiaoke-widget) 的工程结构，在此一并致谢。

## 功能

- 💰 **余额 / 今日已用**：读取 DSH 凭据里的 `DEEPSEEK_API_KEY`，或复用 DSH 账号登录态；60 秒自动刷新，点角色手动刷新
- ⏰ **峰谷定价**：工作日高峰 / 空闲时段自动切换，气泡里显示当前时段
- 💬 **每轮对话消耗**：按模型真实 usage 统计，每轮结束冒一个消耗泡泡
- 🫧 **泡泡系统**：点击序列、模块化排版（文本 / 余额 / 今日 / 峰谷 / 图片 / 随机语句 / 并列加权）、逐行字体与配色
- 🔊 **音效**：按压 / 松开、任务结束、提问 / 授权提示，支持自定义音效组与音量
- 🐾 **交互**：拖拽、四边吸附、贴左时水平镜像翻转、按压 Q 弹、菜单可隐藏
- 🎨 **自定义**：菜单里可换角色图、改大小、调气泡内容与音效
- 📒 **记账**：余额观测 + 会话事件估算，支持 90 天逐轮明细

## 与其它桌宠并存

路由前缀 `/dsh-neko/`、bundle id `neko-widget`、数据文件 `.dshnk-*`、DOM class `dshnkv-*` 全部独立，
可以和 `dsh-whale-widget`（`/dsh-whale/`）、`dsh-xiaoke-widget`（`/dsh-xiaoke/`）、`dsh-gpt-niang-widget`（`/dsh-gptniang/`）同时安装、同时显示。

## 安装

插件未发布到 npm，按本地包安装：

```bash
git clone https://github.com/LuRenqa/LuRenqa.git
# 然后在 DSH 里（把 <绝对路径> 换成上面的目录）：
dsh plugin --profile <profile> add link:<绝对路径>
```

桌面客户端（Electron）的 profile 由宿主管理时，可在 `~/.dsh/profiles/<profile>` 下建 junction 指向本目录，
并把包名加入 `package.json` 的 `dependencies` 与 `dsh.profile.bundles`（等价于 `dsh plugin add link:` 的效果）。

装完重启 DSH（或重载 profile），浏览器 / 客户端刷新页面即可看到。

## 配置余额来源

- **推荐**：在 DSH 凭据服务里配置 `DEEPSEEK_API_KEY`（DeepSeek 平台 API Key）
- **或者**：在 DSH「设置 → 账号与余额」登录 DeepSeek 账号，没配 key 时挂件会自动使用账号登录态

## 数据位置

均在 `$DSH_HOME`（默认 `~/.dsh`）下：

| 文件 | 用途 |
| --- | --- |
| `.dshnk-size.json` | 外观与开关（缩放、吸附、音量等） |
| `.dshnk-usage.json` | 记账账本与用量设置 |
| `.dshnk-bubble.json` | 自定义泡泡配置 |
| `.dshnk-turn.json` | 每轮消耗序号 |
| `neko-roles/`、`neko-audio/`、`neko-bubble-imgs/` | 自定义角色、音频片段、泡泡图 |

## 说明与限制

- 主要开发和验证环境是 Windows + DSH 桌面客户端；其它平台欢迎反馈
- 余额取数依赖 DSH 的凭据 / 账号服务，DSH 版本过旧时可能不可用
- 所有网络请求只发往 DeepSeek 官方接口（或用户自行配置的厂商接口）

## 许可与致谢

- **代码**：MIT，见 [LICENSE](LICENSE)；原始版权归 [MeteorNOX](https://github.com/MeteorNOX)（上游）
- **角色美术**（`assets/neko1.png`、`icon.png`、`neko-anim-*.webp`）：**CC BY-NC-SA 4.0**，**不可商用**，见 [LICENSE-ARTWORK](LICENSE-ARTWORK)
- **上游继承的音效 / 泡泡图**：沿用上游说明，见 [upstream/PROVENANCE.upstream.md](upstream/PROVENANCE.upstream.md)
- 完整的素材来源与许可范围见 [PROVENANCE.md](PROVENANCE.md)

特别感谢：

- [MeteorNOX](https://github.com/MeteorNOX) —— 上游余额挂件（记账、峰谷计价、泡泡系统等底子）
- [aklnaaw](https://github.com/aklnaaw) —— 隔离改造底座与工程结构参考
- [AirsEDA](https://github.com/AirsEDA) —— 动态素材参考

本项目与 Google / Gemini 官方无隶属关系，角色名称仅为个人使用习惯。
