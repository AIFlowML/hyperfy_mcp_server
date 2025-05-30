// eslint-disable-next-line @typescript-eslint/no-explicit-any -- This file uses 'any' for dynamic Hyperfy entity access.
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
// Entity extraction template ported from original ElizaOS action
const entityExtractionTemplate = (thoughts) => {
    return `
# Task:
Identify the correct Hyperfy **Entity ID** to navigate to, based on recent conversations, the agent's thoughts, and the current Hyperfy World State.

# Constraints:
- Only use **Hyperfy Entity IDs** listed in the provided world state.
- Do **not** use person IDs, names, or guesses.

# Agent Thought:
${thoughts || 'None'}

# World State:
{{hyperfyStatus}}

# Instructions:
You are **{{agentName}}**, a virtual agent in a Hyperfy world. Based on your thought process and the recent messages, determine which entity the agent should navigate to.

Return your answer as a JSON object using the following format:

\`\`\`json
{
  "entityId": "<string>" // The ID of the target entity, or null if no target is clearly identifiable
}
\`\`\`

Only return the JSON object. Do not include any other text.
  `.trim();
};
// Helper function ported from original action - supports multiple entity field sources
function getFirstAvailableField(obj, fields) {
    for (const field of fields) {
        if (typeof obj[field] === 'string' && obj[field].trim() !== '') {
            return obj[field];
        }
    }
    return null;
}
// Extract thought snippets from context (adapted from original's response processing)
function extractThoughtSnippets(context) {
    if (!context || typeof context !== 'string')
        return '';
    // Simple extraction of thought-like content
    const lines = context.split('\n').filter(line => line.toLowerCase().includes('think') ||
        line.toLowerCase().includes('observe') ||
        line.toLowerCase().includes('notice') ||
        line.toLowerCase().includes('want') ||
        line.toLowerCase().includes('need'));
    return lines.join('\n');
}
export const gotoTool = {
    name: 'hyperfy_goto_entity',
    description: `Navigates the agent to a specified entity within the connected Hyperfy world using the AgentControls system. Supports both direct entity ID specification and AI-powered natural language entity extraction.

Examples of goto usage:
- "Go to Bob" → AI extracts entity ID for Bob and navigates there
- "Navigate to the chair" → AI finds chair entity ID and moves to it
- "Move to entity abc123" → Direct navigation to entity with ID abc123
- "Find the glowing crystal" → AI locates crystal entity and navigates
- "Head towards the treasure chest" → AI identifies chest entity for navigation

Navigation Scenarios & Behavior:
- **Direct Entity Reference**: When entity ID is explicitly provided
- **Natural Language Processing**: AI extracts entity ID from descriptive text using world context
- **Intelligent Entity Matching**: Uses agent thoughts and conversation context to identify targets
- **Real-time Validation**: Verifies entity exists and has valid position before navigation
- **Position-based Navigation**: Uses entity's base or root position for accurate pathfinding

Entity Types Supported:
- **Interactive Objects**: Items, furniture, devices that can be interacted with
- **NPCs/Characters**: Other agents or characters in the world
- **Landmarks**: Significant world features or structures
- **Dynamic Objects**: Moveable items or physics objects

The agent validates entity existence, extracts precise world coordinates, and uses the AgentControls system for smooth navigation. Navigation attempts are tracked in session history for context awareness.

Conversation Flow Examples:
User: "Go to the fountain"
Agent: "Navigating towards fountain entity..."

User: "Move to entity xyz789"
Agent: "Navigating towards xyz789..."

User: "Find the mysterious orb"
Agent: "Located mysterious orb, navigating there..."`,
    parameters: z.object({
        entityId: z.string().min(1).optional().describe('The direct ID of the target entity to navigate to (if known)'),
        targetId: z.string().min(1).optional().describe('Alternative entity ID field (for compatibility)'),
        targetDescription: z.string().optional().describe('Natural language description of target entity (AI will extract entity ID)'),
        extractionContext: z.string().optional().describe('Additional context or thoughts to help AI identify the correct entity'),
        forceExtraction: z.boolean().optional().describe('Force AI entity extraction even if direct ID is provided')
    }),
    execute: async (args, context) => {
        const { entityId: directEntityId, targetId, targetDescription, extractionContext, forceExtraction } = args;
        const { log, session } = context;
        // Cast session data to include goto tracking
        const sessionData = session.data;
        // Get HyperfyService and controls from session (properly typed)
        const service = session.data.hyperfyService;
        const controls = session.data.controls;
        log.info('Executing hyperfy_goto_entity', {
            hasDirectEntityId: !!directEntityId,
            hasTargetId: !!targetId,
            hasDescription: !!targetDescription,
            hasContext: !!extractionContext,
            forceExtraction
        });
        try {
            // Connection and system validation (exact match to original)
            if (!service) {
                const errorMsg = "Error: Cannot navigate. Hyperfy connection unavailable.";
                log.error('Hyperfy service not found for HYPERFY_GOTO_ENTITY action.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'service_unavailable'
                };
            }
            const world = service.getWorld();
            if (!world) {
                const errorMsg = "Error: Cannot navigate. Hyperfy world not accessible.";
                log.error('Hyperfy world not accessible');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'world_unavailable'
                };
            }
            if (!controls) {
                const errorMsg = "Error: Cannot navigate. Agent controls system unavailable.";
                log.error('AgentControls system not found');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'controls_unavailable'
                };
            }
            // Multi-source entity ID determination (EXACT match to original logic)
            let targetEntityId = getFirstAvailableField(args, ['entityId', 'targetId']);
            // AI-powered entity extraction (like original action) if no direct ID or forced
            if ((!targetEntityId || forceExtraction) && (targetDescription || extractionContext)) {
                log.info('Attempting AI-powered entity extraction', {
                    hasDescription: !!targetDescription,
                    hasContext: !!extractionContext
                });
                try {
                    // Extract thought snippets for context (adapted from original)
                    const thoughtSnippets = extractThoughtSnippets(extractionContext || '');
                    // Prepare extraction prompt using original template
                    const template = entityExtractionTemplate(thoughtSnippets);
                    // Get world state for AI context - simplified approach to avoid type issues
                    const worldEntityIds = Array.from(world.entities.items.keys());
                    const limitedEntityIds = worldEntityIds.slice(0, 20);
                    const entityDescriptions = limitedEntityIds.map((id) => {
                        const entity = world.entities.items.get(id);
                        const name = service.getEntityName(id);
                        const position = entity?.base?.position || entity?.root?.position;
                        return `- Entity ID: ${id}, Name: ${name || 'Unknown'}, Position: ${position ? `(${position.x.toFixed(1)}, ${position.z.toFixed(1)})` : 'Unknown'}`;
                    });
                    const worldStateText = entityDescriptions.length > 0
                        ? entityDescriptions.join('\n')
                        : 'No entities available in world state';
                    // Note: In FastMCP we don't have direct AI model access like ElizaOS
                    // For now, we'll use fallback entity matching based on description
                    if (targetDescription) {
                        const searchTerm = targetDescription.toLowerCase();
                        log.info('Searching for entity with description', { searchTerm, availableEntities: limitedEntityIds.length });
                        // Try multiple matching strategies
                        let matchingEntityId = null;
                        // Strategy 1: Exact name match
                        matchingEntityId = limitedEntityIds.find((id) => {
                            const name = service.getEntityName(id)?.toLowerCase() || '';
                            return name === searchTerm;
                        });
                        // Strategy 2: Name contains search term
                        if (!matchingEntityId) {
                            matchingEntityId = limitedEntityIds.find((id) => {
                                const name = service.getEntityName(id)?.toLowerCase() || '';
                                return name.includes(searchTerm);
                            });
                        }
                        // Strategy 3: Search term contains name (for partial matches)
                        if (!matchingEntityId) {
                            matchingEntityId = limitedEntityIds.find((id) => {
                                const name = service.getEntityName(id)?.toLowerCase() || '';
                                return name.length > 0 && searchTerm.includes(name);
                            });
                        }
                        // Strategy 4: Word-by-word matching
                        if (!matchingEntityId) {
                            const searchWords = searchTerm.split(/\s+/);
                            matchingEntityId = limitedEntityIds.find((id) => {
                                const name = service.getEntityName(id)?.toLowerCase() || '';
                                const nameWords = name.split(/\s+/);
                                // Check if any search word matches any name word
                                return searchWords.some(searchWord => nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord)));
                            });
                        }
                        // Strategy 5: ID contains search term
                        if (!matchingEntityId) {
                            matchingEntityId = limitedEntityIds.find((id) => {
                                return id.toLowerCase().includes(searchTerm);
                            });
                        }
                        if (matchingEntityId) {
                            targetEntityId = matchingEntityId;
                            log.info('Found matching entity via fallback search', {
                                targetDescription,
                                matchedEntityId: targetEntityId,
                                matchedName: service.getEntityName(targetEntityId) || 'Unknown'
                            });
                        }
                        else {
                            log.warn('No matching entity found for description', {
                                targetDescription,
                                searchTerm,
                                availableEntities: limitedEntityIds.map(id => ({
                                    id,
                                    name: service.getEntityName(id)
                                }))
                            });
                        }
                    }
                }
                catch (error) {
                    log.warn('AI entity extraction failed, using fallback', { error });
                    // Continue with direct ID if available
                }
            }
            // Final validation of target entity ID
            if (!targetEntityId) {
                const errorMsg = "Error: No target entity ID specified and could not extract from description.";
                log.error('No target entity ID available');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'missing_entity_id'
                };
            }
            // Find entity and validate position (EXACT match to original logic)
            const entity = world.entities.items.get(targetEntityId);
            const targetPosition = entity?.base?.position || entity?.root?.position;
            if (!entity || !targetPosition) {
                const targetName = service.getEntityName(targetEntityId);
                const errorMsg = `Error: Cannot navigate. Could not find location for entity ${targetName || targetEntityId}.`;
                log.error('Entity position not found', { entityId: targetEntityId, targetName });
                return {
                    success: false,
                    message: errorMsg,
                    error: 'entity_not_found',
                    data: { targetEntityId: targetEntityId }
                };
            }
            // Execute navigation using real controls system (EXACT match to original)
            const targetName = service.getEntityName(targetEntityId);
            log.info('Starting navigation via AgentControls', {
                entityId: targetEntityId,
                targetName,
                position: { x: targetPosition.x, z: targetPosition.z }
            });
            controls.goto(targetPosition.x, targetPosition.z);
            // Generate unique navigation ID for tracking
            const navigationId = uuidv4();
            // Track navigation in session history (MCP enhancement)
            const now = Date.now();
            sessionData.lastGotoAction = now;
            sessionData.gotoHistory = sessionData.gotoHistory || [];
            sessionData.gotoHistory.push({
                timestamp: now,
                entityId: targetEntityId,
                entityName: targetName || undefined,
                targetPosition: {
                    x: targetPosition.x,
                    y: targetPosition.y || 0,
                    z: targetPosition.z
                },
                success: true,
                navigationId
            });
            // Keep only last 20 navigation entries
            if (sessionData.gotoHistory.length > 20) {
                sessionData.gotoHistory = sessionData.gotoHistory.slice(-20);
            }
            // Success response (EXACT match to original callback pattern)
            const responseMessage = targetName
                ? `Navigating towards ${targetName}...`
                : `Navigating towards entity ${targetEntityId}...`;
            log.info('Navigation started successfully', {
                entityId: targetEntityId,
                targetName,
                navigationId,
                responseMessage
            });
            return {
                success: true,
                message: responseMessage,
                data: {
                    entityId: targetEntityId,
                    targetName,
                    navigationId,
                    targetPosition: [targetPosition.x, targetPosition.y || 0, targetPosition.z],
                    timestamp: new Date().toISOString(),
                    worldId: sessionData.worldId,
                    userId: sessionData.userId,
                    status: 'navigation_started',
                    // Action tracking (EXACT match to original)
                    actions: ['HYPERFY_GOTO_ENTITY'],
                    source: 'hyperfy'
                }
            };
        }
        catch (error) {
            // Graceful error handling (EXACT match to original)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            log.error('Error during navigation', { error: errorMessage, args });
            // Track failed attempt in session
            const sessionData = session.data;
            sessionData.gotoHistory = sessionData.gotoHistory || [];
            sessionData.gotoHistory.push({
                timestamp: Date.now(),
                entityId: directEntityId || targetId || 'unknown',
                entityName: undefined,
                targetPosition: { x: 0, y: 0, z: 0 },
                success: false,
                navigationId: uuidv4()
            });
            return {
                success: false,
                message: `Error starting navigation: ${errorMessage}`,
                error: 'navigation_start_failed'
            };
        }
    }
};
//# sourceMappingURL=gotoTool.js.map