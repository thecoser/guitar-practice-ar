import {CHORD_NAMES} from "./GuitarPracticeSongs";
import type {Chord} from "./GuitarPracticeSongs";
import type {BeatCue} from "./GuitarChordLoopTiming";
import type {Instrument} from "./GuitarPracticeView";
import {chordParts, CHORD_ROOTS} from "./GuitarChords";
import {GuitarChordVoices} from "./GuitarChordVoices";

const BASS_ALTERNATES: Partial<Record<Chord, Chord>> = {Em: "G", G: "D", C: "G", D: "A", Am: "Em", A: "Em", D7: "A"};
const bankIndex = (chord: Chord) => (CHORD_NAMES as readonly Chord[]).indexOf(chord);

export function practiceGroove(cue: BeatCue, offbeat: boolean): {
  guitar: "accent" | "down" | "up" | null; bass: Chord | null;
} {
  if (cue.phase !== "playing") return {guitar: null, bass: null};
  if (offbeat) {
    const upstroke = (cue.beat === 2 && (cue.meter === 4 || cue.bar % 2 === 0)) ||
      (cue.meter === 4 && cue.beat === 4 && cue.changeNext);
    const pickup = cue.beat === cue.meter && cue.bar % 2 === 0 && cue.changeNext;
    return {guitar: upstroke ? "up" : null, bass: pickup ? cue.next : null};
  }
  const accent = cue.beat === 1 || cue.chordBeat === 1;
  const alternate = cue.beat === 3 && (cue.meter === 4 || cue.bar % 2 === 1);
  const root = CHORD_ROOTS.indexOf(chordParts(cue.current).root);
  return {guitar: accent ? "accent" : "down",
    bass: accent ? cue.current : alternate ? BASS_ALTERNATES[cue.current] ?? CHORD_ROOTS[(root + 7) % 12] : null};
}

// Existing bank: guitar, bass, keys, kick, brush, hat. Upstrokes follow it.
export class GuitarPracticeBand {
  private readonly host: SceneObject;
  private voices: Record<string, AudioComponent[]> = {};
  private turns: Record<string, number> = {};
  private activeGuitar: AudioComponent | null = null;
  private expanded: GuitarChordVoices | null = null;
  dispatchCount = 0;
  offbeatDispatchCount = 0;
  readonly available: boolean;

  constructor(host: SceneObject, tracks: AudioTrackAsset[]) {
    this.host = host;
    this.available = tracks.length === 24 && tracks.every(track => !isNull(track));
    if (!this.available) return;
    const upstrokes = [
      requireAsset("PracticeAudio/PracticeGuitarUpEm.wav"), requireAsset("PracticeAudio/PracticeGuitarUpG.wav"),
      requireAsset("PracticeAudio/PracticeGuitarUpC.wav"), requireAsset("PracticeAudio/PracticeGuitarUpD.wav"),
      requireAsset("PracticeAudio/PracticeGuitarUpAm.wav"), requireAsset("PracticeAudio/PracticeGuitarUpA.wav"),
      requireAsset("PracticeAudio/PracticeGuitarUpD7.wav")
    ] as AudioTrackAsset[];
    const bank = [...tracks, ...upstrokes];
    for (let sample = 0; sample < bank.length; sample++) {
      const track = bank[sample];
      if (isNull(track)) continue;
      const name = sample < 7 || sample >= 24 ? "guitar" : sample < 14 ? "bass" : sample < 21 ? "keys" : "drum";
      const key = String(sample);
      this.voices[key] = [0, 1].map(index => {
        const object = global.scene.createSceneObject("Band " + name + " " + sample + " " + index);
        object.setParent(host);
        const audio = object.createComponent("Component.AudioComponent");
        // Bind before playback: changing audioTrack on the beat requires an
        // engine update before the new player is enabled and can drop a note.
        audio.audioTrack = track;
        audio.playbackMode = Audio.PlaybackMode.LowLatency;
        audio.volume = name === "keys" ? 0.36 : 0.35;
        if (name === "guitar") audio.fadeOutTime = 0.045;
        return audio;
      });
      this.turns[key] = 0;
    }
  }

  beat(cue: BeatCue, enabled: Record<Instrument, boolean>): void {
    if (!this.available || cue.phase !== "playing") return;
    const groove = practiceGroove(cue, false);
    if (enabled.guitar && groove.guitar) this.strum(cue.current, groove.guitar === "accent" ? 0.45 : 0.27);
    if (enabled.bass && groove.bass) this.playHarmony("bass", groove.bass, groove.bass === cue.current ? 0.35 : 0.27);
    if (enabled.keys && (cue.chordBeat === 1 || cue.beat === 1)) this.playHarmony("keys", cue.current, 0.36);
    if (enabled.drums) {
      this.play(23, 0.35);
      if (cue.beat === 1 || (cue.meter === 4 && cue.beat === 3)) this.play(21, 0.35);
      else this.play(22, 0.35);
    }
  }

  offbeat(cue: BeatCue, enabled: Record<Instrument, boolean>): void {
    if (!this.available) return;
    const groove = practiceGroove(cue, true);
    const before = this.dispatchCount;
    if (enabled.guitar && groove.guitar) this.strum(cue.current, 0.22, true);
    if (enabled.bass && groove.bass) this.playHarmony("bass", groove.bass, 0.20);
    this.offbeatDispatchCount += this.dispatchCount - before;
  }

  stop(): void {
    Object.keys(this.voices).forEach(name => this.voices[name].forEach(audio => audio.stop(false)));
    this.activeGuitar = null;
    this.expanded?.stop();
  }

  activeVoices(): number {
    return Object.keys(this.voices).reduce((sum, name) =>
      sum + this.voices[name].filter(audio => audio.isPlaying()).length, this.expanded?.activeVoices() ?? 0);
  }

  prepare(chords: Chord[]): void {
    if (this.available && !this.expanded && chords.some(chord => bankIndex(chord) < 0)) {
      this.expanded = new GuitarChordVoices(this.host);
    }
  }

  private playHarmony(stem: "bass" | "keys", chord: Chord, volume: number): void {
    const sample = bankIndex(chord);
    if (sample >= 0) this.play(sample + (stem === "bass" ? 7 : 14), volume);
    else this.dispatchCount += this.expanded?.play(stem, chord, volume) ?? 0;
  }

  private strum(chord: Chord, volume: number, up = false): void {
    const sample = bankIndex(chord);
    if (sample < 0) {
      this.activeGuitar?.stop(true);
      this.activeGuitar = null;
      this.dispatchCount += this.expanded?.play("guitar", chord, volume) ?? 0;
      return;
    }
    const index = sample + (up ? 24 : 0);
    if (!this.voices[String(index)]) return;
    this.activeGuitar?.stop(true);
    this.activeGuitar = this.play(index, volume);
  }

  private play(index: number, volume: number): AudioComponent {
    const key = String(index);
    const audio = this.voices[key][this.turns[key]++ % 2];
    audio.stop(false);
    audio.volume = volume;
    audio.play(1);
    this.dispatchCount++;
    return audio;
  }
}
