# Project Status: Hyperfy FastMCP Server

## Current Status

- MCP server structure and initial tools (chat, ambient) are in place.
- Using **stdio** as the primary transport for MCP communication.
- The server expects the following environment variable:
  - `HYPERFY_WS_SERVER=ws://localhost:3000/ws` (URL for the Hyperfy WebSocket server)
- Biome is configured for linting and formatting.
- All original dependencies (except ElizaOS) are being added for compatibility.
- ElizaOS dependencies will be removed as the porting is finalized.

## Next Steps

- Continue porting and cleaning up action files.
- Integrate and test all required dependencies.
- Remove ElizaOS dependencies once the MCP tools are fully functional. 