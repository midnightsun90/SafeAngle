import type { Facing, FrameSize, PartName } from "../types.ts";

export interface Point { x: number; y: number }
export type JointPoints = Record<"ear" | "shoulder" | "elbow" | "wrist" | "index" | "hip" | "knee" | "ankle", Point | null>;
export function pixel(point: Point, size: FrameSize): Point { return { x: point.x * size.width, y: point.y * size.height }; }
export function length(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
export function flexion(a: Point, center: Point, b: Point): number | null {
  const denominator = length(a, center) * length(b, center);
  if (denominator < 1e-8) return null;
  const cosine = ((a.x - center.x) * (b.x - center.x) + (a.y - center.y) * (b.y - center.y)) / denominator;
  return 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
export function wrap(degrees: number, lower: number): number {
  const value = ((degrees - lower) % 360 + 360) % 360 + lower;
  return value === lower ? lower + 360 : value;
}
export const ANGLE_JOINTS = {
  trunk: ["hip", "shoulder"], neck: ["hip", "shoulder", "ear"], upperArm: ["hip", "shoulder", "elbow"],
  lowerArm: ["shoulder", "elbow", "wrist"], knee: ["hip", "knee", "ankle"], wrist: ["elbow", "wrist", "index"],
} as const;
export function calculateAngle(part: PartName, points: JointPoints, size: FrameSize, facing: Facing | null, neckOffset = 0): number | null {
  const names = ANGLE_JOINTS[part];
  if (names.some(name => points[name] === null)) return null;
  const p = (name: keyof JointPoints) => pixel(points[name]!, size);
  if (names.slice(1).some((name, i) => length(p(names[i]!), p(name)) < 1e-8)) return null;
  const signed = part === "trunk" || part === "neck" || part === "upperArm";
  if (signed && facing === null) return null;
  const degrees = 180 / Math.PI;
  const trunk = () => Math.atan2(facing! * (p("shoulder").x - p("hip").x), -(p("shoulder").y - p("hip").y)) * degrees;
  switch (part) {
    case "trunk": return trunk();
    case "neck": return wrap(Math.atan2(facing! * (p("ear").x - p("shoulder").x), -(p("ear").y - p("shoulder").y)) * degrees - trunk() - neckOffset, -180);
    case "upperArm": return wrap(Math.atan2(facing! * (p("elbow").x - p("shoulder").x), p("elbow").y - p("shoulder").y) * degrees + trunk(), -90);
    case "lowerArm": return flexion(p("shoulder"), p("elbow"), p("wrist"));
    case "knee": return flexion(p("hip"), p("knee"), p("ankle"));
    case "wrist": return flexion(p("elbow"), p("wrist"), p("index"));
  }
}
