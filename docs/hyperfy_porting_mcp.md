# Porting Hyperfy ElizaOS Plugin to FastMCP Server

## Introduction

This document outlines the plan and process for migrating the existing Hyperfy plugin, currently based on ElizaOS, to a standalone Model Context Protocol (MCP) server. The new server will be built using the FastMCP framework in TypeScript, removing all dependencies on ElizaOS while preserving the core functionalities and logic of the original plugin.

The primary objective is to create a robust, maintainable, and modern MCP server that can interact with various clients (including AI agents) to control and interface with a Hyperfy environment.

## High-Level Goals

The successful porting of the Hyperfy plugin to a FastMCP server will achieve the following:

1.  **Standalone Operation:** The server will operate independently of ElizaOS.
2.  **Functionality Preservation:** All critical functionalities from the original plugin will be retained, including:
    *   Action execution (e.g., `goto`, `chat`, `use`, `emote`).
    *   State management via existing managers.
    *   Physics interactions.
    *   LiveKit voice integration.
3.  **FastMCP Framework:** Utilize FastMCP as the underlying server architecture, leveraging its features for tool definition, session management, and communication.
4.  **TypeScript & Typing:** Maintain a fully typed TypeScript codebase for improved maintainability and developer experience.
5.  **Code Reusability:** Reuse the existing TypeScript code from `plugin-hyperfy/` as much as possible, adapting it to the FastMCP structure.
6.  **Existing Constants:** Integrate existing constants, such as the `EMOTES_LIST` from [`constants.ts`](mdc:plugin-hyperfy/constants.ts).
7.  **Maintainable Structure:** Preserve the logical organization of the current `plugin-hyperfy` folder structure for actions, managers, physx, etc., within the new MCP server project.
8.  **Clear API:** Define clear MCP tools that correspond to the current plugin actions, with well-defined parameters and responses.

## Pre-requisites and Current State Analysis

Before diving into the porting process, a thorough analysis of the existing `plugin-hyperfy` codebase is necessary. This section will detail the components to be examined and the information to be extracted.

### 1. Analyze Existing `plugin-hyperfy` Structure

*   **Objective:** Understand the current organization of code and identify core modules.
*   **Key Directories/Files to Review:**
    *   `plugin-hyperfy/actions/`: Contains individual action handlers (e.g., `ambient.ts`, `chat.ts`, `goto.ts`, `emote.ts` etc.). These will likely become individual MCP tools.
    *   `plugin-hyperfy/managers/`: Houses state management logic (e.g., `PlayerManager`, `EmoteManager`). Their role and how they will be instantiated/accessed in the FastMCP context needs to be defined.
    *   `plugin-hyperfy/physx/`: Contains physics-related logic and interactions. Determine how this will be integrated and if it has any direct ElizaOS dependencies.
    *   `plugin-hyperfy/hyperfy/` (if applicable, or other core directories): Identify any core interfacing logic with Hyperfy itself.
    *   `plugin-hyperfy/constants.ts`: Contains shared constants like `EMOTES_LIST`.
    *   `plugin-hyperfy/systems/`: Understand if these are ElizaOS specific or contain reusable logic.
    *   `plugin-hyperfy/providers/`: Analyze if these are tied to ElizaOS or can be adapted.
    *   **LiveKit Integration:** Locate the code responsible for LiveKit voice integration and assess its dependencies.

### 2. Identify ElizaOS Dependencies

*   **Objective:** Pinpoint all specific ElizaOS imports, API calls, and framework-specific patterns.
*   **Method:**
    *   Scan for imports from ElizaOS packages (e.g., `@elizaos/eliza-adapter`, `@elizaos/service-interfaces`).
    *   Look for usage of ElizaOS-specific classes, functions, or lifecycle methods (e.g., `ElizaService`, `ElizaClient`, `onInit`, `onMessage`).
    *   Identify how configuration is handled and if it relies on ElizaOS mechanisms.

### 3. Map Actions to MCP Tools

*   **Objective:** Define a clear mapping from the current plugin actions to new MCP tools.
*   **Process:** For each action in `plugin-hyperfy/actions/`:
    *   Identify its purpose.
    *   Determine its input parameters (and their types).
    *   Determine its output/result (and its type).
    *   Note any side effects or state changes it performs.
    *   This information will be crucial for defining the `schema` (using Zod) and `execute` function for each FastMCP tool.

### 4. Analyze State Management

