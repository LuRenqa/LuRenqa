# DSH 千问娘挂件（dsh-qwen-widget）

DeepSeek Harness（DSH）Web 界面右下角的一只常驻桌宠：**千问娘**。
点她会冒出气泡，显示账户余额、今日已用、峰谷时段与每轮对话消耗；气泡内容、字体、颜色、音效、角色图都能自己改。

本项目是二次创作，基于 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（MIT）的小鲸鱼余额挂件，
并沿用 [aklnaaw/dsh-xiaoke-widget](https://github.com/aklnaaw/dsh-xiaoke-widget) 的隔离改造底座（路由 / 存储 / DOM 全部独立），把角色换成了 **千问娘**。

> 本仓库根目录是 [Gemini娘挂件](../README.md)；本目录是 **千问娘** 版本，功能相同、可同时安装。

![千问娘](assets/qwen1.png)

## 功能

- 💰 **余额 / 今日已用**：读取 DSH 凭据里的 `DEEPSEEK_API_KEY`，或复用 DSH 账号登录态；60 秒自动刷新，点角色手动刷新
- ⏰ **峰谷定价**：工作日高峰 / 空闲时段自动切换，气泡里显示当前时段
- 💬 **每轮对话消耗**：按模型真实 usage 统计，每轮结束冒一个消耗泡泡
- 🫧 **泡泡系统**：点击序列、模块化排版（文本 / 余额 / 今日 / 峰谷 / 图片 / 随机语句 / 并列加权）、逐行字体与配色
- 🔊 **音效**：按压 / 松开、任务结束、提问 / 授权提示，支持自定义音效组与音量
- 🐾 **交互**：拖拽、四边吸附、贴左时水平镜像翻转、按压 Q 弹、菜单可隐藏
- 🎨 **自定义**：菜单里可换角色图、改大小、调气泡内容与音效
- 📒 **记账**：余额观测 + 会话事件估算，支持 90 天逐轮明细

## 主题：浅蓝

| 部位 | 处理 |
| --- | --- |
| 气泡边框 | 浅蓝描边 `#7cc8f0` + 白色外发光 + 蓝调投影（大泡泡与小尾巴一致） |
| 气泡文字 | 浅蓝 `#3f8fc8` + 白色高光 |
| 菜单色块 | 浅蓝镜面渐变 `#f2fbff → #cfeaff → #9fd6f7 → #e8f6ff`，深蓝字 `#174a6b` + 内高光 |
| 滑杆圆点 | 浅蓝金属球（径向渐变高光） |

## 与其它桌宠并存

路由前缀 `/dsh-qwen/`、bundle id `dsh-qwen`、数据文件 `.dshqw--*`、DOM class `dshqwenv-*` 全部独立，可以和下列挂件同时安装、同时显示：

- **Gemini娘** —— 路由 `/dsh-neko/`（本仓库根目录）
- **Kimi娘** —— 路由 `/dsh-kimi/`
- **小鲸鱼** —— 路由 `/dsh-whale/`
- **GPT娘** —— 路由 `/dsh-gptniang/`
- **小克** —— 路由 `/dsh-xiaoke/`

## 安装

插件未发布到 npm，按本地包安装：

```bash
git clone https://github.com/LuRenqa/LuRenqa.git
cd LuRenqa/dsh-qwen-widget
# 然后在 DSH 里（<绝对路径> 指向本目录）：
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
| `.dshqw-size.json` | 外观与开关（缩放、吸附、音量等） |
| `.dshqw-usage.json` | 记账账本与用量设置 |
| `.dshqw-bubble.json` | 自定义泡泡配置 |
| `.dshqw-turn.json` | 每轮消耗序号 |
| `qwen-roles/`、`-audio/`、`-bubble-imgs/` | 自定义角色、音频片段、泡泡图 |

## 说明与限制

- 角色素材使用 AI 分割（isnet-anime）抠成透明底，贴底对齐
- 主要验证环境是 Windows + DSH 桌面客户端；其它平台欢迎反馈
- 余额取数依赖 DSH 的凭据 / 账号服务，DSH 版本过旧时可能不可用
- 所有网络请求只发往 DeepSeek 官方接口（或用户自行配置的厂商接口）

## 许可与致谢

- **代码**：MIT，见 [LICENSE](LICENSE)；原始版权归 [MeteorNOX](https://github.com/MeteorNOX)（上游）
- **角色美术**（`assets/*1.png`、`icon.png`、`*-anim-*.webp`）：**CC BY-NC-SA 4.0**，**不可商用**，见 [LICENSE-ARTWORK](LICENSE-ARTWORK)
- **上游继承的音效 / 泡泡图**：沿用上游说明，见 [upstream/PROVENANCE.upstream.md](upstream/PROVENANCE.upstream.md)
- 完整的素材来源与许可范围见 [PROVENANCE.md](PROVENANCE.md)

特别感谢：

- [MeteorNOX](https://github.com/MeteorNOX) —— 上游余额挂件（记账、峰谷计价、泡泡系统等底子）
- [aklnaaw](https://github.com/aklnaaw) —— 隔离改造底座与工程结构参考

本项目与对应模型厂商无隶属关系，角色名称仅为个人使用习惯。
