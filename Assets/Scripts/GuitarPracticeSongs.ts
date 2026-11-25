// Original beginner accompaniment charts with traditional lyric cues.
import {isChord} from "./GuitarChords";
import type {Chord} from "./GuitarChords";
export type {Chord} from "./GuitarChords";
export const CHORD_NAMES = ["Em", "G", "C", "D", "Am", "A", "D7"] as const;

export type Meter = 3 | 4;
export interface ChordStep { chord: Chord; beats: number; lyric?: string }
export interface SongSection { name: string; steps: ChordStep[]; pickupLyric?: string }
export interface PracticeSong {
  id: string;
  title: string;
  meter: Meter;
  bpm: number;
  sections: SongSection[];
}

function bars(name: string, meter: Meter, chords: Chord[], lyrics: string[] = [], pickupLyric?: string): SongSection {
  return {name, ...(pickupLyric ? {pickupLyric} : {}), steps: chords.map((chord, index) => ({chord, beats: meter,
    ...(lyrics[index] ? {lyric: lyrics[index]} : {})}))};
}

const rangeEnding = ["Seldom is heard", "a discouraging", "word,", "and the",
  "skies are not", "cloudy all", "day.", "day."];

// Phrase cues are grouped by bar for the portions played by these arrangements.
export const STARTER_SONGS: PracticeSong[] = [
  {
    id: "amazing-grace", title: "Amazing Grace", meter: 3, bpm: 75,
    sections: [
      bars("First half", 3, ["G", "G", "C", "G", "G", "G", "D", "D"],
        ["Amazing", "grace, how", "sweet the", "sound, that", "saved a", "wretch like", "me.", "me."], "Amazing"),
      bars("Second half", 3, ["G", "G", "C", "G", "G", "D", "G", "G"],
        ["I once was", "lost, but", "now am", "found, was", "blind, but", "now I", "see.", "see."], "I"),
    ],
  },
  {
    id: "home-on-the-range", title: "Home on the Range", meter: 3, bpm: 90,
    sections: [
      bars("Verse", 3, ["G", "G", "C", "C", "G", "G", "D", "D",
        "G", "G", "C", "C", "G", "D", "G", "G"],
        ["me a home", "where the", "buffalo roam,", "where the", "deer and the", "antelope", "play.", "Where",
          ...rangeEnding], "Oh, give"),
      bars("Chorus", 3, ["G", "D", "G", "G", "G", "G", "D", "D",
        "G", "G", "C", "C", "G", "D", "G", "G"],
        ["Home,", "home on the", "range,", "where the", "deer and the", "antelope", "play.", "Where", ...rangeEnding]),
    ],
  },
  {
    id: "auld-lang-syne", title: "Auld Lang Syne", meter: 4, bpm: 75,
    sections: [
      bars("Verse", 4, ["G", "D", "G", "C", "G", "D", "C", "G"],
        ["Auld acquaintance", "be forgot,", "and never brought", "to mind?",
          "Should auld acquaintance", "be forgot,", "and days of auld", "lang syne?"], "Should"),
      bars("Chorus", 4, ["G", "D", "G", "C", "G", "D", "C", "G"],
        ["Auld lang syne,", "my dear, for", "auld lang", "syne.", "We'll tak a cup", "o' kindness yet,",
          "for auld lang", "syne."], "For"),
    ],
  },
];

export function newPracticeChart(): PracticeSong {
  return {id: "my-chart", title: "My practice chart", meter: 4, bpm: 60,
    sections: [bars("My sequence", 4, ["Em", "G", "C", "D"])]};
}

export function copySong(song: PracticeSong): PracticeSong {
  return {...song, sections: song.sections.map(section => ({...section,
    steps: section.steps.map(step => ({...step}))}))};
}

// Store only chord timing and optional lyric phrases with bounded length.
export function cleanLyric(value: unknown): string {
  return typeof value === "string"
    ? Array.from(value.replace(/\s+/g, " ").trim()).slice(0, 72).join("").trimEnd() : "";
}

