import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const stopTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        reason: z.ZodOptional<z.ZodString>;
        urgent: z.ZodOptional<z.ZodBoolean>;
        context: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        context?: string | undefined;
        urgent?: boolean | undefined;
        reason?: string | undefined;
    }, {
        context?: string | undefined;
        urgent?: boolean | undefined;
        reason?: string | undefined;
    }>;
    execute: (args: {
        reason?: string;
        urgent?: boolean;
        context?: string;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=stopTool.d.ts.map