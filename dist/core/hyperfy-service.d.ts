import 'ses';
import { AgentControls } from '../hyperfy/systems/controls.js';
import { AgentLoader } from '../hyperfy/systems/loader.js';
import { AgentLiveKit } from '../hyperfy/systems/liveKit.js';
import { AgentActions } from '../hyperfy/systems/actions.js';
import { BehaviorManager } from "../hyperfy/managers/behavior-manager.js";
import { EmoteManager } from '../hyperfy/managers/emote-manager.js';
import { MessageManager } from '../hyperfy/managers/message-manager.js';
import { VoiceManager } from '../hyperfy/managers/voice-manager.js';
export interface HyperfyServiceConfig {
    wsUrl?: string;
    autoReconnect?: boolean;
    reconnectDelay?: number;
    agentId?: string;
    agentName?: string;
}
export interface HyperfyRuntime {
    agentId: string;
    character: {
        name: string;
    };
    getEntityById: (id: string) => Promise<HyperfyEntity | null>;
    updateEntity: (entity: HyperfyEntity) => Promise<void>;
    hyperfyService?: HyperfyService;
    logger?: {
        info: (message: string, data?: unknown) => void;
        warn: (message: string, data?: unknown) => void;
        error: (message: string, data?: unknown) => void;
    };
    generateUUID?: () => string;
    agentName?: string;
    aiModel?: unknown;
}
export interface HyperfyEntity {
    metadata: {
        hyperfy?: {
            id: string;
            name: string;
            userName: string;
        };
    };
}
interface HyperfyWorld {
    playerNamesMap: Map<string, string>;
    livekit: AgentLiveKit;
    actions: AgentActions;
    controls: AgentControls;
    loader: AgentLoader;
    rig?: unknown;
    chat: {
        add: (msg: ChatMessage, broadcast?: boolean) => void;
        msgs: ChatMessage[];
        listeners: Array<(msgs: ChatMessage[]) => void>;
        subscribe: (callback: (msgs: ChatMessage[]) => void) => void;
    };
    events: {
        emit: (event: string, data: unknown) => void;
    };
    network: {
        send: (type: string, data: unknown) => void;
        upload: (file: File) => Promise<void>;
        disconnect: () => Promise<void>;
        id?: string;
    };
    entities: {
        player?: {
            data: {
                id: string;
                name: string;
            };
            setSessionAvatar: (url: string) => void;
            modify: (data: {
                name: string;
            }) => void;
        };
        items: Map<string, HyperfyEntityItem>;
    };
    assetsUrl?: string;
    scripts?: {
        evaluate: (code: string) => unknown;
    };
    systems: unknown[];
    init: (config: HyperfyConfig) => Promise<void>;
    destroy: () => void;
    on: (event: string, callback: (data?: unknown) => void) => void;
    off: (event: string) => void;
}
interface HyperfyEntityItem {
    data?: {
        id: string;
        name?: string;
        type?: string;
    };
    blueprint?: {
        name?: string;
    };
    base?: {
        position?: {
            x: number;
            y: number;
            z: number;
        };
    };
    root?: {
        position?: {
            x: number;
            y: number;
            z: number;
        };
    };
}
interface ChatMessage {
    id: string;
    createdAt?: string;
    [key: string]: unknown;
}
interface HyperfyConfig {
    wsUrl: string;
    viewport: unknown;
    ui: unknown;
    initialAuthToken?: string;
    loadPhysX: () => Promise<unknown>;
}
export declare class HyperfyService {
    protected runtime: HyperfyRuntime;
    static serviceType: string;
    capabilityDescription: string;
    private world;
    private controls;
    private isConnectedState;
    private wsUrl;
    private _currentWorldId;
    private processedMsgIds;
    private playerNamesMap;
    private appearanceIntervalId;
    private appearanceSet;
    private nameSet;
    private connectionTime;
    private behaviorManager;
    private emoteManager;
    private messageManager;
    private voiceManager;
    get currentWorldId(): string | null;
    getWorld(): HyperfyWorld | null;
    constructor(runtime: HyperfyRuntime);
    static start(runtime: HyperfyRuntime): Promise<HyperfyService>;
    static stop(runtime: HyperfyRuntime): Promise<void>;
    connect(config: {
        wsUrl: string;
        authToken?: string;
        worldId: string;
    }): Promise<void>;
    private subscribeToHyperfyEvents;
    /**
     * Uploads the character's avatar model and associated emote animations,
     * sets the avatar URL locally, updates emote hash mappings,
     * and notifies the server of the new avatar.
     *
     * This function handles all assets required for character expression and animation.
     */
    private uploadCharacterAssets;
    private startAppearancePolling;
    private stopAppearancePolling;
    /**
     * Checks if the service is currently connected to a Hyperfy world.
     */
    isConnected(): boolean;
    getEntityById(entityId: string): HyperfyEntityItem | null;
    getEntityName(entityId: string): string | null;
    handleDisconnect(): Promise<void>;
    disconnect(): Promise<void>;
    /**
     * Changes the agent's display name.
     */
    changeName(newName: string): Promise<void>;
    stop(): Promise<void>;
    private startChatSubscription;
    getEmoteManager(): EmoteManager;
    getBehaviorManager(): BehaviorManager;
    getMessageManager(): MessageManager;
    getVoiceManager(): VoiceManager;
}
export {};
//# sourceMappingURL=hyperfy-service.d.ts.map