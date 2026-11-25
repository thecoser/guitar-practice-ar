import {createChildSceneObjectWithParentLayer} from "UIKit.lspkg/Scripts/Utility/SceneUtilities"
import {Chord} from "./GuitarPracticeSongs"
import {fingerTargets, previewFingerPoint} from "./GuitarFingerings"

// Live cues have their own placement relative to the fixed Preview fixture.
export class GuitarPreviewGuide {
  readonly root: SceneObject
  private readonly targets: SceneObject[] = []
  private readonly digits: Text[] = []
  private readonly leaders: RenderMeshVisual[] = []
  private readonly heading: Text
  private readonly strum: Text
  private chord: Chord | null = null

  constructor(artwork: SceneObject, material: Material) {
    this.root = createChildSceneObjectWithParentLayer("FretboardFingerGuide", artwork)
    this.root.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    const cyan = material.clone()
    cyan.mainPass.baseColor = new vec4(0.2, 1, 0.9, 1)
    cyan.mainPass.depthTest = false
    cyan.mainPass.depthWrite = false
    this.heading = this.text("FretboardInstruction", "", -17.8, 10.7, 45)
    this.strum = this.text("GuitarStrumCue", "", 12.8, -6.5, 56)
    this.strum.textFill.color = new vec4(1, 1, 1, 1)
    for (let i = 0; i < 4; i++) {
      const target = createChildSceneObjectWithParentLayer("FretboardTarget" + i, this.root)
      const visual = target.createComponent("Component.RenderMeshVisual")
      visual.mesh = this.ring()
      visual.addMaterial(cyan)
      visual.setRenderOrder(10)
      this.targets.push(target)
      // Spread the numbered callouts above the neck so adjacent strings remain legible.
      this.digits.push(this.text("FretboardFinger" + i, "", -22.8 + i * 3.4, 8.4, 60))
      const line = createChildSceneObjectWithParentLayer("FingerLeader" + i, this.root)
      const leader = line.createComponent("Component.RenderMeshVisual")
      leader.addMaterial(cyan)
      leader.setRenderOrder(10)
      this.leaders.push(leader)
    }
  }

  show(chord: Chord, preparing: boolean, beat: number, meter: number, strike: boolean): void {
    this.strum.text = preparing ? "Ready " + beat + "/" + meter :
      strike ? "STRUM" : "Beat " + beat + "/" + meter
    this.strum.size = strike && !preparing ? 64 : 48
    this.heading.text = preparing ? "Get ready · " + chord : "Now · " + chord
    const targets = fingerTargets(chord).sort((a, b) => a.finger - b.finger)
    const fits = targets.every(target => target.fret <= 3)
    if (!fits) this.heading.text = "Use chart · " + chord
    if (this.chord === chord) return
    this.chord = chord
    for (let i = 0; i < this.targets.length; i++) {
      const target = fits ? targets[i] : undefined
      this.targets[i].enabled = !!target
      this.digits[i].enabled = !!target
      this.leaders[i].enabled = !!target
      if (!target) continue
      const point = previewFingerPoint(target.string, target.fret)
      this.targets[i].getTransform().setLocalPosition(new vec3(point.x, point.y, 0.05))
      this.digits[i].text = String(target.finger)
      this.leaders[i].mesh = this.line(-22.8 + i * 3.4, 7.7, point.x, point.y)
    }
  }

  showAlignment(chord: Chord, meter: number): void {
    this.show(chord, true, 1, meter, false)
    if (fingerTargets(chord).every(target => target.fret <= 3)) this.heading.text = "Example fingering · " + chord
    this.strum.text = "Sound hole"
  }

  private text(name: string, value: string, x: number, y: number, size: number): Text {
    const host = createChildSceneObjectWithParentLayer(name, this.root)
    host.getTransform().setLocalPosition(new vec3(x, y, 0.1))
    const text = host.createComponent("Component.Text")
    text.setRenderOrder(11)
    text.depthTest = false
    text.text = value
    text.size = size
    text.weight = 750
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.layoutRect = Rect.create(-12, 12, -1, 1)
    text.textFill.color = new vec4(0.2, 1, 0.9, 1)
    return text
  }

  private mesh(vertices: number[], indices: number[]): RenderMesh {
    const builder = new MeshBuilder([{name: "position", components: 3}])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    builder.appendVerticesInterleaved(vertices)
    builder.appendIndices(indices)
    const mesh = builder.getMesh()
    builder.updateMesh()
    return mesh
  }

  private ring(): RenderMesh {
    const vertices: number[] = [], indices: number[] = []
    for (let i = 0; i < 24; i++) {
      const a = i * 2 * Math.PI / 24
      for (const r of [0.30, 0.17]) vertices.push(Math.cos(a) * r, Math.sin(a) * r, 0)
      const n = (i + 1) % 24
      indices.push(i * 2, n * 2, i * 2 + 1, i * 2 + 1, n * 2, n * 2 + 1)
    }
    return this.mesh(vertices, indices)
  }

  private line(x1: number, y1: number, x2: number, y2: number): RenderMesh {
    const dx = x2 - x1, dy = y2 - y1, length = Math.sqrt(dx * dx + dy * dy)
    const x = -dy / length * 0.025, y = dx / length * 0.025
    return this.mesh([x1-x,y1-y,0, x1+x,y1+y,0, x2+x,y2+y,0, x2-x,y2-y,0], [0,2,1,0,3,2])
  }
}
