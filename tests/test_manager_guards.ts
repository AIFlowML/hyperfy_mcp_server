/**
 * Comprehensive test suite for AgentActivityLock (guards.ts)
 * Tests activity lock functionality, reference counting, and safety mechanisms
 * Validates the activity coordination system for preventing concurrent behaviors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentActivityLock, agentActivityLock, type AsyncTaskFunction } from '../src/hyperfy/managers/guards.js';
import { createLogger } from '../src/utils/eliza-compat.js';

const logger = createLogger();

// Test configuration
const TEST_CONFIG = {
  TEST_TIMEOUT: 5000, // 5 seconds
  LOCK_TIMEOUT: 100, // 100ms for quick tests
  MAX_LOCK_DURATION: 30000, // 30 seconds (matches implementation)
};

// Mock console methods
const consoleSpy = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
};

describe('AgentActivityLock', () => {
  let activityLock: AgentActivityLock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset console spies
    consoleSpy.warn.mockClear();
    
    // Create fresh instance for each test
    activityLock = new AgentActivityLock();
    
    logger.info('🔒 Starting AgentActivityLock test');
  });

  afterEach(() => {
    vi.useRealTimers();
    
    // Force reset any locks to prevent test interference
    try {
      activityLock.forceReset();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    logger.info('🧹 AgentActivityLock test cleanup complete');
  });

  describe('Constructor and Initial State', () => {
    it('should initialize with inactive state', () => {
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      expect(activityLock.getLockDuration()).toBe(0);
      
      const debugInfo = activityLock.getDebugInfo();
      expect(debugInfo.isActive).toBe(false);
      expect(debugInfo.activeCount).toBe(0);
      expect(debugInfo.lockDuration).toBe(0);
      expect(debugInfo.lastAcquired).toBe(0);
      
      logger.info('✅ AgentActivityLock initialized with inactive state');
    });
  });

  describe('Basic Lock Operations', () => {
    it('should enter and exit lock correctly', () => {
      // Initially inactive
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      // Enter lock
      activityLock.enter();
      expect(activityLock.isActive()).toBe(true);
      expect(activityLock.getActiveCount()).toBe(1);
      
      // Fast forward a bit to ensure duration is tracked
      vi.advanceTimersByTime(100);
      expect(activityLock.getLockDuration()).toBeGreaterThanOrEqual(100);
      
      // Exit lock
      activityLock.exit();
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      expect(activityLock.getLockDuration()).toBe(0);
      
      logger.info('✅ Basic enter/exit operations work correctly');
    });

    it('should handle multiple enters and exits (reference counting)', () => {
      // Enter multiple times
      activityLock.enter();
      activityLock.enter();
      activityLock.enter();
      
      expect(activityLock.isActive()).toBe(true);
      expect(activityLock.getActiveCount()).toBe(3);
      
      // Exit once - should still be active
      activityLock.exit();
      expect(activityLock.isActive()).toBe(true);
      expect(activityLock.getActiveCount()).toBe(2);
      
      // Exit again - still active
      activityLock.exit();
      expect(activityLock.isActive()).toBe(true);
      expect(activityLock.getActiveCount()).toBe(1);
      
      // Final exit - now inactive
      activityLock.exit();
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ Reference counting works correctly');
    });

    it('should prevent count from going below zero', () => {
      // Exit without entering
      activityLock.exit();
      expect(activityLock.getActiveCount()).toBe(0);
      expect(activityLock.isActive()).toBe(false);
      
      // Multiple exits
      activityLock.exit();
      activityLock.exit();
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ Count protection works correctly');
    });
  });

  describe('Async Task Execution', () => {
    it('should execute async task with automatic lock management', async () => {
      let taskExecuted = false;
      
      const testTask: AsyncTaskFunction<string> = async () => {
        taskExecuted = true;
        expect(activityLock.isActive()).toBe(true); // Should be active during execution
        expect(activityLock.getActiveCount()).toBe(1);
        return 'task-result';
      };
      
      // Before execution
      expect(activityLock.isActive()).toBe(false);
      
      // Execute task
      const result = await activityLock.run(testTask);
      
      // After execution
      expect(result).toBe('task-result');
      expect(taskExecuted).toBe(true);
      expect(activityLock.isActive()).toBe(false); // Should be released
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ Async task execution with automatic lock management works');
    });

    it('should release lock even if task throws error', async () => {
      const testTask: AsyncTaskFunction<never> = async () => {
        expect(activityLock.isActive()).toBe(true); // Should be active during execution
        throw new Error('Task failed');
      };
      
      // Execute task and expect error
      await expect(activityLock.run(testTask)).rejects.toThrow('Task failed');
      
      // Lock should be released despite error
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ Lock released even when task throws error');
    });

    it('should handle nested task execution', async () => {
      let outerExecuted = false;
      let innerExecuted = false;
      
      const innerTask: AsyncTaskFunction<string> = async () => {
        innerExecuted = true;
        expect(activityLock.getActiveCount()).toBe(2); // Nested lock
        return 'inner-result';
      };
      
      const outerTask: AsyncTaskFunction<string> = async () => {
        outerExecuted = true;
        expect(activityLock.getActiveCount()).toBe(1);
        
        const innerResult = await activityLock.run(innerTask);
        expect(innerResult).toBe('inner-result');
        
        return 'outer-result';
      };
      
      const result = await activityLock.run(outerTask);
      
      expect(result).toBe('outer-result');
      expect(outerExecuted).toBe(true);
      expect(innerExecuted).toBe(true);
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ Nested task execution works correctly');
    });

    it('should handle concurrent task execution', async () => {
      let task1Executed = false;
      let task2Executed = false;
      
      const task1: AsyncTaskFunction<string> = async () => {
        task1Executed = true;
        // No setTimeout needed - just return immediately
        return 'task1-result';
      };
      
      const task2: AsyncTaskFunction<string> = async () => {
        task2Executed = true;
        // No setTimeout needed - just return immediately
        return 'task2-result';
      };
      
      // Execute tasks concurrently
      const [result1, result2] = await Promise.all([
        activityLock.run(task1),
        activityLock.run(task2)
      ]);
      
      expect(result1).toBe('task1-result');
      expect(result2).toBe('task2-result');
      expect(task1Executed).toBe(true);
      expect(task2Executed).toBe(true);
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ Concurrent task execution works correctly');
    });
  });

  describe('Safety Mechanisms', () => {
    it('should force reset lock after maximum duration', () => {
      // Enter lock
      activityLock.enter();
      expect(activityLock.isActive()).toBe(true);
      
      // Fast forward past maximum lock duration
      vi.advanceTimersByTime(TEST_CONFIG.MAX_LOCK_DURATION + 1000);
      
      // Check if lock is automatically reset
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      // Should have logged warning
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Lock held for')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('forcibly releasing')
      );
      
      logger.info('✅ Safety mechanism resets lock after maximum duration');
    });

    it('should handle force reset correctly', () => {
      // Set up active lock
      activityLock.enter();
      activityLock.enter();
      expect(activityLock.getActiveCount()).toBe(2);
      expect(activityLock.isActive()).toBe(true);
      
      // Force reset
      activityLock.forceReset();
      
      expect(activityLock.getActiveCount()).toBe(0);
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getLockDuration()).toBe(0);
      
      // Should have logged warning
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[AgentActivityLock] Force resetting activity lock'
      );
      
      logger.info('✅ Force reset works correctly');
    });

    it('should handle force reset when already inactive', () => {
      // Force reset when already inactive
      expect(activityLock.isActive()).toBe(false);
      activityLock.forceReset();
      
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      // Should still log warning
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[AgentActivityLock] Force resetting activity lock'
      );
      
      logger.info('✅ Force reset handles inactive state correctly');
    });
  });

  describe('Debug Information', () => {
    it('should provide accurate debug information', () => {
      // Initial state
      let debugInfo = activityLock.getDebugInfo();
      expect(debugInfo.isActive).toBe(false);
      expect(debugInfo.activeCount).toBe(0);
      expect(debugInfo.lockDuration).toBe(0);
      expect(debugInfo.lastAcquired).toBe(0);
      
      // After entering lock
      activityLock.enter();
      
      // Fast forward time to ensure duration is tracked
      vi.advanceTimersByTime(500);
      
      debugInfo = activityLock.getDebugInfo();
      expect(debugInfo.isActive).toBe(true);
      expect(debugInfo.activeCount).toBe(1);
      expect(debugInfo.lockDuration).toBeGreaterThanOrEqual(500);
      expect(debugInfo.lastAcquired).toBeGreaterThan(0);
      
      // Fast forward more time
      vi.advanceTimersByTime(1000);
      debugInfo = activityLock.getDebugInfo();
      expect(debugInfo.lockDuration).toBeGreaterThanOrEqual(1500);
      
      logger.info('✅ Debug information is accurate');
    });

    it('should track lock duration correctly', () => {
      expect(activityLock.getLockDuration()).toBe(0);
      
      activityLock.enter();
      
      // Fast forward time to ensure duration is tracked
      vi.advanceTimersByTime(100);
      expect(activityLock.getLockDuration()).toBeGreaterThanOrEqual(100);
      
      // Fast forward more time
      vi.advanceTimersByTime(2000);
      expect(activityLock.getLockDuration()).toBeGreaterThanOrEqual(2100);
      
      activityLock.exit();
      expect(activityLock.getLockDuration()).toBe(0);
      
      logger.info('✅ Lock duration tracking works correctly');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid enter/exit operations', () => {
      // Rapid operations
      for (let i = 0; i < 100; i++) {
        activityLock.enter();
      }
      expect(activityLock.getActiveCount()).toBe(100);
      
      for (let i = 0; i < 100; i++) {
        activityLock.exit();
      }
      expect(activityLock.getActiveCount()).toBe(0);
      expect(activityLock.isActive()).toBe(false);
      
      logger.info('✅ Rapid operations handled correctly');
    });

    it('should handle async task that returns undefined', async () => {
      const testTask: AsyncTaskFunction<undefined> = async () => {
        return undefined;
      };
      
      const result = await activityLock.run(testTask);
      expect(result).toBeUndefined();
      expect(activityLock.isActive()).toBe(false);
      
      logger.info('✅ Async task returning undefined handled correctly');
    });

    it('should handle async task that returns complex objects', async () => {
      const complexObject = { 
        data: [1, 2, 3], 
        nested: { value: 'test' },
        timestamp: Date.now()
      };
      
      const testTask: AsyncTaskFunction<typeof complexObject> = async () => {
        return complexObject;
      };
      
      const result = await activityLock.run(testTask);
      expect(result).toEqual(complexObject);
      expect(activityLock.isActive()).toBe(false);
      
      logger.info('✅ Complex object return values handled correctly');
    });

    it('should maintain state consistency under stress', async () => {
      const tasks: Promise<string>[] = [];
      
      // Create multiple concurrent tasks (simplified without setTimeout)
      for (let i = 0; i < 10; i++) {
        const task: AsyncTaskFunction<string> = async () => {
          // No setTimeout needed - just return immediately
          return `task-${i}`;
        };
        tasks.push(activityLock.run(task));
      }
      
      // Wait for all tasks to complete
      const results = await Promise.all(tasks);
      
      // Verify results
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBe(`task-${index}`);
      });
      
      // Lock should be released
      expect(activityLock.isActive()).toBe(false);
      expect(activityLock.getActiveCount()).toBe(0);
      
      logger.info('✅ State consistency maintained under stress');
    });
  });

  describe('Global Singleton Instance', () => {
    it('should provide global singleton instance', () => {
      expect(agentActivityLock).toBeInstanceOf(AgentActivityLock);
      expect(agentActivityLock.isActive()).toBe(false);
      expect(agentActivityLock.getActiveCount()).toBe(0);
      
      // Test basic functionality
      agentActivityLock.enter();
      expect(agentActivityLock.isActive()).toBe(true);
      
      agentActivityLock.exit();
      expect(agentActivityLock.isActive()).toBe(false);
      
      logger.info('✅ Global singleton instance works correctly');
    });

    it('should maintain singleton state across operations', async () => {
      const testTask: AsyncTaskFunction<string> = async () => {
        return 'singleton-test';
      };
      
      const result = await agentActivityLock.run(testTask);
      expect(result).toBe('singleton-test');
      expect(agentActivityLock.isActive()).toBe(false);
      
      logger.info('✅ Singleton state maintained correctly');
    });
  });
});
