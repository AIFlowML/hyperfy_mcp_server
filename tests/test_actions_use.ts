import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { useTool } from '../src/servers/actions/useTool.js';
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
  goto: MockedFunction<(x: number, z: number) => Promise<void>>;
}

interface MockActions {
  performAction: MockedFunction<(entityId: string) => void>;
}

interface MockEntity {
  root?: { position: { x: number; z: number } };
  name?: string;
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

function createMockControls(): MockControls {
  return {
    goto: vi.fn().mockResolvedValue(undefined)
  };
}

function createMockActions(): MockActions {
  return {
    performAction: vi.fn()
  };
}

function createMockEntity(id: string, options: {
  name?: string;
  position?: { x: number; z: number };
} = {}): MockEntity {
  const { name = `Entity ${id}`, position = { x: 10, z: 20 } } = options;
  
  return {
    root: { position },
    name
  };
}

function createMockSessionData(
  hyperfyService: MockHyperfyService | null, 
  controls: MockControls | null,
  actions: MockActions | null,
  options: {
    worldId?: string;
    userId?: string;
    hasUseHistory?: boolean;
    aiExtractor?: (prompt: string) => Promise<{ entityId?: string }>;
  } = {}
): McpSessionData & { 
  lastUseAction?: number; 
  useHistory?: Array<{
    timestamp: number;
    entityId: string;
    action?: string;
    useId: string;
    success: boolean;
    extractionMethod: string;
  }>;
  aiExtractor?: (prompt: string) => Promise<{ entityId?: string }>;
} {
  const { worldId = 'test-world', userId = 'test-user', hasUseHistory = false, aiExtractor } = options;
  
  const sessionData: any = {
    hyperfyService,
    controls,
    actions,
    worldId,
    userId,
    sessionId: 'test-session-123',
    timestamp: Date.now()
  };

  if (aiExtractor) {
    sessionData.aiExtractor = aiExtractor;
  }

  if (hasUseHistory) {
    sessionData.useHistory = [
      {
        timestamp: Date.now() - 10000,
        entityId: 'previous-entity',
        action: 'pick up',
        useId: 'prev-use-123',
        success: true,
        extractionMethod: 'direct'
      }
    ];
    sessionData.lastUseAction = Date.now() - 10000;
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
  USE_TIMEOUT: 2000,
};

describe('Use Tool', () => {
  let mockControls: MockControls;
  let mockActions: MockActions;
  let mockService: MockHyperfyService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockControls = createMockControls();
    mockActions = createMockActions();
    mockService = createMockHyperfyService();
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool name and description', () => {
      expect(useTool.name).toBe('hyperfy_use_item');
      expect(useTool.description).toContain('Navigates to a nearby interactive entity and interacts with it');
      expect(useTool.description).toContain('Examples of use item scenarios');
      
      logger.info('✅ Tool metadata validated');
    });

    it('should have proper parameter schema', () => {
      expect(useTool.parameters).toBeDefined();
      
      // Test parameter validation
      const validParams = { 
        entityId: 'test-entity', 
        action: 'pick up', 
        context: 'test context',
        metadata: { type: 'item' }
      };
      const parseResult = useTool.parameters.safeParse(validParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Parameter schema validated');
    });

    it('should accept optional parameters', () => {
      const emptyParams = {};
      const parseResult = useTool.parameters.safeParse(emptyParams);
      expect(parseResult.success).toBe(true);
      
      logger.info('✅ Optional parameters validated');
    });

    it('should validate parameter types', () => {
      const invalidParams = { 
        entityId: 123, 
        action: null, 
        forceExtraction: 'not-boolean',
        metadata: 'not-object'
      };
      const parseResult = useTool.parameters.safeParse(invalidParams);
      expect(parseResult.success).toBe(false);
      
      logger.info('✅ Parameter type validation confirmed');
    });
  });

