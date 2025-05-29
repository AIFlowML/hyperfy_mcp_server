MCP install in cursor to test. 


    "hyperfy-mcp-server-local": { 
      "command": "node",
      "args": [
        "/Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/hyperfy-fastmcp-server/src/index.js"
      ],
      "env": {
        "HYPERFY_WS_SERVER": "ws://localhost:3000/ws",
        "PORT": "3069",
        "DEBUG": "true",
        "NODE_ENV": "production",
        "MCP_DISABLE_PINGS": "true"
      }
    },