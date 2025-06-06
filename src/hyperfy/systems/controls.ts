import { System } from '../core/systems/System.js'
import { createLogger } from '../../utils/eliza-compat.js';
import * as THREE from 'three';
import { Vector3Enhanced } from '../core/extras/Vector3Enhanced.js'

// Create FastMCP-compatible logger
const logger = createLogger();

const FORWARD = new THREE.Vector3(0, 0, -1)
const v1 = new THREE.Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const q1 = new THREE.Quaternion()

// Define Navigation Constants
const NAVIGATION_TICK_INTERVAL = 100; // ms
const NAVIGATION_STOP_DISTANCE = 1.0; // meters
const RANDOM_WALK_DEFAULT_INTERVAL = 5000; // ms <-- SET TO 5 SECONDS
const RANDOM_WALK_DEFAULT_MAX_DISTANCE = 7; // meters

interface ButtonState {
  $button: true;
  down: boolean;
  pressed: boolean;
  released: boolean;
}

function createButtonState(): ButtonState {
  return {
    $button: true,
    down: false,
    pressed: false,
    released: false,
  }
}

class NavigationToken {
  private _isAborted = false;
  abort() { this._isAborted = true; }
  get aborted() { return this._isAborted; }
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
  delta: { x: number; y: number };
}

interface StickObject {
  value: { x: number; y: number; z: number };
}

// Type for dynamic button access to avoid 'any'
type DynamicKeyAccess = Record<string, ButtonState | ControlsObject | PointerObject | StickObject | CameraObject | HTMLElement | THREE.Vector3 | boolean | unknown>;