  describe('Service and System Validation', () => {
    it('should handle missing Hyperfy service', async () => {
      const sessionData = createMockSessionData(null, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('service_unavailable');
      expect(result.message).toContain('Agent action system unavailable');
      
      logger.info('✅ Missing service handling validated');
    });

    it('should handle disconnected service', async () => {
      const service = createMockHyperfyService({ isConnected: false });
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('not_connected');
      expect(result.message).toContain('Hyperfy not connected');
      
      logger.info('✅ Disconnected service handling validated');
    });

    it('should handle missing world', async () => {
      const service = createMockHyperfyService({ hasWorld: false });
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_unavailable');
      expect(result.message).toContain('Hyperfy world not accessible');
      
      logger.info('✅ Missing world handling validated');
    });

    it('should handle missing controls', async () => {
      const sessionData = createMockSessionData(mockService, null, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('controls_unavailable');
      expect(result.message).toContain('controls unavailable');
      
      logger.info('✅ Missing controls handling validated');
    });

    it('should handle missing actions', async () => {
      const sessionData = createMockSessionData(mockService, mockControls, null);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('actions_unavailable');
      expect(result.message).toContain('actions unavailable');
      
      logger.info('✅ Missing actions handling validated');
    });
  });

  describe('Direct Entity Usage', () => {
    it('should successfully use entity with direct ID', async () => {
      const entityId = 'sword-123';
      const entity = createMockEntity(entityId, { name: 'Magic Sword', position: { x: 50, z: 60 } });
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId, action: 'pick up' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Using item: ${entityId}`);
      expect(mockControls.goto).toHaveBeenCalledWith(50, 60);
      expect(mockActions.performAction).toHaveBeenCalledWith(entityId);
      
      logger.info('✅ Direct entity usage validated');
    });

    it('should handle entity not found', async () => {
      const entityId = 'non-existent-entity';
      const sessionData = createMockSessionData(mockService, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      expect(result.message).toContain(`Could not locate entity ${entityId}`);
      
      logger.info('✅ Entity not found handling validated');
    });

    it('should handle entity without position', async () => {
      const entityId = 'no-position-entity';
      const entity = { name: 'Broken Entity' }; // No root.position
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      expect(result.message).toContain(`Could not locate entity ${entityId}`);
      
      logger.info('✅ Entity without position handling validated');
    });

    it('should use targetId as alternative to entityId', async () => {
      const entityId = 'target-entity';
      const entity = createMockEntity(entityId, { position: { x: 30, z: 40 } });
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { targetId: entityId }; // Using targetId instead of entityId
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(mockActions.performAction).toHaveBeenCalledWith(entityId);
      
      logger.info('✅ targetId alternative validated');
    });
  });

  describe('AI Entity Extraction', () => {
    it('should extract entity using AI when no direct ID provided', async () => {
      const entityId = 'ai-extracted-entity';
      const entity = createMockEntity(entityId, { name: 'AI Found Item', position: { x: 70, z: 80 } });
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const aiExtractor = vi.fn().mockResolvedValue({ entityId });
      const sessionData = createMockSessionData(service, mockControls, mockActions, { aiExtractor });
      const context = createMockToolContext(sessionData);

      const args = { context: 'pick up the glowing orb' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.extractionMethod).toBe('ai_extraction');
      expect(aiExtractor).toHaveBeenCalled();
      expect(mockActions.performAction).toHaveBeenCalledWith(entityId);
      
      logger.info('✅ AI entity extraction validated');
    });

    it('should force AI extraction even with direct entityId', async () => {
      const directEntityId = 'direct-entity';
      const aiEntityId = 'ai-entity';
      const aiEntity = createMockEntity(aiEntityId, { position: { x: 90, z: 100 } });
      
      const world = { entities: { items: new Map([[aiEntityId, aiEntity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const aiExtractor = vi.fn().mockResolvedValue({ entityId: aiEntityId });
      const sessionData = createMockSessionData(service, mockControls, mockActions, { aiExtractor });
      const context = createMockToolContext(sessionData);

      const args = { 
        entityId: directEntityId, 
        forceExtraction: true,
        context: 'use the magic crystal'
      };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.extractionMethod).toBe('ai_extraction');
      expect(mockActions.performAction).toHaveBeenCalledWith(aiEntityId); // Should use AI extracted, not direct
      
      logger.info('✅ Forced AI extraction validated');
    });

    it('should handle AI extraction failure gracefully', async () => {
      const aiExtractor = vi.fn().mockRejectedValue(new Error('AI service unavailable'));
      const sessionData = createMockSessionData(mockService, mockControls, mockActions, { aiExtractor });
      const context = createMockToolContext(sessionData);

      const args = { context: 'pick up something' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_entity_id');
      expect(result.message).toContain('No suitable item found');
      
      logger.info('✅ AI extraction failure handling validated');
    });

    it('should handle AI returning invalid entity ID', async () => {
      const aiExtractor = vi.fn().mockResolvedValue({ entityId: null });
      const sessionData = createMockSessionData(mockService, mockControls, mockActions, { aiExtractor });
      const context = createMockToolContext(sessionData);

      const args = { context: 'find something to use' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_entity_id');
      expect(result.message).toContain('No suitable item found');
      
      logger.info('✅ Invalid AI entity ID handling validated');
    });

    it('should handle AI returning non-existent entity', async () => {
      const nonExistentId = 'ai-hallucinated-entity';
      const aiExtractor = vi.fn().mockResolvedValue({ entityId: nonExistentId });
      const sessionData = createMockSessionData(mockService, mockControls, mockActions, { aiExtractor });
      const context = createMockToolContext(sessionData);

      const args = { context: 'use the phantom item' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      expect(result.message).toContain(`Could not locate entity ${nonExistentId}`);
      
      logger.info('✅ AI non-existent entity handling validated');
    });
  });

  describe('Navigation and Action Execution', () => {
    it('should navigate to entity position before performing action', async () => {
      const entityId = 'navigation-test-entity';
      const position = { x: 123, z: 456 };
      const entity = createMockEntity(entityId, { position });
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId, action: 'activate' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(mockControls.goto).toHaveBeenCalledWith(position.x, position.z);
      expect(mockActions.performAction).toHaveBeenCalledWith(entityId);
      
      // Verify order: navigation before action
      const gotoCall = mockControls.goto.mock.invocationCallOrder[0];
      const actionCall = mockActions.performAction.mock.invocationCallOrder[0];
      expect(gotoCall).toBeLessThan(actionCall);
      
      logger.info('✅ Navigation before action validated');
    });

    it('should handle navigation errors gracefully', async () => {
      const entityId = 'nav-error-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      mockControls.goto.mockRejectedValue(new Error('Navigation failed'));
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('use_item_failed');
      expect(result.message).toContain('Error using item');
      
      logger.info('✅ Navigation error handling validated');
    });

    it('should handle action execution errors gracefully', async () => {
      const entityId = 'action-error-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      mockActions.performAction.mockImplementation(() => {
        throw new Error('Action execution failed');
      });
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('use_item_failed');
      expect(result.message).toContain('Error using item');
      
      logger.info('✅ Action execution error handling validated');
    });
  });

  describe('Session Tracking and History', () => {
    it('should track successful use in session history', async () => {
      const entityId = 'tracked-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId, action: 'pick up' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.lastUseAction).toBeDefined();
      expect(sessionData.useHistory).toBeDefined();
      expect(sessionData.useHistory?.length).toBe(1);
      
      const historyEntry = sessionData.useHistory?.[0];
      expect(historyEntry?.entityId).toBe(entityId);
      expect(historyEntry?.action).toBe('pick up');
      expect(historyEntry?.success).toBe(true);
      expect(historyEntry?.extractionMethod).toBe('direct');
      expect(historyEntry?.useId).toBeDefined();
      
      logger.info('✅ Session tracking validated');
    });

    it('should track failed attempts in history', async () => {
      const entityId = 'failed-entity';
      const sessionData = createMockSessionData(mockService, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId }; // Entity doesn't exist
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(sessionData.useHistory?.length).toBe(1);
      
      const historyEntry = sessionData.useHistory?.[0];
      expect(historyEntry?.entityId).toBe(entityId);
      expect(historyEntry?.success).toBe(false);
      expect(historyEntry?.extractionMethod).toBe('direct');
      
      logger.info('✅ Failed attempt tracking validated');
    });

    it('should maintain existing history and add new entries', async () => {
      const entityId = 'new-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions, { hasUseHistory: true });
      const context = createMockToolContext(sessionData);

      const initialHistoryLength = sessionData.useHistory?.length || 0;
      
      const args = { entityId, action: 'activate' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.useHistory?.length).toBe(initialHistoryLength + 1);
      
      const latestEntry = sessionData.useHistory?.[sessionData.useHistory.length - 1];
      expect(latestEntry?.entityId).toBe(entityId);
      expect(latestEntry?.action).toBe('activate');
      
      logger.info('✅ History maintenance validated');
    });

    it('should limit history to 20 entries', async () => {
      const entityId = 'limit-test-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      // Add 25 entries to test limit
      sessionData.useHistory = Array.from({ length: 25 }, (_, i) => ({
        timestamp: Date.now() - (25 - i) * 1000,
        entityId: `entity-${i}`,
        action: 'use',
        useId: `use-${i}`,
        success: true,
        extractionMethod: 'direct'
      }));

      const args = { entityId, action: 'final use' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(sessionData.useHistory?.length).toBe(20);
      
      // Should keep the most recent entries
      const latestEntry = sessionData.useHistory?.[sessionData.useHistory.length - 1];
      expect(latestEntry?.entityId).toBe(entityId);
      expect(latestEntry?.action).toBe('final use');
      
      logger.info('✅ History limit enforcement validated');
    });
  });

  describe('Response Data Structure', () => {
    it('should return complete success response data', async () => {
      const entityId = 'complete-test-entity';
      const position = { x: 200, z: 300 };
      const entity = createMockEntity(entityId, { position });
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions, {
        worldId: 'test-world-456',
        userId: 'test-user-789'
      });
      const context = createMockToolContext(sessionData);

      const metadata = { type: 'weapon', rarity: 'legendary' };
      const args = { 
        entityId, 
        action: 'equip', 
        context: 'test context',
        metadata
      };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        useId: expect.any(String),
        targetEntityId: entityId,
        action: 'equip',
        extractionMethod: 'direct',
        position: position,
        timestamp: expect.any(String),
        worldId: 'test-world-456',
        userId: 'test-user-789',
        status: 'triggered',
        metadata: metadata,
        actions: ['HYPERFY_USE_ITEM'],
        source: 'hyperfy'
      }));
      
      logger.info('✅ Complete response data structure validated');
    });

    it('should format timestamp correctly', async () => {
      const entityId = 'timestamp-test-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.timestamp).toBeDefined();
      
      // Validate ISO timestamp format
      const timestamp = new Date(result.data?.timestamp as string);
      expect(timestamp.toISOString()).toBe(result.data?.timestamp);
      
      logger.info('✅ Timestamp formatting validated');
    });

    it('should include use ID in response data', async () => {
      const entityId = 'id-test-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.useId).toBeDefined();
      expect(typeof result.data?.useId).toBe('string');
      expect(result.data?.useId.length).toBeGreaterThan(0);
      
      logger.info('✅ Use ID generation validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const entityId = 'logging-test-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { 
        entityId, 
        action: 'logging test',
        context: 'test context',
        forceExtraction: false
      };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_use_item',
        expect.objectContaining({
          directEntityId: entityId,
          action: 'logging test',
          hasContext: true,
          forceExtraction: false
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log navigation details', async () => {
      const entityId = 'nav-logging-entity';
      const position = { x: 111, z: 222 };
      const entity = createMockEntity(entityId, { position });
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Navigating to entity position',
        expect.objectContaining({
          targetEntityId: entityId,
          position: position
        })
      );
      
      logger.info('✅ Navigation logging validated');
    });

    it('should log action execution details', async () => {
      const entityId = 'action-logging-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId, action: 'test action' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(context.log.info).toHaveBeenCalledWith(
        'Performing action on entity',
        expect.objectContaining({
          targetEntityId: entityId,
          action: 'test action',
          extractionMethod: 'direct'
        })
      );
      
      logger.info('✅ Action execution logging validated');
    });

    it('should log errors appropriately', async () => {
      const entityId = 'error-logging-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      mockActions.performAction.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(context.log.error).toHaveBeenCalledWith(
        'Error in HYPERFY_USE_ITEM',
        expect.objectContaining({
          error: 'Test error',
          args
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should complete use operation quickly', async () => {
      const entityId = 'performance-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const startTime = Date.now();
      const args = { entityId };
      const result = await useTool.execute(args, context);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(TEST_CONFIG.USE_TIMEOUT);
      
      logger.info('✅ Performance characteristics validated');
    });

    it('should handle concurrent use attempts gracefully', async () => {
      const entityId = 'concurrent-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      
      // Execute multiple use operations concurrently
      const promises = Array.from({ length: 3 }, () => 
        useTool.execute(args, context)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }
      
      // Actions should be called for each
      expect(mockActions.performAction).toHaveBeenCalledTimes(3);
      
      logger.info('✅ Concurrent operations validated');
    });

    it('should maintain state consistency across multiple operations', async () => {
      const sessionData = createMockSessionData(mockService, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      // Execute multiple use operations in sequence
      for (let i = 0; i < 3; i++) {
        const entityId = `entity-${i}`;
        const entity = createMockEntity(entityId);
        
        const world = { entities: { items: new Map([[entityId, entity]]) } };
        mockService.getWorld.mockReturnValue(world);
        
        const args = { entityId, action: `use ${i}` };
        const result = await useTool.execute(args, context);
        expect(result.success).toBe(true);
      }

      // Check final state
      expect(sessionData.useHistory?.length).toBe(3);
      expect(sessionData.lastUseAction).toBeDefined();
      
      // Verify history order
      const entityIds = sessionData.useHistory?.map(entry => entry.entityId);
      expect(entityIds).toEqual(['entity-0', 'entity-1', 'entity-2']);
      
      logger.info('✅ State consistency validated');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle world with no entities', async () => {
      const world = { entities: { items: new Map() } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const aiExtractor = vi.fn().mockResolvedValue({ entityId: 'non-existent' });
      const sessionData = createMockSessionData(service, mockControls, mockActions, { aiExtractor });
      const context = createMockToolContext(sessionData);

      const args = { context: 'find something to use' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      
      logger.info('✅ Empty world handling validated');
    });

    it('should handle malformed world entities', async () => {
      const world = { entities: { items: 'not-a-map' } }; // Malformed
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'any-entity' };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      
      logger.info('✅ Malformed world handling validated');
    });

    it('should handle very long context strings', async () => {
      const entityId = 'long-context-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const longContext = 'a'.repeat(10000);
      const args = { entityId, context: longContext };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.targetEntityId).toBe(entityId);
      
      logger.info('✅ Long context string handling validated');
    });

    it('should handle complex metadata objects', async () => {
      const entityId = 'metadata-entity';
      const entity = createMockEntity(entityId);
      
      const world = { entities: { items: new Map([[entityId, entity]]) } };
      const service = createMockHyperfyService();
      service.getWorld.mockReturnValue(world);
      
      const sessionData = createMockSessionData(service, mockControls, mockActions);
      const context = createMockToolContext(sessionData);

      const complexMetadata = {
        type: 'weapon',
        stats: { damage: 100, speed: 50 },
        enchantments: ['fire', 'ice'],
        nested: { deep: { value: 'test' } }
      };
      
      const args = { entityId, metadata: complexMetadata };
      const result = await useTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.data?.metadata).toEqual(complexMetadata);
      
      logger.info('✅ Complex metadata handling validated');
    });
  });
});
