/**
 * Comprehensive test suite for AgentActions system
 * Tests action node management, distance filtering, action performance, and edge cases
 * Validates the porting from ElizaOS to FastMCP architecture
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { AgentActions, type WorldType } from '../src/hyperfy/systems/actions.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000, // 10 seconds
  ACTION_TIMEOUT: 5000, // 5 seconds for action completion
  RELEASE_TIMEOUT: 1000, // 1 second for action release
};

// ActionNode interface matching the one in actions.ts
interface ActionNode extends THREE.Object3D {
  [key: string]: unknown;
  finished?: boolean;
  ctx: {
    entity: {
      root: {
        position: THREE.Vector3;
      };
      data?: {
        id: string;
      };
    };
  };
  _onTrigger?: (params: { playerId: string }) => void;
  _onCancel?: () => void;
  _duration?: number;
}

// Create mock world for testing
function createMockWorld(): WorldType {
  return {
    rig: {
      position: new THREE.Vector3(0, 0, 0),
    },
    controls: {
      setKey: vi.fn(),
      keyX: {
        pressed: false,
        released: false,
        onPress: vi.fn(),
        onRelease: vi.fn(),
      },
    },
    entities: {
      player: {
        data: {
          id: 'test-player-123',
        },
      },
    },
  };
}

// Create mock action node
function createMockActionNode(
  id: string,
  position: THREE.Vector3,
  options: {
    finished?: boolean;
    duration?: number;
    onTrigger?: (params: { playerId: string }) => void;
    onCancel?: () => void;
  } = {}
): ActionNode {
  const node = new THREE.Object3D() as ActionNode;
  
  node.ctx = {
    entity: {
      root: {
        position: position.clone(),
      },
      data: {
        id,
      },
    },
  };
  
  node.finished = options.finished ?? false;
  node._duration = options.duration ?? 1000; // Default 1 second
  node._onTrigger = options.onTrigger;
  node._onCancel = options.onCancel;
  
  return node;
}

describe('AgentActions System', () => {
  let actions: AgentActions;
  let mockWorld: WorldType;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorld = createMockWorld();
    actions = new AgentActions(mockWorld);
    
    logger.info('🎬 Starting AgentActions test');
  });

  afterEach(async () => {
    // Clean up any ongoing actions
    if (actions) {
      try {
        actions.releaseAction();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Wait a bit for any pending timeouts to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper world context', () => {
      expect(actions).toBeInstanceOf(AgentActions);
      expect(actions.world).toBeDefined();
      expect(actions.world).toBe(mockWorld);
      
      logger.info('✅ Actions initialized with world context');
    });

    it('should start with empty nodes array', () => {
      const nearby = actions.getNearby();
      expect(nearby).toEqual([]);
      
      logger.info('✅ Actions starts with empty nodes array');
    });

    it('should have no current node initially', () => {
      // Test indirectly by trying to release (should do nothing)
      const consoleSpy = vi.spyOn(console, 'log');
      actions.releaseAction();
      expect(consoleSpy).toHaveBeenCalledWith('No current action to release.');
      
      logger.info('✅ No current node initially');
    });
  });

  describe('Node Management', () => {
    it('should register nodes correctly', () => {
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1));
      const node2 = createMockActionNode('node2', new THREE.Vector3(2, 0, 2));
      
      actions.register(node1);
      actions.register(node2);
      
      const nearby = actions.getNearby();
      expect(nearby).toHaveLength(2);
      expect(nearby).toContain(node1);
      expect(nearby).toContain(node2);
      
      logger.info('✅ Node registration works correctly');
    });

    it('should unregister nodes correctly', () => {
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1));
      const node2 = createMockActionNode('node2', new THREE.Vector3(2, 0, 2));
      
      actions.register(node1);
      actions.register(node2);
      
      // Unregister first node
      actions.unregister(node1);
      
      const nearby = actions.getNearby();
      expect(nearby).toHaveLength(1);
      expect(nearby).toContain(node2);
      expect(nearby).not.toContain(node1);
      
      logger.info('✅ Node unregistration works correctly');
    });

    it('should handle unregistering non-existent nodes gracefully', () => {
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1));
      const node2 = createMockActionNode('node2', new THREE.Vector3(2, 0, 2));
      
      actions.register(node1);
      
      // Try to unregister node that was never registered
      expect(() => actions.unregister(node2)).not.toThrow();
      
      const nearby = actions.getNearby();
      expect(nearby).toHaveLength(1);
      expect(nearby).toContain(node1);
      
      logger.info('✅ Unregistering non-existent nodes handled gracefully');
    });

    it('should handle multiple registrations of same node', () => {
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1));
      
      actions.register(node1);
      actions.register(node1); // Register again
      
      const nearby = actions.getNearby();
      expect(nearby).toHaveLength(2); // Should have duplicate
      
      // Unregister once
      actions.unregister(node1);
      const nearbyAfter = actions.getNearby();
      expect(nearbyAfter).toHaveLength(1); // Should still have one copy
      
      logger.info('✅ Multiple registrations handled correctly');
    });
  });

  describe('Distance-based Filtering', () => {
    beforeEach(() => {
      // Set rig position at origin
      mockWorld.rig.position.set(0, 0, 0);
    });

    it('should return all unfinished nodes when no distance specified', () => {
      const nearNode = createMockActionNode('near', new THREE.Vector3(1, 0, 1));
      const farNode = createMockActionNode('far', new THREE.Vector3(100, 0, 100));
      const finishedNode = createMockActionNode('finished', new THREE.Vector3(0.5, 0, 0.5), { finished: true });
      
      actions.register(nearNode);
      actions.register(farNode);
      actions.register(finishedNode);
      
      const nearby = actions.getNearby();
      expect(nearby).toHaveLength(2);
      expect(nearby).toContain(nearNode);
      expect(nearby).toContain(farNode);
      expect(nearby).not.toContain(finishedNode); // Finished nodes excluded
      
      logger.info('✅ Returns all unfinished nodes when no distance specified');
    });

    it('should filter nodes by distance correctly', () => {
      const nearNode = createMockActionNode('near', new THREE.Vector3(1, 0, 1)); // Distance ~1.41
      const mediumNode = createMockActionNode('medium', new THREE.Vector3(3, 0, 4)); // Distance = 5
      const farNode = createMockActionNode('far', new THREE.Vector3(10, 0, 10)); // Distance ~14.14
      
      actions.register(nearNode);
      actions.register(mediumNode);
      actions.register(farNode);
      
      // Test with distance 3 - should only include near node
      const nearby3 = actions.getNearby(3);
      expect(nearby3).toHaveLength(1);
      expect(nearby3).toContain(nearNode);
      
      // Test with distance 6 - should include near and medium
      const nearby6 = actions.getNearby(6);
      expect(nearby6).toHaveLength(2);
      expect(nearby6).toContain(nearNode);
      expect(nearby6).toContain(mediumNode);
      
      // Test with distance 20 - should include all
      const nearby20 = actions.getNearby(20);
      expect(nearby20).toHaveLength(3);
      
      logger.info('✅ Distance filtering works correctly');
    });

    it('should exclude finished nodes regardless of distance', () => {
      const nearFinished = createMockActionNode('nearFinished', new THREE.Vector3(0.5, 0, 0.5), { finished: true });
      const nearActive = createMockActionNode('nearActive', new THREE.Vector3(0.5, 0, 0.5), { finished: false });
      
      actions.register(nearFinished);
      actions.register(nearActive);
      
      const nearby = actions.getNearby(10);
      expect(nearby).toHaveLength(1);
      expect(nearby).toContain(nearActive);
      expect(nearby).not.toContain(nearFinished);
      
      logger.info('✅ Finished nodes excluded regardless of distance');
    });

    it('should handle rig position changes', () => {
      const node = createMockActionNode('node', new THREE.Vector3(5, 0, 0));
      actions.register(node);
      
      // Initially at origin - node is 5 units away
      mockWorld.rig.position.set(0, 0, 0);
      expect(actions.getNearby(3)).toHaveLength(0);
      expect(actions.getNearby(6)).toHaveLength(1);
      
      // Move rig closer - node is now 1 unit away
      mockWorld.rig.position.set(4, 0, 0);
      expect(actions.getNearby(3)).toHaveLength(1);
      
      logger.info('✅ Rig position changes handled correctly');
    });
  });

  describe('Action Performance', () => {
    it('should perform action on nearest node when no entity ID specified', async () => {
      const onTrigger = vi.fn();
      const node = createMockActionNode('test-node', new THREE.Vector3(1, 0, 1), {
        duration: 100, // Short duration for testing
        onTrigger,
      });
      
      actions.register(node);
      
      // Perform action
      actions.performAction();
      
      // Should immediately set keyE to true
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', true);
      
      // Wait for action to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should have triggered the action
      expect(onTrigger).toHaveBeenCalledWith({ playerId: 'test-player-123' });
      
      // Should have released keyE
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', false);
      
      logger.info('✅ Action performed on nearest node correctly');
    }, TEST_CONFIG.ACTION_TIMEOUT);

    it('should perform action on specific entity when ID provided', async () => {
      const onTrigger1 = vi.fn();
      const onTrigger2 = vi.fn();
      
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1), {
        duration: 100,
        onTrigger: onTrigger1,
      });
      const node2 = createMockActionNode('node2', new THREE.Vector3(2, 0, 2), {
        duration: 100,
        onTrigger: onTrigger2,
      });
      
      actions.register(node1);
      actions.register(node2);
      
      // Perform action on specific entity
      actions.performAction('node2');
      
      // Wait for action to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should only trigger node2
      expect(onTrigger1).not.toHaveBeenCalled();
      expect(onTrigger2).toHaveBeenCalledWith({ playerId: 'test-player-123' });
      
      logger.info('✅ Action performed on specific entity correctly');
    }, TEST_CONFIG.ACTION_TIMEOUT);

    it('should handle action with default duration when not specified', async () => {
      const onTrigger = vi.fn();
      const node = createMockActionNode('test-node', new THREE.Vector3(1, 0, 1), {
        onTrigger,
        // No duration specified - should use default 3000ms
      });
      
      actions.register(node);
      actions.performAction();
      
      // Should immediately set keyE
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', true);
      
      // Should not have triggered yet (default duration is 3000ms)
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(onTrigger).not.toHaveBeenCalled();
      
      // Manually trigger completion for testing
      await new Promise(resolve => setTimeout(resolve, 3100));
      expect(onTrigger).toHaveBeenCalled();
      
      logger.info('✅ Default duration handled correctly');
    }, 4000); // Longer timeout for default duration

    it('should handle action without onTrigger callback', async () => {
      const node = createMockActionNode('test-node', new THREE.Vector3(1, 0, 1), {
        duration: 100,
        // No onTrigger callback
      });
      
      actions.register(node);
      
      expect(() => actions.performAction()).not.toThrow();
      
      // Wait for action to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should have set and released keyE without errors
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', true);
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', false);
      
      logger.info('✅ Action without onTrigger handled gracefully');
    }, TEST_CONFIG.ACTION_TIMEOUT);
  });

  describe('Action Performance Edge Cases', () => {
    it('should prevent concurrent actions', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1));
      const node2 = createMockActionNode('node2', new THREE.Vector3(2, 0, 2));
      
      actions.register(node1);
      actions.register(node2);
      
      // Start first action
      actions.performAction('node1');
      
      // Try to start second action
      actions.performAction('node2');
      
      expect(consoleSpy).toHaveBeenCalledWith('Already interacting with an entity. Release it first.');
      
      logger.info('✅ Concurrent actions prevented correctly');
    });

    it('should handle performAction with no nearby nodes', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // No nodes registered
      actions.performAction();
      
      // Should not call setKey or log errors
      expect(mockWorld.controls.setKey).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      
      logger.info('✅ No nearby nodes handled gracefully');
    });

    it('should handle performAction with non-existent entity ID', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const node = createMockActionNode('existing-node', new THREE.Vector3(1, 0, 1));
      
      actions.register(node);
      
      // Try to perform action on non-existent entity
      actions.performAction('non-existent-id');
      
      expect(consoleSpy).toHaveBeenCalledWith('No nearby action node found with entity ID: non-existent-id');
      expect(mockWorld.controls.setKey).not.toHaveBeenCalled();
      
      logger.info('✅ Non-existent entity ID handled correctly');
    });

    it('should handle performAction with finished nodes only', () => {
      const finishedNode = createMockActionNode('finished', new THREE.Vector3(1, 0, 1), { finished: true });
      
      actions.register(finishedNode);
      
      // Should not perform action on finished node
      actions.performAction();
      
      expect(mockWorld.controls.setKey).not.toHaveBeenCalled();
      
      logger.info('✅ Finished nodes excluded from actions');
    });
  });

  describe('Action Release', () => {
    it('should release current action correctly', async () => {
      const onCancel = vi.fn();
      const node = createMockActionNode('test-node', new THREE.Vector3(1, 0, 1), {
        duration: 100,
        onCancel,
      });
      
      actions.register(node);
      
      // Start action
      actions.performAction();
      
      // Wait for action to complete and become current
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Release action
      actions.releaseAction();
      
      // Should set keyX and call callbacks
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyX', true);
      expect(mockWorld.controls.keyX.pressed).toBe(true);
      expect(mockWorld.controls.keyX.onPress).toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalled();
      
      // Wait for release to complete
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should release keyX and reset state
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyX', false);
      expect(mockWorld.controls.keyX.released).toBe(false);
      expect(mockWorld.controls.keyX.onRelease).toHaveBeenCalled();
      
      logger.info('✅ Action release works correctly');
    }, TEST_CONFIG.RELEASE_TIMEOUT + 1000);

    it('should handle release without onCancel callback', async () => {
      const node = createMockActionNode('test-node', new THREE.Vector3(1, 0, 1), {
        duration: 100,
        // No onCancel callback
      });
      
      actions.register(node);
      
      // Start and complete action
      actions.performAction();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Release should work without errors
      expect(() => actions.releaseAction()).not.toThrow();
      
      logger.info('✅ Release without onCancel handled gracefully');
    }, TEST_CONFIG.RELEASE_TIMEOUT);

    it('should handle release when no current action', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // Try to release when no current action
      actions.releaseAction();
      
      expect(consoleSpy).toHaveBeenCalledWith('No current action to release.');
      expect(mockWorld.controls.setKey).not.toHaveBeenCalled();
      
      logger.info('✅ Release with no current action handled correctly');
    });

    it('should allow new action after release', async () => {
      const node1 = createMockActionNode('node1', new THREE.Vector3(1, 0, 1), { duration: 100 });
      const node2 = createMockActionNode('node2', new THREE.Vector3(2, 0, 2), { duration: 100 });
      
      actions.register(node1);
      actions.register(node2);
      
      // Start first action
      actions.performAction('node1');
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Release first action
      actions.releaseAction();
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should be able to start second action
      const consoleSpy = vi.spyOn(console, 'log');
      actions.performAction('node2');
      
      expect(consoleSpy).not.toHaveBeenCalledWith('Already interacting with an entity. Release it first.');
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', true);
      
      logger.info('✅ New action allowed after release');
    }, TEST_CONFIG.RELEASE_TIMEOUT + 1000);
  });

  describe('Integration and State Management', () => {
    it('should maintain correct state throughout action lifecycle', async () => {
      const onTrigger = vi.fn();
      const onCancel = vi.fn();
      const node = createMockActionNode('test-node', new THREE.Vector3(1, 0, 1), {
        duration: 100,
        onTrigger,
        onCancel,
      });
      
      actions.register(node);
      
      // Initial state - no current action
      const consoleSpy = vi.spyOn(console, 'log');
      actions.releaseAction();
      expect(consoleSpy).toHaveBeenCalledWith('No current action to release.');
      
      // Start action
      actions.performAction();
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', true);
      
      // During action - should prevent new actions
      actions.performAction();
      expect(consoleSpy).toHaveBeenCalledWith('Already interacting with an entity. Release it first.');
      
      // Wait for action to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(onTrigger).toHaveBeenCalled();
      
      // Release action
      actions.releaseAction();
      expect(onCancel).toHaveBeenCalled();
      
      // Wait for release to complete
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should be able to start new action
      actions.performAction();
      expect(mockWorld.controls.setKey).toHaveBeenCalledWith('keyE', true);
      
      logger.info('✅ State maintained correctly throughout lifecycle');
    }, TEST_CONFIG.ACTION_TIMEOUT + TEST_CONFIG.RELEASE_TIMEOUT);

    it('should handle rapid register/unregister operations', () => {
      const nodes: ActionNode[] = [];
      
      // Register many nodes
      for (let i = 0; i < 100; i++) {
        const node = createMockActionNode(`node${i}`, new THREE.Vector3(i, 0, i));
        nodes.push(node);
        actions.register(node);
      }
      
      expect(actions.getNearby()).toHaveLength(100);
      
      // Unregister half
      for (let i = 0; i < 50; i++) {
        actions.unregister(nodes[i]);
      }
      
      expect(actions.getNearby()).toHaveLength(50);
      
      // Register some back
      for (let i = 0; i < 25; i++) {
        actions.register(nodes[i]);
      }
      
      expect(actions.getNearby()).toHaveLength(75);
      
      logger.info('✅ Rapid register/unregister operations handled correctly');
    });

    it('should handle complex distance scenarios', () => {
      // Create nodes in a grid pattern
      const nodes: ActionNode[] = [];
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          const node = createMockActionNode(`node_${x}_${z}`, new THREE.Vector3(x, 0, z));
          nodes.push(node);
          actions.register(node);
        }
      }
      
      // Set rig at origin
      mockWorld.rig.position.set(0, 0, 0);
      
      // Test various distances
      expect(actions.getNearby(1)).toHaveLength(5); // Only adjacent nodes
      expect(actions.getNearby(2)).toHaveLength(13); // More nodes
      expect(actions.getNearby(10)).toHaveLength(121); // All nodes
      
      // Move rig and test again
      mockWorld.rig.position.set(2, 0, 2);
      const nearbyFromNewPos = actions.getNearby(1);
      expect(nearbyFromNewPos.length).toBeGreaterThan(0);
      
      logger.info('✅ Complex distance scenarios handled correctly');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle nodes with missing entity data', () => {
      const incompleteNode = new THREE.Object3D() as unknown as ActionNode;
      incompleteNode.ctx = {
        entity: {
          root: {
            position: new THREE.Vector3(1, 0, 1),
          },
          // Missing data property
        },
      };
      
      actions.register(incompleteNode);
      
      // Should not crash when performing action
      expect(() => actions.performAction('missing-id')).not.toThrow();
      
      logger.info('✅ Missing entity data handled gracefully');
    });

    it('should handle nodes with invalid positions', () => {
      const invalidNode = createMockActionNode('invalid', new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN));
      
      actions.register(invalidNode);
      
      // Should not crash when filtering by distance
      expect(() => actions.getNearby(5)).not.toThrow();
      
      logger.info('✅ Invalid positions handled gracefully');
    });

    it('should handle world with missing controls', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const brokenWorld = {
        ...mockWorld,
        controls: undefined as unknown as WorldType['controls'],
      };
      
      const brokenActions = new AgentActions(brokenWorld);
      const node = createMockActionNode('test', new THREE.Vector3(1, 0, 1));
      brokenActions.register(node);
      
      // Should not crash when performing action
      expect(() => brokenActions.performAction()).not.toThrow();
      
      // Should log that no controls are available
      expect(consoleSpy).toHaveBeenCalledWith('No controls available - cannot perform action');
      
      logger.info('✅ Missing controls handled gracefully');
    });
  });
}); 