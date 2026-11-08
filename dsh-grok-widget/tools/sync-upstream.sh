#!/usr/bin/env bash
# ============================================================================
# sync-upstream.sh —— 用 squash 方式同步上游，**不把上游作者带进本项目历史**
# ============================================================================
# 为什么不用普通的 `git merge upstream/main`：
#   上游历史里有 60+ 个提交、10 多位贡献者。普通 merge 会把这些提交**原样并入**
#   本项目历史，于是 GitHub 的 Contributors 列表会多出一堆上游的人 —— 而本项目
#   是独立二创，页面上的贡献者应该只有本项目自己的提交者。
#
# `git merge --squash` 的行为（已实测）：
#   · 只把上游的**文件变更**取过来，**不产生提交**，HEAD 不动
#   · Git 靠重命名追踪正确归位：上游的 lib/index.js → 本项目的 upstream/lib/index.js
#   · 新增素材（上游 assets/xxx）也会自动到位
#   于是上游作者不会进入本项目历史。
#
# 用法：
#   bash tools/sync-upstream.sh            # 同步 + 重建 + 校验（不提交，留给你检查）
#   bash tools/sync-upstream.sh --commit   # 同上，并在校验通过后自动提交
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
AUTO_COMMIT=false
[ "${1:-}" = "--commit" ] && AUTO_COMMIT=true

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
info()  { printf '  %s\n' "$*"; }

# —— 前置检查 ——
if ! git remote get-url upstream >/dev/null 2>&1; then
  red "✗ 没有配置 upstream 远程。先运行："
  info "git remote add upstream https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget.git"
  exit 1
fi

if [ -n "$(git status --porcelain)" ] && [ ! -d .git/MERGE_HEAD ] && [ ! -f .git/SQUASH_MSG ]; then
  # ⚠️ 例外：squash 冲突解决到一半时（存在 SQUASH_MSG / MERGE 状态）允许继续 ——
  #    冲突已手工解决、git add 过，此时重跑本脚本应当接着走「重建+校验+提交」，
  #    而不是被「工作区不干净」挡住（实测踩过：解决完冲突却卡在自己脚本的守卫上）。
  red "✗ 工作区不干净，先提交或 stash，避免把无关改动混进同步："
  git status --short | head -10
  exit 1
fi
RESUMING=false
if [ -f .git/SQUASH_MSG ] || [ -d .git/MERGE_HEAD ]; then
  RESUMING=true
  green "△ 检测到上次 squash 未完成 —— 从解决冲突处继续"
fi

BEFORE=$(git rev-parse HEAD)
info "当前 HEAD: $(git rev-parse --short HEAD)  $(git log -1 --format=%s | cut -c1-46)"

# —— 1. 拉取上游 ——
echo
echo "① 拉取上游"
git fetch --quiet upstream main
UPSTREAM_REV=$(git rev-parse upstream/main)
info "upstream/main: $(git rev-parse --short upstream/main)  $(git log -1 --format=%s upstream/main | cut -c1-46)"

BEHIND=$(git rev-list --count "HEAD..upstream/main" 2>/dev/null || echo 0)
if [ "$BEHIND" = "0" ]; then
  green "✓ 上游没有新提交，无需同步"
  exit 0
fi
info "上游有 $BEHIND 个新提交"

# —— 2. squash 同步（关键：不产生提交，不带作者）——
echo
if $RESUMING; then
  echo "② 跳过 squash（沿用已解决的暂存区）"
else
  echo "② squash 同步（不产生提交）"
  if ! git merge --squash upstream/main; then
    red "✗ squash 出现冲突。请手工解决后："
    info "  git add <冲突文件>"
    info "  bash tools/sync-upstream.sh --commit   # 会自动从解决处继续"
    exit 1
  fi
fi

CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "$CHANGED" = "0" ]; then
  green "✓ 本次同步无新改动（上游改动可能已全部包含，或都落在本项目不跟踪的文件上）"
  exit 0
fi
info "暂存了 $CHANGED 个文件："
git diff --cached --name-status | head -20 | sed 's/^/    /'
[ "$CHANGED" -gt 20 ] && info "… 另有 $((CHANGED - 20)) 个"

# —— 3. 重建产物（上游源码变了，必须重新套主题）——
echo
echo "③ 重建产物"
node tools/build-xiaoke.mjs

# —— 4. 校验 ——
echo
echo "④ 校验"
node tools/build-xiaoke.mjs --check
node --check lib/xiaoke-index.js
node --check lib/xiaoke-widget.js
node tools/verify-host-routes.mjs >/dev/null
node tools/verify-widget-exec.cjs

# 上游身份特征不得残留（换上游后常见漏改）
echo
echo "⑤ 上游身份残留检查"
RESIDUAL=0
for pat in 鲸 大肥鱼 DeepSleep dsh-whale; do
  # ⚠️ grep 找不到匹配时返回 1，而"没找到"正是这里的成功情况——
  #    在 set -euo pipefail 下会让脚本**静默中止**（实测踩过）。
  #    wc -l 在管道末尾返回 0，所以整条命令的状态由 wc 决定，但稳妥起见加 || true。
  n=$( { grep -o "$pat" lib/xiaoke-widget.js lib/xiaoke-index.js 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [ "$n" != "0" ]; then
    red "  ✗ 「$pat」残留 $n 处 —— 上游可能新增了相关文案，检查 skin/xiaoke-theme.mjs"
    RESIDUAL=1
  fi
done
[ "$RESIDUAL" = "0" ] && green "  ✓ 无残留"

if [ "$RESIDUAL" != "0" ]; then
  red "✗ 存在身份残留，先修主题表再提交（改动已留在暂存区）"
  exit 1
fi

# —— 5. 提交 ——
echo
if $AUTO_COMMIT; then
  UPMSG=$(git log -1 --format=%s upstream/main | cut -c1-60)
  git add -A
  git commit --quiet -F - <<EOF
chore: 同步上游 $(git rev-parse --short upstream/main)（squash）

上游提交：$UPMSG
共 $BEHIND 个提交，squash 合并（不含上游作者）。

产物已重建：lib/xiaoke-index.js、lib/xiaoke-widget.js
EOF
  green "✓ 已提交 $(git rev-parse --short HEAD)"
  info "如需推送：git push origin main"
else
  green "✓ 同步完成，改动已暂存（未提交）"
  echo
  info "检查无误后提交："
  info "  git add -A && git commit -m 'chore: 同步上游 $(git rev-parse --short upstream/main)（squash）'"
  info "或下次直接跑：bash tools/sync-upstream.sh --commit"
fi
