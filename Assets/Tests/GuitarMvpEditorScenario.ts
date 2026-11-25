import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {PracticeDriver, sceneObject} from "./GuitarPracticeDriver";
import {LEGACY_CHART_KEY, PRACTICE_LOOP_KEY, readPracticeLoop, readSongLibrary, SONG_LIBRARY_KEY} from "../Scripts/GuitarPracticeSongs";
import {GuitarChordLoop} from "../Scripts/GuitarChordLoop";

@component
export class GuitarMvpEditorScenario extends Scenario {
  async run(): Promise<void> {
    const store = global.persistentStorageSystem.store;
    const prior = store.getString(SONG_LIBRARY_KEY);
    const legacy = store.getString(LEGACY_CHART_KEY);
    const priorPractice = store.getString(PRACTICE_LOOP_KEY);
    try {
      await sleep(800);
      const driver = new PracticeDriver();
      await driver.press("AddMyOwn");
      expect(driver.state().phase).toBe("editor");
      expect(driver.state().chartSteps.length).toBe(0);
      await driver.press("ImportChart");
      await driver.press("ImportThree");
      await driver.press("ReviewImport");
      expect(sceneObject("ChartImport").enabled).toBe(true);
      // Preview automation cannot paste into the native keyboard. Deliver its Done action.
      const controller = sceneObject("GuitarChordLoop").getComponent(GuitarChordLoop.getTypeName());
      controller!["handle"]({type: "import-text", text: "{title: Import test}\n[Bbmaj7]First phrase [F#m7]Second phrase"});
      await driver.press("ReviewImport");
      expect(sceneObject("ChartImport").enabled).toBe(false);
      expect(driver.state().chartSteps).toEqual([
        {chord: "Bbmaj7", beats: 3, lyric: "First phrase"}, {chord: "F#m7", beats: 3, lyric: "Second phrase"}
      ]);
      expect(store.getString(SONG_LIBRARY_KEY)).toBe(prior);
      await driver.press("Longer");
      await driver.press("SaveChart");
      const songId = driver.state().songId;
      const songs = readSongLibrary(store.getString(SONG_LIBRARY_KEY), legacy);
      const savedIndex = songs.findIndex(song => song.id === songId);
      expect(savedIndex >= 0).toBe(true);
      expect(songs[savedIndex].sections[0].steps).toEqual([
        {chord: "Bbmaj7", beats: 4, lyric: "First phrase"}, {chord: "F#m7", beats: 3, lyric: "Second phrase"}
      ]);
      await driver.press("Library");
      await driver.press("MySongs");
      for (let page = 0; page < Math.floor(savedIndex / 4); page++) await driver.press("SavedNext");
      await driver.press("SavedSong" + savedIndex % 4);
      expect(driver.state().songId).toBe(songId);
      await driver.press("Edit");
      await driver.press("Remove");
      await driver.press("CancelEdit");
      expect(driver.state().chartSteps.length).toBe(2);

      await driver.press("Library");
      await driver.press("Song-amazing-grace");
      await driver.press("Edit");
      expect(driver.state().chartSteps[0].lyric).toBe("Amazing");
      expect(sceneObject("EditLyric").enabled).toBe(true);
      await driver.press("SaveChart");
      const withLyrics = readSongLibrary(store.getString(SONG_LIBRARY_KEY), legacy);
      expect(withLyrics.find(song => song.id === driver.state().songId)?.sections[0].steps[0].lyric).toBe("Amazing");
      await driver.press("Start");
      expect((await driver.awaitBeat(3, 4)).lyric).toBe("Amazing");
      expect(sceneObject("PlaybackLyric").getComponent("Component.Text").text).toBe("Amazing");
      await driver.press("Stop");

      await driver.press("Library");
      await driver.press("ChordPractice");
      if (driver.state().chartSteps.length) await driver.press("NewLoop");
      expect(driver.state().chartSteps.length).toBe(0);
      expect(sceneObject("SaveChart").enabled).toBe(false);
      await driver.addChord("F", "sus4");
      await sleep(100); // UIKit lays out the newly visible button on an update.
      const x = (name: string) => sceneObject(name).getTransform().getLocalPosition().x;
      expect(x("Meter") - x("DraftFaster") >= 9, "Meter is beside the tempo controls").toBe(true);
      expect(x("SaveChart") - x("CancelEdit") >= 10, "Play loop is separate from Cancel").toBe(true);
      await driver.press("Shorter");
      await driver.addChord("Bb");
      await driver.press("Shorter");
      await driver.press("DraftFaster");
      await driver.press("SaveChart");
      const first = await driver.awaitBeat(4, 5);
      expect(first.current).toBe("Fsus4");
      expect(first.activeBandVoices > 0).toBe(true);
      expect(sceneObject("Chord guitar 5").getComponent("Component.AudioComponent").isPlaying()).toBe(true);
      expect((await driver.awaitBeat(5, 1.5)).current).toBe("Bb");
      const loop = await driver.awaitBeat(6, 1.5);
      expect(loop.current).toBe("Fsus4");
      expect(loop.cycle).toBe(1);
      await driver.press("Stop");
      expect(driver.state().activeBandVoices).toBe(0);
      const saved = store.getString(PRACTICE_LOOP_KEY);
      expect(readPracticeLoop(saved).sections[0].steps).toEqual([{chord: "Fsus4", beats: 1}, {chord: "Bb", beats: 1}]);
      expect(readPracticeLoop(saved).bpm).toBe(65);
      await driver.press("Edit");
      expect(driver.state().chartSteps.length).toBe(2);
      await driver.press("NewLoop");
      expect(driver.state().chartSteps.length).toBe(0);
      expect(sceneObject("SaveChart").enabled).toBe(false);
      expect(store.getString(PRACTICE_LOOP_KEY)).toBe(saved);
      await driver.press("CancelEdit");
      await driver.press("Library");
      await driver.press("ChordPractice");
      expect(driver.state().chartSteps.length).toBe(2);
      expect(driver.state().bpm).toBe(65);
      expect(readSongLibrary(store.getString(SONG_LIBRARY_KEY), legacy).length).toBe(withLyrics.length);

      await driver.press("CancelEdit");
      await driver.press("MySongs");
      for (let page = 0; page < Math.floor(savedIndex / 4); page++) await driver.press("SavedNext");
      await driver.press("SavedSong" + savedIndex % 4);
      await driver.press("Edit");
      expect(sceneObject("DeleteSong").getParent().name).toBe("SaveActions");
      expect(sceneObject("Meter").getParent().name).toBe("SongInfo");
      const beforeDelete = store.getString(SONG_LIBRARY_KEY);
      await driver.press("DeleteSong");
      expect(sceneObject("DeleteSongConfirmation").enabled).toBe(true);
      expect(sceneObject("SongSubtitle").getComponent("Component.Text").text).toBe("Import test");
      await driver.press("CancelDeleteSong");
      expect(store.getString(SONG_LIBRARY_KEY)).toBe(beforeDelete);
      await driver.press("DeleteSong");
      await driver.press("ConfirmDeleteSong");
      expect(readSongLibrary(store.getString(SONG_LIBRARY_KEY), legacy)).toEqual(withLyrics.filter(song => song.id !== songId));
      expect(store.getString(PRACTICE_LOOP_KEY)).toBe(saved);
    } finally {
      if (prior) store.putString(SONG_LIBRARY_KEY, prior); else store.remove(SONG_LIBRARY_KEY);
      if (priorPractice) store.putString(PRACTICE_LOOP_KEY, priorPractice); else store.remove(PRACTICE_LOOP_KEY);
    }
  }
}
