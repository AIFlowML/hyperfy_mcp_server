/**
 * Integration Test for Hyperfy FastMCP Server
 * Tests against REAL Hyperfy server on localhost:3000
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { createLogger, generateUUID } from '../src/utils/eliza-compat';
import type { HyperfyRuntime, HyperfyEntity } from '../src/core/hyperfy-service';
import type { LogType, FastMCPRuntime } from '../src/types/index';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  HYPERFY_WS_SERVER: process.env.HYPERFY_WS_SERVER || 'ws://localhost:3000/ws',
  TEST_TIMEOUT: 30000, // 30 seconds
};

// Create a proper mock runtime that implements HyperfyRuntime
function createMockRuntime(agentName: string): HyperfyRuntime {
  const mockLogger: LogType = {
    info: (message: string, data?: unknown) => logger.info(message, data),
    warn: (message: string, data?: unknown) => logger.warn(message, data),
    error: (message: string, data?: unknown) => logger.error(message, data),
    debug: (message: string, data?: unknown) => logger.debug(message, data),
  };

  return {
    agentId: '', // Will be set after creation
    character: { name: agentName },
    getEntityById: async (): Promise<HyperfyEntity | null> => null,
    updateEntity: async (): Promise<void> => {},
    logger: mockLogger,
    generateUUID: () => Math.random().toString(36).substring(7),
    agentName,
    aiModel: undefined
  };
}

// Create a mock FastMCPRuntime for generateUUID calls
function createMockFastMCPRuntime(agentName: string): FastMCPRuntime {
  const mockLogger: LogType = {
    info: (message: string, data?: unknown) => logger.info(message, data),
    warn: (message: string, data?: unknown) => logger.warn(message, data),
    error: (message: string, data?: unknown) => logger.error(message, data),
    debug: (message: string, data?: unknown) => logger.debug(message, data),
  };

  return {
    logger: mockLogger,
    generateUUID: () => Math.random().toString(36).substring(7),
    hyperfyService: undefined,
    agentId: '',
    agentName,
    aiModel: {
      generateText: async () => 'mock response'
    }
  };
}

describe('Hyperfy FastMCP Server Integration Tests', () => {
  
  beforeAll(() => {
    logger.info('🚀 Starting Hyperfy FastMCP Server Integration Tests');
    logger.info(`🔌 Testing against: ${TEST_CONFIG.HYPERFY_WS_SERVER}`);
    logger.info('📋 Make sure Hyperfy server is running on localhost:3000');
  });

  test('Should connect to Hyperfy server and initialize service', async () => {
    logger.info('🧪 Test: Basic server connection');
    
    // Import the actual service modules
    const { HyperfyService } = await import('../src/core/hyperfy-service');
    
    // Create test runtime with proper typing
    const mockFastMCPRuntime = createMockFastMCPRuntime('TestAgent');
    const mockRuntime = createMockRuntime('TestAgent');
    
    mockRuntime.agentId = generateUUID(mockFastMCPRuntime, 'test-agent');
    mockFastMCPRuntime.agentId = mockRuntime.agentId;
    
    logger.info(`📝 Created test runtime with agentId: ${mockRuntime.agentId}`);
    
    // Create and test service
    const service = new HyperfyService(mockRuntime);
    const worldId = generateUUID(mockFastMCPRuntime, `${mockRuntime.agentId}-test-world`);
    
    logger.info(`🌍 Connecting to world: ${worldId}`);
    
    // Connect to Hyperfy
    await service.connect({
      wsUrl: TEST_CONFIG.HYPERFY_WS_SERVER,
      worldId: worldId
    });
    
    logger.info('✅ Connected successfully!');
    
    // Test connection state
    expect(service.isConnected()).toBe(true);
    
    const world = service.getWorld();
    expect(world).toBeTruthy();
    
    logger.info(`🎮 World object: ${!!world}`);
    
    // Test world components with proper typing
    if (world) {
      const hasControls = !!world.controls;
      const hasActions = !!world.actions;
      const hasChat = !!world.chat;
      const hasNetwork = !!world.network;
      
      logger.info(`🎯 Controls: ${hasControls}`);
      logger.info(`⚡ Actions: ${hasActions}`);
      logger.info(`💬 Chat: ${hasChat}`);
      logger.info(`🌐 Network: ${hasNetwork}`);
      
      expect(hasControls).toBe(true);
      expect(hasActions).toBe(true);
      expect(hasChat).toBe(true);
      expect(hasNetwork).toBe(true);
    }
    
    // Clean up
    await service.disconnect();
    logger.info('🧹 Disconnected and cleaned up');
    
  }, TEST_CONFIG.TEST_TIMEOUT);

  test('Should be able to import FastMCP server', async () => {
    logger.info('🧪 Test: FastMCP server import');
    
    const { server } = await import('../src/servers/server');
    
    expect(server).toBeTruthy();
    logger.info('✅ FastMCP server imported successfully');
    
  }, 10000);

  test('Should handle entity operations', async () => {
    logger.info('🧪 Test: Entity operations');
    
    const { HyperfyService } = await import('../src/core/hyperfy-service');
    
    const mockFastMCPRuntime = createMockFastMCPRuntime('EntityTest');
    const mockRuntime = createMockRuntime('EntityTest');
    
    mockRuntime.agentId = generateUUID(mockFastMCPRuntime, 'entity-test');
    mockFastMCPRuntime.agentId = mockRuntime.agentId;
    
    const service = new HyperfyService(mockRuntime);
    const worldId = generateUUID(mockFastMCPRuntime, `${mockRuntime.agentId}-entity-test`);
    
    await service.connect({
      wsUrl: TEST_CONFIG.HYPERFY_WS_SERVER,
      worldId: worldId
    });
    
    // Test entity operations
    const entity = service.getEntityById('non-existent');
    const entityName = service.getEntityName('non-existent');
    
    logger.info(`👻 Non-existent entity: ${entity}`);
    logger.info(`📛 Entity name: ${entityName}`);
    
    expect(entity).toBeNull();
    expect(entityName).toBeTruthy(); // Should return 'Unnamed' or similar
    
    await service.disconnect();
    
  }, TEST_CONFIG.TEST_TIMEOUT);

});
