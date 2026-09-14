#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""optimize-images.py — ย่อ/บีบภาพก่อนเอาเข้า public/images ตามหน้าที่ของภาพ (ดู CLAUDE.md หัวข้อภาพ)

    /usr/bin/python3 tools/optimize-images.py <ไฟล์หรือโฟลเดอร์> [...] [--dry] [--rename] [--profile=hero|product|logo|ui]

โปรไฟล์เลือกอัตโนมัติจากพาธ (override ได้ด้วย --profile):
  hero     public/images/*hero*, cozy/*desktop*, *-mobile*   ภาพใหญ่ไว้ดู → คุณภาพสูง ย่อเฉพาะที่เกิน
  product  public/images/products/                             รูปสินค้า → 1200px q82 (ซูมได้ ไม่เบลอ)
  logo     *logo*, *icon*, *favicon*, *qr*                     ห้ามแตะ (ลายเส้นคม/โปร่งใส/QR)
  ui       ที่เหลือ                                             ภาพประกอบ → 1600px q80

ทำอะไร: (1) ย่อถ้ากว้าง/สูงเกินเพดาน  (2) PNG ที่ไม่มี alpha จริง → JPG **เฉพาะเมื่อใส่ --rename** (จะแก้พาธที่อ้างใน src/ ให้ด้วย
    ไม่ใส่ = คงชื่อ .png ไว้ แค่บีบ)  (3) ลบ metadata ทั้งหมด (รวม C2PA)
(4) ไม่ทับถ้าผลลัพธ์ใหญ่กว่าเดิม  (5) สำรองต้นฉบับไว้ที่ tools/_originals/ (git-ignored) ครั้งแรกเสมอ
"""
import os, shutil, struct, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, "tools", "_originals")
PROFILES = {                    # (เพดานด้านยาว px, JPEG quality, WebP quality)
    "hero":    (1920, 88, 85),
    "product": (1200, 82, 80),
    "ui":      (1600, 80, 78),
    "logo":    None,
}

def profile_for(path, override=None):
    if override: return override
    p = path.lower()
    if any(k in p for k in ("logo", "icon", "favicon", "qr-", "/qr", "sprite")): return "logo"
    if "/products/" in p: return "product"
    if any(k in p for k in ("hero", "-desktop", "-mobile", "poster", "slide", "banner", "cover")): return "hero"
    return "ui"

def has_real_alpha(im):
    if im.mode not in ("RGBA", "LA") and "transparency" not in im.info: return False
    a = im.convert("RGBA").getchannel("A")
    lo, hi = a.getextrema()
    return lo < 250

def png_has_meta(path):
    f = open(path, "rb"); f.read(8)
    while True:
        h = f.read(8)
        if len(h) < 8: return False
        ln, typ = struct.unpack(">I4s", h); f.read(ln + 4)
        if typ in (b"caBX", b"tEXt", b"iTXt", b"zTXt", b"eXIf"): return True
        if typ == b"IEND": return False

def optimize(path, override=None, dry=False, rename=False):
    prof = profile_for(path, override)
    ext = os.path.splitext(path)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"): return
    before = os.path.getsize(path)
    if prof == "logo":
        # ลบเฉพาะ metadata ไม่ย่อ ไม่แปลงชนิด
        if ext == ".png" and png_has_meta(path) and not dry:
            im = Image.open(path); im2 = Image.new(im.mode, im.size); im2.putdata(list(im.getdata())); im2.save(path, "PNG", optimize=True)
        print(f"  logo  {os.path.relpath(path, ROOT)}  ({before//1024} KB) — คงไว้"); return
    cap, jq, wq = PROFILES[prof]
    im = ImageOps.exif_transpose(Image.open(path))
    w, h = im.size
    scale = min(1.0, cap / max(w, h))
    out_path, fmt = path, None
    alpha = has_real_alpha(im)
    if ext == ".png" and not alpha and rename:
        out_path = os.path.splitext(path)[0] + ".jpg"; fmt = "JPEG"
    elif ext in (".jpg", ".jpeg"): fmt = "JPEG"
    elif ext == ".png": fmt = "PNG"
    else: fmt = "WEBP"
    nw, nh = (int(w * scale), int(h * scale)) if scale < 1 else (w, h)
    note = f"{w}x{h}" + (f" → {nw}x{nh}" if scale < 1 else "") + (" · PNG→JPG" if out_path != path else (" · PNG ไม่มี alpha — ใส่ --rename ถ้าจะแปลงเป็น JPG" if ext == ".png" and not alpha else ""))
    if dry:
        print(f"  {prof:7s} {os.path.relpath(path, ROOT)}  ({before//1024} KB) {note}"); return
    os.makedirs(ORIG, exist_ok=True)
    bak = os.path.join(ORIG, os.path.relpath(path, os.path.join(ROOT, "public")))
    if not os.path.exists(bak):
        os.makedirs(os.path.dirname(bak), exist_ok=True); shutil.copy2(path, bak)
    work = im.resize((nw, nh), Image.LANCZOS) if scale < 1 else im
    clean = Image.new("RGBA" if alpha else "RGB", work.size)
    clean.putdata(list(work.convert("RGBA" if alpha else "RGB").getdata()))
    tmp = out_path + ".tmp"
    if fmt == "JPEG": clean.save(tmp, "JPEG", quality=jq, optimize=True, progressive=True, subsampling=0)
    elif fmt == "PNG": clean.save(tmp, "PNG", optimize=True)
    else: clean.save(tmp, "WEBP", quality=wq, method=6)
    after = os.path.getsize(tmp)
    if after >= before and out_path == path:
        os.remove(tmp); print(f"  {prof:7s} {os.path.relpath(path, ROOT)}  ({before//1024} KB) — เดิมเล็กกว่า คงไว้"); return
    os.replace(tmp, out_path)
    if out_path != path:
        os.remove(path); rewrite_refs(path, out_path)
    print(f"  {prof:7s} {os.path.relpath(out_path, ROOT)}  {before//1024} → {after//1024} KB  {note}")

def rewrite_refs(old_path, new_path):
    """แก้ทุกไฟล์โค้ดที่อ้างพาธเดิม (นับจาก public/) ให้ชี้ไปนามสกุลใหม่"""
    old_rel = "/" + os.path.relpath(old_path, os.path.join(ROOT, "public"))
    new_rel = "/" + os.path.relpath(new_path, os.path.join(ROOT, "public"))
    hits = []
    for base in ("src", "server", "public", "app"):
        d = os.path.join(ROOT, base)
        if not os.path.isdir(d): continue
        for dp, _, fns in os.walk(d):
            for fn in fns:
                if not fn.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".html", ".css", ".json", ".md")): continue
                fp = os.path.join(dp, fn)
                try: txt = open(fp, encoding="utf-8").read()
                except (UnicodeDecodeError, OSError): continue
                if old_rel in txt:
                    open(fp, "w", encoding="utf-8").write(txt.replace(old_rel, new_rel)); hits.append(os.path.relpath(fp, ROOT))
    if hits: print(f"          ↳ แก้พาธ {old_rel} → {new_rel} ใน: {', '.join(hits)}")
    else: print(f"          ↳ ⚠️ ไม่พบไฟล์ที่อ้าง {old_rel} — ถ้ามีที่อ้างแบบอื่น (เช่น DB) ต้องแก้เอง")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    rename = "--rename" in sys.argv
    override = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--profile=")), None)
    if not args: print(__doc__); sys.exit(1)
    for a in args:
        if os.path.isdir(a):
            for dp, _, fs in os.walk(a):
                for f in sorted(fs): optimize(os.path.join(dp, f), override, dry, rename)
        else: optimize(a, override, dry, rename)
