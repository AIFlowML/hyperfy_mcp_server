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
import type { HyperfySessionData, PlayerState, WorldState, ActionResult, FastMCPRuntime } from '../types/index.js';
import { generateUUID, createLogger } from '../utils/eliza-compat.js';
import type { HyperfyService, HyperfyRuntime } from '../core/hyperfy-service.js';
import type { AgentControls } from '../hyperfy/systems/controls.js';
import type { AgentActions } from '../hyperfy/systems/actions.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Create logger instance for consistent logging
const logger = createLogger();

// Environment configuration interface
interface ServerEnvironment {
  HYPERFY_WS_SERVER: string;
  PORT?: string;
  DEBUG?: string;
  NODE_ENV?: string;
  MCP_DISABLE_PINGS?: string;
}

// Validate and get environment configuration
function getServerConfig(): ServerEnvironment {
  const config: ServerEnvironment = {
    HYPERFY_WS_SERVER: process.env.HYPERFY_WS_SERVER || 'wss://chill.hyperfy.xyz/ws', // or wss://chill.hyperfy.xyz/ws or ws://localhost:3000/ws
    PORT: process.env.PORT,
    DEBUG: process.env.DEBUG,
    NODE_ENV: process.env.NODE_ENV,
    MCP_DISABLE_PINGS: process.env.MCP_DISABLE_PINGS
  };

  // Validate required configuration
  if (!config.HYPERFY_WS_SERVER) {
    throw new Error('HYPERFY_WS_SERVER environment variable is required');
  }

  // Validate WebSocket URL format
  try {
    const url = new URL(config.HYPERFY_WS_SERVER);
    if (!['ws:', 'wss:'].includes(url.protocol)) {
      throw new Error('HYPERFY_WS_SERVER must be a valid WebSocket URL (ws:// or wss://)');
    }
  } catch (error) {
    throw new Error(`Invalid HYPERFY_WS_SERVER URL: ${error instanceof Error ? error.message : 'Invalid format'}`);
  }

  logger.info('Server configuration loaded', {
    hyperfyServer: config.HYPERFY_WS_SERVER,
    port: config.PORT,
    debug: config.DEBUG,
    nodeEnv: config.NODE_ENV,
    disablePings: config.MCP_DISABLE_PINGS
  });

  return config;
}

// Get server configuration with validation
const SERVER_CONFIG = getServerConfig();

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

// Global session cache for stdio transport (since authenticate() doesn't work with stdio)
let globalSessionData: McpSessionData | null = null;
let sessionInitPromise: Promise<McpSessionData> | null = null;

async function getOrCreateSessionData(): Promise<McpSessionData> {
  // If we already have session data, return it
  if (globalSessionData) {
    return globalSessionData;
  }
  
  // If initialization is already in progress, wait for it
  if (sessionInitPromise) {
    return sessionInitPromise;
  }
  
  // Start initialization
  sessionInitPromise = (async () => {
    try {
      logger.info('Lazy initializing Hyperfy session for stdio transport...', {
        server: SERVER_CONFIG.HYPERFY_WS_SERVER,
        timestamp: new Date().toISOString()
      });
      
      const sessionData = await initializeHyperfySession();
      globalSessionData = sessionData;
      
      logger.info('Session lazy initialization successful', {
        worldId: sessionData.worldId,
        userId: sessionData.userId
      });
      
      return sessionData;
    } catch (error) {
      // Reset promise so we can retry
      sessionInitPromise = null;
      
      logger.error('Failed to initialize Hyperfy session:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        server: SERVER_CONFIG.HYPERFY_WS_SERVER
      });
      
      throw error;
    }
  })();
  
  return sessionInitPromise;
}

/**
 * Initialize and connect to Hyperfy service with enhanced error handling
 * @returns {Promise<McpSessionData>} Session data with connected service
 */
