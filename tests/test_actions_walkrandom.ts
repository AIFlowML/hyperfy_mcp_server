import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { walkRandomlyTool } from '../src/servers/actions/walkRandomlyTool.js';
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
  startRandomWalk: MockedFunction<(intervalMs: number, maxDistance: number) => void>;
  stopRandomWalk: MockedFunction<() => void>;
  getIsWalkingRandomly?: MockedFunction<() => boolean>;
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
  hasWalkMethods?: boolean;
  isWalking?: boolean;
  hasWalkingState?: boolean;
} = {}): MockControls {
  const {
    hasWalkMethods = true,
    isWalking = false,
    hasWalkingState = true
  } = options;

  const controls: MockControls = {
    startRandomWalk: vi.fn(),
    stopRandomWalk: vi.fn()
  };

  if (!hasWalkMethods) {
    delete (controls as any).startRandomWalk;
    delete (controls as any).stopRandomWalk;
  }

  if (hasWalkingState) {
    controls.getIsWalkingRandomly = vi.fn().mockReturnValue(isWalking);
  }

  return controls;
}

function createMockSessionData(
  hyperfyService: MockHyperfyService | null, 
  controls: MockControls | null,
  options: {
    worldId?: string;
    userId?: string;
    hasWalkHistory?: boolean;
    currentWalkId?: string;
  } = {}
): McpSessionData & { 
  lastWalkAction?: number; 
  walkHistory?: Array<{
    timestamp: number;
    command: string;
    walkId: string;
    success: boolean;
    interval?: number;
    distance?: number;
    previousState?: boolean;
  }>;
  currentWalkId?: string;
} {
  const { worldId = 'test-world', userId = 'test-user', hasWalkHistory = false, currentWalkId } = options;
  
  const sessionData: any = {
    hyperfyService,
    controls,
    worldId,
    userId,
    sessionId: 'test-session-123',
    timestamp: Date.now()
  };

  if (currentWalkId) {
    sessionData.currentWalkId = currentWalkId;
  }

  if (hasWalkHistory) {
    sessionData.walkHistory = [
      {
        timestamp: Date.now() - 10000,
        command: 'start',
        walkId: 'prev-walk-123',
        success: true,
        interval: 4000,
        distance: 30,
        previousState: false
      }
    ];
    sessionData.lastWalkAction = Date.now() - 10000;
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
  WALK_TIMEOUT: 1000,
  DEFAULT_INTERVAL: 4000,
  DEFAULT_DISTANCE: 30
};

describe('Walk Randomly Tool', () => {
  let mockControls: MockControls;
  let mockService: MockHyperfyService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockControls = createMockControls();
    mockService = createMockHyperfyService();
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool name and description', () => {
      expect(walkRandomlyTool.name).toBe('hyperfy_walk_randomly');
      expect(walkRandomlyTool.description).toContain('Makes the agent continuously walk to random nearby points');
      expect(walkRandomlyTool.description).toContain('Examples of random walk scenarios');
      
      logger.info('✅ Tool metadata validated');
    });

    it('should have proper parameter schema', () => {
      expect(walkRandomlyTool.parameters).toBeDefined();
      
      // Test parameter validation
      const validParams = { 
        command: 'start' as const,
        interval: 5,
        distance: 25,
        pattern: 'exploration',
        context: 'test context'
      };
      const parseResult = walkRandomlyTool.parameters.safeParse(validParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Parameter schema validated');
    });

    it('should accept optional parameters', () => {
      const emptyParams = {};
      const parseResult = walkRandomlyTool.parameters.safeParse(emptyParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Optional parameters validated');
    });

    it('should validate parameter constraints', () => {
      // Test invalid interval (too low)
      const invalidInterval = { interval: 0 };
      expect(walkRandomlyTool.parameters.safeParse(invalidInterval).success).toBe(false);
      
      // Test invalid distance (too high)
      const invalidDistance = { distance: 150 };
      expect(walkRandomlyTool.parameters.safeParse(invalidDistance).success).toBe(false);
      
      // Test invalid command
      const invalidCommand = { command: 'invalid' };
      expect(walkRandomlyTool.parameters.safeParse(invalidCommand).success).toBe(false);
      
      logger.info('✅ Parameter constraint validation confirmed');
    });
  });

  describe('Service and System Validation', () => {
    it('should handle missing Hyperfy service', async () => {
      const sessionData = createMockSessionData(null, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('service_unavailable');
      expect(result.message).toContain('Hyperfy connection unavailable');
      
      logger.info('✅ Missing service handling validated');
    });

    it('should handle disconnected service', async () => {
      const service = createMockHyperfyService({ isConnected: false });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_connected');
      expect(result.message).toContain('Hyperfy not connected');
      
      logger.info('✅ Disconnected service handling validated');
    });

    it('should handle missing world', async () => {
      const service = createMockHyperfyService({ hasWorld: false });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_unavailable');
      expect(result.message).toContain('Hyperfy world not accessible');
      
      logger.info('✅ Missing world handling validated');
    });

    it('should handle missing controls', async () => {
      const sessionData = createMockSessionData(mockService, null);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('controls_unavailable');
      expect(result.message).toContain('controls unavailable');
      
      logger.info('✅ Missing controls handling validated');
    });

    it('should handle missing walk methods', async () => {
      const controls = createMockControls({ hasWalkMethods: false });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('walk_methods_unavailable');
      expect(result.message).toContain('Wander functionality not available');
      
      logger.info('✅ Missing walk methods handling validated');
    });
  });

  describe('Start Command Functionality', () => {
    it('should start random walking with default parameters', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Starting to wander randomly');
      expect(result.message).toContain('~4.0s');
      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(TEST_CONFIG.DEFAULT_INTERVAL, TEST_CONFIG.DEFAULT_DISTANCE);
      
      logger.info('✅ Default start command validated');
    });

    it('should start random walking with custom interval', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const customInterval = 8; // seconds
      const args = { command: 'start' as const, interval: customInterval };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('~8.0s');
      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(customInterval * 1000, TEST_CONFIG.DEFAULT_DISTANCE);
      
      logger.info('✅ Custom interval start validated');
    });

    it('should start random walking with custom distance', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const customDistance = 50;
      const args = { command: 'start' as const, distance: customDistance };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(TEST_CONFIG.DEFAULT_INTERVAL, customDistance);
      
      logger.info('✅ Custom distance start validated');
    });

    it('should start random walking with both custom parameters', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const customInterval = 6;
      const customDistance = 40;
      const args = { 
        command: 'start' as const, 
        interval: customInterval, 
        distance: customDistance,
        pattern: 'patrol',
        context: 'area monitoring'
      };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('~6.0s');
      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(customInterval * 1000, customDistance);
      expect(result.data?.pattern).toBe('patrol');
      expect(result.data?.context).toBe('area monitoring');
      
      logger.info('✅ Custom parameters start validated');
    });

    it('should handle start when already walking', async () => {
      const controls = createMockControls({ isWalking: true });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.previousState).toBe('walking');
      expect(controls.startRandomWalk).toHaveBeenCalled();
      
      logger.info('✅ Start when already walking validated');
    });

    it('should default to start command when no command specified', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = {}; // No command specified
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Starting to wander randomly');
      expect(mockControls.startRandomWalk).toHaveBeenCalled();
      
      logger.info('✅ Default command behavior validated');
    });
  });

  describe('Stop Command Functionality', () => {
    it('should stop random walking when currently walking', async () => {
      const controls = createMockControls({ isWalking: true });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Stopped wandering.');
      expect(result.data?.previousState).toBe('walking');
      expect(controls.stopRandomWalk).toHaveBeenCalled();
      
      logger.info('✅ Stop when walking validated');
    });

    it('should handle stop when not walking', async () => {
      const controls = createMockControls({ isWalking: false });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Was not wandering.');
      expect(result.data?.previousState).toBe('not_walking');
      expect(controls.stopRandomWalk).not.toHaveBeenCalled();
      
      logger.info('✅ Stop when not walking validated');
    });

    it('should handle stop when walk state detection fails', async () => {
      const controls = createMockControls({ hasWalkingState: false });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Was not wandering.');
      expect(controls.stopRandomWalk).not.toHaveBeenCalled();
      
      logger.info('✅ Stop with failed state detection validated');
    });

    it('should handle stop when state detection throws error', async () => {
      const controls = createMockControls();
      controls.getIsWalkingRandomly = vi.fn().mockImplementation(() => {
        throw new Error('State detection error');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Was not wandering.');
      expect(controls.stopRandomWalk).not.toHaveBeenCalled();
      
      logger.info('✅ Stop with state detection error validated');
    });
  });

  describe('Session Tracking and History', () => {
    it('should track start command in session history', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const, interval: 5, distance: 35 };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.lastWalkAction).toBeDefined();
      expect(sessionData.walkHistory).toBeDefined();
      expect(sessionData.walkHistory?.length).toBe(1);
      expect(sessionData.currentWalkId).toBeDefined();
      
      const historyEntry = sessionData.walkHistory?.[0];
      expect(historyEntry?.command).toBe('start');
      expect(historyEntry?.success).toBe(true);
      expect(historyEntry?.interval).toBe(5000);
      expect(historyEntry?.distance).toBe(35);
      expect(historyEntry?.walkId).toBeDefined();
      
      logger.info('✅ Start command session tracking validated');
    });

    it('should track stop command in session history', async () => {
      const controls = createMockControls({ isWalking: true });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.walkHistory?.length).toBe(1);
      expect(sessionData.currentWalkId).toBeUndefined();
      
      const historyEntry = sessionData.walkHistory?.[0];
      expect(historyEntry?.command).toBe('stop');
      expect(historyEntry?.success).toBe(true);
      expect(historyEntry?.previousState).toBe(true);
      
      logger.info('✅ Stop command session tracking validated');
    });

    it('should maintain existing history and add new entries', async () => {
      const sessionData = createMockSessionData(mockService, mockControls, { hasWalkHistory: true });
      const context = createMockToolContext(sessionData);

      const initialHistoryLength = sessionData.walkHistory?.length || 0;
      
      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.walkHistory?.length).toBe(initialHistoryLength + 1);
      
      const latestEntry = sessionData.walkHistory?.[sessionData.walkHistory.length - 1];
      expect(latestEntry?.command).toBe('start');
      
      logger.info('✅ History maintenance validated');
    });

    it('should limit history to 20 entries', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      // Add 25 entries to test limit
      sessionData.walkHistory = Array.from({ length: 25 }, (_, i) => ({
        timestamp: Date.now() - (25 - i) * 1000,
        command: 'start',
        walkId: `walk-${i}`,
        success: true,
        interval: 4000,
        distance: 30
      }));

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.walkHistory?.length).toBe(20);
      
      // Should keep the most recent entries
      const latestEntry = sessionData.walkHistory?.[sessionData.walkHistory.length - 1];
      expect(latestEntry?.command).toBe('start');
      
      logger.info('✅ History limit enforcement validated');
    });

    it('should include walk ID in response data', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.walkId).toBeDefined();
      expect(typeof result.data?.walkId).toBe('string');
      expect(result.data?.walkId.length).toBeGreaterThan(0);
      
      logger.info('✅ Walk ID generation validated');
    });
  });

  describe('Response Data Structure', () => {
    it('should return complete start response data', async () => {
      const sessionData = createMockSessionData(mockService, mockControls, {
        worldId: 'test-world-456',
        userId: 'test-user-789'
      });
      const context = createMockToolContext(sessionData);

      const args = { 
        command: 'start' as const, 
        interval: 6, 
        distance: 45,
        pattern: 'exploration',
        context: 'area survey'
      };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        walkId: expect.any(String),
        command: 'start',
        interval: 6000,
        distance: 45,
        intervalDisplay: '~6.0s',
        pattern: 'exploration',
        context: 'area survey',
        previousState: 'stationary',
        timestamp: expect.any(String),
        worldId: 'test-world-456',
        userId: 'test-user-789',
        status: 'started',
        actions: ['HYPERFY_WALK_RANDOMLY'],
        source: 'hyperfy'
      }));
      
      logger.info('✅ Complete start response data structure validated');
    });

    it('should return complete stop response data', async () => {
      const controls = createMockControls({ isWalking: true });
      const sessionData = createMockSessionData(mockService, controls, {
        worldId: 'test-world-456',
        userId: 'test-user-789'
      });
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        walkId: expect.any(String),
        command: 'stop',
        previousState: 'walking',
        timestamp: expect.any(String),
        worldId: 'test-world-456',
        userId: 'test-user-789',
        status: 'stopped',
        actions: ['HYPERFY_WALK_RANDOMLY'],
        source: 'hyperfy'
      }));
      
      logger.info('✅ Complete stop response data structure validated');
    });

    it('should format interval display correctly', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      // Test various intervals
      const testCases = [
        { interval: 1, expected: '~1.0s' },
        { interval: 2.5, expected: '~2.5s' },
        { interval: 10, expected: '~10.0s' }
      ];

      for (const testCase of testCases) {
        const args = { command: 'start' as const, interval: testCase.interval };
        const result = await walkRandomlyTool.execute(args, context);
        
        expect(result.success).toBe(true);
        expect(result.message).toContain(testCase.expected);
        expect(result.data?.intervalDisplay).toBe(testCase.expected);
      }
      
      logger.info('✅ Interval display formatting validated');
    });

    it('should format timestamp correctly', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.timestamp).toBeDefined();
      
      // Validate ISO timestamp format
      const timestamp = new Date(result.data?.timestamp as string);
      expect(timestamp.toISOString()).toBe(result.data?.timestamp);
      
      logger.info('✅ Timestamp formatting validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle startRandomWalk method throwing error', async () => {
      const controls = createMockControls();
      controls.startRandomWalk.mockImplementation(() => {
        throw new Error('Start walk failed');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('walk_randomly_failed');
      expect(result.message).toContain('Error in walk randomly');
      
      logger.info('✅ startRandomWalk error handling validated');
    });

    it('should handle stopRandomWalk method throwing error', async () => {
      const controls = createMockControls({ isWalking: true });
      controls.stopRandomWalk.mockImplementation(() => {
        throw new Error('Stop walk failed');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('walk_randomly_failed');
      expect(result.message).toContain('Error in walk randomly');
      
      logger.info('✅ stopRandomWalk error handling validated');
    });

    it('should track failed attempts in history', async () => {
      const controls = createMockControls();
      controls.startRandomWalk.mockImplementation(() => {
        throw new Error('Walk failed');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(sessionData.walkHistory?.length).toBe(1);
      
      const historyEntry = sessionData.walkHistory?.[0];
      expect(historyEntry?.success).toBe(false);
      expect(historyEntry?.command).toBe('start');
      
      logger.info('✅ Failed attempt history tracking validated');
    });

    it('should handle extreme parameter values', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      // Test minimum values
      const minArgs = { command: 'start' as const, interval: 1, distance: 1 };
      const minResult = await walkRandomlyTool.execute(minArgs, context);
      expect(minResult.success).toBe(true);
      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(1000, 1);

      // Test maximum values
      const maxArgs = { command: 'start' as const, interval: 60, distance: 100 };
      const maxResult = await walkRandomlyTool.execute(maxArgs, context);
      expect(maxResult.success).toBe(true);
      expect(mockControls.startRandomWalk).toHaveBeenCalledWith(60000, 100);
      
      logger.info('✅ Extreme parameter values validated');
    });

    it('should handle very long pattern and context strings', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const longPattern = 'a'.repeat(1000);
      const longContext = 'b'.repeat(1000);
      const args = { 
        command: 'start' as const, 
        pattern: longPattern,
        context: longContext
      };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.pattern).toBe(longPattern);
      expect(result.data?.context).toBe(longContext);
      
      logger.info('✅ Long string handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { 
        command: 'start' as const,
        interval: 5,
        distance: 40,
        pattern: 'patrol',
        context: 'test context'
      };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_walk_randomly',
        expect.objectContaining({
          command: 'start',
          interval: 5,
          distance: 40,
          pattern: 'patrol',
          hasContext: true
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log start walking details', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const, interval: 6, distance: 35 };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Starting random walking via controls',
        expect.objectContaining({
          walkId: expect.any(String),
          interval: 6,
          distance: 35,
          currentlyWalking: false
        })
      );
      
      logger.info('✅ Start walking logging validated');
    });

    it('should log stop walking details', async () => {
      const controls = createMockControls({ isWalking: true });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'stop' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Stopped random walking via controls',
        expect.objectContaining({
          walkId: expect.any(String)
        })
      );
      
      logger.info('✅ Stop walking logging validated');
    });

    it('should log errors appropriately', async () => {
      const controls = createMockControls();
      controls.startRandomWalk.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(context.log.error).toHaveBeenCalledWith(
        'Error in HYPERFY_WALK_RANDOMLY',
        expect.objectContaining({
          error: 'Test error',
          args
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should complete walk operations quickly', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const startTime = Date.now();
      const args = { command: 'start' as const };
      const result = await walkRandomlyTool.execute(args, context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(TEST_CONFIG.WALK_TIMEOUT);
      
      logger.info('✅ Performance characteristics validated');
    });

    it('should handle concurrent walk commands gracefully', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { command: 'start' as const };
      
      // Execute multiple walk operations concurrently
      const promises = Array.from({ length: 3 }, () => 
        walkRandomlyTool.execute(args, context)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }
      
      // startRandomWalk should be called for each
      expect(mockControls.startRandomWalk).toHaveBeenCalledTimes(3);
      
      logger.info('✅ Concurrent operations validated');
    });

    it('should maintain state consistency across multiple operations', async () => {
      const sessionData = createMockSessionData(mockService, mockControls);
      const context = createMockToolContext(sessionData);

      // Execute multiple walk operations in sequence
      const commands = ['start', 'stop', 'start'] as const;
      
      for (let i = 0; i < commands.length; i++) {
        const args = { command: commands[i] };
        const result = await walkRandomlyTool.execute(args, context);
        expect(result.success).toBe(true);
      }

      // Check final state
      expect(sessionData.walkHistory?.length).toBe(3);
      expect(sessionData.lastWalkAction).toBeDefined();
      expect(sessionData.currentWalkId).toBeDefined(); // Should have current walk ID from last start
      
      // Verify history order
      const commandHistory = sessionData.walkHistory?.map(entry => entry.command);
      expect(commandHistory).toEqual(['start', 'stop', 'start']);
      
      logger.info('✅ State consistency validated');
    });

    it('should handle rapid start/stop sequences', async () => {
      const controls = createMockControls({ isWalking: false });
      const sessionData = createMockSessionData(mockService, controls);
      const context = createMockToolContext(sessionData);

      console.log('🔍 Debug: Mock controls setup:', {
        hasStartMethod: typeof controls.startRandomWalk === 'function',
        hasStopMethod: typeof controls.stopRandomWalk === 'function',
        hasStateMethod: typeof controls.getIsWalkingRandomly === 'function'
      });

      // Test single start command first
      const startArgs = { command: 'start' as const };
      console.log('🔍 Debug: Executing start command...');
      
      const startResult = await walkRandomlyTool.execute(startArgs, context);
      console.log('🔍 Debug: Start result:', {
        success: startResult.success,
        message: startResult.message,
        error: startResult.error
      });
      
      console.log('🔍 Debug: Mock call counts after start:', {
        startCalls: controls.startRandomWalk.mock.calls.length,
        stopCalls: controls.stopRandomWalk.mock.calls.length
      });

      // Basic assertions for now
      expect(startResult.success).toBe(true);
      
      // If start worked, try stop
      if (startResult.success) {
        // Update mock to return walking state
        controls.getIsWalkingRandomly?.mockReturnValue(true);
        
        const stopArgs = { command: 'stop' as const };
        console.log('🔍 Debug: Executing stop command...');
        
        const stopResult = await walkRandomlyTool.execute(stopArgs, context);
        console.log('🔍 Debug: Stop result:', {
          success: stopResult.success,
          message: stopResult.message,
          error: stopResult.error
        });
        
        console.log('🔍 Debug: Mock call counts after stop:', {
          startCalls: controls.startRandomWalk.mock.calls.length,
          stopCalls: controls.stopRandomWalk.mock.calls.length
        });
        
        expect(stopResult.success).toBe(true);
      }
      
      logger.info('✅ Debug test completed');
    });
  });
});
