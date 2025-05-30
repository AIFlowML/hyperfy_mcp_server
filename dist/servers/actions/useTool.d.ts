import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const useTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        entityId: z.ZodOptional<z.ZodString>;
        targetId: z.ZodOptional<z.ZodString>;
        action: z.ZodOptional<z.ZodString>;
        context: z.ZodOptional<z.ZodString>;
        extractionContext: z.ZodOptional<z.ZodString>;
        forceExtraction: z.ZodOptional<z.ZodBoolean>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        context?: string | undefined;
        entityId?: string | undefined;
        targetId?: string | undefined;
        extractionContext?: string | undefined;
        forceExtraction?: boolean | undefined;
        action?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        context?: string | undefined;
        entityId?: string | undefined;
        targetId?: string | undefined;
        extractionContext?: string | undefined;
        forceExtraction?: boolean | undefined;
        action?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>;
    execute: (args: {
        entityId?: string;
        targetId?: string;
        action?: string;
        context?: string;
        extractionContext?: string;
        forceExtraction?: boolean;
        metadata?: Record<string, unknown>;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=useTool.d.ts.map