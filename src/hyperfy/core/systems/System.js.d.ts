import EventEmitter from 'eventemitter3';

export class System extends EventEmitter {
  world: unknown;
  
  constructor(world: unknown);
  
  init(): Promise<void>;
  start(): void;
  preTick(): void;
  preFixedUpdate(willFixedStep: boolean): void;
  fixedUpdate(delta: number): void;
  postFixedUpdate(): void;
  preUpdate(alpha: number): void;
  update(delta: number): void;
  postUpdate(): void;
  lateUpdate(delta: number): void;
  postLateUpdate(): void;
  commit(): void;
  postTick(): void;
  destroy(): void;
} 