// Registers the Guitar Chord Loop Preview scenarios with LEAF.
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import {GuitarLoop45Scenario} from "./GuitarLoop45Scenario";
import {GuitarLoop60Scenario} from "./GuitarLoop60Scenario";
import {GuitarSetupPlacementScenario} from "./GuitarSetupPlacementScenario";
import {GuitarStopRestartScenario} from "./GuitarStopRestartScenario";
import {GuitarMvpSongsScenario} from "./GuitarMvpSongsScenario";
import {GuitarMvpEditorScenario} from "./GuitarMvpEditorScenario";

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "guitar-mvp-songs", typename: GuitarMvpSongsScenario.getTypeName()},
    {id: "guitar-mvp-editor", typename: GuitarMvpEditorScenario.getTypeName()},
    {id: "guitar-setup-placement", typename: GuitarSetupPlacementScenario.getTypeName()},
    {id: "guitar-loop-60", typename: GuitarLoop60Scenario.getTypeName()},
    {id: "guitar-loop-45", typename: GuitarLoop45Scenario.getTypeName()},
    {id: "guitar-stop-restart", typename: GuitarStopRestartScenario.getTypeName()},
  ];
}
