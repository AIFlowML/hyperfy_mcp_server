import type { Vector3, Quaternion, Euler, Matrix3, Matrix4, Camera } from 'three';

export class Vector3Enhanced {
  isVector3: true;
  isVector3Enhanced: true;
  
  x: number;
  y: number;
  z: number;
  
  constructor(x?: number, y?: number, z?: number);
  
  set(x: number, y: number, z: number): this;
  setScalar(scalar: number): this;
  setX(x: number): this;
  setY(y: number): this;
  setZ(z: number): this;
  setComponent(index: number, value: number): this;
  getComponent(index: number): number;
  
  clone(): Vector3Enhanced;
  copy(v: Vector3Enhanced | Vector3): this;
  
  add(v: Vector3Enhanced | Vector3): this;
  addScalar(s: number): this;
  addVectors(a: Vector3Enhanced | Vector3, b: Vector3Enhanced | Vector3): this;
  addScaledVector(v: Vector3Enhanced | Vector3, s: number): this;
  
  sub(v: Vector3Enhanced | Vector3): this;
  subScalar(s: number): this;
  subVectors(a: Vector3Enhanced | Vector3, b: Vector3Enhanced | Vector3): this;
  
  multiply(v: Vector3Enhanced | Vector3): this;
  multiplyScalar(scalar: number): this;
  multiplyVectors(a: Vector3Enhanced | Vector3, b: Vector3Enhanced | Vector3): this;
  
  applyEuler(euler: Euler): this;
  applyAxisAngle(axis: Vector3Enhanced | Vector3, angle: number): this;
  applyMatrix3(m: Matrix3): this;
  applyNormalMatrix(m: Matrix3): this;
  applyMatrix4(m: Matrix4): this;
  applyQuaternion(q: Quaternion): this;
  
  project(camera: Camera): this;
  unproject(camera: Camera): this;
  transformDirection(m: Matrix4): this;
  
  divide(v: Vector3Enhanced | Vector3): this;
  divideScalar(scalar: number): this;
  
  min(v: Vector3Enhanced | Vector3): this;
  max(v: Vector3Enhanced | Vector3): this;
  clamp(min: Vector3Enhanced | Vector3, max: Vector3Enhanced | Vector3): this;
  clampScalar(minVal: number, maxVal: number): this;
  clampLength(min: number, max: number): this;
  
  floor(): this;
  ceil(): this;
  round(): this;
  roundToZero(): this;
  negate(): this;
  
  dot(v: Vector3Enhanced | Vector3): number;
  lengthSq(): number;
  length(): number;
  manhattanLength(): number;
  normalize(): this;
  setLength(length: number): this;
  
  lerp(v: Vector3Enhanced | Vector3, alpha: number): this;
  lerpVectors(v1: Vector3Enhanced | Vector3, v2: Vector3Enhanced | Vector3, alpha: number): this;
  
  cross(v: Vector3Enhanced | Vector3): this;
  crossVectors(a: Vector3Enhanced | Vector3, b: Vector3Enhanced | Vector3): this;
  projectOnVector(v: Vector3Enhanced | Vector3): this;
  projectOnPlane(planeNormal: Vector3Enhanced | Vector3): this;
  reflect(normal: Vector3Enhanced | Vector3): this;
  
  angleTo(v: Vector3Enhanced | Vector3): number;
  distanceTo(v: Vector3Enhanced | Vector3): number;
  distanceToSquared(v: Vector3Enhanced | Vector3): number;
  manhattanDistanceTo(v: Vector3Enhanced | Vector3): number;
  
  setFromSpherical(s: unknown): this;
  setFromSphericalCoords(radius: number, phi: number, theta: number): this;
  setFromCylindrical(c: unknown): this;
  setFromCylindricalCoords(radius: number, theta: number, y: number): this;
  setFromMatrixPosition(m: Matrix4): this;
  setFromMatrixScale(m: Matrix4): this;
  setFromMatrixColumn(m: Matrix4, index: number): this;
  setFromMatrix3Column(m: Matrix3, index: number): this;
  setFromEuler(e: Euler): this;
  setFromColor(c: unknown): this;
  
  equals(v: Vector3Enhanced | Vector3): boolean;
  fromArray(array: number[], offset?: number): this;
  toArray(array?: number[], offset?: number): number[];
  fromBufferAttribute(attribute: unknown, index: number): this;
  
  random(): this;
  randomDirection(): this;
  
  _onChange(callback: () => void): this;
  _onChangeCallback(): void;
} 