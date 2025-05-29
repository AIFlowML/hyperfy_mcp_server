/**
 * Comprehensive test suite for Get World State Tool
 * Tests world state retrieval, entity processing, action detection, format options, and error handling
 * Validates the complete world state functionality for the FastMCP server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWorldStateTool } from '../src/servers/actions/getWorldStateTool.js';
import type { McpSessionData } from '../src/servers/server.js';
import { createLogger } from '../src/utils/eliza-compat.js';
import { EMOTES_LIST } from '../src/servers/config/constants.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 15000, // 15 seconds for world state tests
  DEFAULT_ACTION_RADIUS: 50,
  MOCK_WORLD_ID: 'test-world-123',
  MOCK_AGENT_ID: 'test-agent-456',
  MOCK_PLAYER_ID: 'test-player-789',
};

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Type for world state response data
interface WorldStateResponseData {
  status?: string;
  worldId?: string;
  timestamp?: string;
  agent?: {
    id: string;
    entities: unknown;
  };
  entities?: Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number; z: number } | null;
  }>;
  nearbyActions?: Array<{
    entityId: string;
    entityName: string;
    action: string;
    position: { x: number; y: number; z: number } | null;
  }>;
  currentEquipment?: {
    action: string;
    entityId: string;
    entityName: string;
  } | null;
  chatHistory?: string[];
  availableEmotes?: Array<{ name: string; description: string }>;
  summary?: {
    totalEntities: number;
    nearbyActions: number;
    hasEquipment: boolean;
    connectionStatus: string;
  };
  formatted_text?: string;
  message?: string;
}

// Mock entity factory
function createMockEntity(id: string, options: {
  name?: string;
  type?: string;
  position?: { x: number; y: number; z: number };
  blueprintName?: string;
} = {}) {
  const {
    name = `Entity${id}`,
    type = 'object',
    position = { x: 0, y: 0, z: 0 },
    blueprintName
  } = options;

  return {
    data: {
      id,
      name: blueprintName ? undefined : name, // Don't set data.name if blueprint name is provided
      type
    },
    blueprint: blueprintName ? { name: blueprintName } : undefined,
    base: { position },
    root: { position }
  };
}

// Mock action node factory
function createMockActionNode(id: string, options: {
  label?: string;
  entityId?: string;
  entityName?: string;
  position?: { x: number; y: number; z: number };
  finished?: boolean;
} = {}) {
  const {
    label = `Action${id}`,
    entityId = `entity-${id}`,
    entityName = `Entity${id}`,
    position = { x: 10, y: 0, z: 10 },
    finished = false
  } = options;

  return {
    _label: label,
    finished,
    ctx: {
      entity: {
        data: { id: entityId },
        blueprint: { name: entityName },
        root: { position }
      }
    }
  };
}

// Mock HyperfyService factory
function createMockHyperfyService(options: {
  isConnected?: boolean;
  worldId?: string;
  entities?: Map<string, unknown>;
  actions?: unknown[];
  currentAction?: unknown;
  messageManager?: unknown;
} = {}) {
  const {
    isConnected = true,
    worldId = TEST_CONFIG.MOCK_WORLD_ID,
    entities = new Map(),
    actions = [],
    currentAction = null,
    messageManager = null
  } = options;

  const mockWorld = {
    entities: {
      items: entities,
      player: {
        data: {
          id: TEST_CONFIG.MOCK_PLAYER_ID
        }
      }
    },
    actions: {
      getNearby: vi.fn().mockReturnValue(actions),
      getCurrentNode: vi.fn().mockReturnValue(currentAction)
    }
  };

  const mockMessageManager = messageManager || {
    getRecentMessages: vi.fn().mockResolvedValue('Mock chat history')
  };

  return {
    isConnected: vi.fn().mockReturnValue(isConnected),
    getWorld: vi.fn().mockReturnValue(mockWorld),
    getMessageManager: vi.fn().mockReturnValue(mockMessageManager),
    currentWorldId: worldId
  };
}

// Mock session data factory
function createMockSessionData(hyperfyService: unknown): McpSessionData {
  return {
    worldId: TEST_CONFIG.MOCK_WORLD_ID,
    userId: TEST_CONFIG.MOCK_AGENT_ID,
    playerState: {
      id: TEST_CONFIG.MOCK_PLAYER_ID,
      name: 'TestWorldAgent',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      status: 'active',
      lastActivity: new Date(),
      metadata: {},
    },
    worldState: {
      id: TEST_CONFIG.MOCK_WORLD_ID,
      name: 'Test World State World',
      playerCount: 3,
      entities: [],
      lastUpdate: new Date(),
      metadata: {},
    },
    connectionTime: new Date(),
    lastActivity: new Date(),
    preferences: {},
    hyperfyService: hyperfyService as McpSessionData['hyperfyService'],
    controls: {} as unknown as McpSessionData['controls'],
    actions: {} as unknown as McpSessionData['actions'],
  };
}

// Mock tool context factory
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

describe('Get World State Tool', () => {
  let mockHyperfyService: ReturnType<typeof createMockHyperfyService>;
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
    mockHyperfyService = createMockHyperfyService();
    mockSessionData = createMockSessionData(mockHyperfyService);
    mockContext = createMockToolContext(mockSessionData);
    
    logger.info('🌍 Starting Get World State Tool test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    logger.info('🧹 Get World State Tool test cleanup complete');
  });

  describe('Tool Configuration and Metadata', () => {
    it('should have correct tool configuration', () => {
      expect(getWorldStateTool.name).toBe('hyperfy_get_world_state');
      expect(getWorldStateTool.description).toBeDefined();
      expect(getWorldStateTool.description.length).toBeGreaterThan(500);
      expect(getWorldStateTool.parameters).toBeDefined();
      expect(getWorldStateTool.execute).toBeDefined();
      expect(typeof getWorldStateTool.execute).toBe('function');
      
      logger.info('✅ Tool configuration validated');
    });

    it('should have comprehensive parameter schema', () => {
      const schema = getWorldStateTool.parameters;
      
      // Test valid parameters
      const validParams = [
        {},
        { includeChat: true },
        { includeEmotes: false },
        { actionRadius: 25 },
        { format: 'structured' },
        { format: 'text' },
        { format: 'both' },
        { includeChat: true, includeEmotes: true, actionRadius: 100, format: 'both' }
      ];
      
      for (const params of validParams) {
        const result = schema.safeParse(params);
        expect(result.success).toBe(true);
      }
      
      logger.info('✅ Parameter schema validated');
    });

    it('should validate parameter constraints', () => {
      const schema = getWorldStateTool.parameters;
      
      // Test invalid format
      const invalidFormat = schema.safeParse({ format: 'invalid' });
      expect(invalidFormat.success).toBe(false);
      
      // Test invalid types
      const invalidTypes = [
        { includeChat: 'yes' },
        { includeEmotes: 'no' },
        { actionRadius: 'fifty' }
      ];
      
      for (const params of invalidTypes) {
        const result = schema.safeParse(params);
        expect(result.success).toBe(false);
      }
      
      logger.info('✅ Parameter constraints validated');
    });

    it('should have detailed description with use cases', () => {
      const description = getWorldStateTool.description;
      
      // Check for key content sections
      expect(description).toContain('Agent Information');
      expect(description).toContain('Entity Management');
      expect(description).toContain('Interactable Objects');
      expect(description).toContain('Communication Context');
      expect(description).toContain('Animation Options');
      expect(description).toContain('Use Cases');
      expect(description).toContain('Autonomous behavior decision making');
      expect(description).toContain('Environmental awareness');
      
      logger.info('✅ Tool description content validated');
    });
  });

  describe('Disconnected State Handling', () => {
    it('should handle disconnected service gracefully', async () => {
      const disconnectedService = createMockHyperfyService({ isConnected: false });
      const sessionData = createMockSessionData(disconnectedService);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('World state retrieved (disconnected)');
      
      const data = result.data as WorldStateResponseData;
      expect(data.status).toBe('disconnected');
      expect(data.message).toBe('Hyperfy world connection unavailable');
      expect(data.timestamp).toBeDefined();
      
      logger.info('✅ Disconnected service handling validated');
    });

    it('should handle null service gracefully', async () => {
      const sessionData = createMockSessionData(null);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('World state retrieved (disconnected)');
      
      logger.info('✅ Null service handling validated');
    });

    it('should return text format for disconnected state when requested', async () => {
      const disconnectedService = createMockHyperfyService({ isConnected: false });
      const sessionData = createMockSessionData(disconnectedService);
      const context = createMockToolContext(sessionData);

      const args = { format: 'text' as const };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      expect(data.formatted_text).toBe('# Hyperfy World State\nConnection Status: Disconnected');
      expect(data.status).toBeUndefined(); // Should not have structured data
      
      logger.info('✅ Disconnected text format validated');
    });
  });

  describe('Entity Processing and Categorization', () => {
    it('should process entities and categorize them correctly', async () => {
      const entities = new Map();
      entities.set('player-1', createMockEntity('player-1', { name: 'Alice', type: 'player', position: { x: 5, y: 0, z: 5 } }));
      entities.set('npc-1', createMockEntity('npc-1', { name: 'Guard', type: 'npc', position: { x: 10, y: 0, z: 10 } }));
      entities.set('item-1', createMockEntity('item-1', { name: 'Sword', type: 'item', position: { x: 15, y: 0, z: 15 } }));
      entities.set(TEST_CONFIG.MOCK_PLAYER_ID, createMockEntity(TEST_CONFIG.MOCK_PLAYER_ID, { name: 'TestAgent', type: 'agent' }));

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      // Should have 4 total entities (including agent)
      expect(data.summary?.totalEntities).toBe(4);
      
      // Agent should be separate
      expect(data.agent?.id).toBe(TEST_CONFIG.MOCK_PLAYER_ID);
      
      // Other entities should be categorized
      expect(data.entities?.length).toBe(3); // Excluding agent
      expect(data.entities?.some(e => e.type === 'player')).toBe(true);
      expect(data.entities?.some(e => e.type === 'npc')).toBe(true);
      expect(data.entities?.some(e => e.type === 'item')).toBe(true);
      
      logger.info('✅ Entity categorization validated');
    });

    it('should handle entities with blueprint names', async () => {
      const entities = new Map();
      entities.set('blueprint-entity', createMockEntity('blueprint-entity', { 
        blueprintName: 'BlueprintName',
        position: { x: 20, y: 0, z: 20 }
      }));

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      const blueprintEntity = data.entities?.find(e => e.id === 'blueprint-entity');
      expect(blueprintEntity).toBeDefined();
      expect(blueprintEntity?.name).toBe('BlueprintName');
      
      logger.info('✅ Blueprint name handling validated');
    });

    it('should handle entities with missing position data', async () => {
      const entities = new Map();
      entities.set('no-position', {
        data: { id: 'no-position', name: 'NoPosition', type: 'object' }
        // No position data
      });

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      const noPositionEntity = data.entities?.find(e => e.id === 'no-position');
      expect(noPositionEntity).toBeDefined();
      expect(noPositionEntity?.position).toBeNull();
      
      // Check formatted text contains 'N/A' for position
      expect(data.formatted_text).toContain('Position: N/A');
      
      logger.info('✅ Missing position handling validated');
    });

    it('should handle empty entities list', async () => {
      const service = createMockHyperfyService({ entities: new Map() });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.summary?.totalEntities).toBe(0);
      expect(data.entities?.length).toBe(0);
      expect(data.formatted_text).toContain('Unable to find your own entity');
      
      logger.info('✅ Empty entities handling validated');
    });
  });

  describe('Action Detection and Processing', () => {
    it('should detect and process nearby actions', async () => {
      const actions = [
        createMockActionNode('1', { label: 'Use Door', entityName: 'WoodenDoor', position: { x: 5, y: 0, z: 5 } }),
        createMockActionNode('2', { label: 'Pick Up', entityName: 'GoldCoin', position: { x: 10, y: 0, z: 10 } }),
        createMockActionNode('3', { label: 'Talk To', entityName: 'Merchant', position: { x: 15, y: 0, z: 15 } })
      ];

      const service = createMockHyperfyService({ actions });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { actionRadius: 100 };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.summary?.nearbyActions).toBe(3);
      expect(data.nearbyActions?.length).toBe(3);
      
      // Check action details
      const useAction = data.nearbyActions?.find(a => a.action === 'Use Door');
      expect(useAction).toBeDefined();
      expect(useAction?.entityName).toBe('WoodenDoor');
      expect(useAction?.position).toEqual({ x: 5, y: 0, z: 5 });
      
      logger.info('✅ Action detection validated');
    });

    it('should handle current equipment/action', async () => {
      const currentAction = createMockActionNode('current', { 
        label: 'Wielding Sword', 
        entityName: 'MagicSword',
        entityId: 'sword-123'
      });

      const service = createMockHyperfyService({ currentAction });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.summary?.hasEquipment).toBe(true);
      expect(data.currentEquipment).toBeDefined();
      expect(data.currentEquipment?.action).toBe('Wielding Sword');
      expect(data.currentEquipment?.entityName).toBe('MagicSword');
      expect(data.currentEquipment?.entityId).toBe('sword-123');
      
      expect(data.formatted_text).toContain('You are currently using');
      expect(data.formatted_text).toContain('Wielding Sword');
      
      logger.info('✅ Current equipment handling validated');
    });

    it('should handle no current equipment', async () => {
      const service = createMockHyperfyService({ currentAction: null });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.summary?.hasEquipment).toBe(false);
      expect(data.currentEquipment).toBeNull();
      expect(data.formatted_text).toContain('You are not currently performing or holding anything');
      
      logger.info('✅ No equipment handling validated');
    });

    it('should respect action radius parameter', async () => {
      const actions = [
        createMockActionNode('near', { position: { x: 5, y: 0, z: 5 } }),   // Close
        createMockActionNode('far', { position: { x: 100, y: 0, z: 100 } }) // Far
      ];

      const service = createMockHyperfyService({ actions });
      // Mock getNearby to respect radius (in real implementation it filters by distance)
      service.getWorld().actions.getNearby = vi.fn().mockImplementation((radius) => {
        if (radius && radius < 50) {
          return [actions[0]]; // Only return near action
        }
        return actions; // Return all actions
      });

      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      // Test small radius
      const smallRadiusResult = await getWorldStateTool.execute({ actionRadius: 25 }, context);
      const smallRadiusData = smallRadiusResult.data as WorldStateResponseData;
      expect(smallRadiusData.summary?.nearbyActions).toBe(1);

      // Test large radius
      const largeRadiusResult = await getWorldStateTool.execute({ actionRadius: 150 }, context);
      const largeRadiusData = largeRadiusResult.data as WorldStateResponseData;
      expect(largeRadiusData.summary?.nearbyActions).toBe(2);
      
      logger.info('✅ Action radius filtering validated');
    });
  });

  describe('Format Options', () => {
    it('should return structured format when requested', async () => {
      const entities = new Map();
      entities.set('test-entity', createMockEntity('test-entity', { name: 'TestEntity' }));

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { format: 'structured' as const };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('(structured format)');
      
      const data = result.data as WorldStateResponseData;
      expect(data.status).toBe('connected');
      expect(data.worldId).toBe(TEST_CONFIG.MOCK_WORLD_ID);
      expect(data.timestamp).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.formatted_text).toBeUndefined(); // Should not have text format
      
      logger.info('✅ Structured format validated');
    });

    it('should return text format when requested', async () => {
      const entities = new Map();
      entities.set('test-entity', createMockEntity('test-entity', { name: 'TestEntity' }));

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { format: 'text' as const };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('(text format)');
      
      const data = result.data as WorldStateResponseData;
      expect(data.formatted_text).toBeDefined();
      expect(data.formatted_text).toContain('# Hyperfy World State');
      expect(data.status).toBeUndefined(); // Should not have structured data
      expect(data.summary).toBeUndefined();
      
      logger.info('✅ Text format validated');
    });

    it('should return both formats by default', async () => {
      const entities = new Map();
      entities.set('test-entity', createMockEntity('test-entity', { name: 'TestEntity' }));

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {}; // Default format should be 'both'
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('format)'); // No format suffix for 'both'
      
      const data = result.data as WorldStateResponseData;
      expect(data.formatted_text).toBeDefined();
      expect(data.status).toBeDefined();
      expect(data.summary).toBeDefined();
      
      logger.info('✅ Both formats (default) validated');
    });
  });

  describe('Chat Integration', () => {
    it('should include chat history when requested', async () => {
      const mockMessageManager = {
        getRecentMessages: vi.fn().mockResolvedValue('Recent chat messages here')
      };

      const service = createMockHyperfyService({ messageManager: mockMessageManager });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { includeChat: true };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.chatHistory).toBeDefined();
      expect(data.chatHistory).toEqual(['Recent chat messages here']);
      expect(data.formatted_text).toContain('## In-World Messages');
      expect(data.formatted_text).toContain('Recent chat messages here');
      
      // Verify message manager was called
      expect(mockMessageManager.getRecentMessages).toHaveBeenCalledWith(
        expect.stringMatching(/.*-test-world-123/)
      );
      
      logger.info('✅ Chat history inclusion validated');
    });

    it('should exclude chat history when not requested', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { includeChat: false };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.chatHistory).toBeUndefined();
      expect(data.formatted_text).not.toContain('## In-World Messages');
      
      logger.info('✅ Chat history exclusion validated');
    });

    it('should handle chat history errors gracefully', async () => {
      const mockMessageManager = {
        getRecentMessages: vi.fn().mockRejectedValue(new Error('Chat service unavailable'))
      };

      const service = createMockHyperfyService({ messageManager: mockMessageManager });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { includeChat: true };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.formatted_text).toContain('Chat history unavailable');
      expect(context.log.warn).toHaveBeenCalledWith(
        'Failed to get chat history:',
        expect.any(Error)
      );
      
      logger.info('✅ Chat history error handling validated');
    });

    it('should handle missing message manager', async () => {
      const service = createMockHyperfyService({ messageManager: null });
      // Override the getMessageManager to return null
      service.getMessageManager = vi.fn().mockReturnValue(null);
      
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { includeChat: true };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      // When includeChat is true but no message manager, should get empty array
      expect(data.chatHistory).toEqual([]);
      expect(data.formatted_text).not.toContain('## In-World Messages');
      
      logger.info('✅ Missing message manager handling validated');
    });
  });

  describe('Emotes Integration', () => {
    it('should include emotes list when requested', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { includeEmotes: true };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.availableEmotes).toBeDefined();
      expect(data.availableEmotes?.length).toBe(EMOTES_LIST.length);
      expect(data.formatted_text).toContain('## Available Animations');
      
      // Check that emotes match the constants
      for (let i = 0; i < EMOTES_LIST.length; i++) {
        expect(data.availableEmotes?.[i].name).toBe(EMOTES_LIST[i].name);
        expect(data.availableEmotes?.[i].description).toBe(EMOTES_LIST[i].description);
      }
      
      // Check formatted text contains emote entries
      for (const emote of EMOTES_LIST) {
        expect(data.formatted_text).toContain(`- **${emote.name}**: ${emote.description}`);
      }
      
      logger.info('✅ Emotes list inclusion validated');
    });

    it('should exclude emotes list when not requested', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { includeEmotes: false };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.availableEmotes).toBeUndefined();
      expect(data.formatted_text).not.toContain('## Available Animations');
      
      logger.info('✅ Emotes list exclusion validated');
    });

    it('should include emotes by default', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {}; // Default should include emotes
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      expect(data.availableEmotes).toBeDefined();
      expect(data.availableEmotes?.length).toBeGreaterThan(0);
      
      logger.info('✅ Default emotes inclusion validated');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing world object', async () => {
      const service = createMockHyperfyService();
      service.getWorld = vi.fn().mockReturnValue(null);

      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_state_retrieval_failed');
      expect(result.message).toContain('World object not available from service');
      
      logger.info('✅ Missing world object handling validated');
    });

    it('should handle execution errors gracefully', async () => {
      const service = createMockHyperfyService();
      service.getWorld = vi.fn().mockImplementation(() => {
        throw new Error('Service connection failed');
      });

      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_state_retrieval_failed');
      expect(result.message).toContain('Service connection failed');
      
      expect(context.log.error).toHaveBeenCalledWith(
        'Error retrieving world state:',
        expect.objectContaining({
          error: 'Service connection failed',
          args: expect.any(Object)
        })
      );
      
      logger.info('✅ Execution error handling validated');
    });

    it('should handle unknown errors gracefully', async () => {
      const service = createMockHyperfyService();
      service.getWorld = vi.fn().mockImplementation(() => {
        throw 'String error'; // Non-Error object
      });

      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('world_state_retrieval_failed');
      expect(result.message).toBe('Failed to retrieve world state: Unknown error occurred');
      
      logger.info('✅ Unknown error handling validated');
    });

    it('should handle malformed entity data', async () => {
      const entities = new Map();
      entities.set('malformed', {
        // Missing required data structure
        someOtherField: 'value'
      });

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = {};
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true); // Should handle gracefully
      const data = result.data as WorldStateResponseData;
      
      const malformedEntity = data.entities?.find(e => e.id === 'malformed');
      expect(malformedEntity).toBeDefined();
      expect(malformedEntity?.name).toBe('Unnamed'); // Fallback name
      expect(malformedEntity?.type).toBe('unknown'); // Fallback type
      
      logger.info('✅ Malformed entity data handling validated');
    });
  });

  describe('Logging and Debugging', () => {
    it('should log execution details', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { 
        includeChat: true, 
        includeEmotes: false, 
        actionRadius: 75, 
        format: 'structured' as const 
      };
      
      await getWorldStateTool.execute(args, context);

      expect(context.log.info).toHaveBeenCalledWith(
        'Executing hyperfy_get_world_state',
        expect.objectContaining({
          includeChat: true,
          includeEmotes: false,
          actionRadius: 75,
          format: 'structured'
        })
      );
      
      logger.info('✅ Execution logging validated');
    });

    it('should log successful retrieval with details', async () => {
      const entities = new Map();
      entities.set('entity-1', createMockEntity('entity-1'));
      entities.set('entity-2', createMockEntity('entity-2'));

      const actions = [
        createMockActionNode('1'),
        createMockActionNode('2')
      ];

      const currentAction = createMockActionNode('current');

      const service = createMockHyperfyService({ entities, actions, currentAction });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { actionRadius: 100 };
      await getWorldStateTool.execute(args, context);

      expect(context.log.info).toHaveBeenCalledWith(
        'World state retrieved successfully',
        expect.objectContaining({
          format: 'both',
          entityCount: 2,
          actionCount: 2,
          includeChat: true,
          includeEmotes: true,
          actionRadius: 100,
          hasCurrentEquipment: true
        })
      );
      
      logger.info('✅ Success logging validated');
    });

    it('should log different parameter combinations', async () => {
      const service = createMockHyperfyService();
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const paramCombinations = [
        { includeChat: false, includeEmotes: false, actionRadius: 25, format: 'text' as const },
        { includeChat: true, includeEmotes: true, actionRadius: 200, format: 'structured' as const },
        {} // Default values
      ];

      for (const params of paramCombinations) {
        vi.clearAllMocks();
        await getWorldStateTool.execute(params, context);

        expect(context.log.info).toHaveBeenCalledWith(
          'Executing hyperfy_get_world_state',
          expect.objectContaining({
            includeChat: params.includeChat ?? true,
            includeEmotes: params.includeEmotes ?? true,
            actionRadius: params.actionRadius ?? 50,
            format: params.format ?? 'both'
          })
        );
      }
      
      logger.info('✅ Parameter combination logging validated');
    });
  });

  describe('Integration and Performance', () => {
    it('should handle complex world state scenarios', async () => {
      // Create a complex world with multiple entity types, actions, and equipment
      const entities = new Map();
      entities.set(TEST_CONFIG.MOCK_PLAYER_ID, createMockEntity(TEST_CONFIG.MOCK_PLAYER_ID, { 
        name: 'TestAgent', 
        type: 'agent',
        position: { x: 0, y: 0, z: 0 }
      }));
      
      // Add various entity types
      for (let i = 1; i <= 5; i++) {
        entities.set(`player-${i}`, createMockEntity(`player-${i}`, { 
          name: `Player${i}`, 
          type: 'player',
          position: { x: i * 10, y: 0, z: i * 10 }
        }));
        entities.set(`npc-${i}`, createMockEntity(`npc-${i}`, { 
          name: `NPC${i}`, 
          type: 'npc',
          blueprintName: `NPCBlueprint${i}`,
          position: { x: i * 5, y: 0, z: i * 5 }
        }));
        entities.set(`item-${i}`, createMockEntity(`item-${i}`, { 
          name: `Item${i}`, 
          type: 'item',
          position: { x: i * 15, y: 0, z: i * 15 }
        }));
      }

      const actions = Array.from({ length: 10 }, (_, i) => 
        createMockActionNode(`action-${i}`, { 
          label: `Action${i}`,
          entityName: `ActionEntity${i}`,
          position: { x: i * 8, y: 0, z: i * 8 }
        })
      );

      const currentAction = createMockActionNode('equipped', {
        label: 'Wielding Staff',
        entityName: 'MagicStaff',
        entityId: 'staff-123'
      });

      const mockMessageManager = {
        getRecentMessages: vi.fn().mockResolvedValue('Complex chat history with multiple messages')
      };

      const service = createMockHyperfyService({ 
        entities, 
        actions, 
        currentAction, 
        messageManager: mockMessageManager 
      });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const args = { actionRadius: 200, format: 'both' as const };
      const result = await getWorldStateTool.execute(args, context);

      expect(result.success).toBe(true);
      const data = result.data as WorldStateResponseData;
      
      // Verify complex state is handled correctly
      expect(data.summary?.totalEntities).toBe(16); // 1 agent + 15 others
      expect(data.summary?.nearbyActions).toBe(10);
      expect(data.summary?.hasEquipment).toBe(true);
      expect(data.summary?.connectionStatus).toBe('connected');
      
      // Verify categorization
      expect(data.entities?.filter(e => e.type === 'player').length).toBe(5);
      expect(data.entities?.filter(e => e.type === 'npc').length).toBe(5);
      expect(data.entities?.filter(e => e.type === 'item').length).toBe(5);
      
      // Verify formatted text structure
      expect(data.formatted_text).toContain('# Hyperfy World State');
      expect(data.formatted_text).toContain('## Agent Info (You)');
      expect(data.formatted_text).toContain('## Player Entities (5)');
      expect(data.formatted_text).toContain('## Npc Entities (5)');
      expect(data.formatted_text).toContain('## Item Entities (5)');
      expect(data.formatted_text).toContain('## Nearby Interactable Objects (10)');
      expect(data.formatted_text).toContain('## Your Equipped Item or Action');
      expect(data.formatted_text).toContain('## In-World Messages');
      expect(data.formatted_text).toContain('## Available Animations');
      
      logger.info('✅ Complex world state scenario validated');
    });

    it('should be performant with large datasets', async () => {
      // Create large dataset
      const entities = new Map();
      for (let i = 0; i < 100; i++) {
        entities.set(`entity-${i}`, createMockEntity(`entity-${i}`, {
          name: `Entity${i}`,
          type: i % 3 === 0 ? 'player' : i % 3 === 1 ? 'npc' : 'item',
          position: { x: i, y: 0, z: i }
        }));
      }

      const actions = Array.from({ length: 50 }, (_, i) => 
        createMockActionNode(`action-${i}`)
      );

      const service = createMockHyperfyService({ entities, actions });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      const startTime = Date.now();
      const result = await getWorldStateTool.execute({}, context);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      const data = result.data as WorldStateResponseData;
      expect(data.summary?.totalEntities).toBe(100);
      expect(data.summary?.nearbyActions).toBe(50);
      
      logger.info('✅ Performance validation completed', { 
        executionTime, 
        entityCount: 100, 
        actionCount: 50 
      });
    });

    it('should maintain data consistency across multiple calls', async () => {
      const entities = new Map();
      entities.set('consistent-entity', createMockEntity('consistent-entity', {
        name: 'ConsistentEntity',
        type: 'test',
        position: { x: 42, y: 0, z: 42 }
      }));

      const service = createMockHyperfyService({ entities });
      const sessionData = createMockSessionData(service);
      const context = createMockToolContext(sessionData);

      // Execute multiple times
      const results = await Promise.all([
        getWorldStateTool.execute({}, context),
        getWorldStateTool.execute({ format: 'structured' }, context),
        getWorldStateTool.execute({ format: 'text' }, context),
        getWorldStateTool.execute({ actionRadius: 100 }, context)
      ]);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Entity data should be consistent
      for (const result of results) {
        const data = result.data as WorldStateResponseData;
        if (data.entities) {
          const entity = data.entities.find(e => e.id === 'consistent-entity');
          expect(entity).toBeDefined();
          expect(entity?.name).toBe('ConsistentEntity');
          expect(entity?.type).toBe('test');
          expect(entity?.position).toEqual({ x: 42, y: 0, z: 42 });
        }
      }
      
      logger.info('✅ Data consistency validated');
    });
  });
});
