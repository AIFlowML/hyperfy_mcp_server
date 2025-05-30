import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const unuseTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        reason: z.ZodOptional<z.ZodString>;
        force: z.ZodOptional<z.ZodBoolean>;
        context: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        context?: string | undefined;
        reason?: string | undefined;
        force?: boolean | undefined;
    }, {
        context?: string | undefined;
        reason?: string | undefined;
        force?: boolean | undefined;
    }>;
    execute: (args: {
        reason?: string;
        force?: boolean;
        context?: string;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=unuseTool.d.ts.map