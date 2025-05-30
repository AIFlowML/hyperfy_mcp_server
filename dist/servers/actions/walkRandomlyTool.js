import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
// Constants from original walk_randomly.ts (EXACT match)
const RANDOM_WALK_DEFAULT_INTERVAL = 4000; // ms (4 seconds)
const RANDOM_WALK_DEFAULT_MAX_DISTANCE = 30; // meters
// Helper function for walk state detection
function detectWalkState(controls) {
    try {
        // Use safe optional chaining for state detection
        return controls.getIsWalkingRandomly?.() || false;
    }
    catch (error) {
        return false;
    }
}
// Helper function to validate walk methods exist
function validateWalkMethods(controls) {
    return (typeof controls.startRandomWalk === 'function' &&
        typeof controls.stopRandomWalk === 'function');
}
// Helper function to format walk interval display
function formatWalkInterval(intervalMs) {
    const seconds = intervalMs / 1000;
    return `~${seconds.toFixed(1)}s`;
}
export const walkRandomlyTool = {
    name: 'hyperfy_walk_randomly',
    description: `Makes the agent continuously walk to random nearby points until stopped. This creates natural wandering behavior for autonomous agent movement within the Hyperfy world.

Examples of random walk scenarios:
- "Wander around for a bit" → Starts random walking with default 4-second intervals
- "Just pace around here" → Begins wandering in the local area  
- "Walk around randomly" → Initiates continuous random movement
- "Stop wandering" → Halts current random walking behavior
- "Start patrolling this area" → Begins random walk patrol pattern
- "Move around aimlessly" → Starts undirected wandering behavior

Random Walk Process & Behavior:
- **Continuous Movement**: Agent automatically selects new random destinations
- **Interval-Based**: Moves to new location every few seconds (configurable)
- **Distance Control**: Random points selected within specified radius
- **Natural Patterns**: Creates realistic wandering and exploration behavior
- **State Management**: Tracks walking status and can be stopped/started
- **Area Respect**: Stays within reasonable bounds of starting location

Walk Parameters & Customization:
- **Interval Control**: Adjust time between new destination selection (1-60 seconds)
- **Distance Range**: Control maximum distance for random point selection (1-100 meters)
- **Command Control**: Start new walks or stop existing ones
- **State Awareness**: Detects if agent is already walking randomly
- **Graceful Handling**: Proper start/stop state transitions

Walk Types Supported:
- **Exploration**: General area exploration and discovery
- **Patrolling**: Routine area monitoring and presence
- **Idle Behavior**: Natural movement during conversation pauses
- **Environmental**: Contextual wandering based on location
- **Social Positioning**: Movement during group interactions

The agent validates walk control availability, manages walking state properly, and provides appropriate feedback for walk commands. All walk actions are tracked in session history for behavior analysis.

Conversation Flow Examples:
User: "Wander around for a bit"
Agent: "Starting to wander randomly... (New target every ~4.0s)" (begins walking)

User: "Just pace around here" 
Agent: "Starting to wander randomly... (New target every ~4.0s)" (starts pacing)

User: "Stop wandering"
Agent: "Stopped wandering." (if was walking) OR "Was not wandering." (if not walking)

User: "Walk around more slowly"
Agent: "Starting to wander randomly... (New target every ~8.0s)" (with longer interval)

Walk Effectiveness:
- **Autonomous**: Self-managing movement without constant input
- **Contextual**: Appropriate for different social and environmental situations  
- **Configurable**: Adjustable timing and distance parameters
- **State-Aware**: Proper handling of start/stop transitions
- **Natural**: Creates believable agent presence and activity`,
    parameters: z.object({
        command: z.enum(['start', 'stop']).optional().describe('Start or stop random walking (default: start)'),
        interval: z.number().min(1).max(60).optional().describe('Interval between walks in seconds (default: 4)'),
        distance: z.number().min(1).max(100).optional().describe('Maximum distance for random walk (default: 30)'),
        pattern: z.string().optional().describe('Walk pattern type (e.g., "exploration", "patrol", "idle")'),
        context: z.string().optional().describe('Additional context for walk behavior')
    }),
    execute: async (args, context) => {
        const { command = 'start', interval, distance, pattern, context: walkContext } = args;
        const { log, session } = context;
        // Cast session data to include walk tracking
        const sessionData = session.data;
        // Get HyperfyService and controls from session (properly typed)
        const service = session.data.hyperfyService;
        const controls = session.data.controls;
        // Calculate parameters with defaults (EXACT match to original)
        const intervalMs = interval ? interval * 1000 : RANDOM_WALK_DEFAULT_INTERVAL;
        const maxDistance = distance || RANDOM_WALK_DEFAULT_MAX_DISTANCE;
        log.info('Executing hyperfy_walk_randomly', {
            command,
            interval,
            distance,
            pattern,
            hasContext: !!walkContext
        });
        try {
            // Connection and system validation (EXACT match to original)
            if (!service) {
                const errorMsg = "Error: Cannot wander. Hyperfy connection unavailable.";
                log.error('Hyperfy service not found for HYPERFY_WALK_RANDOMLY action.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'service_unavailable'
                };
            }
            if (!service.isConnected()) {
                const errorMsg = "Error: Cannot wander. Hyperfy not connected.";
                log.error('Hyperfy service not connected');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'not_connected'
                };
            }
            const world = service.getWorld();
            if (!world) {
                const errorMsg = "Error: Cannot wander. Hyperfy world not accessible.";
                log.error('Hyperfy world not accessible');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'world_unavailable'
                };
            }
            if (!controls) {
                const errorMsg = "Error: Cannot wander. Hyperfy connection/controls unavailable.";
                log.error('Hyperfy controls not found for HYPERFY_WALK_RANDOMLY action.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'controls_unavailable'
                };
            }
            // Walk method validation (EXACT match to original)
            if (!validateWalkMethods(controls)) {
                const errorMsg = "Error: Wander functionality not available in controls.";
                log.error('AgentControls missing startRandomWalk or stopRandomWalk methods.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'walk_methods_unavailable'
                };
            }
            // Generate unique walk ID for tracking
            const walkId = uuidv4();
            const now = Date.now();
            // Handle STOP command (EXACT match to original logic)
            if (command === 'stop') {
                const currentlyWalking = detectWalkState(controls);
                if (currentlyWalking) {
                    // Stop random walking
                    controls.stopRandomWalk();
                    log.info('Stopped random walking via controls', { walkId });
                    // Track stop action in session history
                    sessionData.lastWalkAction = now;
                    sessionData.walkHistory = sessionData.walkHistory || [];
                    sessionData.walkHistory.push({
                        timestamp: now,
                        command: 'stop',
                        walkId,
                        success: true,
                        previousState: true
                    });
                    sessionData.currentWalkId = undefined;
                    // Success response (EXACT match to original)
                    const responseMessage = "Stopped wandering.";
                    return {
                        success: true,
                        message: responseMessage,
                        data: {
                            walkId,
                            command: 'stop',
                            previousState: 'walking',
                            timestamp: new Date().toISOString(),
                            worldId: sessionData.worldId,
                            userId: sessionData.userId,
                            status: 'stopped',
                            // Action tracking (EXACT match to original)
                            actions: ['HYPERFY_WALK_RANDOMLY'],
                            source: 'hyperfy'
                        }
                    };
                }
                // Was not walking
                log.info('Agent was not walking randomly', { walkId });
                // Track stop attempt in session history
                sessionData.lastWalkAction = now;
                sessionData.walkHistory = sessionData.walkHistory || [];
                sessionData.walkHistory.push({
                    timestamp: now,
                    command: 'stop',
                    walkId,
                    success: true,
                    previousState: false
                });
                // Response for not walking (EXACT match to original)
                const responseMessage = "Was not wandering.";
                return {
                    success: true,
                    message: responseMessage,
                    data: {
                        walkId,
                        command: 'stop',
                        previousState: 'not_walking',
                        timestamp: new Date().toISOString(),
                        worldId: sessionData.worldId,
                        userId: sessionData.userId,
                        status: 'not_wandering',
                        // Source tracking (partial match to original)
                        source: 'hyperfy'
                    }
                };
            }
            // Handle START command (EXACT match to original logic)
            const currentlyWalking = detectWalkState(controls);
            // Start random walking with calculated parameters
            log.info('Starting random walking via controls', {
                walkId,
                interval,
                distance,
                pattern,
                currentlyWalking
            });
            controls.startRandomWalk(intervalMs, maxDistance);
            // Track start action in session history (MCP enhancement)
            sessionData.lastWalkAction = now;
            sessionData.walkHistory = sessionData.walkHistory || [];
            sessionData.walkHistory.push({
                timestamp: now,
                command: 'start',
                walkId,
                success: true,
                interval: intervalMs,
                distance: maxDistance,
                previousState: currentlyWalking
            });
            sessionData.currentWalkId = walkId;
            // Keep only last 20 walk entries
            if (sessionData.walkHistory.length > 20) {
                sessionData.walkHistory = sessionData.walkHistory.slice(-20);
            }
            // Success response (EXACT match to original format)
            const intervalDisplay = formatWalkInterval(intervalMs);
            const responseMessage = `Starting to wander randomly... (New target every ${intervalDisplay})`;
            log.info('Walk randomly started successfully', {
                walkId,
                interval,
                distance,
                pattern,
                responseMessage
            });
            return {
                success: true,
                message: responseMessage,
                data: {
                    walkId,
                    command: 'start',
                    interval: intervalMs,
                    distance: maxDistance,
                    intervalDisplay,
                    pattern,
                    context: walkContext,
                    previousState: currentlyWalking ? 'walking' : 'stationary',
                    timestamp: new Date().toISOString(),
                    worldId: sessionData.worldId,
                    userId: sessionData.userId,
                    status: 'started',
                    // Action tracking (EXACT match to original)
                    actions: ['HYPERFY_WALK_RANDOMLY'],
                    source: 'hyperfy'
                }
            };
        }
        catch (error) {
            // Graceful error handling (EXACT match to original)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            log.error('Error in HYPERFY_WALK_RANDOMLY', { error: errorMessage, args });
            // Track failed attempt in session
            const sessionData = session.data;
            sessionData.walkHistory = sessionData.walkHistory || [];
            sessionData.walkHistory.push({
                timestamp: Date.now(),
                command,
                walkId: uuidv4(),
                success: false,
                interval: intervalMs,
                distance: maxDistance
            });
            return {
                success: false,
                message: `Error in walk randomly: ${errorMessage}`,
                error: 'walk_randomly_failed'
            };
        }
    }
};
//# sourceMappingURL=walkRandomlyTool.js.map