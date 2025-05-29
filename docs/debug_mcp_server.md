# FastMCP Server Debug Strategy

**Generated**: 2025-01-27
**Issue**: FastMCP session authentication data not accessible, world/user showing as "undefined"
**Status**: 🔍 **DEBUGGING IN PROGRESS**

## 🚨 Current Issues

### 1. **FastMCP Warning**: `could not infer client capabilities`
- FastMCP cannot determine what the client supports
- Suggests incomplete MCP handshake/initialization

### 2. **Session Data Missing**: `world: undefined, user: undefined`
- Our `authenticate()` function returns `McpSessionData` with `worldId` and `userId`
- But the session event shows `hasWorldId: false, hasUserId: false`
- Session properties: `['_events', '_eventsCount', '_maxListeners']` - looks like EventEmitter, not our data

### 3. **Session Structure Mismatch**
```typescript
// Expected (our McpSessionData):
{ worldId: string, userId: string, hyperfyService: HyperfyService, ... }

// Actual (FastMCPSession):
{ _events: {}, _eventsCount: 0, _maxListeners: undefined, server: Server }
```

## 🔍 Debug Strategy

### Phase 1: FastMCP Source Code Analysis
**Goal**: Understand how FastMCP handles authentication data flow

#### 1.1 Examine FastMCP Authentication Flow
- [ ] Check `/Users/ilessio/dev-agents/PROJECTS/hyperfy-mcp/old_code/fastmcp/src` structure
- [ ] Find how `authenticate()` result is stored in session
- [ ] Understand `FastMCPSession<T>` generic type usage
- [ ] Locate where session data should be accessible

#### 1.2 Compare with FastMCP Examples  
- [ ] Look for authentication examples in FastMCP repo
- [ ] Check if we need different session access patterns
- [ ] Verify if `context.session` vs `event.session` are different

### Phase 2: Authentication Flow Debugging

#### 2.1 Add Authentication Debug Logging
```typescript
authenticate: async () => {
  console.log('[AUTH-DEBUG] authenticate() called');
  const sessionData = await initializeHyperfySession();
  console.log('[AUTH-DEBUG] returning session data:', {
    worldId: sessionData.worldId,
    userId: sessionData.userId,
    type: typeof sessionData,
    keys: Object.keys(sessionData)
  });
  return sessionData;
}
```

#### 2.2 Debug Tool Context Creation
```typescript
function createToolContext(context: { log: unknown; session?: unknown }) {
  console.log('[TOOL-DEBUG] createToolContext called with:', {
    hasLog: !!context.log,
    hasSession: !!context.session,
    sessionType: typeof context.session,
    sessionKeys: context.session ? Object.keys(context.session) : null
  });
  // ... rest of function
}
```

#### 2.3 Create Debug Tool
Add a simple debug tool to test session access:
```typescript
server.addTool({
  name: 'debug_session',
  description: 'Debug session data access',
  parameters: z.object({}),
  execute: async (args, context) => {
    console.log('[DEBUG-TOOL] Session debug:', {
      hasContext: !!context,
      hasSession: !!context.session,
      sessionType: typeof context.session,
      sessionKeys: context.session ? Object.keys(context.session) : null,
      sessionValue: context.session
    });
    return JSON.stringify({
      contextKeys: Object.keys(context),
      sessionExists: !!context.session,
      sessionData: context.session
    }, null, 2);
  }
});
```

### Phase 3: ElizaOS Comparison

#### 3.1 Analyze Original Plugin Session Handling
- [ ] Check how ElizaOS plugin initializes world/user
- [ ] Compare session data structures
- [ ] Find differences in authentication patterns

#### 3.2 User/World ID Generation Pattern
From original plugin analysis:
```typescript
// Original ElizaOS pattern:
const worldId = createUniqueUuid(runtime, runtime.agentId);
const userId = runtime.agentId; // Direct usage
```

**Our current pattern**:
```typescript
const worldId = generateUUID({} as FastMCPRuntime, `${runtime.agentId}-default-hyperfy`);
const userId = generateUUID({} as FastMCPRuntime, `mcp-user-${baseAgentId}`);
```

### Phase 4: FastMCP Transport & Client Investigation

#### 4.1 Client Capabilities Warning
The `could not infer client capabilities` suggests:
- Client not properly sending initialization
- Transport issue (stdio vs httpStream)
- Missing client handshake

#### 4.2 Test with Different Clients
- [ ] Test with `mcp-cli` directly
- [ ] Test with FastMCP's built-in inspector
- [ ] Test with Cursor's MCP client

## 📊 FastMCP Documentation Summary

Based on `/hyperfy-fastmcp-server/docs/fastmcp.md`:

### Authentication Flow (Expected)
1. Client connects to FastMCP server
2. Server calls `authenticate()` function
3. Returns authentication object of type `T`
4. Tools receive `context.session` with type `T`

### Session Access Pattern (Expected)
```typescript
// In tools:
execute: async (args, context) => {
  // context.session should be our McpSessionData directly
  const sessionData = context.session as McpSessionData;
  console.log(sessionData.worldId, sessionData.userId);
}
```

### Current Problem Hypothesis
1. **Authentication not being called**: FastMCP might not be calling our `authenticate()` function
2. **Session storage issue**: FastMCP stores auth data differently than expected
3. **Transport issue**: stdio transport might handle sessions differently
4. **Type mismatch**: `FastMCPSession<T>` vs our expected `T` directly

## 🔧 Immediate Debug Actions

### 1. Add Console Logging Throughout
```bash
# Add to authenticate(), createToolContext(), and event handlers
console.log('[DEBUG] ...')
```

### 2. Test Session Access in Tools
Create a minimal test tool that logs everything about the session

### 3. FastMCP Source Code Investigation
Look at actual FastMCP implementation to understand:
- Where authentication data is stored
- How `context.session` is populated
- Why `event.session` might be different

### 4. Compare with Working FastMCP Examples
Find a working authentication example and compare patterns

## 📋 Next Steps

1. **Investigate FastMCP source code** in `/old_code/fastmcp/src`
2. **Add comprehensive debug logging** to all session touch points
3. **Create debug tool** to test session access patterns
4. **Test with FastMCP CLI tools** to isolate client vs server issues
5. **Compare with ElizaOS plugin** session initialization patterns

## 🎯 Success Criteria

✅ `authenticate()` function gets called and logged
✅ Session data accessible in `createToolContext()`
✅ Event handlers show correct `worldId` and `userId`
✅ Debug tool can access and display session data
✅ Client capabilities warning resolved

---

**Priority**: 🔥 **HIGH** - Core functionality blocked until session data accessible 