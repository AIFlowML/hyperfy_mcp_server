import { AgentLiveKit, type LiveKitInitOptions } from '../../src/hyperfy/systems/liveKit.js';

const LIVEKIT_WS_URL = 'ws://localhost:7880'; 
// Token from docs/livekit.md
const LIVEKIT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDg1MTQ2NjIsImlzcyI6ImRldmtleSIsIm5hbWUiOiJ0ZXN0LWFnZW50IiwibmJmIjoxNzQ4NDI4MjYyLCJzdWIiOiJ0ZXN0LWFnZW50IiwidmlkZW8iOnsicm9vbSI6InRlc3Qtcm9vbSIsInJvb21Kb2luIjp0cnVlfX0.stXHNlkrrGGVqjYxrNbYVOteTRgv3kqmpgFHYY3Y9iw';

// Modified to produce raw PCM S16LE data for debugging
const createSilentPcmBuffer = (durationSeconds = 0.1): Buffer => {
    const sampleRate = 48000;
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM (S16LE)
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const dataSize = numSamples * numChannels * bytesPerSample;

    const buffer = Buffer.alloc(dataSize); // Raw PCM data, no header
    // Buffer is already zero-filled (silence)
    return buffer;
};

async function main() {
    console.log('[Debug] Starting LiveKit connection test...');

    if (!LIVEKIT_WS_URL || !LIVEKIT_TOKEN) {
        console.error('[Debug] LIVEKIT_WS_URL or LIVEKIT_TOKEN is missing.');
        return;
    }

    const liveKitSystem = new AgentLiveKit({} as any); // Mock world object

    liveKitSystem.on('audio', (data: { participant: string; buffer: Buffer }) => {
        console.log(`[Debug] Received audio from ${data.participant}, buffer length: ${data.buffer.length}`);
    });

    try {
        console.log(`[Debug] Attempting to connect to ${LIVEKIT_WS_URL} with token...`);
        const opts: LiveKitInitOptions = { wsUrl: LIVEKIT_WS_URL, token: LIVEKIT_TOKEN };
        await liveKitSystem.deserialize(opts);
        console.log('[Debug] deserialize completed.');

        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[Debug] Attempting to publish a short audio stream (raw PCM)...');
        const audioBuffer = createSilentPcmBuffer(0.5); // 500ms of silent PCM
        await liveKitSystem.publishAudioStream(audioBuffer);
        console.log('[Debug] publishAudioStream completed.');

        console.log('[Debug] Waiting for 10 seconds to observe events...');
        await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
        console.error('[Debug] Error during LiveKit test:', error);
    } finally {
        console.log('[Debug] Attempting to stop LiveKit system...');
        await liveKitSystem.stop();
        console.log('[Debug] LiveKit system stopped.');
        console.log('[Debug] LiveKit connection test finished.');
    }
}

main().catch(e => {
    console.error('[Debug] Unhandled error in main:', e);
}); 