// Desktop reference artwork is optional; live practice cues remain authoritative.
import {InteractableManipulation} from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {TargetingMode} from "InteractionKit.lspkg/Core/Interactor/Interactor"
import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {addContentToElement} from "UIKit.lspkg/Scripts/Components/Content/ElementContentFactory"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {createChildSceneObjectWithParentLayer} from "UIKit.lspkg/Scripts/Utility/SceneUtilities"
import {Chord, MAX_CHORD_STEPS, STARTER_SONGS, newPracticeChart} from "./GuitarPracticeSongs"
import {chordParts, CHORD_QUALITY_LABELS, CHORD_QUALITIES, CHORD_ROOTS} from "./GuitarChords"
import {PracticeAction, PracticeView, Instrument, AlignmentAxis} from "./GuitarPracticeView"
import {fingeringFor, StringMark} from "./GuitarFingerings"
import {GuitarPreviewGuide} from "./GuitarPreviewGuide"
import {GuitarPreviewAlignment} from "./GuitarPreviewAlignment"
import {cueForIndex} from "./GuitarChordLoopTiming"
import {createSongPickerIcon, GuitarLaunchIntro} from "./GuitarBranding"
const STRINGS = ["E", "A", "D", "G", "B", "e"]
const STRING_SPACING = 1.43
const FRET_SPACING = 1.37
const NUT_Y = 1.17
const WHITE = new vec4(1, 1, 1, 1)
const ORANGE = new vec4(225 / 255, 115 / 255, 66 / 255, 1)
const HANDLE_WIDTH = 11
const HANDLE_HEIGHT = 3.5
type ProjectedBounds = {left: number; right: number; top: number; bottom: number}

function stringX(index: number): number {
  return (index - (STRINGS.length - 1) / 2) * STRING_SPACING
}

function label(host: SceneObject, value: string, size: number, weight: number, color = WHITE): Text {
  const text = host.createComponent("Component.Text")
  text.text = value
  text.size = size
  text.weight = weight
  text.horizontalAlignment = HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Center
  text.textFill.color = color
  text.layoutRect = Rect.create(-16, 16, -2, 2)
  return text
}

function graphicLabel(parent: SceneObject, name: string, text: string, size: number, weight: number,
                      x: number, y: number, color = WHITE): Text {
  const host = createChildSceneObjectWithParentLayer(name, parent)
  host.getTransform().setLocalPosition(new vec3(x, y, 0.08))
  return label(host, text, size, weight, color)
}

function layout(host: SceneObject, width: number, height: number, gap: number): FlexLayout {
  const row = host.createComponent(FlexLayout.getTypeName()) as FlexLayout
  row.width = width
  row.height = height
  row.direction = FlexDirection.Row
  row.columnGap = gap
  row.alignItems = FlexAlign.Center
  row.justifyContent = FlexJustify.Center
  return row
}

function layoutItem(host: SceneObject, width: number, height: number, order: number): FlexItem {
  const item = host.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = width
  item.overrideHeight = height
  item.flexShrink = 0
  item.order = order
  return item
}

function findChild(host: SceneObject, name: string): SceneObject {
  for (let i = 0; i < host.getChildrenCount(); i++) {
    const child = host.getChild(i)
    if (child.name === name) return child
  }
  throw new Error("Missing UI host " + host.name + "/" + name)
}

