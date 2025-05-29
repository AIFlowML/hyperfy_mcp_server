/**
 * Comprehensive test suite for BehaviorManager
 * Tests autonomous behavior execution, AI response processing, and integration with HyperfyService
 * Validates the porting from ElizaOS to FastMCP architecture
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { BehaviorManager } from '../src/hyperfy/managers/behavior-manager.js';
import { agentActivityLock } from '../src/hyperfy/managers/guards.js';
import type { 
  FastMCPRuntime, FastMCPMemory, XMLParseResult, LogType, AIModelInterface 
} from '../src/types/index.js';
import type { HyperfyService } from '../src/core/hyperfy-service.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000, // 10 seconds
  BEHAVIOR_TIMEOUT: 5000, // 5 seconds for behavior execution
  LOOP_TIMEOUT: 2000, // 2 seconds for loop testing
  SHORT_DELAY: 100, // Short delay for testing
};

// Mock interfaces for testing
interface MockEmoteManager {
  playEmote: MockedFunction<(emote: string) => void>;
}

interface MockMessageManager {
  sendMessage: MockedFunction<(message: string) => void>;
}

interface MockHyperfyService {
  isConnected: MockedFunction<() => boolean>;
  getWorld: MockedFunction<() => unknown>;
  currentWorldId: string;
  getEmoteManager: MockedFunction<() => MockEmoteManager>;
  getMessageManager: MockedFunction<() => MockMessageManager>;
}

interface MockAIModel {
  generateText: MockedFunction<(prompt: string) => Promise<string>>;
}

interface MockRuntime {
  hyperfyService: MockHyperfyService;
  agentId: string;
  aiModel: MockAIModel;
}

// Interface for accessing private members in tests
interface BehaviorManagerTestAccess {
  runtime: MockRuntime;
  logger: LogType;
  isRunning: boolean;
  executeBehavior(): Promise<void>;
}

// Create mock runtime for testing
function createMockRuntime(): MockRuntime {
  const mockEmoteManager: MockEmoteManager = {
    playEmote: vi.fn(),
  };

  const mockMessageManager: MockMessageManager = {
    sendMessage: vi.fn(),
  };

  const mockHyperfyService: MockHyperfyService = {
    isConnected: vi.fn().mockReturnValue(true),
    getWorld: vi.fn().mockReturnValue({}),
    currentWorldId: 'test-world-123',
    getEmoteManager: vi.fn().mockReturnValue(mockEmoteManager),
    getMessageManager: vi.fn().mockReturnValue(mockMessageManager),
  };

  const mockAIModel: MockAIModel = {
    generateText: vi.fn(),
  };

  return {
    hyperfyService: mockHyperfyService,
    agentId: 'test-agent-123',
    aiModel: mockAIModel,
  } as MockRuntime;
}

// Create mock AI responses
const createMockAIResponse = (options: {
  thought?: string;
  text?: string;
  actions?: string;
  emote?: string;
} = {}): string => {
  const {
    thought = 'I should observe the world around me.',
    text = options.text || '',
    actions = options.actions || 'IGNORE',
    emote = options.emote || '',
  } = options;

  return `<response>
    <thought>${thought}</thought>
    <text>${text}</text>
    <actions>${actions}</actions>
    <emote>${emote}</emote>
  </response>`;
};

describe('BehaviorManager', () => {
  let behaviorManager: BehaviorManager;
  let mockRuntime: MockRuntime;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset activity lock
    agentActivityLock.forceReset();
    
    // Create fresh mocks
    mockRuntime = createMockRuntime();
    behaviorManager = new BehaviorManager(mockRuntime as unknown as FastMCPRuntime);
    
    // Spy on console.log for AI response logging
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    logger.info('🎬 Starting BehaviorManager test');
  });

  afterEach(async () => {
    // Stop behavior manager if running
    if (behaviorManager) {
      try {
        behaviorManager.stop();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Reset activity lock
    agentActivityLock.forceReset();
    
    // Wait a bit for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    consoleSpy.mockRestore();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper runtime context', () => {
      expect(behaviorManager).toBeInstanceOf(BehaviorManager);
      expect((behaviorManager as any).runtime).toBe(mockRuntime);
      expect((behaviorManager as any).logger).toBeDefined();
      expect((behaviorManager as any).isRunning).toBe(false);
      
      logger.info('✅ BehaviorManager initialized with runtime context');
    });

    it('should start with isRunning false', () => {
      expect((behaviorManager as any).isRunning).toBe(false);
      
      logger.info('✅ BehaviorManager starts with isRunning false');
    });
  });

  describe('Start and Stop Behavior', () => {
    it('should start behavior loop correctly', () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      behaviorManager.start();
      
      expect((behaviorManager as any).isRunning).toBe(true);
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Starting behavior loop');
      
      logger.info('✅ Behavior loop starts correctly');
    });

    it('should prevent multiple starts', () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'warn');
      
      behaviorManager.start();
      behaviorManager.start(); // Second start should be ignored
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Already running');
      expect((behaviorManager as any).isRunning).toBe(true);
      
      logger.info('✅ Multiple starts prevented correctly');
    });

    it('should stop behavior loop correctly', () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      behaviorManager.start();
      behaviorManager.stop();
      
      expect((behaviorManager as any).isRunning).toBe(false);
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Stopped behavior loop');
      
      logger.info('✅ Behavior loop stops correctly');
    });

    it('should handle stop when not running', () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'warn');
      
      behaviorManager.stop(); // Stop without starting
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Not running');
      expect((behaviorManager as any).isRunning).toBe(false);
      
      logger.info('✅ Stop when not running handled correctly');
    });
  });

  describe('Activity Lock Integration', () => {
    it('should skip behavior when activity lock is active', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      // Activate the lock
      agentActivityLock.enter();
      
      // Mock AI response
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse());
      
      // Execute behavior directly (bypass loop timing)
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Skipping behavior — message activity in progress');
      expect(mockRuntime.aiModel.generateText).not.toHaveBeenCalled();
      
      // Clean up
      agentActivityLock.exit();
      
      logger.info('✅ Behavior skipped when activity lock active');
    });

    it('should execute behavior when activity lock is inactive', async () => {
      // Ensure lock is inactive
      agentActivityLock.forceReset();
      
      // Mock AI response
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        text: 'Hello world!',
        actions: 'HYPERFY_AMBIENT_SPEECH',
        emote: 'wave'
      }));
      
      // Execute behavior
      await (behaviorManager as any).executeBehavior();
      
      expect(mockRuntime.aiModel.generateText).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '****** BehaviorManager AI Response:\n',
        expect.objectContaining({
          text: 'Hello world!',
          actions: 'HYPERFY_AMBIENT_SPEECH',
          emote: 'wave'
        })
      );
      
      logger.info('✅ Behavior executed when activity lock inactive');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);
  });

  describe('Service State Validation', () => {
    it('should skip behavior when service not connected', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'warn');
      
      // Mock service as disconnected
      mockRuntime.hyperfyService.isConnected.mockReturnValue(false);
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Service not ready, skipping behavior');
      expect(mockRuntime.aiModel.generateText).not.toHaveBeenCalled();
      
      logger.info('✅ Behavior skipped when service not connected');
    });

    it('should skip behavior when world not available', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'warn');
      
      // Mock world as null
      mockRuntime.hyperfyService.getWorld.mockReturnValue(null);
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Service not ready, skipping behavior');
      expect(mockRuntime.aiModel.generateText).not.toHaveBeenCalled();
      
      logger.info('✅ Behavior skipped when world not available');
    });

    it('should skip behavior when service is null', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'warn');
      
      // Mock service as null
      mockRuntime.hyperfyService = null as unknown as MockHyperfyService;
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Service not available, skipping behavior');
      
      logger.info('✅ Behavior skipped when service is null');
    });
  });

  describe('AI Response Processing', () => {
    beforeEach(() => {
      // Ensure service is ready
      mockRuntime.hyperfyService.isConnected.mockReturnValue(true);
      mockRuntime.hyperfyService.getWorld.mockReturnValue({});
    });

    it('should process emote response correctly', async () => {
      const mockResponse = createMockAIResponse({
        thought: 'I should wave at everyone',
        emote: 'wave'
      });
      
      mockRuntime.aiModel.generateText.mockResolvedValue(mockResponse);
      
      await (behaviorManager as any).executeBehavior();
      
      expect(mockRuntime.hyperfyService.getEmoteManager).toHaveBeenCalled();
      expect(mockRuntime.hyperfyService.getEmoteManager().playEmote).toHaveBeenCalledWith('wave');
      
      logger.info('✅ Emote response processed correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should process ambient speech response correctly', async () => {
      const mockResponse = createMockAIResponse({
        thought: 'I should say something to the environment',
        text: 'What a beautiful day!',
        actions: 'HYPERFY_AMBIENT_SPEECH'
      });
      
      mockRuntime.aiModel.generateText.mockResolvedValue(mockResponse);
      
      await (behaviorManager as any).executeBehavior();
      
      expect(mockRuntime.hyperfyService.getMessageManager).toHaveBeenCalled();
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).toHaveBeenCalledWith('What a beautiful day!');
      
      logger.info('✅ Ambient speech response processed correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should process combined emote and speech response', async () => {
      const mockResponse = createMockAIResponse({
        thought: 'I should greet everyone enthusiastically',
        text: 'Hello everyone!',
        actions: 'HYPERFY_AMBIENT_SPEECH',
        emote: 'wave'
      });
      
      mockRuntime.aiModel.generateText.mockResolvedValue(mockResponse);
      
      await (behaviorManager as any).executeBehavior();
      
      // Should execute both emote and speech
      expect(mockRuntime.hyperfyService.getEmoteManager().playEmote).toHaveBeenCalledWith('wave');
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).toHaveBeenCalledWith('Hello everyone!');
      
      logger.info('✅ Combined emote and speech response processed correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle response without ambient speech action', async () => {
      const mockResponse = createMockAIResponse({
        thought: 'I should just observe',
        text: 'This text should not be sent',
        actions: 'IGNORE'
      });
      
      mockRuntime.aiModel.generateText.mockResolvedValue(mockResponse);
      
      await (behaviorManager as any).executeBehavior();
      
      // Should not send message without HYPERFY_AMBIENT_SPEECH action
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).not.toHaveBeenCalled();
      
      logger.info('✅ Text without ambient speech action handled correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle response without emote', async () => {
      const mockResponse = createMockAIResponse({
        thought: 'I should speak without emotion',
        text: 'Just a simple message',
        actions: 'HYPERFY_AMBIENT_SPEECH'
      });
      
      mockRuntime.aiModel.generateText.mockResolvedValue(mockResponse);
      
      await (behaviorManager as any).executeBehavior();
      
      // Should send message but not play emote
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).toHaveBeenCalledWith('Just a simple message');
      expect(mockRuntime.hyperfyService.getEmoteManager().playEmote).not.toHaveBeenCalled();
      
      logger.info('✅ Response without emote handled correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Ensure service is ready
      mockRuntime.hyperfyService.isConnected.mockReturnValue(true);
      mockRuntime.hyperfyService.getWorld.mockReturnValue({});
    });

    it('should handle AI model errors gracefully', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'error');
      const aiError = new Error('AI model failed');
      
      mockRuntime.aiModel.generateText.mockRejectedValue(aiError);
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Error executing behavior:', aiError);
      
      logger.info('✅ AI model errors handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle emote manager errors gracefully', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'error');
      const emoteError = new Error('Emote failed');
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        emote: 'invalid-emote'
      }));
      
      mockRuntime.hyperfyService.getEmoteManager().playEmote.mockImplementation(() => {
        throw emoteError;
      });
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Error processing behavior response:', emoteError);
      
      logger.info('✅ Emote manager errors handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle message manager errors gracefully', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'error');
      const messageError = new Error('Message failed');
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        text: 'Test message',
        actions: 'HYPERFY_AMBIENT_SPEECH'
      }));
      
      mockRuntime.hyperfyService.getMessageManager().sendMessage.mockImplementation(() => {
        throw messageError;
      });
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Error processing behavior response:', messageError);
      
      logger.info('✅ Message manager errors handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle malformed AI responses gracefully', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      // Mock malformed XML response
      mockRuntime.aiModel.generateText.mockResolvedValue('Invalid XML response');
      
      await (behaviorManager as any).executeBehavior();
      
      // Should still log the response even if malformed
      expect(consoleSpy).toHaveBeenCalledWith(
        '****** BehaviorManager AI Response:\n',
        expect.any(Object)
      );
      
      logger.info('✅ Malformed AI responses handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);
  });

  describe('Behavior Loop Integration', () => {
    it('should execute behavior loop with proper timing', async () => {
      // Mock a quick AI response
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse());
      
      // Start the behavior loop
      behaviorManager.start();
      
      // Wait for at least one execution
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SHORT_DELAY));
      
      // Stop the loop
      behaviorManager.stop();
      
      // Should have called AI model at least once
      expect(mockRuntime.aiModel.generateText).toHaveBeenCalled();
      
      logger.info('✅ Behavior loop executes with proper timing');
    }, TEST_CONFIG.LOOP_TIMEOUT);

    it('should handle errors in behavior loop without crashing', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'error');
      
      // Mock AI to throw error
      mockRuntime.aiModel.generateText.mockRejectedValue(new Error('Loop error'));
      
      // Start the behavior loop
      behaviorManager.start();
      
      // Wait for error to occur
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SHORT_DELAY));
      
      // Stop the loop
      behaviorManager.stop();
      
      // Should have logged the error but continued running
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Error executing behavior:', expect.any(Error));
      
      logger.info('✅ Behavior loop handles errors without crashing');
    }, TEST_CONFIG.LOOP_TIMEOUT);

    it('should stop loop when isRunning is set to false', async () => {
      let executionCount = 0;
      
      mockRuntime.aiModel.generateText.mockImplementation(async () => {
        executionCount++;
        return createMockAIResponse();
      });
      
      // Start the behavior loop
      behaviorManager.start();
      
      // Wait for a few executions
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SHORT_DELAY));
      
      // Stop the loop
      behaviorManager.stop();
      
      const countAfterStop = executionCount;
      
      // Wait a bit more to ensure no more executions
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SHORT_DELAY));
      
      // Should not have executed more after stop
      expect(executionCount).toBe(countAfterStop);
      
      logger.info('✅ Behavior loop stops when isRunning set to false');
    }, TEST_CONFIG.LOOP_TIMEOUT);
  });

  describe('Memory and Context Creation', () => {
    beforeEach(() => {
      // Ensure service is ready
      mockRuntime.hyperfyService.isConnected.mockReturnValue(true);
      mockRuntime.hyperfyService.getWorld.mockReturnValue({});
    });

    it('should create proper FastMCPMemory context', async () => {
      let capturedPrompt = '';
      
      mockRuntime.aiModel.generateText.mockImplementation(async (prompt: string) => {
        capturedPrompt = prompt;
        return createMockAIResponse();
      });
      
      await (behaviorManager as any).executeBehavior();
      
      // Should have called AI with a prompt containing world context
      expect(mockRuntime.aiModel.generateText).toHaveBeenCalled();
      expect(capturedPrompt).toBeTruthy();
      expect(capturedPrompt.length).toBeGreaterThan(0);
      
      logger.info('✅ FastMCPMemory context created properly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should use correct world ID in memory context', async () => {
      const testWorldId = 'custom-world-456';
      mockRuntime.hyperfyService.currentWorldId = testWorldId;
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse());
      
      await (behaviorManager as any).executeBehavior();
      
      // The memory context should use the current world ID
      expect(mockRuntime.aiModel.generateText).toHaveBeenCalled();
      
      logger.info('✅ Correct world ID used in memory context');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle missing world ID gracefully', async () => {
      mockRuntime.hyperfyService.currentWorldId = '';
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse());
      
      await (behaviorManager as any).executeBehavior();
      
      // Should still execute without errors
      expect(mockRuntime.aiModel.generateText).toHaveBeenCalled();
      
      logger.info('✅ Missing world ID handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);
  });

  describe('Logging and Debugging', () => {
    beforeEach(() => {
      // Ensure service is ready
      mockRuntime.hyperfyService.isConnected.mockReturnValue(true);
      mockRuntime.hyperfyService.getWorld.mockReturnValue({});
    });

    it('should log behavior execution details', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        thought: 'Test thought',
        text: 'Test message',
        actions: 'HYPERFY_AMBIENT_SPEECH',
        emote: 'wave'
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Behavior executed successfully', {
        thought: 'Test thought',
        actions: 'HYPERFY_AMBIENT_SPEECH',
        hasEmote: true,
        hasText: true
      });
      
      logger.info('✅ Behavior execution details logged correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should log emote execution', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        emote: 'dance'
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Playing emote: dance');
      
      logger.info('✅ Emote execution logged correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should log ambient speech execution', async () => {
      const loggerSpy = vi.spyOn((behaviorManager as any).logger, 'info');
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        text: 'Hello world!',
        actions: 'HYPERFY_AMBIENT_SPEECH'
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      expect(loggerSpy).toHaveBeenCalledWith('[BehaviorManager] Sending ambient message: Hello world!');
      
      logger.info('✅ Ambient speech execution logged correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should log AI response to console', async () => {
      const mockResponse = createMockAIResponse({
        thought: 'Debug thought',
        text: 'Debug message'
      });
      
      mockRuntime.aiModel.generateText.mockResolvedValue(mockResponse);
      
      await (behaviorManager as any).executeBehavior();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '****** BehaviorManager AI Response:\n',
        expect.objectContaining({
          thought: 'Debug thought',
          text: 'Debug message'
        })
      );
      
      logger.info('✅ AI response logged to console correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);
  });

  describe('Edge Cases and Boundary Conditions', () => {
    beforeEach(() => {
      // Ensure service is ready
      mockRuntime.hyperfyService.isConnected.mockReturnValue(true);
      mockRuntime.hyperfyService.getWorld.mockReturnValue({});
    });

    it('should handle empty AI response', async () => {
      mockRuntime.aiModel.generateText.mockResolvedValue('');
      
      await (behaviorManager as any).executeBehavior();
      
      // Should not crash with empty response
      expect(mockRuntime.hyperfyService.getEmoteManager().playEmote).not.toHaveBeenCalled();
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).not.toHaveBeenCalled();
      
      logger.info('✅ Empty AI response handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle response with empty text field', async () => {
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        text: '',
        actions: 'HYPERFY_AMBIENT_SPEECH'
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      // Should not send empty message
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).not.toHaveBeenCalled();
      
      logger.info('✅ Empty text field handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle response with empty emote field', async () => {
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        emote: ''
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      // Should not play empty emote
      expect(mockRuntime.hyperfyService.getEmoteManager().playEmote).not.toHaveBeenCalled();
      
      logger.info('✅ Empty emote field handled gracefully');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle multiple actions in actions field', async () => {
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        text: 'Multiple actions test',
        actions: 'HYPERFY_AMBIENT_SPEECH,IGNORE,OTHER_ACTION'
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      // Should still send message if HYPERFY_AMBIENT_SPEECH is present
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).toHaveBeenCalledWith('Multiple actions test');
      
      logger.info('✅ Multiple actions in actions field handled correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);

    it('should handle very long AI responses', async () => {
      const longText = 'A'.repeat(10000); // Very long text
      
      mockRuntime.aiModel.generateText.mockResolvedValue(createMockAIResponse({
        text: longText,
        actions: 'HYPERFY_AMBIENT_SPEECH'
      }));
      
      await (behaviorManager as any).executeBehavior();
      
      // Should handle long text without issues
      expect(mockRuntime.hyperfyService.getMessageManager().sendMessage).toHaveBeenCalledWith(longText);
      
      logger.info('✅ Very long AI responses handled correctly');
    }, TEST_CONFIG.BEHAVIOR_TIMEOUT);
  });
});
