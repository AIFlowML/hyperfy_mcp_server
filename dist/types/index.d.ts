import type * as THREE from 'three';
export interface HyperfyWorld {
    id: string;
    name: string;
    url?: string;
}
export interface HyperfyUser {
    id: string;
    name: string;
    position?: Vector3;
    rotation?: Vector3;
    isOnline: boolean;
    lastSeen?: Date;
}
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
export type HyperfyMetadata = Record<string, string | number | boolean | null | undefined>;
export interface HyperfyEntity {
    id: string;
    type: string;
    name?: string;
    position: Vector3;
    rotation: Vector3;
    scale?: Vector3;
    metadata?: HyperfyMetadata;
}
export interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: Date;
    channel?: 'local' | 'world' | 'whisper';
    metadata?: HyperfyMetadata;
}
export interface AmbientMessage {
    content: string;
    position?: Vector3;
    duration?: number;
    metadata?: HyperfyMetadata;
}
export interface EmoteDefinition {
    name: string;
    path: string;
    duration: number;
    description: string;
}
export interface EmoteAction {
    emoteId: string;
    userId: string;
    timestamp: Date;
    position?: Vector3;
}
export interface PhysicsBody {
    id: string;
    type: 'static' | 'dynamic' | 'kinematic';
    position: Vector3;
    rotation: Vector3;
    velocity?: Vector3;
    angularVelocity?: Vector3;
    mass?: number;
    shape: PhysicsShape;
}
export interface PhysicsMeshData {
    vertices: number[];
    indices: number[];
    normals?: number[];
}
export interface PhysicsShape {
    type: 'box' | 'sphere' | 'capsule' | 'mesh';
    dimensions?: Vector3;
    radius?: number;
    height?: number;
    meshData?: PhysicsMeshData;
}
export interface PhysicsCollision {
    bodyA: string;
    bodyB: string;
    point: Vector3;
    normal: Vector3;
    impulse: number;
    timestamp: Date;
}
export interface LiveKitConfig {
    wsUrl: string;
    token: string;
    roomName?: string;
    participantName?: string;
}
export interface AudioFrame {
    data: Buffer;
    sampleRate: number;
    channels: number;
    timestamp: number;
}
export interface VoiceParticipant {
    identity: string;
    isConnected: boolean;
    isSpeaking: boolean;
    audioLevel?: number;
}
export interface ActionContext {
    worldId: string;
    userId: string;
    timestamp: Date;
    position?: Vector3;
    metadata?: HyperfyMetadata;
}
export interface ActionResult {
    success: boolean;
    message?: string;
    data?: unknown;
    error?: string;
}
export interface ManagerConfig {
    id: string;
    enabled: boolean;
    settings?: Record<string, unknown>;
}
export interface PlayerState {
    id: string;
    name: string;
    position: Vector3;
    rotation: Vector3;
    health?: number;
    status: 'active' | 'idle' | 'away' | 'offline';
    lastActivity: Date;
    metadata?: HyperfyMetadata;
}
export interface WorldState {
    id: string;
    name: string;
    playerCount: number;
    entities: HyperfyEntity[];
    lastUpdate: Date;
    metadata?: HyperfyMetadata;
}
export interface GoToParams {
    targetId: string;
    targetType: 'user' | 'entity' | 'position';
    position?: Vector3;
    speed?: number;
}
export interface ChatParams {
    message: string;
    channel?: 'local' | 'world' | 'whisper';
    targetUserId?: string;
}
export interface UseItemParams {
    itemId: string;
    action?: string;
    metadata?: HyperfyMetadata;
}
export interface EmoteParams {
    emoteName: string;
    duration?: number;
    loop?: boolean;
}
export interface AmbientSpeechParams {
    content: string;
    position?: Vector3;
    duration?: number;
    volume?: number;
}
export interface WalkRandomlyParams {
    radius?: number;
    duration?: number;
    speed?: number;
    centerPosition?: Vector3;
}
export interface LogType {
    debug: (message: string, data?: unknown) => void;
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
}
export interface HyperfySessionData {
    worldId: string;
    userId: string;
    playerState: PlayerState;
    worldState: WorldState;
    connectionTime: Date;
    lastActivity: Date;
    preferences?: Record<string, unknown>;
}
export interface ChatSessionData extends HyperfySessionData {
    lastChatMessage?: number;
    chatHistory?: Array<{
        timestamp: number;
        message: string;
        channel: string;
        targetUserId?: string;
        success: boolean;
    }>;
}
export interface AmbientSessionData extends HyperfySessionData {
    lastAmbientAction?: number;
    ambientHistory?: Array<{
        timestamp: number;
        content: string;
        ambientId: string;
        success: boolean;
        contentLength: number;
    }>;
    recentContent?: Array<{
        content: string;
        timestamp: number;
    }>;
}
export interface GotoSessionData extends HyperfySessionData {
    lastGotoAction?: number;
    gotoHistory?: Array<{
        timestamp: number;
        entityId: string;
        entityName?: string;
        targetPosition: {
            x: number;
            y: number;
            z: number;
        };
        success: boolean;
        navigationId: string;
    }>;
}
export interface UseSessionData extends HyperfySessionData {
    lastUseAction?: number;
    useHistory?: Array<{
        timestamp: number;
        entityId: string;
        action?: string;
        useId: string;
        success: boolean;
        extractionMethod: 'direct' | 'ai_extraction' | 'fallback';
    }>;
    aiExtractor?: (prompt: string) => Promise<{
        entityId?: string;
    }>;
}
export interface StopSessionData extends HyperfySessionData {
    lastStopAction?: number;
    stopHistory?: Array<{
        timestamp: number;
        reason: string;
        stopId: string;
        success: boolean;
        previousActivity?: 'navigation' | 'patrol' | 'unknown';
    }>;
}
export interface UnuseSessionData extends HyperfySessionData {
    lastUnuseAction?: number;
    unuseHistory?: Array<{
        timestamp: number;
        reason?: string;
        unuseId: string;
        success: boolean;
        previousItemType?: string;
    }>;
}
export interface WalkSessionData extends HyperfySessionData {
    lastWalkAction?: number;
    walkHistory?: Array<{
        timestamp: number;
        command: 'start' | 'stop';
        walkId: string;
        success: boolean;
        previousState?: boolean;
        interval?: number;
        distance?: number;
    }>;
    currentWalkId?: string;
    walkingRandomly?: boolean;
}
export interface ToolContext {
    log: LogType;
    session: {
        data: HyperfySessionData;
    };
}
export interface ChatToolContext {
    log: LogType;
    session: {
        data: ChatSessionData;
    };
}
export interface AmbientToolContext {
    log: LogType;
    session: {
        data: AmbientSessionData;
    };
}
export interface GotoToolContext {
    log: LogType;
    session: {
        data: GotoSessionData;
    };
}
export interface UseToolContext {
    log: LogType;
    session: {
        data: UseSessionData;
    };
}
export interface StopToolContext {
    log: LogType;
    session: {
        data: StopSessionData;
    };
}
export interface UnuseToolContext {
    log: LogType;
    session: {
        data: UnuseSessionData;
    };
}
export interface WalkToolContext {
    log: LogType;
    session: {
        data: WalkSessionData;
    };
}
export interface HyperfyEvent {
    id: string;
    type: string;
    timestamp: Date;
    data: unknown;
    source?: string;
}
export interface PlayerJoinEvent extends HyperfyEvent {
    type: 'player_join';
    data: {
        playerId: string;
        playerName: string;
        position: Vector3;
    };
}
export interface PlayerLeaveEvent extends HyperfyEvent {
    type: 'player_leave';
    data: {
        playerId: string;
        playerName: string;
    };
}
export interface ChatEvent extends HyperfyEvent {
    type: 'chat_message';
    data: ChatMessage;
}
export interface EmoteEvent extends HyperfyEvent {
    type: 'emote_performed';
    data: EmoteAction;
}
export interface HyperfyError extends Error {
    code: string;
    details?: Record<string, unknown>;
    timestamp: Date;
}
export interface HyperfyServerConfig {
    worldId: string;
    serverUrl?: string;
    apiKey?: string;
    features: {
        physics: boolean;
        voice: boolean;
        chat: boolean;
        emotes: boolean;
    };
    limits: {
        maxPlayers: number;
        maxEntities: number;
        chatRateLimit: number;
    };
}
export type HyperfyActionType = 'goto' | 'chat' | 'use' | 'emote' | 'ambient' | 'walk_randomly' | 'stop' | 'unuse';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type EntityType = 'player' | 'npc' | 'item' | 'decoration' | 'interactive' | 'physics_object';
export type { EmoteDefinition as Emote };
export type { HyperfyUser as User };
export type { HyperfyEntity as Entity };
export type { ChatMessage as Message };
export interface FastMCPRuntime {
    logger: LogType;
    generateUUID(): string;
    hyperfyService: unknown;
    agentId: string;
    agentName: string;
    aiModel: AIModelInterface;
}
export interface BehaviorResponse {
    thought: string;
    text?: string;
    actions: string[];
    emote?: string;
    providers?: string;
}
export interface FastMCPMemory {
    id: string;
    content: {
        text: string;
        type: string;
    };
    roomId: string;
    worldId: string | null;
    entityId: string;
    createdAt?: number;
}
export interface BehaviorState {
    worldId: string | null;
    agentId: string;
    agentName: string;
    currentTime: number;
}
export type BehaviorCallback = (content: BehaviorResponse) => Promise<void>;
export interface AIModelInterface {
    generateText(prompt: string): Promise<string>;
    transcribeAudio?(audioBuffer: Buffer): Promise<string>;
    synthesizeSpeech?(text: string): Promise<Buffer>;
}
export interface XMLParseResult {
    thought?: string;
    text?: string;
    actions?: string;
    emote?: string;
    providers?: string;
}
export type StateComposer = (memory: FastMCPMemory, template: string) => string;
export type UUIDGenerator = (runtime: FastMCPRuntime, seed: string) => string;
export interface BehaviorSessionData extends HyperfySessionData {
    lastBehaviorAction?: number;
    behaviorHistory?: Array<{
        timestamp: number;
        thought: string;
        actions: string[];
        emote?: string;
        success: boolean;
        responseTime?: number;
    }>;
    isRunningBehavior?: boolean;
}
export interface EmoteManagerRuntime {
    hyperfyService: unknown;
    logger: LogType;
}
export interface EmoteUploadResult {
    name: string;
    hash: string;
    url: string;
    success: boolean;
    error?: string;
}
export interface EmotePlaybackState {
    currentEmote?: string;
    startTime?: number;
    duration?: number;
    isPlaying: boolean;
}
export interface HyperfyPlayerEntity {
    data: {
        effect?: {
            emote?: string | null;
        };
    };
    moving?: boolean;
}
export interface MessageManagerRuntime {
    hyperfyService: unknown;
    aiModel: AIModelInterface;
    agentId: string;
    agentName: string;
}
export interface HyperfyMessage {
    id: string | number;
    fromId?: string | number;
    from?: string;
    body?: string;
    timestamp?: number;
}
export interface FastMCPEntity {
    id: string;
    names: string[];
    agentId: string;
    metadata: HyperfyMetadata;
    data?: HyperfyMetadata;
}
export interface MessageContent {
    text?: string;
    source?: string;
    channelType?: string;
    metadata?: HyperfyMetadata;
    actions?: string[];
    emote?: string;
}
export interface MessageResponseContent {
    text?: string;
    emote?: string;
    actions?: string[];
    providers?: string;
}
export type MessageCallback = (content: MessageResponseContent) => Promise<void>;
export interface MessageSessionData extends HyperfySessionData {
    recentMessages?: FastMCPMemory[];
    entities?: FastMCPEntity[];
    messageHistory?: Array<{
        timestamp: number;
        from: string;
        body: string;
        messageId: string;
        processed: boolean;
        responseTime?: number;
    }>;
    isProcessingMessage?: boolean;
}
export interface FormattedMessage {
    timestamp: string;
    timeString: string;
    formattedName: string;
    formattedId: string;
    messageText: string;
    actionString: string;
    fullLine: string;
}
export interface VoiceManagerRuntime {
    hyperfyService: unknown;
    aiModel: AIModelInterface;
    agentId: string;
    agentName: string;
    character: {
        name: string;
    };
}
export interface LiveKitAudioData {
    participant: string;
    buffer: Buffer;
}
export interface VoiceUserState {
    buffers: Buffer[];
    totalLength: number;
    lastActive: number;
    transcriptionText: string;
}
export interface VoiceMemory {
    id: string;
    agentId: string;
    entityId: string;
    roomId: string;
    worldId?: string;
    content: {
        text: string;
        source: string;
        name: string;
        userName: string;
        isVoiceMessage: boolean;
        channelType: string;
        inReplyTo?: string;
    };
    createdAt: number;
}
export interface VoiceContent {
    text?: string;
    emote?: string;
    actions?: string[];
    name?: string;
    inReplyTo?: string;
    isVoiceMessage?: boolean;
    channelType?: string;
}
export type VoiceCallback = (content: VoiceContent, files?: unknown[]) => Promise<VoiceMemory[]>;
export interface AudioBuffer {
    data: Buffer;
    format?: string;
    sampleRate?: number;
    channels?: number;
}
export interface VoiceSessionData extends HyperfySessionData {
    voiceHistory?: Array<{
        timestamp: number;
        playerId: string;
        message: string;
        transcribed: boolean;
        responseGenerated: boolean;
        audioPlayed: boolean;
    }>;
    isProcessingVoice?: boolean;
    activeVoiceUsers?: string[];
}
export type GetEmoteListSessionData = Record<string, never>;
export interface GLBData {
    scene: THREE.Scene;
    animations: THREE.AnimationClip[];
}
export interface GLBEmoteData {
    animations: THREE.AnimationClip[];
    scene: THREE.Scene;
}
export interface VRMInstance {
    raw: unknown;
    height: number;
    headToHeight: number;
    setEmote: (url: string) => void;
    setFirstPerson: (active: boolean) => void;
    update: (delta: number) => void;
    getBoneTransform: (boneName: string) => THREE.Matrix4 | null;
    move: (matrix: THREE.Matrix4) => void;
    destroy: () => void;
}
export interface VRMFactory {
    create(matrix: THREE.Matrix4, hooks: unknown, node: unknown): VRMInstance;
    applyStats(stats: unknown): void;
}
export interface AvatarFactory {
    create: (matrixWorld: THREE.Matrix4, hooks: unknown, avatarNode: unknown) => AvatarInstance;
    applyStats?: (stats: unknown) => void;
}
export interface AvatarInstance {
    move: (matrixWorld: THREE.Matrix4) => void;
    destroy: () => void;
    setEmote: (emote: string | null) => void;
    height?: number;
    headToHeight?: number;
}
export interface EmoteFactory {
    toClip: (options: EmoteClipOptions) => THREE.AnimationClip;
}
export interface EmoteClipOptions {
    rootToHips: number;
    version: string;
    getBoneName: (vrmBoneName: string) => string | undefined;
}
//# sourceMappingURL=index.d.ts.map