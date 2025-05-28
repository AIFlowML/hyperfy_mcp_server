import 'ses'

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createNodeClientWorld } from '../hyperfy/core/createNodeClientWorld.js'
import { AgentControls } from '../hyperfy/systems/controls.js'
import { AgentLoader } from '../hyperfy/systems/loader.js'
import { AgentLiveKit } from '../hyperfy/systems/liveKit.js'
import { AgentActions, type WorldType } from '../hyperfy/systems/actions.js'
import { loadPhysX } from '../lib/physx/loadPhysX.js'
import { BehaviorManager } from "../hyperfy/managers/behavior-manager.js"
import { EmoteManager } from '../hyperfy/managers/emote-manager.js'
import { MessageManager } from '../hyperfy/managers/message-manager.js'
import { VoiceManager } from '../hyperfy/managers/voice-manager.js'
import { hashFileBuffer } from '../utils/utils.js'
import { generateUUID, createLogger } from '../utils/eliza-compat.js'
import type { FastMCPRuntime } from '../types/index.js'

const LOCAL_AVATAR_PATH = process.env.HYPERFY_AGENT_AVATAR_PATH || './avatars/avatar.vrm'

const HYPERFY_WS_URL = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws'
const HYPERFY_APPEARANCE_POLL_INTERVAL = 30000

// Configuration interface for HyperfyService
export interface HyperfyServiceConfig {
  wsUrl?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  agentId?: string;
  agentName?: string;
}

// Runtime interface to replace ElizaOS IAgentRuntime
export interface HyperfyRuntime {
  agentId: string;
  character: {
    name: string;
  };
  getEntityById: (id: string) => Promise<HyperfyEntity | null>;
  updateEntity: (entity: HyperfyEntity) => Promise<void>;
  // Add missing properties for manager compatibility
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

// Entity interface for compatibility
export interface HyperfyEntity {
  metadata: {
    hyperfy?: {
      id: string;
      name: string;
      userName: string;
    };
  };
}

// Extended world interface for type safety
interface HyperfyWorld {
  playerNamesMap: Map<string, string>;
  livekit: AgentLiveKit;
  actions: AgentActions;
  controls: AgentControls;
  loader: AgentLoader;
  rig?: unknown; // Add missing rig property for WorldType compatibility
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
      modify: (data: { name: string }) => void;
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

// Entity item interface
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
    position?: { x: number; y: number; z: number };
  };
  root?: {
    position?: { x: number; y: number; z: number };
  };
}

// Chat message interface
interface ChatMessage {
  id: string;
  createdAt?: string;
  [key: string]: unknown;
}

// Hyperfy config interface
interface HyperfyConfig {
  wsUrl: string;
  viewport: unknown;
  ui: unknown;
  initialAuthToken?: string;
  loadPhysX: () => Promise<unknown>;
}

export class HyperfyService {
  static serviceType = 'hyperfy'
  capabilityDescription = 'Manages connection and interaction with a Hyperfy world.'

  private world: HyperfyWorld | null = null
  private controls: AgentControls | null = null
  private isConnectedState = false
  private wsUrl: string | null = null
  private _currentWorldId: string | null = null
  private processedMsgIds: Set<string> = new Set()

  private playerNamesMap: Map<string, string> = new Map()
  private appearanceIntervalId: NodeJS.Timeout | null = null
  private appearanceSet = false
  private nameSet = false

  private connectionTime: number | null = null
  private behaviorManager!: BehaviorManager
  private emoteManager!: EmoteManager
  private messageManager!: MessageManager
  private voiceManager!: VoiceManager

  public get currentWorldId(): string | null {
    return this._currentWorldId
  }

  public getWorld(): HyperfyWorld | null {
    return this.world
  }

  constructor(protected runtime: HyperfyRuntime) {
    console.info('HyperfyService instance created')
  }

