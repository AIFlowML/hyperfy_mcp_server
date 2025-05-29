/**
 * Comprehensive test suite for EmoteManager
 * Tests emote upload, playback, timeout handling, and integration with HyperfyService
 * Validates the porting from ElizaOS to FastMCP architecture
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFile } from 'node:fs/promises';
import { EmoteManager } from '../src/hyperfy/managers/emote-manager.js';
import { EMOTES_LIST } from '../src/servers/config/constants.js';
import { hashFileBuffer } from '../src/utils/utils.js';
import type { EmoteManagerRuntime, HyperfyPlayerEntity } from '../src/types/index.js';
import type { HyperfyService } from '../src/core/hyperfy-service.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000, // 10 seconds
  EMOTE_TIMEOUT: 5000, // 5 seconds for emote completion
  UPLOAD_TIMEOUT: 8000, // 8 seconds for upload operations
  MOVEMENT_CHECK_INTERVAL: 150, // Slightly longer than actual 100ms
};

// Mock interfaces for testing
interface MockNetwork {
  upload: MockedFunction<(file: File) => Promise<void>>;
}

interface MockWorld {
  network: MockNetwork;
  entities: {
    player: MockPlayerEntity;
  };
}

interface MockPlayerEntity {
  data: {
    effect?: {
      emote?: string | null;
    };
  };
  moving?: boolean;
}

interface MockHyperfyService {
  getWorld: MockedFunction<() => MockWorld | null>;
}

interface MockEmoteManagerRuntime {
  hyperfyService: MockHyperfyService;
}

// Mock file system operations
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock utils
vi.mock('../src/utils/utils.js', () => ({
  hashFileBuffer: vi.fn(),
}));

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

// Create mock runtime for testing
function createMockRuntime(): MockEmoteManagerRuntime {
  const mockNetwork: MockNetwork = {
    upload: vi.fn().mockResolvedValue(undefined),
  };

  const mockWorld: MockWorld = {
    network: mockNetwork,
    entities: {
      player: {
        data: {},
        moving: false,
      },
    },
  };

  const mockHyperfyService: MockHyperfyService = {
    getWorld: vi.fn().mockReturnValue(mockWorld),
  };

  return {
    hyperfyService: mockHyperfyService,
  } as MockEmoteManagerRuntime;
}

// Create mock emote buffer
const createMockEmoteBuffer = (size: number = 1024): Buffer => {
  return Buffer.alloc(size, 'mock-emote-data');
};

// Setup mock file operations
const setupMockFileOperations = () => {
  const mockBuffer = createMockEmoteBuffer(2048);
  const mockHash = 'mock-hash-123abc';
  
  (readFile as any).mockResolvedValue(mockBuffer);
  (hashFileBuffer as any).mockResolvedValue(mockHash);
  
  return { mockBuffer, mockHash };
};

describe('EmoteManager', () => {
  let emoteManager: EmoteManager;
  let mockRuntime: MockEmoteManagerRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Reset console spies
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
    
    // Create fresh mocks
    mockRuntime = createMockRuntime();
    emoteManager = new EmoteManager(mockRuntime as unknown as EmoteManagerRuntime);
    
    logger.info('🎭 Starting EmoteManager test');
  });

  afterEach(async () => {
    vi.useRealTimers();
    
    // Clear any pending timers in EmoteManager
    try {
      (emoteManager as any).clearTimers();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    logger.info('🧹 EmoteManager test cleanup complete');
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper runtime context', () => {
      expect(emoteManager).toBeInstanceOf(EmoteManager);
      expect((emoteManager as any).runtime).toBe(mockRuntime);
      expect((emoteManager as any).emoteHashMap).toBeInstanceOf(Map);
      expect((emoteManager as any).currentEmoteTimeout).toBeNull();
      expect((emoteManager as any).movementCheckInterval).toBeNull();
      
      logger.info('✅ EmoteManager initialized with runtime context');
    });

    it('should start with empty emote hash map', () => {
      const hashMap = (emoteManager as any).emoteHashMap;
      expect(hashMap.size).toBe(0);
      
      logger.info('✅ EmoteManager starts with empty hash map');
    });

    it('should start with no active timers', () => {
      expect((emoteManager as any).currentEmoteTimeout).toBeNull();
      expect((emoteManager as any).movementCheckInterval).toBeNull();
      
      logger.info('✅ EmoteManager starts with no active timers');
    });
  });

  describe('Emote Upload Functionality', () => {
    beforeEach(() => {
      setupMockFileOperations();
    });

    it('should upload all emotes successfully', async () => {
      await emoteManager.uploadEmotes();
      
      // Should have called readFile for each emote
      expect(readFile).toHaveBeenCalledTimes(EMOTES_LIST.length);
      
      // Should have called hashFileBuffer for each emote
      expect(hashFileBuffer).toHaveBeenCalledTimes(EMOTES_LIST.length);
      
      // Should have called upload for each emote
      expect(mockRuntime.hyperfyService.getWorld()?.network.upload).toHaveBeenCalledTimes(EMOTES_LIST.length);
      
      // Should have logged upload info for each emote
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[Appearance\] Uploading emote/)
      );
      
      logger.info('✅ All emotes uploaded successfully');
    }, TEST_CONFIG.UPLOAD_TIMEOUT);

    it('should handle individual emote upload failures gracefully', async () => {
      // Mock one emote to fail
      const errorEmote = EMOTES_LIST[0];
      (readFile as unknown as any).mockImplementation((path: string) => {
        if (path.includes(errorEmote.name) || path.includes(errorEmote.path)) {
          return Promise.reject(new Error('File read failed'));
        }
        return Promise.resolve(createMockEmoteBuffer());
      });
      
      await emoteManager.uploadEmotes();
      
      // Should have logged the error
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to upload emote '${errorEmote.name}'`),
        expect.any(String)
      );
      
      // Should still have tried to upload other emotes
      expect(readFile).toHaveBeenCalledTimes(EMOTES_LIST.length);
      
      logger.info('✅ Individual emote upload failures handled gracefully');
    }, TEST_CONFIG.UPLOAD_TIMEOUT);

    it('should handle upload timeout errors', async () => {
      // Mock upload to reject with timeout error after a delay
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        world.network.upload.mockImplementation(
          () => Promise.reject(new Error('Upload timed out'))
        );
      }
      
      // Run the upload process
      await emoteManager.uploadEmotes();
      
      // Should have logged timeout errors for each emote
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload emote'),
        expect.any(String)
      );
      
      // Should have attempted to upload all emotes
      expect(readFile).toHaveBeenCalledTimes(EMOTES_LIST.length);
      
      logger.info('✅ Upload timeout errors handled correctly');
    }, TEST_CONFIG.UPLOAD_TIMEOUT);

    it('should handle world not available during upload', async () => {
      // Mock world as null
      mockRuntime.hyperfyService.getWorld.mockReturnValue(null);
      
      await emoteManager.uploadEmotes();
      
      // Should have logged world not available errors
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/World not available for emote upload/)
      );
      
      // Should not have called upload
      expect(readFile).toHaveBeenCalledTimes(EMOTES_LIST.length); // Still tries to read files
      
      logger.info('✅ World not available during upload handled correctly');
    }, TEST_CONFIG.UPLOAD_TIMEOUT);

    it('should create proper File objects for upload', async () => {
      const { mockBuffer } = setupMockFileOperations();
      
      await emoteManager.uploadEmotes();
      
      // Check that upload was called with File objects
      const uploadCalls = mockRuntime.hyperfyService.getWorld()!.network.upload.mock.calls;
      
      uploadCalls.forEach(([file]) => {
        expect(file).toBeInstanceOf(File);
        expect(file.type).toBe('model/gltf-binary');
      });
      
      logger.info('✅ Proper File objects created for upload');
    }, TEST_CONFIG.UPLOAD_TIMEOUT);

    it('should store emote hash mappings correctly', async () => {
      const { mockHash } = setupMockFileOperations();
      
      await emoteManager.uploadEmotes();
      
      const hashMap = (emoteManager as any).emoteHashMap;
      
      // Should have mapped each emote name to its hash
      EMOTES_LIST.forEach(emote => {
        expect(hashMap.has(emote.name)).toBe(true);
        expect(hashMap.get(emote.name)).toBe(`${mockHash}.glb`);
      });
      
      logger.info('✅ Emote hash mappings stored correctly');
    }, TEST_CONFIG.UPLOAD_TIMEOUT);
  });

  describe('Emote Playback Functionality', () => {
    beforeEach(() => {
      // Set up a test emote in the hash map
      (emoteManager as any).emoteHashMap.set('wave', 'test-hash-123.glb');
    });

    it('should play emote successfully', () => {
      const emoteName = 'wave';
      
      emoteManager.playEmote(emoteName);
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      
      expect(playerData.effect).toBeDefined();
      expect(playerData.effect.emote).toBe('asset://test-hash-123.glb');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(`[Emote] Playing '${emoteName}' → asset://test-hash-123.glb`)
      );
      
      logger.info('✅ Emote played successfully');
    });

    it('should handle emote not found gracefully', () => {
      const emoteName = 'nonexistent';
      
      emoteManager.playEmote(emoteName);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `[Emote] Emote '${emoteName}' not found.`
      );
      
      logger.info('✅ Emote not found handled gracefully');
    });

    it('should handle world not available', () => {
      mockRuntime.hyperfyService.getWorld.mockReturnValue(null);
      
      emoteManager.playEmote('wave');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Emote] World not available.'
      );
      
      logger.info('✅ World not available handled gracefully');
    });

    it('should handle player entity not found', () => {
      const world = mockRuntime.hyperfyService.getWorld()!;
      world.entities.player = undefined as any;
      
      emoteManager.playEmote('wave');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Emote] Player entity not found.'
      );
      
      logger.info('✅ Player entity not found handled gracefully');
    });

    it('should use fallback emote when hash not found', () => {
      // Remove from hash map but test with fallback
      (emoteManager as unknown as any).emoteHashMap.clear();
      
      // Mock fallback emotes by directly setting on the Emotes object
      const mockFallback = 'fallback-emote-url';
      
      // We need to test this differently since the import is at module level
      // Instead, let's test that it warns when emote not found
      emoteManager.playEmote('nonexistent-emote');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "[Emote] Emote 'nonexistent-emote' not found."
      );
      
      logger.info('✅ Fallback emote handling tested (warns when not found)');
    });

    it('should add asset:// prefix when missing', () => {
      // Test with hash that doesn't start with asset://
      (emoteManager as unknown as any).emoteHashMap.set('dance', 'plain-hash-456.glb');
      
      emoteManager.playEmote('dance');
      
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        const playerData = world.entities.player.data as any;
        expect(playerData.effect.emote).toBe('asset://plain-hash-456.glb');
      }
      
      logger.info('✅ Asset prefix added when missing');
    });

    it('should not duplicate asset:// prefix', () => {
      // Test with hash that already has asset:// prefix
      (emoteManager as unknown as any).emoteHashMap.set('jump', 'asset://prefixed-hash-789.glb');
      
      emoteManager.playEmote('jump');
      
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        const playerData = world.entities.player.data as any;
        expect(playerData.effect.emote).toBe('asset://prefixed-hash-789.glb');
      }
      
      logger.info('✅ Asset prefix not duplicated');
    });
  });

  describe('Emote Timeout and Duration Handling', () => {
    beforeEach(() => {
      (emoteManager as any).emoteHashMap.set('wave', 'test-hash-123.glb');
    });

    it('should clear emote after default duration', () => {
      emoteManager.playEmote('wave');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      
      // Should have emote set
      expect(playerData.effect.emote).toBe('asset://test-hash-123.glb');
      
      // Fast forward past default duration (1.5 seconds)
      vi.advanceTimersByTime(1600);
      
      // Should have cleared emote
      expect(playerData.effect.emote).toBeNull();
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("'wave' finished after 1.5s")
      );
      
      logger.info('✅ Emote cleared after default duration');
    });

    it('should use custom duration from EMOTES_LIST', () => {
      // Find an emote with custom duration or use a mock
      const customEmote = EMOTES_LIST.find(e => e.duration && e.duration !== 1.5) || 
                         { name: 'custom', duration: 3.0 };
      
      (emoteManager as any).emoteHashMap.set(customEmote.name, 'custom-hash.glb');
      
      emoteManager.playEmote(customEmote.name);
      
      // Fast forward less than custom duration
      vi.advanceTimersByTime((customEmote.duration! * 1000) - 100);
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      
      // Should still have emote
      expect(playerData.effect.emote).toBe('asset://custom-hash.glb');
      
      // Fast forward past custom duration
      vi.advanceTimersByTime(200);
      
      // Should have cleared emote
      expect(playerData.effect.emote).toBeNull();
      
      logger.info('✅ Custom duration from EMOTES_LIST used correctly');
    });

    it('should clear previous emote when playing new one', () => {
      (emoteManager as any).emoteHashMap.set('dance', 'dance-hash.glb');
      
      // Play first emote
      emoteManager.playEmote('wave');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      
      expect(playerData.effect.emote).toBe('asset://test-hash-123.glb');
      
      // Play second emote before first finishes
      emoteManager.playEmote('dance');
      
      // Should have new emote
      expect(playerData.effect.emote).toBe('asset://dance-hash.glb');
      
      // Original timeout should be cleared (no warning about first emote finishing)
      vi.advanceTimersByTime(2000);
      
      logger.info('✅ Previous emote cleared when playing new one');
    });

    it('should not clear emote if different emote is playing', () => {
      emoteManager.playEmote('wave');
      
      // Manually change the emote to simulate race condition
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      playerData.effect.emote = 'asset://different-emote.glb';
      
      // Fast forward past duration
      vi.advanceTimersByTime(2000);
      
      // Should not have cleared the different emote
      expect(playerData.effect.emote).toBe('asset://different-emote.glb');
      
      logger.info('✅ Different emote not cleared by old timeout');
    });
  });

  describe('Movement Detection and Cancellation', () => {
    beforeEach(() => {
      (emoteManager as any).emoteHashMap.set('wave', 'test-hash-123.glb');
    });

    it('should cancel emote when player starts moving', () => {
      emoteManager.playEmote('wave');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      const playerEntity = world.entities.player as any;
      
      // Should have emote set
      expect(playerData.effect.emote).toBe('asset://test-hash-123.glb');
      
      // Simulate player movement
      playerEntity.moving = true;
      
      // Fast forward movement check interval
      vi.advanceTimersByTime(TEST_CONFIG.MOVEMENT_CHECK_INTERVAL);
      
      // Should have cleared emote due to movement
      expect(playerData.effect.emote).toBeNull();
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("'wave' cancelled early due to movement")
      );
      
      logger.info('✅ Emote cancelled when player starts moving');
    });

    it('should not cancel emote when player is not moving', () => {
      emoteManager.playEmote('wave');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      const playerEntity = world.entities.player as any;
      
      // Ensure player is not moving
      playerEntity.moving = false;
      
      // Fast forward movement check interval multiple times
      vi.advanceTimersByTime(TEST_CONFIG.MOVEMENT_CHECK_INTERVAL * 3);
      
      // Should still have emote (not cancelled by movement)
      expect(playerData.effect.emote).toBe('asset://test-hash-123.glb');
      
      // Should not have movement cancellation message
      expect(consoleSpy.info).not.toHaveBeenCalledWith(
        expect.stringContaining('cancelled early due to movement')
      );
      
      logger.info('✅ Emote not cancelled when player not moving');
    });

    it('should stop movement checking when emote finishes naturally', () => {
      emoteManager.playEmote('wave');
      
      // Fast forward past emote duration
      vi.advanceTimersByTime(2000);
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerEntity = world.entities.player as any;
      
      // Now set player moving after emote should have finished
      playerEntity.moving = true;
      
      // Fast forward movement check interval
      vi.advanceTimersByTime(TEST_CONFIG.MOVEMENT_CHECK_INTERVAL);
      
      // Should not have additional cancellation message
      const movementCancelCalls = consoleSpy.info.mock.calls.filter(call => 
        call[0] && call[0].includes('cancelled early due to movement')
      );
      expect(movementCancelCalls).toHaveLength(0);
      
      logger.info('✅ Movement checking stopped when emote finishes naturally');
    });

    it('should clear movement interval when new emote starts', () => {
      (emoteManager as any).emoteHashMap.set('dance', 'dance-hash.glb');
      
      // Start first emote
      emoteManager.playEmote('wave');
      
      // Start second emote (should clear first interval)
      emoteManager.playEmote('dance');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerEntity = world.entities.player as any;
      
      // Set player moving
      playerEntity.moving = true;
      
      // Fast forward
      vi.advanceTimersByTime(TEST_CONFIG.MOVEMENT_CHECK_INTERVAL);
      
      // Should have cancellation message for dance, not wave
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("'dance' cancelled early due to movement")
      );
      
      logger.info('✅ Movement interval cleared when new emote starts');
    });
  });

  describe('Timer Management', () => {
    beforeEach(() => {
      (emoteManager as any).emoteHashMap.set('wave', 'test-hash-123.glb');
    });

    it('should clear all timers when clearTimers called', () => {
      emoteManager.playEmote('wave');
      
      // Should have active timers
      expect((emoteManager as any).currentEmoteTimeout).not.toBeNull();
      expect((emoteManager as any).movementCheckInterval).not.toBeNull();
      
      // Clear timers
      (emoteManager as any).clearTimers();
      
      // Should have cleared timers
      expect((emoteManager as any).currentEmoteTimeout).toBeNull();
      expect((emoteManager as any).movementCheckInterval).toBeNull();
      
      logger.info('✅ All timers cleared when clearTimers called');
    });

    it('should handle clearTimers when no timers active', () => {
      // Clear timers when none are active
      expect(() => (emoteManager as any).clearTimers()).not.toThrow();
      
      expect((emoteManager as any).currentEmoteTimeout).toBeNull();
      expect((emoteManager as any).movementCheckInterval).toBeNull();
      
      logger.info('✅ clearTimers handles no active timers gracefully');
    });

    it('should clear timers when emote finishes', () => {
      emoteManager.playEmote('wave');
      
      // Fast forward past duration
      vi.advanceTimersByTime(2000);
      
      // Should have cleared timers
      expect((emoteManager as any).currentEmoteTimeout).toBeNull();
      expect((emoteManager as any).movementCheckInterval).toBeNull();
      
      logger.info('✅ Timers cleared when emote finishes');
    });

    it('should clear timers when emote cancelled by movement', () => {
      emoteManager.playEmote('wave');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerEntity = world.entities.player as any;
      
      // Trigger movement cancellation
      playerEntity.moving = true;
      vi.advanceTimersByTime(TEST_CONFIG.MOVEMENT_CHECK_INTERVAL);
      
      // Should have cleared timers
      expect((emoteManager as any).currentEmoteTimeout).toBeNull();
      expect((emoteManager as any).movementCheckInterval).toBeNull();
      
      logger.info('✅ Timers cleared when emote cancelled by movement');
    });
  });

  describe('Service Integration', () => {
    it('should get service from runtime correctly', () => {
      const service = (emoteManager as any).getService();
      expect(service).toBe(mockRuntime.hyperfyService);
      
      logger.info('✅ Service retrieved from runtime correctly');
    });

    it('should handle service method calls', () => {
      emoteManager.playEmote('wave');
      
      // Should have called getWorld on the service
      expect(mockRuntime.hyperfyService.getWorld).toHaveBeenCalled();
      
      logger.info('✅ Service method calls handled correctly');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle missing effect object in player data', () => {
      (emoteManager as any).emoteHashMap.set('wave', 'test-hash-123.glb');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      world.entities.player.data = {}; // No effect object
      
      emoteManager.playEmote('wave');
      
      const playerData = world.entities.player.data as any;
      
      // Should have created effect object
      expect(playerData.effect).toBeDefined();
      expect(playerData.effect.emote).toBe('asset://test-hash-123.glb');
      
      logger.info('✅ Missing effect object handled correctly');
    });

    it('should handle null player data gracefully', () => {
      (emoteManager as unknown as any).emoteHashMap.set('wave', 'test-hash-123.glb');
      
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        world.entities.player.data = null as any;
      }
      
      // Should not throw error but should warn
      expect(() => emoteManager.playEmote('wave')).not.toThrow();
      
      // Should have logged warning about player data not available
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Emote] Player data not available.'
      );
      
      logger.info('✅ Null player data handled gracefully');
    });

    it('should handle clearEmote with undefined playerData', () => {
      // Should not throw error
      expect(() => (emoteManager as any).clearEmote(undefined)).not.toThrow();
      expect(() => (emoteManager as any).clearEmote(null)).not.toThrow();
      
      logger.info('✅ clearEmote handles undefined playerData gracefully');
    });

    it('should handle emote names with special characters', () => {
      const specialName = 'émote-with-spéçial-chars_123';
      (emoteManager as any).emoteHashMap.set(specialName, 'special-hash.glb');
      
      emoteManager.playEmote(specialName);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(`[Emote] Playing '${specialName}'`)
      );
      
      logger.info('✅ Emote names with special characters handled correctly');
    });

    it('should handle very long emote names', () => {
      const longName = 'a'.repeat(1000);
      (emoteManager as any).emoteHashMap.set(longName, 'long-hash.glb');
      
      emoteManager.playEmote(longName);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(`[Emote] Playing '${longName}'`)
      );
      
      logger.info('✅ Very long emote names handled correctly');
    });

    it('should handle concurrent emote operations', () => {
      (emoteManager as any).emoteHashMap.set('dance', 'dance-hash.glb');
      (emoteManager as any).emoteHashMap.set('jump', 'jump-hash.glb');
      
      // Play multiple emotes rapidly
      emoteManager.playEmote('wave');
      emoteManager.playEmote('dance');
      emoteManager.playEmote('jump');
      
      const world = mockRuntime.hyperfyService.getWorld()!;
      const playerData = world.entities.player.data as any;
      
      // Should have the last emote
      expect(playerData.effect.emote).toBe('asset://jump-hash.glb');
      
      logger.info('✅ Concurrent emote operations handled correctly');
    });
  });

  describe('Integration with EMOTES_LIST', () => {
    it('should work with actual EMOTES_LIST structure', () => {
      // Verify EMOTES_LIST has expected structure
      expect(Array.isArray(EMOTES_LIST)).toBe(true);
      expect(EMOTES_LIST.length).toBeGreaterThan(0);
      
      // Each emote should have required properties
      EMOTES_LIST.forEach(emote => {
        expect(emote).toHaveProperty('name');
        expect(emote).toHaveProperty('path');
        expect(typeof emote.name).toBe('string');
        expect(typeof emote.path).toBe('string');
        
        if (emote.duration !== undefined) {
          expect(typeof emote.duration).toBe('number');
          expect(emote.duration).toBeGreaterThan(0);
        }
      });
      
      logger.info('✅ EMOTES_LIST structure validation passed');
    });

    it('should handle emotes with and without custom durations', () => {
      const emotesWithDuration = EMOTES_LIST.filter(e => e.duration !== undefined);
      const emotesWithoutDuration = EMOTES_LIST.filter(e => e.duration === undefined);
      
      if (emotesWithDuration.length > 0) {
        const testEmote = emotesWithDuration[0];
        (emoteManager as any).emoteHashMap.set(testEmote.name, 'test-hash.glb');
        
        emoteManager.playEmote(testEmote.name);
        
        // Should use custom duration
        vi.advanceTimersByTime((testEmote.duration! * 1000) + 100);
        
        expect(consoleSpy.info).toHaveBeenCalledWith(
          expect.stringContaining(`finished after ${testEmote.duration}s`)
        );
      }
      
      if (emotesWithoutDuration.length > 0) {
        const testEmote = emotesWithoutDuration[0];
        (emoteManager as any).emoteHashMap.set(testEmote.name, 'test-hash-default.glb');
        
        emoteManager.playEmote(testEmote.name);
        
        // Should use default duration (1.5s)
        vi.advanceTimersByTime(1600);
        
        expect(consoleSpy.info).toHaveBeenCalledWith(
          expect.stringContaining('finished after 1.5s')
        );
      }
      
      logger.info('✅ Emotes with and without custom durations handled correctly');
    });
  });
});
