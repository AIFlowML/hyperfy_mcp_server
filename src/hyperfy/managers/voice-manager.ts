import type { 
  VoiceManagerRuntime, LiveKitAudioData, VoiceUserState, VoiceMemory, 
  VoiceContent, VoiceCallback, AudioBuffer, FastMCPRuntime 
} from "../../types/index.js";
import { HyperfyService } from "../../core/hyperfy-service.js";
import { convertToAudioBuffer } from "../../utils/utils.js";
import { agentActivityLock } from "./guards.js";
import { 
  generateUUID, createWavHeader, isValidTranscription, 
  processVoiceTranscription, generateAudioResponse, createVoiceMemory 
} from "../../utils/eliza-compat.js";

// Export the runtime type for service.ts
export type { VoiceManagerRuntime } from '../../types/index.js';

// Extended runtime interface for ElizaOS compatibility
interface ExtendedVoiceManagerRuntime extends VoiceManagerRuntime {
  ensureConnection(params: {
    entityId: string;
    roomId: string;
    userName: string;
    name: string;
    source: string;
    channelId: string;
    serverId: string;
    type: string;
    worldId: string;
    userId: string;
  }): Promise<void>;
  createMemory(memory: unknown, tableName: string): Promise<void>;
  emitEvent(eventType: string, eventData: unknown): Promise<void>;
}

export class VoiceManager {
  private runtime: ExtendedVoiceManagerRuntime;
  private userStates: Map<string, VoiceUserState> = new Map();
  private processingVoice = false;
  private transcriptionTimeout: NodeJS.Timeout | null = null;

  constructor(runtime: VoiceManagerRuntime) {
    this.runtime = runtime as ExtendedVoiceManagerRuntime;

    const service = this.getService();
    const world = service.getWorld();

    // Add null check for world before accessing livekit
    if (!world) {
      throw new Error('[VoiceManager] World is not available - cannot initialize voice manager');
    }

    world.livekit.on('audio', async (data: LiveKitAudioData) => {
      function isLoudEnough(pcmBuffer: Buffer, threshold = 1000): boolean {
        let sum = 0;
        const sampleCount = Math.floor(pcmBuffer.length / 2); // 16-bit samples
      
        for (let i = 0; i < pcmBuffer.length; i += 2) {
          const sample = pcmBuffer.readInt16LE(i);
          sum += Math.abs(sample);
        }
      
        const avgAmplitude = sum / sampleCount;
        return avgAmplitude > threshold;
      }

      const playerId = data.participant;
      if (!this.userStates.has(playerId)) {
        this.userStates.set(playerId, {
          buffers: [],
          totalLength: 0,
          lastActive: Date.now(),
          transcriptionText: '',
        });
      }

      const pcmBuffer = data.buffer;
      if (isLoudEnough(pcmBuffer)) {
        this.handleUserBuffer(playerId, pcmBuffer)
      }
    })
  }

  async handleUserBuffer(playerId: string, buffer: Buffer): Promise<void> {
    const state = this.userStates.get(playerId);
    if (!state) {
      console.warn(`VoiceManager: No state found for player ${playerId}`);
      return;
    }
    
    try {
      state.buffers.push(buffer);
      state.totalLength += buffer.length;
      state.lastActive = Date.now();
      this.debouncedProcessTranscription(playerId);
    } catch (error) {
      console.error(`Error processing buffer for user ${playerId}:`, error);
    }
  }

  async debouncedProcessTranscription(
    playerId: string,
  ) {
    const DEBOUNCE_TRANSCRIPTION_THRESHOLD = 1500; // wait for 1.5 seconds of silence

    if (this.processingVoice) {
      const state = this.userStates.get(playerId);
      if (state) {
        state.buffers.length = 0;
        state.totalLength = 0;
      }
      return;
    }

    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
    }

