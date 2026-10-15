"""Backup voiceover: reads video/SCRIPT.md lines with local Kokoro TTS, fits each to its slot.

Run: python video/tts.py  ->  video/out/vo/NN.wav plus video/out/vo/plan.txt (start seconds per clip)
"""
import re
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).parent
CACHE = Path.home() / ".cache" / "hyperframes" / "tts"
SLOTS = [11, 14, 23, 17, 18, 13, 10, 7]
OUT = ROOT / "out" / "vo"


def lines() -> list[tuple[int, str]]:
    text = (ROOT / "SCRIPT.md").read_text(encoding="utf-8")
    found = re.findall(r"\*\*(\d+):(\d\d)\*\* (.+)", text)
    return [(int(m) * 60 + int(s), body.strip()) for m, s, body in found]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tts = Kokoro(str(CACHE / "models" / "kokoro-v1.0.onnx"), str(CACHE / "voices" / "voices-v1.0.bin"))
    plan = []
    for i, ((start, body), slot) in enumerate(zip(lines(), SLOTS, strict=True)):
        speed = 1.05
        samples, rate = tts.create(body, voice="bm_george", speed=speed, lang="en-gb")
        fit = slot - 0.6
        if len(samples) / rate > fit:
            speed = min(1.45, speed * (len(samples) / rate) / fit)
            samples, rate = tts.create(body, voice="bm_george", speed=speed, lang="en-gb")
        path = OUT / f"{i:02d}.wav"
        sf.write(path, samples, rate)
        plan.append(f"{start + 0.3} {path.name}")
        print(f"{i} start={start} slot={slot} speed={speed:.2f} dur={len(samples) / rate:.1f}")
    (OUT / "plan.txt").write_text("\n".join(plan) + "\n")


if __name__ == "__main__":
    main()
