// ElizaOS Compatibility Layer for FastMCP
// This module provides replacement functions for ElizaOS core functionality

import { v4 as uuidv4 } from 'uuid';
import type { 
  FastMCPRuntime, FastMCPMemory, BehaviorState, XMLParseResult, 
  StateComposer, UUIDGenerator, FastMCPEntity, MessageContent, VoiceMemory 
} from '../types/index.js';

/**
 * Generates a UUID (replaces createUniqueUuid from ElizaOS)
 */
export const generateUUID: UUIDGenerator = (_runtime: FastMCPRuntime, _seed: string): string => {
  return uuidv4();
};

/**
 * Parses XML response from AI model (replaces parseKeyValueXml from ElizaOS)
 */
export function parseXMLResponse(xmlString: string): XMLParseResult {
  const result: XMLParseResult = {};
  
  try {
    // Extract thought
    const thoughtMatch = xmlString.match(/<thought>\s*(.*?)\s*<\/thought>/s);
    if (thoughtMatch) {
      result.thought = thoughtMatch[1].trim();
    }

    // Extract text
    const textMatch = xmlString.match(/<text>\s*(.*?)\s*<\/text>/s);
    if (textMatch) {
      result.text = textMatch[1].trim();
    }

    // Extract actions
    const actionsMatch = xmlString.match(/<actions>\s*(.*?)\s*<\/actions>/s);
    if (actionsMatch) {
      result.actions = actionsMatch[1].trim();
    }

    // Extract emote
    const emoteMatch = xmlString.match(/<emote>\s*(.*?)\s*<\/emote>/s);
    if (emoteMatch) {
      result.emote = emoteMatch[1].trim();
    }

    // Extract providers
    const providersMatch = xmlString.match(/<providers>\s*(.*?)\s*<\/providers>/s);
    if (providersMatch) {
      result.providers = providersMatch[1].trim();
    }

  } catch (error) {
    console.error('[parseXMLResponse] Error parsing XML:', error);
  }

  return result;
}

/**
 * Composes a prompt from state and template (replaces composePromptFromState from ElizaOS)
 */
export const composePromptFromState: StateComposer = (memory: FastMCPMemory, template: string): string => {
  // For now, this is a simple template replacement
  // In a full implementation, this would include state composition logic
  let prompt = template;
  
  // Replace basic template variables
  prompt = prompt.replace(/{{agentName}}/g, 'Agent');
  prompt = prompt.replace(/{{worldId}}/g, memory.worldId || 'unknown');
  prompt = prompt.replace(/{{timestamp}}/g, new Date().toISOString());
  
  return prompt;
};

/**
 * Formats a timestamp (replaces formatTimestamp from ElizaOS)
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a timestamp to a relative time string (replaces formatTimestamp from ElizaOS)
 */
export function formatRelativeTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMins > 0) {
    return `${diffMins}m ago`;
  }
  return 'now';
}

/**
 * Creates a mock logger (replaces ElizaOS logger)
 */
export const createLogger = () => ({
  debug: (message: string, data?: unknown) => console.debug(`[DEBUG] ${message}`, data || ''),
  info: (message: string, data?: unknown) => console.info(`[INFO] ${message}`, data || ''),
  warn: (message: string, data?: unknown) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message: string, data?: unknown) => console.error(`[ERROR] ${message}`, data || '')
});

/**
 * Mock AI model interface for development/testing
 */
export const createMockAIModel = () => ({
  async generateText(prompt: string): Promise<string> {
    // Mock AI response for development
    return `<response>
      <thought>I should respond to the current situation in the Hyperfy world.</thought>
      <text>Hello! I'm observing the world around me.</text>
      <actions>HYPERFY_AMBIENT_SPEECH</actions>
      <emote>wave</emote>
    </response>`;
  }
});

/**
 * Generates a message response using AI model (replaces ElizaOS message processing)
 */
