import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, next) {
  if (specifier.startsWith('./') && !/\.[a-z]+$/i.test(specifier)) specifier += '.ts';
  return next(specifier, context);
}});
const {STARTER_SONGS, newPracticeChart, readPracticeChart, writePracticeChart} =
  await import('../Scripts/GuitarPracticeSongs.ts');
const {cueForIndex, beatIndex} = await import('../Scripts/GuitarChordLoopTiming.ts');

// Every song/section has an exact count-in, finite ending and seamless repeat.
for (const song of STARTER_SONGS) {
  for (let section = -1; section < song.sections.length; section++) {
    const sections = section < 0 ? song.sections : [song.sections[section]];
    const total = sections.flatMap(s => s.steps).reduce((n, s) => n + s.beats, 0);
    const plan = {song, section, repeat: false};
    for (let i = 0; i < song.meter; i++) {
      assert.equal(cueForIndex(i, plan).phase, 'count-in');
      assert.equal(cueForIndex(i, plan).beat, i + 1);
    }
    assert.equal(cueForIndex(song.meter, plan).current, sections[0].steps[0].chord);
    for (let i = 0; i < total; i++) {
      const cue = cueForIndex(song.meter + i, plan);
      assert.equal(cue.phase, 'playing');
      assert.equal(cue.beat, i % song.meter + 1);
      assert.ok(cue.chordBeat >= 1 && cue.chordBeat <= cue.chordBeats);
    }
    assert.equal(cueForIndex(song.meter + total - 1, plan).next, null);
    assert.equal(cueForIndex(song.meter + total, plan).phase, 'complete');
    const loop = cueForIndex(song.meter + total, {...plan, repeat: true});
    assert.equal(loop.cycle, 1);
    assert.equal(loop.current, sections[0].steps[0].chord);
    assert.equal(loop.beat, 1);
  }
}

// Chord durations can cross bar lines; musical beat and chord beat differ.
const custom = newPracticeChart();
custom.sections[0].steps = [{chord: 'Am', beats: 2}, {chord: 'D7', beats: 5}];
const plan = {song: custom, section: -1, repeat: true};
assert.equal(cueForIndex(5, plan).changeNext, true);
assert.equal(cueForIndex(6, plan).current, 'D7');
assert.equal(cueForIndex(6, plan).beat, 3);
assert.equal(cueForIndex(8, plan).beat, 1);
assert.equal(cueForIndex(8, plan).chordBeat, 3);
assert.equal(cueForIndex(11, plan).current, 'Am');
assert.equal(beatIndex(60, 45), 45);
assert.equal(beatIndex(60, 120), 120);
assert.equal(beatIndex(-1, 60), 0);

// Validation rejects malformed/excessive charts, and drops unsupported fields.
const valid = JSON.parse(writePracticeChart(custom));
assert.deepEqual(readPracticeChart(JSON.stringify(valid)), custom);
for (const value of [null, {}, {...valid, steps: []}, {...valid, meter: 6},
  {...valid, bpm: 0}, {...valid, steps: Array(97).fill({chord:'G', beats:4})},
  {...valid, steps:[{chord:'Lyrics', beats:4}]},
  {...valid, steps:[{chord:'G', beats:1.5}]},
  {...valid, steps:[{chord:'G', beats:0}]}]) {
  assert.deepEqual(readPracticeChart(JSON.stringify(value)), newPracticeChart());
}
assert.deepEqual(readPracticeChart('{broken'), newPracticeChart());
const sanitized = readPracticeChart(JSON.stringify({...valid, lyrics:'not retained',
  url:'not retained', steps: [{chord:'G', beats:4, text:'not retained'}]}));
assert.ok(!writePracticeChart(sanitized).includes('retained'));
console.log('PASS: all starter-song timelines, section repeats, endings, mixed durations and private chart validation');

// Compare lookahead against a beat-by-beat musical timeline, not step boundaries.
const repeated = newPracticeChart();
repeated.sections[0].steps = [{chord:'G', beats:2}, {chord:'G', beats:3},
  {chord:'C', beats:1}, {chord:'G', beats:2}];
const single = newPracticeChart();
single.sections[0].steps = [{chord:'Em', beats:3}, {chord:'Em', beats:2}];
for (const song of [...STARTER_SONGS, repeated, single]) {
  for (let section = -1; section < song.sections.length; section++) {
    const beats = song.sections.filter((_, i) => section < 0 || section === i)
      .flatMap(s => s.steps.flatMap(step => Array(step.beats).fill(step.chord)));
    for (const repeat of [false, true]) {
      for (let at = 0; at < beats.length; at++) {
        const future = repeat ? [...beats.slice(at + 1), ...beats.slice(0, at + 1)] : beats.slice(at + 1);
        const distance = future.findIndex(chord => chord !== beats[at]);
        const cue = cueForIndex(song.meter + at, {song, section, repeat});
        assert.equal(cue.current, beats[at]);
        assert.equal(cue.next, distance < 0 ? null : future[distance]);
        assert.equal(cue.beatsUntilChange, distance < 0 ? null : distance + 1);
        assert.equal(cue.changeNext, distance === 0);
        assert.equal(cue.beatsRemaining, beats.length - at);
      }
    }
  }
}
console.log('PASS: chord-change countdowns across repeated bars, sections, loop boundaries and single-chord endings');

