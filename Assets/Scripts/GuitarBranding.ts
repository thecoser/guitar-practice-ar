import {createChildSceneObjectWithParentLayer} from "UIKit.lspkg/Scripts/Utility/SceneUtilities"

const FRAME_RATE = 30
const FRAME_COLUMNS = 8
const FRAME_ROWS = 8
const FRAME_PIXELS = 256
const INTRO_DURATION = 2.8

class BrandingImage {
  readonly root: SceneObject
  private readonly mesh: MeshBuilder

  constructor(parent: SceneObject, name: string, texture: Texture, private readonly halfSize: number,
              y: number) {
    this.root = createChildSceneObjectWithParentLayer(name, parent)
    this.root.getTransform().setLocalPosition(new vec3(0, y, 0.12))
    const material = (requireAsset("PreviewArtwork/PlayerGuitarArtwork.mat") as Material).clone()
    material.mainPass.baseTex = texture
    const visual = this.root.createComponent("Component.RenderMeshVisual")
    visual.addMaterial(material)
    this.mesh = new MeshBuilder([{name: "position", components: 3}, {name: "texture0", components: 2}])
    this.mesh.topology = MeshTopology.Triangles
    this.mesh.indexType = MeshIndexType.UInt16
    this.mesh.appendVerticesInterleaved(new Array<number>(20).fill(0))
    this.mesh.appendIndices([0, 1, 2, 0, 2, 3])
    this.setUV(0, 0, 1, 1)
    visual.mesh = this.mesh.getMesh()
  }

  setUV(left: number, bottom: number, right: number, top: number): void {
    const s = this.halfSize
    this.mesh.setVertexInterleaved(0, [-s, -s, 0, left, bottom])
    this.mesh.setVertexInterleaved(1, [s, -s, 0, right, bottom])
    this.mesh.setVertexInterleaved(2, [s, s, 0, right, top])
    this.mesh.setVertexInterleaved(3, [-s, s, 0, left, top])
    this.mesh.updateMesh()
  }
}

export function createSongPickerIcon(parent: SceneObject): void {
  new BrandingImage(parent, "SongPickerBrandIcon",
    requireAsset("Branding/SongPickerIcon.png") as Texture, 4.3, 15.5)
}

export class GuitarLaunchIntro {
  private readonly image: BrandingImage
  private readonly audio: AudioComponent
  private beganAt: number | null = null
  private frame = -1

  constructor(parent: SceneObject) {
    this.image = new BrandingImage(parent, "GuitarLaunchIntro",
      requireAsset("Branding/LaunchFrames.jpg") as Texture, 17, 0)
    this.audio = this.image.root.createComponent("Component.AudioComponent")
    this.audio.audioTrack = requireAsset("Branding/LaunchStrum.wav") as AudioTrackAsset
    this.audio.playbackMode = Audio.PlaybackMode.LowLatency
    this.audio.volume = 0.7
    this.showFrame(0)
  }

  update(): boolean {
    const now = getTime()
    if (this.beganAt === null) {
      this.beganAt = now
      this.audio.play(1)
    }
    const elapsed = now - this.beganAt
    if (elapsed >= INTRO_DURATION) {
      this.image.root.destroy()
      return false
    }
    this.showFrame(Math.min(FRAME_ROWS * FRAME_COLUMNS - 1, Math.floor(elapsed * FRAME_RATE)))
    return true
  }

  private showFrame(frame: number): void {
    if (this.frame === frame) return
    this.frame = frame
    const inset = 0.5 / FRAME_PIXELS
    const column = frame % FRAME_COLUMNS
    const row = Math.floor(frame / FRAME_COLUMNS)
    this.image.setUV(
      (column + inset) / FRAME_COLUMNS, 1 - (row + 1 - inset) / FRAME_ROWS,
      (column + 1 - inset) / FRAME_COLUMNS, 1 - (row + inset) / FRAME_ROWS)
  }
}
