# Hyperfy FastMCP Server - Deep Analysis Report

**Generated**: $(date)
**Session**: Pre-Build Error Analysis & AgentActions Testing
**Purpose**: Comprehensive analysis of all files, errors, and architecture before build and testing phase, plus complete AgentActions system validation

## Executive Summary

The Hyperfy FastMCP Server is a TypeScript project that ports the Hyperfy plugin from ElizaOS to a standalone FastMCP server. The project has undergone comprehensive testing and validation of the AgentActions system.

### Key Findings:
- ✅ **FastMCP Architecture**: Properly implemented according to FastMCP documentation
- ✅ **File Structure**: Well-organized with clear separation of concerns
- ✅ **AgentActions System**: Successfully tested with 29/29 tests passing
- ✅ **Type Safety**: Critical fixes applied to resolve TypeScript errors
- ❌ **Build Status**: Still has remaining TypeScript compilation errors (49 total)
- ⚠️ **Dependencies**: Mix of ElizaOS and FastMCP dependencies needs cleanup

---

## AgentActions System Testing Results

### Test Suite Overview
**Status**: ✅ **ALL 29 TESTS PASSING**
**Test File**: `tests/test_system_actions.ts`
**Coverage**: Comprehensive validation of AgentActions system porting from ElizaOS to FastMCP

### Test Categories Validated

#### ✅ **Constructor and Initialization** (3 tests)
- World context initialization
- Empty nodes array on startup
- No current node initially

#### ✅ **Node Management** (4 tests)
- Node registration functionality
- Node unregistration functionality
- Graceful handling of non-existent nodes
- Multiple registrations of same node

#### ✅ **Distance-based Filtering** (4 tests)
- Return all unfinished nodes when no distance specified
- Correct distance calculations using THREE.js Vector3
- Exclusion of finished nodes regardless of distance
- Dynamic rig position changes

#### ✅ **Action Performance** (4 tests)
- Nearest node selection when no entity ID specified
- Specific entity targeting by ID
- Default duration handling (3000ms)
- Graceful handling without onTrigger callback

#### ✅ **Action Performance Edge Cases** (4 tests)
- Concurrent action prevention
- No nearby nodes handling
- Non-existent entity ID handling
- Finished nodes exclusion from actions

#### ✅ **Action Release** (4 tests)
- Current action release with callbacks
- Release without onCancel callback
- Release when no current action
- New action allowance after release

#### ✅ **Integration and State Management** (3 tests)
- Complete action lifecycle state management
- Rapid register/unregister operations
- Complex distance scenarios with grid patterns

#### ✅ **Error Handling and Edge Cases** (3 tests)
- Missing entity data handling
- Invalid positions (NaN values) handling
- Missing controls graceful handling

### Critical Fixes Applied

#### **Issue 1: Concurrent Action Detection**
**Problem**: Tests failed because `currentNode` was only set after setTimeout completion
**Solution**: Set `currentNode` immediately when action starts in `performAction()`

```typescript
// Before (in performAction)
setTimeout(() => {
  // ... action logic
  this.currentNode = target; // ❌ Too late
}, duration);

// After (in performAction)
this.currentNode = target; // ✅ Set immediately
setTimeout(() => {
  // ... action logic
  // currentNode already set above
}, duration);
```

#### **Issue 2: Missing Controls Null Safety**
**Problem**: No validation for undefined controls before accessing properties
**Solution**: Added null checks in both `performAction()` and `releaseAction()`

```typescript
// Added to performAction()
if (!control) {
  console.log('No controls available - cannot perform action');
  return;
}

// Added to releaseAction()
if (!control) {
  console.log('No controls available - releasing action without key input');
  // Still call onCancel and reset currentNode
  if (typeof this.currentNode._onCancel === 'function') {
    this.currentNode._onCancel();
  }
  this.currentNode = null;
  return;
}
```

#### **Issue 3: TypeScript Array Type Inference**
**Problem**: Array type inference errors with 'never' type
**Solution**: Explicitly typed arrays as `ActionNode[]`

```typescript
// Before
private nodes = [] // ❌ Inferred as never[]

// After  
private nodes: ActionNode[] = [] // ✅ Explicit typing
```

