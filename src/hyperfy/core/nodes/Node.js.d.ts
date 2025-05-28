import type * as THREE from 'three';

export interface NodeData {
  id?: string;
  active?: boolean;
  position?: [number, number, number];
  quaternion?: [number, number, number, number];
  scale?: [number, number, number];
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  cursor?: string;
}

export interface NodeContext {
  world: {
    stage: {
      dirtyNodes: Set<Node>;
    };
    loader?: unknown;
    setHot?: (instance: unknown, value: boolean) => void;
  };
}

export declare function getRef(pNode: unknown): Node | unknown;
export declare function secureRef(obj: unknown, getRef: () => Node): unknown;

export declare class Node {
  id: string;
  name: string;
  parent: Node | null;
  children: Node[];
  ctx: NodeContext | null;
  
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  matrixWorld: THREE.Matrix4;
  
  isDirty: boolean;
  isTransformed: boolean;
  mounted: boolean;
  
  private _active: boolean;
  private _onPointerEnter?: () => void;
  private _onPointerLeave?: () => void;
  private _onPointerDown?: () => void;
  private _onPointerUp?: () => void;
  private _cursor?: string;
  
  proxy?: unknown;
  
  constructor(data?: NodeData);
  
  activate(ctx?: NodeContext): void;
  deactivate(): void;
  add(node: Node): this;
  remove(node: Node): this;
  
  setTransformed(): void;
  setDirty(): void;
  
  get active(): boolean;
  set active(value: boolean);
  
  clean(): void;
  mount(): void;
  commit(didTransform?: boolean): void;
  unmount(): void;
  updateTransform(): void;
  traverse(callback: (node: Node) => void): void;
  clone(recursive?: boolean): this;
  copy(source: Node, recursive?: boolean): this;
  get(id: string): Node | undefined;
  getWorldPosition(vec3?: THREE.Vector3): THREE.Vector3;
  getWorldMatrix(mat?: THREE.Matrix4): THREE.Matrix4;
  getStats(recursive?: boolean, stats?: unknown): unknown;
  applyStats(stats: unknown): void;
  
  get onPointerEnter(): (() => void) | undefined;
  set onPointerEnter(value: (() => void) | undefined);
  get onPointerLeave(): (() => void) | undefined;
  set onPointerLeave(value: (() => void) | undefined);
  get onPointerDown(): (() => void) | undefined;
  set onPointerDown(value: (() => void) | undefined);
  get onPointerUp(): (() => void) | undefined;
  set onPointerUp(value: (() => void) | undefined);
  get cursor(): string | undefined;
  set cursor(value: string | undefined);
  
  getProxy(): unknown;
} 