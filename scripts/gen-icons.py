#!/usr/bin/env python3
"""Generate the legacy (pre-API 26) launcher PNGs for the Rs Calculator.

Adaptive icons (res/mipmap-anydpi-v26) are built from the vector foreground;
older launchers still need real bitmaps, which is what this script writes.

    python3 scripts/gen-icons.py            # regenerate res/mipmap-*/ic_launcher*.png

Needs Pillow:  python3 -m pip install pillow
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

# The artwork is laid out on the same 108x108 grid as the adaptive-icon vector
# (res/drawable/ic_launcher_foreground.xml) so both look identical.
GRID = 108.0

BACKGROUND = (16, 16, 20, 255)        # #101014
BODY = (255, 255, 255, 255)
ACCENT = (255, 149, 0, 255)           # #FF9500

# mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi — the launcher sizes Android expects.
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# Draw at 4x and downscale, so edges stay smooth without a filter chain.
SUPERSAMPLE = 4


def draw_icon(size: int, shape: str) -> Image.Image:
    """Render one launcher icon. `shape` is "square" (rounded) or "round"."""
    s = size * SUPERSAMPLE
    k = s / GRID  # grid unit -> pixels

    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # --- background -------------------------------------------------------
    if shape == "round":
        draw.ellipse((0, 0, s - 1, s - 1), fill=BACKGROUND)
    else:
        # Legacy launchers show the whole bitmap, so keep a modest radius
        # instead of the full squircle used by adaptive icons.
        draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=0.22 * s, fill=BACKGROUND)

    # --- calculator glyph (same geometry as the vector) -------------------
    body = (36 * k, 28 * k, 76 * k, 80 * k)
    draw.rounded_rectangle(body, radius=4 * k, fill=BODY)

    screen = (40 * k, 33 * k, 72 * k, 47 * k)
    draw.rounded_rectangle(screen, radius=2 * k, fill=ACCENT)

    for col in range(3):
        for row in range(2):
            x0 = (40 + col * 12) * k
            y0 = (52 + row * 12) * k
            key = (x0, y0, x0 + 8 * k, y0 + 8 * k)
            draw.rounded_rectangle(key, radius=1.6 * k, fill=BACKGROUND)

    return img.resize((size, size), Image.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--res-dir",
        default=None,
        help="res/ folder to write into (defaults to app/src/main/res next to this script)",
    )
    parser.add_argument("--dry-run", action="store_true", help="only report what would be written")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parent.parent
    res = Path(args.res_dir) if args.res_dir else repo / "app" / "src" / "main" / "res"

    for density, size in DENSITIES.items():
        for shape, name in (("square", "ic_launcher.png"), ("round", "ic_launcher_round.png")):
            out = res / f"mipmap-{density}" / name
            if args.dry_run:
                print(f"would write {out.relative_to(repo)} ({size}x{size})")
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            draw_icon(size, shape).save(out, "PNG", optimize=True)
            print(f"✓ {out.relative_to(repo)} ({size}x{size}, {out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
