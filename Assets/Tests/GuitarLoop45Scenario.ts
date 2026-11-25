import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {checkLoop} from "./GuitarPracticeDriver";

@component
export class GuitarLoop45Scenario extends Scenario {
  async run(): Promise<void> {
    await checkLoop(45);
  }
}
