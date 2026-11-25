import type {Chord, PracticeSong} from "./GuitarPracticeSongs";
import {newPracticeChart} from "./GuitarPracticeSongs";

export type Tempo = number;
export interface PlaybackPlan {
  song: PracticeSong;
  section: number; // -1: whole song; otherwise one section
  repeat: boolean;
}
export interface BeatCue {
  phase: "count-in" | "playing" | "complete";
  beat: number;
  meter: number;
  current: Chord;
  next: Chord | null;
  beatsUntilChange: number | null;
  beatsRemaining: number;
  chordBeat: number;
  chordBeats: number;
  section: number;
  sectionName: string;
  bar: number;
  totalBars: number;
  cycle: number;
  changeNext: boolean;
  lyric: string;
}

export function beatIndex(elapsedSeconds: number, bpm: Tempo): number {
  return Math.floor(Math.max(0, elapsedSeconds) * bpm / 60);
}

const DEFAULT_PLAN: PlaybackPlan = {song: newPracticeChart(), section: -1, repeat: true};

// One clock drives clicks, charts and band. Never replay missed beats in a burst.
export function cueForIndex(index: number, plan: PlaybackPlan = DEFAULT_PLAN): BeatCue {
  const {song} = plan;
  const entries = song.sections.flatMap((section, sectionIndex) =>
    (plan.section < 0 || plan.section === sectionIndex)
      ? section.steps.map(step => ({...step, section: sectionIndex, sectionName: section.name})) : []);
  if (entries.length === 0) throw new Error("Cannot play an empty chart");
  const total = entries.reduce((sum, step) => sum + step.beats, 0);
  const first = entries[0];
  const base: BeatCue = {phase: "count-in", beat: index + 1, meter: song.meter,
    current: first.chord, next: null, beatsUntilChange: null, beatsRemaining: total, chordBeat: 0, chordBeats: first.beats,
    section: first.section, sectionName: first.sectionName, bar: 1,
    totalBars: Math.ceil(total / song.meter), cycle: 0, changeNext: false,
    lyric: index === song.meter - 1 ? song.sections[first.section].pickupLyric ?? "" : ""};
  if (index < song.meter) return base;
  const elapsed = index - song.meter;
  if (!plan.repeat && elapsed >= total) return {...base, phase: "complete", beat: 0, beatsRemaining: 0};
  const cycle = Math.floor(elapsed / total);
  let remaining = elapsed % total;
  const bar = Math.floor(remaining / song.meter) + 1;
  const beat = remaining % song.meter + 1;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (remaining < entry.beats) {
      // Look through repeated bars of the same chord, including across a loop.
      // At most one cycle is needed; a single-chord loop has no chord change.
      let next: Chord | null = null;
      let distance = entry.beats - remaining;
      for (let offset = 1; offset < entries.length; offset++) {
        const candidateIndex = i + offset;
        if (!plan.repeat && candidateIndex >= entries.length) break;
        const candidate = entries[candidateIndex % entries.length];
        if (candidate.chord !== entry.chord) { next = candidate.chord; break; }
        distance += candidate.beats;
      }
      const beatsUntilChange = next === null ? null : distance;
      return {...base, phase: "playing", beat, current: entry.chord, next,
        beatsUntilChange, beatsRemaining: total - elapsed % total,
        chordBeat: remaining + 1, chordBeats: entry.beats,
        section: entry.section, sectionName: entry.sectionName, bar, cycle,
        changeNext: beatsUntilChange === 1, lyric: entry.lyric ?? ""};
    }
    remaining -= entry.beats;
  }
  throw new Error("Invalid chart timing");
}