    this.transcriptionTimeout = setTimeout(async () => {
      await agentActivityLock.run(async () => {
        this.processingVoice = true;
        try {
          await this.processTranscription(playerId);

          // Clean all users' previous buffers
          for (const state of this.userStates.values()) {
            state.buffers.length = 0;
            state.totalLength = 0;
            state.transcriptionText = '';
          }
        } finally {
          this.processingVoice = false;
        }
      })
    }, DEBOUNCE_TRANSCRIPTION_THRESHOLD) as unknown as NodeJS.Timeout;
  }

  private async processTranscription(playerId: string): Promise<void> {
    const state = this.userStates.get(playerId);
    if (!state || state.buffers.length === 0) return;
    
    try {
      const inputBuffer = Buffer.concat(state.buffers, state.totalLength);

      state.buffers.length = 0; // Clear the buffers
      state.totalLength = 0;
      
      // Convert Opus to WAV
      const wavHeader = createWavHeader(inputBuffer.length, 48000);
      const wavBuffer = Buffer.concat([wavHeader, inputBuffer]);
      console.log('Starting transcription...');

      // Use FastMCP-compatible transcription
      const mockRuntime: FastMCPRuntime = {
        aiModel: this.runtime.aiModel,
        agentId: this.runtime.agentId,
        agentName: this.runtime.agentName,
        hyperfyService: this.runtime.hyperfyService,
        logger: console,
        generateUUID: () => generateUUID({} as FastMCPRuntime, '')
      };
      
      const transcriptionText = await processVoiceTranscription(mockRuntime, wavBuffer);

      console.log("[VOICE MANAGER] Transcription: ", transcriptionText);

      if (transcriptionText && isValidTranscription(transcriptionText)) {
        state.transcriptionText += transcriptionText;
      }

      if (state.transcriptionText.length) {
        const finalText = state.transcriptionText;
        state.transcriptionText = '';
        await this.handleMessage(finalText, playerId);
      }
    } catch (error) {
      console.error(`Error transcribing audio for user ${playerId}:`, error);
    }
  }

  private async handleMessage(message: string, playerId: string): Promise<{ text: string; actions: string[] } | undefined> {
    try {
      if (!message || message.trim() === '' || message.length < 3) {
        return { text: '', actions: ['IGNORE'] };
      }
      
      const service = this.getService();
      const world = service.getWorld();

      // Add null check for world
      if (!world) {
        console.error('[VoiceManager] World is not available - cannot process voice message');
        return { text: '', actions: ['ERROR'] };
      }

      // Fix entity access - use player property instead of getPlayer method
      const playerInfo = world.entities.player;
      if (!playerInfo) {
        console.error(`[VoiceManager] Player info not available for ${playerId}`);
        return { text: '', actions: ['ERROR'] };
      }
      
      const userName = playerInfo.data.name;
      const name = userName;
      const _currentWorldId = service.currentWorldId;
      
      // Handle null worldId values by providing defaults
      const channelId = _currentWorldId || 'hyperfy-default-world';
      const worldId = _currentWorldId || 'hyperfy-default-world';
      
      // Create FastMCP-compatible runtime for ID generation
      const mockRuntime: FastMCPRuntime = {
        aiModel: this.runtime.aiModel,
        agentId: this.runtime.agentId,
        agentName: this.runtime.agentName,
        hyperfyService: this.runtime.hyperfyService,
        logger: console,
        generateUUID: () => generateUUID({} as FastMCPRuntime, '')
      };
      
      const roomId = generateUUID(mockRuntime, worldId);
      const entityId = generateUUID(mockRuntime, playerId);

      const type = 'WORLD'; // ChannelType.WORLD equivalent

      // Ensure connection for the sender entity - preserve ElizaOS functionality
      await this.runtime.ensureConnection({
        entityId,
        roomId,
        userName,
        name,
        source: 'hyperfy',
        channelId,
        serverId: 'hyperfy',
        type: 'WORLD', // ChannelType.WORLD equivalent
        worldId,
        userId: playerId
      });

      // Create the voice memory using our helper
      const memory = createVoiceMemory(
        generateUUID(mockRuntime, `${channelId}-voice-message-${Date.now()}`),
        this.runtime.agentId,
        entityId,
        roomId,
        {
          text: message,
          source: 'hyperfy',
          name: name,
          userName: userName,
          isVoiceMessage: true,
          channelType: type,
        }
      );
      
      // Add worldId to match original ElizaOS Memory structure - convert null to undefined
      memory.worldId = _currentWorldId || undefined;

      const callback: VoiceCallback = async (content: VoiceContent, _files: unknown[] = []): Promise<VoiceMemory[]> => {
        console.info(`[Hyperfy Voice Chat Callback] Received response: ${JSON.stringify(content)}`);
        
        try {
          const responseMemory = createVoiceMemory(
            generateUUID(mockRuntime, `${memory.id}-voice-response-${Date.now()}`),
            this.runtime.agentId,
            this.runtime.agentId,
            roomId,
            {
              text: content.text || '',
              source: 'hyperfy',
              name: this.runtime.character.name,
              userName: this.runtime.character.name,
              isVoiceMessage: true,
              channelType: type,
              inReplyTo: memory.id,
            }
          );

          // Store the response memory if createMemory exists
          if (this.runtime.createMemory) {
            await this.runtime.createMemory(responseMemory, 'messages');
          }

          if (responseMemory.content.text?.trim()) {
            const responseStream = await generateAudioResponse(mockRuntime, content.text || '');
            
            if (responseStream) {
              const audioBuffer = await convertToAudioBuffer(responseStream);
              const emoteManager = service.getEmoteManager();
              const emote = content.emote || "TALK";
              emoteManager.playEmote(emote);
              await this.playAudio(audioBuffer);
            }
          }

          return [responseMemory];
        } catch (error) {
          console.error('Error in voice message callback:', error);
          return [];
        }
      };

      agentActivityLock.enter();
      
      // Emit voice-specific events - preserve ElizaOS functionality
      await this.runtime.emitEvent('VOICE_MESSAGE_RECEIVED', {
        runtime: this.runtime,
        message: memory,
        callback,
        onComplete: () => {
          agentActivityLock.exit();
        },
      });
      
    } catch (error) {
      console.error('Error processing voice message:', error);
    }
  }

  async playAudio(audioBuffer: Buffer): Promise<void> {
    if (this.processingVoice) {
      console.info('[VOICE MANAGER] Current voice is processing.....');
      return;
    }

    const service = this.getService();
    const world = service.getWorld();
    
    // Add null check for world
    if (!world) {
      console.error('[VoiceManager] World is not available - cannot play audio');
      return;
    }
    
    this.processingVoice = true;

    try {
      await world.livekit.publishAudioStream(audioBuffer);
    } catch(error) {
      console.error(error);
    } finally {
      this.processingVoice = false;
    }
  }

  private getService(): HyperfyService {
    // In FastMCP, the service is directly available on runtime
    // but we preserve the serviceType reference for consistency
    console.debug(`[VoiceManager] Getting service of type: ${HyperfyService.serviceType}`);
    return this.runtime.hyperfyService as HyperfyService;
  }

  
}