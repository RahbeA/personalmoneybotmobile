"""Generate transparent, square mascot PNGs for the widgets from the
dark-background mockup JPEGs.

Approach: crop the robot region, then remove the background with a
border-seeded flood fill (BFS) using a fixed reference color + tolerance.
A border-connected flood preserves the robot's enclosed dark face screen
(it is not reachable from the image border), which a luminance key would
punch a hole through. Finally auto-trim to the alpha bbox, pad to a square,
and resize.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ASSETS = "/Users/rahbe/.cursor/projects/Users-rahbe-moneybotmobile/assets"
OUT = "/Users/rahbe/moneybotmobile/mobile/assets/widgets"

# (source file, crop box left/top/right/bottom, flood tolerance)
JOBS = [
    {
        "src": f"{ASSETS}/IMG_0409-f4543e51-5f4d-4774-95f6-28e4492afef6.jpg",
        "crop": (585, 30, 960, 458),
        "tol": 78,
        "out": f"{OUT}/mascot-happy.png",
    },
    {
        "src": f"{ASSETS}/IMG_0411-04bb82dd-7488-439a-9203-38b864c85cfc.jpg",
        "crop": (500, 150, 915, 820),
        "tol": 86,
        "out": f"{OUT}/mascot-sad.png",
    },
]

FINAL = 384  # output px (square)


def remove_bg(img, tol):
    """Flood fill from all border pixels; matched pixels -> alpha 0."""
    rgb = img.convert("RGB")
    arr = np.asarray(rgb).astype(np.int16)
    h, w, _ = arr.shape

    # Reference bg color = median of the four corners.
    corners = np.stack([
        arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1]
    ])
    ref = np.median(corners, axis=0)

    # Candidate bg = within tolerance of the reference color.
    dist = np.sqrt(((arr - ref) ** 2).sum(axis=2))
    close = dist <= tol

    # BFS from the borders through `close` pixels only.
    visited = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not visited[y, x]:
                visited[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not visited[y, x]:
                visited[y, x] = True
                dq.append((y, x))

    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and close[ny, nx]:
                visited[ny, nx] = True
                dq.append((ny, nx))

    alpha = np.where(visited, 0, 255).astype(np.uint8)
    out = rgb.convert("RGBA")
    a = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(0.8))
    out.putalpha(a)
    return out


def autotrim(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def pad_square(img, pad_ratio=0.06):
    w, h = img.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    for job in JOBS:
        img = Image.open(job["src"]).crop(job["crop"])
        keyed = remove_bg(img, job["tol"])
        trimmed = autotrim(keyed)
        square = pad_square(trimmed).resize((FINAL, FINAL), Image.LANCZOS)
        square.save(job["out"])
        # opacity stats to sanity-check the key
        a = np.asarray(square)[:, :, 3]
        print(f"{os.path.basename(job['out'])}: {square.size} "
              f"opaque={round((a>128).mean()*100,1)}% transparent={round((a<8).mean()*100,1)}%")


if __name__ == "__main__":
    main()