*   **Objective:** Understand how state is currently managed and how it will translate to the FastMCP server context.
*   **Considerations:**
    *   How are managers (`PlayerManager`, `EmoteManager`, etc.) instantiated and accessed?
    *   Will managers be global singletons, or instantiated per session in FastMCP?
    *   How is state persisted, if at all?

### 5. Review Physics Integration (`plugin-hyperfy/physx`)

*   **Objective:** Understand the role of the `physx` module and its dependencies.
*   **Key Questions:**
    *   What functionalities does it provide?
    *   How does it interact with the Hyperfy environment?
    *   Are there any direct ElizaOS dependencies that need to be refactored?

### 6. Review LiveKit Integration

*   **Objective:** Understand how LiveKit is used for voice and its dependencies.
*   **Key Questions:**
    *   How is the LiveKit client initialized and managed?
    *   How are voice connections established and terminated?
    *   Are there any ElizaOS specific parts in this integration?

### 7. Define Data Structures and Types

*   **Objective:** Ensure all necessary data structures and TypeScript types are carried over or redefined for the new MCP server.
*   **Action:** Review existing type definitions and ensure they are comprehensive and can be used within the FastMCP tool definitions (e.g., for Zod schemas).

## Proposed MCP Server Architecture

This section details the proposed architecture for the new Hyperfy MCP server built with FastMCP.

### 1. Project Setup

*   **Framework:** FastMCP
*   **Language:** TypeScript
*   **Package Manager:** `npm` or `yarn` (or `bun` if preferred, ensure FastMCP compatibility)
*   **Directory Structure (Illustrative):**
    ```
    hyperfy-mcp-server/
    ├── src/
    │   ├── actions/         // Ported actions, adapted as FastMCP tools
    │   │   ├── ambientTool.ts
    │   │   ├── chatTool.ts
    │   │   └── ... (other action tools)
    │   ├── managers/        // Ported managers
    │   │   ├── PlayerManager.ts
    │   │   └── EmoteManager.ts
    │   ├── physx/           // Ported physics logic
    │   ├── livekit/         // LiveKit integration logic
    │   ├── constants.ts     // Shared constants (e.g., EMOTES_LIST)
    │   ├── server.ts        // Main FastMCP server setup and instantiation
    │   ├── session.ts       // (Optional) Custom session class if extending FastMCPSession
    │   └── types.ts         // Shared type definitions
    ├── package.json
    ├── tsconfig.json
    └── ... (other config files, e.g., .env for API keys)
    ```

### 2. FastMCP Server Initialization (`src/server.ts`)

*   Instantiate `FastMCP` server.
*   Define server options: `name`, `version`, `instructions` (if any).
*   Implement authentication if needed (e.g., using `auth` function in server options).
*   Register all MCP tools (ported from `plugin-hyperfy/actions/`).

### 3. Defining MCP Tools (from `plugin-hyperfy/actions/`)

*   Each action in `plugin-hyperfy/actions/` will be converted into an MCP tool.
*   **Tool Definition:**
    *   `name`: Descriptive name for the tool (e.g., `hyperfy_chat`, `hyperfy_goToLocation`).
    *   `description`: Clear explanation of what the tool does.
    *   `parameters`: Zod schema defining the expected input parameters, derived from the original action's inputs.
    *   `execute`: Async function containing the core logic of the action.
        *   It will receive `args` (parsed parameters) and a `context` object.
        *   The `context` object will provide access to:
            *   `log`: For logging (debug, info, warn, error).
            *   `auth`: Authentication object (if authentication is used).
            *   Session-specific state or managers (see below).
*   **Example Tool (Conceptual):**
    ```typescript
    // src/actions/chatTool.ts
    import { z } from 'zod';
    import { FastMCPTool } from 'fastmcp'; // Assuming FastMCPTool type
    // Potentially import managers or other necessary modules

    export const chatTool: FastMCPTool = {
      name: 'hyperfy_chat',
      description: 'Sends a chat message in the Hyperfy world.',
      parameters: z.object({
        message: z.string().describe('The chat message to send.'),
        channel: z.string().optional().describe('The chat channel (e.g., local, world). Default: local'),
      }),
      execute: async (args, context) => {
        context.log.info('Executing chatTool', { args });
        // Access managers or other services from context if needed
        // const playerManager = context.session.getManager('playerManager');
        try {
          // ... (Original chat action logic, adapted)
          // Example: await hyperfyService.sendChatMessage(args.message, args.channel);
          return { success: true, message: `Message "${args.message}" sent.` };
        } catch (error) { 
          context.log.error('Error in chatTool', { error });
          // FastMCP will handle returning this as an MCP error response
          throw new Error(`Failed to send chat message: ${error.message}`);
        }
      },
    };
    ```

