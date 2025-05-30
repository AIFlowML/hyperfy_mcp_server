import type { FastMCPRuntime } from "../../types/index.js";
export type { FastMCPRuntime } from '../../types/index.js';
export declare class BehaviorManager {
    private isRunning;
    private runtime;
    private logger;
    constructor(runtime: FastMCPRuntime);
    /**
     * Starts the behavior loop
     */
    start(): void;
    /**
     * Stops the behavior loop
     */
    stop(): void;
    /**
     * Main loop that waits for each behavior to finish
     */
    private runLoop;
    private getService;
    /**
     * Executes a behavior
     */
    private executeBehavior;
    /**
     * Processes the AI behavior response and executes actions
     */
    private processBehaviorResponse;
}
//# sourceMappingURL=behavior-manager.d.ts.map