import 'ses';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createNodeClientWorld } from '../hyperfy/core/createNodeClientWorld.js';
import { AgentControls } from '../hyperfy/systems/controls.js';
import { AgentLoader } from '../hyperfy/systems/loader.js';
import { AgentLiveKit } from '../hyperfy/systems/liveKit.js';
import { AgentActions } from '../hyperfy/systems/actions.js';
import { loadPhysX } from '../lib/physx/loadPhysX.js';
import { BehaviorManager } from "../hyperfy/managers/behavior-manager.js";
import { EmoteManager } from '../hyperfy/managers/emote-manager.js';
import { MessageManager } from '../hyperfy/managers/message-manager.js';
import { VoiceManager } from '../hyperfy/managers/voice-manager.js';
import { hashFileBuffer } from '../utils/utils.js';
import { generateUUID, createLogger } from '../utils/eliza-compat.js';
const LOCAL_AVATAR_PATH = process.env.HYPERFY_AGENT_AVATAR_PATH || './avatars/avatar.vrm';
const HYPERFY_WS_URL = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws';
const HYPERFY_APPEARANCE_POLL_INTERVAL = 30000;
export class HyperfyService {
    get currentWorldId() {
        return this._currentWorldId;
    }
    getWorld() {
        return this.world;
    }
    constructor(runtime) {
        this.runtime = runtime;
        this.capabilityDescription = 'Manages connection and interaction with a Hyperfy world.';
        this.world = null;
        this.controls = null;
        this.isConnectedState = false;
        this.wsUrl = null;
        this._currentWorldId = null;
        this.processedMsgIds = new Set();
        this.playerNamesMap = new Map();
        this.appearanceIntervalId = null;
        this.appearanceSet = false;
        this.nameSet = false;
        this.connectionTime = null;
        console.info('HyperfyService instance created');
    }
    static async start(runtime) {
        console.info('*** Starting Hyperfy service ***');
        const service = new HyperfyService(runtime);
        console.info('Attempting automatic connection to default Hyperfy URL:', HYPERFY_WS_URL);
        const defaultWorldId = generateUUID({}, `${runtime.agentId}-default-hyperfy`);
        const authToken = undefined;
        service
            .connect({ wsUrl: HYPERFY_WS_URL, worldId: defaultWorldId, authToken })
            .then(() => console.info('Automatic Hyperfy connection initiated.'))
            .catch(err => console.error('Automatic Hyperfy connection failed:', err.message));
        return service;
    }
    static async stop(runtime) {
        console.info('*** Stopping Hyperfy service ***');
        // Note: In FastMCP we don't have runtime.getService, so this is a placeholder
        console.warn('Hyperfy service stop called - implement service registry if needed');
    }
    async connect(config) {
        if (this.isConnectedState) {
            console.warn(`HyperfyService already connected to world ${this._currentWorldId}. Disconnecting first.`);
            await this.disconnect();
        }
        console.info(`Attempting to connect HyperfyService to ${config.wsUrl} for world ${config.worldId}`);
        this.wsUrl = config.wsUrl;
        this._currentWorldId = config.worldId;
        this.appearanceSet = false;
        this.nameSet = false;
        try {
            const world = createNodeClientWorld();
            this.world = world;
            world.playerNamesMap = this.playerNamesMap;
            globalThis.self = globalThis;
            const livekit = new AgentLiveKit(world);
            world.livekit = livekit;
            world.systems.push(livekit);
            const actions = new AgentActions(world);
            world.actions = actions;
            world.systems.push(actions);
            this.controls = new AgentControls(world);
            world.controls = this.controls;
            world.systems.push(this.controls);
            const loader = new AgentLoader(world);
            world.loader = loader;
            world.systems.push(loader);
            // HACK: Overwriting `chat.add` to prevent crashes caused by the original implementation.
            // This ensures safe handling of chat messages and avoids unexpected errors from undefined fields.
            if (world.chat) {
                world.chat.add = (msg, broadcast) => {
                    const chat = world.chat;
                    const MAX_MSGS = 50;
                    chat.msgs = [...chat.msgs, msg];
                    if (chat.msgs.length > MAX_MSGS) {
                        chat.msgs.shift();
                    }
                    for (const callback of chat.listeners) {
                        callback(chat.msgs);
                    }
                    // emit chat event
                    const readOnly = Object.freeze({ ...msg });
                    this.world?.events.emit('chat', readOnly);
                    // maybe broadcast
                    if (broadcast) {
                        this.world?.network.send('chatAdded', msg);
                    }
                };
            }
            else {
                console.warn('[Hyperfy Service] Chat system not available - skipping chat.add override');
            }
            const mockElement = {
                appendChild: () => { },
                removeChild: () => { },
                offsetWidth: 1920,
                offsetHeight: 1080,
                addEventListener: () => { },
                removeEventListener: () => { },
                style: {},
            };
            const hyperfyConfig = {
                wsUrl: this.wsUrl,
                viewport: mockElement,
                ui: mockElement,
                initialAuthToken: config.authToken,
                loadPhysX
            };
            if (typeof this.world.init !== 'function') {
                throw new Error('world.init is not a function');
            }
            // Inject WebSocket polyfill for Node.js environment
            // This ensures the hyperfy core JavaScript files can use WebSocket
            if (typeof globalThis.WebSocket === 'undefined') {
                const { WebSocket } = await import('ws');
                globalThis.WebSocket = WebSocket;
                global.WebSocket = WebSocket;
                console.info('WebSocket polyfill injected for hyperfy core');
            }
            await this.world.init(hyperfyConfig);
            console.info('Hyperfy world initialized.');
            this.processedMsgIds.clear();
            if (this.world.chat?.msgs) {
                console.info(`Processing ${this.world.chat.msgs.length} existing chat messages.`);
                for (const msg of this.world.chat.msgs) {
                    if (msg?.id) {
                        this.processedMsgIds.add(msg.id);
                    }
                }
                console.info(`Populated ${this.processedMsgIds.size} processed message IDs from history.`);
            }
            this.subscribeToHyperfyEvents();
            this.isConnectedState = true;
            // Create enhanced runtime for managers
            const enhancedRuntime = {
                ...this.runtime,
                hyperfyService: this,
                logger: createLogger(),
                generateUUID: () => generateUUID({}, Date.now().toString()),
                agentName: this.runtime.character.name,
                aiModel: undefined // Placeholder for AI model if needed
            };
            this.emoteManager = new EmoteManager(enhancedRuntime);
            this.messageManager = new MessageManager(enhancedRuntime);
            this.voiceManager = new VoiceManager(enhancedRuntime);
            this.behaviorManager = new BehaviorManager(enhancedRuntime);
            this.startAppearancePolling();
            this.connectionTime = Date.now(); // Record connection time
            console.info(`HyperfyService connected successfully to ${this.wsUrl}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error(`HyperfyService connection failed for ${config.worldId} at ${config.wsUrl}: ${errorMessage}`, errorStack);
            await this.handleDisconnect();
            throw error;
        }
    }
    subscribeToHyperfyEvents() {
        if (!this.world || typeof this.world.on !== 'function') {
            console.warn("[Hyperfy Events] Cannot subscribe: World or world.on not available.");
            return;
        }
        this.world.off('disconnect');
        this.world.on('disconnect', (reason) => {
            const reasonStr = typeof reason === 'string' ? reason : 'Unknown reason';
            console.warn(`Hyperfy world disconnected: ${reasonStr}`);
            // Note: In FastMCP we don't have runtime.emitEvent like ElizaOS
            // Custom event handling could be implemented here if needed
            this.handleDisconnect();
        });
        if (this.world.chat && typeof this.world.chat.subscribe === 'function') {
            this.startChatSubscription();
        }
        else {
            console.warn('[Hyperfy Events] world.chat.subscribe not available.');
        }
    }
    /**
     * Uploads the character's avatar model and associated emote animations,
     * sets the avatar URL locally, updates emote hash mappings,
     * and notifies the server of the new avatar.
     *
     * This function handles all assets required for character expression and animation.
     */
    async uploadCharacterAssets() {
        if (!this.world ||
            !this.world.entities?.player ||
            !this.world.network ||
            !this.world.assetsUrl) {
            console.warn("[Appearance] Cannot set avatar: World, player, network, or assetsUrl not ready.");
            return { success: false, error: "Prerequisites not met" };
        }
        const agentPlayer = this.world.entities.player;
        const localAvatarPath = path.resolve(LOCAL_AVATAR_PATH);
        let fileName = "";
        try {
            console.info(`[Appearance] Reading avatar file from: ${localAvatarPath}`);
            const fileBuffer = await fs.readFile(localAvatarPath);
            fileName = path.basename(localAvatarPath);
            const mimeType = fileName.endsWith(".vrm")
                ? "model/gltf-binary"
                : "application/octet-stream";
            console.info(`[Appearance] Uploading ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB, Type: ${mimeType})...`);
            if (!crypto.subtle || typeof crypto.subtle.digest !== "function") {
                throw new Error("crypto.subtle.digest is not available. Ensure Node.js version supports Web Crypto API.");
            }
            const hash = await hashFileBuffer(fileBuffer);
            const ext = fileName.split(".").pop()?.toLowerCase() || "vrm";
            const fullFileNameWithHash = `${hash}.${ext}`;
            const baseUrl = this.world.assetsUrl.replace(/\/$/, "");
            const constructedHttpUrl = `${baseUrl}/${fullFileNameWithHash}`;
            if (typeof this.world.network.upload !== "function") {
                console.warn("[Appearance] world.network.upload function not found. Cannot upload.");
                return { success: false, error: "Upload function unavailable" };
            }
            try {
                console.info(`[Appearance] Uploading avatar to ${constructedHttpUrl}...`);
                const fileForUpload = new File([fileBuffer], fileName, {
                    type: mimeType,
                });
                const uploadPromise = this.world.network.upload(fileForUpload);
                const timeoutPromise = new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Upload timed out")), 30000));
                await Promise.race([uploadPromise, timeoutPromise]);
                console.info('Avatar uploaded successfully.');
            }
            catch (uploadError) {
                const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
                const errorStack = uploadError instanceof Error ? uploadError.stack : undefined;
                console.error(`[Appearance] Avatar upload failed: ${errorMessage}`, errorStack);
                return {
                    success: false,
                    error: `Upload failed: ${errorMessage}`,
                };
            }
            // Apply avatar locally
            if (agentPlayer && typeof agentPlayer.setSessionAvatar === "function") {
                agentPlayer.setSessionAvatar(constructedHttpUrl);
            }
            else {
                console.warn("[Appearance] agentPlayer.setSessionAvatar not available.");
            }
            // Upload emotes
            await this.emoteManager.uploadEmotes();
            // Notify server
            if (typeof this.world.network.send === "function") {
                this.world.network.send("playerSessionAvatar", {
                    avatar: constructedHttpUrl,
                });
                console.info(`[Appearance] Sent playerSessionAvatar with: ${constructedHttpUrl}`);
            }
            else {
                console.error("[Appearance] Upload succeeded but world.network.send is not available.");
            }
            return { success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (error instanceof Error && 'code' in error && error.code === "ENOENT") {
                console.error(`[Appearance] Avatar file not found at ${localAvatarPath}. CWD: ${process.cwd()}`);
            }
            else {
                console.error("[Appearance] Unexpected error during avatar process:", errorMessage, error instanceof Error ? error.stack : undefined);
            }
            return { success: false, error: errorMessage };
        }
    }
    startAppearancePolling() {
        if (this.appearanceIntervalId)
            clearInterval(this.appearanceIntervalId);
        // Check if both are already set
        const pollingTasks = { avatar: this.appearanceSet, name: this.nameSet }; // Track tasks locally
        if (pollingTasks.avatar && pollingTasks.name) {
            console.info("[Appearance/Name Polling] Already set, skipping start.");
            return;
        }
        console.info(`[Appearance/Name Polling] Initializing interval every ${HYPERFY_APPEARANCE_POLL_INTERVAL}ms.`);
        const f = async () => {
            // Stop polling if both tasks are complete
            if (pollingTasks.avatar && pollingTasks.name) {
                if (this.appearanceIntervalId)
                    clearInterval(this.appearanceIntervalId);
                this.appearanceIntervalId = null;
                console.info('[Appearance/Name Polling] Both avatar and name set. Polling stopped.');
                return;
            }
            const agentPlayer = this.world?.entities?.player; // Get player once
            const agentPlayerReady = !!agentPlayer;
            const agentPlayerId = agentPlayer?.data?.id;
            const agentPlayerIdReady = !!agentPlayerId;
            const networkReady = this.world?.network?.id != null;
            const assetsUrlReady = !!this.world?.assetsUrl; // Needed for avatar
            // Condition checks player/ID/network readiness for name, adds assetsUrl for avatar
            console.log('agentPlayerReady', agentPlayerReady);
            console.log('agentPlayerIdReady', agentPlayerIdReady);
            console.log('networkReady', networkReady);
            if (agentPlayerReady && agentPlayerIdReady && networkReady) {
                const entityId = generateUUID({}, agentPlayerId || 'unknown-player');
                const entity = await this.runtime.getEntityById(entityId);
                if (entity && agentPlayerId) {
                    entity.metadata.hyperfy = {
                        id: agentPlayerId,
                        name: agentPlayer?.data?.name,
                        userName: agentPlayer?.data?.name
                    };
                    await this.runtime.updateEntity(entity);
                }
                if (this.behaviorManager.start) {
                    this.behaviorManager.start();
                }
                // --- Set Name (if not already done) ---
                if (!pollingTasks.name) {
                    console.info(`[Name Polling] Player (ID: ${agentPlayerId}), network ready. Attempting name...`);
                    try {
                        await this.changeName(this.runtime.character.name);
                        this.nameSet = true; // Update global state
                        pollingTasks.name = true; // Update local task tracker
                        console.info(`[Name Polling] Initial name successfully set to "${this.runtime.character.name}".`);
                    }
                    catch (error) {
                        console.error('Name Polling Failed to set initial name:', error);
                    }
                }
                // --- Set Avatar (if not already done AND assets URL ready) ---
                if (!pollingTasks.avatar && assetsUrlReady) {
                    console.info(`[Appearance Polling] Player (ID: ${agentPlayerId}), network, assetsUrl ready. Attempting avatar upload and set...`);
                    const result = await this.uploadCharacterAssets();
                    if (result.success) {
                        this.appearanceSet = true; // Update global state
                        pollingTasks.avatar = true; // Update local task tracker
                        console.info('Appearance Polling Avatar setting process successfully completed.');
                    }
                    else {
                        console.warn(`[Appearance Polling] Avatar setting process failed: ${result.error || 'Unknown reason'}. Will retry...`);
                    }
                }
                else if (!pollingTasks.avatar) {
                    console.debug(`[Appearance Polling] Waiting for: Assets URL (${assetsUrlReady})...`);
                }
            }
            else {
                // Update waiting log
                console.debug(`[Appearance/Name Polling] Waiting for: Player (${agentPlayerReady}), Player ID (${agentPlayerIdReady}), Network (${networkReady})...`);
            }
        };
        this.appearanceIntervalId = setInterval(f, HYPERFY_APPEARANCE_POLL_INTERVAL);
        f();
    }
    stopAppearancePolling() {
        if (this.appearanceIntervalId) {
            clearInterval(this.appearanceIntervalId);
            this.appearanceIntervalId = null;
            console.info("[Appearance Polling] Stopped.");
        }
    }
    /**
     * Checks if the service is currently connected to a Hyperfy world.
     */
    isConnected() {
        return this.isConnectedState;
    }
    getEntityById(entityId) {
        return this.world?.entities?.items?.get(entityId) || null;
    }
    getEntityName(entityId) {
        const entity = this.world?.entities?.items?.get(entityId);
        return entity?.data?.name || entity?.blueprint?.name || 'Unnamed';
    }
    async handleDisconnect() {
        if (!this.isConnectedState && !this.world)
            return;
        console.info('Handling Hyperfy disconnection...');
        this.isConnectedState = false;
        this.stopAppearancePolling();
        if (this.world) {
            try {
                if (this.world.network && typeof this.world.network.disconnect === 'function') {
                    console.info("[Hyperfy Cleanup] Calling network.disconnect()...");
                    await this.world.network.disconnect();
                }
                if (typeof this.world.destroy === 'function') {
                    console.info("[Hyperfy Cleanup] Calling world.destroy()...");
                    this.world.destroy();
                }
            }
            catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown cleanup error';
                console.warn(`[Hyperfy Cleanup] Error during world network disconnect/destroy: ${errorMessage}`);
            }
        }
        this.world = null;
        this.controls = null;
        this.playerNamesMap.clear();
        this.wsUrl = null;
        this._currentWorldId = null; // Reset current world ID
        this.appearanceSet = false;
        this.processedMsgIds.clear();
        this.connectionTime = null; // Clear connection time
        if (this.appearanceIntervalId) {
            clearInterval(this.appearanceIntervalId);
            this.appearanceIntervalId = null;
        }
        console.info('Hyperfy disconnection handling complete.');
    }
    async disconnect() {
        console.info(`Disconnecting HyperfyService from world ${this._currentWorldId}`);
        await this.handleDisconnect();
        console.info('HyperfyService disconnect complete.');
    }
    /**
     * Changes the agent's display name.
     */
    async changeName(newName) {
        if (!this.isConnected() || !this.world?.network || !this.world?.entities?.player) {
            throw new Error('HyperfyService: Cannot change name. Network or player not ready.');
        }
        const agentPlayerId = this.world.entities.player.data.id;
        if (!agentPlayerId) {
            throw new Error('HyperfyService: Cannot change name. Player ID not available.');
        }
        console.info(`[Action] Attempting to change name to "${newName}" for ID ${agentPlayerId}`);
        try {
            // 2. Update local state immediately
            // Update the name map
            if (this.playerNamesMap.has(agentPlayerId)) {
                console.info(`[Name Map Update] Setting name via changeName for ID ${agentPlayerId}: '${newName}'`);
                this.playerNamesMap.set(agentPlayerId, newName);
            }
            else {
                console.warn(`[Name Map Update] Attempted changeName for ID ${agentPlayerId} not currently in map. Adding.`);
                this.playerNamesMap.set(agentPlayerId, newName);
            }
            // --- Use agentPlayer.modify for local update --- >
            const agentPlayer = this.world.entities.player;
            agentPlayer.modify({ name: newName });
            agentPlayer.data.name = newName;
            this.world.network.send('entityModified', { id: agentPlayer.data.id, name: newName });
            console.debug(`[Action] Called agentPlayer.modify({ name: "${newName}" })`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Action] Error during changeName to "${newName}":`, errorMessage);
            throw error;
        }
    }
    async stop() {
        console.info('*** Stopping Hyperfy service instance ***');
        await this.disconnect();
    }
    startChatSubscription() {
        if (!this.world || !this.world.chat) {
            console.error('Cannot subscribe to chat: World or Chat system not available.');
            return;
        }
        console.info('[HyperfyService] Initializing chat subscription...');
        // Pre-populate processed IDs with existing messages
        if (this.world.chat.msgs) {
            for (const msg of this.world.chat.msgs) {
                if (msg?.id) { // Use optional chaining
                    this.processedMsgIds.add(msg.id);
                }
            }
        }
        this.world.chat.subscribe((msgs) => {
            // Wait for player entity (ensures world/chat exist too)
            if (!this.world || !this.world.chat || !this.world.entities?.player || !this.connectionTime)
                return;
            const newMessagesFound = []; // Temporary list for new messages
            // Step 1: Identify new messages and update processed set
            for (const msg of msgs) {
                // Check timestamp FIRST - only consider messages newer than connection time
                const messageTimestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
                if (!messageTimestamp || messageTimestamp <= this.connectionTime) {
                    // console.debug(`[Chat Sub] Ignoring historical/old message ID ${msg?.id} (ts: ${messageTimestamp})`)
                    // Ensure historical messages are marked processed if encountered *before* connectionTime was set (edge case)
                    if (msg?.id && !this.processedMsgIds.has(msg.id.toString())) {
                        this.processedMsgIds.add(msg.id.toString());
                    }
                    continue; // Skip this message
                }
                // Check if we've already processed this message ID (secondary check for duplicates)
                const msgIdStr = msg.id?.toString();
                if (msgIdStr && !this.processedMsgIds.has(msgIdStr)) {
                    newMessagesFound.push(msg); // Add the full message object
                    this.processedMsgIds.add(msgIdStr); // Mark ID as processed immediately
                }
            }
            // Step 2: Process only the newly found messages
            if (newMessagesFound.length > 0) {
                console.info('[Chat] Found', newMessagesFound.length, 'new messages to process.');
                for (const msg of newMessagesFound) {
                    this.messageManager.handleMessage(msg);
                }
            }
        });
    }
    getEmoteManager() {
        return this.emoteManager;
    }
    getBehaviorManager() {
        return this.behaviorManager;
    }
    getMessageManager() {
        return this.messageManager;
    }
    getVoiceManager() {
        return this.voiceManager;
    }
}
HyperfyService.serviceType = 'hyperfy';
//# sourceMappingURL=hyperfy-service.js.map