### 4. Managing State and Services (Managers, PhysX, LiveKit)

*   **Instantiation:**
    *   Managers (`PlayerManager`, `EmoteManager`), PhysX services, and LiveKit services will need to be instantiated.
    *   **Option 1 (Per Session):** If state is session-specific, instantiate these services within the `FastMCPSession` (potentially by extending it or using the `contextData` option of FastMCP server). This is generally preferred for isolation.
    *   **Option 2 (Global Singleton):** If some services are truly global and stateless or manage their own internal state safely across sessions, they could be instantiated once and accessed globally. Use with caution.
*   **Access from Tools:** Tools will access these services via the `context` object passed to their `execute` function. The `context` could hold references to session-specific instances of managers/services.
    *   FastMCP's `serverOptions.contextData` can be a function `(auth?: AuthType) => Promise<ContextDataType>` which is called when a new session is created. The return value is then available as `context.session.data` within tools.

### 5. Constants and Types

*   `plugin-hyperfy/constants.ts` (e.g., `EMOTES_LIST`) will be copied or imported into the new project (`src/constants.ts`).
*   Shared TypeScript types will be defined in `src/types.ts` or co-located as appropriate.

### 6. ElizaOS Abstraction Layer (Temporary, if needed)

*   To facilitate incremental porting, a temporary abstraction layer might be created to mimic parts of the ElizaOS API that the existing code relies on.
*   The goal is to eventually remove this layer entirely.

### 7. Logging

*   Utilize FastMCP's built-in logging within tools: `context.log.info()`, `context.log.error()`, etc.
*   This ensures logs are correctly routed (e.g., as MCP `LogEntry` messages if using `stdio` transport) and do not interfere with the main MCP request/response flow.

### 8. Error Handling

*   Errors thrown within a tool's `execute` function will be automatically caught by FastMCP and returned as a standard MCP error response to the client.
*   Ensure error messages are informative.

## Detailed Porting Steps

This section breaks down the migration process into a sequence of actionable steps.

**Phase 1: Project Setup and Basic Structure**

1.  **Initialize New FastMCP Project:**
    *   Create a new directory (e.g., `hyperfy-mcp-server`).
    *   Initialize a Node.js project (`npm init` or `yarn init`).
    *   Install FastMCP and Zod: `npm install fastmcp zod` (or `yarn add fastmcp zod`).
    *   Install TypeScript and necessary types: `npm install -D typescript @types/node ts-node` (or yarn equivalents).
    *   Setup `tsconfig.json` with appropriate settings (e.g., `target: ES2020` or later, `module: CommonJS` or `NodeNext`, `strict: true`, `esModuleInterop: true`, `outDir`, `rootDir`).
    *   Create the basic directory structure outlined in the "Proposed Architecture" section (`src/`, `src/actions/`, `src/managers/`, etc.).

2.  **Copy Core Assets & Logic:**
    *   Copy the contents of `plugin-hyperfy/actions/` into `src/actions/`.
    *   Copy `plugin-hyperfy/managers/` into `src/managers/`.
    *   Copy `plugin-hyperfy/physx/` into `src/physx/`.
    *   Copy relevant LiveKit integration code into `src/livekit/`.
    *   Copy `plugin-hyperfy/constants.ts` to `src/constants.ts`.
    *   Identify and copy any other reusable TypeScript modules, utilities, or type definitions.

3.  **Create Basic FastMCP Server (`src/server.ts`):**
    *   Import `FastMCP`.
    *   Create a minimal server instance with `name` and `version`.
    *   Set up a basic transport (e.g., `stdio` or `http` for initial testing).
    *   Implement a simple "hello world" or health check tool to verify the server starts and responds.

**Phase 2: Porting Core Functionality (Iterative)**

For each of the following (Actions, Managers, PhysX, LiveKit):

4.  **Refactor ElizaOS Dependencies (Iteratively):**
    *   Go through each copied module (actions, managers, etc.).
    *   Identify and remove/replace ElizaOS-specific imports and API calls.
    *   **Actions (`src/actions/`):**
        *   Convert each action file into a FastMCP tool definition (see "Proposed Architecture").
        *   Define Zod schemas for parameters.
        *   Adapt the core logic to fit the `execute(args, context)` structure.
        *   Initially, stub out dependencies on managers or other services if they are not yet ported.
    *   **Managers (`src/managers/`):**
        *   Refactor to remove ElizaOS dependencies.
        *   Determine how they will be instantiated (per-session via `contextData` or global) and update their constructors/initialization logic accordingly.
    *   **PhysX (`src/physx/`):**
        *   Refactor to remove ElizaOS dependencies.
        *   Define a clear interface for the PhysX service.
    *   **LiveKit (`src/livekit/`):**
        *   Refactor to remove ElizaOS dependencies.
        *   Define a clear interface for the LiveKit service.

