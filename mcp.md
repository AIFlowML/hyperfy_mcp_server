# MCP Client Configuration Guide

## Quick Setup

### For Cursor IDE

Add this to your Cursor MCP configuration file:

```json
{
  "mcpServers": {
    "hyperfy-mcp-server-local": { 
      "command": "node",
      "args": [
        "/Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js"
      ],
      "env": {
        "HYPERFY_WS_SERVER": "ws://localhost:3000/ws",
        "PORT": "3069",
        "DEBUG": "true",
        "NODE_ENV": "production",
        "MCP_DISABLE_PINGS": "true"
      }
    }
  }
}
```

### For Claude Desktop

```json
{
  "mcpServers": {
    "hyperfy": {
      "command": "node",
      "args": ["/Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js"],
      "env": {
        "HYPERFY_WS_SERVER": "ws://localhost:3000/ws",
        "DEBUG": "false"
      }
    }
  }
}
```

### For Continue.dev

```json
{
  "models": [],
  "tools": [
    {
      "type": "mcp",
      "serverName": "hyperfy",
      "command": "node",
      "args": ["/Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js"],
      "env": {
        "HYPERFY_WS_SERVER": "ws://localhost:3000/ws"
      }
    }
  ]
}
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HYPERFY_WS_SERVER` | Hyperfy WebSocket server URL | `ws://localhost:3000/ws` | Yes |
| `PORT` | HTTP health check port | `3069` | No |
| `DEBUG` | Enable debug logging | `false` | No |
| `NODE_ENV` | Node environment | `development` | No |
| `MCP_DISABLE_PINGS` | Disable MCP ping/pong | `false` | No |

## Testing the Connection

1. **Build the server first:**
   ```bash
   cd /Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server
   npm run build
   ```

2. **Test manual connection:**
   ```bash
   node dist/index.js
   ```

3. **Test with environment:**
   ```bash
   HYPERFY_WS_SERVER=ws://localhost:3000/ws DEBUG=true node dist/index.js
   ```

4. **Health check:**
   ```bash
   curl http://localhost:3069/health
   ```

## Available Tools

- `hyperfy_chat` - Send chat messages
- `hyperfy_ambient` - Generate ambient speech
- `hyperfy_goto` - Navigate to locations
- `hyperfy_use` - Interact with objects
- `hyperfy_stop` - Stop current actions
- `hyperfy_unuse` - Release interactions
- `hyperfy_walk_randomly` - Random movement
- `hyperfy_get_emote_list` - List available emotes
- `hyperfy_get_world_state` - Get world information

## Troubleshooting

### Common Issues

1. **Path not found**: Update the `args` path to match your actual installation
2. **Connection failed**: Check `HYPERFY_WS_SERVER` is correct and accessible
3. **Permission denied**: Ensure Node.js can execute the script
4. **Module not found**: Run `npm run build` to compile TypeScript

### Debug Steps

1. Test the server directly:
   ```bash
   cd /Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server
   DEBUG=true npm start
   ```

2. Check the logs for connection issues
3. Verify Hyperfy server is running on the specified port
4. Test with minimal configuration first

### Configuration Paths

**Update these paths to match your installation:**

- Replace `/Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js`
- With your actual path to the compiled server

**Find your path:**
```bash
pwd  # Run this in the hyperfy-fastmcp-server directory
# Then append /dist/index.js to the output
```