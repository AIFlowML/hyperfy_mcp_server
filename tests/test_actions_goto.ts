/**
 * Comprehensive test suite for Goto Tool
 * Tests entity navigation, AI extraction, position validation, session tracking, and error handling
 * Validates the complete navigation functionality for the FastMCP server
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { gotoTool } from '../src/servers/actions/gotoTool.js';
import type { McpSessionData } from '../src/servers/server.js';
import type { LogType } from '../src/types/index.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 15000, // 15 seconds for navigation tests
  MOCK_WORLD_ID: 'test-world-123',
  MOCK_AGENT_ID: 'test-agent-456',
  MOCK_PLAYER_ID: 'test-player-789',
  MOCK_ENTITY_ID: 'test-entity-abc',
};

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Mock entity interface
interface MockEntity {
  base?: { position: { x: number; y: number; z: number } };
  root?: { position: { x: number; y: number; z: number } };
}

// Mock entity factory
function createMockEntity(id: string, options: {
  name?: string;
  position?: { x: number; y: number; z: number };
  hasBasePosition?: boolean;
  hasRootPosition?: boolean;
} = {}): MockEntity {
  const {
    name = `Entity${id}`,
    position = { x: 10, y: 0, z: 10 },
    hasBasePosition = true,
    hasRootPosition = true
  } = options;

  const entity: MockEntity = {};
  
  if (hasBasePosition) {
    entity.base = { position };
  }
  
  if (hasRootPosition && !hasBasePosition) {
    entity.root = { position };
  }

  return entity;
}

// Mock HyperfyService interface
interface MockHyperfyService {
  isConnected: MockedFunction<() => boolean>;
  getWorld: MockedFunction<() => MockWorld | null>;
  getEntityName: MockedFunction<(id: string) => string | null>;
  currentWorldId: string;
}

// Mock World interface
interface MockWorld {
  entities: {
    items: Map<string, MockEntity>;
  };
}

// Mock HyperfyService factory
function createMockHyperfyService(options: {
  isConnected?: boolean;
  worldId?: string;
  entities?: Map<string, MockEntity>;
  entityNames?: Map<string, string>;
  hasWorld?: boolean;
} = {}): MockHyperfyService {
  const {
    isConnected = true,
    worldId = TEST_CONFIG.MOCK_WORLD_ID,
    entities = new Map(),
    entityNames = new Map(),
    hasWorld = true
  } = options;

  const mockWorld: MockWorld | null = hasWorld ? {
    entities: {
      items: entities
    }
  } : null;

  return {
    isConnected: vi.fn().mockReturnValue(isConnected),
    getWorld: vi.fn().mockReturnValue(mockWorld),
    getEntityName: vi.fn().mockImplementation((id: string) => entityNames.get(id) || null),
    currentWorldId: worldId
  };
}

// Mock AgentControls interface
interface MockControls {
  goto: MockedFunction<(x: number, z: number) => void>;
  stop: MockedFunction<() => void>;
  isNavigating: MockedFunction<() => boolean>;
}

// Mock AgentControls factory
function createMockControls(): MockControls {
  return {
    goto: vi.fn(),
    stop: vi.fn(),
    isNavigating: vi.fn().mockReturnValue(false)
  };
}

// Mock session data factory - now properly implements McpSessionData
function createMockSessionData(
  hyperfyService: MockHyperfyService | null, 
  controls: MockControls | null,
  options: {
    worldId?: string;
    userId?: string;
    hasGotoHistory?: boolean;
  } = {}
): McpSessionData & { lastGotoAction?: number; gotoHistory?: Array<{
  timestamp: number;
  entityId: string;
  entityName?: string;
  targetPosition: { x: number; y: number; z: number };
  success: boolean;
  navigationId: string;
}> } {
  const {
    worldId = TEST_CONFIG.MOCK_WORLD_ID,
    userId = TEST_CONFIG.MOCK_AGENT_ID,
    hasGotoHistory = false
  } = options;

  const sessionData = {
    worldId,
    userId,
    playerState: {
      id: TEST_CONFIG.MOCK_PLAYER_ID,
      name: 'TestGotoAgent',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      status: 'active' as const,
      lastActivity: new Date(),
      metadata: {},
    },
    worldState: {
      id: worldId,
      name: 'Test Goto World',
      playerCount: 1,
      entities: [],
      lastUpdate: new Date(),
      metadata: {},
    },
    connectionTime: new Date(),
    lastActivity: new Date(),
    preferences: {},
    // Required properties for McpSessionData
    hyperfyService: hyperfyService as unknown,
    controls: controls as unknown,
    actions: {} as unknown,
  } as McpSessionData & { lastGotoAction?: number; gotoHistory?: Array<{
    timestamp: number;
    entityId: string;
    entityName?: string;
    targetPosition: { x: number; y: number; z: number };
    success: boolean;
    navigationId: string;
  }> };

  if (hasGotoHistory) {
    sessionData.lastGotoAction = Date.now() - 60000; // 1 minute ago
    sessionData.gotoHistory = [
      {
        timestamp: Date.now() - 120000,
        entityId: 'previous-entity',
        entityName: 'Previous Entity',
        targetPosition: { x: 5, y: 0, z: 5 },
        success: true,
        navigationId: 'prev-nav-123'
      }
    ];
  }

  return sessionData;
}

// Mock tool context factory
function createMockToolContext(sessionData: ReturnType<typeof createMockSessionData>) {
  return {
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as LogType,
    session: { data: sessionData },
  };
}

// Type for goto tool result data
interface GotoResultData {
  entityId: string;
  targetName: string | null;
  navigationId: string;
  targetPosition: number[];
  timestamp: string;
  worldId: string;
  userId: string;
  status: string;
  actions: string[];
  source: string;
}

// Type for goto tool result
interface GotoResult {
  success: boolean;
  message?: string;
  data?: GotoResultData;
  error?: string;
}

describe('Goto Tool', () => {
  let mockHyperfyService: ReturnType<typeof createMockHyperfyService>;
  let mockControls: ReturnType<typeof createMockControls>;
  let mockSessionData: ReturnType<typeof createMockSessionData>;
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
    mockHyperfyService = createMockHyperfyService();
    mockControls = createMockControls();
    mockSessionData = createMockSessionData(mockHyperfyService, mockControls);
    mockContext = createMockToolContext(mockSessionData);
    
    logger.info('🎯 Starting Goto Tool test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    logger.info('🧹 Goto Tool test cleanup complete');
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool configuration', () => {
      expect(gotoTool.name).toBe('hyperfy_goto_entity');
      expect(gotoTool.description).toBeDefined();
      expect(gotoTool.description.length).toBeGreaterThan(1000);
      expect(gotoTool.parameters).toBeDefined();
      expect(gotoTool.execute).toBeDefined();
      expect(typeof gotoTool.execute).toBe('function');
      
      logger.info('✅ Tool configuration validated');
    });

    it('should have comprehensive parameter schema', () => {
      const schema = gotoTool.parameters;
      
      // Test valid parameters
      const validParams = [
        {},
        { entityId: 'entity-123' },
        { targetId: 'target-456' },
        { targetDescription: 'the red chair' },
        { extractionContext: 'I want to sit down' },
        { forceExtraction: true },
        { 
          entityId: 'entity-123', 
          targetDescription: 'backup description',
          extractionContext: 'context for AI',
          forceExtraction: false 
        }
      ];
      
      for (const params of validParams) {
        const result = schema.safeParse(params);
        expect(result.success).toBe(true);
      }
      
      logger.info('✅ Parameter schema validated');
    });

    it('should validate parameter constraints', () => {
      const schema = gotoTool.parameters;
      
      // Test invalid parameters
      const invalidParams = [
        { entityId: '' }, // Empty string
        { targetId: '' }, // Empty string
        { forceExtraction: 'yes' }, // Wrong type
      ];
      
      for (const params of invalidParams) {
        const result = schema.safeParse(params);
        expect(result.success).toBe(false);
      }
      
      logger.info('✅ Parameter constraints validated');
    });

    it('should have detailed description with examples', () => {
      const description = gotoTool.description;
      
      // Check for key content sections
      expect(description).toContain('Examples of goto usage');
      expect(description).toContain('Navigation Scenarios');
      expect(description).toContain('Entity Types Supported');
      expect(description).toContain('Conversation Flow Examples');
      expect(description).toContain('Go to Bob');
      expect(description).toContain('Navigate to the chair');
      expect(description).toContain('Interactive Objects');
      expect(description).toContain('NPCs/Characters');
      
      logger.info('✅ Tool description content validated');
    });
  });

  describe('Service and System Validation', () => {
    it('should handle missing HyperfyService gracefully', async () => {
      const sessionData = createMockSessionData(null, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('service_unavailable');
      expect(result.message).toContain('Hyperfy connection unavailable');
      
      expect(context.log.error).toHaveBeenCalledWith(
        'Hyperfy service not found for HYPERFY_GOTO_ENTITY action.'
      );
      
      logger.info('✅ Missing service handling validated');
    });

    it('should handle missing world gracefully', async () => {
      const service = createMockHyperfyService({ hasWorld: false });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_unavailable');
      expect(result.message).toContain('Hyperfy world not accessible');
      
      expect(context.log.error).toHaveBeenCalledWith('Hyperfy world not accessible');
      
      logger.info('✅ Missing world handling validated');
    });

    it('should handle missing controls gracefully', async () => {
      const sessionData = createMockSessionData(mockHyperfyService, null);
      const context = createMockToolContext(sessionData);

      const args = { entityId: 'test-entity' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('controls_unavailable');
      expect(result.message).toContain('Agent controls system unavailable');
      
      expect(context.log.error).toHaveBeenCalledWith('AgentControls system not found');
      
      logger.info('✅ Missing controls handling validated');
    });
  });

  describe('Direct Entity Navigation', () => {
    it('should navigate to entity using entityId parameter', async () => {
      const entityId = 'chair-123';
      const entityName = 'Wooden Chair';
      const position = { x: 15, y: 0, z: 20 };
      
      // Setup entity
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Navigating towards ${entityName}...`);
      expect(result.data?.entityId).toBe(entityId);
      expect(result.data?.targetName).toBe(entityName);
      expect(result.data?.status).toBe('navigation_started');
      
      // Should have called controls.goto
      expect(mockControls.goto).toHaveBeenCalledWith(position.x, position.z);
      
      // Should have logged navigation start
      expect(context.log.info).toHaveBeenCalledWith(
        'Starting navigation via AgentControls',
        expect.objectContaining({
          entityId,
          targetName: entityName,
          position: { x: position.x, z: position.z }
        })
      );
      
      logger.info('✅ Direct entity navigation validated');
    });

    it('should navigate to entity using targetId parameter', async () => {
      const targetId = 'table-456';
      const entityName = 'Oak Table';
      const position = { x: 25, y: 0, z: 30 };
      
      // Setup entity
      const entities = new Map();
      entities.set(targetId, createMockEntity(targetId, { position }));
      const entityNames = new Map();
      entityNames.set(targetId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { targetId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Navigating towards ${entityName}...`);
      expect(result.data?.entityId).toBe(targetId);
      
      // Should have called controls.goto
      expect(mockControls.goto).toHaveBeenCalledWith(position.x, position.z);
      
      logger.info('✅ TargetId navigation validated');
    });

    it('should prioritize entityId over targetId when both provided', async () => {
      const entityId = 'primary-entity';
      const targetId = 'secondary-entity';
      const position = { x: 10, y: 0, z: 10 };
      
      // Setup both entities
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      entities.set(targetId, createMockEntity(targetId, { position: { x: 20, y: 0, z: 20 } }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId, targetId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe(entityId); // Should use entityId, not targetId
      
      // Should navigate to entityId position, not targetId position
      expect(mockControls.goto).toHaveBeenCalledWith(10, 10);
      
      logger.info('✅ Entity ID prioritization validated');
    });

    it('should handle entity without name', async () => {
      const entityId = 'unnamed-entity';
      const position = { x: 5, y: 0, z: 5 };
      
      // Setup entity without name
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Navigating towards entity ${entityId}...`);
      expect(result.data?.targetName).toBeNull();
      
      logger.info('✅ Unnamed entity navigation validated');
    });
  });

  describe('Position Handling', () => {
    it('should use base position when available', async () => {
      const entityId = 'base-entity';
      const basePosition = { x: 100, y: 0, z: 200 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { 
        position: basePosition,
        hasBasePosition: true,
        hasRootPosition: false
      }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(mockControls.goto).toHaveBeenCalledWith(basePosition.x, basePosition.z);
      
      logger.info('✅ Base position handling validated');
    });

    it('should fallback to root position when base not available', async () => {
      const entityId = 'root-entity';
      const rootPosition = { x: 150, y: 0, z: 250 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { 
        position: rootPosition,
        hasBasePosition: false,
        hasRootPosition: true
      }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(mockControls.goto).toHaveBeenCalledWith(rootPosition.x, rootPosition.z);
      
      logger.info('✅ Root position fallback validated');
    });

    it('should handle entity without position data', async () => {
      const entityId = 'no-position-entity';
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { 
        hasBasePosition: false,
        hasRootPosition: false
      }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      expect(result.message).toContain('Could not find location for entity');
      
      // Should not have called navigation
      expect(mockControls.goto).not.toHaveBeenCalled();
      
      logger.info('✅ Missing position handling validated');
    });

    it('should handle non-existent entity', async () => {
      const entityId = 'non-existent-entity';
      
      const service = createMockHyperfyService({ entities: new Map() });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      expect(result.message).toContain('Could not find location for entity');
      expect(result.data?.targetEntityId).toBe(entityId);
      
      logger.info('✅ Non-existent entity handling validated');
    });
  });

  describe('AI-Powered Entity Extraction', () => {
    it('should extract entity using targetDescription', async () => {
      const entityId = 'chair-red';
      const entityName = 'Red Velvet Chair';
      const position = { x: 30, y: 0, z: 40 };
      
      // Setup entity that matches description
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { targetDescription: 'red chair' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe(entityId);
      expect(result.message).toBe(`Navigating towards ${entityName}...`);
      
      expect(context.log.info).toHaveBeenCalledWith(
        'Found matching entity via fallback search',
        expect.objectContaining({
          targetDescription: 'red chair',
          matchedEntityId: entityId,
          matchedName: entityName
        })
      );
      
      logger.info('✅ AI entity extraction via description validated');
    });

    it('should handle extraction with context', async () => {
      const entityId = 'table-dining';
      const entityName = 'Dining Table';
      const position = { x: 50, y: 0, z: 60 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { 
        targetDescription: 'table',
        extractionContext: 'I want to eat dinner and need to find the dining table'
      };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe(entityId);
      
      expect(context.log.info).toHaveBeenCalledWith(
        'Attempting AI-powered entity extraction',
        expect.objectContaining({
          hasDescription: true,
          hasContext: true
        })
      );
      
      logger.info('✅ AI extraction with context validated');
    });

    it('should force extraction even with direct entityId when forceExtraction is true', async () => {
      const directEntityId = 'direct-entity';
      const extractedEntityId = 'extracted-entity';
      const extractedName = 'Extracted Chair';
      const position = { x: 70, y: 0, z: 80 };
      
      // Setup both entities
      const entities = new Map();
      entities.set(directEntityId, createMockEntity(directEntityId, { position: { x: 10, y: 0, z: 10 } }));
      entities.set(extractedEntityId, createMockEntity(extractedEntityId, { position }));
      const entityNames = new Map();
      entityNames.set(extractedEntityId, extractedName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { 
        entityId: directEntityId,
        targetDescription: 'extracted chair',
        forceExtraction: true
      };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe(extractedEntityId); // Should use extracted, not direct
      
      logger.info('✅ Forced extraction validated');
    });

    it('should handle extraction failure gracefully', async () => {
      const service = createMockHyperfyService({ entities: new Map() });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { targetDescription: 'non-existent magical unicorn' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_entity_id');
      expect(result.message).toContain('No target entity ID specified and could not extract');
      
      logger.info('✅ Extraction failure handling validated');
    });

    it('should handle extraction with multiple matching entities', async () => {
      const entities = new Map();
      const entityNames = new Map();
      
      // Add multiple chair entities
      for (let i = 1; i <= 3; i++) {
        const id = `chair-${i}`;
        entities.set(id, createMockEntity(id, { position: { x: i * 10, y: 0, z: i * 10 } }));
        entityNames.set(id, `Chair ${i}`);
      }
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { targetDescription: 'chair' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe('chair-1'); // Should find first match
      
      logger.info('✅ Multiple matching entities handling validated');
    });
  });

  describe('Session Tracking and History', () => {
    it('should track navigation in session history', async () => {
      const entityId = 'tracked-entity';
      const entityName = 'Tracked Entity';
      const position = { x: 90, y: 0, z: 100 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      
      // Check session tracking
      expect(sessionData.lastGotoAction).toBeDefined();
      expect(sessionData.gotoHistory).toBeDefined();
      expect(sessionData.gotoHistory?.length).toBe(1);
      
      const historyEntry = sessionData.gotoHistory?.[0];
      expect(historyEntry?.entityId).toBe(entityId);
      expect(historyEntry?.entityName).toBe(entityName);
      expect(historyEntry?.success).toBe(true);
      expect(historyEntry?.targetPosition).toEqual({
        x: position.x,
        y: position.y,
        z: position.z
      });
      expect(historyEntry?.navigationId).toBeDefined();
      
      logger.info('✅ Session tracking validated');
    });

    it('should maintain existing history and add new entries', async () => {
      const entityId = 'new-entity';
      const position = { x: 110, y: 0, z: 120 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls, { hasGotoHistory: true });
      const context = createMockToolContext(sessionData);

      const initialHistoryLength = sessionData.gotoHistory?.length || 0;

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(sessionData.gotoHistory?.length).toBe(initialHistoryLength + 1);
      
      // Check that old history is preserved
      expect(sessionData.gotoHistory?.[0]?.entityId).toBe('previous-entity');
      expect(sessionData.gotoHistory?.[1]?.entityId).toBe(entityId);
      
      logger.info('✅ History preservation validated');
    });

    it('should limit history to 20 entries', async () => {
      const entities = new Map();
      
      // Create session with 20 existing entries
      const sessionData = createMockSessionData(mockHyperfyService, mockControls);
      sessionData.gotoHistory = Array.from({ length: 20 }, (_, i) => ({
        timestamp: Date.now() - (20 - i) * 1000,
        entityId: `entity-${i}`,
        entityName: `Entity ${i}`,
        targetPosition: { x: i, y: 0, z: i },
        success: true,
        navigationId: `nav-${i}`
      }));
      
      const entityId = 'new-entity-21';
      entities.set(entityId, createMockEntity(entityId, { position: { x: 21, y: 0, z: 21 } }));
      
      const service = createMockHyperfyService({ entities });
      sessionData.hyperfyService = service;
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(sessionData.gotoHistory?.length).toBe(20); // Should still be 20
      
      // Should have removed oldest entry and added new one
      expect(sessionData.gotoHistory?.[0]?.entityId).toBe('entity-1'); // entity-0 removed
      expect(sessionData.gotoHistory?.[19]?.entityId).toBe(entityId); // New entry added
      
      logger.info('✅ History limit validated');
    });

    it('should update lastGotoAction timestamp', async () => {
      const entityId = 'timestamp-entity';
      const position = { x: 130, y: 0, z: 140 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const beforeTime = Date.now();
      
      const args = { entityId };
      await gotoTool.execute(args, context) as GotoResult;
      
      const afterTime = Date.now();

      expect(sessionData.lastGotoAction).toBeGreaterThanOrEqual(beforeTime);
      expect(sessionData.lastGotoAction).toBeLessThanOrEqual(afterTime);
      
      logger.info('✅ Timestamp update validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing entity ID gracefully', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = {}; // No entity ID or description
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_entity_id');
      expect(result.message).toContain('No target entity ID specified');
      
      logger.info('✅ Missing entity ID handling validated');
    });

    it('should handle execution errors gracefully', async () => {
      const entityId = 'error-entity';
      const position = { x: 150, y: 0, z: 160 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      
      const service = createMockHyperfyService({ entities });
      const controls = createMockControls();
      controls.goto.mockImplementation(() => {
        throw new Error('Navigation system failure');
      });
      
      const sessionData = createMockSessionData(service, controls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('navigation_start_failed');
      expect(result.message).toContain('Navigation system failure');
      
      // Should track failed attempt
      expect(sessionData.gotoHistory?.length).toBe(1);
      expect(sessionData.gotoHistory?.[0]?.success).toBe(false);
      
      logger.info('✅ Execution error handling validated');
    });

    it('should handle unknown errors gracefully', async () => {
      const entityId = 'unknown-error-entity';
      
      const service = createMockHyperfyService();
      service.getWorld.mockImplementation(() => {
        throw 'String error'; // Non-Error object
      });
      
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('navigation_start_failed');
      expect(result.message).toBe('Error starting navigation: Unknown error occurred');
      
      logger.info('✅ Unknown error handling validated');
    });

    it('should handle empty entity map', async () => {
      const service = createMockHyperfyService({ entities: new Map() });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { targetDescription: 'any entity' };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_entity_id');
      
      logger.info('✅ Empty entity map handling validated');
    });

    it('should handle malformed entity data', async () => {
      const entityId = 'malformed-entity';
      
      const entities = new Map();
      entities.set(entityId, { /* malformed entity without position */ });
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('entity_not_found');
      
      logger.info('✅ Malformed entity data handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const entityId = 'log-entity';
      const position = { x: 170, y: 0, z: 180 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { 
        entityId,
        targetDescription: 'backup description',
        extractionContext: 'some context',
        forceExtraction: false
      };
      
      await gotoTool.execute(args, context) as GotoResult;

      expect(context.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_goto_entity',
        expect.objectContaining({
          hasDirectEntityId: true,
          hasTargetId: false,
          hasDescription: true,
          hasContext: true,
          forceExtraction: false
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log successful navigation with details', async () => {
      const entityId = 'success-log-entity';
      const entityName = 'Success Entity';
      const position = { x: 190, y: 0, z: 200 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      await gotoTool.execute(args, context) as GotoResult;

      expect(context.log.info).toHaveBeenCalledWith(
        'Navigation started successfully',
        expect.objectContaining({
          entityId,
          targetName: entityName,
          navigationId: expect.any(String),
          responseMessage: `Navigating towards ${entityName}...`
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log error details', async () => {
      const entityId = 'error-log-entity';
      
      const service = createMockHyperfyService({ entities: new Map() });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      await gotoTool.execute(args, context) as GotoResult;

      expect(context.log.error).toHaveBeenCalledWith(
        'Entity position not found',
        expect.objectContaining({
          entityId,
          targetName: null
        })
      );
      
      logger.info('✅ Error logging validated');
    });
  });

  describe('Response Data Structure', () => {
    it('should return complete response data structure', async () => {
      const entityId = 'complete-entity';
      const entityName = 'Complete Entity';
      const position = { x: 210, y: 5, z: 220 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Navigating towards ${entityName}...`);
      
      const data = result.data;
      expect(data?.entityId).toBe(entityId);
      expect(data?.targetName).toBe(entityName);
      expect(data?.navigationId).toBeDefined();
      expect(data?.targetPosition).toEqual([position.x, position.y, position.z]);
      expect(data?.timestamp).toBeDefined();
      expect(data?.worldId).toBe(sessionData.worldId);
      expect(data?.userId).toBe(sessionData.userId);
      expect(data?.status).toBe('navigation_started');
      expect(data?.actions).toEqual(['HYPERFY_GOTO_ENTITY']);
      expect(data?.source).toBe('hyperfy');
      
      logger.info('✅ Complete response data structure validated');
    });

    it('should handle response data without entity name', async () => {
      const entityId = 'unnamed-response-entity';
      const position = { x: 230, y: 0, z: 240 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      
      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const args = { entityId };
      const result = await gotoTool.execute(args, context) as GotoResult;

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Navigating towards entity ${entityId}...`);
      expect(result.data?.targetName).toBeNull();
      
      logger.info('✅ Response without entity name validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should handle complex navigation scenarios', async () => {
      // Setup complex world with multiple entities
      const entities = new Map();
      const entityNames = new Map();
      
      for (let i = 1; i <= 10; i++) {
        const id = `complex-entity-${i}`;
        entities.set(id, createMockEntity(id, { 
          position: { x: i * 20, y: 0, z: i * 30 }
        }));
        entityNames.set(id, `Complex Entity ${i}`);
      }
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls, { hasGotoHistory: true });
      const context = createMockToolContext(sessionData);

      // Test multiple navigation attempts
      for (let i = 1; i <= 3; i++) {
        const args = { entityId: `complex-entity-${i}` };
        const result = await gotoTool.execute(args, context) as GotoResult;
        
        expect(result.success).toBe(true);
        expect(mockControls.goto).toHaveBeenCalledWith(i * 20, i * 30);
      }
      
      // Check session history accumulation
      expect(sessionData.gotoHistory?.length).toBe(4); // 1 initial + 3 new
      
      logger.info('✅ Complex navigation scenarios validated');
    });

    it('should be performant with large entity sets', async () => {
      // Create large entity set
      const entities = new Map();
      const entityNames = new Map();
      
      for (let i = 0; i < 100; i++) {
        const id = `perf-entity-${i}`;
        entities.set(id, createMockEntity(id, { 
          position: { x: i, y: 0, z: i }
        }));
        entityNames.set(id, `Performance Entity ${i}`);
      }
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      const startTime = Date.now();
      const args = { targetDescription: 'performance entity 50' };
      const result = await gotoTool.execute(args, context) as GotoResult;
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      
      logger.info('✅ Performance validation completed', { 
        executionTime, 
        entityCount: 100 
      });
    });

    it('should maintain data consistency across multiple calls', async () => {
      const entityId = 'consistent-entity';
      const entityName = 'Consistent Entity';
      const position = { x: 250, y: 0, z: 260 };
      
      const entities = new Map();
      entities.set(entityId, createMockEntity(entityId, { position }));
      const entityNames = new Map();
      entityNames.set(entityId, entityName);
      
      const service = createMockHyperfyService({ entities, entityNames });
      const sessionData = createMockSessionData(service, mockControls);
      const context = createMockToolContext(sessionData);

      // Execute multiple times
      const results = await Promise.all([
        gotoTool.execute({ entityId }, context) as GotoResult,
        gotoTool.execute({ targetId: entityId }, context) as GotoResult,
        gotoTool.execute({ targetDescription: 'consistent entity' }, context) as GotoResult
      ]);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All should navigate to same entity
      for (const result of results) {
        expect(result.data?.entityId).toBe(entityId);
        expect(result.data?.targetName).toBe(entityName);
      }
      
      // Should have called controls.goto multiple times
      expect(mockControls.goto).toHaveBeenCalledTimes(3);
      
      logger.info('✅ Data consistency validated');
    });
  });
});