async function initializeHyperfySession(): Promise<McpSessionData> {
  logger.info('Initializing Hyperfy session...');
  
  try {
    // Dynamic import to avoid constructor issues
    const { HyperfyService } = await import('../core/hyperfy-service.js');
    
    // Generate consistent agentId like the original plugin
    // Original pattern: runtime.agentId is created from a seed
    const agentSeed = 'hyperfy-mcp-agent';
    const baseAgentId = generateUUID({} as FastMCPRuntime, agentSeed);
    
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
    
    // Generate worldId using the same pattern as original plugin: agentId + '-default-hyperfy'
    const worldId = generateUUID({} as FastMCPRuntime, `${runtime.agentId}-default-hyperfy`);
    
    logger.info('Connecting to Hyperfy service...', {
      wsUrl: SERVER_CONFIG.HYPERFY_WS_SERVER,
      worldId,
      agentId: baseAgentId
    });
    
    await hyperfyService.connect({ 
      wsUrl: SERVER_CONFIG.HYPERFY_WS_SERVER, 
      worldId: worldId
    });
    
    logger.info(`Successfully connected to Hyperfy world: ${worldId}`);
    
    // Get world and controls using real plugin methods
    const world = hyperfyService.getWorld();
    if (!world) {
      throw new Error('Failed to get Hyperfy world after connection - world is null');
    }
    
    // Based on plugin implementation, controls and actions are added to world
    const controls = (world as { controls: AgentControls }).controls;
    const actions = (world as { actions: AgentActions }).actions;
    
    if (!controls) {
      throw new Error('Failed to get Hyperfy controls from world - controls system not available');
    }
    
    if (!actions) {
      throw new Error('Failed to get Hyperfy actions from world - actions system not available');
    }

    // Update runtime methods to use the actual connected service
    // This matches the real plugin implementation patterns
    runtime.getEntityById = async (entityId: string) => {
      try {
        // Cast the return type to match interface expectation
        return hyperfyService.getEntityById(entityId) as unknown as Awaited<ReturnType<HyperfyRuntime['getEntityById']>>;
      } catch (error) {
        logger.error(`Failed to get entity by ID: ${entityId}`, error);
        return null;
      }
    };

    runtime.updateEntity = async (entity: unknown) => {
      try {
        // In the real plugin, entity updates are handled through world.network.send
        // and entity.modify() methods
        logger.debug('Updating entity through Hyperfy service', entity);
        return;
      } catch (error) {
        logger.error('Failed to update entity', error);
        throw error;
      }
    };

    // Generate consistent user ID using the agentId pattern
    const userId = generateUUID({} as FastMCPRuntime, `mcp-user-${baseAgentId}`);

    // Build session data that satisfies Record<string, unknown> constraint
    const sessionData: McpSessionData = {
      worldId: worldId,
      userId: userId,
      playerState: {
        id: generateUUID({} as FastMCPRuntime, `player-${baseAgentId}`),
        name: 'HyperfyAgent',
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
    
    logger.info('Hyperfy session initialized successfully', {
      worldId: sessionData.worldId,
      userId: sessionData.userId,
      agentId: baseAgentId,
      connectionTime: sessionData.connectionTime
    });
    
    return sessionData;
    
  } catch (error) {
    logger.error('Failed to initialize Hyperfy session', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      hyperfyServer: SERVER_CONFIG.HYPERFY_WS_SERVER
    });
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Hyperfy session initialization failed: ${error.message}`);
    }
    throw new Error('Hyperfy session initialization failed with unknown error');
  }
}

// Helper function to create tool context from FastMCP context with proper typing
interface FastMCPLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

interface FastMCPContext {
  log: FastMCPLogger;
  session?: McpSessionData;
}

function createToolContext(context: { log: unknown; session?: unknown }) {
  // Use our logger from eliza-compat.ts that follows FastMCP format
  const fastMCPLog = context.log as FastMCPLogger;

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
    // For stdio transport, session will be undefined, so we need lazy initialization
    session: { 
      get data() {
        // This will be replaced by actual session data in the tool wrapper
        throw new Error('Session data not initialized - this should not happen');
      }
    }
  };
}

// Helper function to handle tool execution results with enhanced error context
function handleToolResult(result: ActionResult, toolName?: string) {
  if (result.success) {
    const message = result.message || 'Action completed successfully';
    logger.info(`Tool executed successfully: ${toolName || 'unknown'}`, {
      message,
      data: result.data
    });
    return message;
  }
  
  // Enhanced error context
  const errorContext = {
    tool: toolName || 'unknown',
    message: result.message,
    error: result.error,
    data: result.data
  };
  
  logger.error('Tool execution failed:', errorContext);
  
  const errorMessage = result.message || result.error || 'Action failed';
  throw new Error(`${toolName ? `[${toolName}] ` : ''}${errorMessage}`);
}

// Configure ping settings based on environment
const pingConfig = SERVER_CONFIG.MCP_DISABLE_PINGS === 'true' ? {
  enabled: false
} : {
  enabled: true,
  intervalMs: 10000, // 10 seconds
  logLevel: 'debug' as const
};

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
    - Hyperfy WebSocket server must be accessible at: ${SERVER_CONFIG.HYPERFY_WS_SERVER}
    - World must support agent controls and actions systems
    - Proper authentication and permissions for agent operations
    
    Environment Configuration:
    - Server: ${SERVER_CONFIG.HYPERFY_WS_SERVER}
    - Debug: ${SERVER_CONFIG.DEBUG || 'false'}
    - Environment: ${SERVER_CONFIG.NODE_ENV || 'development'}
  `,
  
  // Note: authenticate() only works for httpStream transport, not stdio
  // For stdio transport, we'll initialize session data lazily when tools are first called
  
  // Configure ping for connection health
  ping: pingConfig,
  
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

// Register all MCP tools with lazy session initialization
server.addTool({
  name: chatTool.name,
  description: chatTool.description,
  parameters: chatTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await chatTool.execute(args as Parameters<typeof chatTool.execute>[0], toolContext);
    return handleToolResult(result, chatTool.name);
  }
});

server.addTool({
  name: ambientTool.name,
  description: ambientTool.description,
  parameters: ambientTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await ambientTool.execute(args as Parameters<typeof ambientTool.execute>[0], toolContext);
    return handleToolResult(result, ambientTool.name);
  }
});

server.addTool({
  name: gotoTool.name,
  description: gotoTool.description,
  parameters: gotoTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await gotoTool.execute(args as Parameters<typeof gotoTool.execute>[0], toolContext);
    return handleToolResult(result, gotoTool.name);
  }
});

