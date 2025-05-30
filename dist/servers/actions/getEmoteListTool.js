import { z } from 'zod';
import { EMOTES_LIST } from '../config/constants.js';
/**
 * MCP Tool: Get Emote List
 * Replaces the hyperfyEmoteProvider from ElizaOS
 * Returns available emotes for the Hyperfy agent
 */
export const getEmoteListTool = {
    name: 'hyperfy_get_emote_list',
    description: `Retrieves the complete list of available emotes and animations for the Hyperfy agent.

This tool returns all emotes that the agent can perform, including their names and descriptions. Use this when you need to know what animations are available for expressing emotions or performing actions.

Examples of usage:
- "What emotes are available?" → Shows all available emotes with descriptions
- "Show me animation options" → Lists emotes the agent can perform  
- "What can I do to express happiness?" → Find emotes suitable for expressing joy
- "List all available animations" → Complete emote inventory

Emote Categories Include:
- **Expressions**: Basic emotional expressions (happy, sad, surprised, etc.)
- **Gestures**: Hand and body movements (wave, point, thumbs up, etc.) 
- **Activities**: Action-based animations (dance, jump, sit, etc.)
- **Social**: Interactive animations for communication (bow, clap, etc.)

The tool returns both structured data (for programmatic use) and formatted text (for display). No parameters are required - it always returns the complete emote list.

Response includes:
- Complete emote array with names and descriptions
- Formatted markdown text for easy reading
- Total count of available emotes

This information helps the agent choose appropriate emotes for different situations and provides users with a comprehensive overview of available animations.`,
    parameters: z.object({
        format: z.enum(['structured', 'text', 'both']).optional().describe('Response format preference (default: both)')
    }),
    execute: async (args, context) => {
        const { format = 'both' } = args;
        const { log, session } = context;
        try {
            log.info('Executing hyperfy_get_emote_list', { format, totalEmotes: EMOTES_LIST.length });
            // Format emotes as markdown text (same as original provider)
            const emoteListText = EMOTES_LIST.map((e) => `- **${e.name}**: ${e.description}`).join('\n');
            const formattedText = `# Available Emotes\n\n${emoteListText}\n\nTotal: ${EMOTES_LIST.length} emotes available`;
            // Structure emote data
            const emotesData = EMOTES_LIST.map(emote => ({
                name: emote.name,
                description: emote.description
            }));
            // Determine response based on format preference
            let responseData;
            let responseMessage;
            switch (format) {
                case 'structured':
                    responseData = {
                        emotes: emotesData,
                        total_count: EMOTES_LIST.length,
                        categories: ['expressions', 'gestures', 'activities', 'social']
                    };
                    responseMessage = `Retrieved ${EMOTES_LIST.length} available emotes (structured format)`;
                    break;
                case 'text':
                    responseData = {
                        formatted_text: formattedText,
                        total_count: EMOTES_LIST.length
                    };
                    responseMessage = `Retrieved ${EMOTES_LIST.length} available emotes (text format)`;
                    break;
                case 'both':
                    responseData = {
                        emotes: emotesData,
                        formatted_text: formattedText,
                        total_count: EMOTES_LIST.length,
                        categories: ['expressions', 'gestures', 'activities', 'social']
                    };
                    responseMessage = `Retrieved ${EMOTES_LIST.length} available emotes`;
                    break;
            }
            log.info('Emote list retrieved successfully', {
                format,
                emoteCount: EMOTES_LIST.length,
                hasFormattedText: format !== 'structured',
                hasStructuredData: format !== 'text'
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
            log.error('Error retrieving emote list:', { error: errorMessage, args });
            return {
                success: false,
                message: `Failed to retrieve emote list: ${errorMessage}`,
                error: 'emote_list_retrieval_failed'
            };
        }
    }
};
//# sourceMappingURL=getEmoteListTool.js.map