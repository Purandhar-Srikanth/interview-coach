"""Turn the frames from frontend/scripts/record-demo.mjs into docs/media/demo.gif.

Usage:  .venv\\Scripts\\python scripts\\make_gif.py
"""

import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "docs" / "media" / "frames"
OUT = ROOT / "docs" / "media" / "demo.gif"
WIDTH = 960  # README width; keeps the file small


def main() -> None:
    durations = json.loads((FRAMES / "durations.json").read_text())
    frames = []
    for i in range(len(durations)):
        img = Image.open(FRAMES / f"{i:04d}.png").convert("RGB")
        img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
        # One shared palette per frame; ADAPTIVE keeps the UI colours crisp.
        frames.append(img.convert("P", palette=Image.ADAPTIVE, colors=128))

    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=1,
    )
    shutil.rmtree(FRAMES)  # frames are temporary
    seconds = sum(durations) / 1000
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(frames)} frames, {seconds:.0f}s, "
          f"{OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
