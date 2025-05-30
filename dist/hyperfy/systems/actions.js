import { System } from '../core/systems/System.js';
export class AgentActions extends System {
    constructor(world) {
        super(world);
        this.nodes = [];
        this.currentNode = null;
        this.nodes = [];
    }
    register(node) {
        this.nodes.push(node);
    }
    unregister(node) {
        const idx = this.nodes.indexOf(node);
        if (idx !== -1) {
            this.nodes.splice(idx, 1);
        }
    }
    getNearby(maxDistance) {
        const world = this.world;
        const cameraPos = world.rig.position;
        return this.nodes.filter(node => {
            if (node.finished)
                return false;
            // If no distance provided, return all unfinished nodes
            if (maxDistance == null)
                return true;
            return node.ctx.entity.root.position.distanceTo(cameraPos) <= maxDistance;
        });
    }
    performAction(entityID) {
        if (this.currentNode) {
            console.log('Already interacting with an entity. Release it first.');
            return;
        }
        const nearby = this.getNearby();
        if (!nearby.length)
            return;
        let target;
        if (entityID) {
            target = nearby.find(node => node.ctx.entity?.data?.id === entityID);
            if (!target) {
                console.log(`No nearby action node found with entity ID: ${entityID}`);
                return;
            }
        }
        else {
            target = nearby[0];
        }
        const world = this.world;
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
        const world = this.world;
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
    start() { }
    preTick() { }
    preFixedUpdate() { }
    fixedUpdate() { }
    postFixedUpdate() { }
    preUpdate() { }
    update() { }
    postUpdate() { }
    lateUpdate() { }
    postLateUpdate() { }
    commit() { }
    postTick() { }
    // Public getter for currentNode
    getCurrentNode() {
        return this.currentNode;
    }
}
//# sourceMappingURL=actions.js.map