import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const getWorldStateTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        includeChat: z.ZodOptional<z.ZodBoolean>;
        includeEmotes: z.ZodOptional<z.ZodBoolean>;
        actionRadius: z.ZodOptional<z.ZodNumber>;
        format: z.ZodOptional<z.ZodEnum<["structured", "text", "both"]>>;
    }, "strip", z.ZodTypeAny, {
        format?: "text" | "structured" | "both" | undefined;
        includeChat?: boolean | undefined;
        includeEmotes?: boolean | undefined;
        actionRadius?: number | undefined;
    }, {
        format?: "text" | "structured" | "both" | undefined;
        includeChat?: boolean | undefined;
        includeEmotes?: boolean | undefined;
        actionRadius?: number | undefined;
    }>;
    execute: (args: {
        includeChat?: boolean;
        includeEmotes?: boolean;
        actionRadius?: number;
        format?: "structured" | "text" | "both";
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=getWorldStateTool.d.ts.map