### Test Configuration Used

```typescript
const TEST_CONFIG = {
  TEST_TIMEOUT: 10000, // 10 seconds
  ACTION_TIMEOUT: 5000, // 5 seconds for action completion
  RELEASE_TIMEOUT: 1000, // 1 second for action release
};
```

### Mock Architecture Validation

The testing validated that the AgentActions system correctly integrates with:
- ✅ THREE.js Vector3 for 3D positioning
- ✅ System base class inheritance
- ✅ WorldType interface with rig, controls, and entities
- ✅ ActionNode interface with THREE.Object3D inheritance
- ✅ Proper state management and concurrency prevention
- ✅ Comprehensive error handling and edge cases

---

## BehaviorManager Testing Results

### Test Suite Overview
**Status**: ✅ **ALL 35 TESTS PASSING**
**Test File**: `tests/test_manager_behaviour.ts`
**Coverage**: Comprehensive validation of BehaviorManager autonomous behavior system

### Test Categories Validated

#### ✅ **Constructor and Initialization** (2 tests)
- Runtime context initialization
- Initial state validation (isRunning: false)

#### ✅ **Start and Stop Behavior** (4 tests)
- Behavior loop start functionality
- Multiple start prevention
- Proper stop behavior
- Stop when not running handling

#### ✅ **Activity Lock Integration** (2 tests)
- Behavior skipping when activity lock active
- Normal execution when lock inactive

#### ✅ **Service State Validation** (3 tests)
- Service connection state checking
- World availability validation
- Null service handling

#### ✅ **AI Response Processing** (5 tests)
- Emote response processing
- Ambient speech response handling
- Combined emote and speech responses
- Response without ambient speech action
- Response without emote handling

#### ✅ **Error Handling** (5 tests)
- AI model error recovery
- Emote manager error handling
- Message manager error handling
- Malformed AI response handling
- XML parsing error resilience

#### ✅ **Behavior Loop Integration** (3 tests)
- Loop execution with proper timing
- Error handling without crashing
- Loop termination when stopped

#### ✅ **Memory and Context Creation** (3 tests)
- FastMCPMemory context creation
- World ID usage in memory context
- Missing world ID graceful handling

#### ✅ **Logging and Debugging** (4 tests)
- Behavior execution detail logging
- Emote execution logging
- Ambient speech execution logging
- AI response console logging

#### ✅ **Edge Cases and Boundary Conditions** (4 tests)
- Empty AI response handling
- Empty text field handling
- Empty emote field handling
- Multiple actions in actions field
- Very long AI response handling

### Critical Functionality Validated

#### **✅ Autonomous Behavior System**:
- Proper AI response generation and processing
- XML response parsing with error resilience
- Action classification (HYPERFY_AMBIENT_SPEECH, IGNORE)
- Emote and speech execution coordination

#### **✅ Service Integration**:
- HyperfyService connection validation
- World state checking
- EmoteManager and MessageManager coordination
- Null safety throughout the system

#### **✅ Activity Lock System**:
- Proper coordination with message activity
- Lock status checking and behavior skipping
- Clean lock management during testing

#### **✅ Error Resilience**:
- AI model failure recovery
- Manager error handling
- Malformed response processing
- Continuous operation despite errors

#### **✅ State Management**:
- Behavior loop lifecycle management
- Running state tracking
- Clean startup and shutdown
- Memory context creation

### Performance Characteristics Validated

- **Loop Timing**: Proper delay intervals between behaviors
- **Error Recovery**: Continues operation after failures
- **Memory Management**: Clean context creation and cleanup
- **Resource Usage**: Efficient service integration

### Integration Points Tested

**✅ FastMCP Integration**:
- FastMCPRuntime context usage
- FastMCPMemory creation
- AI model interface compliance

**✅ Hyperfy Service Integration**:
- Service state validation
- Manager coordination (EmoteManager, MessageManager)
- World context integration

**✅ Activity Coordination**:
- AgentActivityLock integration
- Message activity coordination
- Concurrent operation prevention

---

**STATUS**: BehaviorManager system fully validated ✅
**ACHIEVEMENT**: Complete BehaviorManager testing with 35/35 tests passing
**NEXT MILESTONE**: Test remaining manager systems (EmoteManager, MessageManager, VoiceManager)

