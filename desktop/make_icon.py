"""Draws the ClipperX icon (marigold rounded square, dark scissors-cut mark) as desktop/clipperx.ico."""

from pathlib import Path

from PIL import Image, ImageDraw

ACCENT = (242, 183, 5, 255)
INK = (23, 25, 28, 255)


def draw(size: int = 256) -> Image.Image:
    scale = 4  # draw large, then downsample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=ACCENT)
    # A clip carved from a timeline: in/out brackets around a filled segment
    w = int(s * 0.07)
    top, bottom = int(s * 0.27), int(s * 0.73)
    for x0 in (int(s * 0.24), int(s * 0.69)):
        d.rectangle((x0, top, x0 + w, bottom), fill=INK)
    d.rectangle((int(s * 0.24), top, int(s * 0.36), top + w), fill=INK)
    d.rectangle((int(s * 0.64), top, int(s * 0.76), top + w), fill=INK)
    d.rectangle((int(s * 0.24), bottom - w, int(s * 0.36), bottom), fill=INK)
    d.rectangle((int(s * 0.64), bottom - w, int(s * 0.76), bottom), fill=INK)
    d.rounded_rectangle((int(s * 0.38), int(s * 0.42), int(s * 0.62), int(s * 0.58)), radius=int(s * 0.03), fill=INK)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "clipperx.ico"
    draw(256).save(out, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    draw(128).save(out.with_suffix(".png"))
    print(f"wrote {out}")
