import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room,
  TrackPublishOptions,
  TrackSource,
  dispose,
  RoomEvent,
  TrackKind,
  AudioStream,
  DisconnectReason
} from '@livekit/rtc-node';
import { System } from '../core/systems/System.js';
import { spawn } from 'node:child_process';

export interface LiveKitInitOptions {
  wsUrl: string;
  token: string;
}

interface AudioEmitData {
  participant: string;
  buffer: Buffer;
}

export class AgentLiveKit extends System {
  private room: Room | null = null;
  private audioSource: AudioSource | null = null;
  private localTrack: LocalAudioTrack | null = null;

  async deserialize(opts: LiveKitInitOptions): Promise<void> {
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] deserialize() called with wsUrl: ${opts?.wsUrl || 'null/undefined'}`);
    
    // Check if opts or wsUrl is null/undefined
    if (!opts || !opts.wsUrl) {
      console.log('[LiveKit DEBUG] Skipping deserialize - invalid options:', opts);
      return;
    }
    
    // Clean up any existing room first
    if (this.room) {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Cleaning up existing room before creating new one`);
      try {
        await this.room.disconnect();
      } catch (error) {
        console.warn(`[LiveKit DEBUG ${new Date().toISOString()}] Error disconnecting existing room:`, error);
      }
      this.room = null;
    }

    const { wsUrl, token } = opts;
    this.room = new Room();
    
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Attempting to connect to room...`);
    
    try {
      // Add timeout to prevent hanging
      const connectPromise = this.room.connect(wsUrl, token, {
        autoSubscribe: true,
        dynacast: true,
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Room connection timeout after 10 seconds')), 10000);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      console.log('[LiveKit] Connected to room');
      this.setupRoomEvents();
    } catch (error) {
      console.error(`[LiveKit DEBUG ${new Date().toISOString()}] Failed to connect to room:`, error);
      this.room = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] AgentLiveKit.stop() called`);
    
    // Clean up audio resources first
    if (this.localTrack) {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Cleaning up local track`);
      try {
        // Unpublish the track if it's published and room is still connected
        if (this.room?.localParticipant && this.localTrack.sid) {
          await this.room.localParticipant.unpublishTrack(this.localTrack.sid);
        }
      } catch (error) {
        // Ignore "track not found" errors during cleanup - this is expected
        if (error instanceof Error && !error.message.includes('track not found')) {
          console.warn(`[LiveKit DEBUG ${new Date().toISOString()}] Error unpublishing track:`, error);
        }
      }
      this.localTrack = null;
    }
    
    if (this.audioSource) {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Cleaning up audio source`);
      this.audioSource = null;
    }
    
    if (this.room) {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Attempting to disconnect from room...`);
      try {
        // Manually emit the Disconnected event before calling disconnect
        // This ensures the event is fired even if the SDK doesn't emit it
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Manually emitting Disconnected event`);
        this.room.emit(RoomEvent.Disconnected, DisconnectReason.CLIENT_INITIATED);
        
        // Small delay to allow event handlers to process
        await new Promise(resolve => setTimeout(resolve, 50));
        
        await this.room.disconnect();
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] this.room.disconnect() completed.`);
      } catch (error) {
        console.error(`[LiveKit DEBUG ${new Date().toISOString()}] Error during this.room.disconnect():`, error);
      }
      
      // Reset room to null
      this.room = null;
    } else {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] No room to disconnect from.`);
    }

    // Add a small delay to allow the Disconnected event to propagate before disposing
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Delaying for 100ms before dispose().`);
    await new Promise(resolve => setTimeout(resolve, 100)); 

    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Calling dispose().`);
    await dispose(); 
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] dispose() completed.`);
  }

  private setupRoomEvents(): void {
    if (!this.room) return;

    this.room.on(RoomEvent.ParticipantConnected, (p) => {
      console.log(`[LiveKit] Participant connected: ${p.identity}`);
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKit] Disconnected from room');
    });

    this.room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log(`[LiveKit] TrackPublished by ${participant.identity}`);
    });

    this.room.on(RoomEvent.TrackSubscribed, async (track, _publication, participant) => {
      console.log(`[LiveKit] TrackSubscribed: ${track.kind} from ${participant.identity}`);
      if (track.kind === TrackKind.KIND_AUDIO) {
        const stream = new AudioStream(track);
        for await (const frame of stream) {
          if (!track.sid) return;
          const int16 = frame.data;
          (this as unknown as { emit: (event: string, data: AudioEmitData) => void }).emit('audio', {
            participant: participant.identity,
            buffer: Buffer.from(int16.buffer),
          });
        }
      }
    });
  }

  // Framework stubs
  // init() {}
  preTick() {}
  preFixedUpdate() {}
  fixedUpdate() {}
  postFixedUpdate() {}
  preUpdate() {}
  update() {}
  postUpdate() {}
  lateUpdate() {}
  postLateUpdate() {}
  commit() {}
  postTick() {}
  start() {}

  async publishAudioStream(audioBuffer: Buffer): Promise<void> {
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] publishAudioStream() called with buffer size: ${audioBuffer.length}`);
    
    const sampleRate = 48000;
    const numChannels = 1;
    const frameDurationMs = 100;
    const samplesPerFrame = (sampleRate * frameDurationMs) / 1000;
  
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Converting audio to PCM...`);
    const int16 = await this.convertToPcm(audioBuffer, sampleRate);
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] PCM conversion completed, samples: ${int16?.length || 0}`);
    
    if (!int16 || int16.length === 0) {
      console.warn('No PCM data decoded');
      return;
    }
  
    if (!this.audioSource) {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Creating new audio source and track...`);
      this.audioSource = new AudioSource(sampleRate, numChannels);
      this.localTrack = LocalAudioTrack.createAudioTrack('agent-voice', this.audioSource);
  
      const options = new TrackPublishOptions();
      options.source = TrackSource.SOURCE_MICROPHONE;
      
      if (this.room?.localParticipant) {
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Publishing track...`);
        try {
          await this.room.localParticipant.publishTrack(this.localTrack, options);
          console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Track published successfully`);
        } catch (error) {
          console.error(`[LiveKit DEBUG ${new Date().toISOString()}] Error publishing track:`, error);
          throw error;
        }
      } else {
        console.error(`[LiveKit DEBUG ${new Date().toISOString()}] No room or local participant available`);
        throw new Error('No room or local participant available for publishing');
      }
    }
  
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Capturing silence frame...`);
    const silence = new Int16Array(samplesPerFrame);
    await this.audioSource.captureFrame(new AudioFrame(silence, sampleRate, numChannels, silence.length));
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Silence frame captured`);
  
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Capturing audio frames, total samples: ${int16.length}, frames: ${Math.ceil(int16.length / samplesPerFrame)}`);
    for (let i = 0; i < int16.length; i += samplesPerFrame) {
      const slice = int16.slice(i, i + samplesPerFrame);
      const frame = new AudioFrame(slice, sampleRate, numChannels, slice.length);
      await this.audioSource.captureFrame(frame);
      
      if (i % (samplesPerFrame * 10) === 0) { // Log every 10 frames
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Captured frame ${Math.floor(i / samplesPerFrame) + 1}`);
      }
    }
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] All audio frames captured successfully`);
  }

  private async convertToPcm(buffer: Buffer, sampleRate = 48000): Promise<Int16Array> {
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] convertToPcm() called, buffer size: ${buffer.length}`);
    
    const format = this.detectAudioFormat(buffer);
    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Detected audio format: ${format}`);

    if (format === 'pcm') {
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Format is PCM, returning directly`);
      return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
    }

    const ffmpegArgs: string[] = [
      '-f',
      format,
      '-i',
      'pipe:0',
      '-f',
      's16le',
      '-ar',
      sampleRate.toString(),
      '-ac',
      '1',
      'pipe:1',
    ];

    console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Starting ffmpeg with args:`, ffmpegArgs);

    return new Promise((resolve, reject) => {
      // Add timeout for ffmpeg process
      const timeoutId = setTimeout(() => {
        console.error(`[LiveKit DEBUG ${new Date().toISOString()}] ffmpeg process timeout after 10 seconds`);
        ff.kill('SIGKILL');
        reject(new Error('ffmpeg process timeout after 10 seconds'));
      }, 10000);

      const ff = spawn('ffmpeg', ffmpegArgs);
      let raw = Buffer.alloc(0);

      ff.stdout.on('data', (chunk) => {
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] ffmpeg stdout data received: ${chunk.length} bytes`);
        raw = Buffer.concat([raw, chunk]);
      });

      ff.stderr.on('data', (data) => {
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] ffmpeg stderr:`, data.toString());
      });
      
      ff.on('close', (code) => {
        clearTimeout(timeoutId);
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] ffmpeg process closed with code: ${code}`);
        
        if (code !== 0) {
          return reject(new Error(`ffmpeg failed (code ${code})`));
        }
        
        const samples = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
        console.log(`[LiveKit DEBUG ${new Date().toISOString()}] ffmpeg conversion completed, samples: ${samples.length}`);
        resolve(samples);
      });

      ff.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`[LiveKit DEBUG ${new Date().toISOString()}] ffmpeg process error:`, error);
        reject(error);
      });

      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Writing buffer to ffmpeg stdin...`);
      ff.stdin.write(buffer);
      ff.stdin.end();
      console.log(`[LiveKit DEBUG ${new Date().toISOString()}] Buffer written to ffmpeg stdin and ended`);
    });
  }

  private detectAudioFormat(buffer: Buffer): 'mp3' | 'wav' | 'pcm' {
    const header = buffer.slice(0, 4).toString('ascii');
    if (header === 'RIFF') return 'wav';
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';
    return 'pcm';
  }
}