server.addTool({
  name: useTool.name,
  description: useTool.description,
  parameters: useTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await useTool.execute(args as Parameters<typeof useTool.execute>[0], toolContext);
    return handleToolResult(result, useTool.name);
  }
});

server.addTool({
  name: stopTool.name,
  description: stopTool.description,
  parameters: stopTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await stopTool.execute(args as Parameters<typeof stopTool.execute>[0], toolContext);
    return handleToolResult(result, stopTool.name);
  }
});

server.addTool({
  name: unuseTool.name,
  description: unuseTool.description,
  parameters: unuseTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await unuseTool.execute(args as Parameters<typeof unuseTool.execute>[0], toolContext);
    return handleToolResult(result, unuseTool.name);
  }
});

server.addTool({
  name: walkRandomlyTool.name,
  description: walkRandomlyTool.description,
  parameters: walkRandomlyTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await walkRandomlyTool.execute(args as Parameters<typeof walkRandomlyTool.execute>[0], toolContext);
    return handleToolResult(result, walkRandomlyTool.name);
  }
});

server.addTool({
  name: getEmoteListTool.name,
  description: getEmoteListTool.description,
  parameters: getEmoteListTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await getEmoteListTool.execute(args as Parameters<typeof getEmoteListTool.execute>[0], toolContext);
    return handleToolResult(result, getEmoteListTool.name);
  }
});

server.addTool({
  name: getWorldStateTool.name,
  description: getWorldStateTool.description,
  parameters: getWorldStateTool.parameters,
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    const toolContext = {
      log: {
        debug: (message: string, data?: unknown) => {
          logger.debug(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).debug(message, data);
        },
        info: (message: string, data?: unknown) => {
          logger.info(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).info(message, data);
        },
        warn: (message: string, data?: unknown) => {
          logger.warn(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).warn(message, data);
        },
        error: (message: string, data?: unknown) => {
          logger.error(`[MCP-Tool] ${message}`, data);
          (context.log as FastMCPLogger).error(message, data);
        }
      },
      session: { data: sessionData }
    };
    const result = await getWorldStateTool.execute(args as Parameters<typeof getWorldStateTool.execute>[0], toolContext);
    return handleToolResult(result, getWorldStateTool.name);
  }
});

