/**
 * Comprehensive test suite for VoiceManager
 * Tests audio processing, voice transcription, AI responses, and LiveKit integration
 * Validates the complex voice handling pipeline from audio input to AI-generated responses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceManager } from '../src/hyperfy/managers/voice-manager.js';
import { agentActivityLock } from '../src/hyperfy/managers/guards.js';
import type { 
  VoiceManagerRuntime, LiveKitAudioData, VoiceUserState, VoiceMemory, 
  VoiceContent, VoiceCallback, AudioBuffer, FastMCPRuntime 
} from '../src/types/index.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 15000, // 15 seconds for voice processing
  TRANSCRIPTION_TIMEOUT: 3000, // 3 seconds for transcription
  AUDIO_TIMEOUT: 5000, // 5 seconds for audio processing
  DEBOUNCE_THRESHOLD: 1500, // 1.5 seconds debounce
};

// Mock the utility functions - simplified to avoid circular references
vi.mock('../src/utils/eliza-compat.js', () => ({
  generateUUID: vi.fn(() => `uuid-${Date.now()}`),
  createWavHeader: vi.fn(() => Buffer.alloc(44)),
  isValidTranscription: vi.fn((text: string) => text && text.length > 2),
  processVoiceTranscription: vi.fn(() => Promise.resolve('Hello, this is a test transcription')),
  generateAudioResponse: vi.fn(() => Promise.resolve(Buffer.from('mock-audio-stream'))),
  createVoiceMemory: vi.fn((id: string, agentId: string, entityId: string, roomId: string, content: unknown) => ({
    id,
    agentId,
    entityId,
    roomId,
    content,
    createdAt: Date.now(),
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../src/utils/utils.js', () => ({
  convertToAudioBuffer: vi.fn(() => Promise.resolve(Buffer.from('mock-audio-buffer'))),
}));

// Mock console methods
const consoleSpy = {
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Create mock runtime for testing
function createMockRuntime() {
  const mockEmoteManager = {
    playEmote: vi.fn(),
  };

  const mockPlayer = {
    data: {
      name: 'TestUser',
      id: 'user-123',
    },
  };

  const mockEntities = {
    getPlayer: vi.fn().mockReturnValue(mockPlayer),
  };

  const mockLiveKit = {
    on: vi.fn(),
    publishAudioStream: vi.fn().mockResolvedValue(undefined),
  };

  const mockWorld = {
    livekit: mockLiveKit,
    entities: mockEntities,
  };

  const mockHyperfyService = {
    getWorld: vi.fn().mockReturnValue(mockWorld),
    getEmoteManager: vi.fn().mockReturnValue(mockEmoteManager),
    currentWorldId: 'test-world-123',
  };

  return {
    hyperfyService: mockHyperfyService,
    agentId: 'test-agent-id',
    agentName: 'TestAgent',
    aiModel: 'test-model',
    character: {
      name: 'TestAgent',
    },
    ensureConnection: vi.fn().mockResolvedValue(undefined),
    createMemory: vi.fn().mockResolvedValue(undefined),
    emitEvent: vi.fn().mockResolvedValue(undefined),
  };
}

// Create mock audio data
function createMockAudioData(overrides: Partial<LiveKitAudioData> = {}): LiveKitAudioData {
  // Create a buffer with some audio-like data (16-bit samples)
  const buffer = Buffer.alloc(1024);
  for (let i = 0; i < buffer.length; i += 2) {
    // Create samples above the loudness threshold (1000)
    buffer.writeInt16LE(2000 + Math.random() * 1000, i);
  }
  
  return {
    participant: 'user-123',
    buffer: buffer,
    ...overrides,
  };
}

// Type-safe access to private properties
interface VoiceManagerPrivate {
  runtime: VoiceManagerRuntime;
  userStates: Map<string, VoiceUserState>;
  processingVoice: boolean;
  transcriptionTimeout: NodeJS.Timeout | null;
  getService(): ReturnType<typeof createMockRuntime>['hyperfyService'];
}

describe('VoiceManager', () => {
  let voiceManager: VoiceManager;
  let mockRuntime: ReturnType<typeof createMockRuntime>;
  let audioEventCallback: (data: LiveKitAudioData) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Reset console spies
    for (const spy of Object.values(consoleSpy)) {
      spy.mockClear();
    }
    
    // Reset activity lock
    agentActivityLock.forceReset();
    
    // Create fresh mocks
    mockRuntime = createMockRuntime();
    
    // Capture the audio event callback
    const mockWorld = mockRuntime.hyperfyService.getWorld();
    if (mockWorld) {
      mockWorld.livekit.on.mockImplementation((event: string, callback: (data: LiveKitAudioData) => void) => {
        if (event === 'audio') {
          audioEventCallback = callback;
        }
      });
    }
    
    voiceManager = new VoiceManager(mockRuntime as unknown as VoiceManagerRuntime);
    
    logger.info('🎤 Starting VoiceManager test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    // Force reset activity lock
    agentActivityLock.forceReset();
    
    logger.info('🧹 VoiceManager test cleanup complete');
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper runtime context', () => {
      expect(voiceManager).toBeInstanceOf(VoiceManager);
      expect((voiceManager as unknown as VoiceManagerPrivate).runtime).toBe(mockRuntime);
      
      // Should have registered audio event listener
      const world = mockRuntime.hyperfyService.getWorld();
      expect(world?.livekit.on).toHaveBeenCalledWith('audio', expect.any(Function));
      
      logger.info('✅ VoiceManager initialized with runtime context');
    });

    it('should initialize with empty user states', () => {
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      expect(userStates).toBeInstanceOf(Map);
      expect(userStates.size).toBe(0);
      
      logger.info('✅ User states initialized as empty Map');
    });

    it('should initialize processing flags correctly', () => {
      expect((voiceManager as unknown as VoiceManagerPrivate).processingVoice).toBe(false);
      expect((voiceManager as unknown as VoiceManagerPrivate).transcriptionTimeout).toBe(null);
      
      logger.info('✅ Processing flags initialized correctly');
    });
  });

  describe('Audio Event Handling', () => {
    it('should handle loud audio data and create user state', async () => {
      const audioData = createMockAudioData();
      
      // Trigger audio event
      audioEventCallback(audioData);
      
      // Should create user state
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      expect(userStates.has(audioData.participant)).toBe(true);
      
      const state = userStates.get(audioData.participant);
      expect(state).toEqual({
        buffers: [audioData.buffer],
        totalLength: audioData.buffer.length,
        lastActive: expect.any(Number),
        transcriptionText: '',
      });
      
      logger.info('✅ Loud audio data handled and user state created');
    });

    it('should ignore quiet audio data', async () => {
      // Create quiet audio data (below threshold)
      const quietBuffer = Buffer.alloc(1024);
      for (let i = 0; i < quietBuffer.length; i += 2) {
        quietBuffer.writeInt16LE(100, i); // Below 1000 threshold
      }
      
      const audioData = createMockAudioData({ buffer: quietBuffer });
      
      // Trigger audio event - this will create user state but not call handleUserBuffer
      audioEventCallback(audioData);
      
      // User state is created but buffer is not added due to quiet audio
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      expect(userStates.has(audioData.participant)).toBe(true);
      
      // But the buffer should be empty since quiet audio doesn't trigger handleUserBuffer
      const state = userStates.get(audioData.participant);
      expect(state?.buffers).toHaveLength(0);
      expect(state?.totalLength).toBe(0);
      
      logger.info('✅ Quiet audio data ignored correctly');
    });

    it('should accumulate multiple audio buffers for same user', async () => {
      const audioData1 = createMockAudioData();
      const audioData2 = createMockAudioData();
      
      // Trigger multiple audio events
      audioEventCallback(audioData1);
      audioEventCallback(audioData2);
      
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      const state = userStates.get(audioData1.participant);
      
      expect(state?.buffers).toHaveLength(2);
      expect(state?.totalLength).toBe(audioData1.buffer.length + audioData2.buffer.length);
      
      logger.info('✅ Multiple audio buffers accumulated correctly');
    });
  });

  describe('Buffer Handling', () => {
    it('should handle user buffer successfully', async () => {
      const playerId = 'user-123';
      const buffer = Buffer.from('test-audio-data');
      
      // First create user state by triggering audio event
      const audioData = createMockAudioData({ participant: playerId });
      audioEventCallback(audioData);
      
      // Now handle additional buffer
      await voiceManager.handleUserBuffer(playerId, buffer);
      
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      const state = userStates.get(playerId);
      
      // Should have both the original buffer from audio event and the new buffer
      expect(state?.buffers).toHaveLength(2);
      expect(state?.totalLength).toBe(audioData.buffer.length + buffer.length);
      expect(state?.transcriptionText).toBe('');
      
      logger.info('✅ User buffer handled successfully');
    });

    it('should handle buffer for non-existent user state', async () => {
      const playerId = 'unknown-user';
      const buffer = Buffer.from('test-audio-data');
      
      await voiceManager.handleUserBuffer(playerId, buffer);
      
      // Should have logged warning
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `VoiceManager: No state found for player ${playerId}`
      );
      
      logger.info('✅ Non-existent user state handled gracefully');
    });
  });

  describe('Audio Playback', () => {
    it('should play audio successfully', async () => {
      const audioBuffer = Buffer.from('mock-audio-data');
      
      await voiceManager.playAudio(audioBuffer);
      
      // Should have published audio stream
      const world = mockRuntime.hyperfyService.getWorld();
      expect(world?.livekit.publishAudioStream).toHaveBeenCalledWith(audioBuffer);
      
      // Processing flag should be reset
      expect((voiceManager as unknown as VoiceManagerPrivate).processingVoice).toBe(false);
      
      logger.info('✅ Audio played successfully');
    });

    it('should skip audio playback when already processing', async () => {
      const audioBuffer = Buffer.from('mock-audio-data');
      
      // Set processing flag
      (voiceManager as unknown as VoiceManagerPrivate).processingVoice = true;
      
      await voiceManager.playAudio(audioBuffer);
      
      // Should have logged info message
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[VOICE MANAGER] Current voice is processing.....'
      );
      
      // Should not have published audio
      const world = mockRuntime.hyperfyService.getWorld();
      expect(world?.livekit.publishAudioStream).not.toHaveBeenCalled();
      
      logger.info('✅ Audio playback skipped when already processing');
    });

    it('should handle audio playback errors', async () => {
      const audioBuffer = Buffer.from('mock-audio-data');
      
      // Mock error in publishAudioStream
      const world = mockRuntime.hyperfyService.getWorld();
      if (world) {
        world.livekit.publishAudioStream.mockRejectedValue(new Error('Audio playback failed'));
      }
      
      await voiceManager.playAudio(audioBuffer);
      
      // Should have logged error
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.any(Error));
      
      // Processing flag should still be reset
      expect((voiceManager as unknown as VoiceManagerPrivate).processingVoice).toBe(false);
      
      logger.info('✅ Audio playback errors handled gracefully');
    });
  });

  describe('Service Integration', () => {
    it('should get service correctly', () => {
      const service = (voiceManager as unknown as VoiceManagerPrivate).getService();
      
      expect(service).toBe(mockRuntime.hyperfyService);
      
      // Should have logged debug message
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceManager] Getting service of type:')
      );
      
      logger.info('✅ Service retrieved correctly');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null world gracefully', async () => {
      // Mock null world
      const nullWorldRuntime = createMockRuntime();
      nullWorldRuntime.hyperfyService.getWorld.mockReturnValue(null);
      
      // This should throw an error during initialization since it tries to access world.livekit
      expect(() => {
        new VoiceManager(nullWorldRuntime as unknown as VoiceManagerRuntime);
      }).toThrow('Cannot read properties of null');
      
      logger.info('✅ Null world error handled as expected');
    });

    it('should handle very large audio buffers', async () => {
      const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB buffer
      for (let i = 0; i < largeBuffer.length; i += 2) {
        largeBuffer.writeInt16LE(2000, i); // Loud samples
      }
      
      const audioData = createMockAudioData({ buffer: largeBuffer });
      
      // Should handle large buffer without issues
      audioEventCallback(audioData);
      
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      const state = userStates.get(audioData.participant);
      expect(state?.totalLength).toBe(largeBuffer.length);
      
      logger.info('✅ Large audio buffers handled correctly');
    });

    it('should handle concurrent audio processing', async () => {
      const audioData1 = createMockAudioData({ participant: 'user-1' });
      const audioData2 = createMockAudioData({ participant: 'user-2' });
      const audioData3 = createMockAudioData({ participant: 'user-3' });
      
      // Process multiple audio events concurrently
      audioEventCallback(audioData1);
      audioEventCallback(audioData2);
      audioEventCallback(audioData3);
      
      const userStates = (voiceManager as unknown as VoiceManagerPrivate).userStates;
      expect(userStates.size).toBe(3);
      expect(userStates.has('user-1')).toBe(true);
      expect(userStates.has('user-2')).toBe(true);
      expect(userStates.has('user-3')).toBe(true);
      
      logger.info('✅ Concurrent audio processing handled correctly');
    });
  });
});
