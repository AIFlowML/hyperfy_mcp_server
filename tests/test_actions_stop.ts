import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { stopTool } from '../src/servers/actions/stopTool.js';
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

interface MockControls {
  stopNavigation: MockedFunction<(reason?: string) => void>;
  getIsNavigating?: MockedFunction<() => boolean>;
  getIsPatrolling?: MockedFunction<() => boolean>;
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

function createMockControls(options: {
  hasStopNavigation?: boolean;
  hasNavigationState?: boolean;
  hasPatrolState?: boolean;
  isNavigating?: boolean;
  isPatrolling?: boolean;
} = {}): MockControls {
  const {
    hasStopNavigation = true,
    hasNavigationState = false,
    hasPatrolState = false,
    isNavigating = false,
    isPatrolling = false
  } = options;

  const controls: MockControls = {
    stopNavigation: vi.fn()
  };

  if (hasNavigationState) {
    controls.getIsNavigating = vi.fn().mockReturnValue(isNavigating);
  }

  if (hasPatrolState) {
    controls.getIsPatrolling = vi.fn().mockReturnValue(isPatrolling);
  }

  if (!hasStopNavigation) {
    delete (controls as any).stopNavigation;
  }

  return controls;
}

function createMockSessionData(
  hyperfyService: MockHyperfyService | null, 
  controls: MockControls | null,
  options: {
    worldId?: string;
    userId?: string;
    hasStopHistory?: boolean;
  } = {}
): McpSessionData & { 
  lastStopAction?: number; 
  stopHistory?: Array<{
    timestamp: number;
    reason: string;
    stopId: string;
    success: boolean;
    previousActivity: string;
  }> 
} {
  const { worldId = 'test-world', userId = 'test-user', hasStopHistory = false } = options;
  
  const sessionData: any = {
    hyperfyService,
    controls,
    worldId,
    userId,
    sessionId: 'test-session-123',
    timestamp: Date.now()
  };

  if (hasStopHistory) {
    sessionData.stopHistory = [
      {
        timestamp: Date.now() - 10000,
        reason: 'previous stop',
        stopId: 'prev-stop-123',
        success: true,
        previousActivity: 'navigation'
      }
    ];
    sessionData.lastStopAction = Date.now() - 10000;
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
  STOP_TIMEOUT: 1000,
};

describe('Stop Tool', () => {
  let mockControls: MockControls;
  let mockService: MockHyperfyService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockControls = createMockControls();
    mockService = createMockHyperfyService();
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool name and description', () => {
      expect(stopTool.name).toBe('hyperfy_stop_moving');
      expect(stopTool.description).toContain('Stops any current navigation or patrol activity');
      expect(stopTool.description).toContain('Examples of stop usage');
      
      logger.info('✅ Tool metadata validated');
    });

    it('should have proper parameter schema', () => {
      expect(stopTool.parameters).toBeDefined();
      
      // Test parameter validation
      const validParams = { reason: 'test stop', urgent: true, context: 'test context' };
      const parseResult = stopTool.parameters.safeParse(validParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Parameter schema validated');
    });

    it('should accept optional parameters', () => {
      const emptyParams = {};
      const parseResult = stopTool.parameters.safeParse(emptyParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Optional parameters validated');
    });

    it('should validate parameter types', () => {
      const invalidParams = { reason: 123, urgent: 'not-boolean', context: null };
      const parseResult = stopTool.parameters.safeParse(invalidParams);
      expect(parseResult.success).toBe(false);
      
      logger.info('✅ Parameter type validation confirmed');
    });
  });

  describe('Service and System Validation', () => {
    it('should handle missing Hyperfy service', async () => {
      const sessionData = createMockSessionData(null, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('service_unavailable');
      expect(result.message).toContain('Hyperfy connection unavailable');
      
      logger.info('✅ Missing service handling validated');
    });

    it('should handle disconnected service', async () => {
      const service = createMockHyperfyService({ isConnected: false });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_connected');
      expect(result.message).toContain('Hyperfy not connected');
      
      logger.info('✅ Disconnected service handling validated');
    });

    it('should handle missing world', async () => {
      const service = createMockHyperfyService({ hasWorld: false });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_unavailable');
      expect(result.message).toContain('Hyperfy world not accessible');
      
      logger.info('✅ Missing world handling validated');
    });
  });

  describe('Controls System Validation', () => {
    it('should handle missing controls', async () => {
      const sessionData = createMockSessionData(mockService, null);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('controls_unavailable');
      expect(result.message).toContain('controls unavailable');
      
      logger.info('✅ Missing controls handling validated');
    });

    it('should handle missing stopNavigation method', async () => {
      const controls = createMockControls({ hasStopNavigation: false });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('method_unavailable');
      expect(result.message).toContain('Stop functionality not available');
      
      logger.info('✅ Missing stopNavigation method handling validated');
    });

    it('should successfully call stopNavigation when available', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'test stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(mockControls.stopNavigation).toHaveBeenCalledWith('test stop');
      
      logger.info('✅ Successful stopNavigation call validated');
    });
  });

  describe('Reason Processing', () => {
    it('should use default reason when none provided', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('stop action called');
      expect(mockControls.stopNavigation).toHaveBeenCalledWith('stop action called');
      
      logger.info('✅ Default reason processing validated');
    });

    it('should process custom reason', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const customReason = 'User requested stop';
      const args = { reason: customReason };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain(customReason);
      expect(mockControls.stopNavigation).toHaveBeenCalledWith(customReason);
      
      logger.info('✅ Custom reason processing validated');
    });

    it('should handle urgent stops', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'Emergency halt', urgent: true };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Emergency halt (urgent)');
      expect(result.data?.urgent).toBe(true);
      expect(mockControls.stopNavigation).toHaveBeenCalledWith('Emergency halt (urgent)');
      
      logger.info('✅ Urgent stop processing validated');
    });

    it('should auto-detect urgent keywords', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'emergency stop now' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('(urgent)');
      expect(mockControls.stopNavigation).toHaveBeenCalledWith('emergency stop now (urgent)');
      
      logger.info('✅ Auto-urgent detection validated');
    });
  });

  describe('Activity Detection', () => {
    it('should detect navigation activity', async () => {
      const controls = createMockControls({ 
        hasNavigationState: true, 
        isNavigating: true 
      });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'stop navigation' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousActivity).toBe('navigation');
      
      logger.info('✅ Navigation activity detection validated');
    });

    it('should detect patrol activity', async () => {
      const controls = createMockControls({ 
        hasPatrolState: true, 
        isPatrolling: true 
      });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'stop patrol' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousActivity).toBe('patrol');
      
      logger.info('✅ Patrol activity detection validated');
    });

    it('should handle unknown activity when no detection methods available', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'stop unknown' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousActivity).toBe('unknown');
      
      logger.info('✅ Unknown activity handling validated');
    });

    it('should handle activity detection errors gracefully', async () => {
      const controls = createMockControls({ hasNavigationState: true });
      controls.getIsNavigating = vi.fn().mockImplementation(() => {
        throw new Error('Detection error');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'stop with error' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousActivity).toBe('unknown');
      
      logger.info('✅ Activity detection error handling validated');
    });
  });

  describe('Session Tracking and History', () => {
    it('should track stop in session history', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'tracked stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.lastStopAction).toBeDefined();
      expect(sessionData.stopHistory).toBeDefined();
      expect(sessionData.stopHistory?.length).toBe(1);
      
      const historyEntry = sessionData.stopHistory?.[0];
      expect(historyEntry?.reason).toBe('tracked stop');
      expect(historyEntry?.success).toBe(true);
      expect(historyEntry?.stopId).toBeDefined();
      expect(historyEntry?.previousActivity).toBe('unknown');
      
      logger.info('✅ Session tracking validated');
    });

    it('should maintain existing history and add new entries', async () => {
      const sessionData = createMockSessionData(mockService, mockControls, { hasStopHistory: true });
      const context = createMockToolContext(sessionData);

      const initialHistoryLength = sessionData.stopHistory?.length || 0;
      
      const args = { reason: 'new stop entry' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.stopHistory?.length).toBe(initialHistoryLength + 1);
      
      const latestEntry = sessionData.stopHistory?.[sessionData.stopHistory.length - 1];
      expect(latestEntry?.reason).toBe('new stop entry');
      
      logger.info('✅ History maintenance validated');
    });

    it('should limit history to 20 entries', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      // Add 25 entries to test limit
      sessionData.stopHistory = Array.from({ length: 25 }, (_, i) => ({
        timestamp: Date.now() - (25 - i) * 1000,
        reason: `stop ${i}`,
        stopId: `stop-${i}`,
        success: true,
        previousActivity: 'unknown'
      }));

      const args = { reason: 'final stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.stopHistory?.length).toBe(20);
      
      // Should keep the most recent entries
      const latestEntry = sessionData.stopHistory?.[sessionData.stopHistory.length - 1];
      expect(latestEntry?.reason).toBe('final stop');
      
      logger.info('✅ History limit enforcement validated');
    });

    it('should include stop ID in response data', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'id test' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.stopId).toBeDefined();
      expect(typeof result.data?.stopId).toBe('string');
      expect(result.data?.stopId.length).toBeGreaterThan(0);
      
      logger.info('✅ Stop ID generation validated');
    });
  });

  describe('Response Data Structure', () => {
    it('should return complete success response data', async () => {
      const sessionData = createMockSessionData(mockService, mockControls, {
        worldId: 'test-world-456',
        userId: 'test-user-789'
      });
      const context = createMockToolContext(sessionData);

      const args = { reason: 'complete test', urgent: true, context: 'test context' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        stopId: expect.any(String),
        reason: 'complete test (urgent)',
        previousActivity: 'unknown',
        timestamp: expect.any(String),
        worldId: 'test-world-456',
        userId: 'test-user-789',
        status: 'movement_stopped',
        urgent: true,
        actions: ['HYPERFY_STOP_MOVING'],
        source: 'hyperfy'
      }));
      
      logger.info('✅ Complete response data structure validated');
    });

    it('should format timestamp correctly', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'timestamp test' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.timestamp).toBeDefined();
      
      // Validate ISO timestamp format
      const timestamp = new Date(result.data?.timestamp as string);
      expect(timestamp.toISOString()).toBe(result.data?.timestamp);
      
      logger.info('✅ Timestamp formatting validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle stopNavigation method throwing error', async () => {
      const controls = createMockControls();
      controls.stopNavigation.mockImplementation(() => {
        throw new Error('Stop navigation failed');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'error test' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('stop_failed');
      expect(result.message).toContain('Error stopping movement');
      
      logger.info('✅ stopNavigation error handling validated');
    });

    it('should handle empty reason string', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: '   ' }; // Empty/whitespace reason
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('stop action called'); // Should use default
      
      logger.info('✅ Empty reason handling validated');
    });

    it('should track failed stops in history', async () => {
      const controls = createMockControls();
      controls.stopNavigation.mockImplementation(() => {
        throw new Error('Stop failed');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'failed stop' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(sessionData.stopHistory?.length).toBe(1);
      
      const historyEntry = sessionData.stopHistory?.[0];
      expect(historyEntry?.success).toBe(false);
      expect(historyEntry?.reason).toBe('failed stop');
      
      logger.info('✅ Failed stop history tracking validated');
    });

    it('should handle very long reason strings', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const longReason = 'a'.repeat(1000);
      const args = { reason: longReason };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain(longReason);
      
      logger.info('✅ Long reason string handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'logging test', urgent: true, context: 'test context' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_stop_moving',
        expect.objectContaining({
          reason: 'logging test (urgent)',
          urgent: true,
          hasContext: true
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log stop navigation details', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'nav logging test' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Stopping navigation via AgentControls',
        expect.objectContaining({
          reason: 'nav logging test',
          currentActivity: 'unknown',
          urgent: undefined
        })
      );
      
      logger.info('✅ Navigation stop logging validated');
    });

    it('should log success details', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'success logging test' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Movement stopped successfully',
        expect.objectContaining({
          reason: 'success logging test',
          stopId: expect.any(String),
          currentActivity: 'unknown',
          responseMessage: 'Stopped current movement. Reason: success logging test'
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log errors appropriately', async () => {
      const controls = createMockControls();
      controls.stopNavigation.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'error logging test' };
      const result = await stopTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(context.log.error).toHaveBeenCalledWith(
        'Error during HYPERFY_STOP_MOVING',
        expect.objectContaining({
          error: 'Test error',
          args
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should complete stop operation quickly', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const startTime = Date.now();
      const args = { reason: 'performance test' };
      const result = await stopTool.execute(args, context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(TEST_CONFIG.STOP_TIMEOUT);
      
      logger.info('✅ Performance characteristics validated');
    });

    it('should handle concurrent stop attempts gracefully', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { reason: 'concurrent test' };
      
      // Execute multiple stops concurrently
      const promises = Array.from({ length: 5 }, () => 
        stopTool.execute(args, context)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // stopNavigation should be called for each
      expect(mockControls.stopNavigation).toHaveBeenCalledTimes(5);
      
      logger.info('✅ Concurrent operations validated');
    });

    it('should maintain state consistency across multiple operations', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      // Execute multiple stops in sequence
      for (let i = 0; i < 3; i++) {
        const args = { reason: `stop ${i}` };
        const result = await stopTool.execute(args, context);
        expect(result.success).toBe(true);
      }

      // Check final state
      expect(sessionData.stopHistory?.length).toBe(3);
      expect(sessionData.lastStopAction).toBeDefined();
      
      // Verify history order
      const reasons = sessionData.stopHistory?.map(entry => entry.reason);
      expect(reasons).toEqual(['stop 0', 'stop 1', 'stop 2']);
      
      logger.info('✅ State consistency validated');
    });
  });
});
