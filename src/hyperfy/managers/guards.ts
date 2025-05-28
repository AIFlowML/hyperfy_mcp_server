/**
 * Guards any async task and tracks if something is running.
 * Used to prevent behavior execution during active message processing.
 * 
 * This implements a reference counting mechanism to ensure that autonomous
 * behaviors don't interfere with user-initiated actions or message processing.
 */

/**
 * Type for async functions that can be executed within the activity lock
 */
export type AsyncTaskFunction<T = unknown> = () => Promise<T>;

/**
 * Activity lock class that prevents concurrent execution of autonomous behaviors
 * during active message processing or user interactions.
 */
export class AgentActivityLock {
  /** Current number of active tasks */
  private count = 0;
  
  /** Timestamp of when the lock was last acquired */
  private lastAcquired = 0;
  
  /** Maximum allowed lock duration in milliseconds (safety mechanism) */
  private readonly maxLockDuration = 30000; // 30 seconds

  /**
   * Check if any activities are currently active
   * @returns true if there are active tasks holding the lock
   */
  isActive(): boolean {
    // Safety check: if lock has been held too long, reset it
    if (this.count > 0 && this.lastAcquired > 0) {
      const lockDuration = Date.now() - this.lastAcquired;
      if (lockDuration > this.maxLockDuration) {
        console.warn(`[AgentActivityLock] Lock held for ${lockDuration}ms, forcibly releasing`);
        this.forceReset();
        return false;
      }
    }
    
    return this.count > 0;
  }

  /**
   * Acquire the lock (increment reference count)
   * Call this when starting an activity that should block autonomous behaviors
   */
  enter(): void {
    this.count++;
    this.lastAcquired = Date.now();
  }

  /**
   * Release the lock (decrement reference count)
   * Call this when finishing an activity
   */
  exit(): void {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      this.lastAcquired = 0;
    }
  }

  /**
   * Execute an async function while holding the activity lock
   * Automatically acquires lock before execution and releases after completion
   * 
   * @param fn - Async function to execute
   * @returns Promise resolving to the function's return value
   * @throws Re-throws any error from the executed function
   */
  async run<T>(fn: AsyncTaskFunction<T>): Promise<T> {
    this.enter();
    try {
      return await fn();
    } finally {
      this.exit();
    }
  }

  /**
   * Get current activity count (for debugging)
   * @returns Number of active tasks holding the lock
   */
  getActiveCount(): number {
    return this.count;
  }

  /**
   * Get time since lock was acquired (for debugging)
   * @returns Milliseconds since lock was first acquired, or 0 if not active
   */
  getLockDuration(): number {
    if (this.count === 0 || this.lastAcquired === 0) {
      return 0;
    }
    return Date.now() - this.lastAcquired;
  }

  /**
   * Force reset the lock (emergency use only)
   * This should only be used in error recovery scenarios
   */
  forceReset(): void {
    console.warn('[AgentActivityLock] Force resetting activity lock');
    this.count = 0;
    this.lastAcquired = 0;
  }

  /**
   * Get debug information about the lock state
   * @returns Object with current lock state information
   */
  getDebugInfo(): {
    isActive: boolean;
    activeCount: number;
    lockDuration: number;
    lastAcquired: number;
  } {
    return {
      isActive: this.isActive(),
      activeCount: this.count,
      lockDuration: this.getLockDuration(),
      lastAcquired: this.lastAcquired
    };
  }
}

/**
 * Global singleton instance of the activity lock
 * Use this instance throughout the application to coordinate activity blocking
 */
export const agentActivityLock = new AgentActivityLock();
  