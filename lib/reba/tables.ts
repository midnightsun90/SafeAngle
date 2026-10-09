import { integerInRange } from "../validation.ts";

// Columns follow docs/evaluation-axes.md: neck/legs, lower arm/wrist, then B.
export const TABLE_A = [
  [1,2,3,4,1,2,3,4,3,3,5,6], [2,3,4,5,3,4,5,6,4,5,6,7],
  [2,4,5,6,4,5,6,7,5,6,7,8], [3,5,6,7,5,6,7,8,6,7,8,9],
  [4,6,7,8,6,7,8,9,7,8,9,9],
] as const;
export const TABLE_B = [
  [1,2,2,1,2,3], [1,2,3,2,3,4], [3,4,5,4,5,5],
  [4,5,5,5,6,7], [6,7,8,7,8,8], [7,8,8,8,9,9],
] as const;
export const TABLE_C = [
  [1,1,1,2,3,3,4,5,6,7,7,7], [1,2,2,3,4,4,5,6,6,7,7,8],
  [2,3,3,3,4,5,6,7,7,8,8,8], [3,4,4,4,5,6,7,8,8,9,9,9],
  [4,4,4,5,6,7,8,8,9,9,9,9], [6,6,6,7,8,8,9,9,10,10,10,10],
  [7,7,7,8,9,9,9,10,10,11,11,11], [8,8,8,9,10,10,10,10,10,11,11,11],
  [9,9,9,10,10,10,11,11,11,12,12,12], [10,10,10,11,11,11,11,12,12,12,12,12],
  [11,11,11,11,12,12,12,12,12,12,12,12], [12,12,12,12,12,12,12,12,12,12,12,12],
] as const;
export function lookupA(trunk: number, neck: number, legs: number): number {
  integerInRange(trunk,1,5,"trunk score"); integerInRange(neck,1,3,"neck score"); integerInRange(legs,1,4,"legs score");
  return TABLE_A[trunk-1]![(neck-1)*4+legs-1]!;
}
export function lookupB(upperArm: number, lowerArm: number, wrist: number): number {
  integerInRange(upperArm,1,6,"upper arm score"); integerInRange(lowerArm,1,2,"lower arm score"); integerInRange(wrist,1,3,"wrist score");
  return TABLE_B[upperArm-1]![(lowerArm-1)*3+wrist-1]!;
}
export function lookupC(a: number, b: number): number {
  integerInRange(a,1,12,"A score"); integerInRange(b,1,12,"B score");
  return TABLE_C[a-1]![b-1]!;
}
