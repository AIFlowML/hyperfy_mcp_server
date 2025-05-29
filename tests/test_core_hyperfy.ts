/**
 * Comprehensive test suite for HyperfyService
 * Tests core Hyperfy world connection, manager initialization, chat handling, and service lifecycle
 * Validates the complete FastMCP to Hyperfy integration pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HyperfyService, type HyperfyRuntime, type HyperfyEntity } from '../src/core/hyperfy-service.js';
import { agentActivityLock } from '../src/hyperfy/managers/guards.js';
import { createLogger } from '../src/utils/eliza-compat.js';
import type { AgentControls } from '../src/hyperfy/systems/controls.js';
import type { BehaviorManager } from '../src/hyperfy/managers/behavior-manager.js';
import type { EmoteManager } from '../src/hyperfy/managers/emote-manager.js';
import type { MessageManager } from '../src/hyperfy/managers/message-manager.js';
import type { VoiceManager } from '../src/hyperfy/managers/voice-manager.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 20000, // 20 seconds for connection tests
  CONNECTION_TIMEOUT: 5000, // 5 seconds for connection
  POLLING_INTERVAL: 1000, // 1 second for appearance polling
  CHAT_TIMEOUT: 3000, // 3 seconds for chat processing
};

// Mock external dependencies
vi.mock('../src/hyperfy/core/createNodeClientWorld.js', () => ({
  createNodeClientWorld: vi.fn(() => ({
    playerNamesMap: new Map(),
    systems: [],
    chat: {
      add: vi.fn(),
      msgs: [],
      listeners: [],
      subscribe: vi.fn(),
    },
    events: {
      emit: vi.fn(),
    },
    network: {
      send: vi.fn(),
      upload: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      id: 'test-network-id',
    },
    entities: {
      player: {
        data: {
          id: 'test-player-id',
          name: 'TestPlayer',
        },
        setSessionAvatar: vi.fn(),
        modify: vi.fn(),
      },
      items: new Map(),
    },
    assetsUrl: 'https://test-assets.hyperfy.io',
    scripts: {
      evaluate: vi.fn(),
    },
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

vi.mock('../src/hyperfy/systems/controls.js', () => ({
  AgentControls: vi.fn().mockImplementation(() => ({
    // Mock controls implementation
  })),
}));

vi.mock('../src/hyperfy/systems/loader.js', () => ({
  AgentLoader: vi.fn().mockImplementation(() => ({
    // Mock loader implementation
  })),
}));

vi.mock('../src/hyperfy/systems/liveKit.js', () => ({
  AgentLiveKit: vi.fn().mockImplementation(() => ({
    // Mock LiveKit implementation
  })),
}));

vi.mock('../src/hyperfy/systems/actions.js', () => ({
  AgentActions: vi.fn().mockImplementation(() => ({
    // Mock actions implementation
  })),
}));

vi.mock('../src/lib/physx/loadPhysX.js', () => ({
  loadPhysX: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/hyperfy/managers/behavior-manager.js', () => ({
  BehaviorManager: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../src/hyperfy/managers/emote-manager.js', () => ({
  EmoteManager: vi.fn().mockImplementation(() => ({
    uploadEmotes: vi.fn().mockResolvedValue(undefined),
    playEmote: vi.fn(),
  })),
}));

vi.mock('../src/hyperfy/managers/message-manager.js', () => ({
  MessageManager: vi.fn().mockImplementation(() => ({
    handleMessage: vi.fn(),
  })),
}));

vi.mock('../src/hyperfy/managers/voice-manager.js', () => ({
  VoiceManager: vi.fn().mockImplementation(() => ({
    // Mock voice manager implementation
  })),
}));

vi.mock('../src/utils/utils.js', () => ({
  hashFileBuffer: vi.fn().mockResolvedValue('test-hash-123'),
}));

vi.mock('../src/utils/eliza-compat.js', () => ({
  generateUUID: vi.fn(() => `uuid-${Date.now()}`),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock-avatar-data')),
  },
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock-avatar-data')),
}));

vi.mock('ws', () => ({
  WebSocket: vi.fn().mockImplementation(() => ({
    // Mock WebSocket implementation
  })),
}));

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Create mock runtime for testing
function createMockRuntime(): HyperfyRuntime {
  return {
    agentId: 'test-agent-id',
    character: {
      name: 'TestAgent',
    },
    getEntityById: vi.fn().mockResolvedValue({
      metadata: {
        hyperfy: {
          id: 'test-player-id',
          name: 'TestAgent',
          userName: 'TestAgent',
        },
      },
    } as HyperfyEntity),
    updateEntity: vi.fn().mockResolvedValue(undefined),
    hyperfyService: undefined, // Will be set after service creation
    logger: createLogger(),
    generateUUID: vi.fn(() => `uuid-${Date.now()}`),
    agentName: 'TestAgent',
    aiModel: 'test-model',
  };
}

// Type-safe access to private properties
interface HyperfyServicePrivate {
  world: any; // HyperfyWorld is internal interface
  controls: AgentControls | null;
  isConnectedState: boolean;
  wsUrl: string | null;
  _currentWorldId: string | null;
  processedMsgIds: Set<string>;
  playerNamesMap: Map<string, string>;
  appearanceIntervalId: NodeJS.Timeout | null;
  appearanceSet: boolean;
  nameSet: boolean;
  connectionTime: number | null;
  behaviorManager: BehaviorManager;
  emoteManager: EmoteManager;
  messageManager: MessageManager;
  voiceManager: VoiceManager;
  runtime: HyperfyRuntime;
  subscribeToHyperfyEvents(): void;
  uploadCharacterAssets(): Promise<{ success: boolean; error?: string }>;
  startAppearancePolling(): void;
  stopAppearancePolling(): void;
  handleDisconnect(): Promise<void>;
  startChatSubscription(): void;
}

describe('HyperfyService', () => {
  let hyperfyService: HyperfyService;
  let mockRuntime: HyperfyRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Reset console spies
    for (const spy of Object.values(consoleSpy)) {
      spy.mockClear();
    }
    
    // Reset activity lock
    agentActivityLock.forceReset();
    
    // Create fresh mocks
    mockRuntime = createMockRuntime();
    hyperfyService = new HyperfyService(mockRuntime);
    
    // Set up service reference in runtime
    mockRuntime.hyperfyService = hyperfyService;
    
    logger.info('🌐 Starting HyperfyService test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    // Force reset activity lock
    agentActivityLock.forceReset();
    
    logger.info('🧹 HyperfyService test cleanup complete');
  });

  describe('Constructor and Static Methods', () => {
    it('should initialize with proper runtime context', () => {
      expect(hyperfyService).toBeInstanceOf(HyperfyService);
      expect((hyperfyService as unknown as HyperfyServicePrivate).runtime).toBe(mockRuntime);
      expect(hyperfyService.currentWorldId).toBe(null);
      expect(hyperfyService.isConnected()).toBe(false);
      
      // Should have logged creation
      expect(consoleSpy.info).toHaveBeenCalledWith('HyperfyService instance created');
      
      logger.info('✅ HyperfyService initialized with runtime context');
    });

    it('should have correct service type', () => {
      expect(HyperfyService.serviceType).toBe('hyperfy');
      expect(hyperfyService.capabilityDescription).toBe('Manages connection and interaction with a Hyperfy world.');
      
      logger.info('✅ Service type and description correct');
    });

    it('should start service with automatic connection', async () => {
      const service = await HyperfyService.start(mockRuntime);
      
      expect(service).toBeInstanceOf(HyperfyService);
      expect(consoleSpy.info).toHaveBeenCalledWith('*** Starting Hyperfy service ***');
      
      // Check for the specific log message with the correct format
      const logCalls = consoleSpy.info.mock.calls;
      const connectionLogCall = logCalls.find(call => 
        call[0] === 'Attempting automatic connection to default Hyperfy URL:' && 
        call[1] === 'wss://chill.hyperfy.xyz/ws'
      );
      expect(connectionLogCall).toBeDefined();
      
      logger.info('✅ Service started with automatic connection');
    });

    it('should handle stop service call', async () => {
      await HyperfyService.stop(mockRuntime);
      
      expect(consoleSpy.info).toHaveBeenCalledWith('*** Stopping Hyperfy service ***');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Hyperfy service stop called - implement service registry if needed'
      );
      
      logger.info('✅ Service stop handled correctly');
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully to Hyperfy world', async () => {
      const config = {
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world-123',
        authToken: 'test-token',
      };

      await hyperfyService.connect(config);

      expect(hyperfyService.isConnected()).toBe(true);
      expect(hyperfyService.currentWorldId).toBe(config.worldId);
      expect(hyperfyService.getWorld()).toBeTruthy();
      
      // Should have logged connection success
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('HyperfyService connected successfully')
      );
      
      logger.info('✅ Connection established successfully');
    });

    it('should disconnect from existing connection before new connection', async () => {
      // First connection
      await hyperfyService.connect({
        wsUrl: 'wss://test1.hyperfy.io/ws',
        worldId: 'world-1',
      });

      expect(hyperfyService.isConnected()).toBe(true);

      // Second connection should disconnect first
      await hyperfyService.connect({
        wsUrl: 'wss://test2.hyperfy.io/ws',
        worldId: 'world-2',
      });

      expect(hyperfyService.currentWorldId).toBe('world-2');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('HyperfyService already connected')
      );
      
      logger.info('✅ Existing connection handled correctly');
    });

    it('should handle connection errors gracefully', async () => {
      // Create a new mock that will fail
      const { createNodeClientWorld } = await import('../src/hyperfy/core/createNodeClientWorld.js');
      const originalMock = createNodeClientWorld as ReturnType<typeof vi.fn>;
      
      // Temporarily replace the mock to return a world that fails init
      (originalMock as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        ...originalMock(),
        init: vi.fn().mockRejectedValue(new Error('Connection failed')),
      }));

      const config = {
        wsUrl: 'wss://invalid.hyperfy.io/ws',
        worldId: 'invalid-world',
      };

      await expect(hyperfyService.connect(config)).rejects.toThrow('Connection failed');
      
      expect(hyperfyService.isConnected()).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'HyperfyService connection failed for invalid-world at wss://invalid.hyperfy.io/ws: Connection failed',
        expect.any(String)
      );
      
      logger.info('✅ Connection errors handled gracefully');
    });

    it('should disconnect successfully', async () => {
      // First connect
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });

      expect(hyperfyService.isConnected()).toBe(true);

      // Then disconnect
      await hyperfyService.disconnect();

      expect(hyperfyService.isConnected()).toBe(false);
      expect(hyperfyService.currentWorldId).toBe(null);
      expect(hyperfyService.getWorld()).toBe(null);
      
      expect(consoleSpy.info).toHaveBeenCalledWith('HyperfyService disconnect complete.');
      
      logger.info('✅ Disconnection successful');
    });
  });

  describe('Manager Initialization', () => {
    beforeEach(async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
    });

    it('should initialize all managers after connection', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      
      expect(service.behaviorManager).toBeDefined();
      expect(service.emoteManager).toBeDefined();
      expect(service.messageManager).toBeDefined();
      expect(service.voiceManager).toBeDefined();
      
      logger.info('✅ All managers initialized');
    });

    it('should provide access to managers', () => {
      expect(hyperfyService.getBehaviorManager()).toBeDefined();
      expect(hyperfyService.getEmoteManager()).toBeDefined();
      expect(hyperfyService.getMessageManager()).toBeDefined();
      expect(hyperfyService.getVoiceManager()).toBeDefined();
      
      logger.info('✅ Manager access methods working');
    });

    it('should start behavior manager during appearance polling', async () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const behaviorManager = service.behaviorManager;
      
      // Trigger appearance polling
      service.startAppearancePolling();
      
      // Fast-forward timers to trigger polling
      vi.advanceTimersByTime(1000);
      
      expect(behaviorManager.start).toHaveBeenCalled();
      
      logger.info('✅ Behavior manager started during polling');
    });
  });

  describe('Entity Management', () => {
    beforeEach(async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
    });

    it('should get entity by ID', () => {
      const world = hyperfyService.getWorld();
      if (world) {
        world.entities.items.set('test-entity', {
          data: { id: 'test-entity', name: 'TestEntity' },
        });
      }

      const entity = hyperfyService.getEntityById('test-entity');
      expect(entity).toBeTruthy();
      expect(entity?.data?.id).toBe('test-entity');
      
      logger.info('✅ Entity retrieval by ID working');
    });

    it('should return null for non-existent entity', () => {
      const entity = hyperfyService.getEntityById('non-existent');
      expect(entity).toBe(null);
      
      logger.info('✅ Non-existent entity handled correctly');
    });

    it('should get entity name correctly', () => {
      const world = hyperfyService.getWorld();
      if (world) {
        world.entities.items.set('named-entity', {
          data: { id: 'named-entity', name: 'NamedEntity' },
        });
        world.entities.items.set('blueprint-entity', {
          data: { id: 'blueprint-entity' },
          blueprint: { name: 'BlueprintEntity' },
        });
      }

      expect(hyperfyService.getEntityName('named-entity')).toBe('NamedEntity');
      expect(hyperfyService.getEntityName('blueprint-entity')).toBe('BlueprintEntity');
      expect(hyperfyService.getEntityName('unnamed-entity')).toBe('Unnamed');
      
      logger.info('✅ Entity name retrieval working');
    });
  });

  describe('Name Management', () => {
    beforeEach(async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
    });

    it('should change agent name successfully', async () => {
      const newName = 'NewAgentName';
      
      await hyperfyService.changeName(newName);
      
      const world = hyperfyService.getWorld();
      expect(world?.entities.player?.data.name).toBe(newName);
      expect(world?.entities.player?.modify).toHaveBeenCalledWith({ name: newName });
      expect(world?.network.send).toHaveBeenCalledWith('entityModified', {
        id: 'test-player-id',
        name: newName,
      });
      
      logger.info('✅ Name change successful');
    });

    it('should handle name change when not connected', async () => {
      await hyperfyService.disconnect();
      
      await expect(hyperfyService.changeName('TestName')).rejects.toThrow(
        'HyperfyService: Cannot change name. Network or player not ready.'
      );
      
      logger.info('✅ Name change error when disconnected');
    });

    it('should handle name change errors', async () => {
      const world = hyperfyService.getWorld();
      if (world?.entities.player) {
        const mockModify = vi.fn().mockImplementation(() => {
          throw new Error('Modify failed');
        });
        world.entities.player.modify = mockModify;
      }

      await expect(hyperfyService.changeName('ErrorName')).rejects.toThrow('Modify failed');
      
      logger.info('✅ Name change errors handled');
    });
  });

  describe('Chat Subscription', () => {
    beforeEach(async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
    });

    it('should subscribe to chat messages', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      service.startChatSubscription();
      
      expect(world?.chat?.subscribe).toHaveBeenCalledWith(expect.any(Function));
      
      logger.info('✅ Chat subscription established');
    });

    it('should process new chat messages', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      if (!world?.chat) {
        throw new Error('World or chat not available for test');
      }
      
      // Set connection time
      service.connectionTime = Date.now() - 1000;
      
      service.startChatSubscription();
      
      // Get the callback function
      const subscribeCallback = world.chat.subscribe.mock.calls[0][0];
      
      // Create a new message
      const newMessage = {
        id: 'new-msg-123',
        createdAt: new Date().toISOString(),
        text: 'Hello world',
      };
      
      // Trigger the callback
      subscribeCallback([newMessage]);
      
      expect(service.messageManager.handleMessage).toHaveBeenCalledWith(newMessage);
      
      logger.info('✅ New chat messages processed');
    });

    it('should ignore historical messages', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      if (!world?.chat) {
        throw new Error('World or chat not available for test');
      }
      
      // Set connection time to now
      service.connectionTime = Date.now();
      
      service.startChatSubscription();
      
      // Get the callback function
      const subscribeCallback = world.chat.subscribe.mock.calls[0][0];
      
      // Create an old message
      const oldMessage = {
        id: 'old-msg-123',
        createdAt: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
        text: 'Old message',
      };
      
      // Trigger the callback
      subscribeCallback([oldMessage]);
      
      expect(service.messageManager.handleMessage).not.toHaveBeenCalled();
      
      logger.info('✅ Historical messages ignored');
    });
  });

  describe('Appearance Management', () => {
    beforeEach(async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
    });

    it('should upload character assets successfully', async () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      
      const result = await service.uploadCharacterAssets();
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      
      const world = service.world;
      expect(world?.entities?.player?.setSessionAvatar).toHaveBeenCalled();
      expect(world?.network?.send).toHaveBeenCalledWith('playerSessionAvatar', {
        avatar: expect.stringContaining('test-hash-123'),
      });
      
      logger.info('✅ Character assets uploaded successfully');
    });

    it('should handle upload errors gracefully', async () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      // Mock upload to fail
      if (world?.network) {
        world.network.upload.mockRejectedValue(new Error('Upload failed'));
      }
      
      const result = await service.uploadCharacterAssets();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
      
      logger.info('✅ Upload errors handled gracefully');
    });

    it('should start and stop appearance polling', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      
      service.startAppearancePolling();
      expect(service.appearanceIntervalId).toBeTruthy();
      
      service.stopAppearancePolling();
      expect(service.appearanceIntervalId).toBe(null);
      
      logger.info('✅ Appearance polling lifecycle working');
    });

    it('should handle appearance polling when already set', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      
      // Mark both as already set
      service.appearanceSet = true;
      service.nameSet = true;
      
      service.startAppearancePolling();
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[Appearance/Name Polling] Already set, skipping start.'
      );
      
      logger.info('✅ Appearance polling skipped when already set');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
    });

    it('should subscribe to hyperfy events', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      service.subscribeToHyperfyEvents();
      
      expect(world?.off).toHaveBeenCalledWith('disconnect');
      expect(world?.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      
      logger.info('✅ Hyperfy events subscription working');
    });

    it('should handle disconnect events', async () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      service.subscribeToHyperfyEvents();
      
      // Get the disconnect callback
      const onCalls = world?.on?.mock?.calls || [];
      const disconnectCall = onCalls.find(call => call[0] === 'disconnect');
      const disconnectCallback = disconnectCall?.[1];
      
      expect(disconnectCallback).toBeDefined();
      
      // Trigger disconnect
      if (disconnectCallback) {
        disconnectCallback('Test disconnect reason');
      }
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Hyperfy world disconnected: Test disconnect reason'
      );
      
      logger.info('✅ Disconnect events handled');
    });

    it('should handle events when world is not available', () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      service.world = null;
      
      service.subscribeToHyperfyEvents();
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Hyperfy Events] Cannot subscribe: World or world.on not available.'
      );
      
      logger.info('✅ Missing world handled in events');
    });
  });

  describe('Service Lifecycle', () => {
    it('should handle complete service stop', async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });

      expect(hyperfyService.isConnected()).toBe(true);

      await hyperfyService.stop();

      expect(hyperfyService.isConnected()).toBe(false);
      expect(consoleSpy.info).toHaveBeenCalledWith('*** Stopping Hyperfy service instance ***');
      
      logger.info('✅ Service lifecycle complete');
    });

    it('should handle disconnect cleanup properly', async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });

      const service = hyperfyService as unknown as HyperfyServicePrivate;
      
      await service.handleDisconnect();

      expect(service.isConnectedState).toBe(false);
      expect(service.world).toBe(null);
      expect(service.controls).toBe(null);
      expect(service.wsUrl).toBe(null);
      expect(service.appearanceSet).toBe(false);
      expect(service.processedMsgIds.size).toBe(0);
      expect(service.playerNamesMap.size).toBe(0);
      expect(service.connectionTime).toBe(null);
      
      logger.info('✅ Disconnect cleanup complete');
    });

    it('should handle disconnect when not connected', async () => {
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      
      // Ensure not connected
      expect(service.isConnectedState).toBe(false);
      expect(service.world).toBe(null);
      
      // Should not throw or cause issues
      await service.handleDisconnect();
      
      logger.info('✅ Disconnect when not connected handled');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle WebSocket polyfill injection', async () => {
      // Mock globalThis.WebSocket as undefined
      const originalWebSocket = globalThis.WebSocket;
      (globalThis as Record<string, unknown>).WebSocket = undefined;
      
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        'WebSocket polyfill injected for hyperfy core'
      );
      
      // Restore WebSocket
      (globalThis as Record<string, unknown>).WebSocket = originalWebSocket;
      
      logger.info('✅ WebSocket polyfill injection working');
    });

    it('should handle world initialization errors', async () => {
      // Create a new mock that will fail
      const { createNodeClientWorld } = await import('../src/hyperfy/core/createNodeClientWorld.js');
      const originalMock = createNodeClientWorld as ReturnType<typeof vi.fn>;
      
      // Temporarily replace the mock to return a world without init function
      (originalMock as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        ...originalMock(),
        init: undefined, // Remove init function
      }));
      
      await expect(hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      })).rejects.toThrow('world.init is not a function');
      
      logger.info('✅ World initialization errors handled');
    });

    it('should handle cleanup errors gracefully', async () => {
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });

      const service = hyperfyService as unknown as HyperfyServicePrivate;
      const world = service.world;
      
      // Mock network.disconnect to throw error
      if (world?.network) {
        world.network.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      }
      
      // Should not throw
      await service.handleDisconnect();
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error during world network disconnect/destroy')
      );
      
      logger.info('✅ Cleanup errors handled gracefully');
    });

    it('should handle missing chat system gracefully', async () => {
      // Create a new mock without chat system
      const { createNodeClientWorld } = await import('../src/hyperfy/core/createNodeClientWorld.js');
      const originalMock = createNodeClientWorld as ReturnType<typeof vi.fn>;
      
      // Temporarily replace the mock to return a world without chat
      (originalMock as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        ...originalMock(),
        chat: null, // Remove chat system
      }));
      
      await hyperfyService.connect({
        wsUrl: 'wss://test.hyperfy.io/ws',
        worldId: 'test-world',
      });
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Hyperfy Service] Chat system not available - skipping chat.add override'
      );
      
      const service = hyperfyService as unknown as HyperfyServicePrivate;
      service.startChatSubscription();
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Cannot subscribe to chat: World or Chat system not available.'
      );
      
      logger.info('✅ Missing chat system handled');
    });
  });
});
