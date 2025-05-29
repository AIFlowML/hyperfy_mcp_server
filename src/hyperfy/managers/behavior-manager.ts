import type { 
  FastMCPRuntime, FastMCPMemory,LogType, XMLParseResult 
} from "../../types/index.js";
import type { HyperfyService } from "../../core/hyperfy-service.js";
import { autoTemplate } from "../../servers/config/templates.js";
import { agentActivityLock } from "./guards.js";
import { 
  generateUUID, parseXMLResponse, composePromptFromState, 
  createLogger
} from "../../utils/eliza-compat.js";

// Export the runtime type for service.ts
export type { FastMCPRuntime } from '../../types/index.js';

const TIME_INTERVAL_MIN = 15000; // 15 seconds
const TIME_INTERVAL_MAX = 30000; // 30 seconds


export class BehaviorManager {
  private isRunning = false;
  private runtime: FastMCPRuntime;
  private logger: LogType;
  
  constructor(runtime: FastMCPRuntime) {
    this.runtime = runtime;
    this.logger = createLogger();
  }

  /**
   * Starts the behavior loop
   */
  public start(): void {
    if (this.isRunning) {
      this.logger.warn("[BehaviorManager] Already running");
      return;
    }

    this.isRunning = true;
    this.logger.info("[BehaviorManager] Starting behavior loop");

    this.runLoop();
  }

  /**
   * Stops the behavior loop
   */
  public stop(): void {
    if (!this.isRunning) {
      this.logger.warn("[BehaviorManager] Not running");
      return;
    }

    this.isRunning = false;
    this.logger.info("[BehaviorManager] Stopped behavior loop");
  }

  /**
   * Main loop that waits for each behavior to finish
   */
  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.executeBehavior();
      } catch (error) {
        this.logger.error("[BehaviorManager] Error executing behavior:", error);
      }

      // Short delay between behaviors
      const delay = TIME_INTERVAL_MIN + Math.floor(Math.random() * (TIME_INTERVAL_MAX - TIME_INTERVAL_MIN));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private getService(): HyperfyService | null {
    return this.runtime.hyperfyService as HyperfyService | null;
  }

  /**
   * Executes a behavior
   */
  private async executeBehavior(): Promise<void> {
    // TODO: There may be slow post-processing in the bootstrap plugin's message handler.
    // Investigate long tail after message handling, especially in emitEvent or runtime methods.
    if (agentActivityLock.isActive()) {
      this.logger.info("[BehaviorManager] Skipping behavior — message activity in progress");
      return;
    }

    const service = this.getService();
    if (!service) {
      this.logger.warn("[BehaviorManager] Service not available, skipping behavior");
      return;
    }
    
    const world = service.getWorld();
    const _currentWorldId = service.currentWorldId;
    
    if (!service.isConnected() || !world) {
      this.logger.warn("[BehaviorManager] Service not ready, skipping behavior");
      return;
    }

    try {
      // Create behavior context
      const behaviorId = generateUUID(this.runtime, Date.now().toString());

      const newMessage: FastMCPMemory = {
        id: behaviorId,
        content: {
          text: '',
          type: 'text',
        },
        roomId: _currentWorldId || 'hyperfy-unknown-world',
        worldId: _currentWorldId,
        entityId: this.runtime.agentId,
      };

      // Generate AI response using FastMCP
      const responsePrompt = composePromptFromState(newMessage, autoTemplate());
      const response = await this.runtime.aiModel.generateText(responsePrompt);
      const parsedXml = parseXMLResponse(response);

      console.log('****** BehaviorManager AI Response:\n', parsedXml);

      // Process the AI response
      await this.processBehaviorResponse(parsedXml, service);

    } catch (error) {
      this.logger.error("[BehaviorManager] Error executing behavior:", error);
    }
  }

  /**
   * Processes the AI behavior response and executes actions
   */
  private async processBehaviorResponse(response: XMLParseResult, service: HyperfyService): Promise<void> {
    try {
      // Execute emote if specified
      if (response.emote) {
        const emoteManager = service.getEmoteManager();
        emoteManager.playEmote(response.emote);
        this.logger.info(`[BehaviorManager] Playing emote: ${response.emote}`);
      }

      // Send ambient speech if specified
      if (response.text && response.actions?.includes('HYPERFY_AMBIENT_SPEECH')) {
        const messageManager = service.getMessageManager();
        messageManager.sendMessage(response.text);
        this.logger.info(`[BehaviorManager] Sending ambient message: ${response.text}`);
      }

      // Log the behavior execution
      this.logger.info("[BehaviorManager] Behavior executed successfully", {
        thought: response.thought,
        actions: response.actions,
        hasEmote: !!response.emote,
        hasText: !!response.text
      });

    } catch (error) {
      this.logger.error("[BehaviorManager] Error processing behavior response:", error);
    }
  }
}
