import type { 
  MessageManagerRuntime, HyperfyMessage, FastMCPEntity, MessageContent, 
  MessageResponseContent, MessageCallback, FastMCPMemory, FastMCPRuntime 
} from "../../types/index.js";
import type { HyperfyService } from "../../core/hyperfy-service.js";
import { agentActivityLock } from "./guards.js";
import { messageHandlerTemplate } from "../../servers/config/templates.js";
import { 
  generateUUID, processMessageWithAI, createFastMCPEntity, 
  createFastMCPMemory, formatRelativeTimestamp 
} from "../../utils/eliza-compat.js";

// Export the runtime type for service.ts
export type { MessageManagerRuntime } from '../../types/index.js';

// Extended runtime interface for ElizaOS compatibility
interface ExtendedMessageManagerRuntime extends MessageManagerRuntime {
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
    userId: string | number;
  }): Promise<void>;
  createMemory(memory: unknown, tableName: string): Promise<void>;
  getEntityById(entityId: string): Promise<unknown>;
  createEntity(entity: {
    id: string;
    names: string[];
    agentId: string;
    metadata: unknown;
  }): Promise<void>;
  emitEvent(eventType: string, eventData: unknown): Promise<void>;
  getMemories(params: {
    tableName: string;
    roomId: string;
    count: number;
    unique: boolean;
  }): Promise<unknown[]>;
}

export class MessageManager {
  private runtime: ExtendedMessageManagerRuntime;
  
  constructor(runtime: MessageManagerRuntime) {
    this.runtime = runtime as ExtendedMessageManagerRuntime;
  }

  async handleMessage(msg: HyperfyMessage): Promise<void> {
    // Add null safety check
    if (!msg) {
      console.warn('[MessageManager] Received null or undefined message, ignoring');
      return;
    }

    await agentActivityLock.run(async () => {
      const service = this.getService();
      const world = service.getWorld();
      const agentPlayerId = world.entities.player.data.id;
      const senderName = msg.from || 'System';
      const messageBody = msg.body || '';
      
      console.info(`[Chat Received] From: ${senderName}, ID: ${msg.id}, Body: "${messageBody}"`);

      // Respond only to messages not from the agent itself
      if (msg.fromId && msg.fromId !== agentPlayerId) {
        console.info(`[Hyperfy Chat] Processing message from ${senderName}`);

        // Generate IDs for ElizaOS-compatible memory system
        const mockRuntime: FastMCPRuntime = {
          logger: console,
          generateUUID: () => '',
          hyperfyService: this.runtime.hyperfyService,
          agentId: this.runtime.agentId,
          agentName: this.runtime.agentName,
          aiModel: this.runtime.aiModel
        };
        
        const hyperfyWorldId = generateUUID(mockRuntime, 'hyperfy-world');
        const elizaRoomId = generateUUID(mockRuntime, service.currentWorldId || 'hyperfy-unknown-world');
        const entityId = generateUUID(mockRuntime, msg.fromId.toString());

        console.debug(`[Hyperfy Chat] Creating entity connection for: ${entityId}`);
        
        // Ensure connection for the sender entity - keep this ElizaOS functionality
        await this.runtime.ensureConnection({
          entityId: entityId,
          roomId: elizaRoomId,
          userName: senderName,
          name: senderName,
          source: 'hyperfy',
          channelId: service.currentWorldId,
          serverId: 'hyperfy',
          type: 'WORLD', // ChannelType.WORLD equivalent
          worldId: hyperfyWorldId,
          userId: msg.fromId
        });

        // Create the message memory - keep ElizaOS Memory structure
        const messageId = generateUUID(mockRuntime, msg.id.toString());
        console.debug(`[Hyperfy Chat] Creating memory: ${messageId}`);
        
        const memory = {
          id: messageId,
          entityId: entityId,
          agentId: this.runtime.agentId,
          roomId: elizaRoomId,
          worldId: hyperfyWorldId,
          content: {
            text: messageBody,
            source: 'hyperfy',
            channelType: 'WORLD', // ChannelType.WORLD equivalent
            metadata: {
              hyperfyMessageId: msg.id,
              hyperfyFromId: msg.fromId,
              hyperfyFromName: senderName,
            },
          },
          createdAt: Date.now(),
        };

        // Create a callback function to handle AI responses
        const callback: MessageCallback = async (responseContent: MessageResponseContent): Promise<void> => {
          console.info(`[Hyperfy Chat Callback] Received response: ${JSON.stringify(responseContent)}`);
          
          // Handle emote response
          if (responseContent.emote) {
            const emoteManager = service.getEmoteManager();
            emoteManager.playEmote(responseContent.emote);
          }
          
          // Handle text response
          if (responseContent.text) {
            await this.sendMessage(responseContent.text);
          }
          
          // Create callback memory for the response
          const callbackMemory = {
            id: generateUUID(mockRuntime, Date.now().toString()),
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            content: {
              ...responseContent,
              channelType: 'WORLD',
            },
            roomId: elizaRoomId,
            createdAt: Date.now(),
          };
          
          // Store the response memory if createMemory exists
          if (this.runtime.createMemory) {
            await this.runtime.createMemory(callbackMemory, 'messages');
          }
          
          console.info(`[Hyperfy Chat] Successfully processed response for ${senderName}`);
        };

        // Ensure the entity actually exists in DB before event emission
        try {
          const entity = await this.runtime.getEntityById(entityId);
          if (!entity) {
            console.warn(
              `[Hyperfy Chat] Entity ${entityId} not found in database after creation, creating directly`
            );
            await this.runtime.createEntity({
              id: entityId,
              names: [senderName],
              agentId: this.runtime.agentId,
              metadata: {
                hyperfy: {
                  id: msg.fromId,
                  username: senderName,
                  name: senderName,
                },
              },
            });
          }
        } catch (error) {
          console.error(`[Hyperfy Chat] Error checking/creating entity: ${error}`);
        }

        // Emit the MESSAGE_RECEIVED event to trigger the message handler
        console.info(`[Hyperfy Chat] Emitting MESSAGE_RECEIVED event for message: ${messageId}`);
        await this.runtime.emitEvent('MESSAGE_RECEIVED', {
            runtime: this.runtime,
            message: memory,
            callback: callback,
            source: 'hyperfy'
          },
        );

        console.info(`[Hyperfy Chat] Successfully emitted event for message: ${messageId}`);

        try {
          // Process message with AI using the messageHandlerTemplate
          const aiResponse = await processMessageWithAI(
            {
              aiModel: this.runtime.aiModel,
              agentName: this.runtime.agentName,
              agentId: this.runtime.agentId,
              hyperfyService: this.runtime.hyperfyService,
              logger: console,
              generateUUID: () => generateUUID(mockRuntime, '')
            } as unknown as FastMCPRuntime,
            messageBody,
            senderName,
            messageHandlerTemplate
          );

          // Execute the callback with AI response
          await callback({
            text: aiResponse.text,
            emote: aiResponse.emote,
            actions: aiResponse.actions ? [aiResponse.actions] : undefined
          });

          console.info(`[Hyperfy Chat] Successfully processed message from ${senderName}`);
        } catch (error) {
          console.error(`[Hyperfy Chat] Error processing message: ${error}`);
        }
      }
    });
  }

