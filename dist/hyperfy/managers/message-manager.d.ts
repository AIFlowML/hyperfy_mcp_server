import type { MessageManagerRuntime, HyperfyMessage } from "../../types/index.js";
export type { MessageManagerRuntime } from '../../types/index.js';
export declare class MessageManager {
    private runtime;
    constructor(runtime: MessageManagerRuntime);
    handleMessage(msg: HyperfyMessage): Promise<void>;
    sendMessage(text: string): Promise<void>;
    formatMessages({ messages, entities, }: {
        messages: unknown[];
        entities: unknown[];
    }): string;
    getRecentMessages(roomId: string, count?: number): Promise<"" | "Recent messages functionality - simplified for FastMCP">;
    private getService;
}
//# sourceMappingURL=message-manager.d.ts.map