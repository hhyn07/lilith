"""Build the Lilith logo files from the source image (Gemini-generated, see README).

- removes the white background that is connected to the image border (white
  lines inside the bow and the white wing are enclosed, so they stay), with
  anti-aliased edges;
- writes a transparent logo for the home page, and favicons / app icons with
  the silhouette on a pale round "moon" disc, so it shows on dark tab bars.

Usage: python make-logo.py <source image> <hedgedoc-1x folder>
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SRC = Path(sys.argv[1])
HD = Path(sys.argv[2])
ICONS = HD / "public" / "icons"
MOON = (242, 238, 249, 255)   # pale lavender disc behind the silhouette
WHITE_TOL = 60                # max distance from white that counts as background


def remove_background(img):
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    def near_white(p):
        return 255 - min(p[0], p[1], p[2]) <= WHITE_TOL

    # flood fill from every white border pixel
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white(px[x, y]) and not bg[y * w + x]:
                bg[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if near_white(px[x, y]) and not bg[y * w + x]:
                bg[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and near_white(px[nx, ny]):
                bg[ny * w + nx] = 1
                q.append((nx, ny))

    mask = Image.frombytes("L", (w, h), bytes(255 if b else 0 for b in bg))
    # pixels just outside the background are the anti-aliased edge
    edge = mask.filter(ImageFilter.MaxFilter(5))
    epx = edge.load()
    mpx = mask.load()
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if mpx[x, y]:
                opx[x, y] = (0, 0, 0, 0)
            elif epx[x, y]:
                # blend of the dark ink and white: recover alpha from lightness
                light = (r + g + b) / 3
                alpha = max(0.0, min(1.0, (255 - light) / (255 - 40)))
                if alpha <= 0.02:
                    opx[x, y] = (0, 0, 0, 0)
                else:
                    # un-mix the white so the edge colour stays dark
                    def unmix(c):
                        return int(max(0, min(255, (c - 255 * (1 - alpha)) / alpha)))
                    opx[x, y] = (unmix(r), unmix(g), unmix(b), int(alpha * 255))
            else:
                opx[x, y] = (r, g, b, 255)
    return out


def square(img, pad_ratio=0.04):
    bbox = img.getbbox()
    img = img.crop(bbox)
    side = int(max(img.size) * (1 + 2 * pad_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas


def on_moon(logo, size, scale=None, shape="circle"):
    # a square logo fits inside a circle at about 0.7 of its diameter; keep a margin
    if scale is None:
        scale = 0.66 if shape == "circle" else 0.8
    big = size * 4
    tile = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    if shape == "circle":
        d.ellipse((0, 0, big - 1, big - 1), fill=MOON)
    else:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=big // 5, fill=MOON)
    inner = int(big * scale)
    l = logo.resize((inner, inner), Image.LANCZOS)
    tile.paste(l, ((big - inner) // 2, (big - inner) // 2), l)
    return tile.resize((size, size), Image.LANCZOS)


def main():
    logo = square(remove_background(Image.open(SRC)))
    logo.resize((512, 512), Image.LANCZOS).save(ICONS / "lilith-logo.png", optimize=True)

    sizes = {
        "favicon-16x16.png": (16, "circle"),
        "favicon-32x32.png": (32, "circle"),
        "apple-touch-icon.png": (180, "square"),
        "android-chrome-192x192.png": (192, "circle"),
        "android-chrome-512x512.png": (512, "circle"),
        "mstile-70x70.png": (70, "circle"),
        "mstile-144x144.png": (144, "circle"),
        "mstile-150x150.png": (150, "circle"),
        "mstile-310x310.png": (310, "circle"),
    }
    for name, (size, shape) in sizes.items():
        on_moon(logo, size, shape=shape).save(ICONS / name, optimize=True)

    wide = Image.new("RGBA", (310, 150), (0, 0, 0, 0))
    m = on_moon(logo, 150)
    wide.paste(m, (80, 0), m)
    wide.save(ICONS / "mstile-310x150.png", optimize=True)

    on_moon(logo, 48).save(ICONS / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("ok", logo.size)


if __name__ == "__main__":
    main()