// Independently verify chord pitches in standard tuning, including open/muted strings.
const {FINGERINGS, fingeringFor, fingerTargets, previewFingerPoint} = await import('../Scripts/GuitarFingerings.ts');
const tuning = [40, 45, 50, 55, 59, 64];
const pitches = {Em:[4,7,11], G:[2,7,11], C:[0,4,7], D:[2,6,9],
  Am:[0,4,9], A:[1,4,9], D7:[0,2,6,9]};
for (const chord of Object.keys(pitches)) {
  const marks = FINGERINGS[chord];
  const sounding = marks.flatMap((mark, string) => mark === 'X' ? [] :
    [(tuning[string] + (mark === 'O' ? 0 : mark[0])) % 12]);
  assert.deepEqual([...new Set(sounding)].sort((a,b)=>a-b), pitches[chord]);
  const targets = fingerTargets(chord);
  assert.equal(new Set(targets.map(t=>t.finger)).size, targets.length);
  for (const t of targets) {
    const p = previewFingerPoint(t.string, t.fret);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.x > -23 && p.x < -15 && p.y > 1 && p.y < 6);
  }
}
for (let fret=1; fret<=3; fret++) {
  for (let string=0; string<5; string++) {
    assert.ok(previewFingerPoint(string, fret).y > previewFingerPoint(string+1, fret).y);
  }
}
for (const invalid of [[-1,1],[6,1],[0,0],[0,4],[0,1.5]]) {
  assert.throws(()=>previewFingerPoint(...invalid));
}
console.log('PASS: seven standard-tuning chord pitch sets and Preview fretboard target bounds');

const {melodyForSong, melodyNoteAt} = await import('../Scripts/GuitarMelodyScore.ts');
const openingPitches = [[67, 74], [67, 74], [67, 74]];
for (const [songIndex, song] of STARTER_SONGS.entries()) {
  for (let section = -1; section < song.sections.length; section++) {
    for (const repeat of [false, true]) {
      const plan = melodyForSong(song.id, section, song.meter, repeat);
      const sections = section < 0 ? song.sections : [song.sections[section]];
      const beats = sections.flatMap(item => item.steps).reduce((sum, step) => sum + step.beats, 0);
      assert.equal(plan.duration, beats * 2);
      assert.equal(melodyNoteAt(plan, 0), null);
      const opening = melodyNoteAt(plan, song.meter);
      assert.equal(opening.pitch, openingPitches[songIndex][Math.max(0, section)]);
      for (const [index, note] of plan.notes.entries()) {
        const previous = plan.notes[index - 1];
        assert.ok(note.end > note.start && note.end <= plan.countIn + plan.duration);
        assert.ok(!previous || previous.end <= note.start);
      }
      const after = melodyNoteAt(plan, song.meter + beats);
      assert.deepEqual(after, repeat ? {...opening, start: opening.start + plan.duration} : null);
    }
  }
}
assert.equal(melodyForSong('my-chart', -1, 4, true), null);
console.log('PASS: traditional melody timing, pickups, sections, looping and finite endings');

const {practiceGroove} = await import('../Scripts/GuitarPracticeBand.ts');
const pulse = {...cueForIndex(4), phase: 'playing', meter: 4, bar: 1,
  current: 'G', next: 'C', beat: 1, chordBeat: 1, changeNext: false};
assert.deepEqual(practiceGroove(pulse, false), {guitar: 'accent', bass: 'G'});
assert.deepEqual(practiceGroove({...pulse, beat: 2, chordBeat: 2}, false), {guitar: 'down', bass: null});
assert.deepEqual(practiceGroove({...pulse, beat: 2}, true), {guitar: 'up', bass: null});
assert.deepEqual(practiceGroove({...pulse, beat: 3, chordBeat: 3}, false), {guitar: 'down', bass: 'D'});
assert.deepEqual(practiceGroove({...pulse, bar: 2, beat: 4, changeNext: true}, true), {guitar: 'up', bass: 'C'});
assert.deepEqual(practiceGroove({...pulse, meter: 3, beat: 2}, true), {guitar: null, bass: null});
assert.deepEqual(practiceGroove({...pulse, meter: 3, bar: 2, beat: 2}, true), {guitar: 'up', bass: null});
assert.deepEqual(practiceGroove({...pulse, phase: 'count-in'}, true), {guitar: null, bass: null});
console.log('PASS: backing accents, upstrokes, bass alternates, pickups and count-in');

