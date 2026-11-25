import {chordParts, CHORD_INTERVALS, CHORD_ROOTS} from "./GuitarChords"
import type {Chord} from "./GuitarChords"

// Standard tuning, low E through high e. Shared by charts and instrument cues.
export type StringMark = "O" | "X" | readonly [fret: number, finger: number]
export const FINGERINGS: Partial<Record<Chord, readonly StringMark[]>> = {
  Em: ["O", [2, 2], [2, 3], "O", "O", "O"],
  G: [[3, 2], [2, 1], "O", "O", "O", [3, 3]],
  C: ["X", [3, 3], [2, 2], "O", [1, 1], "O"],
  D: ["X", "X", "O", [2, 1], [3, 3], [2, 2]],
  Am: ["X", "O", [2, 2], [2, 3], [1, 1], "O"],
  A: ["X", "O", [2, 1], [2, 2], [2, 3], "O"],
  D7: ["X", "X", "O", [2, 2], [1, 1], [2, 3]],
  E: ["O", [2, 2], [2, 3], [1, 1], "O", "O"],
  F: ["X", "X", [3, 3], [2, 2], [1, 1], [1, 1]],
  B7: ["X", [2, 2], [1, 1], [2, 3], "O", [2, 4]]
}

export function fingeringFor(chord: Chord): readonly StringMark[] {
  const existing = FINGERINGS[chord]
  if (existing) return existing
  const {root, quality} = chordParts(chord)
  const rootFret = (CHORD_ROOTS.indexOf(root) + 10) % 12
  const offsets = CHORD_INTERVALS[quality].map((note, index) => note - [0, 5, 9, 14][index])
  const anchor = rootFret + (rootFret + Math.min(...offsets) < 0 ? 12 : 0)
  const frets = offsets.map(offset => anchor + offset)
  const played = frets.map((fret, string) => ({fret, string}))
    .filter(note => note.fret > 0).sort((a, b) => a.fret - b.fret || a.string - b.string)
  return ["X", "X", ...frets.map((fret, string): StringMark =>
    fret === 0 ? "O" : [fret, played.findIndex(note => note.string === string) + 1])]
}

export function fingerTargets(chord: Chord): {string: number; fret: number; finger: number}[] {
  return fingeringFor(chord).flatMap((mark, string) => typeof mark === "string" ? [] :
    [{string, fret: mark[0], finger: mark[1]}])
}

// Measured rails on PlayerGuitarReference.png (1672 x 941). This is an explicit
// Preview fixture registration, NOT camera detection or real-instrument tracking.
// Rail zero is the nut. In this player-view image, the near (lower) edge
// is the bass side, so each rail runs from low E to high e bottom to top.
const RAILS = [
  [[249, 379], [276, 329]],
  [[306, 398], [333, 346]],
  [[356, 417], [385, 361]],
  [[392, 428], [423, 373]]
]
export function previewFingerPoint(string: number, fret: number): {x: number; y: number} {
  if (!Number.isInteger(string) || string < 0 || string > 5 ||
      !Number.isInteger(fret) || fret < 1 || fret > 3) throw new Error("Unsupported finger target")
  const alongString = (rail: number) => ({
    x: RAILS[rail][0][0] + (RAILS[rail][1][0] - RAILS[rail][0][0]) * string / 5,
    y: RAILS[rail][0][1] + (RAILS[rail][1][1] - RAILS[rail][0][1]) * string / 5
  })
  const before = alongString(fret - 1), after = alongString(fret)
  // Finger lands behind the fret wire, rather than on the wire.
  const x = before.x + (after.x - before.x) * 0.78
  const y = before.y + (after.y - before.y) * 0.78
  return {x: (x - 836) * 64 / 1672, y: (470.5 - y) * 64 / 1672}
}
