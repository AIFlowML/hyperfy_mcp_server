import { z } from 'zod';
import { EMOTES_LIST } from '../config/constants.js';
import { generateUUID } from '../../utils/utils.js';
export const getWorldStateTool = {
    name: 'hyperfy_get_world_state',
    description: `Retrieves comprehensive world state information including entities, agent status, available actions, and recent messages.

This tool provides complete situational awareness for the Hyperfy agent, including:

**Agent Information**:
- Current position, rotation, and status
- Entity ID and connection details
- Equipped items or active actions

**Entity Management**:
- All entities in the world with positions and types
- Categorized by entity type (players, objects, NPCs, etc.)
- Distance calculations and spatial relationships

**Interactable Objects**:
- Nearby actions and objects (within specified radius)
- Available interactions and their requirements
- Current equipment and usage status

**Communication Context**:
- Recent chat messages and conversation history
- Message timestamps and participant information
- Communication channels and activity

**Animation Options**:
- Available emotes and expressions
- Animation categories and descriptions
- Performance capabilities

**Use Cases**:
- Autonomous behavior decision making
- Environmental awareness for navigation
- Social interaction context
- Action planning and execution
- Spatial reasoning and positioning

The tool returns both structured data for programmatic use and formatted text for AI consumption. This comprehensive world state enables intelligent agent behavior and contextual decision making.`,
    parameters: z.object({
        includeChat: z.boolean().optional().describe('Include recent chat messages (default: true)'),
        includeEmotes: z.boolean().optional().describe('Include available emotes list (default: true)'),
        actionRadius: z.number().optional().describe('Radius in meters for nearby actions (default: 50)'),
        format: z.enum(['structured', 'text', 'both']).optional().describe('Response format preference (default: both)')
    }),
    execute: async (args, context) => {
        const { includeChat = true, includeEmotes = true, actionRadius = 50, format = 'both' } = args;
        const { log, session } = context;
        log.info('Executing hyperfy_get_world_state', {
            includeChat,
            includeEmotes,
            actionRadius,
            format
        });
        try {
            // Get HyperfyService from session
            const service = session.data.hyperfyService;
            if (!service || !service.isConnected()) {
                const disconnectedResponse = {
                    status: 'disconnected',
                    message: 'Hyperfy world connection unavailable',
                    timestamp: new Date().toISOString()
                };
                return {
                    success: true,
                    message: 'World state retrieved (disconnected)',
                    data: format === 'text' ? {
                        formatted_text: '# Hyperfy World State\nConnection Status: Disconnected'
                    } : disconnectedResponse
                };
            }
            const world = service.getWorld();
            const messageManager = service.getMessageManager();
            const currentWorldId = service.currentWorldId;
            if (!world) {
                throw new Error('World object not available from service');
            }
            // Generate room ID for message context (using FastMCP UUID generation)
            const elizaRoomId = `${generateUUID()}-${currentWorldId || 'hyperfy-unknown-world'}`;
            const entities = world?.entities?.items;
            const agentId = world?.entities?.player?.data?.id;
            // Process entities and categorize them
            const allEntityIds = [];
            const categorizedEntities = {};
            let agentText = '## Agent Info (You)\nUnable to find your own entity.';
            const structuredEntities = [];
            if (entities) {
                for (const [id, entity] of entities.entries()) {
                    const name = entity?.data?.name || entity?.blueprint?.name || 'Unnamed';
                    const type = entity?.data?.type || 'unknown';
                    const pos = entity?.base?.position || entity?.root?.position;
                    // Handle position data - check for THREE.Vector3-like objects
                    let positionData = null;
                    let posStr = 'N/A';
                    if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos && 'z' in pos) {
                        positionData = {
                            x: Number(pos.x),
                            y: Number(pos.y),
                            z: Number(pos.z)
                        };
                        posStr = `[${[positionData.x, positionData.y, positionData.z].map(p => p.toFixed(2)).join(', ')}]`;
                    }
                    if (id === agentId) {
                        agentText = `## Agent Info (You)\nEntity ID: ${id}, Name: ${name}, Position: ${posStr}`;
                        structuredEntities.push({
                            id: String(id),
                            name,
                            type: 'agent',
                            position: positionData
                        });
                        continue;
                    }
                    allEntityIds.push(String(id));
                    const line = `- Name: ${name}, Entity ID: ${id}, Position: ${posStr}`;
                    if (!categorizedEntities[type]) {
                        categorizedEntities[type] = [];
                    }
                    categorizedEntities[type].push(line);
                    structuredEntities.push({
                        id: String(id),
                        name,
                        type,
                        position: positionData
                    });
                }
            }
            // Format categorized entities text
            let categorizedSummary = '';
            for (const [type, lines] of Object.entries(categorizedEntities)) {
                categorizedSummary = `${categorizedSummary}\n\n## ${type[0].toUpperCase() + type.slice(1)} Entities (${lines.length})\n${lines.join('\n')}`;
            }
            // Process nearby actions and interactables
            const actionsSystem = world?.actions;
            const nearbyActions = actionsSystem?.getNearby(actionRadius) || [];
            const currentAction = actionsSystem?.getCurrentNode();
            const actionLines = [];
            const structuredActions = [];
            for (const action of nearbyActions) {
                const entity = action.ctx?.entity;
                const pos = entity?.root?.position;
                let positionData = null;
                let posStr = 'N/A';
                if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos && 'z' in pos) {
                    positionData = {
                        x: Number(pos.x),
                        y: Number(pos.y),
                        z: Number(pos.z)
                    };
                    posStr = `[${[positionData.x, positionData.y, positionData.z].map(p => p.toFixed(2)).join(', ')}]`;
                }
                const label = action._label ?? 'Unnamed Action';
                const entityId = entity?.data?.id ?? 'unknown';
                const entityName = entity?.blueprint?.name ?? 'Unnamed';
                actionLines.push(`- Entity ID: ${entityId}, Entity Name: ${entityName}, Action: ${label}, Position: ${posStr}`);
                structuredActions.push({
                    entityId: String(entityId),
                    entityName,
                    action: label,
                    position: positionData
                });
            }
            const actionHeader = `## Nearby Interactable Objects (${actionLines.length})`;
            const actionBody = actionLines.length > 0
                ? actionLines.join('\n')
                : 'There are no interactable objects nearby.';
            const actionText = `${actionHeader}\n${actionBody}`;
            // Process current equipment/action
            const equipText = currentAction ? (() => {
                const entity = currentAction.ctx?.entity;
                const label = currentAction._label ?? 'Unnamed Action';
                const entityId = entity?.data?.id ?? 'unknown';
                const entityName = entity?.blueprint?.name ?? 'Unnamed';
                return `## Your Equipped Item or Action\nYou are currently using:\n- Action: ${label}, Entity Name: ${entityName}, Entity ID: ${entityId}`;
            })() : '## Your Equipped Item or Action\nYou are not currently performing or holding anything.';
            const currentEquipment = currentAction ? {
                action: currentAction._label ?? 'Unnamed Action',
                entityId: String(currentAction.ctx?.entity?.data?.id ?? 'unknown'),
                entityName: currentAction.ctx?.entity?.blueprint?.name ?? 'Unnamed'
            } : null;
            // Get chat history if requested
            let chatText = '';
            let chatHistory = [];
            if (includeChat && messageManager) {
                try {
                    const recentMessages = await messageManager.getRecentMessages(elizaRoomId);
                    chatText = `## In-World Messages\n${recentMessages}`;
                    chatHistory = recentMessages ? [recentMessages] : [];
                }
                catch (error) {
                    log.warn('Failed to get chat history:', error);
                    chatText = '## In-World Messages\nChat history unavailable';
                }
            }
            // Get emotes list if requested
            let animationText = '';
            let emotesList = [];
            if (includeEmotes) {
                const animationListText = EMOTES_LIST.map((e) => `- **${e.name}**: ${e.description}`).join('\n');
                animationText = `## Available Animations\n${animationListText}`;
                emotesList = EMOTES_LIST.map(e => ({ name: e.name, description: e.description }));
            }
            // Compose response based on format preference
            const formattedText = `# Hyperfy World State\n\n${agentText}${categorizedSummary}\n\n${actionText}\n\n${equipText}${includeChat ? `\n\n${chatText}` : ''}${includeEmotes ? `\n\n${animationText}` : ''}`;
            const structuredData = {
                status: 'connected',
                worldId: currentWorldId,
                timestamp: new Date().toISOString(),
                agent: {
                    id: String(agentId || 'unknown'),
                    entities: structuredEntities.filter(e => e.type === 'agent')[0] || null
                },
                entities: structuredEntities.filter(e => e.type !== 'agent'),
                nearbyActions: structuredActions,
                currentEquipment,
                ...(includeChat && { chatHistory }),
                ...(includeEmotes && { availableEmotes: emotesList }),
                summary: {
                    totalEntities: structuredEntities.length,
                    nearbyActions: structuredActions.length,
                    hasEquipment: !!currentEquipment,
                    connectionStatus: 'connected'
                }
            };
            // Return data based on format preference
            let responseData;
            let responseMessage;
            switch (format) {
                case 'structured':
                    responseData = structuredData;
                    responseMessage = `Retrieved world state with ${structuredEntities.length} entities and ${structuredActions.length} nearby actions (structured format)`;
                    break;
                case 'text':
                    responseData = { formatted_text: formattedText };
                    responseMessage = `Retrieved world state with ${structuredEntities.length} entities and ${structuredActions.length} nearby actions (text format)`;
                    break;
                case 'both':
                    responseData = {
                        ...structuredData,
                        formatted_text: formattedText
                    };
                    responseMessage = `Retrieved world state with ${structuredEntities.length} entities and ${structuredActions.length} nearby actions`;
                    break;
            }
            log.info('World state retrieved successfully', {
                format,
                entityCount: structuredEntities.length,
                actionCount: structuredActions.length,
                includeChat,
                includeEmotes,
                actionRadius,
                hasCurrentEquipment: !!currentEquipment
            });
            return {
                success: true,
                message: responseMessage,
                data: responseData
            };
        }
        catch (error) {
            // Graceful error handling
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            log.error('Error retrieving world state:', { error: errorMessage, args });
            return {
                success: false,
                message: `Failed to retrieve world state: ${errorMessage}`,
                error: 'world_state_retrieval_failed'
            };
        }
    }
};
//# sourceMappingURL=getWorldStateTool.js.map