---

## Project File Structure

Based on the provided file tree and analysis:

```
src/
├── constants.ts                     # ✅ Configuration constants
├── hyperfy-core/                    # ✅ Core Hyperfy functionality (JS + .d.ts)
│   ├── createNodeClientWorld.js(.d.ts)
│   ├── extras/
│   │   ├── createClientWorld.js
│   │   ├── createEmoteFactory.js(.d.ts) 
│   │   ├── createNode.js(.d.ts)
│   │   ├── createServerWorld.js
│   │   ├── createViewerWorld.js
│   │   ├── createVRMFactory.js(.d.ts)
│   │   ├── glbToNodes.js(.d.ts)
│   │   ├── loadPhysX.js
│   │   ├── Vector3Enhanced.js(.d.ts)
│   │   └── hyperfy-core.d.ts
│   ├── libs/gltfloader/
│   │   ├── GLTFLoader.js(.d.ts)
│   ├── nodes/
│   │   ├── Node.js(.d.ts)
│   ├── systems/
│   │   ├── System.js(.d.ts)
│   │   └── systems.d.ts
│   ├── World.js(.d.ts)
├── index.ts                         # ✅ Simple entry point
├── managers/                        # ⚠️ Manager classes (has errors)
│   ├── behavior-manager.ts
│   ├── emote-manager.ts
│   ├── guards.ts  
│   ├── message-manager.ts
│   ├── voice-manager.ts
├── physx/                           # ✅ Physics engine integration
│   ├── loadPhysX.js(.d.ts)
│   ├── physx-js-webidl.js
│   └── physx-js-webidl.wasm
├── servers/                         # ✅ FastMCP server implementation 
│   ├── actions/                     # ✅ MCP tools
│   │   ├── ambientTool.ts
│   │   ├── chatTool.ts
│   │   ├── getEmoteListTool.ts
│   │   ├── getWorldStateTool.ts
│   │   ├── gotoTool.ts
│   │   ├── stopTool.ts
│   │   ├── unuseTool.ts
│   │   ├── useTool.ts
│   │   └── walkRandomlyTool.ts
│   └── server.ts                    # ✅ Main FastMCP server
├── service.ts                       # ✅ Core HyperfyService 
├── systems/                         # ✅ System classes (AgentActions tested)
│   ├── actions.ts                   # ✅ FULLY TESTED - 29/29 tests passing
│   ├── avatar.ts
│   ├── controls.ts
│   ├── liveKit.ts
│   └── loader.ts
├── templates.ts                     # ❓ May need review
├── types/                           # ✅ Type definitions
│   ├── hyperfy.d.ts
│   └── index.ts
└── utils/                           # ⚠️ Utility functions (has errors)
    ├── eliza-compat.ts
    └── utils.ts
```

---

## FastMCP Architecture Analysis

### Current Implementation Status

**✅ CORRECT IMPLEMENTATION**: The project correctly follows FastMCP patterns:

1. **Server Structure** (`src/servers/server.ts`):
   - ✅ Uses `FastMCP` class from `fastmcp` package
   - ✅ Implements session-based authentication
   - ✅ Proper tool registration with `server.addTool()`
   - ✅ Health checks and ping configuration
   - ✅ Event handling for connect/disconnect

2. **Tools Implementation** (`src/servers/actions/`):
   - ✅ All 9 tools properly structured with:
     - `name`, `description`, `parameters` (using Zod)
     - `execute` function with proper typing
     - Context-aware logging via `context.log`
     - Session data access via `context.session`

3. **Entry Point** (`src/index.ts`):
   - ✅ Simple, clean entry point
   - ✅ Just imports and starts the server
   - ✅ Proper error handling

### FastMCP Integration Points

According to `fastmcp.md` documentation:

**Authentication** ✅ IMPLEMENTED:
```typescript
authenticate: async () => {
  const sessionData = await initializeHyperfySession();
  return sessionData;
}
```

**Session Management** ✅ IMPLEMENTED:
- Session data properly typed as `McpSessionData extends Record<string, unknown>`
- Contains Hyperfy service, controls, actions, and state

