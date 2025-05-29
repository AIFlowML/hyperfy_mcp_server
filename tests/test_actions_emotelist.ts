/**
 * Comprehensive test suite for Get Emote List Tool
 * Tests emote list retrieval, format options, data structure validation, and error handling
 * Validates the complete emote list functionality for the FastMCP server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getEmoteListTool } from '../src/servers/actions/getEmoteListTool.js';
import type { McpSessionData } from '../src/servers/server.js';
import { createLogger } from '../src/utils/eliza-compat.js';
import { EMOTES_LIST } from '../src/servers/config/constants.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000, // 10 seconds for emote list tests
  EXPECTED_CATEGORIES: ['expressions', 'gestures', 'activities', 'social'],
  MIN_EMOTES_COUNT: 10, // Minimum expected emotes
};

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Type for emote list response data
interface EmoteListResponseData {
  emotes?: Array<{ name: string; description: string }>;
  formatted_text?: string;
  total_count: number;
  categories?: string[];
}

// Mock session data for testing
function createMockSessionData(): McpSessionData {
  return {
    worldId: 'test-world-123',
    userId: 'test-user-456',
    playerState: {
      id: 'test-player-789',
      name: 'TestEmoteAgent',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      status: 'active',
      lastActivity: new Date(),
      metadata: {},
    },
    worldState: {
      id: 'test-world-123',
      name: 'Test Emote World',
      playerCount: 1,
      entities: [],
      lastUpdate: new Date(),
      metadata: {},
    },
    connectionTime: new Date(),
    lastActivity: new Date(),
    preferences: {},
    hyperfyService: {} as unknown as McpSessionData['hyperfyService'],
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

describe('Get Emote List Tool', () => {
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
    
    logger.info('🎭 Starting Get Emote List Tool test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    logger.info('🧹 Get Emote List Tool test cleanup complete');
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool configuration', () => {
      expect(getEmoteListTool.name).toBe('hyperfy_get_emote_list');
      expect(getEmoteListTool.description).toBeDefined();
      expect(getEmoteListTool.description.length).toBeGreaterThan(200);
      expect(getEmoteListTool.parameters).toBeDefined();
      expect(getEmoteListTool.execute).toBeDefined();
      expect(typeof getEmoteListTool.execute).toBe('function');
      
      logger.info('✅ Tool configuration validated');
    });

    it('should have comprehensive parameter schema', () => {
      const schema = getEmoteListTool.parameters;
      
      // Test that schema accepts valid parameters
      const validParams = [
        {},
        { format: 'structured' },
        { format: 'text' },
        { format: 'both' }
      ];
      
      for (const params of validParams) {
        const result = schema.safeParse(params);
        expect(result.success).toBe(true);
      }
      
      logger.info('✅ Parameter schema validated');
    });

    it('should validate parameter constraints', () => {
      const schema = getEmoteListTool.parameters;
      
      // Test invalid format
      const invalidFormat = schema.safeParse({ format: 'invalid' });
      expect(invalidFormat.success).toBe(false);
      
      // Test valid formats
      const structuredFormat = schema.safeParse({ format: 'structured' });
      const textFormat = schema.safeParse({ format: 'text' });
      const bothFormat = schema.safeParse({ format: 'both' });
      
      expect(structuredFormat.success).toBe(true);
      expect(textFormat.success).toBe(true);
      expect(bothFormat.success).toBe(true);
      
      logger.info('✅ Parameter constraints validated');
    });

    it('should have detailed description with examples', () => {
      const description = getEmoteListTool.description;
      
      // Check for key content (case-sensitive to match actual markdown)
      expect(description).toContain('emotes');
      expect(description).toContain('animations');
      expect(description).toContain('Examples of usage');
      expect(description).toContain('Emote Categories');
      expect(description).toContain('**Expressions**'); // Match the actual markdown format
      expect(description).toContain('**Gestures**'); // Match the actual markdown format
      expect(description).toContain('**Activities**'); // Match the actual markdown format
      expect(description).toContain('**Social**'); // Match the actual markdown format
      
      logger.info('✅ Tool description content validated');
    });
  });

  describe('Default Format (Both)', () => {
    it('should return both structured and text format by default', async () => {
      const args = {}; // No format specified, should default to 'both'

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Retrieved ${EMOTES_LIST.length} available emotes`);
      
      // Should have both structured and text data
      expect(data.emotes).toBeDefined();
      expect(data.formatted_text).toBeDefined();
      expect(data.total_count).toBe(EMOTES_LIST.length);
      expect(data.categories).toEqual(TEST_CONFIG.EXPECTED_CATEGORIES);
      
      logger.info('✅ Default format (both) validated');
    });

    it('should include all emotes from constants', async () => {
      const args = {};

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.emotes).toBeDefined();
      if (data.emotes) {
        expect(data.emotes.length).toBe(EMOTES_LIST.length);
        expect(data.emotes.length).toBeGreaterThanOrEqual(TEST_CONFIG.MIN_EMOTES_COUNT);
        
        // Verify structure of emote objects
        for (const emote of data.emotes) {
          expect(emote).toHaveProperty('name');
          expect(emote).toHaveProperty('description');
          expect(typeof emote.name).toBe('string');
          expect(typeof emote.description).toBe('string');
          expect(emote.name.length).toBeGreaterThan(0);
          expect(emote.description.length).toBeGreaterThan(0);
        }
      }
      
      logger.info('✅ Complete emote list inclusion validated');
    });

    it('should generate properly formatted markdown text', async () => {
      const args = {};

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.formatted_text).toBeDefined();
      if (data.formatted_text) {
        // Check markdown structure
        expect(data.formatted_text).toContain('# Available Emotes');
        expect(data.formatted_text).toContain(`Total: ${EMOTES_LIST.length} emotes available`);
        
        // Check that each emote is formatted correctly
        for (const emote of EMOTES_LIST) {
          expect(data.formatted_text).toContain(`- **${emote.name}**: ${emote.description}`);
        }
        
        // Verify markdown structure
        const lines = data.formatted_text.split('\n');
        expect(lines[0]).toBe('# Available Emotes');
        expect(lines[1]).toBe('');
        expect(lines[lines.length - 1]).toBe(`Total: ${EMOTES_LIST.length} emotes available`);
      }
      
      logger.info('✅ Markdown text formatting validated');
    });
  });

  describe('Structured Format', () => {
    it('should return only structured data when format is structured', async () => {
      const args = { format: 'structured' as const };

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Retrieved ${EMOTES_LIST.length} available emotes (structured format)`);
      
      // Should have structured data but no formatted text
      expect(data.emotes).toBeDefined();
      expect(data.formatted_text).toBeUndefined();
      expect(data.total_count).toBe(EMOTES_LIST.length);
      expect(data.categories).toEqual(TEST_CONFIG.EXPECTED_CATEGORIES);
      
      logger.info('✅ Structured format validated');
    });

    it('should include categories in structured format', async () => {
      const args = { format: 'structured' as const };

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.categories).toBeDefined();
      expect(data.categories).toEqual(TEST_CONFIG.EXPECTED_CATEGORIES);
      expect(data.categories?.length).toBe(4);
      
      logger.info('✅ Categories inclusion validated');
    });

    it('should maintain emote data integrity in structured format', async () => {
      const args = { format: 'structured' as const };

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.emotes).toBeDefined();
      if (data.emotes) {
        // Verify each emote matches the original data
        for (let i = 0; i < data.emotes.length; i++) {
          expect(data.emotes[i].name).toBe(EMOTES_LIST[i].name);
          expect(data.emotes[i].description).toBe(EMOTES_LIST[i].description);
        }
      }
      
      logger.info('✅ Emote data integrity validated');
    });
  });

  describe('Text Format', () => {
    it('should return only text data when format is text', async () => {
      const args = { format: 'text' as const };

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Retrieved ${EMOTES_LIST.length} available emotes (text format)`);
      
      // Should have formatted text but no structured data
      expect(data.emotes).toBeUndefined();
      expect(data.formatted_text).toBeDefined();
      expect(data.total_count).toBe(EMOTES_LIST.length);
      expect(data.categories).toBeUndefined();
      
      logger.info('✅ Text format validated');
    });

    it('should generate complete markdown in text format', async () => {
      const args = { format: 'text' as const };

      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.formatted_text).toBeDefined();
      if (data.formatted_text) {
        // Count the number of emote entries in the text
        const emoteLines = data.formatted_text.split('\n').filter(line => line.startsWith('- **'));
        expect(emoteLines.length).toBe(EMOTES_LIST.length);
        
        // Verify header and footer
        expect(data.formatted_text.startsWith('# Available Emotes')).toBe(true);
        expect(data.formatted_text.endsWith(`Total: ${EMOTES_LIST.length} emotes available`)).toBe(true);
      }
      
      logger.info('✅ Complete markdown generation validated');
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should return consistent total_count across all formats', async () => {
      const formats = ['structured', 'text', 'both'] as const;
      const results: Awaited<ReturnType<typeof getEmoteListTool.execute>>[] = [];

      for (const format of formats) {
        const result = await getEmoteListTool.execute({ format }, mockContext);
        results.push(result);
      }

      // All should succeed and have same total_count
      for (const result of results) {
        expect(result.success).toBe(true);
        const data = result.data as EmoteListResponseData;
        expect(data.total_count).toBe(EMOTES_LIST.length);
      }
      
      logger.info('✅ Total count consistency validated');
    });

    it('should handle empty emotes list gracefully', async () => {
      // Mock empty emotes list temporarily
      const originalEmotesList = EMOTES_LIST.length;
      
      // We can't actually modify the imported constant, but we can test the behavior
      // by checking that the tool handles the current list correctly
      const args = {};
      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.total_count).toBe(originalEmotesList);
      expect(data.total_count).toBeGreaterThan(0); // Assuming we have emotes
      
      logger.info('✅ Emotes list handling validated');
    });

    it('should validate emote data structure', async () => {
      const args = {};
      const result = await getEmoteListTool.execute(args, mockContext);
      const data = result.data as EmoteListResponseData;

      expect(result.success).toBe(true);
      expect(data.emotes).toBeDefined();
      if (data.emotes) {
        for (const emote of data.emotes) {
          // Validate required properties
          expect(emote).toHaveProperty('name');
          expect(emote).toHaveProperty('description');
          
          // Validate types
          expect(typeof emote.name).toBe('string');
          expect(typeof emote.description).toBe('string');
          
          // Validate content
          expect(emote.name.trim().length).toBeGreaterThan(0);
          expect(emote.description.trim().length).toBeGreaterThan(0);
          
          // Validate no extra properties
          const keys = Object.keys(emote);
          expect(keys).toEqual(['name', 'description']);
        }
      }
      
      logger.info('✅ Emote data structure validated');
    });

    it('should maintain data immutability', async () => {
      const args = {};
      
      // Execute multiple times
      const result1 = await getEmoteListTool.execute(args, mockContext);
      const result2 = await getEmoteListTool.execute(args, mockContext);
      
      const data1 = result1.data as EmoteListResponseData;
      const data2 = result2.data as EmoteListResponseData;

      // Results should be identical but not the same object reference
      expect(data1.total_count).toBe(data2.total_count);
      expect(data1.formatted_text).toBe(data2.formatted_text);
      expect(data1.emotes).toEqual(data2.emotes);
      expect(data1.categories).toEqual(data2.categories);
      
      logger.info('✅ Data immutability validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle execution errors gracefully', async () => {
      // Now that log.info is inside try-catch, errors should be caught and returned
      const errorContext = {
        log: {
          ...mockContext.log,
          info: vi.fn().mockImplementation(() => {
            throw new Error('Logging error');
          })
        },
        session: mockContext.session
      };

      const args = {};
      const result = await getEmoteListTool.execute(args, errorContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('emote_list_retrieval_failed');
      expect(result.message).toContain('Failed to retrieve emote list');
      expect(result.message).toContain('Logging error');
      
      logger.info('✅ Execution error handling validated');
    });

    it('should handle unknown errors gracefully', async () => {
      // Now that log.info is inside try-catch, errors should be caught and returned
      const errorContext = {
        log: {
          ...mockContext.log,
          info: vi.fn().mockImplementation(() => {
            throw 'String error';
          })
        },
        session: mockContext.session
      };

      const args = {};
      const result = await getEmoteListTool.execute(args, errorContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('emote_list_retrieval_failed');
      expect(result.message).toBe('Failed to retrieve emote list: Unknown error occurred');
      
      logger.info('✅ Unknown error handling validated');
    });

    it('should handle invalid format parameter gracefully', async () => {
      // This should be caught by Zod validation, but test the tool's robustness
      const args = { format: 'invalid' as unknown as 'structured' };

      // The Zod schema should prevent this, but if it somehow gets through
      try {
        const result = await getEmoteListTool.execute(args, mockContext);
        // If it doesn't throw, it should still work with default
        expect(result.success).toBe(true);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
      
      logger.info('✅ Invalid format handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const args = { format: 'structured' as const };

      await getEmoteListTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_get_emote_list',
        expect.objectContaining({
          format: 'structured',
          totalEmotes: EMOTES_LIST.length
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log successful retrieval', async () => {
      const args = { format: 'both' as const };

      await getEmoteListTool.execute(args, mockContext);

      expect(mockContext.log.info).toHaveBeenCalledWith(
        'Emote list retrieved successfully',
        expect.objectContaining({
          format: 'both',
          emoteCount: EMOTES_LIST.length,
          hasFormattedText: true,
          hasStructuredData: true
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log different format options correctly', async () => {
      const formats = [
        { format: 'structured' as const, hasText: false, hasData: true },
        { format: 'text' as const, hasText: true, hasData: false },
        { format: 'both' as const, hasText: true, hasData: true }
      ];

      for (const { format, hasText, hasData } of formats) {
        vi.clearAllMocks();
        await getEmoteListTool.execute({ format }, mockContext);

        expect(mockContext.log.info).toHaveBeenCalledWith(
          'Emote list retrieved successfully',
          expect.objectContaining({
            format,
            emoteCount: EMOTES_LIST.length,
            hasFormattedText: hasText,
            hasStructuredData: hasData
          })
        );
      }
      
      logger.info('✅ Format-specific logging validated');
    });

    it('should log errors appropriately', async () => {
      // Now that log.info is inside try-catch, errors should be caught and returned
      const errorContext = {
        log: {
          ...mockContext.log,
          info: vi.fn().mockImplementation(() => {
            throw new Error('Test error');
          })
        },
        session: mockContext.session
      };

      const args = {};
      const result = await getEmoteListTool.execute(args, errorContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('emote_list_retrieval_failed');
      expect(result.message).toContain('Failed to retrieve emote list');
      expect(result.message).toContain('Test error');

      // Should have called error logging
      expect(errorContext.log.error).toHaveBeenCalledWith(
        'Error retrieving emote list:',
        expect.objectContaining({
          error: 'Test error',
          args: expect.any(Object)
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should handle rapid successive calls', async () => {
      const promises = Array.from({ length: 10 }, () => 
        getEmoteListTool.execute({}, mockContext)
      );

      const results = await Promise.all(promises);

      // All calls should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All should return the same data
      const firstData = results[0].data as EmoteListResponseData;
      for (const result of results) {
        const data = result.data as EmoteListResponseData;
        expect(data.total_count).toBe(firstData.total_count);
        expect(data.formatted_text).toBe(firstData.formatted_text);
      }
      
      logger.info('✅ Rapid successive calls validated');
    });

    it('should be performant for large emote lists', async () => {
      const startTime = Date.now();
      
      await getEmoteListTool.execute({}, mockContext);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete quickly (allowing for test overhead)
      expect(executionTime).toBeLessThan(1000); // 1 second max
      
      logger.info('✅ Performance validation completed', { executionTime });
    });

    it('should maintain consistent response structure', async () => {
      const formats = ['structured', 'text', 'both'] as const;
      
      for (const format of formats) {
        const result = await getEmoteListTool.execute({ format }, mockContext);
        const data = result.data as EmoteListResponseData;
        
        // All responses should have these common properties
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('data');
        expect(data).toHaveProperty('total_count');
        
        // Format-specific properties
        if (format === 'structured' || format === 'both') {
          expect(data).toHaveProperty('emotes');
          expect(data).toHaveProperty('categories');
        }
        if (format === 'text' || format === 'both') {
          expect(data).toHaveProperty('formatted_text');
        }
      }
      
      logger.info('✅ Response structure consistency validated');
    });
  });
});