/** One flat unlit mesh per chart state. The positions are chord notation in chart-local space. */
function buildDiagram(marks: readonly StringMark[], first: number, rows: number): RenderMesh {
  const spacing = FRET_SPACING * 3 / rows
  const positions: number[] = []
  const indices: number[] = []

  const rectangle = (left: number, right: number, bottom: number, top: number) => {
    const first = positions.length / 3
    positions.push(left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0)
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  for (let string = 0; string < STRINGS.length; string++) {
    const x = stringX(string)
    rectangle(x - 0.035, x + 0.035, NUT_Y - FRET_SPACING * 3, NUT_Y)
  }
  for (let fret = 0; fret <= rows; fret++) {
    const y = NUT_Y - fret * spacing
    const halfThickness = fret === 0 && first === 1 ? 0.105 : 0.045
    rectangle(stringX(0) - 0.035, stringX(5) + 0.035, y - halfThickness, y + halfThickness)
  }
  for (let string = 0; string < marks.length; string++) {
    const mark = marks[string]
    if (typeof mark === "string") continue

    const x = stringX(string)
    const y = NUT_Y - (mark[0] - first + 0.5) * spacing
    const center = positions.length / 3
    positions.push(x, y, 0)
    const sides = 16
    for (let point = 0; point < sides; point++) {
      const angle = point * 2 * Math.PI / sides
      positions.push(x + Math.cos(angle) * 0.29, y + Math.sin(angle) * 0.29, 0)
      indices.push(center, center + 1 + point, center + 1 + (point + 1) % sides)
    }
  }

  const builder = new MeshBuilder([{name: "position", components: 3}])
  builder.topology = MeshTopology.Triangles
  builder.indexType = MeshIndexType.UInt16
  builder.appendVerticesInterleaved(positions)
  builder.appendIndices(indices)
  const mesh = builder.getMesh()
  builder.updateMesh()
  return mesh
}

class Chart {
  private readonly content: SceneObject
  private readonly chordLabel: Text
  private readonly fretLabel: Text
  private readonly visual: RenderMeshVisual
  private readonly stringStates: Text[] = []
  private readonly fingers: Text[] = []
  private chord: Chord | null = null

  constructor(
    host: SceneObject,
    private readonly notation: "Now" | "Next",
    material: Material,
    private readonly meshes: Map<Chord, RenderMesh>,
    textScale: number
  ) {
    this.content = createChildSceneObjectWithParentLayer("Diagram", host)
    const next = notation === "Next"
    this.chordLabel = graphicLabel(this.content, "Chord", notation + "  Em", 76 * textScale,
      750, 0, 3.93, next ? WHITE : ORANGE)

    this.fretLabel = graphicLabel(this.content, "First fret", "", 33 * textScale, 700, -4.8, 0.5)
    const grid = createChildSceneObjectWithParentLayer("Frets and finger dots", this.content)
    this.visual = grid.createComponent("Component.RenderMeshVisual")
    this.visual.addMaterial(material)

    STRINGS.forEach((string, index) => {
      const x = stringX(index)
      const name = index + 1 + " " + string
      this.stringStates.push(graphicLabel(this.content, "String state " + name, "", 46 * textScale, 700, x, 2.02))
      graphicLabel(this.content, "String name " + name, string, 38 * textScale, 650, x, -3.78)
    })
    for (let index = 0; index < 4; index++) {
      this.fingers.push(graphicLabel(this.content, "Finger " + (index + 1), "", 47 * textScale, 750, 0, 0))
    }
    this.setEmphasis(false)
  }

  show(chord: Chord): void {
    if (this.chord === chord) return
    this.chord = chord
    this.chordLabel.text = this.notation + "  " + chord
    const marks = fingeringFor(chord)
    const frets = marks.flatMap(mark => typeof mark === "string" ? [] : [mark[0]])
    const max = Math.max(3, ...frets)
    const first = max <= 4 ? 1 : Math.min(...frets)
    const rows = Math.max(3, max - first + 1)
    const spacing = FRET_SPACING * 3 / rows
    this.fretLabel.text = first > 1 ? first + "fr" : ""
    let mesh = this.meshes.get(chord)
    if (!mesh) {
      mesh = buildDiagram(marks, first, rows)
      this.meshes.set(chord, mesh)
    }
    this.visual.mesh = mesh

    let fingerIndex = 0
    marks.forEach((mark, string) => {
      this.stringStates[string].text = typeof mark === "string" ? mark : ""
      if (typeof mark === "string") return

      const [fret, finger] = mark
      const number = this.fingers[fingerIndex++]
      number.text = String(finger)
      // In an additive display, dark text over a white dot loses contrast.
      number.getTransform().setLocalPosition(new vec3(stringX(string) + 0.53,
        NUT_Y - (fret - first + 0.5) * spacing, 0.08))
    })
    for (let index = fingerIndex; index < this.fingers.length; index++) {
      this.fingers[index].text = ""
    }
  }

  setEmphasis(emphasize: boolean, lyricGap = 0): void {
    const next = this.notation === "Next"
    const scale = next ? (emphasize ? 0.94 : 0.85) : 1
    this.content.getTransform().setLocalScale(new vec3(scale, scale, 1))
    this.content.getTransform().setLocalPosition(new vec3(0, -lyricGap, 0))
  }
}

@component
export class GuitarChordLoopUI extends BaseScriptComponent {
  @input diagramMaterial!: Material
  @input @allowUndefined previewArtworkMaterial?: Material
  @input layoutSideBySide: boolean = true
  @input chartTextScale: number = 1

  private readonly action = new Event<PracticeAction>()
  readonly onAction: PublicApi<PracticeAction> = this.action.publicApi()
  private view: PracticeView = {phase: "library", song: newPracticeChart(), bpm: 60,
    section: -1, repeat: true, cue: null, cursor: 0, status: "", showReference: true,
    instruments: {guitar: true, bass: true, keys: false, drums: true}}
  private ready = false
  private launchIntro: GuitarLaunchIntro | null = null
  private previewArtwork: SceneObject | null = null
  private previewGuide: GuitarPreviewGuide | null = null
  private cueAlignment: GuitarPreviewAlignment | null = null
  private chartAlignment!: GuitarPreviewAlignment
  private placementCamera?: Camera
  private placementRefresh!: DelayedCallbackEvent
  private nowHost!: SceneObject
  private chartHandle!: SceneObject
  private cueHandle: SceneObject | null = null
  private placementTarget: "chart" | "cues" = "chart"
  private alignmentControls!: SceneObject
  private controls!: {setup: SceneObject; running: SceneObject}
  private library!: SceneObject
  private savedLibrary!: SceneObject
  private deleteConfirmation!: SceneObject
  private savedRows: SceneObject[] = []
  private savedNavigation!: FlexLayout
  private editor!: SceneObject
  private chordPicker!: SceneObject
  private editorNavigation!: SceneObject
  private editorOrder!: SceneObject
  private editorChordActions!: FlexLayout
  private editorLyric!: Text
  private importPanel!: SceneObject
  private importStatus!: Text
  private importExample!: Text
  private editorInfo!: FlexLayout
  private editorSave!: FlexLayout
  private options!: SceneObject
  private optionsLayout!: FlexLayout
  private pausedControls!: SceneObject
  private audio!: SceneObject
  private audioLayout!: FlexLayout
  private melodyButton!: SceneObject
  private sectionChoices!: SceneObject
  private sectionLayout!: FlexLayout
  private sectionHosts: SceneObject[] = []
  private anticipation!: Text
  private playbackLyric!: Text
  private chartHost!: SceneObject
  private charts!: FlexLayout
  private nextHost!: SceneObject
  private nowChart!: Chart
  private nextChart!: Chart
  private beat!: Text
  private legend!: Text
  private title!: Text
  private subtitle!: Text
  private sequence!: Text
  private selection!: Text
  private buttons: Record<string, ElementContent> = {}

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initializeUI())
    this.placementRefresh = this.createEvent("DelayedCallbackEvent")
    this.placementRefresh.bind(() => this.layoutPlacementHandles())
    const launchUpdate = this.createEvent("UpdateEvent")
    launchUpdate.bind(() => {
      if (!this.ready || this.launchIntro?.update()) return
      this.launchIntro = null
      this.render()
      this.removeEvent(launchUpdate)
      print("[GuitarChordLoopUI] launch complete")
    })
  }

  show(view: PracticeView): void {
    this.view = view
    if (this.ready) this.render()
  }

  setLayout(sideBySide: boolean): void {
    this.layoutSideBySide = sideBySide
    if (!this.ready) return
    this.charts.direction = sideBySide ? FlexDirection.Row : FlexDirection.Column
    this.charts.width = sideBySide ? 22 : 13
    this.charts.height = sideBySide ? 12 : 21
    this.charts.columnGap = 2.2
    this.charts.rowGap = 1.8
    this.charts.refreshChildren()
    this.layoutPlacementHandles()
  }

  hasPreviewArtwork(): boolean {
    return !!this.previewArtworkMaterial && !isNull(this.previewArtworkMaterial)
  }

  getCuePose() { return this.cueAlignment?.state() ?? null }
  getChartPose() { return this.chartAlignment?.state() ?? null }

  setPlacementCamera(camera: Camera): void { this.placementCamera = camera }

  framePreview(position: vec3, rotation: quat, distance: number): void {
    const panel = this.getTransform()
    const panelDepth = Math.max(30, distance)
    panel.setWorldRotation(rotation)
    panel.setWorldPosition(position.add(rotation.multiplyVec3(new vec3(0, 2, -panelDepth))))
    this.chartAlignment.rebase()
    if (this.previewArtwork) {
      // Frame the fixed example below the controls in the same startup view.
      const artwork = this.previewArtwork.getTransform()
      const depth = panelDepth + 12
      artwork.setWorldRotation(rotation)
      artwork.setWorldScale(panel.getWorldScale().uniformScale(0.60 * depth / 77))
      artwork.setWorldPosition(position.add(rotation.multiplyVec3(new vec3(0, -16 * depth / 77, -depth))))
      this.cueAlignment?.rebase()
    }
    this.layoutPlacementHandles()
  }

  beginPlacement(rotation: quat): void {
    this.chartAlignment.begin(rotation)
    this.cueAlignment?.begin(rotation)
    this.selectPlacementTarget("chart")
  }

  selectPlacementTarget(target: "chart" | "cues"): void {
    this.placementTarget = target
    this.buttons.NudgeChart.text = target === "chart" ? "✓ Chart" : "Chart"
    this.buttons.NudgeCues.text = target === "cues" ? "✓ Cues" : "Cues"
  }

  nudgePlacement(axis: AlignmentAxis, delta: number): void {
    const target = this.placementTarget === "chart" ? this.chartAlignment : this.cueAlignment
    target?.adjust(axis, delta)
  }

  resetPlacement(): void {
    this.chartAlignment.reset()
    this.cueAlignment?.reset()
  }

  finishPlacement(confirm: boolean): void {
    this.chartAlignment.finish(confirm)
    this.cueAlignment?.finish(confirm)
  }

  private grabHandle(target: SceneObject, placement: GuitarPreviewAlignment, name: string,
                     label: string): SceneObject {
    const host = createChildSceneObjectWithParentLayer(name, this.alignmentControls)
    const button = this.button(host, label, HANDLE_WIDTH, HANDLE_HEIGHT, "Capsule")
    const manipulation = host.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    manipulation.setManipulateRoot(target.getTransform())
    manipulation.setNewInteractable(button.interactable)
    manipulation.setCanRotate(true)
    manipulation.setCanScale(true)
    manipulation.minimumScaleFactor = 0.5
    manipulation.maximumScaleFactor = 1.5
    manipulation.onManipulationStart.add(() =>
      this.selectPlacementTarget(name === "ChartGrabHandle" ? "chart" : "cues"))
    manipulation.onManipulationUpdate.add(() => {
      placement.limitPose()
      this.layoutPlacementHandles()
    })
    host.enabled = false
    return host
  }

  private layoutPlacementHandles(): void {
    const camera = this.placementCamera
    if (this.view.phase !== "placement" || !camera || !this.chartHandle) return
    const panel = this.alignmentControls.getTransform().getWorldTransform()
    const toPanel = panel.inverse()
    const bounds = (matrix: mat4, x: number, y: number, halfWidth: number, halfHeight: number): ProjectedBounds => {
      const points = [-1, 1].flatMap(dx => [-1, 1].map(dy =>
        camera.worldSpaceToScreenSpace(matrix.multiplyPoint(new vec3(x + dx * halfWidth, y + dy * halfHeight, 0)))))
      return {left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
        top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y))}
    }
    const now = this.nowHost.getTransform().getWorldTransform()
    const chart = this.chartHost.getTransform().getWorldTransform()
    const guide = this.previewGuide?.root.getTransform().getWorldTransform()
    const obstacles = [bounds(panel, 0, 10.6, 16, 5.4), bounds(panel, 18.5, -12, 6.2, 11.5),
      bounds(now, 0, 0, 6.2, 5.1)]
    if (this.nextHost.enabled) obstacles.push(bounds(this.nextHost.getTransform().getWorldTransform(), 0, 0, 5.8, 5.1))
    if (this.playbackLyric.enabled) obstacles.push(bounds(chart, 0, 5.35, 16, 0.9))
    if (guide) obstacles.push(bounds(guide, -19, 5.6, 12, 6.5))

    const place = (handle: SceneObject, anchor: vec3) => {
      const xs = [anchor.x, anchor.x - 2.5, anchor.x - 5, -21, -16, -10, 0, 10, 16, 21]
      const ys = [anchor.y, anchor.y - 4.5, anchor.y + 4.5, -3, -9, -15, -21, 1, 5, 17.5, 22]
      for (const y of ys) for (const x of xs) {
        const box = bounds(panel, x, y, HANDLE_WIDTH / 2 + 0.65, HANDLE_HEIGHT / 2 + 0.65)
        if (box.left < 0.015 || box.right > 0.985 || box.top < 0.015 || box.bottom > 0.985) continue
        if (obstacles.some(item => box.left < item.right && box.right > item.left &&
          box.top < item.bottom && box.bottom > item.top)) continue
        handle.getTransform().setLocalPosition(new vec3(x, y, 0.3))
        handle.enabled = true
        obstacles.push(box)
        return
      }
      // The wheel remains accessible if a pose leaves no clear room for a grab handle.
      handle.enabled = false
    }
    const nowEdge = toPanel.multiplyPoint(now.multiplyPoint(new vec3(-6.2, 0.4, 0)))
    place(this.chartHandle, new vec3(nowEdge.x - HANDLE_WIDTH / 2 - 1.3, nowEdge.y, 0))
    if (guide && this.cueHandle) {
      const cueEdge = toPanel.multiplyPoint(guide.multiplyPoint(new vec3(-31, 5.6, 0)))
      place(this.cueHandle, new vec3(cueEdge.x - HANDLE_WIDTH / 2 - 1.3, cueEdge.y, 0))
    }
  }

  private createPreviewArtwork(root: SceneObject): void {
    if (!global.deviceInfoSystem.isEditor() || !this.hasPreviewArtwork()) return
    // Measured illustration pose is a Preview fixture, not real guitar tracking.
    // Keep it fixed in the room when the user moves the control panel.
    const host = createChildSceneObjectWithParentLayer("PlayerPerspectiveArtwork", root)
    host.getTransform().setLocalPosition(new vec3(0, -27, -1.5))
    const halfWidth = 32
    const halfHeight = halfWidth * 941 / 1672
    const builder = new MeshBuilder([{name: "position", components: 3}, {name: "texture0", components: 2}])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    builder.appendVerticesInterleaved([
      -halfWidth, -halfHeight, 0, 0, 0, halfWidth, -halfHeight, 0, 1, 0,
      halfWidth, halfHeight, 0, 1, 1, -halfWidth, halfHeight, 0, 0, 1
    ])
    builder.appendIndices([0, 1, 2, 0, 2, 3])
    const visual = host.createComponent("Component.RenderMeshVisual")
    visual.mesh = builder.getMesh()
    builder.updateMesh()
    visual.addMaterial(this.previewArtworkMaterial!)
    this.previewArtwork = host
    this.previewGuide = new GuitarPreviewGuide(host, this.diagramMaterial)
    host.setParentPreserveWorldTransform(null)
    this.cueAlignment = new GuitarPreviewAlignment(this.previewGuide.root, 25)
    this.cueHandle = this.grabHandle(this.previewGuide.root, this.cueAlignment,
      "CueGrabHandle", "Move cues")
  }

  private row(parent: SceneObject, name: string, y: number): SceneObject {
    const host = createChildSceneObjectWithParentLayer(name, parent)
    host.getTransform().setLocalPosition(new vec3(0, y, 0.1))
    return host
  }

  private makeButton(parent: SceneObject, name: string, title: string, width: number,
                     order: number, action: PracticeAction | (() => void), primary = false): void {
    let host: SceneObject | null = null
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      if (parent.getChild(i).name === name) host = parent.getChild(i)
    }
    if (!host) host = createChildSceneObjectWithParentLayer(name, parent)
    layoutItem(host, width, 4.4, order)
    const button = this.button(host, title, width, 4.4, "Rectangle", primary)
    button.onTriggerUp.add(() => typeof action === "function" ? action() : this.action.invoke(action))
  }

  private button(host: SceneObject, title: string, width: number, height: number,
                 shape: "Rectangle" | "Capsule" | "Round", primary = false): Button {
    const button = host.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "System3", shape, style: primary ? "Primary" : "Secondary"})
    button.size = new vec3(width, height, 0.9)
    button.initialize()
    button.interactable.targetingMode = TargetingMode.Direct | TargetingMode.Indirect
    const content = addContentToElement(host, {text: title, textSize: 52, autoResize: false})
    content.useThemeColors = false
    if (content.textComponent) content.textComponent.weight = 650
    this.buttons[host.name] = content
    return button
  }

  private buildPlacementControls(root: SceneObject): void {
    this.alignmentControls = this.row(root, "GuitarAlignmentControls", 0)
    const targets = this.row(this.alignmentControls, "NudgeTargets", -6)
    targets.getTransform().setLocalPosition(new vec3(18.5, -6, 0.1))
    const targetLayout = layout(targets, 9, 9.4, 0.6)
    targetLayout.direction = FlexDirection.Column
    targetLayout.rowGap = 0.6
    this.makeButton(targets, "NudgeChart", "Chart", 9, 0, {type: "align-target", target: "chart"})
    this.makeButton(targets, "NudgeCues", "Cues", 9, 1, {type: "align-target", target: "cues"})
    targets.enabled = global.deviceInfoSystem.isEditor() && this.hasPreviewArtwork()
    targetLayout.refreshChildren()
    const wheel = this.row(this.alignmentControls, "PlacementWheel", -17.5)
    wheel.getTransform().setLocalPosition(new vec3(18.5, -17.5, 0.1))
    graphicLabel(wheel, "NudgeStep", "1 cm", 30, 650, 0, 0)
    const directions: {name: string; glyph: string; axis: AlignmentAxis; delta: number}[] = [
      {name: "NudgeLeft", glyph: "←", axis: "x", delta: -1},
      {name: "NudgeRight", glyph: "→", axis: "x", delta: 1},
      {name: "NudgeUp", glyph: "↑", axis: "y", delta: 1},
      {name: "NudgeDown", glyph: "↓", axis: "y", delta: -1}
    ]
    for (const {name, glyph, axis, delta} of directions) {
      const segment = createChildSceneObjectWithParentLayer(name, wheel)
      segment.getTransform().setLocalPosition(new vec3(axis === "x" ? delta * 3.6 : 0,
        axis === "y" ? delta * 3.6 : 0, 0))
      this.button(segment, glyph, 4.6, 4.6, "Round").onTriggerUp.add(() =>
        this.action.invoke({type: "align-adjust", axis, delta}))
    }
    const row = this.row(this.alignmentControls, "PlacementActions", 13)
    const flex = layout(row, 31, 4.4, 0.8)
    this.makeButton(row, "GuitarCancel", "Cancel", 8, 0, {type: "align-cancel"})
    this.makeButton(row, "GuitarReset", "Reset", 8, 1, {type: "align-reset"})
    this.makeButton(row, "Confirm", "Done", 8, 2, {type: "align-confirm"}, true)
    flex.refreshChildren()
  }

  private initializeUI(): void {
    const root = this.getSceneObject()
    this.chartHost = findChild(root, "Charts")
    const nowHost = this.nowHost = findChild(this.chartHost, "NowChart")
    this.nextHost = findChild(this.chartHost, "NextChart")
    const controls = findChild(root, "PracticeControls")
    findChild(controls, "PlacementControls").enabled = false
    this.controls = {setup: findChild(controls, "SetupControls"),
      running: findChild(controls, "RunningControls")}
    new CanvasController(root).ensure(new vec2(40, 46))
    this.charts = layout(this.chartHost, 22, 12, 2.2)
    layoutItem(nowHost, 10.9, 9.4, 0)
    layoutItem(this.nextHost, 9.3, 8.3, 1)
    const meshes = new Map<Chord, RenderMesh>()
    const scale = this.chartTextScale > 0 ? this.chartTextScale : 1
    this.nowChart = new Chart(nowHost, "Now", this.diagramMaterial, meshes, scale)
    this.nextChart = new Chart(this.nextHost, "Next", this.diagramMaterial, meshes, scale)
    const setup = layout(this.controls.setup, 39, 4.4, 1.2)
    this.makeButton(this.controls.setup, "Library", "Songs", 6, 0, {type: "library"})
    this.makeButton(this.controls.setup, "Tempo45", "−5 BPM", 6, 1, {type: "tempo", delta: -5})
    this.makeButton(this.controls.setup, "Tempo60", "+5 BPM", 6, 2, {type: "tempo", delta: 5})
    findChild(this.controls.setup, "Place").enabled = false
    this.makeButton(this.controls.setup, "Start", "Play", 7, 4, {type: "start"}, true)
    setup.refreshChildren()

    const running = layout(this.controls.running, 20, 4.4, 1.5)
    this.makeButton(this.controls.running, "Pause", "Pause", 9, 0, {type: "pause"}, true)
    this.makeButton(this.controls.running, "Stop", "Stop", 7, 1, {type: "stop"})
    running.refreshChildren()

    this.sectionChoices = this.row(root, "SectionChoices", -7.5)
    const sections = this.sectionLayout = layout(this.sectionChoices, 39, 4.4, 1)
    for (let index = -1; index < 2; index++) {
      const name = "SelectSection" + (index + 1)
      this.makeButton(this.sectionChoices, name, "", 12, index + 1, {type: "select-section", section: index})
      this.sectionHosts.push(findChild(this.sectionChoices, name))
    }
    sections.refreshChildren()
    this.anticipation = graphicLabel(root, "ChordChangeCountdown", "", 44, 650, 0, 18.05)

    this.options = this.row(root, "SongOptions", -12.5)
    this.optionsLayout = layout(this.options, 39, 4.4, 0.6)
    this.makeButton(this.options, "PreviewGuitar", "Guitar guide", 11, 0, {type: "reference"})
    findChild(this.options, "PreviewGuitar").enabled = global.deviceInfoSystem.isEditor()
    this.makeButton(this.options, "Place", "Place chart", 10, 1, {type: "place"})
    this.makeButton(this.options, "Repeat", "Repeat on", 8, 2, {type: "repeat"})
    this.makeButton(this.options, "Edit", "Edit chart", 8, 3, {type: "edit"})
    this.optionsLayout.refreshChildren()

    this.buildPlacementControls(root)
    this.pausedControls = this.row(root, "PausedTempo", -12.5)
    const pausedTempo = layout(this.pausedControls, 30, 4.4, 1.5)
    this.makeButton(this.pausedControls, "PausedSlower", "−5 BPM", 12, 0, {type: "tempo", delta: -5})
    this.makeButton(this.pausedControls, "PausedFaster", "+5 BPM", 12, 1, {type: "tempo", delta: 5})
    pausedTempo.refreshChildren()
    this.audio = this.row(root, "BandControls", -18)
    this.audioLayout = layout(this.audio, 39, 4.4, 0.55)
    const instruments: Instrument[] = ["guitar", "bass", "keys", "drums"]
    instruments.forEach((instrument, index) => this.makeButton(this.audio, "Band" + instrument,
      instrument, 7.3, index, {type: "instrument", instrument}))
    this.makeButton(this.audio, "Melody", "Melody", 7.6, 4, {type: "melody"})
    this.melodyButton = findChild(this.audio, "Melody")
    this.audioLayout.refreshChildren()

    this.buildSongLibrary(root)
    this.buildSongEditor(root)
    this.buildChartImport(root)

    this.title = graphicLabel(root, "SongTitle", "", 66, 750, 0, 9)
    this.subtitle = graphicLabel(root, "SongSubtitle", "", 43, 600, 0, 6.8)
    this.beat = label(findChild(root, "BeatPrompt"), "", 58, 700)
    this.beat.getTransform().setLocalPosition(new vec3(0, 20.75, 0.1))
    this.playbackLyric = graphicLabel(this.chartHost, "PlaybackLyric", "", this.title.size, 700, 0, 5.35, ORANGE)
    this.playbackLyric.italic = true
    this.playbackLyric.layoutRect = Rect.create(-16, 16, -0.8, 0.8)
    this.playbackLyric.horizontalOverflow = HorizontalOverflow.Shrink
    this.legend = label(findChild(root, "Legend"), "", 39, 600)
    this.legend.getTransform().setLocalPosition(new vec3(0, -23.5, 0.1))
    this.chartAlignment = new GuitarPreviewAlignment(this.chartHost, {
      minOffset: new vec3(-11, -8, -12), maxOffset: new vec3(11, 8, 3),
      maxAngle: Math.PI / 9, minScale: 0.8, maxScale: 1.25
    })
    this.chartHandle = this.grabHandle(this.chartHost, this.chartAlignment, "ChartGrabHandle", "Move chart")
    this.createPreviewArtwork(root)
    this.launchIntro = new GuitarLaunchIntro(root)
    this.ready = true
    this.setLayout(true)
    this.render()
    print("[GuitarChordLoopUI] song library and chord editor ready")
  }

  private buildSongLibrary(root: SceneObject): void {
    this.library = this.row(root, "SongLibrary", 0)
    createSongPickerIcon(this.library)
    STARTER_SONGS.forEach((song, index) => {
      const row = this.row(this.library, "SongRow" + index, 3.5 - index * 6)
      const flex = layout(row, 35, 4.4, 0)
      this.makeButton(row, "Song-" + song.id, song.title, 32, 0, {type: "song", id: song.id}, index === 0)
      flex.refreshChildren()
    })
    const custom = this.row(this.library, "CustomRow", -14.5)
    const customLayout = layout(custom, 35, 4.4, 1)
    this.makeButton(custom, "AddMyOwn", "Add my own", 15, 0, {type: "new-song"})
    this.makeButton(custom, "MySongs", "My songs", 16, 1, {type: "saved-library"})
    customLayout.refreshChildren()
    const practice = this.row(this.library, "PracticeRow", -20.5)
    const practiceLayout = layout(practice, 35, 4.4, 0)
    this.makeButton(practice, "ChordPractice", "Chord practice", 32, 0, {type: "practice"})
    practiceLayout.refreshChildren()

    this.savedLibrary = this.row(root, "SavedSongLibrary", 0)
    for (let index = 0; index < 4; index++) {
      const row = this.row(this.savedLibrary, "SavedSongRow" + index, 3.5 - index * 6)
      const flex = layout(row, 39, 4.4, 0)
      const songAtIndex = () => {
        const saved = this.view.saved
        return saved?.songs[(saved.page ?? 0) * 4 + index]
      }
      this.makeButton(row, "SavedSong" + index, "", 38, 0, () => {
        const song = songAtIndex()
        if (song) this.action.invoke({type: "song", id: song.id})
      })
      flex.refreshChildren()
      this.savedRows.push(row)
    }
    const pages = this.row(this.savedLibrary, "SavedSongNavigation", -20.5)
    this.savedNavigation = layout(pages, 38, 4.4, 1)
    this.makeButton(pages, "SavedBack", "Back", 8, 0, {type: "saved-library"})
    this.makeButton(pages, "SavedPrevious", "Previous", 10, 1, {type: "saved-page", delta: -1})
    this.makeButton(pages, "SavedNext", "Next", 8, 2, {type: "saved-page", delta: 1})
    this.savedNavigation.refreshChildren()

    this.deleteConfirmation = this.row(root, "DeleteSongConfirmation", 0.5)
    const confirmation = layout(this.deleteConfirmation, 36, 4.4, 1.4)
    this.makeButton(this.deleteConfirmation, "CancelDeleteSong", "Cancel", 11, 0, {type: "cancel-delete-song"}, true)
    this.makeButton(this.deleteConfirmation, "ConfirmDeleteSong", "Delete song", 14, 1, {type: "confirm-delete-song"})
    confirmation.refreshChildren()
  }

  private buildSongEditor(root: SceneObject): void {
    this.editor = this.row(root, "ChordEditor", 0)
    this.sequence = graphicLabel(this.editor, "Sequence", "", 49, 650, 0, 0.5)
    this.selection = graphicLabel(this.editor, "SelectedStep", "", 47, 700, 0, -2)
    this.editorLyric = graphicLabel(this.editor, "SelectedLyric", "", 36, 650, 0, -3.1)
    this.editorLyric.horizontalOverflow = HorizontalOverflow.Ellipsis
    const info = this.row(this.editor, "SongInfo", 3.6)
    this.editorInfo = layout(info, 39, 4.4, 1)
    this.makeButton(info, "NameSong", "Name song", 10, 0, () => this.requestTitle())
    this.makeButton(info, "NewLoop", "New loop", 10, 0, {type: "new-loop"})
    this.makeButton(info, "DraftSlower", "−5 BPM", 7, 1, {type: "tempo", delta: -5})
    this.makeButton(info, "DraftFaster", "+5 BPM", 7, 2, {type: "tempo", delta: 5})
    this.makeButton(info, "Meter", "4 beats/bar", 11, 3, {type: "meter"})
    this.editorInfo.refreshChildren()
    this.editorNavigation = this.row(this.editor, "StepNavigation", -5.8)
    const nav = layout(this.editorNavigation, 39, 4.4, 0.75)
    this.makeButton(this.editorNavigation, "PreviousStep", "Previous", 8, 0, {type: "cursor", delta: -1})
    this.makeButton(this.editorNavigation, "Shorter", "−1 beat", 8, 1, {type: "duration", delta: -1})
    this.makeButton(this.editorNavigation, "Longer", "+1 beat", 8, 2, {type: "duration", delta: 1})
    this.makeButton(this.editorNavigation, "NextStep", "Next", 8, 3, {type: "cursor", delta: 1})
    nav.refreshChildren()
    this.editorOrder = this.row(this.editor, "StepOrder", -11)
    const order = layout(this.editorOrder, 39, 4.4, 1)
    this.makeButton(this.editorOrder, "MoveEarlier", "Move earlier", 11, 0, {type: "move-step", delta: -1})
    this.makeButton(this.editorOrder, "MoveLater", "Move later", 11, 1, {type: "move-step", delta: 1})
    this.makeButton(this.editorOrder, "Remove", "Remove", 9, 2, {type: "remove"})
    order.refreshChildren()
    const edit = this.row(this.editor, "SequenceActions", -16.2)
    this.editorChordActions = layout(edit, 39, 4.4, 1)
    this.makeButton(edit, "Append", "Add chord", 12, 0, {type: "append"}, true)
    this.makeButton(edit, "ChangeChord", "Change chord", 13, 1, {type: "change-chord"})
    this.makeButton(edit, "EditLyric", "Add lyrics", 11, 2, () => this.requestLyric())
    this.makeButton(edit, "ImportChart", "Import chart", 13, 3, {type: "open-import"})
    this.editorChordActions.refreshChildren()
    const save = this.row(this.editor, "SaveActions", -21.4)
    this.editorSave = layout(save, 39, 4.4, 1)
    this.makeButton(save, "CancelEdit", "Cancel", 8, 0, {type: "cancel"})
    this.makeButton(save, "DeleteSong", "Delete", 12, 1, {type: "delete-song"})
    this.makeButton(save, "SaveChart", "Save song", 12, 2, {type: "save"}, true)
    this.editorSave.refreshChildren()

    this.chordPicker = this.row(root, "ChordPicker", 0)
    graphicLabel(this.chordPicker, "RootLabel", "Root", 35, 700, 0, 4.8)
    graphicLabel(this.chordPicker, "QualityLabel", "Chord type", 35, 700, 0, -6)
    for (let line = 0; line < 2; line++) {
      const roots = this.row(this.chordPicker, "RootRow" + line, 2 - line * 5)
      const rootLayout = layout(roots, 39, 4.4, 0.6)
      CHORD_ROOTS.slice(line * 6, line * 6 + 6).forEach((root, index) =>
        this.makeButton(roots, "Root-" + root, root, 5.6, index, {type: "pick-root", root}))
      rootLayout.refreshChildren()
      const types = this.row(this.chordPicker, "QualityRow" + line, -9 - line * 5)
      const typeLayout = layout(types, 39, 4.4, 0.6)
      CHORD_QUALITIES.slice(line * 5, line * 5 + 5).forEach((quality, index) =>
        this.makeButton(types, "Quality-" + quality, CHORD_QUALITY_LABELS[quality], 7.1, index,
          {type: "pick-quality", quality}))
      typeLayout.refreshChildren()
    }
    const choices = this.row(this.chordPicker, "PickerActions", -20)
    const choiceLayout = layout(choices, 34, 4.4, 1)
    this.makeButton(choices, "CancelChord", "Back", 8, 0, {type: "cancel-picker"})
    this.makeButton(choices, "UseChord", "Use chord", 13, 1, {type: "commit-chord"}, true)
    choiceLayout.refreshChildren()
  }

  private buildChartImport(root: SceneObject): void {
    this.importPanel = this.row(root, "ChartImport", 0)
    const meter = this.row(this.importPanel, "ImportMeter", 2.5)
    const meterLayout = layout(meter, 35, 4.4, 1)
    this.makeButton(meter, "ImportThree", "3/4", 10, 0, {type: "import-meter", meter: 3})
    this.makeButton(meter, "ImportFour", "4/4", 10, 1, {type: "import-meter", meter: 4})
    meterLayout.refreshChildren()

    const bars = this.row(this.importPanel, "ImportBars", -3)
    const barsLayout = layout(bars, 39, 4.4, 1)
    this.makeButton(bars, "ImportFewerBars", "−1 bar", 9, 0, {type: "import-bars", delta: -1})
    this.makeButton(bars, "ImportMoreBars", "+1 bar", 9, 1, {type: "import-bars", delta: 1})
    barsLayout.refreshChildren()

    const paste = this.row(this.importPanel, "ImportPaste", -8.5)
    const pasteLayout = layout(paste, 39, 4.4, 1)
    this.makeButton(paste, "PasteChart", "Paste chart", 15, 0, () => {
      this.requestText(this.view.chartImport?.text ?? "", "Chart import", text =>
        this.action.invoke({type: "import-text", text}))
    })
    this.makeButton(paste, "UseScannedChart", "Use scanned page", 17, 1, {type: "load-scanned-chart"}, true)
    findChild(paste, "UseScannedChart").enabled = global.deviceInfoSystem.isEditor()
    pasteLayout.refreshChildren()
    this.importExample = graphicLabel(this.importPanel, "ImportExample", "", 35, 600, 0, -12.4)
    this.importStatus = graphicLabel(this.importPanel, "ImportStatus", "", 43, 700, 0, -15.3)
    this.importStatus.horizontalOverflow = HorizontalOverflow.Shrink
    const choices = this.row(this.importPanel, "ImportActions", -20)
    const choiceLayout = layout(choices, 38, 4.4, 1)
    this.makeButton(choices, "CancelImport", "Back", 8, 0, {type: "cancel-import"})
    this.makeButton(choices, "ReviewImport", "Review chart", 14, 1, {type: "review-import"}, true)
    choiceLayout.refreshChildren()
  }

  private requestTitle(): void {
    const title = this.view.song.title === "Untitled song" ? "" : this.view.song.title
    this.requestText(title, "Song title", text => this.action.invoke({type: "song-title", title: text}))
  }

  private requestLyric(): void {
    const {song, cursor} = this.view
    const step = song.sections[0].steps[cursor]
    if (!step || song.id === "practice") return
    this.requestText(step.lyric ?? "", "Lyric", lyric =>
      this.action.invoke({type: "step-lyric", songId: song.id, index: cursor, lyric}))
  }

  private requestText(initial: string, field: string, commit: (text: string) => void): void {
    require("LensStudio:TextInputModule")
    let value = initial
    const keyboard = new TextInputSystem.KeyboardOptions()
    keyboard.initialText = initial
    keyboard.enablePreview = true
    keyboard.keyboardType = TextInputSystem.KeyboardType.Text
    keyboard.returnKeyType = TextInputSystem.ReturnKeyType.Done
    keyboard.onTextChanged = text => { value = text }
    keyboard.onKeyboardStateChanged = open => print("[GuitarPractice] " + field + " keyboard " + (open ? "opened" : "closed"))
    keyboard.onError = code => print("[GuitarPractice] " + field + " keyboard error " + code)
    keyboard.onReturnKeyPressed = () => {
      commit(value)
      global.textInputSystem.dismissKeyboard()
    }
    global.textInputSystem.requestKeyboard(keyboard)
  }

  private render(): void {
    const v = this.view
    const setup = v.phase === "setup"
    const paused = v.phase === "paused"
    const playing = v.phase === "playing" || (paused && v.cue?.phase === "playing")
    const counting = v.phase === "count-in" || (paused && v.cue?.phase === "count-in")
    const editing = v.phase === "editor"
    const library = v.phase === "library"
    const saved = library && (v.saved?.open ?? false)
    const deleting = editing ? v.saved?.deleting : undefined
    const picker = editing && v.editor?.picker
    const importing = editing ? v.chartImport : undefined
    const practice = v.song.id === "practice"
    const placement = v.phase === "placement"
    const cue = v.cue
    const activeGuide = v.showReference && !paused && (playing || counting)
    if (this.previewArtwork) this.previewArtwork.enabled = placement || activeGuide || (setup && v.showReference)
    if (this.previewGuide) this.previewGuide.root.enabled = placement || activeGuide
    if (placement) this.previewGuide?.showAlignment(v.song.sections[Math.max(0, v.section)].steps[0].chord, v.song.meter)
    if (cue && (playing || counting)) this.previewGuide?.show(cue.current, counting,
      cue.beat, cue.meter, cue.chordBeat === 1)
    this.controls.setup.enabled = setup
    this.controls.running.enabled = playing || counting
    this.buttons.Pause.text = paused ? "Resume" : "Pause"
    this.options.enabled = setup
    this.sectionChoices.enabled = setup
    this.anticipation.enabled = playing
    this.audio.enabled = setup || paused
    const showMelody = v.melody?.available ?? false
    if (this.melodyButton.enabled !== showMelody) {
      this.melodyButton.enabled = showMelody
      this.audioLayout.refreshChildren()
    }
    if (showMelody) this.buttons.Melody.text = v.melody?.enabled ? "✓ Melody" : "Melody"
    this.pausedControls.enabled = paused
    this.library.enabled = library && !saved && !this.launchIntro
    this.savedLibrary.enabled = saved
    this.title.enabled = !this.launchIntro
    this.subtitle.enabled = !this.launchIntro
    this.deleteConfirmation.enabled = !!deleting
    if (saved && v.saved) {
      this.savedRows.forEach((row, index) => {
        const entry = v.saved!.songs[v.saved!.page * 4 + index]
        row.enabled = !!entry
        if (entry) this.buttons["SavedSong" + index].text = entry.title
      })
      this.setButtonVisible("SavedPrevious", v.saved.page > 0, this.savedNavigation)
      this.setButtonVisible("SavedNext", (v.saved.page + 1) * 4 < v.saved.songs.length, this.savedNavigation)
    }
    this.editor.enabled = editing && !picker && !importing && !deleting
    this.chordPicker.enabled = !!picker
    this.importPanel.enabled = !!importing
    this.alignmentControls.enabled = placement
    this.chartHandle.enabled = placement
    if (this.cueHandle) this.cueHandle.enabled = placement
    this.chartAlignment.showDefault(setup || library || editing || paused)
    this.chartHost.enabled = !(library || editing)
    this.title.text = deleting ? "Delete this song?" : placement ? (this.cueHandle ? "Place chart and cues" : "Place chart") : library ? (saved ? "My songs" : "Choose a song") : importing ? "Import chord chart" : picker ? "Pick a chord" : v.song.title
    this.subtitle.text = deleting ? deleting.title : library ? (saved ? (v.saved?.songs.length ? "Choose a saved song" : "No saved songs yet") :
      "Play your guitar with fingering and timing cues") :
      placement ? "Pinch and drag · Two hands to rotate or resize" :
      importing ? importing.bars + (importing.bars === 1 ? " bar per line" : " bars per line") + " · " + importing.meter + "/4" :
      picker ? v.editor!.chord : editing ? v.status ||
        (practice ? "Build a repeating loop · " : "Build your chord sequence · ") + v.bpm + " BPM" :
      v.bpm + " BPM · " + v.song.meter + " beats per bar"
    let lyric = playing || counting ? cue?.lyric ?? "" : ""
    if (!(library || editing)) {
      const section = v.song.sections[Math.max(0, v.section)]
      this.nowChart.show(cue?.current ?? section.steps[0].chord)
      const placementCue = placement ? cueForIndex(v.song.meter, v) : null
      if (placementCue) lyric = placementCue.lyric || section.steps.find(step => step.lyric)?.lyric || ""
      const next = placement ? placementCue?.next ?? null : playing ? cue?.next ?? null : null
      const showNext = next !== null
      if (this.nextHost.enabled !== showNext) {
        this.nextHost.enabled = showNext
        this.charts.refreshChildren()
      }
      if (next) this.nextChart.show(next)
      this.nowChart.setEmphasis(false, lyric ? 0.95 : 0)
      this.nextChart.setEmphasis(!!cue?.changeNext, lyric ? 0.95 : 0)
    }
    this.playbackLyric.text = lyric
    this.playbackLyric.enabled = !!lyric
    this.title.getTransform().setLocalPosition(new vec3(0, lyric ? 10 : 9, 0.08))
    this.subtitle.getTransform().setLocalPosition(new vec3(0, lyric ? 7.8 : 6.8, 0.08))
    if (placement) {
      this.layoutPlacementHandles()
      // Flex layout can reposition the diagrams on the frame after Next appears.
      this.placementRefresh.reset(0.04)
    }
    this.beat.enabled = playing
    if (counting && cue) {
      this.beat.text = (paused ? "Paused · count in   " : "Count in   ") + cue.beat + " / " + cue.meter
      this.subtitle.text = this.beat.text
    }
    if (playing && cue) {
      this.beat.text = "Beat " + cue.beat + " of " + cue.meter + (cue.chordBeat === 1 ? "   Strum" : "")
      this.subtitle.text = cue.sectionName + " · Bar " + cue.bar + " / " + cue.totalBars + " · " + v.bpm + " BPM"
    }
    if (paused) this.beat.text = "Paused · beat " + cue?.beat + " of " + cue?.meter
    this.beat.textFill.color = !paused && cue?.changeNext ? ORANGE : WHITE
    this.beat.size = cue?.changeNext ? 70 : 58
    if (setup) {
      this.buttons.PreviewGuitar.text = v.showReference ? "✓ Guitar guide" : "Guitar guide"
      let sectionLayoutChanged = false
      for (let index = -1; index < 2; index++) {
        const visible = index < v.song.sections.length
        if (this.sectionHosts[index + 1].enabled !== visible) {
          this.sectionHosts[index + 1].enabled = visible
          sectionLayoutChanged = true
        }
        this.buttons["SelectSection" + (index + 1)].text = (v.section === index ? "✓ " : "") +
          (index < 0 ? "Whole song" : v.song.sections[index]?.name ?? "")
      }
      if (sectionLayoutChanged) this.sectionLayout.refreshChildren()
    }
    if (playing && cue) {
      const beats = cue.beatsUntilChange ?? cue.beatsRemaining
      this.anticipation.text = cue.next ?
        (cue.changeNext ? "Change to " + cue.next + " on the next beat" :
          "Keep " + cue.current + " · " + cue.next + " in " + beats + " beats") :
        (v.repeat ? "Keep playing " + cue.current :
          "Keep " + cue.current + " · finish in " + beats + (beats === 1 ? " beat" : " beats"))
      if (paused) this.anticipation.text = "Resume when you are ready"
      this.anticipation.textFill.color = !paused && cue.changeNext ? ORANGE : WHITE
    }
    this.buttons.Repeat.text = v.repeat ? "Repeat on" : "Play once"
    this.setButtonVisible("Repeat", !practice, this.optionsLayout)
    this.buttons.Edit.text = practice ? "Edit loop" : v.song.id.startsWith("custom-") ? "Edit/Delete" : "Edit a copy"
    if (setup || paused) for (const instrument of ["guitar", "bass", "keys", "drums"] as Instrument[]) {
      this.buttons["Band" + instrument].text = (v.instruments[instrument] ? "✓ " : "") +
        instrument[0].toUpperCase() + instrument.slice(1)
    }
    this.legend.enabled = !this.launchIntro && (setup || (library && !!v.status))
    this.legend.getTransform().setLocalPosition(new vec3(0, setup ? -21.5 : -23.5, 0.1))
    this.legend.text = setup ? (v.status ? v.status + "\n" : "") +
      "O Open · X Skip · 1 Index · 2 Middle · 3 Ring · 4 Pinky" : v.status
    if (picker && v.editor) {
      const {root, quality} = chordParts(v.editor.chord)
      for (const note of CHORD_ROOTS) this.buttons["Root-" + note].text = (note === root ? "✓ " : "") + note
      for (const type of CHORD_QUALITIES) this.buttons["Quality-" + type].text =
        (type === quality ? "✓ " : "") + CHORD_QUALITY_LABELS[type]
    }
    if (importing) {
      this.buttons.ImportThree.text = importing.meter === 3 ? "✓ 3/4" : "3/4"
      this.buttons.ImportFour.text = importing.meter === 4 ? "✓ 4/4" : "4/4"
      this.buttons.PasteChart.text = importing.text.trim() ? "Edit pasted chart" : "Paste chart"
      this.importExample.text = "Example: [G]Start here [C]then change; [D]new line"
      this.importStatus.text = importing.error || (importing.text.trim() ? "Chart ready to review" : "Use a line break or ; between lines")
    }
    if (editing && !picker && !importing && !deleting) {
      const steps = v.song.sections[0].steps
      const page = Math.floor(v.cursor / 6) * 6
      this.sequence.text = steps.length ? steps.slice(page, page + 6).map((step, i) =>
        (page + i === v.cursor ? "[" + step.chord + "]" : step.chord)).join("  →  ") :
        "Start with Add chord"
      const selected = steps[v.cursor]
      this.selection.text = selected ? (v.cursor + 1) + " / " + steps.length + " · " +
        selected.chord + " · " + selected.beats + (selected.beats === 1 ? " beat" : " beats") : ""
      this.editorLyric.text = selected?.lyric ?? ""
      this.buttons.EditLyric.text = selected?.lyric ? "Edit lyrics" : "Add lyrics"
      this.setButtonVisible("EditLyric", !!selected && !practice, this.editorChordActions)
      this.setButtonVisible("ImportChart", !selected && !practice, this.editorChordActions)
      this.editorNavigation.enabled = !!selected
      this.editorOrder.enabled = !!selected
      this.setButtonVisible("NameSong", !practice, this.editorInfo)
      this.setButtonVisible("NewLoop", practice && !!selected, this.editorInfo)
      this.buttons.NameSong.text = v.song.title === "Untitled song" ? "Name song" : "Rename song"
      this.buttons.SaveChart.text = practice ? "Play loop" : "Save song"
      this.setButtonVisible("SaveChart", !!selected, this.editorSave)
      this.setButtonVisible("DeleteSong", v.saved?.songs.some(song => song.id === v.song.id) ?? false, this.editorSave)
      this.editorChordActions.getTransform().setLocalPosition(new vec3(0, selected ? -16.2 : -7, 0.1))
      const change = this.buttons.ChangeChord.getSceneObject()
      const append = this.buttons.Append.getSceneObject()
      if (change.enabled !== !!selected || append.enabled !== (steps.length < MAX_CHORD_STEPS)) {
        change.enabled = !!selected
        append.enabled = steps.length < MAX_CHORD_STEPS
        this.editorChordActions.refreshChildren()
      }
      this.buttons.Meter.text = v.song.meter + " beats/bar"
    }
  }

  private setButtonVisible(name: string, visible: boolean, row: FlexLayout): void {
    const object = this.buttons[name].getSceneObject()
    if (object.enabled === visible) return
    object.enabled = visible
    row.refreshChildren()
  }
}