export class AgentControls extends System {
  // Explicitly declare world property inherited from System with proper typing
  declare world: {
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

  // Define expected control properties directly on the instance
  scrollDelta: ControlsObject = { value: 0 };
  pointer: PointerObject = { locked: false, delta: { x: 0, y: 0 } };
  camera: CameraObject | undefined = undefined; // PlayerLocal checks for this
  screen: HTMLElement | undefined = undefined; // PlayerLocal checks for this
  xrLeftStick: StickObject = { value: { x: 0, y: 0, z: 0 } };
  xrRightStick: StickObject = { value: { x: 0, y: 0, z: 0 } };
  
  // Initialize button states to avoid linter errors
  keyW: ButtonState = createButtonState();
  keyA: ButtonState = createButtonState();
  keyS: ButtonState = createButtonState();
  keyD: ButtonState = createButtonState();
  space: ButtonState = createButtonState();
  shiftLeft: ButtonState = createButtonState();
  shiftRight: ButtonState = createButtonState();
  controlLeft: ButtonState = createButtonState();
  keyC: ButtonState = createButtonState();
  keyF: ButtonState = createButtonState();
  keyE: ButtonState = createButtonState();
  arrowUp: ButtonState = createButtonState();
  arrowDown: ButtonState = createButtonState();
  arrowLeft: ButtonState = createButtonState();
  arrowRight: ButtonState = createButtonState();
  touchA: ButtonState = createButtonState();
  touchB: ButtonState = createButtonState();
  xrLeftBtn1: ButtonState = createButtonState();
  xrLeftBtn2: ButtonState = createButtonState();
  xrRightBtn1: ButtonState = createButtonState();
  xrRightBtn2: ButtonState = createButtonState();

  // --- Navigation State --- >
  private _navigationTarget: THREE.Vector3 | null = null;
  private _isNavigating = false;
  private _currentNavKeys: { forward: boolean, backward: boolean, left: boolean, right: boolean } = {
      forward: false, backward: false, left: false, right: false
  };
  private _navigationResolve: (() => void) | null = null;
  // <------------------------

  private _currentWalkToken: NavigationToken | null = null;
  private _isRandomWalking = false;

  constructor(world: unknown) {
    super(world); // Call base System constructor

    const commonKeys = [
      'keyW', 'keyA', 'keyS', 'keyD', 'space', 'shiftLeft', 'shiftRight',
      'controlLeft', 'keyC', 'keyF', 'keyE', 'keyX', 'arrowUp', 'arrowDown',
      'arrowLeft', 'arrowRight', 'touchA', 'touchB', 'xrLeftStick',
      'xrRightStick', 'xrLeftBtn1', 'xrLeftBtn2', 'xrRightBtn1', 'xrRightBtn2',
    ];
    for (const key of commonKeys) {
      (this as DynamicKeyAccess)[key] = createButtonState();
    }

    // Ensure XR sticks are properly initialized
    this.xrLeftStick = { value: { x: 0, y: 0, z: 0 } };
    this.xrRightStick = { value: { x: 0, y: 0, z: 0 } };

    this.camera = this.createCamera(this);
  }

  // Method for the agent script to set a key state
  setKey(keyName: string, isDown: boolean) {
    // Use type assertion to access dynamic properties safely
    const currentValue = (this as DynamicKeyAccess)[keyName];
    if (!currentValue || !(currentValue as ButtonState).$button) {
      // If the key doesn't exist or isn't a button state, log a warning or initialize
      logger.warn(`[Controls] Attempted to set unknown or non-button key: ${keyName}. Initializing.`);
      (this as DynamicKeyAccess)[keyName] = createButtonState(); // Create if missing
    }
    const state = (this as DynamicKeyAccess)[keyName] as ButtonState;

    // Check if the state actually changed to avoid redundant updates
    const changed = state.down !== isDown;

    if (isDown && !state.down) {
      state.pressed = true;
      state.released = false;
    } else if (!isDown && state.down) {
      state.released = true;
      state.pressed = false;
    }
    state.down = isDown;

    // Optional: Log the key press/release
    // if (changed) {
    //     logger.debug(`[Controls] setKey: ${keyName} = ${isDown}`);
    // }
  }

  // Reset pressed/released flags at the end of the frame
  // This is important for detecting single presses/releases
  postLateUpdate() {
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key) && (this as DynamicKeyAccess)[key] && ((this as DynamicKeyAccess)[key] as ButtonState).$button) {
        ((this as DynamicKeyAccess)[key] as ButtonState).pressed = false;
        ((this as DynamicKeyAccess)[key] as ButtonState).released = false;
      }
    }
    // We don't run navigationTick here, it runs on its own interval
  }

  // --- Random Walk Methods --- >

  /**
   * Starts the agent walking to random nearby points.
   */
  public async startRandomWalk(
    interval = RANDOM_WALK_DEFAULT_INTERVAL,
    maxDistance = RANDOM_WALK_DEFAULT_MAX_DISTANCE,
    duration = 30000
  ) {
    this.stopRandomWalk(); // cancel if already running
    this._isRandomWalking = true;
    logger.info("[Controls] Random walk started.");

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const token = new NavigationToken();
    this._currentWalkToken = token;
    
    const walkLoop = async () => {
      const startTime = Date.now();

      while (this._isRandomWalking && this.world?.entities?.player && !token.aborted && this._currentWalkToken === token) {
        // Stop if duration expired and still same walk token
        if (
          duration !== undefined &&
          (Date.now() - startTime) >= duration &&
          this._currentWalkToken === token &&
          !token.aborted
        ) {
          logger.info("[Controls] Random walk duration reached. Stopping.");
          break;
        }
        
        const pos = this.world.entities.player.base.position;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * maxDistance;
        const targetX = pos.x + Math.cos(angle) * radius;
        const targetZ = pos.z + Math.sin(angle) * radius;

        try {
          await this.startNavigation(targetX, targetZ, token);
        } catch (e) {
          logger.warn("[Random Walk] Navigation error:", e);
        }

        await delay(Math.random() * interval);
      }
      if (this._currentWalkToken === token && !token.aborted) {
        this.stopRandomWalk();
      }
    };

    // Await the walkLoop to ensure the promise doesn't resolve immediately
    await walkLoop();
  }

  /**
   * Stops the random walk process.
   */
  public stopRandomWalk() {
    this._isRandomWalking = false;
    this._currentWalkToken?.abort();
    this._currentWalkToken = null;
    this.stopNavigation("random walk stopped");
  }  

  // --- Navigation Methods --- >

  /**
   * Starts navigating the agent towards the target X, Z coordinates.
   */
  public async goto(x: number, z: number): Promise<void> {
    this.stopRandomWalk();
    await this.startNavigation(x, z);
  }

  /**
   * Stops the current navigation process AND random walk if active.
   */
  public stopNavigation(reason = "commanded"): void {
    if (this._isNavigating) {
        logger.info(`[Controls Navigation] Stopping navigation (${reason}). Reason stored.`);

        if (this._navigationResolve) {
          this._navigationResolve();
          this._navigationResolve = null;
        }

        this._isNavigating = false;
        this._navigationTarget = null;
        
        // Release movement keys
        try {
            this.setKey('keyW', false);
            this.setKey('keyA', false);
            this.setKey('keyS', false);
            this.setKey('keyD', false);
            this.setKey('shiftLeft', false);
            logger.debug("[Controls Navigation] Movement keys released.");
        } catch (e) {
            logger.error("[Controls Navigation] Error releasing keys on stop:", e);
        }
        this._currentNavKeys = { forward: false, backward: false, left: false, right: false };
    }
  }


  /**
   * Internal navigation method that moves the agent towards a target (x, z) position.
   * It sets the player's rotation to face the direction of travel and simulates key presses
   * (e.g., 'W' for forward movement) until the agent reaches the destination or navigation is stopped.
   *
   * This method is isolated and does not handle random walk logic — it's a low-level navigation primitive.
   * Should be called by `goto` or `startRandomWalk` with an optional NavigationToken to allow early cancellation.
   */
  private async startNavigation(x: number, z: number, token?: NavigationToken): Promise<void> {
    this.stopNavigation("starting new navigation");
  
    this._navigationTarget = new THREE.Vector3(x, 0, z);
    this._isNavigating = true;
    this._currentNavKeys = { forward: false, backward: false, left: false, right: false };
  
    const player = this.world.entities?.player;
    if (!player) {
      logger.error("[Controls startNavigation] No player entity found");
      this.stopNavigation("no player");
      return;
    }
    
    const tickDelay = (ms: number) => new Promise(res => setTimeout(res, ms));
  
    while (this._isNavigating && this._navigationTarget && (!token || !token.aborted)) {
      if (!this._validatePlayerState("startNavigation")) break;
  
      const playerPosition = v1.copy(player.base.position);
      const distanceXZ = playerPosition.clone().setY(0).distanceTo(this._navigationTarget.clone().setY(0));
  
      if (distanceXZ <= NAVIGATION_STOP_DISTANCE) {
        this.stopNavigation("navigateTo finished");
        break;
      };
  
      const directionWorld = this._navigationTarget.clone().sub(playerPosition).setY(0).normalize();
      const desiredLook = q1.setFromUnitVectors(FORWARD, directionWorld);
      player.base.quaternion = desiredLook;
      const baseRotationY = e1.setFromQuaternion(player.base.quaternion, 'YXZ').y;
      player.cam.rotation.y = baseRotationY;
  
      this.setKey('keyW', true);
      this.setKey('keyS', false);
      this.setKey('keyA', false);
      this.setKey('keyD', false);
      this.setKey('shiftLeft', false);
  
      await tickDelay(NAVIGATION_TICK_INTERVAL);
    }
  }
  
  /**
   * Returns whether the agent is currently navigating towards a target.
   */
  public getIsNavigating(): boolean {
    return this._isNavigating;
  }

  public getIsWalkingRandomly(): boolean {
    return this._isRandomWalking;
  }

  /** Helper to check if player and base position/quaternion are valid */
  private _validatePlayerState(caller: string): boolean {
       const player = this.world?.entities?.player;
       if (!player?.base) {
            logger.error(`[Controls ${caller}] Cannot proceed: Player entity or base not found.`);
            return false;
       }
       // --- Enhanced Checks ---
       const pos = player.base.position;
       const quat = player.base.quaternion;

       if (!(pos instanceof THREE.Vector3 || (pos as unknown) instanceof Vector3Enhanced)) {
            logger.error(`[Controls ${caller}] Invalid state: player.base.position must be a THREE.Vector3 or Vector3Enhanced.`);
            return false;
       }
        if (Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(pos.z)) {
            logger.error(`[Controls ${caller}] Invalid state: player.base.position contains NaN values.`);
             return false;
        }

       if (!(quat instanceof THREE.Quaternion)) {
            logger.error(`[Controls ${caller}] Invalid state: player.base.quaternion is not a THREE.Quaternion.`);
            return false;
       }
       if (Number.isNaN(quat.x) || Number.isNaN(quat.y) || Number.isNaN(quat.z) || Number.isNaN(quat.w)) {
           logger.error(`[Controls ${caller}] Invalid state: player.base.quaternion contains NaN values.`);
            return false;
       }
       // Check if quaternion is normalized (length approx 1)
        const quatLengthSq = quat.lengthSq();
        if (Math.abs(quatLengthSq - 1.0) > 0.01) { // Allow small tolerance
            logger.warn(`[Controls ${caller}] Player quaternion is not normalized (lengthSq: ${quatLengthSq.toFixed(4)}). Attempting normalization.`);
            // Attempt to normalize in place if possible, or log warning
            quat.normalize();
        }

       logger.debug(`[Controls ${caller}] Player state validated successfully.`);
       // ---------------------
       return true;
  }

  createCamera(self: AgentControls): CameraObject {
    function bindRotations(quaternion: THREE.Quaternion, euler: THREE.Euler) {
      euler._onChange(() => {
        quaternion.setFromEuler(euler, false)
      })
      quaternion._onChange(() => {
        euler.setFromQuaternion(quaternion, undefined, false)
      })
    }
    const world = self.world;
    const position = new THREE.Vector3().copy(world.rig?.position || new THREE.Vector3());
    const quaternion = new THREE.Quaternion().copy(world.rig?.quaternion || new THREE.Quaternion());
    const rotation = new THREE.Euler(0, 0, 0, 'YXZ').copy(world.rig?.rotation || new THREE.Euler());
    bindRotations(quaternion, rotation); // You already import this
    const zoom = world.camera?.position?.z ?? 10;
  
    return {
      $camera: true,
      position,
      quaternion,
      rotation,
      zoom,
      write: false,
    };
  }

  // Dummy methods
  bind(options: unknown) { return this; }
  release() { }
  setActions() { }
}

