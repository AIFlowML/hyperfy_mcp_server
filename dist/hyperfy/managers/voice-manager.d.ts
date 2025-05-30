import type { VoiceManagerRuntime } from "../../types/index.js";
export type { VoiceManagerRuntime } from '../../types/index.js';
export declare class VoiceManager {
    private runtime;
    private userStates;
    private processingVoice;
    private transcriptionTimeout;
    constructor(runtime: VoiceManagerRuntime);
    handleUserBuffer(playerId: string, buffer: Buffer): Promise<void>;
    debouncedProcessTranscription(playerId: string): Promise<void>;
    private processTranscription;
    private handleMessage;
    playAudio(audioBuffer: Buffer): Promise<void>;
    private getService;
}
//# sourceMappingURL=voice-manager.d.ts.map