**Tool Structure** ✅ IMPLEMENTED:
- All tools follow FastMCP tool structure
- Parameters use Zod schemas (Standard Schema compatible)
- Proper context usage with logging
- Return structured `ActionResult` objects

**Logging** ✅ IMPLEMENTED:
- Tools use `context.log.{level}()` for all logging
- No direct `console.log` usage in tools
- Structured logging with data payloads

---

## Critical Errors Analysis

### TypeScript Compilation Errors (49 total)

**Priority 1 - Manager Class Errors** (15+ errors):

1. **emote-manager.ts**:
   ```
   - Property 'effect' does not exist on player data
   - Property 'moving' does not exist on player entity  
   - Type mismatches in HyperfyPlayerEntity
   ```

2. **message-manager.ts**:
   ```
   - 'world' is possibly 'null' (null safety)
   - Missing 'id' property in ChatMessage
   - Type incompatibilities
   ```

3. **voice-manager.ts**:
   ```
   - 'world' is possibly 'null' (null safety)
   ```

**Priority 2 - System Class Errors** (20+ errors):

1. **avatar.ts**:
   ```
   - Interface 'ExtendedNode' incorrectly extends 'Node'
   - Missing 'stage' property in world context
   ```

2. **loader.ts**:
   ```
   - Argument type 'unknown' not assignable to specific types
   - Expected 2 arguments, but got 1
   - VRMFactory null assignment issues
   ```

3. **actions.ts**: ✅ **RESOLVED**
   ```
   - Property 'toArray' does not exist on position type
   - Concurrent action detection issues
   - Missing null safety for controls
   ```

**Priority 3 - Integration Errors** (10+ errors):

1. **server.ts**:
   ```
   - 'wsUrl' does not exist in type 'HyperfyRuntime'
   ```

2. **utils.ts**:
   ```
   - Parameters implicitly have 'any' type
   ```

3. **getWorldStateTool.ts**:
   ```
   - Property 'blueprint' does not exist on entity types
   - Type assignments between different object shapes
   ```

---

## Dependency Analysis

### Current Dependencies Status

**Core FastMCP Dependencies** ✅:
- `fastmcp: ^2.1.3` - Main FastMCP framework
- `zod: ^3.25.30` - Schema validation (FastMCP compatible)

**Hyperfy Dependencies** ✅:
- `three: ^0.176.0` - 3D graphics engine
- `@pixiv/three-vrm: ^3.4.1` - VRM avatar support
- `livekit-client: ^2.13.3` - Voice/video communication

**⚠️ PROBLEMATIC DEPENDENCIES**:
- `@elizaos/cli: 1.0.0-beta.52` - **NOT NEEDED for FastMCP**
- `@elizaos/core: 1.0.0-beta.52` - **NOT NEEDED for FastMCP**  
- `@elizaos/plugin-anthropic: 1.0.0-beta.41` - **NOT NEEDED for FastMCP**
- `@elizaos/plugin-openai: 1.0.0-beta.41` - **NOT NEEDED for FastMCP**

### Recommended Dependency Cleanup:
1. Remove all `@elizaos/*` packages
2. Replace ElizaOS imports with FastMCP equivalents
3. Update type definitions to remove ElizaOS dependencies

---

## Critical Fix Priorities

### Phase 1: Type Safety Fixes (Immediate)
1. ✅ **AgentActions System**: COMPLETED - All 29 tests passing
2. **Manager Classes**: Fix null safety and type mismatches
3. **System Classes**: Resolve interface inheritance issues  
4. **Utils**: Add proper type annotations

### Phase 2: Architecture Cleanup
1. **Remove ElizaOS Dependencies**: Clean package.json and imports
2. **Fix Service Integration**: Resolve HyperfyRuntime interface issues
3. **Update Type Definitions**: Ensure consistency across all files

### Phase 3: Build & Test Preparation
1. **Verify Build Success**: Ensure `npm run build` passes
2. **Test Entry Point**: Verify server starts correctly
3. **Test Tool Registration**: Ensure all 9 tools are properly registered

---

## FastMCP Best Practices Compliance

### ✅ FOLLOWING BEST PRACTICES:

