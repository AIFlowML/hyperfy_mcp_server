# MCP Client Configuration Guide

## Finding Your Server Path

**Important**: Replace the example paths below with your actual installation path.

### Step 1: Find Your Project Directory

1. **Navigate to your project:**
   ```bash
   cd your-project-directory/hyperfy-fastmcp-server
   ```

2. **Get the absolute path:**
   ```bash
   pwd
   ```
   This will output something like:
   - **macOS/Linux**: `/Users/yourname/projects/hyperfy-mcp/hyperfy-fastmcp-server`
   - **Windows**: `C:\Users\yourname\projects\hyperfy-mcp\hyperfy-fastmcp-server`

3. **Your server path is:**
   ```
   [OUTPUT_FROM_PWD]/dist/index.js
   ```

### Step 2: Build the Server

Before using the server, you must build it:

```bash
# In your hyperfy-fastmcp-server directory
npm run build
```

This creates the `dist/index.js` file that MCP clients need.

### Example Paths by Operating System

- **macOS**: `/Users/yourname/projects/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js`
- **Linux**: `/home/yourname/projects/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js`
- **Windows**: `C:\Users\yourname\projects\hyperfy-mcp\hyperfy-fastmcp-server\dist\index.js`

## Quick Setup

### For Cursor IDE

Add this to your Cursor MCP configuration file:

```json
{
  "mcpServers": {
    "hyperfy-mcp-server-local": { 
      "command": "node",
      "args": [
        "YOUR_ABSOLUTE_PATH_HERE/dist/index.js"
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

**Replace `YOUR_ABSOLUTE_PATH_HERE`** with the output from `pwd` in your project directory.

### For Claude Desktop

```json
{
  "mcpServers": {
    "hyperfy": {
      "command": "node",
      "args": ["YOUR_ABSOLUTE_PATH_HERE/dist/index.js"],
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
      "args": ["YOUR_ABSOLUTE_PATH_HERE/dist/index.js"],
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
   cd YOUR_PROJECT_DIRECTORY/hyperfy-fastmcp-server
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

1. **Path not found**: 
   - Run `pwd` in your project directory to get the correct path
   - Make sure you add `/dist/index.js` to the end
   - Use forward slashes `/` even on Windows in JSON config

2. **Connection failed**: Check `HYPERFY_WS_SERVER` is correct and accessible

3. **Permission denied**: Ensure Node.js can execute the script

4. **Module not found**: Run `npm run build` to compile TypeScript

### Debug Steps

1. **Verify your path:**
   ```bash
   ls YOUR_ABSOLUTE_PATH_HERE/dist/index.js
   ```
   Should show the file exists.

2. **Test the server directly:**
   ```bash
   cd YOUR_PROJECT_DIRECTORY/hyperfy-fastmcp-server
   DEBUG=true npm start
   ```

3. Check the logs for connection issues
4. Verify Hyperfy server is running on the specified port
5. Test with minimal configuration first

### Configuration Path Examples

**Step-by-step path finding:**

1. Open terminal/command prompt
2. Navigate to your hyperfy-fastmcp-server directory
3. Run `pwd` (macOS/Linux) or `cd` (Windows)
4. Copy the output
5. Add `/dist/index.js` to the end
6. Use this complete path in your MCP configuration

**Common path patterns:**
- **Git clone in home**: `~/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js`
- **Git clone in projects**: `~/projects/hyperfy-mcp/hyperfy-fastmcp-server/dist/index.js`
- **Windows user folder**: `C:\Users\yourname\hyperfy-mcp\hyperfy-fastmcp-server\dist\index.js`

**Remember**: Always use absolute paths, not relative paths like `./dist/index.js`