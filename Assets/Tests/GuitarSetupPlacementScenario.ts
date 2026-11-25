import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils";
import {LeafTwoHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor";
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {checkSetup, checkFingerGuide, checkPose, panelPose, ready, sceneObject} from "./GuitarPracticeDriver";

function fixturePose(): number[] {
  const transform = sceneObject("PlayerPerspectiveArtwork").getTransform();
  const p = transform.getWorldPosition(), r = transform.getWorldRotation(), s = transform.getWorldScale();
  return [p.x, p.y, p.z, r.x, r.y, r.z, r.w, s.x, s.y, s.z];
}

@component
export class GuitarSetupPlacementScenario extends Scenario {
  async run(): Promise<void> {
    const driver = await ready();
    const initial = driver.state();
    checkSetup(initial);
    const fixedGuitar = fixturePose();
    const fixedControls = panelPose();

    await driver.press("Place");
    expect(driver.state().phase).toBe("placement");
    expect(sceneObject("PlayerPerspectiveArtwork").enabled).toBe(true);
    expect(sceneObject("Charts").enabled).toBe(true);
    expect(sceneObject("ChartGrabHandle").enabled).toBe(true);
    expect(sceneObject("CueGrabHandle").enabled).toBe(true);
    expect(sceneObject("NextChart").enabled).toBe(true);
    await driver.press("NudgeCues");
    const marker = sceneObject("FretboardTarget0").getTransform();
    const markerStart = marker.getWorldPosition();
    await driver.press("NudgeRight");
    expect(Math.abs(marker.getWorldPosition().distance(markerStart) - 1) < 0.001).toBe(true);
    const nudgedCues = driver.state().cuePose;
    await driver.drag("CueGrabHandle", new vec3(0, 0.12, 0));
    const cues = driver.state().cuePose;
    expect(cues, "Cue drag changes the pose after nudging").not.toEqual(nudgedCues);
    expect(fixturePose()).toEqual(fixedGuitar);
    checkPose(driver.state().chartPose, initial.chartPose, "Cue placement leaves the chart in place");
    await driver.press("Confirm");
    checkSetup(driver.state());

    await driver.press("Place");
    await driver.press("GuitarReset");
    checkPose(driver.state().cuePose, initial.cuePose, "Reset restores the original cue pose");
    await driver.press("GuitarCancel");
    checkPose(driver.state().cuePose, cues, "Saved cue pose is preserved");

    await driver.press("Place");
    expect(driver.state().phase).toBe("placement");
    const before = driver.state().chartPose;
    await driver.drag("ChartGrabHandle", new vec3(0.12, 0, 0));
    expect(driver.state().chartPose, "Chart drag changes the pose").not.toEqual(before);
    const handle = findInteractablesByName("ChartGrabHandle", undefined, true)[0];
    const beforeTwoHands = driver.state().chartPose!;
    await LeafTwoHandInteractor.get().drag(handle,
      new vec3(5, 3, 0), new vec3(-5, -3, 0), 750);
    const afterTwoHands = driver.state().chartPose!;
    expect(afterTwoHands.scalePercent, "Two-hand drag changes chart size").not.toBe(beforeTwoHands.scalePercent);
    expect(afterTwoHands.rotation, "Two-hand drag changes chart angle").not.toEqual(beforeTwoHands.rotation);
    expect(afterTwoHands.scalePercent >= 80 && afterTwoHands.scalePercent <= 125).toBe(true);
    const originalRotation = initial.chartPose!.rotation;
    const currentRotation = afterTwoHands.rotation;
    const angle = quat.angleBetween(new quat(originalRotation[3], originalRotation[0], originalRotation[1], originalRotation[2]),
      new quat(currentRotation[3], currentRotation[0], currentRotation[1], currentRotation[2]));
    expect(angle <= Math.PI / 9 + 0.001).toBe(true);
    await driver.press("NudgeUp");
    await driver.press("Confirm");
    const chart = driver.state().chartPose;
    const chartTransform = sceneObject("Charts").getTransform();
    const setupChartPosition = new vec3(initial.chartPose!.position[0],
      initial.chartPose!.position[1], initial.chartPose!.position[2]);
    expect(chartTransform.getWorldPosition().distance(setupChartPosition) < 0.001).toBe(true);
    checkPose(driver.state().cuePose, cues, "Saved cue pose is preserved");
    expect(fixturePose()).toEqual(fixedGuitar);
    expect(panelPose()).toEqual(fixedControls);

    await driver.press("Start");
    await driver.awaitBeat(4, 5);
    checkFingerGuide("Em");
    expect(sceneObject("Legend").getComponent("Component.Text").enabled).toBe(false);
    const placedChartPosition = new vec3(chart!.position[0], chart!.position[1], chart!.position[2]);
    expect(chartTransform.getWorldPosition().distance(placedChartPosition) < 0.001).toBe(true);
    checkPose(driver.state().cuePose, cues, "Saved cue pose is preserved");
    checkPose(driver.state().chartPose, chart, "Playback preserves the saved chart pose");
    await driver.press("Stop");
    checkSetup(driver.state());
    expect(chartTransform.getWorldPosition().distance(setupChartPosition) < 0.001).toBe(true);
    // Return the visible Preview to normal placement after exercising extreme gestures.
    await driver.press("Place");
    await driver.press("GuitarReset");
    await driver.press("Confirm");
    checkPose(driver.state().chartPose, initial.chartPose, "Reset restores the original chart pose");
  }
}
