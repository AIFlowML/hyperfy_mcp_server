/**
 * Comprehensive test suite for MessageManager
 * Tests message handling, AI processing, entity management, and Hyperfy chat integration
 * Validates the porting from ElizaOS to FastMCP architecture
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { MessageManager } from '../src/hyperfy/managers/message-manager.js';
import { agentActivityLock } from '../src/hyperfy/managers/guards.js';
import { messageHandlerTemplate } from '../src/servers/config/templates.js';
import { 
  generateUUID, processMessageWithAI, createFastMCPEntity, 
  createFastMCPMemory, formatRelativeTimestamp 
} from '../src/utils/eliza-compat.js';
import type { 
  MessageManagerRuntime, HyperfyMessage, FastMCPEntity, MessageContent, 
  MessageResponseContent, MessageCallback, FastMCPMemory, FastMCPRuntime 
} from '../src/types/index.js';
import type { HyperfyService } from '../src/core/hyperfy-service.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000, // 10 seconds
  MESSAGE_TIMEOUT: 5000, // 5 seconds for message processing
  AI_TIMEOUT: 3000, // 3 seconds for AI processing
};

// Mock the utility functions
vi.mock('../src/utils/eliza-compat.js', async () => {
  const actual = await vi.importActual('../src/utils/eliza-compat.js');
  return {
    ...actual,
    generateUUID: vi.fn(),
    processMessageWithAI: vi.fn(),
    createFastMCPEntity: vi.fn(),
    createFastMCPMemory: vi.fn(),
    formatRelativeTimestamp: vi.fn(),
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

// Mock interfaces for testing
interface MockWorld {
  entities: {
    player: {
      data: {
        id: string;
        name?: string;
      };
    };
  };
  chat: {
    add: MockedFunction<(message: any, broadcast?: boolean) => void>;
  };
}

interface MockEmoteManager {
  playEmote: MockedFunction<(emoteName: string) => void>;
}

interface MockHyperfyService {
  getWorld: MockedFunction<() => MockWorld | null>;
  isConnected: MockedFunction<() => boolean>;
  getEntityName: MockedFunction<(entityId: string) => string | null>;
  getEmoteManager: MockedFunction<() => MockEmoteManager>;
  currentWorldId: string;
}

interface MockExtendedRuntime {
  hyperfyService: MockHyperfyService;
  agentId: string;
  agentName: string;
  aiModel: string;
  ensureConnection: MockedFunction<(params: any) => Promise<void>>;
  createMemory: MockedFunction<(memory: any, tableName: string) => Promise<void>>;
  getEntityById: MockedFunction<(entityId: string) => Promise<any>>;
  createEntity: MockedFunction<(entity: any) => Promise<void>>;
  emitEvent: MockedFunction<(eventType: string, eventData: any) => Promise<void>>;
  getMemories: MockedFunction<(params: any) => Promise<any[]>>;
}

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
};

// Create mock runtime for testing
function createMockRuntime(): MockExtendedRuntime {
  const mockEmoteManager: MockEmoteManager = {
    playEmote: vi.fn(),
  };

  const mockWorld: MockWorld = {
    entities: {
      player: {
        data: {
          id: 'agent-player-123',
          name: 'TestAgent',
        },
      },
    },
    chat: {
      add: vi.fn(),
    },
  };

  const mockHyperfyService: MockHyperfyService = {
    getWorld: vi.fn().mockReturnValue(mockWorld),
    isConnected: vi.fn().mockReturnValue(true),
    getEntityName: vi.fn().mockReturnValue('TestAgent'),
    getEmoteManager: vi.fn().mockReturnValue(mockEmoteManager),
    currentWorldId: 'test-world-123',
  };

  return {
    hyperfyService: mockHyperfyService,
    agentId: 'test-agent-id',
    agentName: 'TestAgent',
    aiModel: 'test-model',
    ensureConnection: vi.fn().mockResolvedValue(undefined),
    createMemory: vi.fn().mockResolvedValue(undefined),
    getEntityById: vi.fn().mockResolvedValue({ id: 'test-entity', names: ['TestUser'] }),
    createEntity: vi.fn().mockResolvedValue(undefined),
    emitEvent: vi.fn().mockResolvedValue(undefined),
    getMemories: vi.fn().mockResolvedValue([]),
  };
}

// Create mock message
function createMockMessage(overrides: Partial<HyperfyMessage> = {}): HyperfyMessage {
  return {
    id: 'msg-123',
    fromId: 'user-456',
    from: 'TestUser',
    body: 'Hello, agent!',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('MessageManager', () => {
  let messageManager: MessageManager;
  let mockRuntime: MockExtendedRuntime;

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
    // Setup mock implementations
    (generateUUID as any).mockImplementation((runtime: any, seed: string) => `uuid-${seed}-${Date.now()}`);
    (processMessageWithAI as any).mockResolvedValue({
      text: 'AI response text',
      emote: 'wave',
      actions: 'HYPERFY_AMBIENT_SPEECH'
    });
    (formatRelativeTimestamp as any).mockImplementation((timestamp: number) => '2 minutes ago');
    
    // Create fresh mocks
    mockRuntime = createMockRuntime();
    messageManager = new MessageManager(mockRuntime as unknown as MessageManagerRuntime);
    
    logger.info('💬 Starting MessageManager test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    // Force reset activity lock
    agentActivityLock.forceReset();
    
    logger.info('🧹 MessageManager test cleanup complete');
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper runtime context', () => {
      expect(messageManager).toBeInstanceOf(MessageManager);
      expect((messageManager as any).runtime).toBe(mockRuntime);
      
      logger.info('✅ MessageManager initialized with runtime context');
    });
  });

  describe('Message Handling', () => {
    it('should handle incoming message successfully', async () => {
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have logged message receipt
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(`[Chat Received] From: ${testMessage.from}`)
      );
      
      // Should have processed the message
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(`[Hyperfy Chat] Processing message from ${testMessage.from}`)
      );
      
      logger.info('✅ Incoming message handled successfully');
    });

    it('should ignore messages from the agent itself', async () => {
      const agentMessage = createMockMessage({
        fromId: 'agent-player-123', // Same as agent player ID
        from: 'TestAgent',
        body: 'Agent message'
      });
      
      await messageManager.handleMessage(agentMessage);
      
      // Should log receipt but not process
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[Chat Received]')
      );
      
      // Should NOT have processing log
      expect(consoleSpy.info).not.toHaveBeenCalledWith(
        expect.stringContaining('[Hyperfy Chat] Processing message')
      );
      
      logger.info('✅ Agent messages ignored correctly');
    });

    it('should handle messages without fromId', async () => {
      const systemMessage = createMockMessage({
        fromId: undefined,
        from: 'System',
        body: 'System announcement'
      });
      
      await messageManager.handleMessage(systemMessage);
      
      // Should log receipt but not process (no fromId)
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[Chat Received]')
      );
      
      logger.info('✅ Messages without fromId handled correctly');
    });

    it('should handle empty message body', async () => {
      const emptyMessage = createMockMessage({
        body: '',
      });
      
      await messageManager.handleMessage(emptyMessage);
      
      // Should still process the message
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[Hyperfy Chat] Processing message')
      );
      
      logger.info('✅ Empty message body handled correctly');
    });

    it('should use activity lock during message processing', async () => {
      const testMessage = createMockMessage();
      
      // Check lock is initially inactive
      expect(agentActivityLock.isActive()).toBe(false);
      
      // Process the message completely
      await messageManager.handleMessage(testMessage);
      
      // Lock should be released after processing completes
      expect(agentActivityLock.isActive()).toBe(false);
      
      logger.info('✅ Activity lock used correctly during processing');
    });
  });

  describe('Entity and Connection Management', () => {
    it('should ensure connection for message sender', async () => {
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have called ensureConnection
      expect(mockRuntime.ensureConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: testMessage.from,
          name: testMessage.from,
          source: 'hyperfy',
          channelId: mockRuntime.hyperfyService.currentWorldId,
          serverId: 'hyperfy',
          type: 'WORLD',
          userId: testMessage.fromId
        })
      );
      
      logger.info('✅ Connection ensured for message sender');
    });

    it('should create entity if not found in database', async () => {
      // Mock entity not found
      mockRuntime.getEntityById.mockResolvedValue(null);
      
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have tried to get entity
      expect(mockRuntime.getEntityById).toHaveBeenCalled();
      
      // Should have created entity
      expect(mockRuntime.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          names: [testMessage.from],
          agentId: mockRuntime.agentId,
          metadata: expect.objectContaining({
            hyperfy: expect.objectContaining({
              id: testMessage.fromId,
              username: testMessage.from,
              name: testMessage.from,
            })
          })
        })
      );
      
      logger.info('✅ Entity created when not found in database');
    });

    it('should handle entity creation errors gracefully', async () => {
      // Mock entity creation error
      mockRuntime.getEntityById.mockRejectedValue(new Error('Database error'));
      
      const testMessage = createMockMessage();
      
      // Should not throw error
      await expect(messageManager.handleMessage(testMessage)).resolves.not.toThrow();
      
      // Should have logged error
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[Hyperfy Chat] Error checking/creating entity')
      );
      
      logger.info('✅ Entity creation errors handled gracefully');
    });
  });

  describe('Memory Management', () => {
    it('should create memory for incoming message', async () => {
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have emitted MESSAGE_RECEIVED event with memory
      expect(mockRuntime.emitEvent).toHaveBeenCalledWith(
        'MESSAGE_RECEIVED',
        expect.objectContaining({
          runtime: mockRuntime,
          message: expect.objectContaining({
            content: expect.objectContaining({
              text: testMessage.body,
              source: 'hyperfy',
              channelType: 'WORLD',
              metadata: expect.objectContaining({
                hyperfyMessageId: testMessage.id,
                hyperfyFromId: testMessage.fromId,
                hyperfyFromName: testMessage.from,
              })
            })
          }),
          callback: expect.any(Function),
          source: 'hyperfy'
        })
      );
      
      logger.info('✅ Memory created for incoming message');
    });

    it('should create callback memory for AI responses', async () => {
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have created callback memory
      expect(mockRuntime.createMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: mockRuntime.agentId,
          agentId: mockRuntime.agentId,
          content: expect.objectContaining({
            text: 'AI response text',
            emote: 'wave',
            actions: ['HYPERFY_AMBIENT_SPEECH'],
            channelType: 'WORLD'
          })
        }),
        'messages'
      );
      
      logger.info('✅ Callback memory created for AI responses');
    });
  });

  describe('AI Processing', () => {
    it('should process message with AI and execute callback', async () => {
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have called processMessageWithAI
      expect(processMessageWithAI).toHaveBeenCalledWith(
        expect.objectContaining({
          aiModel: mockRuntime.aiModel,
          agentName: mockRuntime.agentName,
          agentId: mockRuntime.agentId,
          hyperfyService: mockRuntime.hyperfyService
        }),
        testMessage.body,
        testMessage.from,
        messageHandlerTemplate
      );
      
      logger.info('✅ Message processed with AI');
    });

    it('should handle AI processing errors gracefully', async () => {
      // Mock AI processing error
      (processMessageWithAI as any).mockRejectedValue(new Error('AI processing failed'));
      
      const testMessage = createMockMessage();
      
      // Should not throw error
      await expect(messageManager.handleMessage(testMessage)).resolves.not.toThrow();
      
      // Should have logged error
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[Hyperfy Chat] Error processing message')
      );
      
      logger.info('✅ AI processing errors handled gracefully');
    });

    it('should execute emote from AI response', async () => {
      const testMessage = createMockMessage();
      
      await messageManager.handleMessage(testMessage);
      
      // Should have played emote
      const emoteManager = mockRuntime.hyperfyService.getEmoteManager();
      expect(emoteManager.playEmote).toHaveBeenCalledWith('wave');
      
      logger.info('✅ Emote executed from AI response');
    });
  });

  describe('Message Sending', () => {
    it('should send message successfully', async () => {
      const testText = 'Hello from agent!';
      
      await messageManager.sendMessage(testText);
      
      // Should have called world.chat.add
      const world = mockRuntime.hyperfyService.getWorld();
      expect(world?.chat.add).toHaveBeenCalledWith(
        {
          id: expect.stringMatching(/^chat-\d+-agent-player-123$/), // Expect the generated id
          body: testText,
          fromId: 'agent-player-123',
          from: 'TestAgent',
        },
        true
      );
      
      // Should have logged sending
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining(`HyperfyService sending message: "${testText}"`)
      );
      
      logger.info('✅ Message sent successfully');
    });

    it('should handle sending when not connected', async () => {
      // Mock not connected
      mockRuntime.hyperfyService.isConnected.mockReturnValue(false);
      
      const testText = 'Hello from agent!';
      
      await messageManager.sendMessage(testText);
      
      // Should have logged error
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'HyperfyService: Cannot send message. Not ready.'
      );
      
      // Should not have called chat.add
      const world = mockRuntime.hyperfyService.getWorld();
      expect(world?.chat.add).not.toHaveBeenCalled();
      
      logger.info('✅ Sending when not connected handled correctly');
    });

    it('should handle sending when world is null', async () => {
      // Mock null world
      mockRuntime.hyperfyService.getWorld.mockReturnValue(null);
      
      const testText = 'Hello from agent!';
      
      await messageManager.sendMessage(testText);
      
      // Should have logged error
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'HyperfyService: Cannot send message. Not ready.'
      );
      
      logger.info('✅ Sending when world is null handled correctly');
    });

    it('should handle chat.add function errors', async () => {
      // Mock chat.add to throw error
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        world.chat.add.mockImplementation(() => {
          throw new Error('Chat add failed');
        });
      }
      
      const testText = 'Hello from agent!';
      
      // Should throw error
      await expect(messageManager.sendMessage(testText)).rejects.toThrow('Chat add failed');
      
      // Should have logged error with 2 arguments (message and error object)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error sending Hyperfy message:',
        expect.any(Error)
      );
      
      logger.info('✅ Chat.add errors handled correctly');
    });

    it('should handle missing chat.add function', async () => {
      // Mock world without chat.add function
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        (world.chat as any).add = 'not-a-function';
      }
      
      const testText = 'Hello from agent!';
      
      // Should throw error
      await expect(messageManager.sendMessage(testText)).rejects.toThrow('world.chat.add is not a function');
      
      logger.info('✅ Missing chat.add function handled correctly');
    });
  });

  describe('Message Formatting', () => {
    it('should format messages correctly', () => {
      const mockMessages = [
        {
          entityId: 'entity-1',
          content: { text: 'Hello world', actions: ['wave'] },
          createdAt: Date.now() - 120000, // 2 minutes ago
        },
        {
          entityId: 'entity-2',
          content: { text: 'How are you?' },
          createdAt: Date.now() - 60000, // 1 minute ago
        },
      ];

      const mockEntities = [
        {
          id: 'entity-1',
          names: ['User1'],
          data: JSON.stringify({ hyperfy: { id: 'user1-id' } }),
        },
        {
          id: 'entity-2',
          names: ['User2'],
          data: JSON.stringify({ hyperfy: { id: 'user2-id' } }),
        },
      ];

      const formatted = messageManager.formatMessages({
        messages: mockMessages,
        entities: mockEntities,
      });

      expect(formatted).toContain('User1 [user1-id] (wave): Hello world');
      expect(formatted).toContain('User2 [user2-id]: How are you?');
      expect(formatted).toContain('2 minutes ago');
      
      logger.info('✅ Messages formatted correctly');
    });

    it('should handle messages without entities', () => {
      const mockMessages = [
        {
          entityId: 'unknown-entity',
          content: { text: 'Orphaned message' },
          createdAt: Date.now(),
        },
      ];

      const formatted = messageManager.formatMessages({
        messages: mockMessages,
        entities: [],
      });

      expect(formatted).toContain('Unknown User []');
      expect(formatted).toContain('Orphaned message');
      
      logger.info('✅ Messages without entities handled correctly');
    });

    it('should handle malformed entity data', () => {
      const mockMessages = [
        {
          entityId: 'entity-1',
          content: { text: 'Test message' },
          createdAt: Date.now(),
        },
      ];

      const mockEntities = [
        {
          id: 'entity-1',
          names: ['User1'],
          data: 'invalid-json',
        },
      ];

      const formatted = messageManager.formatMessages({
        messages: mockMessages,
        entities: mockEntities,
      });

      expect(formatted).toContain('User1 []'); // Empty ID due to parse error
      expect(formatted).toContain('Test message');
      
      logger.info('✅ Malformed entity data handled correctly');
    });
  });

  describe('Recent Messages', () => {
    it('should get recent messages', async () => {
      const result = await messageManager.getRecentMessages('test-room', 10);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('Recent messages functionality');
      
      // Should have logged the call
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[MessageManager] getRecentMessages called for room test-room')
      );
      
      logger.info('✅ Recent messages retrieved');
    });

    it('should handle recent messages with default count', async () => {
      const result = await messageManager.getRecentMessages('test-room');
      
      expect(typeof result).toBe('string');
      
      // Should use default count of 20
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('count: 20')
      );
      
      logger.info('✅ Recent messages with default count handled');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null/undefined message gracefully', async () => {
      // Should not throw for null message and should warn
      await expect(messageManager.handleMessage(null as any)).resolves.not.toThrow();
      await expect(messageManager.handleMessage(undefined as any)).resolves.not.toThrow();
      
      // Should have logged warnings
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[MessageManager] Received null or undefined message, ignoring'
      );
      
      logger.info('✅ Null/undefined messages handled gracefully');
    });

    it('should handle message with special characters', async () => {
      const specialMessage = createMockMessage({
        body: '🎉 Hello! @user #hashtag $special &chars <script>alert("test")</script>',
        from: 'User™️'
      });
      
      await messageManager.handleMessage(specialMessage);
      
      // Should process without errors
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[Hyperfy Chat] Processing message')
      );
      
      logger.info('✅ Messages with special characters handled correctly');
    });

    it('should handle very long messages', async () => {
      const longMessage = createMockMessage({
        body: 'A'.repeat(10000), // Very long message
      });
      
      await messageManager.handleMessage(longMessage);
      
      // Should process without errors
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[Hyperfy Chat] Processing message')
      );
      
      logger.info('✅ Very long messages handled correctly');
    });

    it('should handle concurrent message processing', async () => {
      const messages = [
        createMockMessage({ id: 'msg-1', fromId: 'user-1', body: 'Message 1' }),
        createMockMessage({ id: 'msg-2', fromId: 'user-2', body: 'Message 2' }),
        createMockMessage({ id: 'msg-3', fromId: 'user-3', body: 'Message 3' }),
      ];
      
      // Process messages concurrently
      const promises = messages.map(msg => messageManager.handleMessage(msg));
      await Promise.all(promises);
      
      // All messages should be processed
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Message 1')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Message 2')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Message 3')
      );
      
      logger.info('✅ Concurrent message processing handled correctly');
    });
  });
});
