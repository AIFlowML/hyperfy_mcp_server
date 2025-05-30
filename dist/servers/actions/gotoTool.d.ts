import { z } from 'zod';
import type { ActionResult, LogType } from '../../types/index.js';
import type { McpSessionData } from '../server.js';
export declare const gotoTool: {
    name: string;
    description: string;
    parameters: z.ZodObject<{
        entityId: z.ZodOptional<z.ZodString>;
        targetId: z.ZodOptional<z.ZodString>;
        targetDescription: z.ZodOptional<z.ZodString>;
        extractionContext: z.ZodOptional<z.ZodString>;
        forceExtraction: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        entityId?: string | undefined;
        targetId?: string | undefined;
        targetDescription?: string | undefined;
        extractionContext?: string | undefined;
        forceExtraction?: boolean | undefined;
    }, {
        entityId?: string | undefined;
        targetId?: string | undefined;
        targetDescription?: string | undefined;
        extractionContext?: string | undefined;
        forceExtraction?: boolean | undefined;
    }>;
    execute: (args: {
        entityId?: string;
        targetId?: string;
        targetDescription?: string;
        extractionContext?: string;
        forceExtraction?: boolean;
    }, context: {
        log: LogType;
        session: {
            data: McpSessionData;
        };
    }) => Promise<ActionResult>;
};
//# sourceMappingURL=gotoTool.d.ts.map