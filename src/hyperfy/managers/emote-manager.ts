import { readFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { EMOTES_LIST } from '../../servers/config/constants.js'
import { hashFileBuffer } from '../../utils/utils.js'
import type { EmoteManagerRuntime, HyperfyPlayerEntity } from '../../types/index.js'
import type { HyperfyService } from '../../core/hyperfy-service.js'

// Export the runtime type for service.ts
export type { EmoteManagerRuntime } from '../../types/index.js';

// Import the actual Emotes object - TypeScript error is acceptable for runtime functionality
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Missing declaration file for JS module, but needed for runtime fallback emotes
import { Emotes } from '../core/extras/playerEmotes.js'

// Type guards for safe unknown type handling
function hasEffect(data: unknown): data is { effect?: { emote?: string | null } } {
  return typeof data === 'object' && data !== null;
}

function hasMovingProperty(entity: unknown): entity is { moving?: boolean } {
  return typeof entity === 'object' && entity !== null && 'moving' in entity;
}

function isPlayerDataWithEffect(data: unknown): data is { effect?: { emote?: string | null } } {
  return typeof data === 'object' && data !== null;
}

export class EmoteManager {
  private emoteHashMap: Map<string, string>
  private currentEmoteTimeout: NodeJS.Timeout | null
  private movementCheckInterval: NodeJS.Timeout | null = null;
  private runtime: EmoteManagerRuntime;

  constructor(runtime: EmoteManagerRuntime) {
    this.runtime = runtime;
    this.emoteHashMap = new Map()
    this.currentEmoteTimeout = null
  }

  async uploadEmotes() {
    for (const emote of EMOTES_LIST) {
      try {
        const emoteBuffer = await readFile(resolve(emote.path));
        const emoteMimeType = "model/gltf-binary";

        const emoteHash = await hashFileBuffer(emoteBuffer);
        const emoteExt = emote.path.split(".").pop()?.toLowerCase() || "glb";
        const emoteFullName = `${emoteHash}.${emoteExt}`;
        const emoteUrl = `asset://${emoteFullName}`;

        console.info(
          `[Appearance] Uploading emote '${emote.name}' as ${emoteFullName} (${(emoteBuffer.length / 1024).toFixed(2)} KB)`
        );

        const emoteFile = new File([emoteBuffer], basename(emote.path), {
          type: emoteMimeType,
        });

        const service = this.getService();
        const world = service.getWorld();
        
        // Add null check for world
        if (!world) {
          console.error(`[Appearance] World not available for emote upload: ${emote.name}`);
          continue;
        }

        const emoteUploadPromise = world.network.upload(emoteFile);
        const emoteTimeout = new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("Upload timed out")), 30000)
        );

        await Promise.race([emoteUploadPromise, emoteTimeout]);

        this.emoteHashMap.set(emote.name, emoteFullName);
        console.info(
          `[Appearance] Emote '${emote.name}' uploaded: ${emoteUrl}`
        );
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[Appearance] Failed to upload emote '${emote.name}': ${error.message}`,
          error.stack
        );
      }
    }
  }

  playEmote(name: string) {
    const fallback = (Emotes as Record<string, string>)[name];
    const hashName = this.emoteHashMap.get(name) || fallback;
    const service = this.getService();
    const world = service.getWorld();

    if (!hashName) {
      console.warn(`[Emote] Emote '${name}' not found.`);
      return;
    }

    if (!world) {
      console.warn("[Emote] World not available.");
      return;
    }

    const agentPlayer = world?.entities?.player;
    if (!agentPlayer) {
      console.warn("[Emote] Player entity not found.");
      return;
    }

    // Add null safety check for player data
    if (!agentPlayer.data) {
      console.warn("[Emote] Player data not available.");
      return;
    }

    const emoteUrl = hashName.startsWith('asset://') ? hashName : `asset://${hashName}`;
    
    // Use type guard to safely handle unknown player data structure
    const playerData = agentPlayer.data as unknown;
    if (hasEffect(playerData)) {
      playerData.effect = playerData.effect || {};
      playerData.effect.emote = emoteUrl;
    } else {
      console.warn("[Emote] Player data structure incompatible with effects.");
      return;
    }

    console.info(`[Emote] Playing '${name}' → ${emoteUrl}`);

    this.clearTimers();

    // Get duration from EMOTES_LIST
    const emoteMeta = EMOTES_LIST.find(e => e.name === name);
    const duration = emoteMeta?.duration || 1.5;

    this.movementCheckInterval = setInterval(() => {
      // Check if player is moving using type guard
      if (hasMovingProperty(agentPlayer) && agentPlayer.moving) {
        console.info(`[EmoteManager] '${name}' cancelled early due to movement`);
        this.clearEmote(playerData);
      }
    }, 100);

    this.currentEmoteTimeout = setTimeout(() => {
      if (hasEffect(playerData) && playerData.effect?.emote === emoteUrl) {
        console.info(`[EmoteManager] '${name}' finished after ${duration}s`);
        this.clearEmote(playerData);
      }
    }, duration * 1000);
  }

  private clearEmote(playerData: unknown) {
    if (isPlayerDataWithEffect(playerData) && playerData.effect) {
      playerData.effect.emote = null;
    }
    this.clearTimers();
  }

  private clearTimers() {
    if (this.currentEmoteTimeout) {
      clearTimeout(this.currentEmoteTimeout);
      this.currentEmoteTimeout = null;
    }
    if (this.movementCheckInterval) {
      clearInterval(this.movementCheckInterval);
      this.movementCheckInterval = null;
    }
  }

  private getService(): HyperfyService {
    return this.runtime.hyperfyService as HyperfyService;
  }
}
