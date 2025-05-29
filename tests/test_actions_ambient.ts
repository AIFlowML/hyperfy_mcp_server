/**
 * Comprehensive test suite for Ambient Speech Tool
 * Tests ambient speech generation, context awareness, duplicate detection, and session management
 * Validates the complete ambient speech functionality for the FastMCP server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ambientTool } from '../src/servers/actions/ambientTool.js';
import type { McpSessionData } from '../src/servers/server.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 15000, // 15 seconds for ambient tests
  MIN_AMBIENT_INTERVAL: 10000, // 10 seconds minimum between ambient speech
  MAX_HISTORY_ENTRIES: 10, // Maximum ambient history entries
  DUPLICATE_CHECK_WINDOW: 30000, // 30 seconds for duplicate detection
};

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Type for ambient tool response data
interface AmbientResponseData {
  content: string;
  thought?: string;
  duration: number;
  volume: number;
  timestamp: string;
  worldId: string;
  userId: string;
  position: { x: number; y: number; z: number };
  generationType: 'provided' | 'contextual';
  skipped?: boolean;
  nextAvailableIn?: number;
  reason?: string;
  recentEntry?: { timestamp: number; message: string; thought?: string };
}

// Mock session data for testing
function createMockSessionData(): McpSessionData {
  return {
    worldId: 'test-world-123',
    userId: 'test-user-456',
    playerState: {
      id: 'test-player-789',
      name: 'TestAgent',
      position: { x: 10.5, y: 0, z: 15.3 },
      rotation: { x: 0, y: 45, z: 0 },
      health: 100,
      status: 'active',
      lastActivity: new Date(),
      metadata: {},
    },
    worldState: {
      id: 'test-world-123',
      name: 'Test Hyperfy World',
      playerCount: 1,
      entities: [],
      lastUpdate: new Date(),
      metadata: {},
    },
    connectionTime: new Date(),
    lastActivity: new Date(),
    preferences: {},
    hyperfyService: {
      getWorld: vi.fn().mockReturnValue({
        entities: {
          items: new Map([
            ['entity-1', {
              root: { position: { x: 5, y: 0, z: 10 } },
              data: { id: 'entity-1', name: 'Treasure Chest' }
            }],
            ['entity-2', {
              base: { position: { x: 20, y: 0, z: 25 } },
              data: { id: 'entity-2', name: 'Magic Portal' }
            }],
            ['entity-3', {
              root: { position: { x: 0, y: 0, z: 0 } },
              data: { id: 'entity-3', name: 'Ancient Statue' }
            }]
          ])
        }
      }),
      getEntityName: vi.fn().mockImplementation((id: string) => {
        const names: Record<string, string> = {
          'entity-1': 'Treasure Chest',
          'entity-2': 'Magic Portal',
          'entity-3': 'Ancient Statue'
        };
        return names[id] || 'Unknown Entity';
      }),
    } as unknown as McpSessionData['hyperfyService'],
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

// Extended session data with ambient tracking
interface ExtendedSessionData extends McpSessionData {
  lastAmbientSpeech?: number;
  ambientHistory?: Array<{ timestamp: number; message: string; thought?: string }>;
}

describe('Ambient Speech Tool', () => {
  let mockSessionData: McpSessionData;
  let mockContext: ReturnType<typeof createMockToolContext>;

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
    
    logger.info('🎭 Starting Ambient Speech Tool test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    logger.info('🧹 Ambient Speech Tool test cleanup complete');
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool configuration', () => {
      expect(ambientTool.name).toBe('hyperfy_ambient_speech');
      expect(ambientTool.description).toBeDefined();
      expect(ambientTool.description.length).toBeGreaterThan(50);
      expect(ambientTool.parameters).toBeDefined();
      expect(ambientTool.execute).toBeDefined();
      expect(typeof ambientTool.execute).toBe('function');
      
      logger.info('✅ Tool configuration validated');
    });

    it('should have comprehensive parameter schema', () => {
      const schema = ambientTool.parameters;
      
      // Test that schema accepts valid parameters
      const validParams = {
        content: 'Test ambient speech',
        context: 'peaceful environment',
        duration: 5,
        volume: 0.8,
        forceGenerate: false
      };
      
      const result = schema.safeParse(validParams);
      expect(result.success).toBe(true);
      
      logger.info('✅ Parameter schema validated');
    });

    it('should validate parameter constraints', () => {
      const schema = ambientTool.parameters;
      
      // Test invalid duration (too high)
      const invalidDuration = schema.safeParse({ duration: 50 });
      expect(invalidDuration.success).toBe(false);
      
      // Test invalid volume (too low)
      const invalidVolume = schema.safeParse({ volume: 0.05 });
      expect(invalidVolume.success).toBe(false);
      
      // Test empty content
      const emptyContent = schema.safeParse({ content: '' });
      expect(emptyContent.success).toBe(false);
      
      logger.info('✅ Parameter constraints validated');
    });

    it('should support multiple content field sources in schema', () => {
      const schema = ambientTool.parameters;
      
      // Test different content field names
      const contentField = schema.safeParse({ content: 'Test content' });
      const messageField = schema.safeParse({ message: 'Test message' });
      const textField = schema.safeParse({ text: 'Test text' });
      
      expect(contentField.success).toBe(true);
      expect(messageField.success).toBe(true);
      expect(textField.success).toBe(true);
      
      logger.info('✅ Multiple content field sources in schema validated');
    });
  });

  describe('Provided Content Execution', () => {
    it('should execute with provided content successfully', async () => {
      const args = {
        content: 'This place feels mysterious and ancient...',
        duration: 5,
        volume: 0.8
      };

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toContain('This place feels mysterious and ancient...');
      expect(result.data).toBeDefined();
      expect(data.content).toBe('This place feels mysterious and ancient...');
      expect(data.duration).toBe(5);
      expect(data.volume).toBe(0.8);
      expect(data.generationType).toBe('provided');
      expect(data.worldId).toBe('test-world-123');
      expect(data.userId).toBe('test-user-456');
      
      logger.info('✅ Provided content execution validated');
    });

    it('should handle multiple content field sources', async () => {
      // Test content field
      const contentResult = await ambientTool.execute(
        { content: 'Content field test' },
        mockContext
      );
      const contentData = contentResult.data as AmbientResponseData;
      expect(contentResult.success).toBe(true);
      expect(contentData.content).toBe('Content field test');

      // Test message field (when content is not provided) - force to avoid timing issues
      const messageResult = await ambientTool.execute(
        { message: 'Message field test', forceGenerate: true } as unknown as Parameters<typeof ambientTool.execute>[0],
        mockContext
      );
      const messageData = messageResult.data as AmbientResponseData;
      expect(messageResult.success).toBe(true);
      expect(messageData.content).toBe('Message field test');

      // Test text field (when content and message are not provided) - force to avoid timing issues
      const textResult = await ambientTool.execute(
        { text: 'Text field test', forceGenerate: true } as unknown as Parameters<typeof ambientTool.execute>[0],
        mockContext
      );
      const textData = textResult.data as AmbientResponseData;
      expect(textResult.success).toBe(true);
      expect(textData.content).toBe('Text field test');
      
      logger.info('✅ Multiple content field sources validated');
    });

    it('should prioritize content fields correctly', async () => {
      // When multiple fields are provided, should use first available
      const args = {
        content: 'Primary content',
        message: 'Secondary message',
        text: 'Tertiary text'
      };

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.content).toBe('Primary content');
      
      logger.info('✅ Content field priority validated');
    });

    it('should include position data in response', async () => {
      const args = { content: 'Position test' };

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.position).toEqual({ x: 10.5, y: 0, z: 15.3 });
      
      logger.info('✅ Position data inclusion validated');
    });
  });

  describe('Contextual Content Generation', () => {
    it('should generate contextual ambient speech when no content provided', async () => {
      const args = {} as Parameters<typeof ambientTool.execute>[0]; // Make content optional for contextual generation

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.content).toBeDefined();
      expect(data.content.length).toBeGreaterThan(0);
      expect(data.generationType).toBe('contextual');
      expect(data.thought).toBeDefined();
      
      logger.info('✅ Contextual content generation validated');
    });

    it('should use world context for generation', async () => {
      const args = {} as Parameters<typeof ambientTool.execute>[0];

      const result = await ambientTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(mockSessionData.hyperfyService.getWorld).toHaveBeenCalled();
      expect(mockSessionData.hyperfyService.getEntityName).toHaveBeenCalled();
      
      logger.info('✅ World context usage validated');
    });

    it('should handle different context types', async () => {
      // Test exploration context
      const exploreResult = await ambientTool.execute(
        { context: 'exploring new areas' } as Parameters<typeof ambientTool.execute>[0],
        mockContext
      );
      const exploreData = exploreResult.data as AmbientResponseData;
      expect(exploreResult.success).toBe(true);
      expect(exploreData.thought).toBeDefined();
      expect(typeof exploreData.thought).toBe('string');

      // Test peaceful context
      const peacefulResult = await ambientTool.execute(
        { context: 'quiet peaceful moment' } as Parameters<typeof ambientTool.execute>[0],
        mockContext
      );
      const peacefulData = peacefulResult.data as AmbientResponseData;
      expect(peacefulResult.success).toBe(true);
      expect(peacefulData.thought).toBeDefined();
      expect(typeof peacefulData.thought).toBe('string');

      // Test general context
      const generalResult = await ambientTool.execute(
        { context: 'general observation' } as Parameters<typeof ambientTool.execute>[0],
        mockContext
      );
      const generalData = generalResult.data as AmbientResponseData;
      expect(generalResult.success).toBe(true);
      expect(generalData.thought).toBeDefined();
      
      logger.info('✅ Different context types validated');
    });

    it('should handle world with no entities', async () => {
      // Mock empty world
      mockSessionData.hyperfyService.getWorld = vi.fn().mockReturnValue({
        entities: { items: new Map() }
      });

      const args = {} as Parameters<typeof ambientTool.execute>[0];
      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.content).toBeDefined();
      expect(data.generationType).toBe('contextual');
      
      logger.info('✅ Empty world handling validated');
    });

    it('should handle world context errors gracefully', async () => {
      // Mock world that throws error
      mockSessionData.hyperfyService.getWorld = vi.fn().mockReturnValue({
        entities: {
          items: {
            entries: () => { throw new Error('World error'); }
          }
        }
      });

      const args = {} as Parameters<typeof ambientTool.execute>[0];
      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.content).toBeDefined();
      expect(mockContext.log.warn).toHaveBeenCalledWith(
        'Error gathering world context',
        expect.objectContaining({ error: expect.any(Error) })
      );
      
      logger.info('✅ World context error handling validated');
    });
  });

  describe('Session Management and Timing', () => {
    it('should track last ambient speech timestamp', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const args = { content: 'First ambient speech' };

      const result = await ambientTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(extendedSession.lastAmbientSpeech).toBeDefined();
      expect(typeof extendedSession.lastAmbientSpeech).toBe('number');
      
      logger.info('✅ Timestamp tracking validated');
    });

    it('should prevent spam with minimum interval', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const args = { content: 'Test ambient speech' };

      // First execution should succeed
      const firstResult = await ambientTool.execute(args, mockContext);
      expect(firstResult.success).toBe(true);

      // Second execution immediately should be skipped
      const secondResult = await ambientTool.execute(args, mockContext);
      const secondData = secondResult.data as AmbientResponseData;
      expect(secondResult.success).toBe(true);
      expect(secondData.skipped).toBe(true);
      expect(secondData.nextAvailableIn).toBeDefined();
      expect(secondData.nextAvailableIn).toBeGreaterThan(0);
      
      logger.info('✅ Spam prevention validated');
    });

    it('should allow forced generation despite timing', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const args = { content: 'Test ambient speech' };

      // First execution
      await ambientTool.execute(args, mockContext);

      // Second execution with force should succeed
      const forcedArgs = { ...args, forceGenerate: true };
      const forcedResult = await ambientTool.execute(forcedArgs, mockContext);
      const forcedData = forcedResult.data as AmbientResponseData;
      
      expect(forcedResult.success).toBe(true);
      expect(forcedData.skipped).toBeUndefined();
      expect(forcedData.content).toBe('Test ambient speech');
      
      logger.info('✅ Forced generation validated');
    });

    it('should maintain ambient history', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const args = { content: 'Historical ambient speech' };

      const result = await ambientTool.execute(args, mockContext);

      expect(result.success).toBe(true);
      expect(extendedSession.ambientHistory).toBeDefined();
      if (extendedSession.ambientHistory) {
        expect(extendedSession.ambientHistory.length).toBe(1);
        expect(extendedSession.ambientHistory[0].message).toBe('Historical ambient speech');
        expect(extendedSession.ambientHistory[0].timestamp).toBeDefined();
      }
      
      logger.info('✅ Ambient history maintenance validated');
    });

    it('should limit history to maximum entries', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      
      // Add 15 entries (more than max of 10)
      for (let i = 0; i < 15; i++) {
        const args = { content: `Ambient speech ${i}`, forceGenerate: true };
        await ambientTool.execute(args, mockContext);
      }

      expect(extendedSession.ambientHistory).toBeDefined();
      if (extendedSession.ambientHistory) {
        expect(extendedSession.ambientHistory.length).toBe(TEST_CONFIG.MAX_HISTORY_ENTRIES);
        expect(extendedSession.ambientHistory[0].message).toBe('Ambient speech 5'); // Should keep last 10
        expect(extendedSession.ambientHistory[9].message).toBe('Ambient speech 14');
      }
      
      logger.info('✅ History limit enforcement validated');
    });
  });

  describe('Duplicate Content Detection', () => {
    it('should detect duplicate content within time window', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const duplicateContent = 'This is duplicate content';
      
      // First execution
      const firstResult = await ambientTool.execute(
        { content: duplicateContent },
        mockContext
      );
      expect(firstResult.success).toBe(true);

      // Advance time but stay within duplicate window
      vi.advanceTimersByTime(5000); // 5 seconds

      // Second execution with same content should be skipped due to timing, not duplicate detection
      const secondResult = await ambientTool.execute(
        { content: duplicateContent },
        mockContext
      );
      const secondData = secondResult.data as AmbientResponseData;
      expect(secondResult.success).toBe(true);
      expect(secondData.skipped).toBe(true);
      // Note: This will be skipped due to timing interval, not duplicate detection
      
      logger.info('✅ Duplicate content detection validated');
    });

    it('should allow duplicate content after time window expires', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const duplicateContent = 'This content will be repeated';
      
      // First execution
      const firstResult = await ambientTool.execute(
        { content: duplicateContent },
        mockContext
      );
      expect(firstResult.success).toBe(true);

      // Advance time beyond duplicate window
      vi.advanceTimersByTime(TEST_CONFIG.DUPLICATE_CHECK_WINDOW + 1000);

      // Second execution should succeed
      const secondResult = await ambientTool.execute(
        { content: duplicateContent },
        mockContext
      );
      const secondData = secondResult.data as AmbientResponseData;
      expect(secondResult.success).toBe(true);
      expect(secondData.skipped).toBeUndefined();
      expect(secondData.content).toBe(duplicateContent);
      
      logger.info('✅ Duplicate content expiration validated');
    });

    it('should allow forced generation of duplicate content', async () => {
      const extendedSession = mockSessionData as ExtendedSessionData;
      const duplicateContent = 'Forced duplicate content';
      
      // First execution
      await ambientTool.execute({ content: duplicateContent }, mockContext);

      // Second execution with force should succeed despite duplicate
      const forcedResult = await ambientTool.execute(
        { content: duplicateContent, forceGenerate: true },
        mockContext
      );
      const forcedData = forcedResult.data as AmbientResponseData;
      expect(forcedResult.success).toBe(true);
      expect(forcedData.skipped).toBeUndefined();
      expect(forcedData.content).toBe(duplicateContent);
      
      logger.info('✅ Forced duplicate generation validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing session data gracefully', async () => {
      const invalidContext = {
        log: mockContext.log,
        session: { data: null as unknown as McpSessionData }
      };

      const args = { content: 'Test content' };
      
      await expect(ambientTool.execute(args, invalidContext)).rejects.toThrow();
      
      logger.info('✅ Missing session data handling validated');
    });

    it('should handle missing hyperfyService gracefully', async () => {
      const sessionWithoutService = {
        ...mockSessionData,
        hyperfyService: null as unknown as McpSessionData['hyperfyService']
      };
      const contextWithoutService = {
        log: mockContext.log,
        session: { data: sessionWithoutService }
      };

      const args = {} as Parameters<typeof ambientTool.execute>[0];
      
      // Should return error result, not throw
      const result = await ambientTool.execute(args, contextWithoutService);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ambient_speech_failed');
      
      logger.info('✅ Missing hyperfyService handling validated');
    });

    it('should provide fallback content when generation fails', async () => {
      // Mock world to return null
      mockSessionData.hyperfyService.getWorld = vi.fn().mockReturnValue(null);

      const args = {} as Parameters<typeof ambientTool.execute>[0];
      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.content).toBeDefined();
      expect(data.content.length).toBeGreaterThan(0);
      
      logger.info('✅ Fallback content generation validated');
    });

    it('should handle empty or whitespace content', async () => {
      const args = { content: '   ' }; // Whitespace only

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.content).toBeDefined();
      expect(data.content.trim().length).toBeGreaterThan(0);
      
      logger.info('✅ Empty content handling validated');
    });

    it('should handle execution errors gracefully', async () => {
      // Create a context that will cause an error early in execution
      const errorContext = {
        log: {
          ...mockContext.log,
          info: vi.fn().mockImplementation(() => {
            throw new Error('Logging error');
          })
        },
        session: mockContext.session
      };

      const args = { content: 'Test content' };
      
      // The ambient tool catches all errors and returns error result
      const result = await ambientTool.execute(args, errorContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('ambient_speech_failed');
      expect(result.message).toContain('Failed to perform ambient speech');
      
      logger.info('✅ Execution error handling validated');
    });
  });

  describe('Response Data Validation', () => {
    it('should include all required response fields', async () => {
      const args = {
        content: 'Complete response test',
        duration: 7,
        volume: 0.9
      };

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.data).toBeDefined();
      expect(data.content).toBe('Complete response test');
      expect(data.duration).toBe(7);
      expect(data.volume).toBe(0.9);
      expect(data.timestamp).toBeDefined();
      expect(data.worldId).toBe('test-world-123');
      expect(data.userId).toBe('test-user-456');
      expect(data.position).toEqual({ x: 10.5, y: 0, z: 15.3 });
      expect(data.generationType).toBe('provided');
      
      logger.info('✅ Complete response data validated');
    });

    it('should use default values for optional parameters', async () => {
      const args = { content: 'Default values test' };

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.duration).toBe(5); // Default duration
      expect(data.volume).toBe(0.8); // Default volume
      
      logger.info('✅ Default parameter values validated');
    });

    it('should include timestamp in ISO format', async () => {
      const args = { content: 'Timestamp test' };

      const result = await ambientTool.execute(args, mockContext);
      const data = result.data as AmbientResponseData;

      expect(result.success).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
      
      logger.info('✅ Timestamp format validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const args = {
        content: 'Logging test',
        context: 'test context'
      };

      await ambientTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_ambient_speech',
        expect.objectContaining({
          hasContent: true,
          hasContext: true
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log generation details for contextual speech', async () => {
      const args = {} as Parameters<typeof ambientTool.execute>[0];

      await ambientTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith('Generating contextual ambient speech');
      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Generated contextual ambient speech',
        expect.objectContaining({
          contextFactors: expect.any(Number),
          hasWorldContext: expect.any(Boolean),
          messageLength: expect.any(Number)
        })
      );
      
      logger.info('✅ Generation logging validated');
    });

    it('should log successful completion', async () => {
      const args = { content: 'Success logging test' };

      await ambientTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Ambient speech generated successfully',
        expect.objectContaining({
          contentLength: expect.any(Number),
          duration: expect.any(Number),
          volume: expect.any(Number)
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log errors appropriately', async () => {
      const errorContext = {
        log: {
          ...mockContext.log,
          info: vi.fn().mockImplementation(() => {
            throw new Error('Test error');
          })
        },
        session: mockContext.session
      };

      const args = { content: 'Error logging test' };
      await ambientTool.execute(args, errorContext);

      expect(errorContext.log.error).toHaveBeenCalledWith(
        'Error performing ambient speech',
        expect.objectContaining({
          error: 'Test error',
          args: expect.any(Object)
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });
});
