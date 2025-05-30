import { z } from 'zod';
import type { AmbientSpeechParams, ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const ambientTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        content: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        context: z.ZodOptional<z.ZodString>;
        agentName: z.ZodOptional<z.ZodString>;
        forceGenerate: z.ZodOptional<z.ZodBoolean>;
        duration: z.ZodOptional<z.ZodNumber>;
        volume: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        text?: string | undefined;
        message?: string | undefined;
        content?: string | undefined;
        context?: string | undefined;
        agentName?: string | undefined;
        forceGenerate?: boolean | undefined;
        duration?: number | undefined;
        volume?: number | undefined;
    }, {
        text?: string | undefined;
        message?: string | undefined;
        content?: string | undefined;
        context?: string | undefined;
        agentName?: string | undefined;
        forceGenerate?: boolean | undefined;
        duration?: number | undefined;
        volume?: number | undefined;
    }>;
    execute: (args: AmbientSpeechParams & {
        context?: string;
        agentName?: string;
        forceGenerate?: boolean;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=ambientTool.d.ts.map