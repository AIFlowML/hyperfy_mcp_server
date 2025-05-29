import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { unuseTool } from '../src/servers/actions/unuseTool.js';
import type { McpSessionData } from '../src/servers/server.js';

// Test logger for validation
const logger = {
  info: (message: string) => console.log(`ℹ️  ${message}`),
  warn: (message: string) => console.log(`⚠️  ${message}`),
  error: (message: string) => console.log(`❌ ${message}`)
};

// Mock interfaces
interface MockHyperfyService {
  isConnected: MockedFunction<() => boolean>;
  getWorld: MockedFunction<() => MockWorld | null>;
  currentWorldId: string;
}

interface MockWorld {
  entities: {
    items: Map<string, any>;
  };
}

interface MockActions {
  releaseAction: MockedFunction<() => void>;
  getCurrentAction?: MockedFunction<() => string>;
  getActiveItem?: MockedFunction<() => string>;
}

// Mock factory functions
function createMockHyperfyService(options: {
  isConnected?: boolean;
  worldId?: string;
  hasWorld?: boolean;
} = {}): MockHyperfyService {
  const {
    isConnected = true,
    worldId = 'test-world-123',
    hasWorld = true
  } = options;

  return {
    isConnected: vi.fn().mockReturnValue(isConnected),
    getWorld: vi.fn().mockReturnValue(hasWorld ? { entities: { items: new Map() } } : null),
    currentWorldId: worldId
  };
}

function createMockActions(options: {
  hasReleaseAction?: boolean;
  hasCurrentAction?: boolean;
  hasActiveItem?: boolean;
  currentAction?: string;
  activeItem?: string;
} = {}): MockActions {
  const {
    hasReleaseAction = true,
    hasCurrentAction = false,
    hasActiveItem = false,
    currentAction = 'test-action',
    activeItem = 'test-item'
  } = options;

  const actions: MockActions = {
    releaseAction: vi.fn()
  };

  if (hasCurrentAction) {
    actions.getCurrentAction = vi.fn().mockReturnValue(currentAction);
  }

  if (hasActiveItem) {
    actions.getActiveItem = vi.fn().mockReturnValue(activeItem);
  }

  if (!hasReleaseAction) {
    delete (actions as any).releaseAction;
  }

  return actions;
}

function createMockSessionData(
  hyperfyService: MockHyperfyService | null, 
  actions: MockActions | null,
  options: {
    worldId?: string;
    userId?: string;
    hasUnuseHistory?: boolean;
  } = {}
): McpSessionData & { 
  lastUnuseAction?: number; 
  unuseHistory?: Array<{
    timestamp: number;
    reason?: string;
    unuseId: string;
    success: boolean;
    previousItemType?: string;
  }> 
} {
  const { worldId = 'test-world', userId = 'test-user', hasUnuseHistory = false } = options;
  
  const sessionData: any = {
    hyperfyService,
    actions,
    worldId,
    userId,
    sessionId: 'test-session-123',
    timestamp: Date.now()
  };

  if (hasUnuseHistory) {
    sessionData.unuseHistory = [
      {
        timestamp: Date.now() - 10000,
        reason: 'previous unuse',
        unuseId: 'prev-unuse-123',
        success: true,
        previousItemType: 'tool'
      }
    ];
    sessionData.lastUnuseAction = Date.now() - 10000;
  }

  return sessionData;
}

function createMockToolContext(sessionData: ReturnType<typeof createMockSessionData>) {
  return {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    session: { data: sessionData }
  };
}

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000,
  UNUSE_TIMEOUT: 1000,
};