  async sendMessage(text: string): Promise<void> {
    const service = this.getService();
    const world = service.getWorld();
    
    if (!service.isConnected() || !world?.chat || !world?.entities?.player) {
      console.error('HyperfyService: Cannot send message. Not ready.');
      return;
    }

    try {
      const agentPlayerId = world.entities.player.data.id;
      const agentPlayerName = service.getEntityName(agentPlayerId) || world.entities.player.data?.name || 'Hyperliza';

      console.info(`HyperfyService sending message: "${text}" as ${agentPlayerName} (${agentPlayerId})`);

      if (typeof world.chat.add !== 'function') {
        throw new Error('world.chat.add is not a function');
      }

      world.chat.add(
        {
          body: text,
          fromId: agentPlayerId,
          from: agentPlayerName,
        },
        true
      );

    } catch (error) {
      console.error('Error sending Hyperfy message:', error);
      throw error;
    }
  }

  formatMessages({
    messages,
    entities,
  }: {
    messages: unknown[];
    entities: unknown[];
  }) {
    const messageStrings = messages
      .filter((message: unknown) => (message as { entityId?: string }).entityId)
      .map((message: unknown) => {
        const msg = message as {
          entityId: string;
          content: { text?: string; actions?: string[] };
          createdAt: number;
        };
        const content = msg.content;
        const messageText = content.text || "";
        const messageActions = content.actions;
  
        const entity = entities.find((e: unknown) => 
          (e as { id?: string }).id === msg.entityId
        ) as { names?: string[]; data?: string } | undefined;
        
        const formattedName = entity?.names?.[0] || "Unknown User";
        let formattedId = "";
        try {
          formattedId = entity?.data ? JSON.parse(entity.data).hyperfy.id : "";
        } catch {
          formattedId = "";
        }
  
        const messageTime = new Date(msg.createdAt);
        const hours = messageTime.getHours().toString().padStart(2, "0");
        const minutes = messageTime.getMinutes().toString().padStart(2, "0");
        const timeString = `${hours}:${minutes}`;
  
        const timestamp = formatRelativeTimestamp(msg.createdAt);
  
        const actionString =
          messageActions && messageActions.length > 0
            ? ` (${messageActions.join(", ")})`
            : "";
  
        const textPart = messageText ? `: ${messageText}` : "";
  
        const formattedLine = `- ${timeString} (${timestamp}) ${formattedName} [${formattedId}]${actionString}${textPart}`;
  
        return formattedLine;
      })
      .filter(Boolean)
      .join("\n");
  
    return messageStrings;
  }
  
  async getRecentMessages(roomId: string, count = 20) {
    try {
      // For FastMCP, we'll implement a simplified version
      // In a full implementation, this would fetch from the memory system
      console.info(`[MessageManager] getRecentMessages called for room ${roomId}, count: ${count}`);
      return "Recent messages functionality - simplified for FastMCP";
    } catch (error) {
      console.error(`[MessageManager] Error getting recent messages: ${error}`);
      return "";
    }
  }

  private getService(): HyperfyService {
    return this.runtime.hyperfyService as HyperfyService;
  }
}