// Add a diagnostic tool to show client capabilities
server.addTool({
  name: 'hyperfy_show_capabilities',
  description: 'Show client capabilities and session information for diagnostics',
  parameters: z.object({}),
  execute: async (args, context) => {
    const sessionData = await getOrCreateSessionData();
    
    // Access the FastMCP session from context (using unknown for safety)
    const contextWithSession = context as unknown as { session?: unknown };
    
    const diagnosticInfo = {
      sessionInfo: {
        hasSessionData: !!sessionData,
        worldId: sessionData?.worldId,
        userId: sessionData?.userId,
        hyperfyConnected: !!sessionData?.hyperfyService
      },
      contextInfo: {
        hasContext: !!context,
        contextKeys: Object.keys(context || {}),
        hasLog: !!context.log,
        hasSession: !!contextWithSession?.session
      },
      serverInfo: {
        serverSessions: server.sessions.length,
        serverSessionsDetails: server.sessions.map(s => ({
          hasClientCapabilities: !!s.clientCapabilities,
          clientCapabilities: s.clientCapabilities,
          loggingLevel: s.loggingLevel,
          rootsCount: s.roots?.length || 0
        }))
      }
    };
    
    logger.info('🔍 Diagnostic capabilities check:', diagnosticInfo);
    
    const diagnosticText = `Hyperfy MCP Server Diagnostics:

**Session Information:**
- Session Data Available: ${diagnosticInfo.sessionInfo.hasSessionData}
- World ID: ${diagnosticInfo.sessionInfo.worldId || 'Not set'}
- User ID: ${diagnosticInfo.sessionInfo.userId || 'Not set'}
- Hyperfy Connected: ${diagnosticInfo.sessionInfo.hyperfyConnected}

**FastMCP Context:**
- Context Available: ${diagnosticInfo.contextInfo.hasContext}
- Context Keys: ${diagnosticInfo.contextInfo.contextKeys.join(', ')}
- Logging Available: ${diagnosticInfo.contextInfo.hasLog}
- Session in Context: ${diagnosticInfo.contextInfo.hasSession}

**Server Information:**
- Active Sessions: ${diagnosticInfo.serverInfo.serverSessions}
- Session Details: ${JSON.stringify(diagnosticInfo.serverInfo.serverSessionsDetails, null, 2)}

**Client Capabilities Analysis:**
${server.sessions.map((session, i) => `
Session ${i + 1}:
- Client Capabilities Available: ${!!session.clientCapabilities}
- Capabilities: ${session.clientCapabilities ? JSON.stringify(session.clientCapabilities, null, 2) : 'None detected'}
- Logging Level: ${session.loggingLevel}
- Roots: ${session.roots?.length || 0} roots
`).join('\n') || 'No active sessions'}

**Note:** For stdio transport, client capabilities may show as 'None detected' 
due to the nature of stdio vs httpStream transport. This is normal and 
does not affect tool functionality.
    `;
    
    const result: ActionResult = {
      success: true,
      message: diagnosticText,
      data: diagnosticInfo
    };
    
    return handleToolResult(result, 'hyperfy_show_capabilities');
  }
});

// Event handlers for server lifecycle
server.on('connect', (event) => {
  // For stdio transport, session authentication data isn't available in event.session
  // We use lazy initialization in tools instead
  const session = event.session;
  
  logger.debug('FastMCP connect event - stdio transport session structure:', {
    sessionKeys: Object.keys(session),
    sessionPrototype: Object.getPrototypeOf(session)?.constructor?.name,
    hasServer: 'server' in session,
    note: 'Session data will be lazily initialized when first tool is called'
  });
  
  // Show client capabilities if available
  const capabilities = session.clientCapabilities;
  if (capabilities) {
    logger.info('Client capabilities detected:', {
      tools: !!capabilities.tools,
      logging: !!capabilities.logging,
      roots: !!capabilities.roots,
      sampling: !!capabilities.sampling,
      prompts: !!capabilities.prompts,
      resources: !!capabilities.resources
    });
  } else {
    logger.warn('No client capabilities detected - this may cause the FastMCP warning');
  }
  
  logger.info('FastMCP client connected. Session will be initialized on first tool call.');
});

server.on('disconnect', (event) => {
  logger.info('FastMCP client disconnected. Cleaning up session...');
  
  try {
    // Clean up global session if it exists
    if (globalSessionData?.hyperfyService) {
      logger.debug('Cleaning up global Hyperfy service connection');
      // The individual services will handle their own cleanup
    }
    
    // Reset global session for next connection
    globalSessionData = null;
    sessionInitPromise = null;
    
    logger.debug('Session cleanup completed');
  } catch (error: unknown) {
    logger.error('Error cleaning up session:', error);
  }
});

export { server };
export default server;