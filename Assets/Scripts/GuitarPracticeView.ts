import type {Chord, PracticeSong} from "./GuitarPracticeSongs";
import type {Meter} from "./GuitarPracticeSongs";
import type {ChordRoot, ChordQuality} from "./GuitarChords";
import type {BeatCue} from "./GuitarChordLoopTiming";

export type PracticePhase = "library" | "setup" | "placement" | "editor" | "count-in" | "playing" | "paused";
export type AlignmentAxis = "x" | "y";
export type Instrument = "guitar" | "bass" | "keys" | "drums";
export type PracticeAction =
  | {type: "align-adjust"; axis: AlignmentAxis; delta: number}
  | {type: "align-target"; target: "chart" | "cues"}
  | {type: "align-confirm" | "align-cancel" | "align-reset"}
  | {type: "song"; id: string}
  | {type: "delete-song" | "confirm-delete-song" | "cancel-delete-song"}
  | {type: "select-section"; section: number}
  | {type: "tempo"; delta: number}
  | {type: "instrument"; instrument: Instrument}
  | {type: "melody"}
  | {type: "chord"; chord: Chord}
  | {type: "pick-root"; root: ChordRoot}
  | {type: "pick-quality"; quality: ChordQuality}
  | {type: "move-step" | "saved-page"; delta: number}
  | {type: "song-title"; title: string}
  | {type: "step-lyric"; songId: string; index: number; lyric: string}
  | {type: "import-text"; text: string}
  | {type: "import-bars"; delta: number}
  | {type: "import-meter"; meter: Meter}
  | {type: "open-import" | "cancel-import" | "review-import" | "load-scanned-chart"}
  | {type: "new-song" | "practice" | "new-loop" | "saved-library" | "change-chord" | "commit-chord" | "cancel-picker"}
  | {type: "cursor" | "duration"; delta: number}
  | {type: "library" | "start" | "pause" | "stop" | "place" | "confirm" | "reference" |
      "repeat" | "edit" | "save" | "cancel" | "append" | "remove" | "meter" | "reset"};

export interface PracticeView {
  phase: PracticePhase;
  song: PracticeSong;
  bpm: number;
  section: number;
  repeat: boolean;
  cue: BeatCue | null;
  instruments: Record<Instrument, boolean>;
  cursor: number;
  status: string;
  showReference: boolean;
  editor?: {picker: boolean; chord: Chord};
  chartImport?: {text: string; bars: number; meter: Meter; error: string};
  saved?: {songs: PracticeSong[]; page: number; open: boolean; deleting?: PracticeSong};
  melody?: {available: boolean; enabled: boolean};
}
