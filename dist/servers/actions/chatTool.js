import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
export const chatTool = {
    name: 'hyperfy_chat',
    description: `Sends a chat message within the connected Hyperfy world. Use this to communicate with other users in the world.

Examples of chat usage:
- "Say hello in Hyperfy" → Sends "Hello there!" to world chat
- "Tell everyone I have arrived" → Sends "I have arrived" to world chat  
- "Greet the other players" → Sends "Hey everyone, good to be here!" to world chat
- "Ask if anyone needs help" → Sends "Does anyone need assistance?" to world chat
- "Share something interesting" → Sends contextual message about current observations
- "Whisper to user123 that I'm ready" → Sends private message to specific user

Chat Scenarios & Behavior:
- **Arrival/Greeting**: When entering a world or meeting new users
- **Contextual Communication**: Sharing observations about the environment
- **Social Interaction**: Responding to or initiating conversations with others
- **Information Sharing**: Communicating discoveries or useful information
- **Coordination**: Working with other users on activities or objectives

Channel Types:
- **Local Chat** (default): Visible to nearby users in the immediate area
- **World Chat**: Broadcast to all users currently in the world
- **Whisper**: Private message to a specific user

The agent validates connection status, supports multiple text input sources, and provides graceful error handling. Messages are tracked in session history for context awareness.

Conversation Flow Examples:
User: "Say hello in Hyperfy"
Agent: "Sent message to Hyperfy: 'Hello there!'"

User: "Tell everyone in the world I have arrived"  
Agent: "Sent message to Hyperfy: 'I have arrived'"

User: "Let other players know I'm exploring the eastern area"
Agent: "Sent message to Hyperfy: 'Currently exploring the eastern area, let me know if you're nearby!'"`,
    parameters: z.object({
        message: z.string().min(1).describe('The message to send in the world chat'),
        channel: z.enum(['local', 'world', 'whisper']).optional().describe('The chat channel to use (default: local)'),
        targetUserId: z.string().optional().describe('Target user ID for whisper messages'),
        text: z.string().optional().describe('Alternative text source (for compatibility with various input formats)')
    }),
    execute: async (args, context) => {
        const { message: directMessage, channel = 'local', targetUserId, text } = args;
        const { log, session } = context;
        // Cast session data to include chat tracking
        const sessionData = session.data;
        // Get HyperfyService instance from session (properly typed)
        // Correctly access hyperfyService from session.data (which is McpSessionData)
        // instead of sessionData (which is ChatSessionData and may not have this property).
        const service = session.data.hyperfyService;
        log.info('Executing hyperfy_chat', {
            hasDirectMessage: !!directMessage,
            hasAlternativeText: !!text,
            channel,
            targetUserId
        });
        try {
            // Connection validation (exact match to original ElizaOS validate function)
            if (!service) {
                const errorMsg = "Error: Could not send message. Hyperfy connection unavailable.";
                log.error('Hyperfy service not found for HYPERFY_CHAT action.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'service_unavailable'
                };
            }
            // Check connection status (like original's validate function)
            if (!service.isConnected()) {
                const errorMsg = "Error: Could not send message. Hyperfy not connected.";
                log.error('Hyperfy service not connected');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'not_connected'
                };
            }
            // Multi-source text determination (EXACT match to original logic)
            // Original: options?.text || message.content.text || '...'
            // MCP equivalent: text || directMessage || '...'
            const textToSend = text || directMessage || '...';
            if (!textToSend || textToSend === '...') {
                const errorMsg = "Action failed: No message text specified.";
                log.warn('HYPERFY_CHAT: No text provided to send.');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'no_text_provided'
                };
            }
            // Whisper validation (MCP enhancement, not in original)
            if (channel === 'whisper' && !targetUserId) {
                const errorMsg = "Error: Target user ID is required for whisper messages.";
                log.error('Whisper attempted without target user ID');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'missing_whisper_target'
                };
            }
            // Get message manager (EXACT match to original approach)
            const messageManager = service.getMessageManager();
            if (!messageManager) {
                const errorMsg = "Error: Hyperfy message system unavailable.";
                log.error('Message manager not available');
                return {
                    success: false,
                    message: errorMsg,
                    error: 'message_manager_unavailable'
                };
            }
            // Send message using real Hyperfy system (EXACT match to original)
            await messageManager.sendMessage(textToSend);
            // Generate unique message ID for tracking (using imported uuid)
            const messageId = uuidv4();
            // Track chat history in session (MCP enhancement)
            const now = Date.now();
            sessionData.lastChatMessage = now;
            sessionData.chatHistory = sessionData.chatHistory || [];
            sessionData.chatHistory.push({
                timestamp: now,
                message: textToSend,
                channel,
                targetUserId,
                success: true
            });
            // Keep only last 20 chat entries
            if (sessionData.chatHistory.length > 20) {
                sessionData.chatHistory = sessionData.chatHistory.slice(-20);
            }
            // Success response (EXACT match to original callback pattern)
            const responseMessage = targetUserId
                ? `Whispered to ${targetUserId}: "${textToSend}"`
                : `Sent message to Hyperfy: "${textToSend}"`;
            log.info('Chat message sent successfully', {
                channel,
                messageLength: textToSend.length,
                hasTarget: !!targetUserId,
                messageId,
                responseMessage
            });
            return {
                success: true,
                message: responseMessage,
                data: {
                    message: textToSend,
                    messageId, // Use generated UUID
                    channel,
                    targetUserId,
                    timestamp: new Date().toISOString(),
                    worldId: sessionData.worldId,
                    userId: sessionData.userId,
                    // Action tracking (EXACT match to original)
                    actions: ['HYPERFY_CHAT'],
                    source: 'hyperfy'
                }
            };
        }
        catch (error) {
            // Graceful error handling (EXACT match to original)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            log.error('Error sending Hyperfy chat message via service:', { error: errorMessage, args });
            // Track failed attempt in session
            const sessionData = session.data;
            sessionData.chatHistory = sessionData.chatHistory || [];
            sessionData.chatHistory.push({
                timestamp: Date.now(),
                message: text || directMessage || '',
                channel,
                targetUserId,
                success: false
            });
            // Return graceful error (EXACT match to original callback pattern)
            return {
                success: false,
                message: `Error sending message to Hyperfy: ${errorMessage}`,
                error: 'send_failed'
            };
        }
    }
};
//# sourceMappingURL=chatTool.js.map