describe('Unuse Tool', () => {
  let mockActions: MockActions;
  let mockService: MockHyperfyService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActions = createMockActions();
    mockService = createMockHyperfyService();
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool name and description', () => {
      expect(unuseTool.name).toBe('hyperfy_unuse_item');
      expect(unuseTool.description).toContain('Stops interacting with the currently held or active item');
      expect(unuseTool.description).toContain('Examples of unuse usage');
      
      logger.info('✅ Tool metadata validated');
    });

    it('should have proper parameter schema', () => {
      expect(unuseTool.parameters).toBeDefined();
      
      // Test parameter validation
      const validParams = { reason: 'test unuse', force: true, context: 'test context' };
      const parseResult = unuseTool.parameters.safeParse(validParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Parameter schema validated');
    });

    it('should accept optional parameters', () => {
      const emptyParams = {};
      const parseResult = unuseTool.parameters.safeParse(emptyParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Optional parameters validated');
    });

    it('should validate parameter types', () => {
      const invalidParams = { reason: 123, force: 'not-boolean', context: null };
      const parseResult = unuseTool.parameters.safeParse(invalidParams);
      expect(parseResult.success).toBe(false);
      
      logger.info('✅ Parameter type validation confirmed');
    });
  });

  describe('Service and System Validation', () => {
    it('should handle missing Hyperfy service', async () => {
      const sessionData = createMockSessionData(null, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('service_unavailable');
      expect(result.message).toContain('Hyperfy connection unavailable');
      
      logger.info('✅ Missing service handling validated');
    });

    it('should handle disconnected service', async () => {
      const service = createMockHyperfyService({ isConnected: false });
      const sessionData = createMockSessionData(service, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_connected');
      expect(result.message).toContain('Hyperfy not connected');
      
      logger.info('✅ Disconnected service handling validated');
    });

    it('should handle missing world', async () => {
      const service = createMockHyperfyService({ hasWorld: false });
      const sessionData = createMockSessionData(service, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_unavailable');
      expect(result.message).toContain('Hyperfy world not accessible');
      
      logger.info('✅ Missing world handling validated');
    });
  });

  describe('Actions System Validation', () => {
    it('should handle missing actions', async () => {
      const sessionData = createMockSessionData(mockService, null);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('actions_unavailable');
      expect(result.message).toContain('Required systems are unavailable');
      
      logger.info('✅ Missing actions handling validated');
    });

    it('should handle missing releaseAction method', async () => {
      const actions = createMockActions({ hasReleaseAction: false });
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('method_unavailable');
      expect(result.message).toContain('Item release functionality not available');
      
      logger.info('✅ Missing releaseAction method handling validated');
    });

    it('should successfully call releaseAction when available', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(mockActions.releaseAction).toHaveBeenCalledWith();
      
      logger.info('✅ Successful releaseAction call validated');
    });
  });

  describe('Reason Processing', () => {
    it('should handle no reason provided', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Item released.');
      expect(result.data?.reason).toBeUndefined();
      
      logger.info('✅ No reason handling validated');
    });

    it('should process custom reason', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const customReason = 'User requested drop';
      const args = { reason: customReason };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Item released.');
      expect(result.data?.reason).toBe(customReason);
      
      logger.info('✅ Custom reason processing validated');
    });

    it('should handle empty reason string', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: '   ' }; // Empty/whitespace reason
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.reason).toBeUndefined(); // Should be processed as undefined
      
      logger.info('✅ Empty reason handling validated');
    });

    it('should handle force flag', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'forced release', force: true };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.force).toBe(true);
      
      logger.info('✅ Force flag handling validated');
    });
  });

  describe('Item Context Detection', () => {
    it('should detect current action', async () => {
      const actions = createMockActions({ 
        hasCurrentAction: true, 
        currentAction: 'using-tool' 
      });
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'release tool' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousItemType).toBe('using-tool');
      
      logger.info('✅ Current action detection validated');
    });

    it('should detect active item', async () => {
      const actions = createMockActions({ 
        hasActiveItem: true, 
        activeItem: 'held-object' 
      });
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'drop object' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousItemType).toBe('held-object');
      
      logger.info('✅ Active item detection validated');
    });

    it('should handle unknown item when no detection methods available', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'release unknown' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousItemType).toBeUndefined();
      
      logger.info('✅ Unknown item handling validated');
    });

    it('should handle item detection errors gracefully', async () => {
      const actions = createMockActions({ hasCurrentAction: true });
      actions.getCurrentAction = vi.fn().mockImplementation(() => {
        throw new Error('Detection error');
      });
      
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'release with error' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousItemType).toBeUndefined();
      
      logger.info('✅ Item detection error handling validated');
    });
  });

  describe('Session Tracking and History', () => {
    it('should track unuse in session history', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'tracked unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.lastUnuseAction).toBeDefined();
      expect(sessionData.unuseHistory).toBeDefined();
      expect(sessionData.unuseHistory?.length).toBe(1);
      
      const historyEntry = sessionData.unuseHistory?.[0];
      expect(historyEntry?.reason).toBe('tracked unuse');
      expect(historyEntry?.success).toBe(true);
      expect(historyEntry?.unuseId).toBeDefined();
      expect(historyEntry?.previousItemType).toBeUndefined();
      
      logger.info('✅ Session tracking validated');
    });

    it('should maintain existing history and add new entries', async () => {
      const sessionData = createMockSessionData(mockService, mockActions, { hasUnuseHistory: true });
      const context = createMockToolContext(sessionData);

      const initialHistoryLength = sessionData.unuseHistory?.length || 0;
      
      const args = { reason: 'new unuse entry' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.unuseHistory?.length).toBe(initialHistoryLength + 1);
      
      const latestEntry = sessionData.unuseHistory?.[sessionData.unuseHistory.length - 1];
      expect(latestEntry?.reason).toBe('new unuse entry');
      
      logger.info('✅ History maintenance validated');
    });

    it('should limit history to 20 entries', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      // Add 25 entries to test limit
      sessionData.unuseHistory = Array.from({ length: 25 }, (_, i) => ({
        timestamp: Date.now() - (25 - i) * 1000,
        reason: `unuse ${i}`,
        unuseId: `unuse-${i}`,
        success: true,
        previousItemType: 'item'
      }));

      const args = { reason: 'final unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.unuseHistory?.length).toBe(20);
      
      // Should keep the most recent entries
      const latestEntry = sessionData.unuseHistory?.[sessionData.unuseHistory.length - 1];
      expect(latestEntry?.reason).toBe('final unuse');
      
      logger.info('✅ History limit enforcement validated');
    });

    it('should include unuse ID in response data', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'id test' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.unuseId).toBeDefined();
      expect(typeof result.data?.unuseId).toBe('string');
      expect(result.data?.unuseId.length).toBeGreaterThan(0);
      
      logger.info('✅ Unuse ID generation validated');
    });
  });

  describe('Response Data Structure', () => {
    it('should return complete success response data', async () => {
      const sessionData = createMockSessionData(mockService, mockActions, {
        worldId: 'test-world-456',
        userId: 'test-user-789'
      });
      const context = createMockToolContext(sessionData);

      const args = { reason: 'complete test', force: true, context: 'test context' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        unuseId: expect.any(String),
        reason: 'complete test',
        previousItemType: undefined,
        timestamp: expect.any(String),
        worldId: 'test-world-456',
        userId: 'test-user-789',
        status: 'released',
        force: true,
        actions: ['HYPERFY_UNUSE_ITEM'],
        source: 'hyperfy'
      }));
      
      logger.info('✅ Complete response data structure validated');
    });

    it('should format timestamp correctly', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'timestamp test' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.timestamp).toBeDefined();
      
      // Validate ISO timestamp format
      const timestamp = new Date(result.data?.timestamp as string);
      expect(timestamp.toISOString()).toBe(result.data?.timestamp);
      
      logger.info('✅ Timestamp formatting validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle releaseAction method throwing error', async () => {
      const actions = createMockActions();
      actions.releaseAction.mockImplementation(() => {
        throw new Error('Release action failed');
      });
      
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'error test' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('unuse_failed');
      expect(result.message).toContain('Error releasing item');
      
      logger.info('✅ releaseAction error handling validated');
    });

    it('should track failed unuse in history', async () => {
      const actions = createMockActions();
      actions.releaseAction.mockImplementation(() => {
        throw new Error('Release failed');
      });
      
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'failed unuse' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(sessionData.unuseHistory?.length).toBe(1);
      
      const historyEntry = sessionData.unuseHistory?.[0];
      expect(historyEntry?.success).toBe(false);
      expect(historyEntry?.reason).toBe('failed unuse');
      
      logger.info('✅ Failed unuse history tracking validated');
    });

    it('should handle very long reason strings', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const longReason = 'a'.repeat(1000);
      const args = { reason: longReason };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.reason).toBe(longReason);
      
      logger.info('✅ Long reason string handling validated');
    });

    it('should handle null and undefined context gracefully', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { context: undefined };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Item released.');
      
      logger.info('✅ Null context handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'logging test', force: true, context: 'test context' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_unuse_item',
        expect.objectContaining({
          reason: 'logging test',
          force: true,
          hasContext: true
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log release attempt details', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'release logging test' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Attempting to release current action via AgentActions',
        expect.objectContaining({
          reason: 'release logging test',
          currentItem: undefined,
          force: undefined
        })
      );
      
      logger.info('✅ Release attempt logging validated');
    });

    it('should log success details', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'success logging test' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Item released successfully',
        expect.objectContaining({
          reason: 'success logging test',
          unuseId: expect.any(String),
          currentItem: undefined,
          responseMessage: 'Item released.'
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log errors appropriately', async () => {
      const actions = createMockActions();
      actions.releaseAction.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const sessionData = createMockSessionData(mockService, actions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'error logging test' };
      const result = await unuseTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(context.log.error).toHaveBeenCalledWith(
        'Error in HYPERFY_UNUSE_ITEM',
        expect.objectContaining({
          error: 'Test error',
          args
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should complete unuse operation quickly', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const startTime = Date.now();
      const args = { reason: 'performance test' };
      const result = await unuseTool.execute(args, context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(TEST_CONFIG.UNUSE_TIMEOUT);
      
      logger.info('✅ Performance characteristics validated');
    });

    it('should handle concurrent unuse attempts gracefully', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'concurrent test' };
      
      // Execute multiple unuse operations concurrently
      const promises = Array.from({ length: 5 }, () => 
        unuseTool.execute(args, context)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }
      
      // releaseAction should be called for each
      expect(mockActions.releaseAction).toHaveBeenCalledTimes(5);
      
      logger.info('✅ Concurrent operations validated');
    });

    it('should maintain state consistency across multiple operations', async () => {
      const sessionData = createMockSessionData(mockService, mockActions);
      const context = createMockToolContext(sessionData);

      // Execute multiple unuse operations in sequence
      for (let i = 0; i < 3; i++) {
        const args = { reason: `unuse ${i}` };
        const result = await unuseTool.execute(args, context);
        expect(result.success).toBe(true);
      }

      // Check final state
      expect(sessionData.unuseHistory?.length).toBe(3);
      expect(sessionData.lastUnuseAction).toBeDefined();
      
      // Verify history order
      const reasons = sessionData.unuseHistory?.map(entry => entry.reason);
      expect(reasons).toEqual(['unuse 0', 'unuse 1', 'unuse 2']);
      
      logger.info('✅ State consistency validated');
    });
  });
});
