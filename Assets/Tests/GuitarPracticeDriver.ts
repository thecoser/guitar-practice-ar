// Exercises the authored UIKit controls and checks the live drill and chart states.
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils";
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils";
import {GuitarChordLoop} from "../Scripts/GuitarChordLoop";

import {Chord as PracticeChord} from "../Scripts/GuitarPracticeSongs";
import {SONG_LIBRARY_KEY} from "../Scripts/GuitarPracticeSongs";
import {fingerTargets, previewFingerPoint} from "../Scripts/GuitarFingerings";

type PracticeState = ReturnType<GuitarChordLoop["getPracticeState"]>;
type ChartName = "NowChart" | "NextChart";
type Chord = "Em" | "G" | "C" | "D";

const STRINGS = ["E", "A", "D", "G", "B", "e"];
const CHORD_ORDER: Chord[] = ["Em", "G", "C", "D"];
// Finger order follows the chart's low E to high e reading direction.
const NOTATION: Record<Chord, {strings: string[]; fingers: string[]}> = {
  Em: {strings: ["O", "", "", "O", "O", "O"], fingers: ["2", "3", ""]},
  G: {strings: ["", "", "O", "O", "O", ""], fingers: ["2", "1", "3"]},
  C: {strings: ["X", "", "", "O", "", "O"], fingers: ["3", "2", "1"]},
  D: {strings: ["X", "X", "O", "", "", ""], fingers: ["1", "3", "2"]},
};

export function sceneObject(name: string): SceneObject {
  const object = findSceneObjectByName(name);
  if (!object) throw new Error("Scene object not found: " + name);
  return object;
}

function child(parent: SceneObject, name: string): SceneObject {
  for (let i = 0; i < parent.getChildrenCount(); i += 1) {
    const object = parent.getChild(i);
    if (object.name === name) return object;
  }
  throw new Error("Chart object not found: " + parent.name + "/" + name);
}

function textOn(object: SceneObject): Text {
  const label = object.getComponent("Component.Text");
  if (!label) throw new Error("Text component not found: " + object.name);
  return label;
}

function diagram(name: ChartName): SceneObject {
  return child(sceneObject(name), "Diagram");
}

function checkDiagram(name: ChartName, chord: Chord): void {
  const chart = diagram(name);
  const title = name === "NowChart" ? "Now" : "Next";
  expect(textOn(child(chart, "Chord")).text).toBe(title + "  " + chord);
  STRINGS.forEach((string, index) => {
    const suffix = (index + 1) + " " + string;
    expect(textOn(child(chart, "String name " + suffix)).text).toBe(string);
    expect(textOn(child(chart, "String state " + suffix)).text).toBe(NOTATION[chord].strings[index]);
  });
  NOTATION[chord].fingers.forEach((digit, index) => {
    expect(textOn(child(chart, "Finger " + (index + 1))).text).toBe(digit);
  });
}

export function checkFingerGuide(chord: PracticeChord): void {
  expect(sceneObject("PlayerPerspectiveArtwork").enabled).toBe(true);
  const expected = fingerTargets(chord).sort((a, b) => a.finger - b.finger);
  for (let i = 0; i < 3; i++) {
    const target = sceneObject("FretboardTarget" + i);
    expect(target.enabled).toBe(i < expected.length);
    if (i >= expected.length) continue;
    expect(textOn(sceneObject("FretboardFinger" + i)).text).toBe(String(expected[i].finger));
    const p = target.getTransform().getLocalPosition();
    const desired = previewFingerPoint(expected[i].string, expected[i].fret);
    expect(Math.abs(p.x - desired.x) < 0.001 && Math.abs(p.y - desired.y) < 0.001).toBe(true);
  }
}

type PlacementPose = {position: number[]; rotation: number[]; scale: number[]};

export function checkPose(actual: PlacementPose | null, expected: PlacementPose | null, message: string): void {
  expect(actual !== null && expected !== null && (["position", "rotation", "scale"] as const)
    .every(key => actual[key].every((value, index) => Math.abs(value - expected[key][index]) < 0.001)), message).toBe(true);
}

export function panelPose() {
  const transform = sceneObject("ChordPanelRoot").getTransform();
  const p = transform.getWorldPosition();
  const r = transform.getWorldRotation();
  return {position: [p.x, p.y, p.z], rotation: [r.x, r.y, r.z, r.w]};
}

export class PracticeDriver {
  private readonly interactor = new DefaultLeafInteractor();

  async drag(name: string, direction: vec3): Promise<void> {
    const target = findInteractablesByName(name, undefined, true)[0];
    if (!target) throw new Error("Enabled grab handle not found: " + name);
    await this.interactor.drag(target, direction, 400);
  }

  async press(name: string): Promise<void> {
    const target = findInteractablesByName(name, undefined, true)[0];
    if (!target) throw new Error("Enabled UIKit control not found: " + name);
    await this.interactor.trigger(target);
  }

  async addChord(root: string, quality = "", change = false): Promise<void> {
    await this.press(change ? "ChangeChord" : "Append");
    if (root !== "C" || change) await this.press("Root-" + root);
    if (quality || change) await this.press("Quality-" + quality);
    await this.press("UseChord");
  }

  async tempo(bpm: number): Promise<void> {
    while (this.state().bpm !== bpm) {
      await this.press(this.state().bpm > bpm ? "Tempo45" : "Tempo60");
    }
  }

  state(): PracticeState {
    const controller = sceneObject("GuitarChordLoop").getComponent(GuitarChordLoop.getTypeName());
    if (!controller) throw new Error("Practice controller is missing");
    return controller.getPracticeState();
  }

