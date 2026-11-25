import {chordParts, CHORD_INTERVALS, CHORD_ROOTS} from "./GuitarChords";
import type {Chord} from "./GuitarChords";

type Stem = "guitar" | "bass" | "keys";

export class GuitarChordVoices {
  private readonly players: Record<Stem, AudioComponent[]>;

  constructor(host: SceneObject) {
    const assets = {
      guitar: [
        requireAsset("PracticeAudio/PracticeNoteGuitar0.wav"), requireAsset("PracticeAudio/PracticeNoteGuitar1.wav"),
        requireAsset("PracticeAudio/PracticeNoteGuitar2.wav"), requireAsset("PracticeAudio/PracticeNoteGuitar3.wav"),
        requireAsset("PracticeAudio/PracticeNoteGuitar4.wav"), requireAsset("PracticeAudio/PracticeNoteGuitar5.wav"),
        requireAsset("PracticeAudio/PracticeNoteGuitar6.wav"), requireAsset("PracticeAudio/PracticeNoteGuitar7.wav"),
        requireAsset("PracticeAudio/PracticeNoteGuitar8.wav"), requireAsset("PracticeAudio/PracticeNoteGuitar9.wav"),
        requireAsset("PracticeAudio/PracticeNoteGuitar10.wav"), requireAsset("PracticeAudio/PracticeNoteGuitar11.wav")
      ],
      bass: [
        requireAsset("PracticeAudio/PracticeNoteBass0.wav"), requireAsset("PracticeAudio/PracticeNoteBass1.wav"),
        requireAsset("PracticeAudio/PracticeNoteBass2.wav"), requireAsset("PracticeAudio/PracticeNoteBass3.wav"),
        requireAsset("PracticeAudio/PracticeNoteBass4.wav"), requireAsset("PracticeAudio/PracticeNoteBass5.wav"),
        requireAsset("PracticeAudio/PracticeNoteBass6.wav"), requireAsset("PracticeAudio/PracticeNoteBass7.wav"),
        requireAsset("PracticeAudio/PracticeNoteBass8.wav"), requireAsset("PracticeAudio/PracticeNoteBass9.wav"),
        requireAsset("PracticeAudio/PracticeNoteBass10.wav"), requireAsset("PracticeAudio/PracticeNoteBass11.wav")
      ],
      keys: [
        requireAsset("PracticeAudio/PracticeNoteKeys0.wav"), requireAsset("PracticeAudio/PracticeNoteKeys1.wav"),
        requireAsset("PracticeAudio/PracticeNoteKeys2.wav"), requireAsset("PracticeAudio/PracticeNoteKeys3.wav"),
        requireAsset("PracticeAudio/PracticeNoteKeys4.wav"), requireAsset("PracticeAudio/PracticeNoteKeys5.wav"),
        requireAsset("PracticeAudio/PracticeNoteKeys6.wav"), requireAsset("PracticeAudio/PracticeNoteKeys7.wav"),
        requireAsset("PracticeAudio/PracticeNoteKeys8.wav"), requireAsset("PracticeAudio/PracticeNoteKeys9.wav"),
        requireAsset("PracticeAudio/PracticeNoteKeys10.wav"), requireAsset("PracticeAudio/PracticeNoteKeys11.wav")
      ]
    };
    const create = (stem: Stem) => assets[stem].map((asset, pitch) => {
      const voice = global.scene.createSceneObject("Chord " + stem + " " + pitch);
      voice.setParent(host);
      const audio = voice.createComponent("Component.AudioComponent");
      audio.audioTrack = asset as AudioTrackAsset;
      audio.playbackMode = Audio.PlaybackMode.LowLatency;
      return audio;
    });
    this.players = {guitar: create("guitar"), bass: create("bass"), keys: create("keys")};
  }

  play(stem: Stem, chord: Chord, volume: number): number {
    const {root, quality} = chordParts(chord);
    const base = CHORD_ROOTS.indexOf(root);
    const pitches = stem === "bass" ? [base] :
      [...new Set(CHORD_INTERVALS[quality].map(interval => (base + interval) % 12))];
    for (const pitch of pitches) {
      const audio = this.players[stem][pitch];
      audio.stop(false);
      audio.volume = volume / Math.sqrt(pitches.length);
      audio.play(1);
    }
    return pitches.length;
  }

  stop(): void {
    for (const voices of Object.values(this.players)) for (const audio of voices) audio.stop(false);
  }

  activeVoices(): number {
    return Object.values(this.players).reduce((count, voices) =>
      count + voices.filter(audio => audio.isPlaying()).length, 0);
  }
}
