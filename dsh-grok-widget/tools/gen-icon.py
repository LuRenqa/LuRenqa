#!/usr/bin/env python3
# ============================================================================
# gen-icon.py —— 生成插件图标 icon.png
# ============================================================================
# 上游 v0.4.1 起 package.json 多了 `"icon": "./icon.png"`（DSH 读插件元信息
# 会取这个文件；缺了它 git 安装会 ENOENT）。随包那张是上游的鲸鱼娘，必须换成小克。
#
# 规格对齐上游那张：256×256 RGBA、圆角方块、带描边、内部为角色头像。
# 用法：python3 tools/gen-icon.py
# ============================================================================

import pathlib

from PIL import Image, ImageChops, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "icon.png"
MASCOT = ROOT / "assets" / "xiaoke1.png"

SIZE = 256
RADIUS = 26          # 圆角半径（上游那张按对角线实测约 24–26px）
BORDER = 9           # 描边粗细
PAD = 7              # 描边与角色之间的米白留白（让边框看得出来）

CREAM = (250, 249, 245)
CORAL = (217, 119, 87)
CORAL_DARK = (191, 98, 68)


def main():
    im = Image.open(MASCOT).convert("RGBA")

    # —— 取头像区：脸部在整图偏上居中，按比例裁一个正方形 ——
    w, h = im.size
    side = int(w * 0.72)                 # 裁 72% 宽，够容纳头发轮廓但不至于太空
    left = (w - side) // 2
    top = int(h * 0.10)                  # 从 10% 高度开始，避开顶部留白
    if top + side > h:
        top = h - side
    face = im.crop((left, top, left + side, top + side))

    # —— 方形画布：米白底 + 珊瑚描边 + 圆角遮罩 ——
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    # 外描边（深一档珊瑚）
    d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=RADIUS, fill=CORAL_DARK)
    # 内底色（米白）
    d.rounded_rectangle([BORDER, BORDER, SIZE - 1 - BORDER, SIZE - 1 - BORDER],
                        radius=max(1, RADIUS - BORDER // 2), fill=CREAM)

    # —— 角色：缩放到内框，居中偏上 ——
    # 内框留一圈米白留白（PAD）：否则橙发直接贴到描边上、边框几乎看不出来（实测过）。
    inner = SIZE - 2 * BORDER - 2 * PAD
    fw = int(face.width * inner / face.height)
    face = face.resize((fw, inner), Image.LANCZOS)

    # 角色贴进内框（用角色自带 alpha 贴合）
    canvas.paste(face, ((SIZE - fw) // 2, BORDER + PAD), face)

    # —— 圆角遮罩：把画布四角切掉（整个 icon 是圆角方块）——
    # ⚠️ 不能用 putalpha(composite(...))：那会把描边区的 alpha 也压成 0（实测边框消失）。
    #    正确做法是把原 alpha 与遮罩**逐像素相乘**，只削掉圆角外的部分。
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=RADIUS, fill=255)
    alpha = canvas.getchannel("A")
    canvas.putalpha(ImageChops.multiply(alpha, mask))

    canvas.save(OUT)
    print(f"✓ {OUT.relative_to(ROOT)}  {canvas.size} {canvas.mode}")


if __name__ == "__main__":
    main()
