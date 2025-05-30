import { Node } from '../core/nodes/Node.js';
import * as THREE from 'three';
import type { AvatarFactory, AvatarInstance } from '../../types/index.js';
interface AvatarProxy {
    [key: string]: unknown;
    src: string | null;
    emote: string | null;
    onLoad: (() => void) | null;
    getHeight(): number | null;
    getHeadToHeight(): number | null;
    getBoneTransform(boneName: string): THREE.Matrix4;
    setEmote(url: string | null): void;
    height: number | null;
}
export declare class AgentAvatar extends Node {
    private _src;
    private _emote;
    private _onLoad;
    factory: AvatarFactory | null;
    hooks: unknown;
    instance: AvatarInstance | null;
    private n;
    private needsRebuild;
    private isLoading;
    constructor(data?: Partial<{
        id: string;
        src: string;
        emote: string;
        onLoad: () => void;
        factory: AvatarFactory;
        hooks: unknown;
    }>);
    mount(): Promise<void>;
    commit(didMove: boolean): void;
    unmount(): void;
    applyStats(stats: unknown): void;
    get src(): string | null;
    set src(value: string | null);
    get emote(): string | null;
    set emote(value: string | null);
    get onLoad(): (() => void) | null;
    set onLoad(value: (() => void) | null);
    getHeight(): number | null;
    getHeadToHeight(): number | null;
    getBoneTransform(_boneName: string): THREE.Matrix4;
    setEmote(url: string | null): void;
    get height(): number | null;
    copy(source: AgentAvatar, recursive: boolean): this;
    getProxy(): AvatarProxy;
}
export {};
//# sourceMappingURL=avatar.d.ts.map