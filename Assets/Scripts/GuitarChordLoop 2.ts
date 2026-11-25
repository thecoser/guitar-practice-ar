// Owns song selection, private chord editing, transport and world placement.
import {GuitarChordLoopUI} from "./GuitarChordLoopUI";
import {BeatCue, beatIndex, cueForIndex} from "./GuitarChordLoopTiming";
import {PracticeSong, STARTER_SONGS, copySong, newPracticeChart,
  readPracticeChart, writePracticeChart} from "./GuitarPracticeSongs";
import {PracticeAction, PracticePhase, Instrument} from "./GuitarPracticeView";
import {GuitarPracticeBand} from "./GuitarPracticeBand";

@component
export class GuitarChordLoop extends BaseScriptComponent {
  @input ui!: GuitarChordLoopUI;
  @input panelRoot!: SceneObject;
  @input sceneCamera!: Camera;
  @input clickAudio!: AudioComponent;
  @input @allowUndefined previewReference?: SceneObject;
  @input @allowUndefined bandTracks?: AudioTrackAsset[];
  @input placementDistanceCm: number = 105;
  @input clickVolume: number = 0.65;
  @input timingDiagnostics: boolean = true;
  @input debugColliders: boolean = false;

  private phase: PracticePhase = "library";
  private song: PracticeSong = newPracticeChart();
  private savedChart: PracticeSong = newPracticeChart();
  private beforeEdit: PracticeSong | null = null;
  private beforeEditSection = -1;
  private cursor = 0;
  private bpm = 60;
  private section = -1;
  private repeat = true;
  private showReference = true;
  private status = "";
  private instruments: Record<Instrument, boolean> = {guitar: true, bass: true, keys: false, drums: true};
  private epoch = 0;
  private pausedAt = 0;
  private lastIndex = -1;
  private dispatchCount = 0;
  private beatDispatchedAt: number | null = null;
  private run = 0;
  private diagnostics = false;
  private unsubscribe: (() => void) | null = null;
  private cue: BeatCue | null = null;
  private band: GuitarPracticeBand | null = null;
  private committedPosition: vec3 | null = null;
  private committedRotation: quat | null = null;
  private readonly chartKey = "guitar.practice.chart.v1";

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initialize());
    this.createEvent("UpdateEvent").bind(() => this.updatePlayback());
    this.createEvent("LateUpdateEvent").bind(() => {
      if (this.phase === "placement") this.updateCandidatePose();
    });
    this.createEvent("OnDestroyEvent").bind(() => {
      this.unsubscribe?.();
      this.band?.stop();
    });
  }

  getPracticeState() {
    return {phase: this.phase, bpm: this.bpm, songId: this.song.id,
      songTitle: this.song.title, meter: this.song.meter,
      section: this.section, repeat: this.repeat, cursor: this.cursor, showReference: this.showReference,
      chartSteps: this.song.sections.flatMap(section => section.steps.map(step => ({...step}))),
      instruments: {...this.instruments}, bandAvailable: this.band?.available ?? false,
      bandDispatchCount: this.band?.dispatchCount ?? 0,
      activeBandVoices: this.band?.activeVoices() ?? 0,
      absoluteBeat: this.lastIndex, beatDispatchedAt: this.beatDispatchedAt, beat: this.cue?.beat ?? 0,
      current: this.cue?.current ?? this.song.sections[Math.max(0, Math.min(this.section, this.song.sections.length - 1))].steps[0].chord,
      next: this.cue?.next ?? null, accent: this.cue?.changeNext ?? false,
      bar: this.cue?.bar ?? 0, cycle: this.cue?.cycle ?? 0,
      clickDispatchCount: this.dispatchCount, run: this.run, status: this.status,
      committedPosition: this.committedPosition ? this.positionValues(this.committedPosition) : null,
      committedRotation: this.committedRotation ? this.rotationValues(this.committedRotation) : null};
  }

  private initialize(): void {
    if (isNull(this.ui) || isNull(this.panelRoot) || isNull(this.sceneCamera) ||
        isNull(this.clickAudio) || isNull(this.clickAudio.audioTrack)) {
      print("[GuitarPractice] Missing required scene input or metronome track.");
      return;
    }
    const inEditor = global.deviceInfoSystem.isEditor();
    if (this.previewReference && !isNull(this.previewReference)) this.previewReference.enabled = inEditor;
    this.diagnostics = this.timingDiagnostics && inEditor;
    this.clickAudio.playbackMode = Audio.PlaybackMode.LowLatency;
    this.clickAudio.volume = Math.max(0, Math.min(1, this.clickVolume));
    this.band = new GuitarPracticeBand(this.getSceneObject(), this.bandTracks ?? []);
    try {
      this.savedChart = readPracticeChart(global.persistentStorageSystem.store.getString(this.chartKey));
    } catch (_) {
      this.status = "Saved chart unavailable; using a new chart";
    }
    this.song = copySong(this.savedChart);
    this.rememberPanelPose();
    this.unsubscribe = this.ui.onAction.add(action => this.handle(action));
    this.render();
    if (this.debugColliders) this.setColliderDebug(this.panelRoot);
    this.log("ready");
  }

  private handle(action: PracticeAction): void {
    // Ignore controls from hidden screens or a queued trigger after a transition.
    if (this.phase === "playing" || this.phase === "count-in" || this.phase === "paused") {
      if (this.phase === "paused" && action.type === "tempo") {
        // Preserve fractional musical position when changing speed while paused.
        const elapsedBeats = (this.pausedAt - this.epoch) * this.bpm / 60;
        this.bpm = Math.max(30, Math.min(120, this.bpm + action.delta));
        this.epoch = this.pausedAt - elapsedBeats * 60 / this.bpm;
        this.render();
      } else if (this.phase === "paused" && action.type === "instrument") {
        this.instruments[action.instrument] = !this.instruments[action.instrument];
        this.render();
      } else if (action.type === "stop") this.stopPlayback();
      else if (action.type === "pause") {
        if (this.phase === "paused") {
          this.epoch += getTime() - this.pausedAt;
          this.phase = this.cue?.phase === "count-in" ? "count-in" : "playing";
        } else {
          this.pausedAt = getTime();
          this.phase = "paused";
          this.clickAudio.stop(false); this.band?.stop();
        }
        this.render(); this.log(this.phase === "paused" ? "paused" : "resumed");
      }
      return;
    }
    if (this.phase === "placement") {
      if (action.type === "confirm") {
        this.rememberPanelPose(); this.phase = "setup"; this.render();
      }
      return;
    }
    if (this.phase === "editor") { this.edit(action); return; }
    if (action.type === "song" && this.phase === "library") {
      const chosen = action.id === "my-chart" ? this.savedChart : STARTER_SONGS.find(s => s.id === action.id);
      if (!chosen) return;
      this.song = copySong(chosen); this.bpm = chosen.bpm; this.section = -1;
      this.repeat = true; this.status = ""; this.cue = null; this.phase = "setup";
    } else if (this.phase === "setup") {
      switch (action.type) {
        case "library": this.phase = "library"; break;
        case "tempo": this.bpm = Math.max(30, Math.min(120, this.bpm + action.delta)); break;
        case "reference": this.showReference = !this.showReference; break;
        case "select-section":
          if (Number.isInteger(action.section) && action.section >= -1 && action.section < this.song.sections.length) {
            this.section = action.section;
          }
          break;
        case "repeat": this.repeat = !this.repeat; break;
        case "instrument": this.instruments[action.instrument] = !this.instruments[action.instrument]; break;
        case "place": this.phase = "placement"; this.updateCandidatePose(); break;
        case "start": this.startPlayback(); return;
        case "edit":
          this.beforeEdit = copySong(this.song);
          this.beforeEditSection = this.section;
          this.song = {...newPracticeChart(), meter: this.song.meter, bpm: this.bpm,
            sections: [{name: "My sequence", steps: this.song.sections.filter((_, i) =>
              this.section < 0 || i === this.section).flatMap(s => s.steps.map(step => ({...step})))}]};
          this.section = -1; this.cursor = 0; this.phase = "editor"; break;
      }
    }
    this.render();
  }

  private edit(action: PracticeAction): void {
    const steps = this.song.sections[0].steps;
    switch (action.type) {
      case "cursor": this.cursor = Math.max(0, Math.min(steps.length - 1, this.cursor + action.delta)); break;
      case "chord": steps[this.cursor].chord = action.chord; break;
      case "duration": steps[this.cursor].beats = Math.max(1, Math.min(8, steps[this.cursor].beats + action.delta)); break;
      case "append":
        if (steps.length < 32) { steps.splice(this.cursor + 1, 0, {...steps[this.cursor]}); this.cursor++; }
        break;
      case "remove":
        if (steps.length > 1) { steps.splice(this.cursor, 1); this.cursor = Math.min(this.cursor, steps.length - 1); }
        break;
      case "meter": this.song.meter = this.song.meter === 4 ? 3 : 4; break;
      case "reset": this.song = newPracticeChart(); this.cursor = 0; break;
      case "cancel":
        if (this.beforeEdit) this.song = this.beforeEdit;
        this.section = this.beforeEditSection;
        this.beforeEdit = null; this.phase = "setup"; break;
      case "save":
        this.song.bpm = this.bpm;
        try {
          global.persistentStorageSystem.store.putString(this.chartKey, writePracticeChart(this.song));
          this.savedChart = copySong(this.song); this.status = "Practice chart saved";
        } catch (_) {
          this.savedChart = copySong(this.song); this.status = "Chart kept for this session; storage unavailable";
        }
        this.beforeEdit = null; this.section = -1; this.phase = "setup"; break;
    }
    this.render();
  }

  private render(): void {
    if (this.previewReference && !isNull(this.previewReference)) {
      this.previewReference.enabled = global.deviceInfoSystem.isEditor() && this.showReference && !this.ui.hasPreviewArtwork() &&
        (this.phase === "playing" || this.phase === "count-in" || this.phase === "placement");
    }
    this.ui.show({phase: this.phase, song: this.song, bpm: this.bpm, section: this.section,
      repeat: this.repeat, cue: this.cue, instruments: this.instruments,
      cursor: this.cursor, status: this.status, showReference: this.showReference});
  }

  private updateCandidatePose(): void {
    const camera = this.sceneCamera.getTransform();
    const rotation = camera.getWorldRotation();
    const offset = rotation.multiplyVec3(new vec3(0, 0, -Math.max(30, this.placementDistanceCm)));
    const panel = this.panelRoot.getTransform();
    panel.setWorldPosition(camera.getWorldPosition().add(offset));
    panel.setWorldRotation(rotation);
  }

  private rememberPanelPose(): void {
    const panel = this.panelRoot.getTransform();
    this.committedPosition = panel.getWorldPosition(); this.committedRotation = panel.getWorldRotation();
  }

  private startPlayback(): void {
    this.phase = "count-in"; this.status = ""; this.epoch = getTime();
    this.lastIndex = -1; this.dispatchCount = 0; this.run++;
    this.updatePlayback();
  }

  private stopPlayback(complete = false): void {
    this.phase = "setup"; this.clickAudio.stop(false); this.band?.stop();
    this.cue = null; this.lastIndex = -1; this.dispatchCount = 0; this.beatDispatchedAt = null;
    this.status = complete ? "Finished — play again or choose a section" : "";
    this.render(); this.log(complete ? "complete" : "stopped");
  }

  private updatePlayback(): void {
    if (this.phase !== "playing" && this.phase !== "count-in") return;
    const elapsed = getTime() - this.epoch;
    const index = beatIndex(elapsed, this.bpm);
    if (index <= this.lastIndex) return;
    const cue = cueForIndex(index, {song: this.song, section: this.section, repeat: this.repeat});
    if (cue.phase === "complete") { this.stopPlayback(true); return; }
    const skipped = index - this.lastIndex - 1;
    this.lastIndex = index; this.cue = cue; this.phase = cue.phase;
    this.beatDispatchedAt = getTime();
    this.dispatchCount++; // temporary silent visual inspection
    // temporary silent visual inspection
    this.render();
    this.log("beat", {elapsed, skipped, audioPlaying: this.clickAudio.isPlaying()});
  }

  private log(event: string, extra?: object): void {
    if (!this.diagnostics) return;
    // Diagnostics omit user-entered chart contents.
    print("[GuitarPractice] " + JSON.stringify({event, phase: this.phase, bpm: this.bpm,
      absoluteBeat: this.lastIndex, clickDispatchCount: this.dispatchCount,
      bandAvailable: this.band?.available, ...extra}));
  }

  private positionValues(value: vec3): [number, number, number] { return [value.x, value.y, value.z]; }
  private rotationValues(value: quat): [number, number, number, number] { return [value.x, value.y, value.z, value.w]; }
  private setColliderDebug(root: SceneObject): void {
    const collider = root.getComponent("Physics.ColliderComponent");
    if (collider) collider.debugDrawEnabled = true;
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebug(root.getChild(i));
  }
}
