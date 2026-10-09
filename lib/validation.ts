export function numberInRange(value: unknown, min: number, max: number, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${field}: ${min}..${max} 사이의 유한한 숫자가 필요합니다.`);
  }
}

export function integerInRange(value: unknown, min: number, max: number, field: string): asserts value is number {
  numberInRange(value, min, max, field);
  if (!Number.isInteger(value)) throw new RangeError(`${field}: 정수가 필요합니다.`);
}

export function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field}: 객체가 필요합니다.`);
  }
}
