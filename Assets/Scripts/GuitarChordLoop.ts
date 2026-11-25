// Desktop reference artwork is optional; live practice cues remain authoritative.
// Owns song selection, private chord editing, transport and world placement.
import {GuitarChordLoopUI} from "./GuitarChordLoopUI";
import {BeatCue, beatIndex, cueForIndex} from "./GuitarChordLoopTiming";
import {PracticeSong, STARTER_SONGS, copySong, newPracticeChart,
  cleanLyric, cleanSongTitle, LEGACY_CHART_KEY, MAX_CHORD_STEPS, MAX_SAVED_SONGS,
  newPracticeLoop, PRACTICE_LOOP_KEY, readPracticeLoop, readSongLibrary,
  SONG_LIBRARY_KEY, writePracticeChart, writeSongLibrary} from "./GuitarPracticeSongs";
import {chordParts} from "./GuitarChords";
import {importChordChart} from "./GuitarChartImport";
import {SCANNED_CHART} from "./GuitarScannedPage";
import type {PracticeView} from "./GuitarPracticeView";
import type {Chord} from "./GuitarChords";
import {PracticeAction, PracticePhase, Instrument} from "./GuitarPracticeView";
import {melodyForSong} from "./GuitarMelodyScore";
import {GuitarPracticeMelody} from "./GuitarPracticeMelody";
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
  private savedSongs: PracticeSong[] = [];
  private savedOpen = false;
  private savedPage = 0;
  private songToDelete: PracticeSong | undefined;
  private practice = newPracticeLoop();
  private beforeEdit: {song: PracticeSong; phase: PracticePhase; section: number; bpm: number; repeat: boolean} | null = null;
  private picker: "append" | "replace" | null = null;
  private pickedChord: Chord = "C";
  private chartImport: PracticeView["chartImport"];
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
  private lastOffbeatIndex = -1;
  private dispatchCount = 0;
  private beatDispatchedAt: number | null = null;
  private run = 0;
  private diagnostics = false;
  private unsubscribe: (() => void) | null = null;
  private cue: BeatCue | null = null;
  private band: GuitarPracticeBand | null = null;
  private melody: GuitarPracticeMelody | null = null;
  private melodyPlan: ReturnType<typeof melodyForSong> = null;
  private melodyEnabled = true;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initialize());
    this.createEvent("UpdateEvent").bind(() => this.updatePlayback());
    if (global.deviceInfoSystem.isEditor()) {
      const framePreview = this.createEvent("LateUpdateEvent");
      framePreview.bind(() => {
        if (isNull(this.ui) || isNull(this.sceneCamera) || !this.ui.getChartPose()) return;
        const camera = this.sceneCamera.getTransform();
        this.ui.framePreview(camera.getWorldPosition(), camera.getWorldRotation(), this.placementDistanceCm);
        this.removeEvent(framePreview);
      });
    }
    this.createEvent("OnDestroyEvent").bind(() => {
      this.unsubscribe?.();
      this.band?.stop();
      this.melody?.stop();
    });
  }

  getPracticeState() {
    return {phase: this.phase, bpm: this.bpm, songId: this.song.id,
      songTitle: this.song.title, meter: this.song.meter,
      section: this.section, repeat: this.repeat, cursor: this.cursor, showReference: this.showReference,
      chartSteps: this.song.sections.flatMap(section => section.steps.map(step => ({...step}))),
      instruments: {...this.instruments}, bandAvailable: this.band?.available ?? false,
      bandDispatchCount: this.band?.dispatchCount ?? 0,
      bandOffbeatDispatchCount: this.band?.offbeatDispatchCount ?? 0,
      pickerOpen: this.picker !== null, melodyEnabled: this.melodyEnabled, melodyAvailable: this.melodyAvailable(),
      lyric: this.cue?.lyric ?? "",
      melodyPlaying: this.melody?.isPlaying() ?? false,
      melodyDispatchCount: this.melody?.dispatchCount ?? 0,
      activeBandVoices: this.band?.activeVoices() ?? 0,
      absoluteBeat: this.lastIndex, beatDispatchedAt: this.beatDispatchedAt, beat: this.cue?.beat ?? 0,
      current: this.cue?.current ?? this.song.sections[Math.max(0, Math.min(this.section, this.song.sections.length - 1))].steps[0]?.chord ?? null,
      next: this.cue?.next ?? null, accent: this.cue?.changeNext ?? false,
      bar: this.cue?.bar ?? 0, cycle: this.cue?.cycle ?? 0,
      clickDispatchCount: this.dispatchCount, run: this.run, status: this.status,
      cuePose: this.ui.getCuePose(), chartPose: this.ui.getChartPose()};
  }

  private initialize(): void {
    if (isNull(this.ui) || isNull(this.panelRoot) || isNull(this.sceneCamera) ||
        isNull(this.clickAudio) || isNull(this.clickAudio.audioTrack)) {
      print("[GuitarPractice] Missing required scene input or metronome track.");
      return;
    }
    const inEditor = global.deviceInfoSystem.isEditor();
    this.ui.setPlacementCamera(this.sceneCamera);
    if (this.previewReference && !isNull(this.previewReference)) this.previewReference.enabled = inEditor;
    this.diagnostics = this.timingDiagnostics && inEditor;
    this.clickAudio.playbackMode = Audio.PlaybackMode.LowLatency;
    this.clickAudio.volume = Math.max(0, Math.min(1, this.clickVolume));
    this.band = new GuitarPracticeBand(this.getSceneObject(), this.bandTracks ?? []);
    this.melody = new GuitarPracticeMelody(this.getSceneObject());
    try {
      const store = global.persistentStorageSystem.store;
      this.savedSongs = readSongLibrary(store.getString(SONG_LIBRARY_KEY), store.getString(LEGACY_CHART_KEY));
      this.practice = readPracticeLoop(store.getString(PRACTICE_LOOP_KEY));
    } catch (_) {
      this.status = "Saved chart unavailable; using a new chart";
    }
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
      } else if (this.phase === "paused" && action.type === "melody") {
        this.melodyEnabled = !this.melodyEnabled;
        this.render();
      } else if (action.type === "stop") this.stopPlayback();
      else if (action.type === "pause") {
        if (this.phase === "paused") {
          this.epoch += getTime() - this.pausedAt;
          this.phase = this.cue?.phase === "count-in" ? "count-in" : "playing";
          if (this.song.id === "practice") this.rememberPracticeLoop();
        } else {
          this.pausedAt = getTime();
          this.phase = "paused";
          this.clickAudio.stop(false); this.band?.stop(); this.melody?.stop();
        }
        this.render(); this.log(this.phase === "paused" ? "paused" : "resumed");
      }
      return;
    }
    if (this.phase === "placement") {
      if (action.type === "align-adjust") this.ui.nudgePlacement(action.axis, action.delta);
      else if (action.type === "align-target") this.ui.selectPlacementTarget(action.target);
      else if (action.type === "align-reset") this.ui.resetPlacement();
      else if (action.type === "align-confirm" || action.type === "align-cancel") {
        this.ui.finishPlacement(action.type === "align-confirm");
        this.phase = "setup";
        this.status = "";
      }
      this.render();
      return;
    }
    if (this.songToDelete) {
      if (action.type === "confirm-delete-song") this.deleteSavedSong(this.songToDelete.id);
      else if (action.type === "cancel-delete-song") this.songToDelete = undefined;
      this.render();
      return;
    }
    if (this.phase === "editor") { this.edit(action); return; }
    if (this.phase === "library") {
      switch (action.type) {
        case "song": {
          const chosen = [...STARTER_SONGS, ...this.savedSongs].find(song => song.id === action.id);
          if (!chosen) return;
          this.song = copySong(chosen); this.bpm = chosen.bpm; this.section = -1;
          this.repeat = true; this.status = ""; this.cue = null; this.phase = "setup";
          break;
        }
        case "new-song":
          if (this.savedSongs.length >= MAX_SAVED_SONGS) {
            this.status = "Saved song library is full";
          } else {
            this.openEditor(this.blankSong(this.nextSongId(), "Untitled song"));
          }
          break;
        case "practice": this.openEditor(copySong(this.practice)); break;
        case "saved-library": this.savedOpen = !this.savedOpen; this.savedPage = 0; this.status = ""; break;
        case "saved-page":
          this.savedPage = Math.max(0, Math.min(Math.ceil(this.savedSongs.length / 4) - 1, this.savedPage + action.delta));
          break;
      }
    } else if (this.phase === "setup") {
      switch (action.type) {
        case "library": this.phase = "library"; this.savedOpen = false; this.status = ""; break;
        case "tempo": this.bpm = Math.max(30, Math.min(120, this.bpm + action.delta)); break;
        case "melody": this.melodyEnabled = !this.melodyEnabled; break;
        case "reference": this.showReference = !this.showReference; break;
        case "select-section":
          if (Number.isInteger(action.section) && action.section >= -1 && action.section < this.song.sections.length) {
            this.section = action.section;
          }
          break;
        case "repeat": if (this.song.id !== "practice") this.repeat = !this.repeat; break;
        case "instrument": this.instruments[action.instrument] = !this.instruments[action.instrument]; break;
        case "place":
          this.ui.beginPlacement(this.sceneCamera.getTransform().getWorldRotation());
          this.phase = "placement";
          this.status = "";
          break;
        case "start": this.startPlayback(); return;
        case "edit":
          if (this.song.id.startsWith("custom-") || this.song.id === "practice") {
            this.openEditor(copySong(this.song));
          } else if (this.savedSongs.length >= MAX_SAVED_SONGS) {
            this.status = "Saved song library is full";
          } else {
            this.openEditor({...this.blankSong(this.nextSongId(), cleanSongTitle(this.song.title + " copy")),
              meter: this.song.meter,
              sections: [{name: "Song", steps: this.song.sections.filter((_, i) =>
                this.section < 0 || i === this.section).flatMap(section => section.steps.map(step => ({...step})))}]});
          }
          break;
      }
    }
    this.render();
  }

  private blankSong(id: string, title: string): PracticeSong {
    return {id, title, meter: 4, bpm: 60, sections: [{name: id === "practice" ? "Loop" : "Song", steps: []}]};
  }

  private nextSongId(): string {
    let id = this.savedSongs.length + 1;
    while (this.savedSongs.some(song => song.id === "custom-" + id)) id++;
    return "custom-" + id;
  }

  private openEditor(draft: PracticeSong): void {
    this.beforeEdit = {song: this.song, phase: this.phase, section: this.section, bpm: this.bpm, repeat: this.repeat};
    if (this.phase === "setup") draft.bpm = this.bpm;
    this.song = draft;
    this.bpm = draft.bpm; this.section = -1; this.cursor = 0; this.status = "";
    this.picker = null; this.chartImport = undefined; this.phase = "editor";
  }

  private edit(action: PracticeAction): void {
    const steps = this.song.sections[0].steps;
    if (this.chartImport) {
      this.handleChartImport(action);
      this.render();
      return;
    }
    if (this.picker) {
      const {root, quality} = chordParts(this.pickedChord);
      switch (action.type) {
        case "pick-root": this.pickedChord = `${action.root}${quality}`; break;
        case "pick-quality": this.pickedChord = `${root}${action.quality}`; break;
        case "cancel-picker": this.picker = null; break;
        case "commit-chord":
          if (this.picker === "append") {
            steps.push({chord: this.pickedChord, beats: this.song.id === "practice" ? 2 : this.song.meter});
            this.cursor = steps.length - 1;
          } else {
            steps[this.cursor].chord = this.pickedChord;
          }
          this.picker = null;
          break;
      }
      this.render();
      return;
    }
    switch (action.type) {
      case "delete-song":
        this.songToDelete = this.savedSongs.find(song => song.id === this.song.id);
        this.status = "";
        break;
      case "open-import":
        if (this.song.id !== "practice" && !steps.length) {
          this.chartImport = {text: "", bars: 2, meter: this.song.meter, error: ""};
        }
        break;
      case "new-loop":
        if (this.song.id === "practice") {
          this.song = newPracticeLoop();
          this.bpm = this.song.bpm;
          this.cursor = 0;
        }
        break;
      case "song-title": if (this.song.id !== "practice") this.song.title = cleanSongTitle(action.title); break;
      case "step-lyric": {
        const step = steps[action.index];
        if (this.song.id !== action.songId || this.song.id === "practice" || !step) break;
        const lyric = cleanLyric(action.lyric);
        if (lyric) step.lyric = lyric;
        else delete step.lyric;
        break;
      }
      case "tempo": this.bpm = Math.max(30, Math.min(120, this.bpm + action.delta)); break;
      case "cursor":
        if (steps.length) this.cursor = Math.max(0, Math.min(steps.length - 1, this.cursor + action.delta));
        break;
      case "duration":
        if (steps.length) steps[this.cursor].beats = Math.max(1, Math.min(8, steps[this.cursor].beats + action.delta));
        break;
      case "append":
        if (steps.length < MAX_CHORD_STEPS) {
          this.pickedChord = "C"; this.picker = "append";
        }
        break;
      case "change-chord":
        if (steps.length) {
          this.pickedChord = steps[this.cursor].chord; this.picker = "replace";
        }
        break;
      case "move-step": {
        const destination = this.cursor + action.delta;
        if (destination >= 0 && destination < steps.length) {
          const [step] = steps.splice(this.cursor, 1);
          steps.splice(destination, 0, step);
          this.cursor = destination;
        }
        break;
      }
      case "remove":
        if (steps.length) steps.splice(this.cursor, 1);
        this.cursor = Math.max(0, Math.min(this.cursor, steps.length - 1));
        break;
      case "meter": this.song.meter = this.song.meter === 4 ? 3 : 4; break;
      case "cancel": {
        const prior = this.beforeEdit;
        if (!prior) return;
        this.song = prior.song; this.section = prior.section; this.bpm = prior.bpm;
        this.repeat = prior.repeat; this.beforeEdit = null; this.phase = prior.phase;
        break;
      }
      case "save":
        if (!steps.length) return;
        this.song.bpm = this.bpm;
        this.beforeEdit = null; this.section = -1;
        if (this.song.id === "practice") {
          this.repeat = true;
          this.startPlayback();
          return;
        }
        this.saveSong();
        break;
    }
    this.render();
  }

  private handleChartImport(action: PracticeAction): void {
    const input = this.chartImport!;
    switch (action.type) {
      case "import-text": input.text = action.text; input.error = ""; break;
      case "load-scanned-chart":
        if (!global.deviceInfoSystem.isEditor()) break;
        if (SCANNED_CHART) {
          input.text = SCANNED_CHART;
          input.error = "";
        } else {
          input.error = "Open Scan Song Page on your Mac first";
        }
        break;
      case "import-bars": input.bars = Math.max(1, Math.min(4, input.bars + action.delta)); input.error = ""; break;
      case "import-meter": input.meter = action.meter; input.error = ""; break;
      case "cancel-import": this.chartImport = undefined; break;
      case "review-import": {
        const result = importChordChart(input.text, input.meter, input.bars);
        if (result.ok === false) { input.error = result.error; break; }
        if (this.song.title === "Untitled song") this.song.title = result.draft.title;
        this.song.meter = input.meter;
        this.song.sections[0].steps = result.draft.steps;
        this.cursor = 0;
        this.status = "Review the estimated beats before saving";
        this.chartImport = undefined;
        break;
      }
    }
  }

  private saveSong(): void {
    const saved = copySong(this.song);
    const index = this.savedSongs.findIndex(song => song.id === saved.id);
    if (index < 0) this.savedSongs.push(saved);
    else this.savedSongs[index] = saved;
    try {
      this.status = this.persistSongLibrary(this.savedSongs) ? "Song saved" : "Storage full · song kept for this session";
    } catch (_) {
      this.status = "Song kept for this session";
    }
    this.repeat = true;
    this.phase = "setup";
  }

  private persistSongLibrary(songs: PracticeSong[]): boolean {
    const store = global.persistentStorageSystem.store;
    const previous = store.getString(SONG_LIBRARY_KEY);
    const serialized = writeSongLibrary(songs);
    store.putString(SONG_LIBRARY_KEY, serialized);
    const limit = store.getMaxSizeInBytes();
    if (store.getString(SONG_LIBRARY_KEY) === serialized && (limit <= 0 || store.getSizeInBytes() <= limit)) return true;
    if (previous) store.putString(SONG_LIBRARY_KEY, previous); else store.remove(SONG_LIBRARY_KEY);
    return false;
  }

  private deleteSavedSong(id: string): void {
    const remaining = this.savedSongs.filter(song => song.id !== id);
    this.songToDelete = undefined;
    try {
      if (this.persistSongLibrary(remaining)) {
        this.savedSongs = remaining;
        this.savedPage = Math.min(this.savedPage, Math.max(0, Math.ceil(remaining.length / 4) - 1));
        this.beforeEdit = null;
        this.phase = "library";
        this.savedOpen = true;
        this.status = "Song deleted";
        return;
      }
    } catch (_) { /* Keep the song if the updated library cannot be saved. */ }
    this.status = "Could not delete the song. Try again.";
  }

  private melodyAvailable(): boolean {
    return !!this.melody?.available && STARTER_SONGS.some(song => song.id === this.song.id);
  }

  private render(): void {
    if (this.previewReference && !isNull(this.previewReference)) {
      this.previewReference.enabled = global.deviceInfoSystem.isEditor() && this.showReference && !this.ui.hasPreviewArtwork() &&
        (this.phase === "playing" || this.phase === "count-in" || this.phase === "placement");
    }
    this.ui.show({phase: this.phase, song: this.song, bpm: this.bpm, section: this.section,
      repeat: this.repeat, cue: this.cue, instruments: this.instruments,
      cursor: this.cursor, status: this.status, showReference: this.showReference,
      editor: {picker: this.picker !== null, chord: this.pickedChord},
      chartImport: this.chartImport,
      saved: {songs: this.savedSongs, page: this.savedPage, open: this.savedOpen, deleting: this.songToDelete},
      melody: {available: this.melodyAvailable(), enabled: this.melodyEnabled}});
  }

  private rememberPracticeLoop(): void {
    this.song.bpm = this.bpm;
    const saved = writePracticeChart(this.song);
    this.practice = copySong(this.song);
    try {
      const store = global.persistentStorageSystem.store;
      if (store.getString(PRACTICE_LOOP_KEY) !== saved) store.putString(PRACTICE_LOOP_KEY, saved);
    } catch (_) { /* The loop remains available for this session. */ }
  }

  private startPlayback(): void {
    if (this.song.id === "practice") this.rememberPracticeLoop();
    this.band?.prepare(this.song.sections.flatMap(section => section.steps.map(step => step.chord)));
    this.phase = "count-in"; this.status = ""; this.epoch = getTime();
    this.melodyPlan = this.melodyAvailable() ? melodyForSong(this.song.id, this.section, this.song.meter, this.repeat) : null;
    this.lastIndex = -1; this.lastOffbeatIndex = -1; this.dispatchCount = 0; this.run++;
    this.updatePlayback();
  }

  private stopPlayback(complete = false): void {
    this.phase = "setup"; this.clickAudio.stop(false); this.band?.stop(); this.melody?.stop();
    this.melodyPlan = null;
    this.cue = null; this.lastIndex = -1; this.dispatchCount = 0; this.beatDispatchedAt = null;
    this.status = complete ? "Finished — play again or choose a section" : "";
    this.render(); this.log(complete ? "complete" : "stopped");
  }

  private updatePlayback(): void {
    if (this.phase !== "playing" && this.phase !== "count-in") return;
    const elapsed = getTime() - this.epoch;
    const index = beatIndex(elapsed, this.bpm);
    const elapsedBeats = elapsed * this.bpm / 60;
    if (this.melodyEnabled && this.melodyPlan) this.melody?.update(this.melodyPlan, elapsedBeats);
    if (index === this.lastIndex && this.cue && this.lastOffbeatIndex !== index) {
      const fraction = elapsedBeats - index;
      if (fraction >= 0.5) {
        this.lastOffbeatIndex = index;
        // Drop a subdivision if a frame stall would place it against the next click.
        if (fraction < 0.8) this.band?.offbeat(this.cue, this.instruments);
      }
    }
    if (index <= this.lastIndex) return;
    const cue = cueForIndex(index, {song: this.song, section: this.section, repeat: this.repeat});
    if (cue.phase === "complete") { this.stopPlayback(true); return; }
    const skipped = index - this.lastIndex - 1;
    this.lastIndex = index; this.cue = cue; this.phase = cue.phase;
    this.beatDispatchedAt = getTime();
    this.clickAudio.play(1); this.dispatchCount++;
    this.band?.beat(cue, this.instruments);
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

  private setColliderDebug(root: SceneObject): void {
    const collider = root.getComponent("Physics.ColliderComponent");
    if (collider) collider.debugDrawEnabled = true;
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebug(root.getChild(i));
  }
}
