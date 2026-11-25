import {AlignmentAxis} from "./GuitarPracticeView";

type Pose = {position: vec3; rotation: quat; scale: vec3};
type PlacementBounds = {minOffset: vec3; maxOffset: vec3; maxAngle: number; minScale: number; maxScale: number};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Session-only placement of a chart or cue overlay.
export class GuitarPreviewAlignment {
  private original: Pose;
  private entry: Pose | null = null;
  private placedPose: Pose | null = null;
  private axes = quat.quatIdentity();

  constructor(private readonly root: SceneObject, private readonly bounds: number | PlacementBounds) {
    this.original = this.capture();
  }

  rebase(): void {
    this.original = this.capture();
    if (this.placedPose) this.placedPose = this.original;
  }

  showDefault(show: boolean): void {
    if (show && !this.placedPose) {
      this.placedPose = this.capture();
      this.apply(this.original);
    } else if (!show && this.placedPose) {
      this.apply(this.placedPose);
      this.placedPose = null;
    }
  }

  begin(cameraRotation: quat): void {
    this.showDefault(false);
    this.entry = this.capture();
    this.axes = cameraRotation;
  }

  adjust(axis: AlignmentAxis, delta: number): void {
    if (!this.entry || !Number.isFinite(delta) || Math.abs(delta) !== 1) return;
    const pose = this.capture();
    const direction = new vec3(axis === "x" ? delta : 0, axis === "y" ? delta : 0, 0);
    pose.position = pose.position.add(this.axes.multiplyVec3(direction));
    this.apply(pose);
    this.limitPose();
  }

  limitPose(): void {
    if (!this.entry) return;
    const t = this.root.getTransform();
    const offset = t.getWorldPosition().sub(this.original.position);
    const bounds = this.bounds;
    if (typeof bounds === "number") {
      if (offset.length > bounds) {
        t.setWorldPosition(this.original.position.add(offset.uniformScale(bounds / offset.length)));
      }
      return;
    }
    const basis = this.original.rotation;
    const local = basis.invert().multiplyVec3(offset);
    const limited = new vec3(clamp(local.x, bounds.minOffset.x, bounds.maxOffset.x),
      clamp(local.y, bounds.minOffset.y, bounds.maxOffset.y),
      clamp(local.z, bounds.minOffset.z, bounds.maxOffset.z));
    if (limited.distance(local) > 0.0001) {
      t.setWorldPosition(this.original.position.add(basis.multiplyVec3(limited)));
    }
    const rotation = t.getWorldRotation();
    const angle = quat.angleBetween(basis, rotation);
    if (angle > bounds.maxAngle) t.setWorldRotation(quat.slerp(basis, rotation, bounds.maxAngle / angle));
    const ratio = t.getWorldScale().x / this.original.scale.x;
    const scale = clamp(ratio, bounds.minScale, bounds.maxScale);
    if (ratio !== scale) t.setWorldScale(this.original.scale.uniformScale(scale));
  }

  reset(): void { if (this.entry) this.apply(this.original); }
  finish(confirm: boolean): void {
    if (!this.entry) return;
    if (confirm) this.limitPose();
    else this.apply(this.entry);
    this.entry = null;
  }

  state() {
    const pose = this.placedPose ?? this.capture();
    return {position: [pose.position.x, pose.position.y, pose.position.z],
      rotation: [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
      scale: [pose.scale.x, pose.scale.y, pose.scale.z],
      scalePercent: Math.round(pose.scale.x / this.original.scale.x * 100)};
  }

  private capture(): Pose {
    const t = this.root.getTransform();
    return {position: t.getWorldPosition(), rotation: t.getWorldRotation(), scale: t.getWorldScale()};
  }
  private apply(pose: Pose): void {
    const t = this.root.getTransform();
    t.setWorldPosition(pose.position);
    t.setWorldRotation(pose.rotation);
    t.setWorldScale(pose.scale);
  }
}
