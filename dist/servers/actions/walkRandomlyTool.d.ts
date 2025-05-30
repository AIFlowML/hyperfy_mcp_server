import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const walkRandomlyTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        command: z.ZodOptional<z.ZodEnum<["start", "stop"]>>;
        interval: z.ZodOptional<z.ZodNumber>;
        distance: z.ZodOptional<z.ZodNumber>;
        pattern: z.ZodOptional<z.ZodString>;
        context: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        context?: string | undefined;
        command?: "start" | "stop" | undefined;
        interval?: number | undefined;
        distance?: number | undefined;
        pattern?: string | undefined;
    }, {
        context?: string | undefined;
        command?: "start" | "stop" | undefined;
        interval?: number | undefined;
        distance?: number | undefined;
        pattern?: string | undefined;
    }>;
    execute: (args: {
        command?: "start" | "stop";
        interval?: number;
        distance?: number;
        pattern?: string;
        context?: string;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=walkRandomlyTool.d.ts.map