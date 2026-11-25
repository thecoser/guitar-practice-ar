import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {PracticeDriver, sceneObject} from "./GuitarPracticeDriver";
import {STARTER_SONGS} from "../Scripts/GuitarPracticeSongs";

@component
export class GuitarMvpSongsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(800);
    const driver = new PracticeDriver();
    expect(driver.state().bandAvailable).toBe(true);
    for (const song of STARTER_SONGS) {
      if (driver.state().phase !== "library") await driver.press("Library");
      await driver.press("Song-" + song.id);
      expect(driver.state().songId).toBe(song.id);
      expect(driver.state().melodyAvailable).toBe(true);
      expect(driver.state().bpm).toBe(song.bpm);
      expect(driver.state().meter).toBe(song.meter);
      await driver.press("PreviewGuitar");
      expect(driver.state().showReference).toBe(false);
      await driver.tempo(120);
      await driver.press("SelectSection1");
      expect(driver.state().section).toBe(0);
      await driver.press("SelectSection0");
      expect(driver.state().section).toBe(-1);
      await driver.press("SelectSection2");
      expect(driver.state().section).toBe(1);
      // A copy of the selected section must be editable and cancel cleanly.
      await driver.press("Edit");
      expect(driver.state().phase).toBe("editor");
      expect(driver.state().chartSteps.length).toBe(song.sections[1].steps.length);
      await driver.addChord("A", "m", true);
      await driver.press("CancelEdit");
      expect(driver.state().songId).toBe(song.id);
      expect(driver.state().section).toBe(1);
      await driver.press("Start");
      for (let i = 0; i < song.meter; i++) {
        const state = await driver.awaitBeat(i, 0.8);
        expect(state.phase).toBe("count-in");
        expect(state.beat).toBe(i + 1);
      }
      const first = await driver.awaitBeat(song.meter, 0.8);
      expect(first.current).toBe(song.sections[1].steps[0].chord);
      const lyrics = sceneObject("PlaybackLyric").getComponent("Component.Text");
      expect(lyrics.enabled).toBe(true);
      expect(lyrics.text).toBe(song.sections[1].steps[0].lyric);
      expect(first.melodyDispatchCount > 0).toBe(true);
      expect(first.melodyPlaying).toBe(true);
      expect(first.activeBandVoices > 0).toBe(true);
      expect(sceneObject("SeatedGuitarReference").enabled).toBe(false);
      expect(sceneObject("PlayerPerspectiveArtwork").enabled).toBe(false);
      const second = await driver.awaitBeat(song.meter * 2, 2.5);
      expect(second.current).toBe(song.sections[1].steps[1].chord);
      expect(lyrics.text).toBe(song.sections[1].steps[1].lyric);
      expect(second.bar).toBe(2);
      expect(second.bandDispatchCount > first.bandDispatchCount).toBe(true);
      if (song.meter === 4) expect(second.bandOffbeatDispatchCount > first.bandOffbeatDispatchCount).toBe(true);
      await driver.press("Stop");
      expect(lyrics.enabled).toBe(false);
      expect(driver.state().melodyPlaying).toBe(false);
      expect(driver.state().activeBandVoices).toBe(0);
      expect(sceneObject("SetupControls").enabled).toBe(true);
      await driver.press("PreviewGuitar");
      expect(driver.state().showReference).toBe(true);
    }
    // All band switches actually mute their instruments, while clicks continue.
    await driver.press("Bandguitar");
    await driver.press("Bandbass");
    await driver.press("Banddrums");
    await driver.press("Melody");
    const dispatched = driver.state().bandDispatchCount;
    const offbeats = driver.state().bandOffbeatDispatchCount;
    const melodyBefore = driver.state().melodyDispatchCount;
    await driver.press("Start");
    await driver.awaitBeat(5, 4);
    expect(driver.state().bandDispatchCount).toBe(dispatched);
    expect(driver.state().bandOffbeatDispatchCount).toBe(offbeats);
    expect(driver.state().melodyDispatchCount).toBe(melodyBefore);
    expect(driver.state().clickDispatchCount > 0).toBe(true);
    await driver.press("Stop");
    await driver.press("Bandkeys");
    await driver.press("Start");
    await driver.awaitBeat(4, 3);
    expect(driver.state().bandDispatchCount > dispatched).toBe(true);
    expect(driver.state().activeBandVoices > 0).toBe(true);
    expect(driver.state().melodyDispatchCount).toBe(melodyBefore);
    expect(sceneObject("PlayerPerspectiveArtwork").enabled).toBe(true);
    await driver.press("Pause");
    expect(driver.state().melodyPlaying).toBe(false);
    const pausedDispatches = driver.state().melodyDispatchCount;
    await driver.press("Melody");
    await driver.press("PausedSlower");
    await driver.press("Pause");
    await driver.awaitBeat(6, 2);
    expect(driver.state().melodyDispatchCount > pausedDispatches).toBe(true);
    await driver.press("Stop");
    expect(sceneObject("PlayerPerspectiveArtwork").enabled).toBe(true);
    expect(sceneObject("FretboardFingerGuide").enabled).toBe(false);
    await sleep(100);
    expect(driver.state().activeBandVoices).toBe(0);
  }
}
