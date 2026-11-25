export const CHORD_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export const CHORD_QUALITIES = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "dim", "aug", "add9"] as const;
export type ChordRoot = typeof CHORD_ROOTS[number];
export type ChordQuality = typeof CHORD_QUALITIES[number];
export type Chord = `${ChordRoot}${ChordQuality}`;

export const CHORD_QUALITY_LABELS: Record<ChordQuality, string> = {
  "": "Major", m: "Minor", "7": "7", maj7: "maj7", m7: "m7",
  sus2: "sus2", sus4: "sus4", dim: "Dim", aug: "Aug", add9: "Add9"
};

export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  "": [0, 7, 12, 16], m: [0, 7, 12, 15], "7": [0, 7, 10, 16],
  maj7: [0, 7, 11, 16], m7: [0, 7, 10, 15], sus2: [0, 7, 12, 14],
  sus4: [0, 7, 12, 17], dim: [0, 6, 12, 15], aug: [0, 8, 12, 16], add9: [0, 4, 7, 14]
};

export function chordParts(chord: Chord): {root: ChordRoot; quality: ChordQuality} {
  const length = chord[1] === "#" || chord[1] === "b" ? 2 : 1;
  return {root: chord.slice(0, length) as ChordRoot, quality: chord.slice(length) as ChordQuality};
}

const supportedChords = new Set<string>(CHORD_ROOTS.flatMap(root => CHORD_QUALITIES.map(quality => root + quality)));

export function isChord(value: unknown): value is Chord {
  return typeof value === "string" && supportedChords.has(value);
}
