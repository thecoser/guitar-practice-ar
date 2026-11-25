// Wordless practice arrangements of the traditional tunes, in G.
// Each bar lists note names and durations in eighth notes. "_" is a rest.
const PITCHES: Record<string, number> = {D: 62, E: 64, F: 66, G: 67, A: 69, B: 71, c: 72, d: 74, e: 76, g: 79};

type SectionScore = {pickup: string; bars: string[]};
type MelodyNote = {pitch: number; start: number; end: number};

const rangeEnding = [
  "G2 A2 B2", "B4 G1 F1", "E2 c1 c1 c2", "c4 c1 c1",
  "B2 A2 G2", "F2 G2 A2", "G6", "G4 _2"
];

const SCORES: Record<string, SectionScore[]> = {
  "amazing-grace": [
    {pickup: "D2", bars: [
      "G4 B1 G1", "B4 A2", "G4 E2", "D4 D2",
      "G4 B1 G1", "B4 A2", "d6", "d4 B2"
    ]},
    {pickup: "B2", bars: [
      "d4 B1 G1", "B4 A2", "G4 E2", "D4 D2",
      "G4 B1 G1", "B4 A2", "G6", "G4 _2"
    ]}
  ],
  "home-on-the-range": [
    {pickup: "D1 D1", bars: [
      "G2 A2 B2", "B4 G1 F1", "E2 c1 c1 c2", "c4 B1 c1",
      "d2 G2 G2", "G2 F2 G2", "A6", "A3 D1 D1 D1",
      ...rangeEnding
    ]},
    {pickup: "", bars: [
      "d6", "c2 B2 A2", "B6", "B4 D1 D1",
      "G2 G2 G2", "G2 F2 G2", "A6", "A3 D1 D1 D1",
      ...rangeEnding
    ]}
  ],
  "auld-lang-syne": [
    {pickup: "D2", bars: [
      "G3 G1 G2 B2", "A3 G1 A2 B2", "G3 G1 B2 d2", "e6 e2",
      "d3 B1 B2 G2", "A3 G1 A2 B1 A1", "G3 E1 E2 D2", "G6 _2"
    ]},
    {pickup: "e2", bars: [
      "d3 B1 B2 G2", "A3 G1 A2 e2", "d3 B1 B2 d2", "e6 g2",
      "d3 B1 B2 G2", "A3 G1 A2 B1 A1", "G3 E1 E2 D2", "G6 _2"
    ]}
  ]
};

function noteEvents(phrase: string, start: number): MelodyNote[] {
  let tick = start;
  return phrase.split(" ").filter(Boolean).map(token => {
    const end = tick + Number(token.slice(1));
    const note = {pitch: PITCHES[token[0]] ?? 0, start: tick, end};
    tick = end;
    return note;
  });
}

export function melodyForSong(id: string, section: number, meter: number, repeat: boolean) {
  const score = SCORES[id];
  if (!score) return null;
  const selected = section < 0 ? score : [score[section]];
  const ticksPerBar = meter * 2;
  const countIn = ticksPerBar;
  const pickup = (item: SectionScore, end: number) => {
    const notes = noteEvents(item.pickup, 0);
    const length = notes[notes.length - 1]?.end ?? 0;
    return notes.map(note => ({...note, start: note.start + end - length, end: note.end + end - length}));
  };
  const events = pickup(selected[0], countIn);
  let tick = countIn;
  for (let index = 0; index < selected.length; index++) {
    const current = selected[index];
    const next = selected[index + 1] ?? (repeat ? selected[0] : null);
    for (let bar = 0; bar < current.bars.length; bar++) {
      let notes = noteEvents(current.bars[bar], tick);
      // Put the next section’s pickup at the end of the final bar.
      if (bar === current.bars.length - 1 && next) {
        const join = pickup(next, tick + ticksPerBar);
        if (join.length) {
          notes = notes.filter(note => note.start < join[0].start)
            .map(note => ({...note, end: Math.min(note.end, join[0].start)}));
          notes.push(...join);
        }
      }
      events.push(...notes);
      tick += ticksPerBar;
    }
  }
  return {notes: events.filter(note => note.pitch > 0), countIn, duration: tick - countIn, repeat};
}

export function melodyNoteAt(plan: NonNullable<ReturnType<typeof melodyForSong>>, elapsedBeats: number) {
  const tick = elapsedBeats * 2;
  if (!plan.repeat && tick >= plan.countIn + plan.duration) return null;
  const cycle = tick < plan.countIn ? 0 : Math.floor((tick - plan.countIn) / plan.duration);
  const currentTick = tick - cycle * plan.duration;
  const note = plan.notes.find(item => currentTick >= item.start && currentTick < item.end);
  return note ? {pitch: note.pitch, start: note.start + cycle * plan.duration} : null;
}
