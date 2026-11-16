"""把 GPT 候选立绘处理成正式路径资源。

处理链：裁透明边 → 等比缩放（保持落地线）→ 居中贴到基准画布 → 256 色调色板量化（体积达标）
基准：宠物 1024×1024，角色 1024×1536，目标 ≤250KB。

注意：量化会牺牲一点渐变细节，但立绘在卡片（约 300px）与详情（约 420px）里看不出差异，
换来的是体积从 1.2MB 降到 ~250KB，移动端首屏不卡。
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC1 = ROOT / "public/art-review/20261113"
SRC2 = ROOT / "public/art-review/20261116"

JOBS = [
    (SRC1 / "qinglong-form1.png", ROOT / "public/pets/qinglong/form1.png", (1024, 1024)),
    (SRC2 / "baihu-form1.png", ROOT / "public/pets/baihu/form1.png", (1024, 1024)),
    (SRC2 / "zhuque-form1.png", ROOT / "public/pets/zhuque/form1.png", (1024, 1024)),
    (SRC2 / "xuanwu-obsidian-form1.png", ROOT / "public/pets/xuanwu/form1.png", (1024, 1024)),
    (SRC2 / "yinyu-blackgold-form1.png", ROOT / "public/pets/yinyu/form1.png", (1024, 1024)),
    (SRC2 / "yangyu-form1.png", ROOT / "public/pets/yangyu/form1.png", (1024, 1024)),
    (SRC1 / "base_m-plain.png", ROOT / "public/characters/base_m.png", (1024, 1536)),
    (SRC1 / "base_f-plain.png", ROOT / "public/characters/base_f.png", (1024, 1536)),
]


def quantize_with_alpha(canvas: Image.Image, colors: int = 255) -> Image.Image:
    """量化成调色板图，并用最后一个索引表示透明。"""
    alpha = canvas.getchannel("A")
    rgb = canvas.convert("RGB")
    pal = rgb.quantize(colors=colors, method=Image.FASTOCTREE)
    # 补满 256 色，确保 255 号索引存在并可设为透明
    palette = pal.getpalette() or []
    while len(palette) < 256 * 3:
        palette.append(0)
    pal.putpalette(palette)
    # 透明像素填成 255 号索引
    transparent_mask = alpha.point(lambda a: 255 if a < 8 else 0)
    pal.paste(255, transparent_mask)
    pal.info["transparency"] = 255
    return pal


for src, dst, size in JOBS:
    if not src.exists():
        print(f"跳过（源不存在）: {src.name}")
        continue
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail(size, Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2), im)
    dst.parent.mkdir(parents=True, exist_ok=True)
    pal = quantize_with_alpha(canvas)
    pal.save(dst, "PNG", optimize=True)
    kb = dst.stat().st_size / 1024
    tone = "OK" if kb <= 250 else "超 250KB"
    print(f"{dst.relative_to(ROOT)}  {size[0]}x{size[1]}  {kb:.0f}KB  {tone}")
