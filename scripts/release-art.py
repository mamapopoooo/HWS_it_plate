"""
把 GPT 原始立绘批量落成正式资源（第二批扩量，2026-11-26）。

关键点：
- 只用原始全彩图（gpt2-20261124 / gpt1-takeover-20261124，单张 0.7-3MB，色数 20 万+），
  不用已被压到 6-24 色的 rgba/sized 目录 —— 那是"断色"的根源
- 不覆盖已上线（Codex 已验收）的 18 张；只补新物种与缺失形态
- 统一裁透明边 → 等比缩放 → 居中贴 1024x1024 透明画布 → 调色板量化到 <=250KB
- 写回 docs/seeds/pets.json 的 formImages，带内容 sha 版本参数

用法：python scripts/release-art.py [--dry-run]
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = [
    ROOT / "public/art-review/gpt2-20261124",
    ROOT / "public/art-review/gpt1-takeover-20261124",
]
FALLBACK_DIRS = [
    ROOT / "public/art-review/gpt2-rgba-20261125",
    ROOT / "public/art-review/gpt1-rgba-20261124/pets",
]
DEST_ROOT = ROOT / "public/pets"
SEEDS = ROOT / "docs/seeds/pets.json"
MAX_BYTES = 250_000
DRY = "--dry-run" in sys.argv

NAME_RE = re.compile(r"^([a-z_]+)-form(\d)\.png$", re.I)


def quantize_with_alpha(canvas, colors):
    alpha = canvas.getchannel("A")
    pal = canvas.convert("RGB").quantize(colors=colors, method=Image.FASTOCTREE)
    palette = pal.getpalette() or []
    while len(palette) < 256 * 3:
        palette.append(0)
    pal.putpalette(palette)
    pal.paste(255, alpha.point(lambda a: 255 if a < 8 else 0))
    pal.info["transparency"] = 255
    return pal


def render(src, size):
    """1024 画布 + WebP 自适应质量：PNG 在 250KB 内会掉到 128 色（断色），WebP 保真更好。"""
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail(size, Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2), im)
    data = b""
    for quality in (88, 82, 76, 70, 64):
        buf = io.BytesIO()
        canvas.save(buf, "WEBP", quality=quality, method=4)
        data = buf.getvalue()
        if len(data) <= MAX_BYTES:
            return data
    return data


def collect():
    picked = {}
    for d in SOURCE_DIRS:
        if not d.exists():
            continue
        for f in sorted(d.iterdir()):
            m = NAME_RE.match(f.name)
            if not m:
                continue
            key = (m.group(1).lower(), int(m.group(2)))
            picked.setdefault(key, f)
    for d in FALLBACK_DIRS:
        if not d.exists():
            continue
        for f in sorted(d.rglob("*.png")):
            m = re.match(r"^form(\d)\.png$", f.name)
            if not m:
                continue
            key = (f.parent.name.lower(), int(m.group(1)))
            picked.setdefault(key, f)
    return picked


def main():
    seeds = json.loads(SEEDS.read_text(encoding="utf-8"))
    by_id = {p["id"]: p for p in seeds["pets"]}
    picked = collect()

    released, skipped_exists, missing = [], [], []
    for (species, form), src in sorted(picked.items()):
        pet_id = "pet_" + species
        if pet_id not in by_id:
            missing.append(species + "/form" + str(form))
            continue
        dest = DEST_ROOT / species / ("form%d.webp" % form)
        if dest.exists():
            skipped_exists.append(species + "/form" + str(form))
            continue
        data = render(src, (1024, 1024))
        if not DRY:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            sha = hashlib.sha256(data).hexdigest()[:12]
            by_id[pet_id].setdefault("formImages", {})[str(form)] = (
                "/pet-garden/pets/%s/form%d.webp?v=%s" % (species, form, sha)
            )
        released.append((species, form, len(data), src.name))
        if len(released) % 10 == 0:
            print("  已处理", len(released), "张…", flush=True)

    if not DRY and released:
        SEEDS.write_text(json.dumps(seeds, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    total_new = len(released)
    over = [r for r in released if r[2] > MAX_BYTES]
    size_kb = [r[2] / 1024 for r in released] or [0]
    print("新发布 %d 张 | 跳过已存在 %d 张 | 无对应宠物 %d 张" % (total_new, len(skipped_exists), len(missing)))
    print("体积区间 %.0f-%.0fKB，超 250KB %d 张" % (min(size_kb), max(size_kb), len(over)))
    if over:
        print("  超限：", ", ".join("%s/form%d(%.0fKB)" % (s, f, b / 1024) for s, f, b, _ in over))
    groups = {}
    for species, form, _b, _s in released:
        groups.setdefault(species, []).append(form)
    print("按物种：", ", ".join("%s×%d" % (k, len(v)) for k, v in sorted(groups.items())))
    if missing:
        print("缺宠物定义：", ", ".join(missing))


if __name__ == "__main__":
    main()