  static async start(runtime: HyperfyRuntime): Promise<HyperfyService> {
    console.info('*** Starting Hyperfy service ***')
    const service = new HyperfyService(runtime)
    console.info('Attempting automatic connection to default Hyperfy URL:', HYPERFY_WS_URL)
    const defaultWorldId = generateUUID({} as FastMCPRuntime, `${runtime.agentId}-default-hyperfy`)
    const authToken: string | undefined = undefined

    service
      .connect({ wsUrl: HYPERFY_WS_URL, worldId: defaultWorldId, authToken })
      .then(() => console.info('Automatic Hyperfy connection initiated.'))
      .catch(err => console.error('Automatic Hyperfy connection failed:', err.message))

    return service
  }

  static async stop(runtime: HyperfyRuntime): Promise<void> {
    console.info('*** Stopping Hyperfy service ***')
    // Note: In FastMCP we don't have runtime.getService, so this is a placeholder
    console.warn('Hyperfy service stop called - implement service registry if needed')
  }

  async connect(config: { wsUrl: string; authToken?: string; worldId: string }): Promise<void> {
    if (this.isConnectedState) {
      console.warn(`HyperfyService already connected to world ${this._currentWorldId}. Disconnecting first.`)
      await this.disconnect()
    }

    console.info(`Attempting to connect HyperfyService to ${config.wsUrl} for world ${config.worldId}`)
    this.wsUrl = config.wsUrl
    this._currentWorldId = config.worldId
    this.appearanceSet = false
    this.nameSet = false
    
    try {
      const world = createNodeClientWorld() as HyperfyWorld
      this.world = world
      world.playerNamesMap = this.playerNamesMap

      globalThis.self = globalThis as typeof globalThis & Window

      const livekit = new AgentLiveKit(world as unknown as WorldType)
      world.livekit = livekit
      world.systems.push(livekit)

      const actions = new AgentActions(world as unknown as WorldType)
      world.actions = actions
      world.systems.push(actions)
      
      this.controls = new AgentControls(world as unknown as WorldType)
      world.controls = this.controls
      world.systems.push(this.controls)
      
      const loader = new AgentLoader(world as unknown as WorldType)
      world.loader = loader
      world.systems.push(loader)

      // HACK: Overwriting `chat.add` to prevent crashes caused by the original implementation.
      // This ensures safe handling of chat messages and avoids unexpected errors from undefined fields.
      world.chat.add = (msg: ChatMessage, broadcast?: boolean) => {
        const chat = world.chat
        const MAX_MSGS = 50
        
        chat.msgs = [...chat.msgs, msg]

        if (chat.msgs.length > MAX_MSGS) {
          chat.msgs.shift()
        }
        for (const callback of chat.listeners) {
          callback(chat.msgs)
        }

        // emit chat event
        const readOnly = Object.freeze({ ...msg })
        this.world?.events.emit('chat', readOnly)
        // maybe broadcast
        if (broadcast) {
          this.world?.network.send('chatAdded', msg)
        }
      }

      const mockElement = {
        appendChild: () => {},
        removeChild: () => {},
        offsetWidth: 1920,
        offsetHeight: 1080,
        addEventListener: () => {},
        removeEventListener: () => {},
        style: {},
      }

      const hyperfyConfig: HyperfyConfig = {
        wsUrl: this.wsUrl,
        viewport: mockElement,
        ui: mockElement,
        initialAuthToken: config.authToken,
        loadPhysX
      }

      if (typeof this.world.init !== 'function') {
        throw new Error('world.init is not a function')
      }

      // Inject WebSocket polyfill for Node.js environment
      // This ensures the hyperfy core JavaScript files can use WebSocket
      if (typeof globalThis.WebSocket === 'undefined') {
        const { WebSocket } = await import('ws')
        ;(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket
        ;(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket
        console.info('WebSocket polyfill injected for hyperfy core')
      }

      await this.world.init(hyperfyConfig)
      console.info('Hyperfy world initialized.')

      this.processedMsgIds.clear()
      if (this.world.chat?.msgs) {
        console.info(`Processing ${this.world.chat.msgs.length} existing chat messages.`)
        for (const msg of this.world.chat.msgs) {
          if (msg?.id) {
            this.processedMsgIds.add(msg.id)
          }
        }
        console.info(`Populated ${this.processedMsgIds.size} processed message IDs from history.`)
      }

      this.subscribeToHyperfyEvents()

      this.isConnectedState = true

      // Create enhanced runtime for managers
      const enhancedRuntime: HyperfyRuntime = {
        ...this.runtime,
        hyperfyService: this,
        logger: createLogger(),
        generateUUID: () => generateUUID({} as FastMCPRuntime, Date.now().toString()),
        agentName: this.runtime.character.name,
        aiModel: undefined // Placeholder for AI model if needed
      }

      this.emoteManager = new EmoteManager(enhancedRuntime as unknown as import('../hyperfy/managers/emote-manager.js').EmoteManagerRuntime)
      this.messageManager = new MessageManager(enhancedRuntime as unknown as import('../hyperfy/managers/message-manager.js').MessageManagerRuntime)
      this.voiceManager = new VoiceManager(enhancedRuntime as unknown as import('../hyperfy/managers/voice-manager.js').VoiceManagerRuntime)
      this.behaviorManager = new BehaviorManager(enhancedRuntime as unknown as import('../hyperfy/managers/behavior-manager.js').FastMCPRuntime)

      this.startAppearancePolling()

      this.connectionTime = Date.now() // Record connection time

      console.info(`HyperfyService connected successfully to ${this.wsUrl}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error(`HyperfyService connection failed for ${config.worldId} at ${config.wsUrl}: ${errorMessage}`, errorStack)
      await this.handleDisconnect()
      throw error
    }
  }
  
  private subscribeToHyperfyEvents(): void {
    if (!this.world || typeof this.world.on !== 'function') {
        console.warn("[Hyperfy Events] Cannot subscribe: World or world.on not available.")
        return
    }

    this.world.off('disconnect')

    this.world.on('disconnect', (reason: unknown) => {
      const reasonStr = typeof reason === 'string' ? reason : 'Unknown reason'
      console.warn(`Hyperfy world disconnected: ${reasonStr}`)
      // Note: In FastMCP we don't have runtime.emitEvent like ElizaOS
      // Custom event handling could be implemented here if needed
      this.handleDisconnect()
    })

    if (this.world.chat && typeof this.world.chat.subscribe === 'function') {
      this.startChatSubscription()
    } else {
      console.warn('[Hyperfy Events] world.chat.subscribe not available.')
    }
  }

  /**
   * Uploads the character's avatar model and associated emote animations,
   * sets the avatar URL locally, updates emote hash mappings,
   * and notifies the server of the new avatar.
   * 
   * This function handles all assets required for character expression and animation.
   */
  private async uploadCharacterAssets(): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (
      !this.world ||
      !this.world.entities?.player ||
      !this.world.network ||
      !this.world.assetsUrl
    ) {
      console.warn(
        "[Appearance] Cannot set avatar: World, player, network, or assetsUrl not ready."
      )
      return { success: false, error: "Prerequisites not met" }
    }

    const agentPlayer = this.world.entities.player
    const localAvatarPath = path.resolve(LOCAL_AVATAR_PATH)
    let fileName = ""

    try {
      console.info(`[Appearance] Reading avatar file from: ${localAvatarPath}`)
      const fileBuffer: Buffer = await fs.readFile(localAvatarPath)
      fileName = path.basename(localAvatarPath)
      const mimeType = fileName.endsWith(".vrm")
        ? "model/gltf-binary"
        : "application/octet-stream"

      console.info(
        `[Appearance] Uploading ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB, Type: ${mimeType})...`
      )

      if (!crypto.subtle || typeof crypto.subtle.digest !== "function") {
        throw new Error(
          "crypto.subtle.digest is not available. Ensure Node.js version supports Web Crypto API."
        )
      }

      const hash = await hashFileBuffer(fileBuffer)
      const ext = fileName.split(".").pop()?.toLowerCase() || "vrm"
      const fullFileNameWithHash = `${hash}.${ext}`
      const baseUrl = this.world.assetsUrl.replace(/\/$/, "")
      const constructedHttpUrl = `${baseUrl}/${fullFileNameWithHash}`

      if (typeof this.world.network.upload !== "function") {
        console.warn(
          "[Appearance] world.network.upload function not found. Cannot upload."
        )
        return { success: false, error: "Upload function unavailable" }
      }

      try {
        console.info(
          `[Appearance] Uploading avatar to ${constructedHttpUrl}...`
        )
        const fileForUpload = new File([fileBuffer], fileName, {
          type: mimeType,
        })

        const uploadPromise = this.world.network.upload(fileForUpload)
        const timeoutPromise = new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("Upload timed out")), 30000)
        )

        await Promise.race([uploadPromise, timeoutPromise])
        console.info('Avatar uploaded successfully.')
      } catch (uploadError: unknown) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error'
        const errorStack = uploadError instanceof Error ? uploadError.stack : undefined
        console.error(
          `[Appearance] Avatar upload failed: ${errorMessage}`,
          errorStack
        )
        return {
          success: false,
          error: `Upload failed: ${errorMessage}`,
        }
      }

      // Apply avatar locally
      if (agentPlayer && typeof agentPlayer.setSessionAvatar === "function") {
        agentPlayer.setSessionAvatar(constructedHttpUrl)
      } else {
        console.warn(
          "[Appearance] agentPlayer.setSessionAvatar not available."
        )
      }

      // Upload emotes
      await this.emoteManager.uploadEmotes()

      // Notify server
      if (typeof this.world.network.send === "function") {
        this.world.network.send("playerSessionAvatar", {
          avatar: constructedHttpUrl,
        })
        console.info(
          `[Appearance] Sent playerSessionAvatar with: ${constructedHttpUrl}`
        )
      } else {
        console.error(
          "[Appearance] Upload succeeded but world.network.send is not available."
        )
      }

      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (error instanceof Error && 'code' in error && error.code === "ENOENT") {
        console.error(
          `[Appearance] Avatar file not found at ${localAvatarPath}. CWD: ${process.cwd()}`
        )
      } else {
        console.error(
          "[Appearance] Unexpected error during avatar process:",
          errorMessage,
          error instanceof Error ? error.stack : undefined
        )
      }
      return { success: false, error: errorMessage }
    }
  }

  private startAppearancePolling(): void {
    if (this.appearanceIntervalId) clearInterval(this.appearanceIntervalId)
    // Check if both are already set
    const pollingTasks = { avatar: this.appearanceSet, name: this.nameSet } // Track tasks locally

    if (pollingTasks.avatar && pollingTasks.name) {
        console.info("[Appearance/Name Polling] Already set, skipping start.")
        return
    }
    console.info(`[Appearance/Name Polling] Initializing interval every ${HYPERFY_APPEARANCE_POLL_INTERVAL}ms.`)

    
    const f = async () => {
        // Stop polling if both tasks are complete
        if (pollingTasks.avatar && pollingTasks.name) {
            if (this.appearanceIntervalId) clearInterval(this.appearanceIntervalId)
            this.appearanceIntervalId = null
            console.info('[Appearance/Name Polling] Both avatar and name set. Polling stopped.')
            return
        }

        const agentPlayer = this.world?.entities?.player // Get player once
        const agentPlayerReady = !!agentPlayer
        const agentPlayerId = agentPlayer?.data?.id
        const agentPlayerIdReady = !!agentPlayerId
        const networkReady = this.world?.network?.id != null
        const assetsUrlReady = !!this.world?.assetsUrl // Needed for avatar

        // Condition checks player/ID/network readiness for name, adds assetsUrl for avatar
        console.log('agentPlayerReady', agentPlayerReady)
        console.log('agentPlayerIdReady', agentPlayerIdReady)
        console.log('networkReady', networkReady)
        if (agentPlayerReady && agentPlayerIdReady && networkReady) {
            const entityId = generateUUID({} as FastMCPRuntime, agentPlayerId || 'unknown-player')
            const entity = await this.runtime.getEntityById(entityId)
            if (entity && agentPlayerId) {
              entity.metadata.hyperfy = {
                id: agentPlayerId,
                name: agentPlayer?.data?.name,
                userName: agentPlayer?.data?.name
              }
              
              await this.runtime.updateEntity(entity)
            }
            if (this.behaviorManager.start) {
              this.behaviorManager.start()
            }
            
             // --- Set Name (if not already done) ---
             if (!pollingTasks.name) {
                 console.info(`[Name Polling] Player (ID: ${agentPlayerId}), network ready. Attempting name...`)
                 try {
                    await this.changeName(this.runtime.character.name)
                    this.nameSet = true // Update global state
                    pollingTasks.name = true // Update local task tracker
                    console.info(`[Name Polling] Initial name successfully set to "${this.runtime.character.name}".`)
                 } catch (error) {
                     console.error('Name Polling Failed to set initial name:', error)
                 }
             }

             // --- Set Avatar (if not already done AND assets URL ready) ---
             if (!pollingTasks.avatar && assetsUrlReady) {
                 console.info(`[Appearance Polling] Player (ID: ${agentPlayerId}), network, assetsUrl ready. Attempting avatar upload and set...`)
                 const result = await this.uploadCharacterAssets()

                 if (result.success) {
                     this.appearanceSet = true // Update global state
                     pollingTasks.avatar = true // Update local task tracker
                     console.info('Appearance Polling Avatar setting process successfully completed.')
                 } else {
                     console.warn(`[Appearance Polling] Avatar setting process failed: ${result.error || 'Unknown reason'}. Will retry...`)
                 }
             } else if (!pollingTasks.avatar) {
                  console.debug(`[Appearance Polling] Waiting for: Assets URL (${assetsUrlReady})...`)
             }
        } else {
             // Update waiting log
             console.debug(`[Appearance/Name Polling] Waiting for: Player (${agentPlayerReady}), Player ID (${agentPlayerIdReady}), Network (${networkReady})...`)
        }
    }
    this.appearanceIntervalId = setInterval(f, HYPERFY_APPEARANCE_POLL_INTERVAL)
    f()
  }

  private stopAppearancePolling(): void {
    if (this.appearanceIntervalId) {
        clearInterval(this.appearanceIntervalId)
        this.appearanceIntervalId = null
        console.info("[Appearance Polling] Stopped.")
    }
  }

  /**
   * Checks if the service is currently connected to a Hyperfy world.
   */
  public isConnected(): boolean {
    return this.isConnectedState
  }

  public getEntityById(entityId: string): HyperfyEntityItem | null {
    return this.world?.entities?.items?.get(entityId) || null
  }

  public getEntityName(entityId: string): string | null {
    const entity = this.world?.entities?.items?.get(entityId)
    return entity?.data?.name || entity?.blueprint?.name || 'Unnamed'
  }

  async handleDisconnect(): Promise<void> {
      if (!this.isConnectedState && !this.world) return
      console.info('Handling Hyperfy disconnection...')
      this.isConnectedState = false

      this.stopAppearancePolling()

      if (this.world) {
          try {
              if (this.world.network && typeof this.world.network.disconnect === 'function') {
                  console.info("[Hyperfy Cleanup] Calling network.disconnect()...")
                  await this.world.network.disconnect()
              }
              if (typeof this.world.destroy === 'function') {
                  console.info("[Hyperfy Cleanup] Calling world.destroy()...")
                  this.world.destroy()
              }
          } catch (e: unknown) {
              const errorMessage = e instanceof Error ? e.message : 'Unknown cleanup error'
              console.warn(`[Hyperfy Cleanup] Error during world network disconnect/destroy: ${errorMessage}`)
          }
      }

      this.world = null
      this.controls = null
      this.playerNamesMap.clear()
      this.wsUrl = null
      this.appearanceSet = false

      this.processedMsgIds.clear()

      this.connectionTime = null // Clear connection time

      if (this.appearanceIntervalId) { clearInterval(this.appearanceIntervalId); this.appearanceIntervalId = null; }

      console.info('Hyperfy disconnection handling complete.')
  }

  async disconnect(): Promise<void> {
      console.info(`Disconnecting HyperfyService from world ${this._currentWorldId}`)
      await this.handleDisconnect()
      console.info('HyperfyService disconnect complete.')
  }

  /**
   * Changes the agent's display name.
   */
  async changeName(newName: string): Promise<void> {
      if (!this.isConnected() || !this.world?.network || !this.world?.entities?.player) {
          throw new Error('HyperfyService: Cannot change name. Network or player not ready.')
      }
      const agentPlayerId = this.world.entities.player.data.id
      if (!agentPlayerId) {
          throw new Error('HyperfyService: Cannot change name. Player ID not available.')
      }

      console.info(`[Action] Attempting to change name to "${newName}" for ID ${agentPlayerId}`)

      try {

          // 2. Update local state immediately
          // Update the name map
          if (this.playerNamesMap.has(agentPlayerId)) {
               console.info(`[Name Map Update] Setting name via changeName for ID ${agentPlayerId}: '${newName}'`)
               this.playerNamesMap.set(agentPlayerId, newName)
          } else {
               console.warn(`[Name Map Update] Attempted changeName for ID ${agentPlayerId} not currently in map. Adding.`)
               this.playerNamesMap.set(agentPlayerId, newName)
          }

          // --- Use agentPlayer.modify for local update --- >
          const agentPlayer = this.world.entities.player
              agentPlayer.modify({ name: newName })
              agentPlayer.data.name = newName
          
          this.world.network.send('entityModified', { id: agentPlayer.data.id, name: newName })
              console.debug(`[Action] Called agentPlayer.modify({ name: "${newName}" })`)

      } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Action] Error during changeName to "${newName}":`, errorMessage)
          throw error
      }
  }

  async stop(): Promise<void> {
    console.info('*** Stopping Hyperfy service instance ***')
    await this.disconnect()
  }

  private startChatSubscription(): void {
    if (!this.world || !this.world.chat) {
      console.error('Cannot subscribe to chat: World or Chat system not available.')
      return
    }

    console.info('[HyperfyService] Initializing chat subscription...')

    // Pre-populate processed IDs with existing messages
    if (this.world.chat.msgs) {
      for (const msg of this.world.chat.msgs) {
        if (msg?.id) { // Use optional chaining
          this.processedMsgIds.add(msg.id)
        }
      }
    }

    this.world.chat.subscribe((msgs: ChatMessage[]) => {
      // Wait for player entity (ensures world/chat exist too)
      if (!this.world || !this.world.chat || !this.world.entities?.player || !this.connectionTime) return
  
      const newMessagesFound: ChatMessage[] = [] // Temporary list for new messages

      // Step 1: Identify new messages and update processed set
      for (const msg of msgs) {
        // Check timestamp FIRST - only consider messages newer than connection time
        const messageTimestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : 0
        if (!messageTimestamp || messageTimestamp <= this.connectionTime) {
            // console.debug(`[Chat Sub] Ignoring historical/old message ID ${msg?.id} (ts: ${messageTimestamp})`)
            // Ensure historical messages are marked processed if encountered *before* connectionTime was set (edge case)
            if (msg?.id && !this.processedMsgIds.has(msg.id.toString())) {
                 this.processedMsgIds.add(msg.id.toString())
            }
            continue // Skip this message
        }

        // Check if we've already processed this message ID (secondary check for duplicates)
        const msgIdStr = msg.id?.toString()
        if (msgIdStr && !this.processedMsgIds.has(msgIdStr)) {
           newMessagesFound.push(msg) // Add the full message object
           this.processedMsgIds.add(msgIdStr) // Mark ID as processed immediately
        }
      }

      // Step 2: Process only the newly found messages
      if (newMessagesFound.length > 0) {
        console.info('[Chat] Found', newMessagesFound.length, 'new messages to process.')

        for (const msg of newMessagesFound) {
          this.messageManager.handleMessage(msg)
        }
      }
    })
  }

  getEmoteManager() {
    return this.emoteManager
  }

  getBehaviorManager() {
    return this.behaviorManager
  }

  getMessageManager() {
    return this.messageManager
  }

  getVoiceManager() {
    return this.voiceManager
  }
}