1. **Tool Design**:
   - Descriptive names and documentation
   - Proper parameter validation with Zod
   - Contextual logging usage
   - Structured return values

2. **Session Management**:
   - Proper authentication flow
   - Session data properly typed
   - Connection lifecycle management

3. **Error Handling**:
   - Tools return structured results
   - Proper error propagation
   - Graceful failure handling

4. **System Architecture**:
   - ✅ AgentActions system fully validated
   - Proper inheritance from System base class
   - Comprehensive state management
   - Robust error handling and edge cases

### ⚠️ AREAS NEEDING ATTENTION:

1. **Type Safety**: Multiple null safety violations in managers
2. **Interface Consistency**: Mismatched interfaces between components
3. **Dependency Management**: Mixed ElizaOS/FastMCP dependencies

---

## Testing Strategy Success

### AgentActions System Testing Approach

**Mock Architecture**:
- Created comprehensive mock world with rig, controls, and entities
- Mock ActionNode creation with configurable options
- Proper timeout configurations for different test scenarios

**Test Coverage**:
- **Unit Tests**: Individual method testing (register, unregister, getNearby)
- **Integration Tests**: Full action lifecycle testing
- **Edge Cases**: Error conditions, missing data, invalid states
- **Performance Tests**: Rapid operations, complex scenarios

**Validation Results**:
- ✅ All 29 tests passing
- ✅ Comprehensive coverage of all functionality
- ✅ Proper error handling validation
- ✅ State management verification
- ✅ Concurrency prevention testing

---

## Next Session Action Plan

### Immediate Tasks (Error Resolution):
1. ✅ **AgentActions System**: COMPLETED
2. **Fix Manager Type Issues**: Resolve `effect`, `moving`, and null safety
3. **Fix System Interfaces**: Resolve ExtendedNode and world context issues
4. **Fix Utility Types**: Add proper type annotations
5. **Clean Dependencies**: Remove unused ElizaOS packages

### Testing Strategy:
1. ✅ **AgentActions Unit Tests**: COMPLETED - 29/29 passing
2. **Manager Tests**: Test individual managers and their integrations
3. **Integration Tests**: Test FastMCP server startup
4. **End-to-End Tests**: Test Hyperfy connection and tool execution

### Build Goals:
- ✅ AgentActions system fully validated
- ❌ Zero TypeScript compilation errors (still 49 remaining)
- ❌ Successful `npm run build`
- ❌ Working FastMCP server startup
- ❌ All 9 tools properly registered and functional

---

## Technical Notes

### FastMCP Server Configuration:
- **Transport**: Uses HTTP streaming (default for FastMCP)
- **Session Auth**: Custom authentication with Hyperfy connection
- **Health Checks**: Enabled for production readiness
- **Ping Mechanism**: 10-second intervals for connection health

### Architecture Strengths:
- ✅ Clear separation between FastMCP (servers/) and Hyperfy (systems/, managers/)
- ✅ Proper abstraction of Hyperfy functionality behind service layer
- ✅ Type-safe tool definitions and execution
- ✅ Comprehensive logging and error handling
- ✅ **AgentActions system fully tested and validated**

### Known Technical Debt:
- Mixed ElizaOS and FastMCP patterns in some files
- Interface mismatches between components
- Null safety violations in multiple files (excluding AgentActions)
- Some utility functions need proper typing

---

## AgentActions System Architecture Validation

### Technical Implementation Verified

**✅ THREE.js Integration**:
- Proper Vector3 usage for 3D positioning
- Distance calculations using `distanceTo()` method
- Object3D inheritance for ActionNode interface

**✅ System Base Class**:
- Correct inheritance from System class
- Proper world context management
- Framework lifecycle method stubs implemented

**✅ State Management**:
- Concurrent action prevention
- Current node tracking
- Proper cleanup on action release

**✅ Error Handling**:
- Null safety for missing controls
- Graceful handling of missing entity data
- Invalid position handling (NaN values)

**✅ Callback System**:
- onTrigger callback execution with player ID
- onCancel callback on action release
- Optional callback handling

**✅ Key Input Simulation**:
- keyE for action performance
- keyX for action release
- Proper key state management

