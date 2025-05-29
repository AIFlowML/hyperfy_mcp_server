/**
 * Comprehensive test suite for Chat Tool
 * Tests chat message sending, channel types, whisper functionality, and session management
 * Validates the complete chat functionality for the FastMCP server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chatTool } from '../src/servers/actions/chatTool.js';
import type { McpSessionData } from '../src/servers/server.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 15000, // 15 seconds for chat tests
  MAX_HISTORY_ENTRIES: 20, // Maximum chat history entries
  MESSAGE_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID pattern
};

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Type for chat tool response data
interface ChatResponseData {
  message: string;
  messageId: string;
  channel: 'local' | 'world' | 'whisper';
  targetUserId?: string;
  timestamp: string;
  worldId: string;
  userId: string;
  actions: string[];
  source: string;
}

// Mock message manager for testing
function createMockMessageManager() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getRecentMessages: vi.fn().mockReturnValue([]),
    clearHistory: vi.fn(),
  };
}

// Mock HyperfyService for testing
function createMockHyperfyService() {
  const mockMessageManager = createMockMessageManager();
  
  return {
    isConnected: vi.fn().mockReturnValue(true),
    getMessageManager: vi.fn().mockReturnValue(mockMessageManager),
    getWorld: vi.fn().mockReturnValue({
      id: 'test-world-123',
      name: 'Test Chat World',
      entities: { items: new Map() }
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    messageManager: mockMessageManager,
  };
}

// Mock session data for testing
function createMockSessionData(): McpSessionData {
  return {
    worldId: 'test-world-123',
    userId: 'test-user-456',
    playerState: {
      id: 'test-player-789',
      name: 'TestChatAgent',
      position: { x: 5.0, y: 0, z: 10.0 },
      rotation: { x: 0, y: 90, z: 0 },
      health: 100,
      status: 'active',
      lastActivity: new Date(),
      metadata: {},
    },
    worldState: {
      id: 'test-world-123',
      name: 'Test Chat World',
      playerCount: 2,
      entities: [],
      lastUpdate: new Date(),
      metadata: {},
    },
    connectionTime: new Date(),
    lastActivity: new Date(),
    preferences: {},
    hyperfyService: createMockHyperfyService() as unknown as McpSessionData['hyperfyService'],
    controls: {} as unknown as McpSessionData['controls'],
    actions: {} as unknown as McpSessionData['actions'],
  };
}

// Mock tool context for testing
function createMockToolContext(sessionData: McpSessionData) {
  return {
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    session: { data: sessionData },
  };
}

// Extended session data with chat tracking
interface ExtendedChatSessionData extends McpSessionData {
  lastChatMessage?: number;
  chatHistory?: Array<{
    timestamp: number;
    message: string;
    channel: string;
    targetUserId?: string;
    success: boolean;
  }>;
}

describe('Chat Tool', () => {
  let mockSessionData: McpSessionData;
  let mockContext: ReturnType<typeof createMockToolContext>;
  let mockHyperfyService: ReturnType<typeof createMockHyperfyService>;
  let mockMessageManager: ReturnType<typeof createMockMessageManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Reset console spies
    for (const spy of Object.values(consoleSpy)) {
      spy.mockClear();
    }
    
    // Create fresh mock data
    mockSessionData = createMockSessionData();
    mockContext = createMockToolContext(mockSessionData);
    mockHyperfyService = mockSessionData.hyperfyService as unknown as ReturnType<typeof createMockHyperfyService>;
    mockMessageManager = mockHyperfyService.messageManager;
    
    logger.info('🎭 Starting Chat Tool test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    logger.info('🧹 Chat Tool test cleanup complete');
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool configuration', () => {
      expect(chatTool.name).toBe('hyperfy_chat');
      expect(chatTool.description).toBeDefined();
      expect(chatTool.description.length).toBeGreaterThan(100);
      expect(chatTool.parameters).toBeDefined();
      expect(chatTool.execute).toBeDefined();
      expect(typeof chatTool.execute).toBe('function');
      
      logger.info('✅ Tool configuration validated');
    });

    it('should have comprehensive parameter schema', () => {
      const schema = chatTool.parameters;
      
      // Test that schema accepts valid parameters
      const validParams = {
        message: 'Hello world!',
        channel: 'local' as const,
        targetUserId: 'user123',
        text: 'Alternative text'
      };
      
      const result = schema.safeParse(validParams);
      expect(result.success).toBe(true);
      
      logger.info('✅ Parameter schema validated');
    });

    it('should validate parameter constraints', () => {
      const schema = chatTool.parameters;
      
      // Test empty message
      const emptyMessage = schema.safeParse({ message: '' });
      expect(emptyMessage.success).toBe(false);
      
      // Test invalid channel
      const invalidChannel = schema.safeParse({ message: 'test', channel: 'invalid' });
      expect(invalidChannel.success).toBe(false);
      
      // Test valid channels
      const localChannel = schema.safeParse({ message: 'test', channel: 'local' });
      const worldChannel = schema.safeParse({ message: 'test', channel: 'world' });
      const whisperChannel = schema.safeParse({ message: 'test', channel: 'whisper' });
      
      expect(localChannel.success).toBe(true);
      expect(worldChannel.success).toBe(true);
      expect(whisperChannel.success).toBe(true);
      
      logger.info('✅ Parameter constraints validated');
    });

    it('should support multiple message field sources', () => {
      const schema = chatTool.parameters;
      
      // Test different message field names
      const messageField = schema.safeParse({ message: 'Test message' });
      const textFieldOnly = schema.safeParse({ text: 'Test text' }); // text alone without required message
      const bothFields = schema.safeParse({ message: 'Primary', text: 'Secondary' });
      const messageWithOptionals = schema.safeParse({ 
        message: 'Required message',
        text: 'Optional text',
        channel: 'local',
        targetUserId: 'user123'
      });
      
      expect(messageField.success).toBe(true);
      expect(textFieldOnly.success).toBe(false); // text alone is not valid, message is required
      expect(bothFields.success).toBe(true);
      expect(messageWithOptionals.success).toBe(true);
      
      logger.info('✅ Multiple message field sources validated');
    });
  });

  describe('Basic Message Sending', () => {
    it('should send a basic local chat message successfully', async () => {
      const args = {
        message: 'Hello everyone!',
        channel: 'local' as const
      };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe('Sent message to Hyperfy: "Hello everyone!"');
      expect(data.message).toBe('Hello everyone!');
      expect(data.channel).toBe('local');
      expect(data.messageId).toMatch(TEST_CONFIG.MESSAGE_ID_PATTERN);
      expect(data.worldId).toBe('test-world-123');
      expect(data.userId).toBe('test-user-456');
      expect(data.actions).toEqual(['HYPERFY_CHAT']);
      expect(data.source).toBe('hyperfy');
      
      // Verify service calls
      expect(mockHyperfyService.isConnected).toHaveBeenCalled();
      expect(mockHyperfyService.getMessageManager).toHaveBeenCalled();
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith('Hello everyone!');
      
      logger.info('✅ Basic local chat message validated');
    });

    it('should send a world chat message successfully', async () => {
      const args = {
        message: 'Greetings to the entire world!',
        channel: 'world' as const
      };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe('Sent message to Hyperfy: "Greetings to the entire world!"');
      expect(data.message).toBe('Greetings to the entire world!');
      expect(data.channel).toBe('world');
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith('Greetings to the entire world!');
      
      logger.info('✅ World chat message validated');
    });

    it('should handle default channel (local)', async () => {
      const args = {
        message: 'Default channel test'
        // No channel specified, should default to 'local'
      };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(data.channel).toBe('local');
      
      logger.info('✅ Default channel handling validated');
    });

    it('should include timestamp in ISO format', async () => {
      const args = { message: 'Timestamp test' };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
      
      logger.info('✅ Timestamp format validated');
    });
  });

  describe('Multiple Message Sources', () => {
    it('should prioritize text field over message field', async () => {
      const args = {
        message: 'Primary message',
        text: 'Secondary text'
      };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(data.message).toBe('Secondary text');
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith('Secondary text');
      
      logger.info('✅ Text field priority validated');
    });

    it('should use text field when message field is not provided', async () => {
      const args = {
        text: 'Text field message',
        channel: 'local' as const
      } as Parameters<typeof chatTool.execute>[0];

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(data.message).toBe('Text field message');
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith('Text field message');
      
      logger.info('✅ Text field usage validated');
    });

    it('should handle empty message gracefully', async () => {
      const args = {
        message: '',
        text: ''
      };

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('no_text_provided');
      expect(result.message).toBe('Action failed: No message text specified.');
      expect(mockMessageManager.sendMessage).not.toHaveBeenCalled();
      
      logger.info('✅ Empty message handling validated');
    });

    it('should handle fallback to ellipsis when no text provided', async () => {
      const args = {} as Parameters<typeof chatTool.execute>[0];

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('no_text_provided');
      expect(result.message).toBe('Action failed: No message text specified.');
      
      logger.info('✅ Fallback ellipsis handling validated');
    });
  });

  describe('Whisper Functionality', () => {
    it('should send whisper message successfully', async () => {
      const args = {
        message: 'Secret whisper message',
        channel: 'whisper' as const,
        targetUserId: 'user123'
      };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe('Whispered to user123: "Secret whisper message"');
      expect(data.message).toBe('Secret whisper message');
      expect(data.channel).toBe('whisper');
      expect(data.targetUserId).toBe('user123');
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith('Secret whisper message');
      
      logger.info('✅ Whisper message validated');
    });

    it('should require target user ID for whisper messages', async () => {
      const args = {
        message: 'Whisper without target',
        channel: 'whisper' as const
        // No targetUserId provided
      };

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_whisper_target');
      expect(result.message).toBe('Error: Target user ID is required for whisper messages.');
      expect(mockMessageManager.sendMessage).not.toHaveBeenCalled();
      
      logger.info('✅ Whisper target validation validated');
    });

    it('should use whisper response format when targetUserId is provided', async () => {
      const args = {
        message: 'Local message with target',
        channel: 'local' as const,
        targetUserId: 'user123'
      };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe('Whispered to user123: "Local message with target"');
      expect(data.channel).toBe('local');
      expect(data.targetUserId).toBe('user123');
      
      logger.info('✅ TargetUserId response format validated');
    });
  });

  describe('Service Integration and Validation', () => {
    it('should validate Hyperfy service availability', async () => {
      // Mock missing service
      const sessionWithoutService = {
        ...mockSessionData,
        hyperfyService: null as unknown as McpSessionData['hyperfyService']
      };
      const contextWithoutService = {
        log: mockContext.log,
        session: { data: sessionWithoutService }
      };

      const args = { message: 'Test message' };
      const result = await chatTool.execute(args, contextWithoutService);

      expect(result.success).toBe(false);
      expect(result.error).toBe('service_unavailable');
      expect(result.message).toBe('Error: Could not send message. Hyperfy connection unavailable.');
      
      logger.info('✅ Service availability validation validated');
    });

    it('should validate connection status', async () => {
      // Mock disconnected service
      mockHyperfyService.isConnected.mockReturnValue(false);

      const args = { message: 'Test message' };
      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_connected');
      expect(result.message).toBe('Error: Could not send message. Hyperfy not connected.');
      expect(mockHyperfyService.isConnected).toHaveBeenCalled();
      
      logger.info('✅ Connection status validation validated');
    });

    it('should validate message manager availability', async () => {
      // Mock missing message manager
      mockHyperfyService.getMessageManager.mockReturnValue(null);

      const args = { message: 'Test message' };
      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('message_manager_unavailable');
      expect(result.message).toBe('Error: Hyperfy message system unavailable.');
      expect(mockHyperfyService.getMessageManager).toHaveBeenCalled();
      
      logger.info('✅ Message manager validation validated');
    });

    it('should handle service connection properly', async () => {
      const args = { message: 'Connection test' };

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(mockHyperfyService.isConnected).toHaveBeenCalled();
      expect(mockHyperfyService.getMessageManager).toHaveBeenCalled();
      
      logger.info('✅ Service connection handling validated');
    });
  });

  describe('Session Management and History', () => {
    it('should track chat history in session', async () => {
      const extendedSession = mockSessionData as ExtendedChatSessionData;
      const args = { message: 'History test message' };

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(extendedSession.lastChatMessage).toBeDefined();
      expect(typeof extendedSession.lastChatMessage).toBe('number');
      expect(extendedSession.chatHistory).toBeDefined();
      if (extendedSession.chatHistory) {
        expect(extendedSession.chatHistory.length).toBe(1);
        expect(extendedSession.chatHistory[0].message).toBe('History test message');
        expect(extendedSession.chatHistory[0].success).toBe(true);
        expect(extendedSession.chatHistory[0].channel).toBe('local');
      }
      
      logger.info('✅ Chat history tracking validated');
    });

    it('should limit history to maximum entries', async () => {
      const extendedSession = mockSessionData as ExtendedChatSessionData;
      
      // Add 25 entries (more than max of 20)
      for (let i = 0; i < 25; i++) {
        const args = { message: `Chat message ${i}` };
        await chatTool.execute(args, mockContext);
      }

      expect(extendedSession.chatHistory).toBeDefined();
      if (extendedSession.chatHistory) {
        expect(extendedSession.chatHistory.length).toBe(TEST_CONFIG.MAX_HISTORY_ENTRIES);
        expect(extendedSession.chatHistory[0].message).toBe('Chat message 5'); // Should keep last 20
        expect(extendedSession.chatHistory[19].message).toBe('Chat message 24');
      }
      
      logger.info('✅ History limit enforcement validated');
    });

    it('should track whisper messages in history', async () => {
      const extendedSession = mockSessionData as ExtendedChatSessionData;
      const args = {
        message: 'Whisper history test',
        channel: 'whisper' as const,
        targetUserId: 'user456'
      };

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      if (extendedSession.chatHistory) {
        expect(extendedSession.chatHistory[0].channel).toBe('whisper');
        expect(extendedSession.chatHistory[0].targetUserId).toBe('user456');
      }
      
      logger.info('✅ Whisper history tracking validated');
    });

    it('should track failed messages in history', async () => {
      const extendedSession = mockSessionData as ExtendedChatSessionData;
      
      // Mock message manager to throw error
      mockMessageManager.sendMessage.mockRejectedValue(new Error('Send failed'));

      const args = { message: 'Failed message test' };
      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      if (extendedSession.chatHistory) {
        expect(extendedSession.chatHistory[0].message).toBe('Failed message test');
        expect(extendedSession.chatHistory[0].success).toBe(false);
      }
      
      logger.info('✅ Failed message history tracking validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle message sending errors gracefully', async () => {
      // Mock message manager to throw error
      mockMessageManager.sendMessage.mockRejectedValue(new Error('Network error'));

      const args = { message: 'Error test message' };
      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('send_failed');
      expect(result.message).toBe('Error sending message to Hyperfy: Network error');
      
      logger.info('✅ Message sending error handling validated');
    });

    it('should handle unknown errors gracefully', async () => {
      // Mock message manager to throw non-Error object
      mockMessageManager.sendMessage.mockRejectedValue('String error');

      const args = { message: 'Unknown error test' };
      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('send_failed');
      expect(result.message).toBe('Error sending message to Hyperfy: Unknown error occurred');
      
      logger.info('✅ Unknown error handling validated');
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000); // 1000 character message
      const args = { message: longMessage };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(data.message).toBe(longMessage);
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith(longMessage);
      
      logger.info('✅ Long message handling validated');
    });

    it('should handle special characters in messages', async () => {
      const specialMessage = 'Hello! 🎮 Special chars: @#$%^&*()_+-=[]{}|;:,.<>?';
      const args = { message: specialMessage };

      const result = await chatTool.execute(args, mockContext);
      const data = result.data as ChatResponseData;

      expect(result.success).toBe(true);
      expect(data.message).toBe(specialMessage);
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith(specialMessage);
      
      logger.info('✅ Special character handling validated');
    });

    it('should handle whitespace-only messages', async () => {
      const args = { message: '   \t\n   ' }; // Whitespace only

      const result = await chatTool.execute(args, mockContext);

      expect(result.success).toBe(true); // Whitespace is considered valid content
      expect(mockMessageManager.sendMessage).toHaveBeenCalledWith('   \t\n   ');
      
      logger.info('✅ Whitespace message handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const args = {
        message: 'Logging test',
        channel: 'world' as const,
        targetUserId: 'user789'
      };

      await chatTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_chat',
        expect.objectContaining({
          hasDirectMessage: true,
          hasAlternativeText: false,
          channel: 'world',
          targetUserId: 'user789'
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log successful message sending', async () => {
      const args = { message: 'Success logging test' };

      await chatTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Chat message sent successfully',
        expect.objectContaining({
          channel: 'local',
          messageLength: expect.any(Number),
          hasTarget: false,
          messageId: expect.stringMatching(TEST_CONFIG.MESSAGE_ID_PATTERN),
          responseMessage: expect.any(String)
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log errors appropriately', async () => {
      mockMessageManager.sendMessage.mockRejectedValue(new Error('Test error'));

      const args = { message: 'Error logging test' };
      await chatTool.execute(args, mockContext);

      expect(mockContext.log.error).toHaveBeenCalledWith(
        'Error sending Hyperfy chat message via service:',
        expect.objectContaining({
          error: 'Test error',
          args: expect.any(Object)
        })
      );
      
      logger.info('✅ Error logging validated');
    });

    it('should log validation failures', async () => {
      mockHyperfyService.isConnected.mockReturnValue(false);

      const args = { message: 'Validation test' };
      await chatTool.execute(args, mockContext);

      expect(mockContext.log.error).toHaveBeenCalledWith('Hyperfy service not connected');
      
      logger.info('✅ Validation failure logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should handle rapid message sending', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => `Rapid message ${i}`);
      const results: Awaited<ReturnType<typeof chatTool.execute>>[] = [];

      for (const message of messages) {
        const result = await chatTool.execute({ message }, mockContext);
        results.push(result);
      }

      // All messages should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(mockMessageManager.sendMessage).toHaveBeenCalledTimes(10);
      
      logger.info('✅ Rapid message sending validated');
    });

    it('should generate unique message IDs', async () => {
      const messageIds = new Set();
      
      for (let i = 0; i < 5; i++) {
        const result = await chatTool.execute({ message: `Unique ID test ${i}` }, mockContext);
        const data = result.data as ChatResponseData;
        messageIds.add(data.messageId);
      }

      expect(messageIds.size).toBe(5); // All IDs should be unique
      
      logger.info('✅ Unique message ID generation validated');
    });

    it('should maintain session state across multiple calls', async () => {
      const extendedSession = mockSessionData as ExtendedChatSessionData;
      
      // Send multiple messages
      await chatTool.execute({ message: 'First message' }, mockContext);
      await chatTool.execute({ message: 'Second message' }, mockContext);
      await chatTool.execute({ message: 'Third message' }, mockContext);

      expect(extendedSession.chatHistory).toBeDefined();
      if (extendedSession.chatHistory) {
        expect(extendedSession.chatHistory.length).toBe(3);
        expect(extendedSession.chatHistory[0].message).toBe('First message');
        expect(extendedSession.chatHistory[2].message).toBe('Third message');
      }
      
      logger.info('✅ Session state persistence validated');
    });

    it('should handle concurrent message sending', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        chatTool.execute({ message: `Concurrent message ${i}` }, mockContext)
      );

      const results = await Promise.all(promises);

      // All messages should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(mockMessageManager.sendMessage).toHaveBeenCalledTimes(5);
      
      logger.info('✅ Concurrent message sending validated');
    });
  });
});