export function readPracticeChart(raw: string): PracticeSong;
export function readPracticeChart(raw: string, fallback: null): PracticeSong | null;
export function readPracticeChart(raw: string, fallback: PracticeSong | null = newPracticeChart()): PracticeSong | null {
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.steps) ||
        data.steps.length < 1 || data.steps.length > MAX_CHORD_STEPS ||
        (data.meter !== 3 && data.meter !== 4) ||
        !Number.isInteger(data.bpm) || data.bpm < 30 || data.bpm > 120) return fallback;
    const steps: ChordStep[] = [];
    for (const step of data.steps) {
      if (!step || !isChord(step.chord) ||
          !Number.isInteger(step.beats) || step.beats < 1 || step.beats > 8) return fallback;
      const lyric = cleanLyric(step.lyric);
      steps.push({chord: step.chord, beats: step.beats, ...(lyric ? {lyric} : {})});
    }
    return {...newPracticeChart(), meter: data.meter, bpm: data.bpm,
      sections: [{name: "My sequence", steps}]};
  } catch (_) { return fallback; }
}

export function writePracticeChart(song: PracticeSong): string {
  return JSON.stringify({version: 1, meter: song.meter, bpm: song.bpm,
    steps: song.sections[0].steps.map(({chord, beats, lyric}) => {
      const phrase = cleanLyric(lyric);
      return {chord, beats, ...(phrase ? {lyric: phrase} : {})};
    })});
}

export const SONG_LIBRARY_KEY = "guitar.practice.songs.v2";
export const LEGACY_CHART_KEY = "guitar.practice.chart.v1";
export const PRACTICE_LOOP_KEY = "guitar.practice.loop.v1";
export const MAX_SAVED_SONGS = 24;
export const MAX_CHORD_STEPS = 96;

export function newPracticeLoop(): PracticeSong {
  return {id: "practice", title: "Chord practice", meter: 4, bpm: 60,
    sections: [{name: "Loop", steps: []}]};
}

export function readPracticeLoop(raw: string): PracticeSong {
  const loop = newPracticeLoop();
  const saved = readPracticeChart(raw, null);
  if (saved) {
    loop.bpm = saved.bpm;
    loop.meter = saved.meter;
    loop.sections[0].steps = saved.sections[0].steps.map(({chord, beats}) => ({chord, beats}));
  }
  return loop;
}

export function cleanSongTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, 32) || "Untitled song";
}

export function readSongLibrary(raw: string, legacy: string): PracticeSong[] {
  const readEntry = (entry: {id?: string; title?: string; chart?: string} | null) => {
    if (!entry || typeof entry.id !== "string" || !/^custom-[1-9]\d*$/.test(entry.id) ||
        typeof entry.title !== "string" || typeof entry.chart !== "string") return null;
    const chart = readPracticeChart(entry.chart, null);
    return chart ? {...chart, id: entry.id, title: cleanSongTitle(entry.title)} : null;
  };
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version === 2 && Array.isArray(parsed.songs)) {
        const ids = new Set<string>();
        return parsed.songs.slice(0, MAX_SAVED_SONGS).flatMap((entry: Parameters<typeof readEntry>[0]) => {
          const song = readEntry(entry);
          if (!song || ids.has(song.id)) return [];
          ids.add(song.id);
          return [song];
        });
      }
    } catch (_) { /* Try the legacy chart if the library could not be read. */ }
  }
  const chart = readPracticeChart(legacy, null);
  return chart ? [{...chart, id: "custom-1", title: "My practice chart"}] : [];
}

export function writeSongLibrary(songs: PracticeSong[]): string {
  return JSON.stringify({version: 2, songs: songs.map(song =>
    ({id: song.id, title: cleanSongTitle(song.title), chart: writePracticeChart(song)}))});
}
