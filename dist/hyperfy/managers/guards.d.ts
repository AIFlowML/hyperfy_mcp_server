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
export declare class AgentActivityLock {
    /** Current number of active tasks */
    private count;
    /** Timestamp of when the lock was last acquired */
    private lastAcquired;
    /** Maximum allowed lock duration in milliseconds (safety mechanism) */
    private readonly maxLockDuration;
    /**
     * Check if any activities are currently active
     * @returns true if there are active tasks holding the lock
     */
    isActive(): boolean;
    /**
     * Acquire the lock (increment reference count)
     * Call this when starting an activity that should block autonomous behaviors
     */
    enter(): void;
    /**
     * Release the lock (decrement reference count)
     * Call this when finishing an activity
     */
    exit(): void;
    /**
     * Execute an async function while holding the activity lock
     * Automatically acquires lock before execution and releases after completion
     *
     * @param fn - Async function to execute
     * @returns Promise resolving to the function's return value
     * @throws Re-throws any error from the executed function
     */
    run<T>(fn: AsyncTaskFunction<T>): Promise<T>;
    /**
     * Get current activity count (for debugging)
     * @returns Number of active tasks holding the lock
     */
    getActiveCount(): number;
    /**
     * Get time since lock was acquired (for debugging)
     * @returns Milliseconds since lock was first acquired, or 0 if not active
     */
    getLockDuration(): number;
    /**
     * Force reset the lock (emergency use only)
     * This should only be used in error recovery scenarios
     */
    forceReset(): void;
    /**
     * Get debug information about the lock state
     * @returns Object with current lock state information
     */
    getDebugInfo(): {
        isActive: boolean;
        activeCount: number;
        lockDuration: number;
        lastAcquired: number;
    };
}
/**
 * Global singleton instance of the activity lock
 * Use this instance throughout the application to coordinate activity blocking
 */
export declare const agentActivityLock: AgentActivityLock;
//# sourceMappingURL=guards.d.ts.map