const {CHORD_ROOTS, CHORD_QUALITIES, CHORD_INTERVALS, isChord} = await import('../Scripts/GuitarChords.ts');
for (const [rootPitch, root] of CHORD_ROOTS.entries()) {
  for (const quality of CHORD_QUALITIES) {
    const chord = root + quality;
    assert.ok(isChord(chord));
    const marks = fingeringFor(chord);
    const sounding = marks.flatMap((mark, string) => mark === 'X' ? [] :
      [(tuning[string] + (mark === 'O' ? 0 : mark[0])) % 12]);
    const expected = CHORD_INTERVALS[quality].map(interval => (rootPitch + interval) % 12);
    assert.deepEqual([...new Set(sounding)].sort(), [...new Set(expected)].sort(), chord);
    assert.ok(fingerTargets(chord).every(note => note.finger <= 4), chord);
  }
}
const {readSongLibrary, writeSongLibrary} = await import('../Scripts/GuitarPracticeSongs.ts');
const expanded = {...custom, id: 'custom-7', title: 'Saturday practice', sections: [
  {name: 'My sequence', steps: [{chord: 'F#m7', beats: 3}, {chord: 'Bbmaj7', beats: 1}]}
]};
assert.deepEqual(readSongLibrary(writeSongLibrary([expanded]), ''), [expanded]);
assert.equal(readSongLibrary('', writePracticeChart(custom))[0].id, 'custom-1');
assert.deepEqual(readSongLibrary('', ''), []);
assert.deepEqual(readSongLibrary(writeSongLibrary([]), writePracticeChart(custom)), []);
console.log('PASS: all 120 chord voicings and named song storage with legacy migration');

const {newPracticeLoop, readPracticeLoop} = await import('../Scripts/GuitarPracticeSongs.ts');
const loopDraft = newPracticeLoop();
assert.equal(loopDraft.sections[0].steps.length, 0);
assert.deepEqual(readPracticeLoop('{broken'), loopDraft);
loopDraft.bpm = 85;
loopDraft.meter = 3;
loopDraft.sections[0].steps = [{chord: 'Bbmaj7', beats: 3}, {chord: 'Fsus4', beats: 2}];
assert.deepEqual(readPracticeLoop(writePracticeChart(loopDraft)), loopDraft);
console.log('PASS: last practice loop round-trips its meter, tempo, chords and durations');

const {cleanLyric} = await import('../Scripts/GuitarPracticeSongs.ts');
for (const song of STARTER_SONGS) {
  for (const [section, part] of song.sections.entries()) {
    const plan = {song, section, repeat: true};
    assert.equal(cueForIndex(0, plan).lyric, '');
    assert.equal(cueForIndex(song.meter - 1, plan).lyric, part.pickupLyric ?? '');
    let beat = song.meter;
    for (const step of part.steps) {
      assert.ok(step.lyric, song.title + ' lyric cue missing');
      assert.equal(cueForIndex(beat, plan).lyric, step.lyric);
      beat += step.beats;
    }
    assert.equal(cueForIndex(beat, plan).lyric, part.steps[0].lyric);
    assert.equal(cueForIndex(beat, {...plan, repeat: false}).lyric, '');
  }
}

const lyricSong = {...expanded, sections: [{name: 'My sequence', steps: [
  {chord: 'G', beats: 2, lyric: 'First phrase'}, {chord: 'G', beats: 3, lyric: 'Second phrase'},
  {chord: 'D', beats: 1}
]}]};
assert.deepEqual(readSongLibrary(writeSongLibrary([lyricSong]), ''), [lyricSong]);
assert.equal(cueForIndex(lyricSong.meter + 2, {song: lyricSong, section: -1, repeat: false}).lyric, 'Second phrase');
assert.equal(readPracticeLoop(writePracticeChart(lyricSong)).sections[0].steps[0].lyric, undefined);
assert.equal(cleanLyric('  One\n\tline  '), 'One line');
assert.equal(Array.from(cleanLyric('é'.repeat(80))).length, 72);
console.log('PASS: starter lyric pickups, section timing, repeats and custom lyric storage');

const {importChordChart} = await import('../Scripts/GuitarChartImport.ts');
assert.deepEqual(importChordChart('{title: Road song}\n[G]Walk along [C]the lane; [D]Come home', 4, 2), {
  ok: true, draft: {title: 'Road song', steps: [
    {chord: 'G', beats: 4, lyric: 'Walk along'}, {chord: 'C', beats: 4, lyric: 'the lane'},
    {chord: 'D', beats: 8, lyric: 'Come home'}
  ]}
});
assert.deepEqual(importChordChart('Morning walk\nG        D\nWalk to  the road', 3, 2), {
  ok: true, draft: {title: 'Morning walk', steps: [
    {chord: 'G', beats: 3, lyric: 'Walk to'}, {chord: 'D', beats: 3, lyric: 'the road'}
  ]}
});
assert.deepEqual(importChordChart('[D♭m]Hold', 4, 3).draft.steps, [
  {chord: 'C#m', beats: 8, lyric: 'Hold'}, {chord: 'C#m', beats: 4, lyric: 'Hold'}
]);
assert.match(importChordChart('[G/B]Words', 4, 2).error, /unsupported chord: G\/B/);
assert.match(importChordChart('[G][C][D][Am]Words', 3, 1).error, /more chords than beats/);
assert.match(importChordChart(Array(97).fill('[G]Line').join('\n'), 4, 1).error, /96 chord steps/);
assert.equal(importChordChart('Words only', 4, 2).ok, false);
console.log('PASS: line-based chart import, chord alignment, meter, and validation');
