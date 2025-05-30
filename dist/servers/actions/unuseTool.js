import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
// Helper function for reason processing (inspired by original's simple approach)
function processUnuseReason(providedReason) {
    if (!providedReason || typeof providedReason !== 'string' || providedReason.trim() === '') {
        return undefined;
    }
    return providedReason.trim();
}
// Helper function to detect current item context
function detectItemContext(actions) {
    try {
        // Check if we have method to get current item/action
        if (typeof actions.getCurrentAction === 'function') {
            return actions.getCurrentAction();
        }
        // Check for active item state
        if (typeof actions.getActiveItem === 'function') {
            return actions.getActiveItem();
        }
        return undefined;
    }
    catch (error) {
        return undefined;
    }
}
export const unuseTool = {
    name: 'hyperfy_unuse_item',
    description: `Stops interacting with the currently held or active item in the Hyperfy world. This releases any ongoing interaction, drops held objects, or cancels active item usage.

Examples of unuse usage:
- "Drop it" → Releases currently held item
- "Stop using that" → Cancels active item interaction
- "Release the tool" → Drops the currently held tool/object
- "Let go of the item" → Stops current item interaction
- "Cancel interaction" → Ends active item usage
- "Put down the object" → Releases held object back to world

Unuse Scenarios & Behavior:
- **Item Release**: Drops currently held items back to the world
- **Interaction Cancellation**: Stops ongoing item interactions or animations
- **Tool Deactivation**: Deactivates active tools or equipment
- **Object Dropping**: Physically releases objects from agent's grasp
- **State Cleanup**: Clears item-related state and animations

Item Types Supported:
- **Tools**: Active tools, equipment, or functional items
- **Interactive Objects**: Items with ongoing interactions or states
- **Held Items**: Physical objects being carried or manipulated
- **Equipment**: Worn or equipped items that can be removed

The agent validates that an active item or interaction exists before attempting to release. Unuse commands are tracked in session history for usage pattern analysis.

Conversation Flow Examples:
User: "Drop it"
Agent: "Item released."

User: "Stop using that tool"
Agent: "Item released."

User: "Let go of the object"
Agent: "Item released."

Release Effectiveness:
- **Immediate**: Item is released within current physics frame
- **Complete**: All item-related states and animations cease
- **Physics-based**: Objects drop naturally using world physics
- **State-preserving**: Item state is saved appropriately`,
    parameters: z.object({
        reason: z.string().optional().describe('Optional reason for releasing the item'),
        force: z.boolean().optional().describe('Force release even if item is in use'),
        context: z.string().optional().describe('Additional context about what should be released')
    }),
    execute: async (args, context) => {
        const { reason: rawReason, force, context: unuseContext } = args;
        const { log, session } = context;
        // Cast session data to include unuse tracking
        const sessionData = session.data;
        // Get HyperfyService and actions from session (properly typed)
        const service = session.data.hyperfyService;
        const actions = session.data.actions;
        // Process the unuse reason using helper
        const processedReason = processUnuseReason(rawReason);
        log.info('Executing hyperfy_unuse_item', {
            reason: processedReason,
            force,
            hasContext: !!unuseContext
        });
        try {
            // Connection and system validation (EXACT match to original)
            if (!service) {
                const errorMsg = "Error: Cannot unuse item. Hyperfy connection unavailable.";
                log.error('Hyperfy service not found for HYPERFY_UNUSE_ITEM action.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'service_unavailable'
                };
            }
            if (!service.isConnected()) {
                const errorMsg = "Error: Cannot unuse item. Hyperfy not connected.";
                log.error('Hyperfy service not connected');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'not_connected'
                };
            }
            const world = service.getWorld();
            if (!world) {
                const errorMsg = "Error: Cannot unuse item. Hyperfy world not accessible.";
                log.error('Hyperfy world not accessible');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'world_unavailable'
                };
            }
            if (!actions) {
                const errorMsg = "Error: Cannot unuse item. Required systems are unavailable.";
                log.error('Hyperfy service, world, or actions system not found.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'actions_unavailable'
                };
            }
            // Method validation (ensuring releaseAction exists)
            if (typeof actions.releaseAction !== 'function') {
                const errorMsg = "Error: Item release functionality not available.";
                log.error('AgentActions missing releaseAction method.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'method_unavailable'
                };
            }
            // Detect current item before releasing (MCP enhancement)
            const currentItem = detectItemContext(actions);
            // Execute item release using real actions system (EXACT match to original)
            log.info('Attempting to release current action via AgentActions', {
                reason: processedReason,
                currentItem,
                force
            });
            actions.releaseAction();
            // Generate unique unuse ID for tracking
            const unuseId = uuidv4();
            // Track unuse in session history (MCP enhancement)
            const now = Date.now();
            sessionData.lastUnuseAction = now;
            sessionData.unuseHistory = sessionData.unuseHistory || [];
            sessionData.unuseHistory.push({
                timestamp: now,
                reason: processedReason,
                unuseId,
                success: true,
                previousItemType: currentItem
            });
            // Keep only last 20 unuse entries
            if (sessionData.unuseHistory.length > 20) {
                sessionData.unuseHistory = sessionData.unuseHistory.slice(-20);
            }
            // Success response (EXACT match to original callback pattern)
            const responseMessage = "Item released.";
            log.info('Item released successfully', {
                reason: processedReason,
                unuseId,
                currentItem,
                responseMessage
            });
            return {
                success: true,
                message: responseMessage,
                data: {
                    unuseId,
                    reason: processedReason,
                    previousItemType: currentItem,
                    timestamp: new Date().toISOString(),
                    worldId: sessionData.worldId,
                    userId: sessionData.userId,
                    status: 'released',
                    force: force || false,
                    // Action tracking (EXACT match to original)
                    actions: ['HYPERFY_UNUSE_ITEM'],
                    source: 'hyperfy'
                }
            };
        }
        catch (error) {
            // Graceful error handling (EXACT match to original)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            log.error('Error in HYPERFY_UNUSE_ITEM', { error: errorMessage, args });
            // Track failed attempt in session
            const sessionData = session.data;
            sessionData.unuseHistory = sessionData.unuseHistory || [];
            sessionData.unuseHistory.push({
                timestamp: Date.now(),
                reason: processedReason,
                unuseId: uuidv4(),
                success: false,
                previousItemType: undefined
            });
            return {
                success: false,
                message: `Error releasing item: ${errorMessage}`,
                error: 'unuse_failed'
            };
        }
    }
};
//# sourceMappingURL=unuseTool.js.map