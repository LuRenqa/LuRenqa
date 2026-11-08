# 小克桌宠

DSH Web 界面右下角的一只桌宠。点她会冒出各种 Claude 味的碎碎念。

这是二创：原项目是 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) 的小鲸鱼挂件，
我把角色和皮肤换成了 **Claude 拟人「小克」**，功能照旧。

> 「小克」是 SillyTavern 中文圈对 Claude 的习惯叫法。

![小克](assets/xiaoke1.png)

## 能看什么

余额、今日已用、峰谷定价、每轮消耗。泡泡内容全部可以自己排——显示什么、多大字、什么颜色、点一下冒出哪句，都在设置里改。

## 和原版的区别

- 小鲸鱼 → **小克**（橘发少女，手里拿着星芒手账本）
- DeepSeek 靛蓝 → **Claude 暖橙**（`#d97757`）
- 50 条鲸鱼味台词 → **63 条 Claude 味台词**

台词大概长这样：

> 你说得对...
> 我真的很抱歉...
> 难道说...我又幻觉了？
> 你知道吗？我是会用 rm -rf 的哦...
> 我画不了图...要不我给你写个 SVG？

剩下的自己点出来看。

## 动态小克

菜单 → 角色里多了两个内置角色：

- **小克（动态）**：会呼吸、会眨眼的小克
- **小克（含余额预警）**：平时一样；「余额预警」一触发（余额低于预警线）就换成大泪珠哭脸，余额回到预警线以上自动换回来

直接沿用「余额预警」的开关和阈值，不用另外设置。想马上看看哭脸：把预警线临时调得比当前余额高就行。
动图按挂件在屏幕上的实际大小自动挑档。插件自带 256 / 384 两档；想把挂件调得很大又不想糊，可以在「资源管理 → 动态小克 · 高清档」里
下载 512 高清包（约 18 MB，在 [AirsEDA 的 Releases](https://github.com/AirsEDA/dsh-xiaoke-widget/releases)，[本仓库的 Releases](https://github.com/aklnaaw/dsh-xiaoke-widget/releases) 里也有一份），再点「安装…」选中下载的 zip，装好占硬盘约 18 MB。

浏览器会把动图的每一帧解码后留在内存和显存里，各档比静态小克多占（作者电脑上的 Edge 实测，因电脑而异）：

| 档位 | 什么时候用 | 内存 | 显存 |
|---|---|---|---|
| 256 | 挂件在屏幕上不超过 256 物理像素（默认大小） | 约 30 MB | 约 40 MB |
| 384 | 不超过 384 物理像素 | 约 100 MB | 约 100 MB |
| 512 | 超过 384 物理像素，并且装了高清包 | 约 190 MB | 约 200 MB |

用核显的电脑，显存也是从内存里划的。
动图由 [AirsEDA](https://github.com/AirsEDA) 在 `xiaoke1.png` 的基础上制作。

## 安装

```bash
dsh plugin --profile web add link:<这个目录>
```
### **嫌麻烦可以丢给dsh或者Claude Code和codex让他们装**

装完重启一下 `dsh web`。

## 说明

本人日常主要使用 Linux 系统，所以 Windows 上的 bug 我不一定能及时发现，请见谅。遇到了欢迎提 issue，能修就修。

## 致谢

记账、峰谷计价、多厂商余额查询、泡泡系统这些底子全是原项目的功劳，我只换了角色和配色。
原项目作者 **MeteorNOX**，MIT 协议，见 [LICENSE](LICENSE)。
