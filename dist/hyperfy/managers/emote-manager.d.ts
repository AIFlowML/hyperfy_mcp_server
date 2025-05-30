import type { EmoteManagerRuntime } from '../../types/index.js';
export type { EmoteManagerRuntime } from '../../types/index.js';
export declare class EmoteManager {
    private emoteHashMap;
    private currentEmoteTimeout;
    private movementCheckInterval;
    private runtime;
    constructor(runtime: EmoteManagerRuntime);
    uploadEmotes(): Promise<void>;
    playEmote(name: string): void;
    private clearEmote;
    private clearTimers;
    private getService;
}
//# sourceMappingURL=emote-manager.d.ts.map