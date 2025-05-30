import { System } from '../core/systems/System.js';
import type * as THREE from 'three';
interface ActionNode extends THREE.Object3D {
    [key: string]: unknown;
    finished?: boolean;
    _label?: string;
    ctx: {
        entity: {
            root: {
                position: THREE.Vector3;
            };
            data?: {
                id: string;
            };
            blueprint?: {
                name?: string;
            };
        };
    };
    _onTrigger?: (params: {
        playerId: string;
    }) => void;
    _onCancel?: () => void;
    _duration?: number;
}
export interface WorldType {
    rig: {
        position: THREE.Vector3;
    };
    controls: {
        setKey: (key: string, value: boolean) => void;
        keyX: {
            pressed: boolean;
            released: boolean;
            onPress?: () => void;
            onRelease?: () => void;
        };
    };
    entities: {
        player: {
            data: {
                id: string;
            };
        };
    };
}
export declare class AgentActions extends System {
    private nodes;
    private currentNode;
    constructor(world: WorldType);
    register(node: ActionNode): void;
    unregister(node: ActionNode): void;
    getNearby(maxDistance?: number): ActionNode[];
    performAction(entityID?: string): void;
    releaseAction(): void;
    start(): void;
    preTick(): void;
    preFixedUpdate(): void;
    fixedUpdate(): void;
    postFixedUpdate(): void;
    preUpdate(): void;
    update(): void;
    postUpdate(): void;
    lateUpdate(): void;
    postLateUpdate(): void;
    commit(): void;
    postTick(): void;
    getCurrentNode(): ActionNode | null;
}
export {};
//# sourceMappingURL=actions.d.ts.map