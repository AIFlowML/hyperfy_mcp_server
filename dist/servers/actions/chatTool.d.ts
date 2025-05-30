import { z } from 'zod';
import type { ChatParams, ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const chatTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        message: z.ZodString;
        channel: z.ZodOptional<z.ZodEnum<["local", "world", "whisper"]>>;
        targetUserId: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        text?: string | undefined;
        channel?: "local" | "world" | "whisper" | undefined;
        targetUserId?: string | undefined;
    }, {
        message: string;
        text?: string | undefined;
        channel?: "local" | "world" | "whisper" | undefined;
        targetUserId?: string | undefined;
    }>;
    execute: (args: ChatParams & {
        text?: string;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=chatTool.d.ts.map