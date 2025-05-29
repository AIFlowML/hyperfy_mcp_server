import { System } from '../core/systems/System.js'
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
  _onTrigger?: (params: { playerId: string }) => void;
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

export class AgentActions extends System {
  private nodes: ActionNode[] = []
  private currentNode: ActionNode | null = null;
  
  constructor(world: WorldType) {
    super(world);
    this.nodes = [];
  }

  register(node: ActionNode) {
    this.nodes.push(node)
  }

  unregister(node: ActionNode) {
    const idx = this.nodes.indexOf(node)
    if (idx !== -1) {
      this.nodes.splice(idx, 1)
    }
  }

  getNearby(maxDistance?: number): ActionNode[] {
    const world = this.world as WorldType;
    const cameraPos = world.rig.position;
  
    return this.nodes.filter(node => {
      if (node.finished) return false;
  
      // If no distance provided, return all unfinished nodes
      if (maxDistance == null) return true;
  
      return node.ctx.entity.root.position.distanceTo(cameraPos) <= maxDistance;
    });
  }
  

  performAction(entityID?: string) {
    if (this.currentNode) {
      console.log('Already interacting with an entity. Release it first.');
      return;
    }
    const nearby = this.getNearby();
    if (!nearby.length) return;
  
    let target: ActionNode | undefined;

    if (entityID) {
      target = nearby.find(node => node.ctx.entity?.data?.id === entityID);
      if (!target) {
        console.log(`No nearby action node found with entity ID: ${entityID}`);
        return;
      }
    } else {
      target = nearby[0];
    }

    const world = this.world as WorldType;
    const control = world.controls;
    
    // Check if controls exist before using them
    if (!control) {
      console.log('No controls available - cannot perform action');
      return;
    }
    
    // Set current node immediately to prevent concurrent actions
    this.currentNode = target;
    
    control.setKey('keyE', true);

    setTimeout(() => {
      if (typeof target._onTrigger === 'function') {
        target._onTrigger({ playerId: world.entities.player.data.id });
      }
      control.setKey('keyE', false);
      // currentNode is already set above
    }, target._duration ?? 3000);

  }
  
  
  releaseAction() {
    if (!this.currentNode) {
      console.log('No current action to release.');
      return;
    }
  
    console.log('Releasing current action.');
    const world = this.world as WorldType;
    const control = world.controls;
    
    // Check if controls exist before using them
    if (!control) {
      console.log('No controls available - releasing action without key input');
      // Still call onCancel and reset currentNode
      if (typeof this.currentNode._onCancel === 'function') {
        this.currentNode._onCancel();
      }
      this.currentNode = null;
      return;
    }
    
    control.setKey('keyX', true);
    control.keyX.pressed = true;
    control.keyX.onPress?.();
  
    if (typeof this.currentNode._onCancel === 'function') {
      this.currentNode._onCancel();
    }
  
    setTimeout(() => {
      control.setKey('keyX', false);
      control.keyX.released = false;
      control.keyX.onRelease?.();
      this.currentNode = null;
    }, 500);
  }
  
  // Framework stubs
  // init() {}
  start() {}
  preTick() {}
  preFixedUpdate() {}
  fixedUpdate() {}
  postFixedUpdate() {}
  preUpdate() {}
  update() {}
  postUpdate() {}
  lateUpdate() {}
  postLateUpdate() {}
  commit() {}
  postTick() {}

  // Public getter for currentNode
  getCurrentNode(): ActionNode | null {
    return this.currentNode;
  }
}