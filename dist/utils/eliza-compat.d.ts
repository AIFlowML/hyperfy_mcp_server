import type { FastMCPRuntime, FastMCPMemory, XMLParseResult, StateComposer, UUIDGenerator, FastMCPEntity, MessageContent, VoiceMemory } from '../types/index.js';
/**
 * Generates a UUID (replaces createUniqueUuid from ElizaOS)
 */
export declare const generateUUID: UUIDGenerator;
/**
 * Parses XML response from AI model (replaces parseKeyValueXml from ElizaOS)
 */
export declare function parseXMLResponse(xmlString: string): XMLParseResult;
/**
 * Composes a prompt from state and template (replaces composePromptFromState from ElizaOS)
 */
export declare const composePromptFromState: StateComposer;
/**
 * Formats a timestamp (replaces formatTimestamp from ElizaOS)
 */
export declare function formatTimestamp(timestamp: number): string;
/**
 * Formats a timestamp to a relative time string (replaces formatTimestamp from ElizaOS)
 */
export declare function formatRelativeTimestamp(timestamp: number): string;
/**
 * Creates a mock logger (replaces ElizaOS logger)
 */
export declare const createLogger: () => {
    debug: (message: string, data?: unknown) => void;
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
};
/**
 * Mock AI model interface for development/testing
 */
export declare const createMockAIModel: () => {
    generateText(prompt: string): Promise<string>;
};
/**
 * Generates a message response using AI model (replaces ElizaOS message processing)
 */
export declare function processMessageWithAI(runtime: FastMCPRuntime, messageText: string, senderName: string, template: string): Promise<XMLParseResult>;
/**
 * Simulates ElizaOS entity management for FastMCP
 */
export declare function createFastMCPEntity(agentId: string, fromId: string | number, senderName: string): FastMCPEntity;
/**
 * Creates a FastMCP memory object (replaces ElizaOS Memory)
 */
export declare function createFastMCPMemory(messageId: string, entityId: string, agentId: string, roomId: string, worldId: string, content: MessageContent): FastMCPMemory;
/**
 * Creates a WAV header for audio data (replaces getWavHeader from ElizaOS)
 */
export declare function createWavHeader(dataLength: number, sampleRate?: number, channels?: number, bitsPerSample?: number): Buffer;
/**
 * Validates transcription text (replaces ElizaOS validation)
 */
export declare function isValidTranscription(text: string): boolean;
/**
 * Processes voice message with AI model (replaces ElizaOS voice processing)
 */
export declare function processVoiceTranscription(runtime: FastMCPRuntime, audioBuffer: Buffer): Promise<string>;
/**
 * Generates audio response using text-to-speech (replaces ElizaOS TTS)
 */
export declare function generateAudioResponse(runtime: FastMCPRuntime, text: string): Promise<Buffer | null>;
/**
 * Creates a voice memory object (replaces ElizaOS Memory for voice)
 */
export declare function createVoiceMemory(messageId: string, agentId: string, entityId: string, roomId: string, content: {
    text: string;
    source: string;
    name: string;
    userName: string;
    isVoiceMessage: boolean;
    channelType: string;
    inReplyTo?: string;
}): VoiceMemory;
//# sourceMappingURL=eliza-compat.d.ts.map