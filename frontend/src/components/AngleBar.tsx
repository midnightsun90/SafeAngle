import type { PartName } from "../../../lib/types.ts";

export const angleParts: { key: PartName; label: string; note: string; min: number; max: number }[] = [
  { key: "neck", label: "목", note: "몸통 대비 기울기 · 근사", min: -90, max: 90 },
  { key: "trunk", label: "몸통", note: "수직축 대비 기울기", min: -90, max: 90 },
  { key: "knee", label: "무릎", note: "곧게 펴면 0°", min: 0, max: 180 },
  { key: "upperArm", label: "위팔", note: "몸통 대비 각도", min: -180, max: 180 },
  { key: "lowerArm", label: "팔꿈치", note: "굽힘 각도 · 곧게 펴면 0°", min: 0, max: 180 },
  { key: "wrist", label: "손목", note: "굽힘 각도 · 근사", min: 0, max: 180 },
];

export default function AngleBar({ value, min, max }: { value: number | null; min: number; max: number }) {
  const position = value === null ? null : Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  return <div className="angle-bar" role="img" aria-label={value === null ? "측정 불가" : `${value.toFixed(1)}도, 표시 범위 ${min}도부터 ${max}도까지`}>
    <div className="angle-bar-track">{position !== null && <span className="angle-bar-marker" style={{ left: `${position}%` }} />}</div>
    <div className="angle-bar-range"><span>{min}°</span><span>{max}°</span></div>
  </div>;
}
