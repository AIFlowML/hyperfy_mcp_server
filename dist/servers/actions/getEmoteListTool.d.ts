import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
/**
 * MCP Tool: Get Emote List
 * Replaces the hyperfyEmoteProvider from ElizaOS
 * Returns available emotes for the Hyperfy agent
 */
export declare const getEmoteListTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        format: z.ZodOptional<z.ZodEnum<["structured", "text", "both"]>>;
    }, "strip", z.ZodTypeAny, {
        format?: "text" | "structured" | "both" | undefined;
    }, {
        format?: "text" | "structured" | "both" | undefined;
    }>;
    execute: (args: {
        format?: "structured" | "text" | "both";
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=getEmoteListTool.d.ts.map