"""Synthesize the wordless guide voice. No recordings, phonemes, or lyrics."""
import array
import math
from pathlib import Path
import sys
import wave

RATE = 22050
SECONDS = 8.1
PITCHES = (62, 64, 66, 67, 69, 71, 72, 74, 76, 79)
OUT = Path(__file__).resolve().parents[1] / "PracticeAudio"

for midi in PITCHES:
    frequency = 440 * 2 ** ((midi - 69) / 12)
    # A rounded vowel has resonances that stay at roughly the same frequencies
    # as the sung pitch changes. Weight each harmonic using those resonances.
    harmonics = []
    for partial in range(1, 8):
        hz = frequency * partial
        vowel = (0.88 * math.exp(-0.5 * ((hz - 480) / 145) ** 2)
                 + 0.36 * math.exp(-0.5 * ((hz - 1080) / 205) ** 2))
        harmonics.append((0.28 + vowel) / partial ** 0.8)
    level = 22000 / sum(harmonics)
    phase = 0.0
    samples = array.array("h")
    for index in range(round(RATE * SECONDS)):
        time = index / RATE
        attack = min(1.0, time / 0.052)
        release = min(1.0, (SECONDS - time) / 0.05)
        vibrato = 0.009 * min(1.0, time / 0.22) * math.sin(math.tau * 5.3 * time)
        phase += math.tau * frequency * (1 + vibrato) / RATE
        tone = sum(weight * math.sin(partial * phase)
                   for partial, weight in enumerate(harmonics, 1))
        samples.append(round(level * attack * release * tone))
    if sys.byteorder == "big":
        samples.byteswap()
    with wave.open(str(OUT / f"PracticeHum{midi}.wav"), "wb") as output:
        output.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        output.writeframes(samples.tobytes())