  async awaitBeat(index: number, timeoutSeconds: number): Promise<PracticeState> {
    const deadline = getTime() + timeoutSeconds;
    while (getTime() < deadline) {
      const state = this.state();
      if (state.absoluteBeat === index) return state;
      if (state.absoluteBeat > index) {
        throw new Error("Skipped absolute beat " + index + ", observed " + state.absoluteBeat);
      }
      await sleep(20);
    }
    throw new Error("Timed out waiting for absolute beat " + index);
  }
}

export async function ready(): Promise<PracticeDriver> {
  await sleep(800);
  const driver = new PracticeDriver();
  const store = global.persistentStorageSystem.store;
  const prior = store.getString(SONG_LIBRARY_KEY);
  try {
    await driver.press("AddMyOwn");
    for (const [root, quality] of [["E", "m"], ["G", ""], ["C", ""], ["D", ""]]) {
      await driver.addChord(root, quality);
    }
    await driver.press("SaveChart");
  } finally {
    if (prior) store.putString(SONG_LIBRARY_KEY, prior); else store.remove(SONG_LIBRARY_KEY);
  }
  return driver;
}

export function checkSetup(state: PracticeState): void {
  expect(state.phase).toBe("setup");
  expect(state.current).toBe("Em");
  expect(state.next).toBeNull();
  expect(state.clickDispatchCount).toBe(0);
  expect(sceneObject("SetupControls").enabled).toBe(true);
  expect(sceneObject("RunningControls").enabled).toBe(false);
  expect(sceneObject("PlacementControls").enabled).toBe(false);
  expect(sceneObject("NextChart").enabled).toBe(false);
  expect(textOn(sceneObject("BeatPrompt")).enabled).toBe(false);
  expect(textOn(sceneObject("Legend")).text.includes("O Open")).toBe(true);
  checkDiagram("NowChart", "Em");
}

export function checkCountIn(beat: number): void {
  expect(textOn(sceneObject("BeatPrompt")).text).toBe("Count in   " + beat + " / 4");
  expect(sceneObject("NextChart").enabled).toBe(false);
  checkDiagram("NowChart", "Em");
}

export async function checkLoop(bpm: 45 | 60): Promise<void> {
  const driver = await ready();
  checkSetup(driver.state());
  await driver.tempo(bpm);
  const before = driver.state();
  expect(before.bpm).toBe(bpm);
  await driver.press("Start");

  const interval = 60 / bpm;
  let firstDispatchedAt = 0;
  let regularSize = 0;
  let regularScale = 0;
  for (let index = 0; index <= 20; index += 1) {
    const state = await driver.awaitBeat(index, interval + 0.35);
    // The interactor completes after trigger-up; its await can consume part of
    // beat zero. Measure dispatch timestamps so that delay is not called drift.
    const dispatchedAt = state.beatDispatchedAt;
    if (dispatchedAt === null) throw new Error("Missing beat dispatch timestamp");
    if (index === 0) firstDispatchedAt = dispatchedAt;
    const timingError = Math.abs(dispatchedAt - firstDispatchedAt - index * interval);
    expect(getTime() - dispatchedAt < 0.5, "Beat cue observation lag").toBe(true);
    if (timingError >= 0.25) throw new Error("Beat " + index + " drifted " + timingError.toFixed(3) + " seconds");

    expect(state.run).toBe(before.run + 1);
    expect(state.bpm).toBe(bpm);
    expect(state.clickDispatchCount - before.clickDispatchCount).toBe(index + 1);
    expect(sceneObject("SetupControls").enabled).toBe(false);
    expect(sceneObject("RunningControls").enabled).toBe(true);
    if (index < 4) {
      expect(state.phase).toBe("count-in");
      expect(state.beat).toBe(index + 1);
      checkCountIn(index + 1);
      continue;
    }

    const beat = index % 4 + 1;
    const current = CHORD_ORDER[(Math.floor(index / 4) - 1) % CHORD_ORDER.length];
    const next = CHORD_ORDER[Math.floor(index / 4) % CHORD_ORDER.length];
    expect(state.phase).toBe("playing");
    expect(state.current).toBe(current);
    expect(state.next).toBe(next);
    expect(state.beat).toBe(beat);
    expect(state.accent).toBe(beat === 4);
    expect(sceneObject("NextChart").enabled).toBe(true);
    checkDiagram("NowChart", current);
    checkFingerGuide(current);
    expect(textOn(sceneObject("GuitarStrumCue")).text).toBe(beat === 1 ? "STRUM" : "Beat " + beat + "/4");
    expect(textOn(sceneObject("FretboardInstruction")).text).toBe(beat === 4 ?
      current + " → " + next + " next beat" : "Hold " + current);
    checkDiagram("NextChart", next);

    const cue = textOn(sceneObject("BeatPrompt"));
    const nextScale = diagram("NextChart").getTransform().getLocalScale().x;
    expect(cue.text).toBe("Beat " + beat + " of 4" + (beat === 1 ? "   Strum" : ""));
    if (index === 4) {
      regularSize = cue.size;
      regularScale = nextScale;
    }
    if (beat === 4) {
      expect(cue.size).toBeGreaterThan(regularSize);
      expect(nextScale).toBeGreaterThan(regularScale);
    } else {
      expect(cue.size).toBe(regularSize);
      expect(nextScale).toBe(regularScale);
    }
  }

  await driver.press("Stop");
  checkSetup(driver.state());
}

