"""Generate original instrument one-shots; no recordings or external sample packs.
Run from the project root. Output order is the Lens band's input bank order.
"""
import array
import json
import math
from pathlib import Path
import random
import sys
import wave

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / 'PracticeAudio'
CHORDS = {
    'Em': [40, 47, 52, 55, 59, 64], 'G': [43, 47, 50, 55, 59, 67],
    'C': [48, 52, 55, 60, 64], 'D': [50, 57, 62, 66],
    'Am': [45, 52, 57, 60, 64], 'A': [45, 52, 57, 61, 64],
    'D7': [50, 57, 60, 66],
}


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def pluck(midi, length, seed):
    # Karplus-Strong string with fractional-delay interpolation for tuning.
    rng = random.Random(seed)
    delay = RATE / hz(midi) - 0.5
    size = math.ceil(delay) + 2
    ring = [rng.uniform(-1, 1) for _ in range(size)]
    output = []
    cursor = 0
    previous = 0.0
    for i in range(int(length * RATE)):
        read = (cursor - delay) % size
        lower = int(read)
        frac = read - lower
        sample = ring[lower] * (1 - frac) + ring[(lower + 1) % size] * frac
        filtered = 0.498 * (sample + previous)
        ring[cursor] = filtered
        previous = sample
        cursor = (cursor + 1) % size
        attack = min(1.0, i / (RATE * 0.003))
        output.append(filtered * attack * math.exp(-i / RATE * 1.5))
    return output


def guitar(notes, upstroke=False):
    length = 0.48 if upstroke else 1.6
    data = [0.0] * int(RATE * length)
    if upstroke:
        notes = list(reversed(notes[-4:]))
    for i, note in enumerate(notes):
        start = int(i * (0.006 if upstroke else 0.009) * RATE)
        string = pluck(note, length if upstroke else 1.5, note * 37 + int(upstroke))
        for j, value in enumerate(string):
            if start + j < len(data):
                data[start + j] += value / math.sqrt(len(notes))
    return data


def tonal(notes, length, bass=False):
    data = []
    for i in range(int(RATE * length)):
        t = i / RATE
        attack = min(1, t / 0.008)
        value = 0
        for note in notes:
            phase = 2 * math.pi * hz(note) * t
            if bass:
                tone = math.sin(phase) + 0.22 * math.sin(2 * phase) + 0.07 * math.sin(3 * phase)
            else:
                tone = math.sin(phase + 0.8 * math.exp(-t * 5) * math.sin(2 * phase))
                tone += 0.13 * math.sin(3 * phase) * math.exp(-t * 6)
            value += tone * attack * math.exp(-t * (4 if bass else 2.8))
        data.append(value / len(notes))
    return data


def percussion(kind):
    rng = random.Random(47)
    data = []
    last_noise = 0
    for i in range(int(RATE * 0.3)):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        if kind == 'Kick':
            phase = 2 * math.pi * (48 * t + 70 * (1 - math.exp(-t * 30)) / 30)
            value = math.sin(phase) * math.exp(-t * 18)
        elif kind == 'Brush':
            value = (0.7 * noise + 0.3 * math.sin(2 * math.pi * 175 * t)) * math.exp(-t * 28)
        else:
            value = (noise - last_noise) * math.exp(-t * 65)
        data.append(value * min(1, t / 0.001))
        last_noise = noise
    return data


def save(name, data):
    peak = max(abs(x) for x in data) or 1
    # Headroom for concurrently mixed guitar/bass/keyboard/percussion/click.
    gain = 0.65 / peak
    fade = int(RATE * 0.03)
    for i in range(min(fade, len(data))):
        data[-1-i] *= i / fade
    pcm = array.array('h', (round(x * gain * 32767) for x in data))
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    return {'name': name, 'file': str(path.relative_to(OUT.parent)),
            'seconds': len(data) / RATE, 'peak': 0.65}


def main():
    OUT.mkdir(exist_ok=True)
    if sys.argv[1:] == ['--upstrokes']:
        for chord, notes in CHORDS.items():
            save('PracticeGuitarUp' + chord, guitar(notes, upstroke=True))
        return
    if sys.argv[1:] == ['--chord-notes']:
        for pitch in range(12):
            save('PracticeNoteGuitar' + str(pitch), pluck(48 + pitch, 0.65, pitch + 237))
            save('PracticeNoteBass' + str(pitch), tonal([24 + pitch], 0.62, bass=True))
            save('PracticeNoteKeys' + str(pitch), tonal([60 + pitch], 1.1))
        return
    bank = []
    for chord, notes in CHORDS.items():
        bank.append(save('PracticeGuitar' + chord, guitar(notes)))
    for chord, notes in CHORDS.items():
        bank.append(save('PracticeBass' + chord, tonal([notes[0] - 12], 0.75, bass=True)))
    for chord, notes in CHORDS.items():
        bank.append(save('PracticeKeys' + chord, tonal(notes[-3:], 1.4)))
    for kind in ['Kick', 'Brush', 'Hat']:
        bank.append(save('Practice' + kind, percussion(kind)))
    (OUT / 'audio-bank.json').write_text(json.dumps({
        'source': 'Original deterministic synthesis; no third-party audio or samples.',
        'sample_rate': RATE, 'channels': 1, 'bank': bank}, indent=2) + '\n')
    print('Generated', len(bank), 'original instrument samples')


if __name__ == '__main__':
    main()
