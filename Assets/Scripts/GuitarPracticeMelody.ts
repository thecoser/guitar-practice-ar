import {melodyForSong, melodyNoteAt} from "./GuitarMelodyScore";

type MelodyPlan = NonNullable<ReturnType<typeof melodyForSong>>;

export class GuitarPracticeMelody {
  private readonly voices = new Map<number, AudioComponent[]>();
  private activeVoice: AudioComponent | null = null;
  private activeStart: number | null = null;
  private voiceIndex = 0;
  readonly available: boolean;
  dispatchCount = 0;

  constructor(host: SceneObject) {
    const tracks: [number, Asset][] = [
      [62, requireAsset("PracticeAudio/PracticeHum62.wav")],
      [64, requireAsset("PracticeAudio/PracticeHum64.wav")],
      [66, requireAsset("PracticeAudio/PracticeHum66.wav")],
      [67, requireAsset("PracticeAudio/PracticeHum67.wav")],
      [69, requireAsset("PracticeAudio/PracticeHum69.wav")],
      [71, requireAsset("PracticeAudio/PracticeHum71.wav")],
      [72, requireAsset("PracticeAudio/PracticeHum72.wav")],
      [74, requireAsset("PracticeAudio/PracticeHum74.wav")],
      [76, requireAsset("PracticeAudio/PracticeHum76.wav")],
      [79, requireAsset("PracticeAudio/PracticeHum79.wav")]
    ];
    this.available = tracks.every(([, track]) => !isNull(track) && track.isOfType("Asset.AudioTrackAsset"));
    if (!this.available) return;
    for (const [pitch, track] of tracks) {
      this.voices.set(pitch, [0, 1].map(index => {
        const voice = global.scene.createSceneObject("Melody " + pitch + " " + index);
        voice.setParent(host);
        const audio = voice.createComponent("Component.AudioComponent");
        audio.audioTrack = track as AudioTrackAsset;
        audio.playbackMode = Audio.PlaybackMode.LowLatency;
        audio.volume = 0.38;
        audio.fadeOutTime = 0.018;
        return audio;
      }));
    }
  }

  update(plan: MelodyPlan, elapsedBeats: number): void {
    if (!this.available) return;
    const note = melodyNoteAt(plan, elapsedBeats);
    if ((note?.start ?? null) === this.activeStart) return;
    this.activeVoice?.stop(true);
    this.activeVoice = null;
    this.activeStart = note?.start ?? null;
    if (!note) return;
    const voices = this.voices.get(note.pitch);
    if (!voices) return;
    this.voiceIndex = 1 - this.voiceIndex;
    const audio = voices[this.voiceIndex];
    audio.stop(false);
    audio.play(1);
    this.activeVoice = audio;
    this.dispatchCount++;
  }

  stop(): void {
    for (const voices of this.voices.values()) {
      for (const voice of voices) {
        if (voice.isPlaying()) voice.stop(false);
      }
    }
    this.activeVoice = null;
    this.activeStart = null;
  }

  isPlaying(): boolean { return this.activeVoice?.isPlaying() ?? false; }
}
