import { HyperfyService } from "../../core/hyperfy-service.js";
import { convertToAudioBuffer } from "../../utils/utils.js";
import { agentActivityLock } from "./guards.js";
import { generateUUID, createWavHeader, isValidTranscription, processVoiceTranscription, generateAudioResponse, createVoiceMemory } from "../../utils/eliza-compat.js";
export class VoiceManager {
    constructor(runtime) {
        this.userStates = new Map();
        this.processingVoice = false;
        this.transcriptionTimeout = null;
        this.runtime = runtime;
        const service = this.getService();
        const world = service.getWorld();
        // Add null check for world before accessing livekit
        if (!world) {
            throw new Error('[VoiceManager] World is not available - cannot initialize voice manager');
        }
        world.livekit.on('audio', async (data) => {
            function isLoudEnough(pcmBuffer, threshold = 1000) {
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
                this.handleUserBuffer(playerId, pcmBuffer);
            }
        });
    }
    async handleUserBuffer(playerId, buffer) {
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
        }
        catch (error) {
            console.error(`Error processing buffer for user ${playerId}:`, error);
        }
    }
    async debouncedProcessTranscription(playerId) {
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
                }
                finally {
                    this.processingVoice = false;
                }
            });
        }, DEBOUNCE_TRANSCRIPTION_THRESHOLD);
    }
    async processTranscription(playerId) {
        const state = this.userStates.get(playerId);
        if (!state || state.buffers.length === 0)
            return;
        try {
            const inputBuffer = Buffer.concat(state.buffers, state.totalLength);
            state.buffers.length = 0; // Clear the buffers
            state.totalLength = 0;
            // Convert Opus to WAV
            const wavHeader = createWavHeader(inputBuffer.length, 48000);
            const wavBuffer = Buffer.concat([wavHeader, inputBuffer]);
            console.log('Starting transcription...');
            // Use FastMCP-compatible transcription
            const mockRuntime = {
                aiModel: this.runtime.aiModel,
                agentId: this.runtime.agentId,
                agentName: this.runtime.agentName,
                hyperfyService: this.runtime.hyperfyService,
                logger: console,
                generateUUID: () => generateUUID({}, '')
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
        }
        catch (error) {
            console.error(`Error transcribing audio for user ${playerId}:`, error);
        }
    }
    async handleMessage(message, playerId) {
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
            const mockRuntime = {
                aiModel: this.runtime.aiModel,
                agentId: this.runtime.agentId,
                agentName: this.runtime.agentName,
                hyperfyService: this.runtime.hyperfyService,
                logger: console,
                generateUUID: () => generateUUID({}, '')
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
            const memory = createVoiceMemory(generateUUID(mockRuntime, `${channelId}-voice-message-${Date.now()}`), this.runtime.agentId, entityId, roomId, {
                text: message,
                source: 'hyperfy',
                name: name,
                userName: userName,
                isVoiceMessage: true,
                channelType: type,
            });
            // Add worldId to match original ElizaOS Memory structure - convert null to undefined
            memory.worldId = _currentWorldId || undefined;
            const callback = async (content, _files = []) => {
                console.info(`[Hyperfy Voice Chat Callback] Received response: ${JSON.stringify(content)}`);
                try {
                    const responseMemory = createVoiceMemory(generateUUID(mockRuntime, `${memory.id}-voice-response-${Date.now()}`), this.runtime.agentId, this.runtime.agentId, roomId, {
                        text: content.text || '',
                        source: 'hyperfy',
                        name: this.runtime.character.name,
                        userName: this.runtime.character.name,
                        isVoiceMessage: true,
                        channelType: type,
                        inReplyTo: memory.id,
                    });
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
                }
                catch (error) {
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
        }
        catch (error) {
            console.error('Error processing voice message:', error);
        }
    }
    async playAudio(audioBuffer) {
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
        }
        catch (error) {
            console.error(error);
        }
        finally {
            this.processingVoice = false;
        }
    }
    getService() {
        // In FastMCP, the service is directly available on runtime
        // but we preserve the serviceType reference for consistency
        console.debug(`[VoiceManager] Getting service of type: ${HyperfyService.serviceType}`);
        return this.runtime.hyperfyService;
    }
}
//# sourceMappingURL=voice-manager.js.map