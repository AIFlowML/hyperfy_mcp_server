import { z } from 'zod';
// Ported ambient template from original ElizaOS action
const ambientTemplate = `# Task: Generate ambient speech for the character {{agentName}}.

Recent context and observations:
{{recentContext}}

Current world state:
{{worldState}}

Agent current status:
{{agentStatus}}

# Instructions:
Generate ambient speech that reflects what the agent is internally noticing, thinking about, or reacting to in the current environment. The speech should be:
- Self-directed or environment-facing (NOT addressed to any specific user)
- Natural and contextual to the current situation
- Reflective of the agent's personality and current state
- Between 5-50 words

"thought" should describe what the agent is internally processing or noticing.
"message" should be the actual ambient speech the agent will say aloud.

Only output a valid JSON block:

\`\`\`json
{
  "thought": "<internal observation or reaction>",
  "message": "<ambient speech to say aloud>"
}
\`\`\``;
// Helper function ported from original action - supports multiple text field sources
function getFirstAvailableField(obj, fields) {
    for (const field of fields) {
        if (typeof obj[field] === 'string' && obj[field].trim() !== '') {
            return obj[field];
        }
    }
    return null;
}
// Session-based content reuse detection (adapted from original's response checking)
function checkForRecentDuplicateContent(sessionHistory, proposedContent, maxAgeMs = 30000 // 30 seconds
) {
    const now = Date.now();
    const recentDuplicate = sessionHistory.find(entry => entry.message === proposedContent && (now - entry.timestamp) < maxAgeMs);
    return {
        isDuplicate: !!recentDuplicate,
        recentEntry: recentDuplicate
    };
}
export const ambientTool = {
    name: 'hyperfy_ambient_speech',
    description: `Generate and perform ambient speech for the agent. This creates natural, context-aware speech that reflects the agent's observations and internal state without addressing any specific user.

Examples of ambient speech:
- "This place feels different today..."
- "Wonder what that glowing artifact does..."
- "The silence here is almost deafening."
- "These ancient symbols... they seem familiar somehow."

The agent will use current world context, recent interactions, and environmental observations to generate appropriate ambient remarks.`,
    parameters: z.object({
        content: z.string().min(1).optional().describe('The ambient speech content to say (if not provided, will generate contextual ambient speech)'),
        message: z.string().min(1).optional().describe('Alternative ambient message field (for compatibility)'),
        text: z.string().min(1).optional().describe('Alternative text field (for compatibility)'),
        context: z.string().optional().describe('Additional context or observations to influence the ambient speech generation'),
        agentName: z.string().optional().describe('Name of the agent (defaults to session user name)'),
        forceGenerate: z.boolean().optional().describe('Force generation even if recent ambient speech was generated'),
        duration: z.number().min(1).max(30).optional().describe('Duration in seconds (1-30, default: 5)'),
        volume: z.number().min(0.1).max(1.0).optional().describe('Volume level (0.1-1.0, default: 0.8)')
    }),
    execute: async (args, context) => {
        const { content, duration = 5, volume = 0.8, context: additionalContext, agentName, forceGenerate } = args;
        const { log, session } = context;
        const { hyperfyService, playerState, userId } = session.data;
        try {
            log.info('Executing hyperfy_ambient_speech', {
                hasContent: !!content,
                hasContext: !!additionalContext,
                forceGenerate
            });
            // Use session data to track recent ambient speech (prevent spam)
            const sessionData = session.data;
            const now = Date.now();
            const timeSinceLastAmbient = now - (sessionData.lastAmbientSpeech || 0);
            const minInterval = 10000; // 10 seconds minimum between ambient speech
            if (!forceGenerate && timeSinceLastAmbient < minInterval) {
                log.debug('Ambient speech too recent, skipping generation', {
                    timeSinceLastAmbient,
                    minInterval
                });
                return {
                    success: true,
                    message: 'Ambient speech generation skipped (too recent)',
                    data: {
                        skipped: true,
                        nextAvailableIn: minInterval - timeSinceLastAmbient
                    }
                };
            }
            let ambientContent = '';
            let thought;
            // Multi-field text extraction (like original action with fieldKeys = ['message', 'text'])
            const providedContent = getFirstAvailableField(args, ['content', 'message', 'text']);
            if (providedContent) {
                // Content provided from multiple possible sources
                ambientContent = providedContent;
                log.debug('Using provided content for ambient speech', { source: 'multi-field extraction' });
                // Check for recent duplicate content (adapted from original's response reuse logic)
                const duplicateCheck = checkForRecentDuplicateContent(sessionData.ambientHistory || [], ambientContent);
                if (duplicateCheck.isDuplicate && !forceGenerate) {
                    log.debug('Duplicate content detected, skipping generation', {
                        recentTimestamp: duplicateCheck.recentEntry?.timestamp,
                        content: ambientContent
                    });
                    return {
                        success: true,
                        message: 'Ambient speech generation skipped (duplicate content)',
                        data: {
                            skipped: true,
                            reason: 'duplicate_content',
                            recentEntry: duplicateCheck.recentEntry
                        }
                    };
                }
            }
            else {
                // Generate contextual ambient speech based on world state
                log.info('Generating contextual ambient speech');
                // Gather context from world state and recent history
                const world = hyperfyService.getWorld();
                let worldContext = 'Unknown environment';
                if (world?.entities?.items) {
                    try {
                        const entities = Array.from(world.entities.items.entries()).slice(0, 10);
                        const entityDescriptions = entities.map((entry) => {
                            const [id, entity] = entry;
                            const typedEntity = entity;
                            const position = typedEntity?.root?.position || typedEntity?.base?.position;
                            const name = hyperfyService.getEntityName(id);
                            return {
                                id,
                                name: name || 'Unknown',
                                position: position || { x: 0, y: 0, z: 0 }
                            };
                        });
                        worldContext = entityDescriptions.length > 0
                            ? `Environment contains ${entityDescriptions.length} entities including: ${entityDescriptions.slice(0, 3).map((e) => e.name).join(', ')}`
                            : 'Empty environment';
                    }
                    catch (worldError) {
                        log.warn('Error gathering world context', { error: worldError });
                        worldContext = 'Complex environment';
                    }
                }
                const recentHistory = sessionData.ambientHistory?.slice(-3) || [];
                const hasRecentSpeech = recentHistory.length > 0;
                // Generate contextual ambient speech based on available data
                const contextualFactors = [
                    additionalContext,
                    worldContext,
                    hasRecentSpeech ? 'Previous thoughts recorded' : 'First observations',
                    `Agent position: (${playerState.position.x.toFixed(1)}, ${playerState.position.z.toFixed(1)})`
                ].filter(Boolean);
                // Intelligent fallback ambient speech generation based on context
                const ambientTemplates = [
                    // Environmental observations
                    "This place has an interesting energy to it...",
                    "Something about this environment feels unique.",
                    "The atmosphere here is quite captivating.",
                    "I can sense there's more to discover here.",
                    "This space holds many mysteries.",
                    // Movement and exploration
                    "Time to see what lies ahead.",
                    "Each step reveals something new.",
                    "The path forward looks intriguing.",
                    "There's always more to explore.",
                    "Movement brings new perspectives.",
                    // Contemplative
                    "Moments like these make you think...",
                    "The silence here is profound.",
                    "Sometimes observation is the best action.",
                    "Every place has its own story to tell.",
                    "Patience often reveals hidden truths.",
                    // Interactive context
                    "Wonder what interactions await here.",
                    "Objects here seem to have purpose.",
                    "Each element in this space matters.",
                    "The design here tells a story.",
                    "Functionality often follows form."
                ];
                // Select ambient speech based on context
                if (additionalContext) {
                    if (additionalContext.toLowerCase().includes('explore')) {
                        ambientContent = ambientTemplates[Math.floor(Math.random() * 5) + 5]; // Movement templates
                    }
                    else if (additionalContext.toLowerCase().includes('quiet') || additionalContext.toLowerCase().includes('peaceful')) {
                        ambientContent = ambientTemplates[Math.floor(Math.random() * 5) + 10]; // Contemplative templates
                    }
                    else {
                        ambientContent = ambientTemplates[Math.floor(Math.random() * 5) + 15]; // Interactive templates
                    }
                    thought = `Context-aware response to: ${additionalContext}`;
                }
                else if (worldContext.includes('entities')) {
                    ambientContent = ambientTemplates[Math.floor(Math.random() * 5) + 15]; // Interactive templates
                    thought = 'Observing environment with multiple entities present';
                }
                else {
                    ambientContent = ambientTemplates[Math.floor(Math.random() * 5)]; // Environmental templates
                    thought = 'General environmental observation';
                }
                log.info('Generated contextual ambient speech', {
                    contextFactors: contextualFactors.length,
                    hasWorldContext: !!world,
                    messageLength: ambientContent.length
                });
            }
            // Ensure we have content to speak
            if (!ambientContent || !ambientContent.trim()) {
                // Final fallback
                ambientContent = "Observing the world around me...";
                thought = "Fallback ambient speech generated";
                log.warn('Using final fallback ambient speech');
            }
            // Update session state
            sessionData.lastAmbientSpeech = now;
            sessionData.ambientHistory = sessionData.ambientHistory || [];
            sessionData.ambientHistory.push({
                timestamp: now,
                message: ambientContent,
                thought
            });
            // Keep only last 10 ambient speech entries
            if (sessionData.ambientHistory.length > 10) {
                sessionData.ambientHistory = sessionData.ambientHistory.slice(-10);
            }
            log.info('Ambient speech generated successfully', {
                contentLength: ambientContent.length,
                thought: thought || 'none',
                duration,
                volume
            });
            return {
                success: true,
                message: `Ambient speech: "${ambientContent}"`,
                data: {
                    content: ambientContent,
                    thought,
                    duration,
                    volume,
                    timestamp: new Date().toISOString(),
                    worldId: session.data.worldId,
                    userId: session.data.userId,
                    position: playerState.position,
                    generationType: content ? 'provided' : 'contextual'
                }
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            log.error('Error performing ambient speech', { error: errorMessage, args });
            return {
                success: false,
                message: `Failed to perform ambient speech: ${errorMessage}`,
                error: 'ambient_speech_failed'
            };
        }
    }
};
//# sourceMappingURL=ambientTool.js.map