import { FastMCP } from 'fastmcp';
import type { PlayerState, WorldState } from '../types/index.js';
import type { HyperfyService } from '../core/hyperfy-service.js';
import type { AgentControls } from '../hyperfy/systems/controls.js';
import type { AgentActions } from '../hyperfy/systems/actions.js';
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
declare const server: FastMCP<McpSessionData>;
export { server };
export default server;
//# sourceMappingURL=server.d.ts.map