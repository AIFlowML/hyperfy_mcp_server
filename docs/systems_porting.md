# Systems Porting Guide: ElizaOS to FastMCP

This guide provides comprehensive analysis and porting strategy for system classes from ElizaOS dependencies to standalone FastMCP implementation.

## Table of Contents
- [Overview](#overview)
- [Project Structure](#project-structure)
- [Systems Analysis](#systems-analysis)
- [Dependency Analysis](#dependency-analysis)
- [FastMCP Integration Strategy](#fastmcp-integration-strategy)
- [Implementation Plan](#implementation-plan)

---

## Overview

**Current State**: Five system files need analysis for FastMCP integration:
1. `AgentActions` (actions.ts) - Action node management and interaction system
2. `AgentAvatar` (avatar.ts) - Avatar rendering and emote management 
3. `AgentControls` (controls.ts) - Navigation and movement control system
4. `AgentLiveKit` (liveKit.ts) - Voice/audio communication system
5. `AgentLoader` (loader.ts) - Asset loading and GLTF processing system

**Challenge**: These systems extend Hyperfy's base `System` class and have complex dependencies on THREE.js, Hyperfy core, and ElizaOS. We need to determine which systems are essential for FastMCP functionality vs. which can be simplified or excluded.

**Key Insight**: Unlike managers and providers, systems are **core infrastructure components** that provide foundational services to our FastMCP tools. Each system needs individual assessment for integration necessity.

---

## Project Structure

Current FastMCP project structure showing systems in context:

```
hyperfy-fastmcp-server/src/
├── constants.ts
├── hyperfy/                           # Hyperfy core dependency
│   ├── agent.mjs
│   ├── CHANGELOG.md
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── DOCKER.md
│   ├── Dockerfile
│   ├── docs/
│   │   ├── blender-addon.py
│   │   ├── blender-exporter.md
│   │   ├── commands.md
│   │   ├── hyp-format.md
│   │   ├── models.md
│   │   ├── README.md
│   │   └── ref/                       # 25 reference files for Hyperfy components
│   │       ├── Action.md
│   │       ├── Anchor.md
│   │       ├── App.md
│   │       ├── Audio.md
│   │       ├── Avatar.md
│   │       ├── Collider.md
│   │       ├── Controller.md
│   │       ├── Group.md
│   │       ├── Image.md
│   │       ├── LOD.md
│   │       ├── Material.md
│   │       ├── Mesh.md
│   │       ├── Node.md
│   │       ├── num.md
│   │       ├── Particles.md
│   │       ├── Player.md
│   │       ├── Props.md
│   │       ├── RigidBody.md
│   │       ├── SkinnedMesh.md
│   │       ├── UI.md
│   │       ├── UIImage.md
│   │       ├── UIText.md
│   │       ├── UIView.md
│   │       ├── Video.md
│   │       └── World.md
│   │   └── scripts.md
│   └── src/
│       ├── client/                    # Client-side components
│       │   ├── components/            # 25 UI components
│       │   ├── public/                # Static assets (glb, hdr, images)
│       │   └── world-client.js
│       ├── core/                      # Hyperfy core systems
│       │   ├── entities/              # Entity management (App, Entity, PlayerLocal, PlayerRemote)
│       │   ├── extras/                # 30+ utility modules
│       │   ├── libs/                  # External libraries (csm, gltfloader, stats-gl, etc.)
│       │   ├── nodes/                 # 20+ node types (Action, Avatar, Mesh, etc.)
│       │   ├── systems/               # 35+ core systems (Physics, Graphics, Network, etc.)
│       │   └── World.js               # Main world implementation
│       ├── node-client/               # Node client interface
│       ├── server/                    # Server implementation
│       └── world/                     # World assets and collections
├── index.ts                           # Main FastMCP entry point
├── managers/                          # ✅ COMPLETED - FastMCP manager implementations
│   ├── behavior-manager.ts            # Autonomous behavior system
│   ├── emote-manager.ts              # Emote upload and playback
│   ├── guards.ts                     # Activity locking system
│   ├── message-manager.ts            # Chat processing and AI responses
│   └── voice-manager.ts              # Voice input/output processing
├── physx/                            # PhysX physics engine files
│   ├── loadPhysX.js
│   ├── physx-js-webidl.js
│   └── physx-js-webidl.wasm
├── servers/                          # ✅ COMPLETED - FastMCP server and tools
│   ├── actions/                      # 9 MCP tools for Hyperfy interaction
│   │   ├── ambientTool.ts            # Ambient speech generation
│   │   ├── chatTool.ts               # World chat messaging
│   │   ├── getEmoteListTool.ts       # ✅ Converted from provider
│   │   ├── getWorldStateTool.ts      # ✅ Converted from provider
│   │   ├── gotoTool.ts               # Navigation and movement
│   │   ├── stopTool.ts               # Stop current actions
│   │   ├── unuseTool.ts              # Release items/interactions
│   │   ├── useTool.ts                # Use items and interact
│   │   └── walkRandomlyTool.ts       # Random movement behavior
│   └── server.ts                     # Main FastMCP server configuration
├── service.ts                        # HyperfyService - connection and world management
├── systems/                          # 🔍 CURRENT FOCUS - System implementations
│   ├── actions.ts                    # Action node management and interactions
│   ├── avatar.ts                     # Avatar rendering and emote handling
│   ├── controls.ts                   # Movement controls and navigation
│   ├── liveKit.ts                    # Audio/voice communication system
│   └── loader.ts                     # Asset loading and GLTF processing
├── templates.ts                      # AI prompt templates
├── types/                            # ✅ COMPLETED - Centralized type definitions
│   └── index.ts                      # 700+ lines of comprehensive TypeScript types
└── utils/                            # Utility functions
    ├── eliza-compat.ts               # ElizaOS compatibility utilities
    └── utils.ts                      # General utility functions
```

---

## Systems Analysis

### 🟢 **AgentActions (actions.ts)** - **ESSENTIAL**
**File**: `src/systems/actions.ts`
**Purpose**: Manages action nodes and entity interactions
**Complexity**: Medium-Low
**Current Status**: ✅ **ALREADY INTEGRATED** via HyperfyService

**Dependencies**:
- ✅ `System` base class from Hyperfy core
- ✅ `THREE` for 3D math operations
- ❌ **No ElizaOS dependencies**

**Core Functionality**:
1. **Action Node Registry**: `register()`, `unregister()` for action management
2. **Proximity Detection**: `getNearby(maxDistance)` finds nearby interactable objects
3. **Action Execution**: `performAction(entityID)` triggers interactions
4. **Action Release**: `releaseAction()` releases current interactions
5. **Current State Tracking**: Maintains `currentNode` for active interactions

**Integration Assessment**:
- ✅ **Already used** by `useTool.ts` and `unuseTool.ts` via `session.data.actions`
- ✅ **Well-integrated** with FastMCP session data
- ✅ **No porting needed** - system is functional as-is
- ⚠️ **Linter warnings** need cleanup (THREE.js types, implicit any)

**Usage in FastMCP**:
```typescript
// useTool.ts
const actions = session.data.actions as AgentActions;
const nearby = actions.getNearby();
await actions.performAction(entityId);

// unuseTool.ts  
const actions = session.data.actions as AgentActions;
actions.releaseAction();
```

### 🟡 **AgentAvatar (avatar.ts)** - **MODERATE PRIORITY**
**File**: `src/systems/avatar.ts`
**Purpose**: Avatar rendering, emote management, and visual representation
**Complexity**: High
**Current Status**: ⚠️ **PARTIALLY INTEGRATED** via EmoteManager

**Dependencies**:
- ✅ `Node` base class from Hyperfy core
- ✅ `THREE` for 3D math and matrix operations
- ❌ **No ElizaOS dependencies**
- ⚠️ **Complex factory pattern** for avatar instances

**Core Functionality**:
1. **Avatar Loading**: `mount()`, `unmount()` lifecycle management
2. **Emote System**: `setEmote(url)`, `emote` property for animations
3. **Visual Representation**: Factory pattern for avatar instances
4. **3D Transformations**: Position, rotation, scale management
5. **Proxy Interface**: Comprehensive proxy for external access

**Integration Assessment**:
- ✅ **Emote functionality** handled by EmoteManager 
- ❌ **Avatar rendering** not directly used by FastMCP tools
- ❌ **Factory system** complex and may not be needed for agent operation
- ⚠️ **High linter error count** (7 'any' types, missing type declarations)

**Porting Decision**: **DEFERRED** - EmoteManager handles critical functionality

### 🟢 **AgentControls (controls.ts)** - **ESSENTIAL**
**File**: `src/systems/controls.ts`
**Purpose**: Agent movement, navigation, and control systems
**Complexity**: Very High
**Current Status**: ✅ **ALREADY INTEGRATED** via HyperfyService

**Dependencies**:
- ✅ `System` base class from Hyperfy core
- ❌ `@elizaos/core` logger (needs replacement)
- ✅ `THREE` for 3D math (Vector3, Quaternion, Euler)
- ✅ `Vector3Enhanced` from Hyperfy core

**Core Functionality**:
1. **Key State Management**: Button states for all control inputs
2. **Navigation System**: `goto(x, z)` for targeted movement
3. **Random Walk**: `startRandomWalk()`, `stopRandomWalk()` for autonomous movement
4. **Movement Controls**: WASD key simulation and movement execution
5. **Camera System**: `createCamera()` for view management
6. **State Validation**: Comprehensive player state checking

**Integration Assessment**:
- ✅ **Already used** by `gotoTool.ts`, `stopTool.ts`, `walkRandomlyTool.ts`
- ✅ **Well-integrated** with FastMCP session data
- ⚠️ **ElizaOS logger** needs replacement with FastMCP logging
- ⚠️ **HIGH linter error count** (20+ errors, many 'any' types)

**Usage in FastMCP**:
```typescript
// gotoTool.ts
const controls = session.data.controls as AgentControls;
await controls.goto(targetPosition.x, targetPosition.z);

// walkRandomlyTool.ts
const controls = session.data.controls as AgentControls;
await controls.startRandomWalk(interval, maxDistance, duration);
```

### 🟡 **AgentLiveKit (liveKit.ts)** - **SPECIALIZED**
**File**: `src/systems/liveKit.ts`
**Purpose**: Voice/audio communication via LiveKit
**Complexity**: High
**Current Status**: ⚠️ **PARTIALLY INTEGRATED** via VoiceManager

**Dependencies**:
- ✅ `@livekit/rtc-node` for audio processing
- ✅ `System` base class from Hyperfy core
- ✅ `node:child_process` for ffmpeg audio conversion

**Core Functionality**:
1. **Room Connection**: LiveKit room management and connection
2. **Audio Streaming**: `publishAudioStream()` for voice output
3. **Audio Processing**: Real-time audio frame handling
4. **Format Detection**: MP3, WAV, PCM audio format detection
5. **Event Handling**: Participant and track event management

**Integration Assessment**:
- ✅ **Voice functionality** handled by VoiceManager
- ❌ **Direct LiveKit usage** not required by current FastMCP tools
- ✅ **Specialized use case** - only needed if voice features are required
- ⚠️ **3 linter errors** (unnecessary constructor, 'any' types)

**Porting Decision**: **DEFERRED** - VoiceManager provides adequate voice support

### 🔴 **AgentLoader (loader.ts)** - **COMPLEX**
**File**: `src/systems/loader.ts`
**Purpose**: Asset loading, GLTF processing, and resource management
**Complexity**: Very High
**Current Status**: ❌ **NOT INTEGRATED** 

**Dependencies**:
- ✅ `THREE` for 3D graphics operations
- ✅ `System` base class from Hyperfy core
- ✅ Multiple Hyperfy core modules:
  - `createVRMFactory.js` - VRM avatar processing
  - `createNode.js` - Node creation utilities
  - `GLTFLoader.js` - GLTF model loading
  - `glbToNodes.js` - GLB to node conversion
  - `createEmoteFactory.js` - Emote animation processing
- ✅ Complex browser environment mocking for Node.js

**Core Functionality**:
1. **Asset Loading**: Universal asset loader with caching
2. **GLTF Processing**: Model, avatar, and emote parsing
3. **VRM Support**: VRM avatar factory creation
4. **Caching System**: Promise-based result caching
5. **Browser Polyfills**: Extensive browser API mocking for Node.js
6. **Format Detection**: Multiple 3D format support

**Integration Assessment**:
- ❌ **Not currently used** by any FastMCP tools
- ❌ **High complexity** with extensive browser mocking
- ❌ **Large dependency footprint** on Hyperfy core modules
- ⚠️ **8 linter errors** (multiple 'any' types, implicit types)
- ❓ **Uncertain necessity** - may be needed for future asset-based tools

**Porting Decision**: **EVALUATE** - Determine if FastMCP needs asset loading capabilities

---

## Dependency Analysis

### **External Dependencies**
1. **THREE.js** (❌ Missing types)
   - Used by: AgentActions, AgentAvatar, AgentControls, AgentLoader
   - Impact: Multiple linter errors, implicit 'any' types
   - Solution: `npm install @types/three`

2. **@elizaos/core** (❌ Invalid in FastMCP)
   - Used by: AgentControls (logger only)
   - Impact: Import errors, dependency mismatch
   - Solution: Replace with FastMCP logging system

3. **@livekit/rtc-node** (✅ Valid)
   - Used by: AgentLiveKit
   - Impact: Specialized voice functionality
   - Status: Working, but not essential

### **Hyperfy Core Dependencies**
1. **System Base Class** (✅ Essential)
   - Used by: All systems
   - Status: Required for Hyperfy integration
   - Solution: Keep as-is with type annotations

2. **Hyperfy Utilities** (⚠️ Mixed necessity)
   - Vector3Enhanced: Used by AgentControls (✅ Keep)
   - Various factories: Used by AgentLoader (❓ Evaluate)
   - Node classes: Used by AgentAvatar (❓ Evaluate)

### **Type Safety Issues**
**Total Linter Errors**: 40+ across all system files
- AgentControls: ~25 errors (highest priority fix)
- AgentLoader: ~8 errors  
- AgentLiveKit: ~3 errors
- AgentAvatar: ~7 errors
- AgentActions: ~1 error

---

## FastMCP Integration Strategy

### **Approach 1: Selective Integration** ✅ **RECOMMENDED**

**Rationale**: Focus on systems that are essential for current FastMCP functionality while preserving the option to integrate others later.

**Integration Priorities**:

#### **Priority 1: Fix Active Systems** (1-2 hours)
- ✅ **AgentActions**: Already integrated, fix linter errors only
- ✅ **AgentControls**: Already integrated, replace ElizaOS logger, fix types

#### **Priority 2: Evaluate Deferred Systems** (As needed)
- 🟡 **AgentAvatar**: Only if advanced avatar features needed
- 🟡 **AgentLiveKit**: Only if direct LiveKit integration needed
- 🔴 **AgentLoader**: Only if asset loading tools are required

#### **Priority 3: Type Safety Improvements** (Ongoing)
- Install `@types/three` to resolve THREE.js type issues
- Replace 'any' types with proper interfaces
- Add proper type annotations throughout

### **Approach 2: Complete Integration** ❌ **NOT RECOMMENDED**

**Rationale**: Would require significant effort for systems not currently used by FastMCP tools.

**Drawbacks**:
- ❌ **High complexity** for unused functionality
- ❌ **Large maintenance burden** 
- ❌ **Unnecessary dependencies** in FastMCP bundle
- ❌ **Extended development timeline**

---

## Implementation Plan

### **Phase 1: Essential Systems Cleanup** ✅ **IMMEDIATE PRIORITY**
**Timeline**: 1-2 hours
**Scope**: Fix actively used systems

**Steps**:
1. **Install THREE.js types**: `npm install --save-dev @types/three`
2. **Fix AgentControls logging**: Replace `@elizaos/core` logger with FastMCP logging
3. **Type cleanup**: Fix 'any' types in AgentActions and AgentControls
4. **Validate integration**: Ensure tools still function correctly

**Expected Outcome**: Zero linter errors for essential systems

### **Phase 2: System Evaluation** (Future)
**Timeline**: As needed
**Scope**: Evaluate deferred systems based on requirements

**Decision Points**:
- **Avatar features**: Does FastMCP need advanced avatar rendering?
- **Asset loading**: Will FastMCP tools need to load 3D assets?
- **Direct LiveKit**: Does VoiceManager provide sufficient voice capabilities?

### **Phase 3: Optional Enhancements** (Future)
**Timeline**: Based on Phase 2 decisions
**Scope**: Integrate additional systems if needed

**Potential Integrations**:
- AgentAvatar for advanced emote/avatar features
- AgentLoader for asset-based tools
- AgentLiveKit for enhanced voice features

---

## Critical Considerations

### **1. Performance Impact**
**Current Status**: Systems are already instantiated in HyperfyService
- No additional performance overhead for keeping existing integrations
- Unused systems have minimal impact if not actively called

### **2. Maintenance Complexity**
**Issue**: High linter error count creates maintenance burden
**Solution**: Prioritize fixing actively used systems first

### **3. Future Extensibility**
**Issue**: May need currently unused systems for future FastMCP tools
**Solution**: Keep systems in codebase but defer fixes until needed

### **4. Type Safety**
**Issue**: Missing THREE.js types cause cascading type errors
**Solution**: Install proper type declarations as first step

---

## Conclusion

**Recommended Approach**: **Selective Integration with Essential Systems Cleanup**

**Immediate Actions**:
1. ✅ Fix AgentActions and AgentControls (actively used)
2. ✅ Install THREE.js types to resolve type issues
3. ✅ Replace ElizaOS dependencies with FastMCP alternatives
4. ⏸️ Defer AgentAvatar, AgentLiveKit, AgentLoader until needed

**Key Benefits**:
- ✅ **Maintains current functionality** for all existing FastMCP tools
- ✅ **Reduces maintenance burden** by focusing on used systems
- ✅ **Provides clear path forward** for future enhancements
- ✅ **Achieves type safety** where it matters most

**Success Metrics**:
- Zero linter errors for AgentActions and AgentControls
- All existing FastMCP tools continue to function correctly
- Clean separation between essential and optional systems
- Clear documentation for future system integration decisions
