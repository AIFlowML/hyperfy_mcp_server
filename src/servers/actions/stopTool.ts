import { z } from 'zod';
import type { ActionResult, LogType, StopSessionData } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
import type { HyperfyService } from '../../core/hyperfy-service.js';
import type { AgentControls } from '../../hyperfy/systems/controls.js';
import { v4 as uuidv4 } from 'uuid';

// Helper function for reason processing (inspired by original's reason handling)
function processStopReason(providedReason?: string): string {
  if (!providedReason || typeof providedReason !== 'string' || providedReason.trim() === '') {
    return 'stop action called';
  }
  
  // Clean and standardize reason text
  const cleanReason = providedReason.trim();
  
  // Add some intelligent reason categorization
  const urgentKeywords = ['emergency', 'urgent', 'halt', 'stop now', 'immediate'];
  const isUrgent = urgentKeywords.some(keyword => 
    cleanReason.toLowerCase().includes(keyword)
  );
  
  if (isUrgent && !cleanReason.toLowerCase().includes('urgent')) {
    return `${cleanReason} (urgent)`;
  }
  
  return cleanReason;
}

// Helper function to detect current activity type
function detectCurrentActivity(controls: AgentControls): 'navigation' | 'patrol' | 'unknown' {
  try {
    // Check if we have method to detect navigation state
    if (typeof (controls as unknown as { getIsNavigating?: () => boolean }).getIsNavigating === 'function') {
      if ((controls as unknown as { getIsNavigating: () => boolean }).getIsNavigating()) return 'navigation';
    }
    
    // Check if we have method to detect patrol state  
    if (typeof (controls as unknown as { getIsPatrolling?: () => boolean }).getIsPatrolling === 'function') {
      if ((controls as unknown as { getIsPatrolling: () => boolean }).getIsPatrolling()) return 'patrol';
    }
    
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

export const stopTool = {
  name: 'hyperfy_stop_moving',
  description: `Stops any current navigation or patrol activity for the agent within the connected Hyperfy world. This immediately halts all movement and cancels any ongoing pathfinding or automated behavior.

Examples of stop usage:
- "Stop moving" → Immediately halts current navigation
- "Halt all movement" → Stops any active navigation or patrol
- "Cancel current path" → Terminates pathfinding and stops agent
- "Stop now!" → Emergency stop with urgent priority
- "Cease patrol activity" → Ends patrol behavior and stops movement
- "Stop walking to the chair" → Cancels specific navigation task

Stop Scenarios & Behavior:
- **Navigation Cancellation**: Stops active goto/navigation commands immediately
- **Patrol Termination**: Ends automated patrol routes and movement patterns  
- **Emergency Stops**: Urgent halt commands get priority handling
- **Reason Tracking**: All stop commands are logged with reasons for context
- **State Preservation**: Agent position is maintained at stop location

Movement Types Affected:
- **Navigation**: Direct movement to specific coordinates or entities
- **Patrol Routes**: Automated movement patterns and route following
- **Pathfinding**: Active pathfinding calculations and execution
- **Physics Movement**: Any physics-based or scripted movement

The agent validates that movement systems are active before attempting to stop. Stop commands are tracked in session history for pattern analysis and debugging.

Conversation Flow Examples:
User: "Stop moving"
Agent: "Stopped current movement. Reason: stop action called"

User: "Emergency halt!"  
Agent: "Stopped current movement. Reason: Emergency halt! (urgent)"

User: "Cancel navigation to the fountain"
Agent: "Stopped current movement. Reason: Cancel navigation to the fountain"

Stop Effectiveness:
- **Immediate**: Movement stops within current physics frame
- **Complete**: All automated movement behaviors cease
- **Traceable**: Each stop is logged with unique ID for debugging
- **Contextual**: Reason provided helps understand stop motivation`,

  parameters: z.object({
    reason: z.string().optional().describe('Optional reason for stopping movement (defaults to "stop action called")'),
    urgent: z.boolean().optional().describe('Mark this as an urgent/emergency stop for priority handling'),
    context: z.string().optional().describe('Additional context about what activity should be stopped')
  }),

  execute: async (
    args: { reason?: string; urgent?: boolean; context?: string },
    context: {
      log: LogType,
      session: { data: McpSessionData }
    }
  ): Promise<ActionResult> => {
    const { reason: rawReason, urgent, context: stopContext } = args;
    const { log, session } = context;
    
    // Cast session data to include stop tracking
    const sessionData = session.data as StopSessionData;

    // Get HyperfyService and controls from session (properly typed)
    const service: HyperfyService = session.data.hyperfyService as HyperfyService;
    const controls: AgentControls = session.data.controls as AgentControls;

    // Process the stop reason using helper
    const processedReason = processStopReason(rawReason);
    const finalReason = urgent && !processedReason.includes('(urgent)') 
      ? `${processedReason} (urgent)` 
      : processedReason;

    log.info('Executing hyperfy_stop_moving', {
      reason: finalReason,
      urgent,
      hasContext: !!stopContext
    });

    try {
      // Connection and system validation (EXACT match to original)
      if (!service) {
        const errorMsg = "Error: Cannot stop movement. Hyperfy connection unavailable.";
        log.error('Hyperfy service not found for HYPERFY_STOP_MOVING action.');
        return {
          success: false,
          message: errorMsg,
          error: 'service_unavailable'
        };
      }

      if (!service.isConnected()) {
        const errorMsg = "Error: Cannot stop movement. Hyperfy not connected.";
        log.error('Hyperfy service not connected');
        return {
          success: false,
          message: errorMsg,
          error: 'not_connected'
        };
      }

      const world = service.getWorld();
      if (!world) {
        const errorMsg = "Error: Cannot stop movement. Hyperfy world not accessible.";
        log.error('Hyperfy world not accessible');
        return {
          success: false,
          message: errorMsg,
          error: 'world_unavailable'
        };
      }

      if (!controls) {
        const errorMsg = "Error: Cannot stop movement. Hyperfy connection/controls unavailable.";
        log.error('Hyperfy service or controls not found for HYPERFY_STOP_MOVING action.');
        return {
          success: false,
          message: errorMsg,
          error: 'controls_unavailable'
        };
      }

      // Method validation (EXACT match to original logic)
      if (typeof controls.stopNavigation !== 'function') {
        const errorMsg = "Error: Stop functionality not available in controls.";
        log.error('AgentControls missing stopNavigation method.');
        return {
          success: false,
          message: errorMsg,
          error: 'method_unavailable'
        };
      }

      // Detect current activity before stopping (MCP enhancement)
      const currentActivity = detectCurrentActivity(controls);

      // Execute stop using real controls system (EXACT match to original)
      log.info('Stopping navigation via AgentControls', {
        reason: finalReason,
        currentActivity,
        urgent
      });

      controls.stopNavigation(finalReason);

      // Generate unique stop ID for tracking
      const stopId = uuidv4();

      // Track stop in session history (MCP enhancement)
      const now = Date.now();
      sessionData.lastStopAction = now;
      sessionData.stopHistory = sessionData.stopHistory || [];
      sessionData.stopHistory.push({
        timestamp: now,
        reason: finalReason,
        stopId,
        success: true,
        previousActivity: currentActivity
      });

      // Keep only last 20 stop entries
      if (sessionData.stopHistory.length > 20) {
        sessionData.stopHistory = sessionData.stopHistory.slice(-20);
      }

      // Success response (EXACT match to original callback pattern)
      const responseMessage = `Stopped current movement. Reason: ${finalReason}`;

      log.info('Movement stopped successfully', {
        reason: finalReason,
        stopId,
        currentActivity,
        responseMessage
      });

      return {
        success: true,
        message: responseMessage,
        data: {
          stopId,
          reason: finalReason,
          previousActivity: currentActivity,
          timestamp: new Date().toISOString(),
          worldId: sessionData.worldId,
          userId: sessionData.userId,
          status: 'movement_stopped',
          urgent: urgent || false,
          // Action tracking (EXACT match to original)
          actions: ['HYPERFY_STOP_MOVING'],
          source: 'hyperfy'
        }
      };

    } catch (error) {
      // Graceful error handling (EXACT match to original)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log.error('Error during HYPERFY_STOP_MOVING', { error: errorMessage, args });
      
      // Track failed attempt in session
      const sessionData = session.data as StopSessionData;
      sessionData.stopHistory = sessionData.stopHistory || [];
      sessionData.stopHistory.push({
        timestamp: Date.now(),
        reason: finalReason,
        stopId: uuidv4(),
        success: false,
        previousActivity: 'unknown'
      });

      return {
        success: false,
        message: `Error stopping movement: ${errorMessage}`,
        error: 'stop_failed'
      };
    }
  }
}; 