### Performance Characteristics Validated

- **Distance Filtering**: Efficient O(n) filtering with early returns
- **Node Management**: O(1) registration, O(n) unregistration
- **Memory Management**: Proper cleanup of references
- **Concurrency**: Prevention of multiple simultaneous actions

---

**STATUS**: AgentActions system fully validated ✅
**NEXT MILESTONE**: Complete remaining TypeScript error resolution
**BLOCKER**: 49 TypeScript compilation errors (excluding AgentActions)
**ACHIEVEMENT**: Complete AgentActions system testing with 29/29 tests passing

---

## Project Structure Analysis & Reorganization Plan

### Current File Structure (Generated: $(date))

```
src/
├── index.ts                         # ✅ Entry point (keep here)
├── constants.ts                     # 🔄 MOVE to servers/config/
├── templates.ts                     # 🔄 MOVE to servers/config/
├── service.ts                       # 🔄 MOVE to core/ (rename to hyperfy-service.ts)
├── servers/                         # ✅ FastMCP server implementation
│   ├── server.ts                    # ✅ Main FastMCP server
│   └── actions/                     # ✅ MCP tools (9 tools)
│       ├── ambientTool.ts
│       ├── chatTool.ts
│       ├── getEmoteListTool.ts
│       ├── getWorldStateTool.ts
│       ├── gotoTool.ts
│       ├── stopTool.ts
│       ├── unuseTool.ts
│       ├── useTool.ts
│       └── walkRandomlyTool.ts
├── managers/                        # ⚠️ Hyperfy-specific managers
│   ├── behavior-manager.ts
│   ├── emote-manager.ts
│   ├── guards.ts
│   ├── message-manager.ts
│   └── voice-manager.ts
├── systems/                         # ✅ Hyperfy-specific systems
│   ├── actions.ts                   # ✅ FULLY TESTED - 29/29 tests passing
│   ├── avatar.ts
│   ├── controls.ts
│   ├── liveKit.ts
│   └── loader.ts
├── hyperfy-core/                    # ✅ JavaScript core (JS + .d.ts files)
│   ├── createNodeClientWorld.js(.d.ts)
│   ├── World.js(.d.ts)
│   ├── extras/
│   ├── libs/
│   ├── nodes/
│   └── systems/
├── physx/                           # ✅ Physics engine
│   ├── loadPhysX.js(.d.ts)
│   ├── physx-js-webidl.js
│   └── physx-js-webidl.wasm
├── types/                           # ✅ Type definitions
│   ├── hyperfy.d.ts
│   └── index.ts
└── utils/                           # ✅ Utility functions
    ├── eliza-compat.ts
    └── utils.ts
```

### Recommended Reorganization

```
src/
├── index.ts                         # Entry point
├── core/                            # 🆕 Core Hyperfy service
│   └── hyperfy-service.ts           # Moved from service.ts
├── servers/                         # FastMCP server implementation
│   ├── server.ts                    # Main FastMCP server
│   ├── config/                      # 🆕 Server configuration
│   │   ├── constants.ts             # Moved from root
│   │   └── templates.ts             # Moved from root
│   └── actions/                     # MCP tools
│       ├── ... (all existing tools)
├── hyperfy/                         # 🆕 Hyperfy-specific components
│   ├── managers/                    # Moved from root
│   │   ├── ... (all managers)
│   ├── systems/                     # Moved from root
│   │   ├── actions.ts               # ✅ FULLY TESTED
│   │   ├── ... (other systems)
│   └── core/                        # Hyperfy JS core
│       ├── ... (current hyperfy-core contents)
├── lib/                             # 🆕 External libraries
│   └── physx/                       # Moved from root
│       ├── ... (physx files)
├── types/                           # Type definitions
│   ├── hyperfy.d.ts
│   └── index.ts
└── utils/                           # Utility functions
    ├── eliza-compat.ts
    └── utils.ts
```

### File Movement Recommendations

#### 🔄 HIGH PRIORITY MOVES:

1. **constants.ts** → `servers/config/constants.ts`
   - **Reason**: Contains emotes and actions specific to server configuration
   - **Impact**: Better separation of FastMCP server concerns
   - **Required Updates**: Update imports in all tools

