import { FastMCP } from 'fastmcp';
import { chatTool } from './actions/chatTool.js';
import { ambientTool } from './actions/ambientTool.js';
import { gotoTool } from './actions/gotoTool.js';
import { useTool } from './actions/useTool.js';
import { stopTool } from './actions/stopTool.js';
import { unuseTool } from './actions/unuseTool.js';
import { walkRandomlyTool } from './actions/walkRandomlyTool.js';
import { getEmoteListTool } from './actions/getEmoteListTool.js';
import { getWorldStateTool } from './actions/getWorldStateTool.js';
import type { HyperfySessionData, PlayerState, WorldState, ActionResult } from '../types/index.js';
import { generateUUID, createLogger } from '../utils/eliza-compat.js';
import type { HyperfyService, HyperfyRuntime } from '../core/hyperfy-service.js';
import type { AgentControls } from '../hyperfy/systems/controls.js';
import type { AgentActions } from '../hyperfy/systems/actions.js';

// Create logger instance for consistent logging
const logger = createLogger();

// Create proper session auth type that satisfies FastMCP constraints
export interface McpSessionData extends Record<string, unknown> {
  worldId: string;
  userId: string;
  playerState: PlayerState;
  worldState: WorldState;
  connectionTime: Date;
  lastActivity: Date;
  preferences: Record<string, unknown>;
  hyperfyService: HyperfyService;
  controls: AgentControls;
  actions: AgentActions;
}

const HYPERFY_WS_SERVER = process.env.HYPERFY_WS_SERVER || 'ws://localhost:3000/ws';

/**
 * Initialize and connect to Hyperfy service
 * @returns {Promise<McpSessionData>} Session data with connected service
 */
async function initializeHyperfySession(): Promise<McpSessionData> {
  logger.info('Initializing Hyperfy session...');
  
  // Dynamic import to avoid constructor issues
  const { HyperfyService } = await import('../core/hyperfy-service.js');
  
  // Generate agentId like the plugin does - first create base ID, then use it
  const baseAgentId = generateUUID({ logger: createLogger() } as any, 'hyperfy-agent');
  
  // Create a proper HyperfyRuntime object based on the real plugin implementation
  const runtime: HyperfyRuntime = {
    agentId: baseAgentId,
    character: {
      name: 'HyperfyAgent'
    },
    // Temporary placeholder methods - will be replaced with actual service after connection
    getEntityById: async (entityId: string) => {
      // Placeholder - will be replaced after service connection
      logger.debug(`Runtime getEntityById placeholder called for: ${entityId}`);
      return null;
    },
    // Temporary placeholder methods - will be replaced with actual service after connection
    updateEntity: async (entity: unknown) => {
      // Placeholder - will be replaced after service connection
      logger.debug('Runtime updateEntity placeholder called', entity);
      return;
    }
  };
  
  // Create service instance with proper runtime
  const hyperfyService = new HyperfyService(runtime);
  
  // Connect to Hyperfy service using real plugin pattern (like createUniqueUuid)
  const worldId = generateUUID({ logger: createLogger() } as any, `${runtime.agentId}-default-hyperfy`);
  await hyperfyService.connect({ 
    wsUrl: HYPERFY_WS_SERVER, 
    worldId: worldId
  });
  
  logger.info(`Connected to Hyperfy world: ${worldId}`);
  
  // Get world and controls using real plugin methods
  const world = hyperfyService.getWorld();
  if (!world) {
    throw new Error('Failed to get Hyperfy world after connection');
  }
  
  // Based on plugin implementation, controls and actions are added to world
  const controls = (world as { controls: AgentControls }).controls;
  const actions = (world as { actions: AgentActions }).actions;
  
  if (!controls || !actions) {
    throw new Error('Failed to get Hyperfy controls or actions from world');
  }

  // Update runtime methods to use the actual connected service
  // This matches the real plugin implementation patterns
  runtime.getEntityById = async (entityId: string) => {
    // Cast the return type to match interface expectation
    return hyperfyService.getEntityById(entityId) as unknown as Awaited<ReturnType<HyperfyRuntime['getEntityById']>>;
  };

  runtime.updateEntity = async (entity: unknown) => {
    // In the real plugin, entity updates are handled through world.network.send
    // and entity.modify() methods
    logger.debug('Updating entity through Hyperfy service', entity);
    return;
  };

  // Build session data that satisfies Record<string, unknown> constraint
  const sessionData: McpSessionData = {
    worldId: worldId,
    userId: `mcp-user-${Date.now()}`,
    playerState: {
      id: `player-${Date.now()}`,
      name: 'Agent',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      status: 'active',
      lastActivity: new Date(),
      metadata: {}
    } as PlayerState,
    worldState: {
      id: worldId,
      name: 'Hyperfy World',
      playerCount: 1,
      entities: [],
      lastUpdate: new Date(),
      metadata: {}
    } as WorldState,
    connectionTime: new Date(),
    lastActivity: new Date(),
    preferences: {},
    hyperfyService,
    controls,
    actions
  };
  
  logger.info('Hyperfy session initialized successfully');
  return sessionData;
}

