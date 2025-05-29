/**
 * Comprehensive test suite for AgentControls system
 * Tests against REAL Hyperfy server on localhost:3000
 * Covers navigation, random walk, key states, and camera controls
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { AgentControls } from '../src/hyperfy/systems/controls.js';
import { HyperfyService } from '../src/core/hyperfy-service.js';
import { createLogger, generateUUID } from '../src/utils/eliza-compat.js';
import type { HyperfyRuntime } from '../src/core/hyperfy-service.js';
import type { FastMCPRuntime } from '../src/types/index.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  HYPERFY_WS_SERVER: process.env.HYPERFY_WS_SERVER || 'ws://localhost:3000/ws',
  TEST_TIMEOUT: 30000, // 30 seconds
  NAVIGATION_TIMEOUT: 15000, // 15 seconds for navigation tests
  RANDOM_WALK_DURATION: 8000, // 8 seconds for random walk tests
};

// Mock runtime for testing
function createMockRuntime(agentName: string): HyperfyRuntime {
  return {
    agentId: generateUUID({ generateUUID: () => Math.random().toString(36).substring(7) } as FastMCPRuntime, `test-${agentName}`),
    character: { name: agentName },
    getEntityById: async () => null,
    updateEntity: async () => {},
    logger: {
      info: (msg: string, data?: unknown) => logger.info(msg, data),
      warn: (msg: string, data?: unknown) => logger.warn(msg, data),
      error: (msg: string, data?: unknown) => logger.error(msg, data),
    },
    generateUUID: () => Math.random().toString(36).substring(7),
    agentName,
    aiModel: undefined
  };
}

// Mock world structure for isolated testing
function createMockWorld() {
  return {
    entities: {
      player: {
        base: {
          position: new THREE.Vector3(0, 0, 0),
          quaternion: new THREE.Quaternion(0, 0, 0, 1),
        },
        cam: {
          rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
        },
      },
    },
    rig: {
      position: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    },
    camera: {
      position: {
        z: 10,
      },
    },
  };
}

describe('AgentControls System', () => {
  let controls: AgentControls;
  let mockWorld: ReturnType<typeof createMockWorld>;
  let hyperfyService: HyperfyService | null = null;
  let isConnectedToServer = false;

  beforeAll(async () => {
    logger.info('🚀 Starting AgentControls Integration Tests');
    logger.info(`🔌 Testing against: ${TEST_CONFIG.HYPERFY_WS_SERVER}`);
    logger.info('📋 Make sure Hyperfy server is running on localhost:3000');

    // Try to connect to real Hyperfy server for integration tests
    try {
      const mockRuntime = createMockRuntime('ControlsTestAgent');
      hyperfyService = new HyperfyService(mockRuntime);
      
      await hyperfyService.connect({
        wsUrl: TEST_CONFIG.HYPERFY_WS_SERVER,
        worldId: generateUUID({ generateUUID: () => Math.random().toString(36).substring(7) } as FastMCPRuntime, 'controls-test-world')
      });
      
      isConnectedToServer = hyperfyService.isConnected();
      logger.info(`✅ Connected to Hyperfy server: ${isConnectedToServer}`);
    } catch (error) {
      logger.warn('⚠️ Could not connect to Hyperfy server, using mock world for tests');
      logger.warn(`Error: ${error}`);
      isConnectedToServer = false;
    }
  }, TEST_CONFIG.TEST_TIMEOUT);

  afterAll(async () => {
    if (hyperfyService) {
      await hyperfyService.disconnect();
      logger.info('🧹 Disconnected from Hyperfy server');
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Use real world if connected, otherwise mock world
    if (isConnectedToServer && hyperfyService) {
      const realWorld = hyperfyService.getWorld();
      controls = new AgentControls(realWorld);
      logger.info('🌍 Using real Hyperfy world for test');
    } else {
      mockWorld = createMockWorld();
      controls = new AgentControls(mockWorld);
      logger.info('🎭 Using mock world for test');
    }
  });

  afterEach(async () => {
    // Clean up any ongoing navigation or random walk
    if (controls) {
      controls.stopNavigation('test cleanup');
      controls.stopRandomWalk();
      
      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper world context', () => {
      expect(controls).toBeInstanceOf(AgentControls);
      expect(controls.world).toBeDefined();
      
      if (isConnectedToServer) {
        logger.info('✅ Controls initialized with real Hyperfy world');
      } else {
        expect(controls.world.entities?.player).toBeDefined();
        expect(controls.world.entities?.player?.base).toBeDefined();
        logger.info('✅ Controls initialized with mock world');
      }
    });

    it('should initialize all button states', () => {
      // Test common movement keys
      expect(controls.keyW).toBeDefined();
      expect(controls.keyW.$button).toBe(true);
      expect(controls.keyW.down).toBe(false);
      expect(controls.keyW.pressed).toBe(false);
      expect(controls.keyW.released).toBe(false);

      expect(controls.keyA).toBeDefined();
      expect(controls.keyS).toBeDefined();
      expect(controls.keyD).toBeDefined();
      expect(controls.space).toBeDefined();
      
      // Test modifier keys
      expect(controls.shiftLeft).toBeDefined();
      expect(controls.shiftRight).toBeDefined();
      expect(controls.controlLeft).toBeDefined();
      
      // Test action keys
      expect(controls.keyC).toBeDefined();
      expect(controls.keyF).toBeDefined();
      expect(controls.keyE).toBeDefined();
      
      // Test arrow keys
      expect(controls.arrowUp).toBeDefined();
      expect(controls.arrowDown).toBeDefined();
      expect(controls.arrowLeft).toBeDefined();
      expect(controls.arrowRight).toBeDefined();
      
      // Test touch/XR controls
      expect(controls.touchA).toBeDefined();
      expect(controls.touchB).toBeDefined();
      expect(controls.xrLeftBtn1).toBeDefined();
      expect(controls.xrLeftBtn2).toBeDefined();
      expect(controls.xrRightBtn1).toBeDefined();
      expect(controls.xrRightBtn2).toBeDefined();
      
      logger.info('✅ All button states initialized correctly');
    });

    it('should initialize control objects', () => {
      expect(controls.scrollDelta).toBeDefined();
      expect(controls.scrollDelta.value).toBe(0);
      
      expect(controls.pointer).toBeDefined();
      expect(controls.pointer.locked).toBe(false);
      expect(controls.pointer.delta).toEqual({ x: 0, y: 0 });
      
      expect(controls.xrLeftStick).toBeDefined();
      expect(controls.xrLeftStick.value).toEqual({ x: 0, y: 0, z: 0 });
      
      expect(controls.xrRightStick).toBeDefined();
      expect(controls.xrRightStick.value).toEqual({ x: 0, y: 0, z: 0 });
      
      logger.info('✅ Control objects initialized correctly');
    });

    it('should create camera object', () => {
      expect(controls.camera).toBeDefined();
      expect(controls.camera?.$camera).toBe(true);
      expect(controls.camera?.position).toBeInstanceOf(THREE.Vector3);
      expect(controls.camera?.quaternion).toBeInstanceOf(THREE.Quaternion);
      expect(controls.camera?.rotation).toBeInstanceOf(THREE.Euler);
      expect(typeof controls.camera?.zoom).toBe('number');
      expect(controls.camera?.write).toBe(false);
      
      logger.info('✅ Camera object created correctly');
    });
  });

  describe('Key State Management', () => {
    it('should set key states correctly', () => {
      // Test key press
      controls.setKey('keyW', true);
      expect(controls.keyW.down).toBe(true);
      expect(controls.keyW.pressed).toBe(true);
      expect(controls.keyW.released).toBe(false);
      
      // Test key release
      controls.setKey('keyW', false);
      expect(controls.keyW.down).toBe(false);
      expect(controls.keyW.pressed).toBe(false);
      expect(controls.keyW.released).toBe(true);
      
      logger.info('✅ Key state changes handled correctly');
    });

    it('should handle unknown keys gracefully', () => {
      expect(() => {
        controls.setKey('unknownKey', true);
      }).not.toThrow();
      
      // Should create the key if it doesn't exist
      expect((controls as unknown as Record<string, unknown>).unknownKey).toBeDefined();
      expect(((controls as unknown as Record<string, unknown>).unknownKey as { $button: boolean }).$button).toBe(true);
      
      logger.info('✅ Unknown keys handled gracefully');
    });

    it('should reset pressed/released flags in postLateUpdate', () => {
      // Set a key and trigger pressed state
      controls.setKey('keyA', true);
      expect(controls.keyA.pressed).toBe(true);
      
      // Call postLateUpdate
      controls.postLateUpdate();
      
      // Pressed flag should be reset
      expect(controls.keyA.pressed).toBe(false);
      expect(controls.keyA.down).toBe(true); // down state should remain
      
      logger.info('✅ postLateUpdate resets flags correctly');
    });

    it('should handle multiple key combinations', () => {
      // Test WASD movement combination
      controls.setKey('keyW', true);
      controls.setKey('keyA', true);
      controls.setKey('shiftLeft', true);
      
      expect(controls.keyW.down).toBe(true);
      expect(controls.keyA.down).toBe(true);
      expect(controls.shiftLeft.down).toBe(true);
      
      // Release all
      controls.setKey('keyW', false);
      controls.setKey('keyA', false);
      controls.setKey('shiftLeft', false);
      
      expect(controls.keyW.down).toBe(false);
      expect(controls.keyA.down).toBe(false);
      expect(controls.shiftLeft.down).toBe(false);
      
      logger.info('✅ Multiple key combinations handled correctly');
    });
  });

  describe('Navigation System', () => {
    it('should start and stop navigation correctly', async () => {
      const targetX = 5;
      const targetZ = 5;
      
      // Start navigation
      const navigationPromise = controls.goto(targetX, targetZ);
      
      // Should be navigating
      expect(controls.getIsNavigating()).toBe(true);
      
      // Stop navigation
      controls.stopNavigation('test stop');
      
      // Should not be navigating
      expect(controls.getIsNavigating()).toBe(false);
      
      // Wait for navigation promise to resolve
      await navigationPromise;
      
      logger.info('✅ Navigation start/stop works correctly');
    }, TEST_CONFIG.NAVIGATION_TIMEOUT);

    it('should handle navigation to nearby target', async () => {
      if (!isConnectedToServer) {
        // For mock world, set a close starting position
        mockWorld.entities.player.base.position.set(0, 0, 0);
      }
      
      const targetX = 0.5; // Very close target
      const targetZ = 0.5;
      
      const startTime = Date.now();
      await controls.goto(targetX, targetZ);
      const endTime = Date.now();
      
      // Should complete quickly for nearby targets
      expect(endTime - startTime).toBeLessThan(5000);
      expect(controls.getIsNavigating()).toBe(false);
      
      logger.info(`✅ Navigation to nearby target completed in ${endTime - startTime}ms`);
    }, TEST_CONFIG.NAVIGATION_TIMEOUT);

    it('should set movement keys during navigation', async () => {
      const targetX = 10;
      const targetZ = 10;
      
      // Start navigation
      const navigationPromise = controls.goto(targetX, targetZ);
      
      // Wait a bit for navigation to start
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (controls.getIsNavigating()) {
        // Should have forward key pressed during navigation
        expect(controls.keyW.down).toBe(true);
        
        // Other movement keys should be false
        expect(controls.keyS.down).toBe(false);
        expect(controls.keyA.down).toBe(false);
        expect(controls.keyD.down).toBe(false);
      }
      
      // Stop navigation
      controls.stopNavigation('test check');
      await navigationPromise;
      
      // All movement keys should be released after stopping
      expect(controls.keyW.down).toBe(false);
      expect(controls.keyS.down).toBe(false);
      expect(controls.keyA.down).toBe(false);
      expect(controls.keyD.down).toBe(false);
      
      logger.info('✅ Movement keys set correctly during navigation');
    }, TEST_CONFIG.NAVIGATION_TIMEOUT);

    it('should handle concurrent navigation calls', async () => {
      // Start first navigation
      const nav1 = controls.goto(5, 5);
      
      // Wait a bit then start second navigation (should cancel first)
      await new Promise(resolve => setTimeout(resolve, 100));
      const nav2 = controls.goto(10, 10);
      
      // Wait a bit then start third navigation (should cancel second)
      await new Promise(resolve => setTimeout(resolve, 100));
      const nav3 = controls.goto(15, 15);
      
      // Stop the final navigation to prevent infinite loop
      await new Promise(resolve => setTimeout(resolve, 100));
      controls.stopNavigation('test cleanup');
      
      // Wait for all promises to resolve
      try {
        await Promise.race([
          Promise.all([nav1, nav2, nav3]),
          new Promise(resolve => setTimeout(resolve, 1000)) // 1 second max wait
        ]);
      } catch (e) {
        // Expected - navigation was cancelled
      }
      
      // Verify that navigation was properly managed
      expect(controls.getIsNavigating()).toBe(false);
      
      logger.info('✅ Concurrent navigation handled correctly');
    }, 5000); // Reduced timeout
  });

  describe('Random Walk System', () => {
    it('should start and stop random walk', async () => {
      // Start random walk with short duration
      const walkPromise = controls.startRandomWalk(1000, 3, 2000); // 2 second duration
      
      // Should be walking
      expect(controls.getIsWalkingRandomly()).toBe(true);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Stop random walk
      controls.stopRandomWalk();
      
      // Should not be walking
      expect(controls.getIsWalkingRandomly()).toBe(false);
      
      await walkPromise;
      
      logger.info('✅ Random walk start/stop works correctly');
    }, TEST_CONFIG.RANDOM_WALK_DURATION);

    it('should complete random walk duration', async () => {
      const duration = 1500; // 1.5 seconds - shorter for testing
      const startTime = Date.now();
      
      // Start random walk with specific duration
      const walkPromise = controls.startRandomWalk(200, 1, duration); // Shorter interval and distance
      
      // Wait for the walk to complete
      await walkPromise;
      
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      
      // Should complete around the specified duration (with reasonable tolerance)
      expect(actualDuration).toBeGreaterThanOrEqual(duration - 200); // Allow 200ms early
      expect(actualDuration).toBeLessThanOrEqual(duration + 1000); // Allow 1s late
      expect(controls.getIsWalkingRandomly()).toBe(false);
      
      logger.info(`✅ Random walk completed in ${actualDuration}ms (expected ~${duration}ms)`);
    }, 5000); // Reduced timeout

    it('should stop random walk when starting navigation', async () => {
      // Start random walk
      controls.startRandomWalk(1000, 3, 10000); // Long duration
      
      // Wait for it to start
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(controls.getIsWalkingRandomly()).toBe(true);
      
      // Start navigation (should stop random walk)
      const navPromise = controls.goto(5, 5);
      
      // Random walk should be stopped
      expect(controls.getIsWalkingRandomly()).toBe(false);
      
      // Clean up
      controls.stopNavigation('test cleanup');
      await navPromise;
      
      logger.info('✅ Random walk stopped when navigation started');
    }, TEST_CONFIG.NAVIGATION_TIMEOUT);
  });

  describe('Player State Validation', () => {
    it('should validate player state correctly', () => {
      // This tests the private _validatePlayerState method indirectly
      // by checking if navigation works with valid player state
      
      if (isConnectedToServer) {
        // With real server, player state should be valid
        expect(() => controls.goto(1, 1)).not.toThrow();
      } else {
        // With mock world, ensure player state is valid
        expect(mockWorld.entities.player.base.position).toBeInstanceOf(THREE.Vector3);
        expect(mockWorld.entities.player.base.quaternion).toBeInstanceOf(THREE.Quaternion);
        expect(() => controls.goto(1, 1)).not.toThrow();
      }
      
      logger.info('✅ Player state validation works correctly');
    });

    it('should handle invalid player state gracefully', async () => {
      if (!isConnectedToServer) {
        // Test with invalid position (NaN values)
        const originalPosition = mockWorld.entities.player.base.position.clone();
        mockWorld.entities.player.base.position.set(Number.NaN, Number.NaN, Number.NaN);
        
        // Navigation should handle this gracefully
        await controls.goto(5, 5);
        expect(controls.getIsNavigating()).toBe(false);
        
        // Restore valid position
        mockWorld.entities.player.base.position.copy(originalPosition);
      }
      
      logger.info('✅ Invalid player state handled gracefully');
    });
  });

  describe('Camera System', () => {
    it('should create camera with proper bindings', () => {
      const camera = controls.camera;
      expect(camera).toBeDefined();
      
      if (camera) {
        // Test rotation binding
        const originalY = camera.rotation.y;
        camera.rotation.y = Math.PI / 4;
        
        // Quaternion should update when rotation changes
        expect(camera.quaternion.y).not.toBe(0);
        
        // Reset
        camera.rotation.y = originalY;
      }
      
      logger.info('✅ Camera rotation bindings work correctly');
    });

    it('should inherit world rig properties', () => {
      const camera = controls.camera;
      expect(camera).toBeDefined();
      
      if (camera && controls.world.rig) {
        // Camera should inherit from world rig
        expect(camera.position).toBeInstanceOf(THREE.Vector3);
        expect(camera.quaternion).toBeInstanceOf(THREE.Quaternion);
        expect(camera.rotation).toBeInstanceOf(THREE.Euler);
      }
      
      logger.info('✅ Camera inherits world rig properties correctly');
    });
  });

  describe('Integration with Real Hyperfy Server', () => {
    it('should work with real world entities', async () => {
      if (!isConnectedToServer) {
        logger.info('⏭️ Skipping real server test (not connected)');
        return;
      }

      logger.info('🌍 Using real Hyperfy world for test');

      // Test basic navigation with timeout
      const navigationPromise = controls.goto(2, 2);
      
      // Wait for navigation to start
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Stop navigation after short time to prevent timeout
      await new Promise(resolve => setTimeout(resolve, 500));
      controls.stopNavigation('test cleanup');
      
      // Wait for navigation promise to resolve
      try {
        await Promise.race([
          navigationPromise,
          new Promise(resolve => setTimeout(resolve, 2000)) // 2 second max wait
        ]);
      } catch (e) {
        // Expected - navigation was cancelled
      }

      // Verify controls are working
      expect(controls.getIsNavigating()).toBe(false);
      expect(controls.camera).toBeDefined();
      expect(controls.camera?.$camera).toBe(true);

      logger.info('✅ Integration with real Hyperfy server works');
    }, 5000); // Reduced timeout

    it('should handle real world disconnection gracefully', async () => {
      if (!isConnectedToServer) {
        logger.info('⏭️ Skipping disconnection test (not connected)');
        return;
      }
      
      // Test that controls handle world state changes
      expect(() => {
        controls.stopNavigation('disconnection test');
        controls.stopRandomWalk();
      }).not.toThrow();
      
      logger.info('✅ Handles world disconnection gracefully');
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle rapid key state changes', () => {
      const startTime = Date.now();
      
      // Rapidly change key states
      for (let i = 0; i < 1000; i++) {
        controls.setKey('keyW', i % 2 === 0);
        controls.setKey('keyA', i % 3 === 0);
        controls.setKey('keyS', i % 5 === 0);
        controls.setKey('keyD', i % 7 === 0);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(1000);
      
      logger.info(`✅ Handled 4000 key state changes in ${duration}ms`);
    });

    it('should handle multiple postLateUpdate calls', () => {
      // Set some keys
      controls.setKey('keyW', true);
      controls.setKey('keyA', true);
      
      const startTime = Date.now();
      
      // Call postLateUpdate many times
      for (let i = 0; i < 1000; i++) {
        controls.postLateUpdate();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly
      expect(duration).toBeLessThan(500);
      
      logger.info(`✅ Handled 1000 postLateUpdate calls in ${duration}ms`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle navigation with same start and target position', async () => {
      if (!isConnectedToServer) {
        // Set player at origin
        mockWorld.entities.player.base.position.set(0, 0, 0);
      }
      
      // Navigate to same position
      await controls.goto(0, 0);
      
      // Should complete immediately
      expect(controls.getIsNavigating()).toBe(false);
      
      logger.info('✅ Same position navigation handled correctly');
    });

    it('should handle very large navigation distances', async () => {
      // Test with very large coordinates
      const largeX = 1000000;
      const largeZ = 1000000;
      
      const startTime = Date.now();
      const navPromise = controls.goto(largeX, largeZ);
      
      // Stop after a short time
      setTimeout(() => controls.stopNavigation('large distance test'), 1000);
      
      await navPromise;
      const endTime = Date.now();
      
      // Should handle gracefully and stop when requested
      expect(endTime - startTime).toBeLessThan(2000);
      expect(controls.getIsNavigating()).toBe(false);
      
      logger.info('✅ Large distance navigation handled correctly');
    }, 5000);

    it('should handle rapid start/stop cycles', async () => {
      // Rapidly start and stop navigation
      for (let i = 0; i < 10; i++) {
        const navPromise = controls.goto(i, i);
        controls.stopNavigation(`cycle ${i}`);
        await navPromise;
      }
      
      expect(controls.getIsNavigating()).toBe(false);
      
      logger.info('✅ Rapid start/stop cycles handled correctly');
    });
  });
}); 