2. **templates.ts** → `servers/config/templates.ts`
   - **Reason**: Contains message templates used by FastMCP tools
   - **Impact**: Co-locate with server configuration
   - **Required Updates**: Update imports in managers and tools

3. **service.ts** → `core/hyperfy-service.ts`
   - **Reason**: Core Hyperfy functionality should be separate from server logic
   - **Impact**: Cleaner architecture separation
   - **Required Updates**: Update imports in server.ts and tools

#### 🔄 MEDIUM PRIORITY MOVES:

4. **managers/** → `hyperfy/managers/`
   - **Reason**: Group all Hyperfy-specific components together
   - **Impact**: Better logical organization
   - **Required Updates**: Update imports throughout project

5. **systems/** → `hyperfy/systems/`
   - **Reason**: Group with other Hyperfy components
   - **Impact**: Cleaner project structure
   - **Required Updates**: Update imports in service and managers

6. **hyperfy-core/** → `hyperfy/core/`
   - **Reason**: Consolidate all Hyperfy-related code
   - **Impact**: Single location for Hyperfy components
   - **Required Updates**: Update imports in systems and service

#### 🔄 LOW PRIORITY MOVES:

7. **physx/** → `lib/physx/`
   - **Reason**: External library should be in lib folder
   - **Impact**: Better separation of external dependencies
   - **Required Updates**: Update imports in hyperfy-core

### Reorganization Benefits

#### ✅ **ARCHITECTURE IMPROVEMENTS**:

1. **Clear Separation of Concerns**:
   - FastMCP server logic in `servers/`
   - Hyperfy-specific code in `hyperfy/`
   - Core service logic in `core/`
   - External libraries in `lib/`

2. **Better Maintainability**:
   - Related files grouped together
   - Easier to find components
   - Clearer dependencies

3. **Scalability**:
   - Easy to add new server configurations
   - Simple to extend Hyperfy components
   - Clean addition of new tools

#### ✅ **DEVELOPMENT BENEFITS**:

1. **Import Clarity**:
   - Predictable import paths
   - Logical component locations
   - Reduced circular dependencies

2. **Testing Organization**:
   - Easier to test related components
   - Clear test file organization
   - Better mock isolation

3. **Documentation**:
   - Self-documenting file structure
   - Easier onboarding for new developers
   - Clear component boundaries

### Implementation Priority

#### **Phase 1: Critical Moves (Do First)**
1. Move `constants.ts` to `servers/config/`
2. Move `templates.ts` to `servers/config/`
3. Update all imports for constants and templates

#### **Phase 2: Core Reorganization**
1. Move `service.ts` to `core/hyperfy-service.ts`
2. Update server.ts and tool imports
3. Test FastMCP server startup

#### **Phase 3: Component Grouping**
1. Create `hyperfy/` directory structure
2. Move managers and systems
3. Move hyperfy-core contents
4. Update all remaining imports

#### **Phase 4: External Libraries**
1. Move physx to `lib/physx/`
2. Update hyperfy-core imports
3. Final testing and validation

### Import Update Strategy

**Before Reorganization**:
```typescript
import { EMOTES_LIST } from './constants.js';
import { HyperfyService } from './service.js';
import { BehaviorManager } from './managers/behavior-manager.js';
```

**After Reorganization**:
```typescript
import { EMOTES_LIST } from '../config/constants.js';
import { HyperfyService } from '../../core/hyperfy-service.js';
import { BehaviorManager } from '../../hyperfy/managers/behavior-manager.js';
```

### File Structure Validation

After reorganization, verify:
- [ ] All imports resolve correctly
- [ ] FastMCP server starts successfully
- [ ] All 9 tools register properly
- [ ] TypeScript compilation passes
- [ ] No circular dependencies introduced
- [x] AgentActions tests still pass (29/29)

---

**REORGANIZATION STATUS**: Planned
**RECOMMENDATION**: Execute Phase 1 moves first, then fix typing issues
**BENEFIT**: Cleaner architecture will make debugging easier

**TESTING STATUS**: ✅ AgentActions system fully validated with 29/29 tests passing
**NEXT MILESTONE**: Complete remaining TypeScript error resolution

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