5.  **Integrate Managers and Services into FastMCP Context:**
    *   Decide on the instantiation strategy (per-session recommended for most stateful services).
    *   If per-session, use `serverOptions.contextData` in `src/server.ts` to instantiate and provide managers/services to the tool context (`context.session.data`).
    *   Update tools in `src/actions/` to access these services via the `context` object.

6.  **Implement MCP Tools (one by one):**
    *   Take one ported action (now a tool definition) from `src/actions/`.
    *   Ensure its Zod schema is correct.
    *   Thoroughly test its `execute` function, ensuring it interacts correctly with any managers or services it depends on (now accessed via `context`).
    *   Add the tool to the FastMCP server instance in `src/server.ts` using `server.addTool()`.
    *   Test the tool via an MCP client (e.g., a simple test script, or a generic MCP client UI if available).
    *   Repeat for all actions.

**Phase 3: Advanced Features and Refinements**

7.  **Implement Authentication (if required):**
    *   Define the authentication mechanism.
    *   Implement the `auth` function in `FastMCP` server options.
    *   Ensure authenticated data is available in `context.auth` within tools.

8.  **Implement Custom Session Handling (if required):**
    *   If advanced session lifecycle management or state is needed beyond `contextData`, consider extending `FastMCPSession`.

9.  **Refine Logging and Error Handling:**
    *   Ensure all tools use `context.log` for logging.
    *   Verify that errors are properly thrown and handled by FastMCP, providing meaningful error messages to the client.

10. **Configuration Management:**
    *   Set up environment variable handling (e.g., using `.env` files and a library like `dotenv`) for API keys or other sensitive configurations needed by services (e.g., LiveKit API keys).

**Phase 4: Testing and Documentation**

11. **Comprehensive Testing:**
    *   **Unit Tests:** Test individual functions, manager methods, and complex logic within tools in isolation.
    *   **Integration Tests:** Test interactions between tools and managers/services.
    *   **End-to-End (MCP Level):** Test the full request/response flow for each MCP tool using a client, verifying correct behavior and outputs.

12. **Update/Create Documentation:**
    *   Document the new MCP server's API (available tools, their parameters, and responses).
    *   Provide setup and usage instructions.
    *   Update this porting guide (`hyperfy_porting_mcp.md`) with any lessons learned or deviations from the plan.

**Phase 5: Deployment Considerations (Future)**

13. **Build Process:**
    *   Set up scripts in `package.json` for building the TypeScript project (e.g., `npm run build` using `tsc`).

14. **Deployment Strategy:**
    *   Consider how the server will be deployed (e.g., Docker container, Node.js hosting service).

## Key Challenges and Considerations

*   **State Management:** Deciding whether to make managers/services global or per-session will be a critical design choice. Per-session is generally safer for avoiding unintended state sharing but might require more careful context passing.
*   **Dependency Refactoring:** Removing ElizaOS dependencies without breaking the core logic of actions and managers will be the most time-consuming part. An iterative approach is key.
*   **Testing Complexity:** Ensuring all ported functionalities work as expected in the new FastMCP context will require thorough testing at multiple levels (unit, integration, MCP tool level).
*   **Asynchronous Operations:** Properly handling `async/await` throughout the FastMCP tools and services is crucial for a non-blocking server.
*   **External API Interactions:** If the plugin interacts with external Hyperfy APIs or other services directly, ensuring these integrations are preserved and correctly configured (e.g., API keys, endpoints) is important.
*   **LiveKit Integration:** Porting the LiveKit voice functionality and ensuring it integrates seamlessly with the FastMCP session lifecycle will require careful attention, especially regarding connection management and state.
*   **Error Propagation:** Ensuring that errors from deep within services or managers are correctly propagated and result in clear MCP error responses to the client.

## Conclusion

Migrating the Hyperfy ElizaOS plugin to a standalone FastMCP server is a significant undertaking but offers substantial benefits in terms of modernization, maintainability, and interoperability. By following the outlined plan, leveraging the strengths of FastMCP, and carefully managing the porting of existing logic, we can create a powerful and flexible MCP server for interacting with Hyperfy.

This document serves as the initial Product Requirements Document (PRD) for this porting effort. It will be updated as the project progresses and new insights are gained.

---
