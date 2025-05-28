# FastMCP: A TypeScript Framework for MCP Servers

FastMCP is a TypeScript framework designed for building Model Context Protocol (MCP) servers. It supports client sessions and offers a range of features to facilitate communication and interaction between clients (often Language Models or AI agents) and servers.

For a Python implementation, refer to [FastMCP (Python)](https://github.com/jlowin/fastmcp).

## Key Features

FastMCP provides a comprehensive set of features for building robust MCP servers:

*   **Simple Definitions:** Easy-to-define Tools, Resources, and Prompts.
*   **Authentication:** Secure client connections with custom authentication logic.
*   **Sessions:** Manages active client sessions, allocating a new server instance for each client for 1:1 communication.
*   **Content Handling:**
    *   **Image Content:** Supports returning images via URL, file path, or buffer.
    *   **Audio Content:** Supports returning audio via URL, file path, or buffer.
*   **Logging:** Tools can send log messages (debug, error, info, warn) to the client.
*   **Error Handling:** Custom `UserError` for errors intended to be shown to the user.
*   **Transport Options:**
    *   **HTTP Streaming:** Efficient alternative to SSE, supports SSE compatibility.
    *   **stdio:** For local communication.
*   **CORS:** Enabled by default for HTTP-based transports.
*   **Progress Notifications:** Tools can report progress of long-running operations.
*   **Streaming Output:** Tools can stream partial results incrementally (text, image, audio).
*   **Typed Server Events:** Listen to server events like `connect` and `disconnect`.
*   **Prompt Argument Auto-completion:** Provides completions for prompt arguments, including automatic completion for `enum` types.
*   **Sampling:** Allows sessions to request sampling from the client.
*   **Configurable Ping Behavior:** Maintains connection health with customizable ping intervals and logging. Optimized by default for different transport types.
*   **Health-check Endpoint:** Optional HTTP endpoint for liveness checks (e.g., for load balancers) when using `httpStream` transport.
*   **Roots Management:** Supports the MCP Roots feature, allowing clients to provide filesystem-like root locations that can be dynamically updated. This can be configured or disabled.
*   **CLI:** Includes `fastmcp dev` for testing with `mcp-cli` and `fastmcp inspect` for using the MCP Inspector Web UI.

## Core Concepts

### Tools
Tools allow servers to expose executable functions that clients (and LLMs) can invoke.
*   **Parameters:** Defined using [Standard Schema](https://standardschema.dev), compatible with libraries like Zod, ArkType, and Valibot. Tools can also be parameter-less.
*   **Return Values:** Can return strings, lists of content (text, image, audio), or specific content types directly using helpers like `imageContent` and `audioContent`.
*   **Logging:** Tools can use `context.log` to send messages to the client.
*   **Error Handling:** Throw `UserError` for user-facing errors.
*   **Progress Reporting:** Use `context.reportProgress` for long operations.
*   **Streaming Output:** Use `context.streamContent` and `streamingHint: true` annotation for incremental results.
*   **Annotations:** Provide metadata about tool behavior (e.g., `readOnlyHint`, `openWorldHint`, `title`).
*   **Timeout:** Tools can have a `timeoutMs` property.

### Resources
Resources represent data made available to clients (e.g., file contents, logs, images).
*   **URI:** Each resource is identified by a unique URI.
*   **Loading:** The `load` function provides the resource content (text or binary). It can return a single resource or an array of resources.
*   **Resource Templates:** Define resources with dynamic parts using URI templates (e.g., `file:///logs/{name}.log`).
    *   **Arguments:** Can have arguments, including auto-completion.

### Prompts
Prompts enable servers to define reusable prompt templates and workflows.
*   **Arguments:** Can have arguments with descriptions and completion logic (including `enum` based auto-completion).
*   **Loading:** The `load` function generates the prompt string based on arguments.

## Authentication
FastMCP allows custom authentication logic via the `authenticate` function in server options. The authenticated session data is accessible in tool execution contexts (`context.session`).

## Instructions
The `instructions` option in server configuration provides a hint to clients (and LLMs) about how to use the server and its features.

## Sessions (`FastMCPSession`)
Represents an active client session.
*   `requestSampling()`: Creates a sampling request.
*   `clientCapabilities`: Contains client-reported capabilities.
*   `loggingLevel`: Logging level set by the client.
*   `roots`: Roots set by the client.
*   `server`: Instance of the MCP server associated with the session.
*   **Typed Session Events:** Listen to session events like `rootsChanged` and `error`.

## Installation

```bash
npm install fastmcp
```

## Quickstart Example

```typescript
import { FastMCP } from "fastmcp";
import { z } from "zod"; // Or any validation library

const server = new FastMCP({
  name: "My Server",
  version: "1.0.0",
});

server.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async (args) => {
    return String(args.a + args.b);
  },
});

server.start({
  transportType: "stdio", // or "httpStream"
});
```
Refer to the [official README](https://github.com/punkpeye/fastmcp/blob/main/README.md) for more detailed examples and API usage.

## Logging

FastMCP provides a structured way for tools to send log messages to the client. This is crucial for debugging and providing operational insights without interfering with the MCP message stream, especially when using `stdio` transport.

### Logging from Tools

When you define a tool, its `execute` function receives a `context` object. This object contains a `log` property with the following methods:

*   `log.debug(message: string, data?: SerializableValue)`
*   `log.error(message: string, data?: SerializableValue)`
*   `log.info(message: string, data?: SerializableValue)`
*   `log.warn(message: string, data?: SerializableValue)`

**Example:**

```typescript
server.addTool({
  name: "myTask",
  description: "Performs a task and logs information",
  parameters: z.object({ /* ... */ }),
  execute: async (args, { log }) => {
    log.info("Starting myTask", { inputArgs: args });

    try {
      // ... task logic ...
      log.debug("Intermediate step successful", { detail: "xyz" });
      // ... more logic ...
      log.info("myTask completed successfully");
      return "Task finished";
    } catch (e) {
      log.error("Error during myTask", { error: e.message });
      throw new UserError("MyTask failed. Check logs for details.");
    }
  },
});
```

### How Logging Works

1.  When a tool calls one of the `log` methods (e.g., `log.info(...)`), FastMCP constructs a logging notification.
2.  This notification is sent to the connected client over the MCP transport.
3.  The client is then responsible for handling this notification, which might involve displaying it in a UI, writing it to a file, or ignoring it based on its own settings.

### Client-Side Logging Level

The client can suggest its preferred logging level to the server by calling `client.setLoggingLevel("debug" | "info" | "warn" | "error" | ...)`.
*   The `FastMCPSession` on the server-side stores this preferred level in its `loggingLevel` property.
*   **Important:** FastMCP itself (as of the reviewed code) primarily uses this as an indicator. It sends all log messages from `context.log` to the client regardless of this level. The client is expected to perform the actual filtering based on the `loggingLevel` it has set or its own internal logic.

### Preventing Interference with `stdio` Transport

The primary way `console.log` (or similar direct stdout/stderr writes) can break an MCP server using `stdio` is if these logs are printed directly from your tool's JavaScript/TypeScript code *outside* of the MCP protocol. The `stdio` transport relies on a strict JSON-RPC-like message format over `stdin`/`stdout`. Any other output intermingled with these messages can corrupt the stream and cause the client or server to fail in parsing messages.

**To avoid issues:**

*   **ALWAYS use `context.log.{level}()`** for any information you want to log from within your tool's execution logic when it's intended to be seen as a log entry related to the MCP operation.
*   Avoid raw `console.log()`, `console.error()`, etc., in your tool's `execute` functions if their output isn't part of a deliberate, non-MCP communication channel (which is rare and advanced). If you need to debug locally during development *before* an MCP client is connected, `console.log` might be fine, but it should generally be removed or replaced with `context.log` for production/MCP communication.

### Ping Logging

The keep-alive ping mechanism has its own separate `logLevel` configuration within the `ping` options when initializing `FastMCP`. This controls the verbosity of logs specifically related to the ping/pong messages and defaults to `'debug'`. This is distinct from the tool logging described above.

```typescript
const server = new FastMCP({
  name: "My Server",
  version: "1.0.0",
  ping: {
    enabled: true,       // Default varies by transport
    intervalMs: 10000,   // Default is 5000ms
    logLevel: "info",    // Default is "debug", set to "info" or higher to reduce noise
  },
});
```

---

## `FastMCP` Server Class

The `FastMCP` class is the main entry point for creating an MCP server.

```typescript
import { FastMCP } from "fastmcp";

const server = new FastMCP<MyAuthType>({
  name: "MyAwesomeServer",
  version: "1.2.3",
  // ... other options
});
```

Where `MyAuthType` is an optional type you define for your session's authentication object. If no authentication is used, you can omit the type parameter.

### Constructor Options (`ServerOptions<T>`)

When creating a `new FastMCP(options)`, you can provide the following options:

*   **`name: string` (required)**: The name of your MCP server.
*   **`version: string` (required)**: The version of your server, following semantic versioning (e.g., `"1.0.0"`).
*   **`instructions?: string`**: Optional instructions for clients (especially LLMs) on how to interact with the server and its capabilities. This might be included in a system prompt by the client.
*   **`authenticate?: (request: http.IncomingMessage) => Promise<T>`**: An optional asynchronous function to handle client authentication. `T` is the type of the object that will be available as `context.session` in your tools if authentication is successful. The function receives the raw `http.IncomingMessage` (for HTTP-based transports).
    *   If authentication is successful, resolve the promise with the session object of type `T`.
    *   If authentication fails, you can throw an error or return a `Response` object with a non-200 status (e.g., `throw new Response(null, { status: 401, statusText: "Unauthorized" })`).
*   **`ping?: PingOptions`**: Optional configuration for the keep-alive ping mechanism.
    *   `enabled?: boolean`: If `true`, pings are sent. Defaults vary by transport: `true` for `httpStream` and SSE, `false` for `stdio`.
    *   `intervalMs?: number`: Interval in milliseconds for sending pings (default: `5000`).
    *   `logLevel?: LoggingLevel`: Logging level for ping-related messages (default: `'debug'`). Valid levels include `'debug'`, `'info'`, `'warn'`, `'error'`.
*   **`health?: HealthCheckOptions`**: Optional configuration for the HTTP health-check endpoint (only active for `httpStream` transport).
    *   `enabled?: boolean`: Whether the health endpoint is active (default: `true`).
    *   `path?: string`: The URL path for the health check (default: `"/health"`).
    *   `message?: string`: The plain text response body (default: `"ok"`).
    *   `status?: number`: The HTTP status code to return (default: `200`).
*   **`roots?: RootsOptions`**: Optional configuration for the Roots capability.
    *   `enabled?: boolean`: Whether roots support is enabled (default: `true`). Set to `false` to disable this feature if clients don't support it or it's not needed.

### Methods

*   **`addTool(tool: Tool<T, Params>)`**: Adds a tool definition to the server.
    *   `tool`: An object defining the tool's `name`, `description`, `parameters` (using Zod or a similar Standard Schema compatible library), `execute` function, and optional `annotations` or `timeoutMs`.
*   **`addResource(resource: Resource)`**: Adds a definition for a static resource.
    *   `resource`: An object defining the resource's `uri`, `name`, `mimeType`, and `load` function.
*   **`addResourceTemplate(resourceTemplate: InputResourceTemplate<Args>)`**: Adds a definition for a resource template (a resource with dynamic URI parts).
    *   `resourceTemplate`: Defines `uriTemplate`, `name`, `arguments`, `mimeType`, and `load` function.
*   **`addPrompt(prompt: InputPrompt<Args>)`**: Adds a prompt definition.
    *   `prompt`: An object defining the prompt's `name`, `description`, `arguments`, and `load` function.
*   **`async start(options: StartOptions)`**: Starts the server.
    *   `options`: Can be one of:
        *   `{ transportType: "stdio" }`: Starts the server using standard input/output for communication. A single session is typically created.
        *   `{ transportType: "httpStream", httpStream: { port: number } }`: Starts an HTTP server listening on the specified `port`. It exposes MCP communication over `/stream` (for HTTP streaming clients) and `/sse` (for Server-Sent Events clients).
*   **`async stop()`**: Stops the server. If an HTTP server was started, it will be closed.

### Properties

*   **`sessions: FastMCPSession<T>[]` (getter)**: Returns an array of all currently active `FastMCPSession` objects.

### Events

The `FastMCP` instance is an `EventEmitter` and can emit the following events:

*   **`on("connect", (event: { session: FastMCPSession<T> }) => void)`**: Emitted when a new client successfully connects and a session is established. The `event` object contains the newly created `session`.
*   **`on("disconnect", (event: { session: FastMCPSession<T> }) => void)`**: Emitted when a client session is closed or disconnected. The `event` object contains the `session` that was disconnected.

---

## `FastMCPSession` Class

A `FastMCPSession` object represents a single active client connection to the server. It is created internally by `FastMCP` when a client connects.

### Properties

*   **`clientCapabilities: ClientCapabilities | null` (getter)**: An object describing the capabilities reported by the connected client (e.g., if it supports sampling, roots notifications). Returns `null` if capabilities haven't been determined.
*   **`loggingLevel: LoggingLevel` (getter)**: The logging level requested by the client (e.g., `'debug'`, `'info'`). Defaults to `'info'`.
*   **`roots: Root[]` (getter)**: An array of `Root` objects ( `{ name: string, uri: string }`) that the client has declared as its current workspace roots. This is updated if the client sends a `rootsChanged` notification.
*   **`server: Server` (getter)**: Provides access to the underlying `Server` instance from the `@modelcontextprotocol/sdk` that manages the low-level MCP communication for this session.

### Methods

*   **`async requestSampling(message: CreateMessageRequestSchema["params"]): Promise<SamplingResponse>`**: If the connected client supports the sampling capability, this method sends a `createMessage` request to the client. This is used to ask the client (often an LLM) to generate a response based on a series of messages, a system prompt, and other parameters.
    *   `message`: An object conforming to the `CreateMessageRequestSchema["params"]` from the MCP SDK, including `messages`, `systemPrompt`, `includeContext`, `maxTokens`, etc.
    *   Returns a `Promise<SamplingResponse>`, where `SamplingResponse` contains the `content` (text, image, or audio), `model` name used by the client, and `role`.
*   **`async close()`**: (Typically called internally) Closes the session, which includes stopping any active ping interval and closing the underlying SDK server connection for this session.
*   **`async connect(transport: Transport)`**: (Typically called internally) Connects the session using the provided transport mechanism.

### Events

The `FastMCPSession` instance is an `EventEmitter` and can emit the following events:

*   **`on("rootsChanged", (event: { roots: Root[] }) => void)`**: Emitted when the client notifies the server that its list of workspace roots has changed. The `event.roots` array contains the new list of roots.
*   **`on("error", (event: { error: Error }) => void)`**: Emitted if a session-specific error occurs. Note that many general errors might be caught by the main `FastMCP` server instance.

---
