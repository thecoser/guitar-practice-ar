import {isChord} from "./GuitarChords";
import type {Chord} from "./GuitarChords";
import {cleanLyric, cleanSongTitle, MAX_CHORD_STEPS} from "./GuitarPracticeSongs";
import type {ChordStep, Meter} from "./GuitarPracticeSongs";

type Draft = {title: string; steps: ChordStep[]};
type ImportResult = {ok: true; draft: Draft} | {ok: false; error: string};
type Mark = {chord: string; lyric: string};

const enharmonics: Record<string, string> = {
  Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb", Cb: "B", "B#": "C", Fb: "E", "E#": "F"
};

function chordSymbol(raw: string): Chord | null {
  const token = raw.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  const parts = /^([A-G][#b]?)(.*)$/.exec(token);
  if (!parts) return null;
  const suffix = parts[2] === "-" || parts[2] === "min" ? "m" : parts[2].replace(/^M7$/, "maj7");
  const symbol = (enharmonics[parts[1]] ?? parts[1]) + suffix;
  return isChord(symbol) ? symbol : null;
}

function chordRow(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  return tokens.every(token => /^[A-G][#b♯♭]?(?:maj|min|sus|add|dim|aug|m|M|ø|°|Δ|-|\+)?\d*(?:[#b]\d+)*(?:\/[A-G][#b♯♭]?)?$/.test(token));
}

function inlineMarks(line: string): Mark[] {
  const matches = [...line.matchAll(/\[([^\]]+)\]/g)];
  return matches.map((match, index) => ({
    chord: match[1],
    lyric: (index === 0 ? line.slice(0, match.index) : "") +
      line.slice(match.index! + match[0].length, matches[index + 1]?.index ?? line.length)
  }));
}

function alignedMarks(chords: string, lyrics: string): Mark[] {
  const matches = [...chords.matchAll(/\S+/g)];
  return matches.map((match, index) => ({
    chord: match[0],
    lyric: lyrics.slice(index === 0 ? 0 : match.index, matches[index + 1]?.index ?? lyrics.length)
  }));
}

export function importChordChart(raw: string, meter: Meter, barsPerLine: number): ImportResult {
  if (raw.length > 6000) return {ok: false, error: "Paste a shorter chart (6,000 characters maximum)."};
  const lines = raw.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split(/[\n;]/);
  const steps: ChordStep[] = [];
  let title = "Imported song";
  let previous: Chord | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const number = index + 1;
    const content = line.trim();
    if (!content || /^#/.test(content)) continue;
    const directive = /^\{(?:title|t):\s*(.+)\}$/i.exec(content);
    if (directive) { title = cleanSongTitle(directive[1]); continue; }
    if (/^\{[^{}]+\}$/.test(content) || /^(verse|chorus|bridge|intro|outro)(?:\s+\d+)?\s*:?$/i.test(content)) continue;

    let marks: Mark[];
    if (/\[.+?\]/.test(content)) {
      marks = inlineMarks(line);
    } else if (chordRow(content)) {
      const next = lines[index + 1];
      const hasLyric = !!next?.trim() && !chordRow(next) && !/[\[\]{}]/.test(next);
      marks = alignedMarks(line, hasLyric ? next : "");
      if (hasLyric) index++;
    } else if (previous) {
      marks = [{chord: previous, lyric: content}];
    } else if (!steps.length && title === "Imported song") {
      title = cleanSongTitle(content);
      continue;
    } else {
      return {ok: false, error: "Line " + number + " needs a chord, such as [G]."};
    }

    const beats = meter * barsPerLine;
    if (marks.length > beats) return {ok: false, error: "Line " + number + " has more chords than beats. Add bars per line."};
    for (let position = 0; position < marks.length; position++) {
      const mark = marks[position];
      const chord = chordSymbol(mark.chord);
      if (!chord) return {ok: false, error: "Line " + number + " has an unsupported chord: " + mark.chord.slice(0, 20)};
      const phrase = mark.lyric.replace(/\s+/g, " ").trim();
      const lyric = cleanLyric(phrase);
      if (lyric !== phrase) return {ok: false, error: "Line " + number + " has a long lyric phrase. Split it with a chord marker."};
      let length = Math.floor((position + 1) * beats / marks.length) - Math.floor(position * beats / marks.length);
      while (length > 0) {
        const hold = Math.min(8, length);
        steps.push({chord, beats: hold, ...(lyric ? {lyric} : {})});
        length -= hold;
      }
      if (steps.length > MAX_CHORD_STEPS) return {ok: false, error: "Chart is longer than " + MAX_CHORD_STEPS + " chord steps. Import a shorter section."};
      previous = chord;
    }
  }

  return steps.length ? {ok: true, draft: {title, steps}} :
    {ok: false, error: "No chords found. Paste [G] words or chords above a lyric line."};
}
