import { System } from '../core/systems/System.js';
import * as THREE from 'three';
interface ButtonState {
    $button: true;
    down: boolean;
    pressed: boolean;
    released: boolean;
}
interface CameraObject {
    $camera: true;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    rotation: THREE.Euler;
    zoom: number;
    write: boolean;
}
interface ControlsObject {
    value: number;
}
interface PointerObject {
    locked: boolean;
    delta: {
        x: number;
        y: number;
    };
}
interface StickObject {
    value: {
        x: number;
        y: number;
        z: number;
    };
}
export declare class AgentControls extends System {
    world: {
        entities?: {
            player?: {
                base: {
                    position: THREE.Vector3;
                    quaternion: THREE.Quaternion;
                };
                cam: {
                    rotation: THREE.Euler;
                };
            };
        };
        rig?: {
            position: THREE.Vector3;
            quaternion: THREE.Quaternion;
            rotation: THREE.Euler;
        };
        camera?: {
            position?: {
                z: number;
            };
        };
    };
    scrollDelta: ControlsObject;
    pointer: PointerObject;
    camera: CameraObject | undefined;
    screen: HTMLElement | undefined;
    xrLeftStick: StickObject;
    xrRightStick: StickObject;
    keyW: ButtonState;
    keyA: ButtonState;
    keyS: ButtonState;
    keyD: ButtonState;
    space: ButtonState;
    shiftLeft: ButtonState;
    shiftRight: ButtonState;
    controlLeft: ButtonState;
    keyC: ButtonState;
    keyF: ButtonState;
    keyE: ButtonState;
    arrowUp: ButtonState;
    arrowDown: ButtonState;
    arrowLeft: ButtonState;
    arrowRight: ButtonState;
    touchA: ButtonState;
    touchB: ButtonState;
    xrLeftBtn1: ButtonState;
    xrLeftBtn2: ButtonState;
    xrRightBtn1: ButtonState;
    xrRightBtn2: ButtonState;
    private _navigationTarget;
    private _isNavigating;
    private _currentNavKeys;
    private _navigationResolve;
    private _currentWalkToken;
    private _isRandomWalking;
    constructor(world: unknown);
    setKey(keyName: string, isDown: boolean): void;
    postLateUpdate(): void;
    /**
     * Starts the agent walking to random nearby points.
     */
    startRandomWalk(interval?: number, maxDistance?: number, duration?: number): Promise<void>;
    /**
     * Stops the random walk process.
     */
    stopRandomWalk(): void;
    /**
     * Starts navigating the agent towards the target X, Z coordinates.
     */
    goto(x: number, z: number): Promise<void>;
    /**
     * Stops the current navigation process AND random walk if active.
     */
    stopNavigation(reason?: string): void;
    /**
     * Internal navigation method that moves the agent towards a target (x, z) position.
     * It sets the player's rotation to face the direction of travel and simulates key presses
     * (e.g., 'W' for forward movement) until the agent reaches the destination or navigation is stopped.
     *
     * This method is isolated and does not handle random walk logic — it's a low-level navigation primitive.
     * Should be called by `goto` or `startRandomWalk` with an optional NavigationToken to allow early cancellation.
     */
    private startNavigation;
    /**
     * Returns whether the agent is currently navigating towards a target.
     */
    getIsNavigating(): boolean;
    getIsWalkingRandomly(): boolean;
    /** Helper to check if player and base position/quaternion are valid */
    private _validatePlayerState;
    createCamera(self: AgentControls): CameraObject;
    bind(options: unknown): this;
    release(): void;
    setActions(): void;
}
export {};
//# sourceMappingURL=controls.d.ts.map