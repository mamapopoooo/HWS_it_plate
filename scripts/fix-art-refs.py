"""收尾：已验收的 18 张 PNG 保持引用；超 250KB 的 webp 降尺寸重渲染；重写 seeds 引用。"""
import hashlib, io, json, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SEEDS = ROOT / "docs/seeds/pets.json"
DEST = ROOT / "public/pets"
MAX = 250_000
SOURCES = [ROOT / "public/art-review/gpt2-20261124", ROOT / "public/art-review/gpt1-takeover-20261124"]
RE = re.compile(r"^([a-z_]+)-form(\d)\.png$", re.I)

def originals():
    m = {}
    for d in SOURCES:
        if not d.exists(): continue
        for f in sorted(d.iterdir()):
            g = RE.match(f.name)
            if g: m.setdefault((g.group(1).lower(), int(g.group(2))), f)
    return m

def render(src, size):
    im = Image.open(src).convert("RGBA")
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    im.thumbnail(size, Image.LANCZOS)
    c = Image.new("RGBA", size, (0, 0, 0, 0))
    c.paste(im, ((size[0]-im.width)//2, (size[1]-im.height)//2), im)
    data = b""
    for q in (88, 82, 76, 70, 64, 58):
        b = io.BytesIO(); c.save(b, "WEBP", quality=q, method=4); data = b.getvalue()
        if len(data) <= MAX: return data
    return data

src_map = originals()
seeds = json.loads(SEEDS.read_text(encoding="utf-8"))
resized, kept_png, still_over = 0, 0, []
for pet in seeds["pets"]:
    species = pet["id"].replace("pet_", "")
    forms = pet.get("formImages") or {}
    for form, ref in list(forms.items()):
        png = DEST / species / f"form{form}.png"
        webp = DEST / species / f"form{form}.webp"
        if png.exists():
            forms[form] = f"/pet-garden/pets/{species}/form{form}.png?v={hashlib.sha256(png.read_bytes()).hexdigest()[:12]}"
            kept_png += 1
            continue
        if not webp.exists(): continue
        if webp.stat().st_size > MAX:
            src = src_map.get((species, int(form)))
            if src:
                for size in ((960,960), (900,900), (840,840), (780,780)):
                    data = render(src, size)
                    if len(data) <= MAX: break
                webp.write_bytes(data); resized += 1
        size = webp.stat().st_size
        if size > MAX: still_over.append((f"{species}/form{form}", round(size/1024)))
        forms[form] = f"/pet-garden/pets/{species}/form{form}.webp?v={hashlib.sha256(webp.read_bytes()).hexdigest()[:12]}"
    if forms: pet["formImages"] = forms

SEEDS.write_text(json.dumps(seeds, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"保留 PNG 引用 {kept_png} 个 | 降尺寸重渲染 {resized} 张 | 仍超限 {len(still_over)} 张")
if still_over: print("  ", ", ".join(f"{n}({k}KB)" for n, k in still_over))