# Hyperfy FastMCP Server

A Model Context Protocol (MCP) server for interacting with Hyperfy 3D virtual worlds, built with FastMCP and TypeScript.

## Features

- **Chat Communication**: Send messages in Hyperfy worlds
- **Ambient Speech**: Make environmental observations and comments
- **Physics Integration**: Support for physics interactions (coming soon)
- **LiveKit Voice**: Voice communication support (coming soon)
- **Session Management**: Per-client state management
- **Strong TypeScript**: Fully typed codebase

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Available Tools

### `hyperfy_chat`
Sends a chat message within the connected Hyperfy world.

**Parameters:**
- `message` (string): The message to send
- `channel` (optional): Chat channel ('local', 'world', 'whisper')
- `targetUserId` (optional): Target user ID for whisper messages

### `hyperfy_ambient_speech`
Makes the agent say something aloud without addressing any specific user.

**Parameters:**
- `content` (string): The ambient speech content
- `duration` (optional, number): Duration in seconds (1-30, default: 5)
- `volume` (optional, number): Volume level (0.1-1.0, default: 0.8)

## Project Structure

```
src/
├── actions/         # Original ElizaOS action files (for reference)
├── managers/        # State management logic
├── physx/           # Physics integration
├── systems/         # System integrations (LiveKit, etc.)
├── providers/       # Service providers
├── servers/         # Clean FastMCP tool implementations
├── types/           # TypeScript type definitions
├── constants.ts     # Shared constants
├── utils.ts         # Utility functions
└── server.ts        # Main server entry point
```

## Development

This server is a port from an ElizaOS plugin to a standalone FastMCP server. The original ElizaOS files are preserved in their respective directories for reference, while the clean FastMCP implementations are in the `servers/` directory.

### Adding New Tools

1. Create a new tool file in `src/servers/`
2. Define the tool with Zod schema for parameters
3. Implement the execute function with proper typing
4. Register the tool in `src/server.ts`

### Environment Variables

Create a `.env` file for sensitive configuration:

```
LIVEKIT_WS_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
HYPERFY_API_KEY=your-hyperfy-api-key
```

## Contributing

1. Follow the existing TypeScript patterns
2. Maintain strong typing throughout
3. Use FastMCP logging (`context.log`) for all output
4. Update types in `src/types/index.ts` as needed

## License

MIT 

## Server Transport & Environment

- **Transport:** This server uses `stdio` as the primary communication mechanism for MCP clients.
- **Environment Variable:**
  - `HYPERFY_WS_SERVER=ws://localhost:3000/ws` (URL for the Hyperfy WebSocket server) 