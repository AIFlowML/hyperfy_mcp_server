import { System } from '../core/systems/System.js';
export interface LiveKitInitOptions {
    wsUrl: string;
    token: string;
}
export declare class AgentLiveKit extends System {
    private room;
    private audioSource;
    private localTrack;
    deserialize(opts: LiveKitInitOptions): Promise<void>;
    stop(): Promise<void>;
    private setupRoomEvents;
    preTick(): void;
    preFixedUpdate(): void;
    fixedUpdate(): void;
    postFixedUpdate(): void;
    preUpdate(): void;
    update(): void;
    postUpdate(): void;
    lateUpdate(): void;
    postLateUpdate(): void;
    commit(): void;
    postTick(): void;
    start(): void;
    publishAudioStream(audioBuffer: Buffer): Promise<void>;
    private convertToPcm;
    private detectAudioFormat;
}
//# sourceMappingURL=liveKit.d.ts.map