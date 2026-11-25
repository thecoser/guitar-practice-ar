import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {sleep} from "Leaf.lspkg/Utils/common/Utils";
import {checkCountIn, checkPose, checkSetup, panelPose, ready} from "./GuitarPracticeDriver";

@component
export class GuitarStopRestartScenario extends Scenario {
  async run(): Promise<void> {
    const driver = await ready();
    checkSetup(driver.state());
    await driver.tempo(45);
    await driver.press("Start");
    const firstRun = await driver.awaitBeat(4, 6);
    // Pausing holds the musical position and silences every instrument.
    await driver.press("Pause");
    const paused = driver.state();
    expect(paused.phase).toBe("paused");
    expect(paused.activeBandVoices).toBe(0);
    await sleep(1600);
    expect(driver.state()).toEqual(paused);
    await driver.press("PausedSlower");
    expect(driver.state().bpm).toBe(40);
    expect(driver.state().absoluteBeat).toBe(paused.absoluteBeat);
    await driver.press("Pause");
    expect(driver.state().phase).toBe("playing");
    expect(driver.state().clickDispatchCount).toBe(paused.clickDispatchCount);
    const resumed = await driver.awaitBeat(paused.absoluteBeat + 1, 1.8);
    expect(resumed.clickDispatchCount).toBe(paused.clickDispatchCount + 1);
    const poseBeforeStop = panelPose();
    await driver.press("Stop");

    const stopped = driver.state();
    checkSetup(stopped);
    expect(stopped.bpm).toBe(40);
    expect(stopped.run).toBe(firstRun.run);
    expect(panelPose()).toEqual(poseBeforeStop);
    await sleep(1500);
    expect(driver.state()).toEqual(stopped);
    expect(panelPose()).toEqual(poseBeforeStop);

    await driver.tempo(60);
    await driver.press("Place");
    await driver.press("NudgeUp");
    await driver.press("Confirm");
    const newPose = driver.state().chartPose;
    await driver.press("Start");
    for (let index = 0; index < 4; index += 1) {
      const state = await driver.awaitBeat(index, 1.35);
      expect(state.bpm).toBe(60);
      expect(state.run).toBe(firstRun.run + 1);
      expect(state.phase).toBe("count-in");
      expect(state.clickDispatchCount).toBe(index + 1);
      checkCountIn(index + 1);
      checkPose(driver.state().chartPose, newPose, "Restart preserves placed chart");
    }
    await driver.press("Pause");
    const pausedCountIn = driver.state();
    expect(pausedCountIn.phase).toBe("paused");
    await sleep(1200);
    expect(driver.state()).toEqual(pausedCountIn);
    await driver.press("Pause");
    expect(driver.state().phase).toBe("count-in");
    await driver.awaitBeat(4, 1.35);
    await driver.press("Pause");
    await driver.press("Stop");
    checkSetup(driver.state());
  }
}