export async function processMessageWithAI(
  runtime: FastMCPRuntime,
  messageText: string,
  senderName: string,
  template: string
): Promise<XMLParseResult> {
  // Compose prompt using the message template
  const prompt = template
    .replace('{{messageText}}', messageText)
    .replace('{{senderName}}', senderName)
    .replace('{{agentName}}', runtime.agentName || 'Assistant');

  try {
    // Generate AI response
    const aiResponse = await runtime.aiModel.generateText(prompt);
    
    // Parse the XML response
    return parseXMLResponse(aiResponse);
  } catch (error) {
    console.error('[MessageManager] AI processing failed:', error);
    return {
      text: `Hello ${senderName}! I'm having trouble processing your message right now.`,
      thought: 'AI processing failed, providing fallback response'
    };
  }
}

/**
 * Simulates ElizaOS entity management for FastMCP
 */
export function createFastMCPEntity(
  agentId: string,
  fromId: string | number,
  senderName: string
): FastMCPEntity {
  return {
    id: generateUUID({} as FastMCPRuntime, fromId.toString()),
    names: [senderName],
    agentId,
    metadata: {
      hyperfyId: fromId.toString(),
      hyperfyUsername: senderName,
      hyperfyName: senderName,
    }
  };
}

/**
 * Creates a FastMCP memory object (replaces ElizaOS Memory)
 */
export function createFastMCPMemory(
  messageId: string,
  entityId: string,
  agentId: string,
  roomId: string,
  worldId: string,
  content: MessageContent
): FastMCPMemory {
  return {
    id: messageId,
    content: {
      text: content.text || '',
      type: content.channelType || 'hyperfy-chat'
    },
    roomId,
    worldId,
    entityId,
    createdAt: Date.now()
  };
}

/**
 * Creates a WAV header for audio data (replaces getWavHeader from ElizaOS)
 */
export function createWavHeader(dataLength: number, sampleRate = 48000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const wavHeaderLength = 44;
  const fileSize = wavHeaderLength + dataLength - 8;
  
  const header = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Sub-chunk size
  header.writeUInt16LE(1, 20);  // Audio format (PCM = 1)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  
  return header;
}

/**
 * Validates transcription text (replaces ElizaOS validation)
 */
export function isValidTranscription(text: string): boolean {
  if (!text || text.includes('[BLANK_AUDIO]')) return false;
  if (text.trim().length < 3) return false;
  return true;
}

/**
 * Processes voice message with AI model (replaces ElizaOS voice processing)
 */
export async function processVoiceTranscription(
  runtime: FastMCPRuntime,
  audioBuffer: Buffer
): Promise<string> {
  try {
    // In a full implementation, this would call the transcription API
    // For now, we'll use a mock response
    if (runtime.aiModel.transcribeAudio) {
      return await runtime.aiModel.transcribeAudio(audioBuffer);
    }
    
    // Mock transcription for development
    console.info('[processVoiceTranscription] Mock transcription - replace with real API');
    return 'Mock transcription result';
  } catch (error) {
    console.error('[processVoiceTranscription] Error:', error);
    return '';
  }
}

/**
 * Generates audio response using text-to-speech (replaces ElizaOS TTS)
 */
export async function generateAudioResponse(
  runtime: FastMCPRuntime,
  text: string
): Promise<Buffer | null> {
  try {
    // In a full implementation, this would call the TTS API
    if (runtime.aiModel.synthesizeSpeech) {
      return await runtime.aiModel.synthesizeSpeech(text);
    }
    
    // Mock audio generation for development
    console.info('[generateAudioResponse] Mock TTS - replace with real API');
    return Buffer.from('mock-audio-data');
  } catch (error) {
    console.error('[generateAudioResponse] Error:', error);
    return null;
  }
}

/**
 * Creates a voice memory object (replaces ElizaOS Memory for voice)
 */
export function createVoiceMemory(
  messageId: string,
  agentId: string,
  entityId: string,
  roomId: string,
  content: {
    text: string;
    source: string;
    name: string;
    userName: string;
    isVoiceMessage: boolean;
    channelType: string;
    inReplyTo?: string;
  }
): VoiceMemory {
  return {
    id: messageId,
    agentId,
    entityId,
    roomId,
    content,
    createdAt: Date.now()
  };
} 