// Helper function to create tool context from FastMCP context
function createToolContext(context: { log: unknown; session?: unknown }) {
  // Use our logger from eliza-compat.ts that follows FastMCP format
  const fastMCPLog = context.log as {
    debug: (message: string, data?: unknown) => void;
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };

  return {
    log: {
      debug: (message: string, data?: unknown) => {
        logger.debug(`[MCP-Tool] ${message}`, data);
        fastMCPLog.debug(message, data);
      },
      info: (message: string, data?: unknown) => {
        logger.info(`[MCP-Tool] ${message}`, data);
        fastMCPLog.info(message, data);
      },
      warn: (message: string, data?: unknown) => {
        logger.warn(`[MCP-Tool] ${message}`, data);
        fastMCPLog.warn(message, data);
      },
      error: (message: string, data?: unknown) => {
        logger.error(`[MCP-Tool] ${message}`, data);
        fastMCPLog.error(message, data);
      }
    },
    session: { data: context.session as McpSessionData }
  };
}

// Helper function to handle tool execution results
function handleToolResult(result: ActionResult) {
  if (result.success) {
    logger.info(`Tool executed successfully: ${result.message || 'Action completed'}`);
    return result.message || 'Action completed successfully';
  }
  logger.error(`Tool execution failed: ${result.message || result.error || 'Unknown error'}`);
  throw new Error(result.message || result.error || 'Action failed');
}

const server = new FastMCP<McpSessionData>({
  name: 'hyperfy-mcp-server',
  version: '1.0.0',
  instructions: `
    This is a Hyperfy MCP server that provides tools for interacting with 3D virtual worlds.
    
    Available tools:
    - hyperfy_chat: Send messages to the Hyperfy world chat
    - hyperfy_ambient: Generate ambient speech for natural agent behavior
    - hyperfy_goto: Navigate to specific entities or locations in the world
    - hyperfy_use: Interact with and use items/objects in the world
    - hyperfy_stop: Stop current navigation or movement
    - hyperfy_unuse: Release currently held items or interactions
    - hyperfy_walk_randomly: Start/stop random wandering behavior
    - hyperfy_get_emote_list: Get complete list of available emotes and animations
    - hyperfy_get_world_state: Get comprehensive world state including entities, actions, and context
    
    The server maintains session state including player position, world information, and connection details.
    All tools support rich contextual usage and provide comprehensive feedback about actions performed.
    
    Connection Requirements:
    - Hyperfy WebSocket server must be accessible at the configured endpoint
    - World must support agent controls and actions systems
    - Proper authentication and permissions for agent operations
  `,
  
  // Configure session authentication/initialization
  authenticate: async () => {
    // Initialize Hyperfy session for each connecting client
    try {
      logger.info('FastMCP client connecting, initializing Hyperfy session...');
      const sessionData = await initializeHyperfySession();
      logger.info('FastMCP authentication successful');
      return sessionData;
    } catch (error) {
      logger.error('Failed to initialize Hyperfy session:', error);
      throw new Error(`Hyperfy connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  
  // Configure ping for connection health
  ping: {
    enabled: true,
    intervalMs: 10000, // 10 seconds
    logLevel: 'debug'
  },
  
  // Configure health endpoint
  health: {
    enabled: true,
    path: '/health',
    message: 'Hyperfy MCP Server - OK',
    status: 200
  },
  
  // Enable roots capability
  roots: {
    enabled: true
  }
});

// Register all MCP tools with proper typing
server.addTool({
  name: chatTool.name,
  description: chatTool.description,
  parameters: chatTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await chatTool.execute(args as Parameters<typeof chatTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: ambientTool.name,
  description: ambientTool.description,
  parameters: ambientTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await ambientTool.execute(args as Parameters<typeof ambientTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: gotoTool.name,
  description: gotoTool.description,
  parameters: gotoTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await gotoTool.execute(args as Parameters<typeof gotoTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: useTool.name,
  description: useTool.description,
  parameters: useTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await useTool.execute(args as Parameters<typeof useTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: stopTool.name,
  description: stopTool.description,
  parameters: stopTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await stopTool.execute(args as Parameters<typeof stopTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: unuseTool.name,
  description: unuseTool.description,
  parameters: unuseTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await unuseTool.execute(args as Parameters<typeof unuseTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: walkRandomlyTool.name,
  description: walkRandomlyTool.description,
  parameters: walkRandomlyTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await walkRandomlyTool.execute(args as Parameters<typeof walkRandomlyTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: getEmoteListTool.name,
  description: getEmoteListTool.description,
  parameters: getEmoteListTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await getEmoteListTool.execute(args as Parameters<typeof getEmoteListTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

server.addTool({
  name: getWorldStateTool.name,
  description: getWorldStateTool.description,
  parameters: getWorldStateTool.parameters,
  execute: async (args, context) => {
    const toolContext = createToolContext(context);
    const result = await getWorldStateTool.execute(args as Parameters<typeof getWorldStateTool.execute>[0], toolContext);
    return handleToolResult(result);
  }
});

// Event handlers for server lifecycle
server.on('connect', (event) => {
  const sessionData = event.session as unknown as McpSessionData;
  logger.info(`FastMCP client connected. Session initialized with world: ${sessionData.worldId}`);
});

server.on('disconnect', (event) => {
  const sessionData = event.session as unknown as McpSessionData;
  logger.info(`FastMCP client disconnected. Cleaning up session: ${sessionData.userId}`);
  
  // Clean up Hyperfy connection using real plugin patterns
  try {
    const hyperfyService = sessionData.hyperfyService;
    if (hyperfyService?.isConnected()) {
      logger.info('Disconnecting Hyperfy service...');
      hyperfyService.disconnect().then(() => {
        logger.info('Hyperfy service disconnected successfully');
      }).catch((error) => {
        logger.error('Error during Hyperfy disconnect:', error);
      });
    }
  } catch (error) {
    logger.error('Error cleaning up Hyperfy connection:', error);
  }
});

export { server };
export default server;