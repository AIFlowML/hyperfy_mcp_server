# Providers Porting Guide: ElizaOS to FastMCP

This guide documents the analysis and porting process for provider classes from ElizaOS dependencies to standalone FastMCP implementation.

## Table of Contents
- [Overview](#overview)
- [Provider Analysis](#provider-analysis)
- [Usage Patterns](#usage-patterns)
- [ElizaOS vs FastMCP Architecture](#elizaos-vs-fastmcp-architecture)
- [Porting Strategy](#porting-strategy)
- [Implementation Plan](#implementation-plan)

---

## Overview

**Current State**: Two providers exist that depend on ElizaOS core imports and runtime functionality:
1. `hyperfyProvider` (world.ts) - Complex world state provider
2. `hyperfyEmoteProvider` (emote.ts) - Simple emote listing provider

**Challenge**: ElizaOS providers use a `runtime.composeState()` system that doesn't exist in FastMCP. In FastMCP, we'll need to replace this with direct data access through our tools.

**Key Insight**: Providers in ElizaOS serve as **context providers for AI models**, giving agents awareness of world state. In FastMCP, this functionality should be integrated into our **tool system** rather than maintained as separate providers.

---

## Provider Analysis

### ✅ **hyperfyEmoteProvider (Simple)**
**File**: `src/providers/emote.ts`
**Purpose**: Lists available emotes with descriptions
**Complexity**: Very Low
**Dependencies**: 
- `@elizaos/core` imports: `Provider`, `IAgentRuntime`, `Memory`
- `EMOTES_LIST` from constants

**Current Implementation**:
```typescript
export const hyperfyEmoteProvider: Provider = {
    name: 'HYPERFY_EMOTE_LIST',
    description: 'Lists all available emotes and their descriptions',
    get: async (_runtime: IAgentRuntime, _message: Memory) => {
      const emoteListText = EMOTES_LIST.map(
        (e) => `- **${e.name}**: ${e.description}`
      ).join('\n');
  
      return {
        data: { emotes: EMOTES_LIST },
        values: { emoteListText },
        text: `\\n\\n# Available Emotes\\n\\n${emoteListText}\\n\\n`,
      };
    },
};
```

**Analysis**: 
- ✅ **Zero runtime dependencies** - doesn't access HyperfyService
- ✅ **Static data only** - just formats the EMOTES_LIST constant
- ✅ **Simple transformation** - maps emote objects to markdown text
- ❌ **Currently commented out** in index.ts (not actively used)

**Porting Approach**: **Convert to utility function** - this doesn't need to be a provider

---

### 🔴 **hyperfyProvider (Complex)**
**File**: `src/providers/world.ts`  
**Purpose**: Provides real-time world state context to AI
**Complexity**: Very High
**Dependencies**:
- `@elizaos/core` imports: `IAgentRuntime`, `Memory`, `Provider`, `ProviderResult`, `logger`, `createUniqueUuid`
- `HyperfyService` for world access
- `THREE.Vector3` for 3D math
- `Vector3Enhanced` from Hyperfy core
- `EMOTES_LIST` from constants

**Core Functionality**:
1. **Connection Status**: Checks if HyperfyService is connected
2. **Agent State**: Gets agent's entity ID, name, position
3. **Entity Enumeration**: Lists all entities in the world with positions/types
4. **Action System**: Lists nearby interactable objects (50m radius)
5. **Equipment State**: Shows currently equipped items/actions
6. **Chat History**: Gets recent messages via MessageManager
7. **Available Emotes**: Lists animation options

**Usage Patterns**:
- Used in **Actions**: `runtime.composeState(message, ['HYPERFY_WORLD_STATE', 'RECENT_MESSAGES'], true)`
- Used in **BehaviorManager**: `runtime.composeState(newMessage)` (includes all providers)
- Used in **ElizaOS AI Pipeline**: Provides context for decision making

**Critical Dependencies**:
```typescript
const service = runtime.getService<HyperfyService>(HyperfyService.serviceType);
const world = service.getWorld();
const messageManager = service.getMessageManager();
const elizaRoomId = createUniqueUuid(runtime, _currentWorldId || 'hyperfy-unknown-world');
const chatHistory = await messageManager.getRecentMessages(elizaRoomId);
```

---

## Usage Patterns

### 1. **ElizaOS Actions** 
```typescript
// In actions/use.ts
const useState = await runtime.composeState(message, ['HYPERFY_WORLD_STATE', 'RECENT_MESSAGES'], true);
```
This creates an AI context that includes world state for decision making.

### 2. **BehaviorManager Autonomous Behavior**
```typescript  
// In managers/behavior-manager.ts
const state = await runtime.composeState(newMessage);
```
The autonomous behavior system uses providers to understand the current world context.

### 3. **AI Model Context**
ElizaOS templates reference provider data:
```typescript
const prompt = composePromptFromState(state, template);
// state.text contains formatted provider output
// state.values contains structured data
// state.data contains raw objects
```

---

## ElizaOS vs FastMCP Architecture

### **ElizaOS Provider System**
```typescript
// ElizaOS Flow
runtime.composeState(message, ['HYPERFY_WORLD_STATE']) 
  → Calls providers 
  → Aggregates text/data/values 
  → Passes to AI model as context
```

**Key Features**:
- **Lazy evaluation**: Providers called only when needed
- **Caching**: Results cached during conversation
- **Composition**: Multiple providers combined into single context
- **AI Integration**: Direct integration with LLM prompting

### **FastMCP Tool System**
```typescript
// FastMCP Flow  
MCP Tool Call → Direct function execution → Structured response
```

**Key Features**:
- **Direct execution**: Tools called explicitly by AI/user
- **Structured responses**: JSON schema validation
- **No caching**: Each call is independent
- **Explicit requests**: AI must specifically request data

---

## Porting Strategy

### **Approach 1: Convert Providers to MCP Tools** ✅ **RECOMMENDED**

**Rationale**: FastMCP's architecture is tool-based, not provider-based. Converting providers to tools aligns with the MCP paradigm.

**Benefits**:
- ✅ **Native FastMCP integration**
- ✅ **Better performance** (no unused data generation)
- ✅ **Explicit AI requests** (AI asks for specific data)
- ✅ **Structured responses** (JSON schema validation)
- ✅ **Tool reusability** (can be called independently)

**Implementation**:
1. **World State Tool**: Replace `hyperfyProvider` with `getWorldStateTool`
2. **Emotes Tool**: Replace `hyperfyEmoteProvider` with `getEmoteListTool` 
3. **Template Updates**: Update AI templates to use tools instead of providers

### **Approach 2: Provider Compatibility Layer** ❌ **NOT RECOMMENDED**

**Rationale**: Would require recreating ElizaOS's `composeState` system in FastMCP.

**Drawbacks**:
- ❌ **Complex implementation** (recreate ElizaOS architecture)
- ❌ **Performance overhead** (generate unused data)
- ❌ **Maintenance burden** (maintain compatibility layer)
- ❌ **Against FastMCP design** (tools are the correct abstraction)

---

## Implementation Plan

### **Phase 1: Emote Provider → Tool** ✅ **COMPLETED**
**Timeline**: 30 minutes ✅
**Status**: Successfully converted `hyperfyEmoteProvider` to `getEmoteListTool`

**Completed Steps**:
1. ✅ Created `getEmoteListTool` in `src/servers/actions/getEmoteListTool.ts`
2. ✅ Removed ElizaOS dependencies (Provider, IAgentRuntime, Memory)
3. ✅ Implemented structured JSON response with format options ('structured', 'text', 'both')
4. ✅ Registered tool in `src/servers/server.ts`
5. ✅ Updated server instructions to include new tool

**Key Improvements Over Original Provider**:
- ✅ **Format flexibility**: Users can choose structured data, formatted text, or both
- ✅ **Enhanced descriptions**: Comprehensive tool documentation with usage examples
- ✅ **Error handling**: Graceful error responses with proper logging
- ✅ **Session integration**: Works seamlessly with FastMCP session system
- ✅ **Category metadata**: Added emote categorization for better organization

**Tool Output**:
```typescript
{
  name: "hyperfy_get_emote_list",
  description: "Retrieves complete list of available emotes and animations",
  parameters: { format?: 'structured' | 'text' | 'both' },
  // Returns: { emotes: EmoteInfo[], formatted_text: string, total_count: number, categories: string[] }
}
```

**Result**: ElizaOS provider successfully replaced with FastMCP tool providing enhanced functionality

### **Phase 2: World Provider → Tool** ✅ **COMPLETED**
**Timeline**: 2-3 hours ✅
**Status**: Successfully converted `hyperfyProvider` to `getWorldStateTool`

**Completed Steps**:
1. ✅ Created `getWorldStateTool` in `src/servers/actions/getWorldStateTool.ts`
2. ✅ Replaced ElizaOS dependencies with FastMCP session data access
3. ✅ Replaced `createUniqueUuid` with FastMCP `generateUUID`
4. ✅ Replaced `logger` with `console` logging
5. ✅ Fixed THREE.js and Vector3Enhanced typing with generic object checking
6. ✅ Added comprehensive error handling and disconnection status
7. ✅ Structured response as JSON schema with format options
8. ✅ Registered tool in `src/servers/server.ts`
9. ✅ Updated server instructions to include new tool

**Key Improvements Over Original Provider**:
- ✅ **Flexible response format**: Users can choose structured data, formatted text, or both
- ✅ **Configurable options**: Optional chat inclusion, emotes list, action radius
- ✅ **Enhanced error handling**: Graceful degradation when disconnected or services unavailable
- ✅ **Better type safety**: Proper TypeScript types for all data structures
- ✅ **Performance optimization**: Only fetches requested data (chat, emotes) when needed
- ✅ **Comprehensive logging**: Detailed operation tracking for debugging

**Preserved Core Functionality**:
- ✅ **Connection Status**: Checks if HyperfyService is connected
- ✅ **Agent State**: Gets agent's entity ID, name, position
- ✅ **Entity Enumeration**: Lists all entities in the world with positions/types
- ✅ **Action System**: Lists nearby interactable objects (configurable radius)
- ✅ **Equipment State**: Shows currently equipped items/actions
- ✅ **Chat History**: Gets recent messages via MessageManager
- ✅ **Available Emotes**: Lists animation options

**Tool Output**:
```typescript
{
  name: "hyperfy_get_world_state",
  description: "Retrieves comprehensive world state information",
  parameters: { 
    includeChat?: boolean,
    includeEmotes?: boolean, 
    actionRadius?: number,
    format?: 'structured' | 'text' | 'both'
  },
  // Returns: Complete world state with entities, actions, agent info, chat, emotes
}
```

**Technical Achievements**:
- ✅ **Type-safe vector handling**: Generic position object checking without THREE.js import issues
- ✅ **ElizaOS compatibility**: Preserved message manager integration and room ID generation
- ✅ **FastMCP integration**: Native session data access and tool registration
- ✅ **Performance optimization**: Configurable data inclusion prevents unnecessary processing

**Result**: ElizaOS provider successfully replaced with FastMCP tool providing enhanced functionality and better integration with the MCP architecture. The tool now serves as the primary context provider for AI decision making in autonomous behavior scenarios.

### **Phase 3: Template Integration** (AI Context)
**Timeline**: 1-2 hours  
**Approach**: Update AI templates to use tools instead of providers

**Templates to Update**:
- `autoTemplate` (BehaviorManager)
- `messageHandlerTemplate` (MessageManager) 
- Action templates that reference world state

**Changes**:
- Replace provider references with tool calls
- Update prompt structure to work with tool responses
- Test AI behavior with new tool-based context

### **Phase 4: Cleanup** (Remove Provider System)
**Timeline**: 30 minutes
**Approach**: Remove provider infrastructure

**Steps**:
1. Remove provider imports from index.ts
2. Delete provider files
3. Remove provider-related types from centralized types
4. Update documentation

---

## Critical Considerations

### **1. AI Behavior Changes**
**Issue**: Converting from providers to tools changes when AI gets world context.
- **ElizaOS**: AI always has world context (automatic)
- **FastMCP**: AI must explicitly request world context (manual)

**Solution**: Update AI templates to proactively request world state when needed.

### **2. Performance Impact**
**Issue**: Tools are called individually vs. providers called in batch.
**Mitigation**: Design tools to be efficient and cache results when appropriate.

### **3. Chat History Integration**
**Issue**: World provider currently uses MessageManager's `getRecentMessages()`.
**Solution**: Create dedicated `getChatHistoryTool` or integrate into world state tool.

### **4. TypeScript Complexity**
**Issue**: THREE.js and Vector3Enhanced imports cause linting errors.
**Solution**: Add proper type declarations or use `@ts-ignore` with comments.

---

## Next Steps

1. **Start with Emote Provider**: Simple conversion to establish patterns
2. **Create World State Tool**: Complex conversion preserving all functionality  
3. **Update Templates**: Ensure AI can access world context through tools
4. **Test Integration**: Verify autonomous behavior still works
5. **Clean Up**: Remove unused provider infrastructure

**Priority**: World state tool is critical for autonomous agent behavior and should be prioritized.
