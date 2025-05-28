# Managers Porting Guide: ElizaOS to FastMCP

This guide documents the analysis and porting process for manager classes from ElizaOS dependencies to standalone FastMCP implementation.

## Table of Contents
- [Overview](#overview)
- [Porting Progress](#porting-progress)
- [BehaviorManager Analysis](#behaviormanager-analysis)
- [MessageManager Analysis](#messagemanager-analysis)
- [EmoteManager Analysis](#emotemanager-analysis)
- [VoiceManager Analysis](#voicemanager-analysis)
- [Porting Strategy](#porting-strategy)
- [Implementation Plan](#implementation-plan)

## Overview

**Current State**: All manager classes in `src/managers/` currently depend on ElizaOS core imports and runtime functionality.

**Goal**: Port all managers to use centralized types and FastMCP-compatible interfaces while preserving full functionality.

**Key Challenge**: Replace ElizaOS-specific concepts (IAgentRuntime, Memory, etc.) with FastMCP equivalents without losing autonomous behavior capabilities.

---

## Porting Progress

### ✅ **BehaviorManager - COMPLETED**
**Status**: Successfully ported to FastMCP with full functionality preserved
**Completion**: 100%
**Key Changes**:
- ✅ Replaced `IAgentRuntime` with `FastMCPRuntime`
- ✅ Replaced ElizaOS `Memory` with `FastMCPMemory`
- ✅ Replaced ElizaOS AI integration with direct `aiModel.generateText()`
- ✅ Replaced `parseKeyValueXml` with custom `parseXMLResponse`
- ✅ Replaced `createUniqueUuid` with `generateUUID`
- ✅ Simplified entity/room management while preserving functionality
- ✅ Maintained autonomous behavior loop (15-30 second intervals)
- ✅ Preserved `agentActivityLock` integration
- ✅ Preserved emote and message execution via service managers

**Result**: Autonomous agent behavior fully functional in FastMCP environment

### ✅ **Guards (AgentActivityLock) - ENHANCED**
**Status**: Enhanced with robust TypeScript types and safety mechanisms
**Completion**: 100%
**Key Enhancements**:
- ✅ Added comprehensive TypeScript types (`AsyncTaskFunction<T>`)
- ✅ Added complete JSDoc documentation for all methods
- ✅ Added safety mechanism with automatic lock timeout (30 seconds)
- ✅ Added debugging utilities (`getActiveCount()`, `getLockDuration()`, `getDebugInfo()`)
- ✅ Added emergency recovery (`forceReset()`)
- ✅ Enhanced `isActive()` with automatic deadlock detection
- ✅ Added timestamp tracking for lock acquisition

**Result**: Production-ready activity lock with comprehensive safety mechanisms and debugging capabilities

### ✅ **EmoteManager - COMPLETED**
**Status**: Successfully ported to FastMCP with full functionality preserved
**Completion**: 100%
**Key Changes**:
- ✅ Replaced `IAgentRuntime` with `EmoteManagerRuntime`
- ✅ Fixed service access pattern to use `runtime.hyperfyService`
- ✅ Added proper TypeScript types (`HyperfyPlayerEntity`, etc.)
- ✅ Fixed import syntax for Node.js compatibility
- ✅ **RESTORED** original `Emotes` import - this is critical for runtime functionality
- ✅ Replaced `any` types with proper error handling
- ✅ **FIXED** Logging: Removed unused logger imports, kept `console.info/warn/error` for MCP compatibility

**Critical Learning**: The `Emotes` import from `../hyperfy/src/core/extras/playerEmotes.js` is **required** for the fallback emote system. While it causes TypeScript warnings due to missing declaration files, it's essential for runtime functionality and should be preserved with proper `@ts-ignore` annotations.

**Result**: Complete emote upload, playback, and timer management functionality preserved

### ⏸️ **MessageManager - PENDING**
**Status**: Awaiting porting
**Complexity**: Medium
**Dependencies**: Entity management, Memory system, Event handling

### ✅ **VoiceManager - COMPLETED**
**Status**: Successfully ported to FastMCP with full functionality preserved
**Completion**: 100% ✅ **NO LINTER ERRORS**
**Key Changes**:
- ✅ Replaced `IAgentRuntime` with `VoiceManagerRuntime` + `ExtendedVoiceManagerRuntime`
- ✅ Replaced ElizaOS imports (`ChannelType`, `Content`, `HandlerCallback`, `Memory`, `ModelType`, `UUID`, `createUniqueUuid`, `getWavHeader`, `logger`) with FastMCP equivalents
- ✅ Fixed `HyperfyService` import to value import (not type-only) and restored original `serviceType` usage
- ✅ Moved `LiveKitAudioData` type to centralized types (`types/index.ts`)
- ✅ Replaced `getWavHeader` with `createWavHeader` utility function
- ✅ Replaced `this.runtime.useModel(ModelType.TRANSCRIPTION)` with `processVoiceTranscription()`
- ✅ Replaced `this.runtime.useModel(ModelType.TEXT_TO_SPEECH)` with `generateAudioResponse()`
- ✅ Replaced `createUniqueUuid` with `generateUUID` throughout
- ✅ Replaced `logger` with `console` logging for MCP compatibility
- ✅ Replaced ElizaOS `Memory` with `VoiceMemory` and `createVoiceMemory()` helper
- ✅ Replaced `HandlerCallback` with `VoiceCallback` type
- ✅ Enhanced `getService()` method to use `HyperfyService.serviceType` for consistency
- ✅ Preserved all original LiveKit event handling (`world.livekit.on('audio')`)
- ✅ Preserved `isLoudEnough()` audio level detection function
- ✅ Preserved user state management (`userStates` Map with buffers, timing, transcription)
- ✅ Preserved debounced transcription processing (1.5 second silence threshold)
- ✅ Preserved `agentActivityLock` integration for concurrency management
- ✅ Preserved entity connection creation (`ensureConnection()`)
- ✅ Preserved voice event emission (`emitEvent('VOICE_MESSAGE_RECEIVED')`)
- ✅ Preserved emote integration via `service.getEmoteManager()`
- ✅ Preserved audio playback via `world.livekit.publishAudioStream()`
- ✅ Fixed all parameter types (`playerId: string`, `buffer: Buffer`)
- ✅ Enhanced error handling with proper null checks

**Core Functionality Preserved**:
1. **Audio Input Processing**: LiveKit audio stream capture and buffering
2. **Audio Level Detection**: `isLoudEnough()` function for voice activity detection  
3. **Speech-to-Text**: Audio transcription with AI model integration
4. **Message Processing**: Voice messages converted to chat processing
5. **Text-to-Speech**: AI-generated audio responses
6. **Audio Playback**: Streaming audio back to LiveKit
7. **User State Management**: Per-user audio buffer and transcription tracking
8. **Debounced Processing**: 1.5-second silence detection for optimal transcription
9. **Entity Management**: ElizaOS entity creation and connection handling
10. **Event System**: Voice message event emission for handler integration
11. **Emote Integration**: Automated emote playback during TTS responses
12. **Concurrency Control**: Activity lock integration to prevent conflicts

**Result**: Complete voice input/output functionality preserved in FastMCP environment

---

## BehaviorManager Analysis

### Current Dependencies (ElizaOS)
```typescript
import { 
  ChannelType, Content, HandlerCallback, IAgentRuntime, Memory, 
  ModelType, composePromptFromState, createUniqueUuid, logger, parseKeyValueXml 
} from "@elizaos/core";
```

### Core Functionality
**Purpose**: Autonomous behavior loop that generates AI-driven actions at regular intervals (15-30 seconds)

**Key Features**:
- **Autonomous Loop**: Runs continuously with random intervals 
- **AI-Powered Decisions**: Uses LLM to generate contextual responses based on world state
- **Action Execution**: Processes AI responses to trigger appropriate Hyperfy actions
- **Activity Lock Integration**: Respects message processing locks to avoid conflicts
- **Template-Based Prompting**: Uses `autoTemplate()` for structured AI prompts

### Usage Integration
**Service Integration**:
- Instantiated in `HyperfyService.connect()` at line 188
- Started after successful connection at line 399
- Accessible via `getBehaviorManager()` at line 607-608

**Templates Used**:
- `autoTemplate()` from `../templates` - Main behavior prompt template
- Uses `HYPERFY_ACTIONS` constants for action descriptions

### Current Implementation Flow

1. **Loop Management**:
   ```typescript
   start() → runLoop() → executeBehavior() (with delays)
   ```

2. **Behavior Execution**:
   ```typescript
   // Check activity lock to avoid conflicts
   if (agentActivityLock.isActive()) return;
   
   // Create Memory object for AI context
   const newMessage: Memory = { /* ElizaOS Memory structure */ };
   
   // Compose AI state using ElizaOS methods
   const state = await this.runtime.composeState(newMessage);
   
   // Generate response using ElizaOS model system
   const response = await this.runtime.useModel(ModelType.TEXT_LARGE, { prompt });
   
   // Parse XML response to extract actions
   const parsedXml = parseKeyValueXml(response);
   
   // Process actions through ElizaOS runtime
   await this.runtime.processActions(newMessage, [responseMemory], state, callback);
   ```

3. **Response Processing**:
   - Parses AI response XML (`thought`, `text`, `actions`, `emote`)
   - Executes emotes via `HyperfyService.getEmoteManager()`
   - Sends messages via `HyperfyService.getMessageManager()`
   - Creates memory records via `runtime.createMemory()`

### ElizaOS Dependencies to Replace

**Core Runtime Dependencies**:
- `IAgentRuntime` → FastMCP runtime interface
- `Memory` → FastMCP memory/state interface  
- `ModelType` → FastMCP AI model access
- `composePromptFromState` → Custom state composition
- `createUniqueUuid` → Standard UUID generation
- `parseKeyValueXml` → Custom XML parser

**Template System Dependencies**:
- `autoTemplate()` - Keep as-is, already using our templates
- `HYPERFY_ACTIONS` - Keep as-is, already using our constants

### Porting Challenges

1. **AI Model Integration**: Need FastMCP-compatible AI model access
2. **State Management**: Replace ElizaOS state composition with FastMCP equivalents
3. **Memory System**: Create FastMCP-compatible memory management
4. **XML Parsing**: Replace ElizaOS XML parser with custom implementation
5. **UUID Generation**: Replace with standard library

### Proposed FastMCP Interface

```typescript
interface FastMCPBehaviorManager {
  // Core lifecycle
  start(): void;
  stop(): void;
  
  // AI Integration (to be defined)
  generateBehaviorResponse(worldState: HyperfyWorldState): Promise<BehaviorResponse>;
  
  // Action processing
  processBehaviorActions(response: BehaviorResponse): Promise<void>;
}

interface BehaviorResponse {
  thought: string;
  text?: string;
  actions: string[];
  emote?: string;
}
```

---

## MessageManager Analysis

### Current Dependencies (ElizaOS)
```typescript
import { 
  ChannelType, Entity, Content, EventType, HandlerCallback, IAgentRuntime, 
  Memory, UUID, formatTimestamp, createUniqueUuid, getEntityDetails 
} from "@elizaos/core";
```

### Core Functionality
**Purpose**: Handles incoming Hyperfy chat messages and generates AI responses

**Key Features**:
- **Message Processing**: Converts Hyperfy messages to ElizaOS Memory objects
- **Entity Management**: Ensures proper user/entity registration in ElizaOS system
- **AI Response Generation**: Triggers message handlers for contextual responses
- **Activity Lock Integration**: Uses agentActivityLock for concurrency management
- **Template Integration**: Uses `messageHandlerTemplate` for AI prompting

### Implementation Flow
1. **Message Reception**: `handleMessage(msg)` from Hyperfy chat
2. **Entity Registration**: Creates/ensures ElizaOS entity connections
3. **Memory Creation**: Converts to ElizaOS Memory format
4. **Event Emission**: Triggers `MESSAGE_RECEIVED` event
5. **Response Processing**: Handles AI callbacks (emotes + text responses)

---

## EmoteManager Analysis

### Current Dependencies (ElizaOS)
```typescript
import { IAgentRuntime, logger } from '@elizaos/core'
```

### Core Functionality
**Purpose**: Manages avatar emotes and animations in Hyperfy world

**Key Features**:
- **Emote Upload**: Handles asset upload to Hyperfy servers
- **Animation Control**: Plays emotes with duration and movement detection
- **Hash Management**: Maps emote names to uploaded asset hashes
- **Timer Management**: Handles emote duration and automatic cleanup

### Minimal ElizaOS Dependencies
- Only depends on `IAgentRuntime` for service access
- Uses `logger` for logging (easily replaceable)
- Least complex manager to port

---

## VoiceManager Analysis

### Current Dependencies (ElizaOS)
```typescript
import { 
  ChannelType, Content, HandlerCallback, IAgentRuntime, Memory, ModelType, 
  UUID, createUniqueUuid, getWavHeader, logger 
} from "@elizaos/core";
```

### Core Functionality
**Purpose**: Handles LiveKit voice input/output and speech processing

**Key Features**:
- **Voice Input Processing**: Captures and buffers audio from LiveKit
- **Speech-to-Text**: Transcribes audio using AI models
- **Message Handling**: Processes transcribed text as chat messages
- **Text-to-Speech**: Generates audio responses using AI models
- **Audio Playback**: Plays generated audio through LiveKit

### Complex Dependencies
- Heavy reliance on AI models (`ModelType.TRANSCRIPTION`, `ModelType.TEXT_TO_SPEECH`)
- Advanced memory management for voice buffering
- Integration with message processing system

---

## Porting Strategy

### Phase 1: EmoteManager (Simplest)
**Rationale**: Minimal ElizaOS dependencies, mostly self-contained
**Timeline**: 1-2 hours
**Dependencies to Replace**:
- `IAgentRuntime` → FastMCP service interface
- `logger` → Custom logging solution

### Phase 2: BehaviorManager (Core Autonomous Features)
**Rationale**: Critical for autonomous agent behavior, complex AI integration
**Timeline**: 4-6 hours
**Dependencies to Replace**:
- Full AI model system
- Memory management
- State composition
- XML parsing

### Phase 3: MessageManager (Chat Processing)
**Rationale**: Essential for user interaction, moderate complexity
**Timeline**: 3-4 hours
**Dependencies to Replace**:
- Entity management system
- Memory/event system
- Message formatting

### Phase 4: VoiceManager (Most Complex)
**Rationale**: Advanced AI features, complex audio processing
**Timeline**: 6-8 hours
**Dependencies to Replace**:
- Speech-to-text models
- Text-to-speech models
- Audio buffer management

---

## Implementation Plan

### Centralized Types to Add

**AI Integration Types**:
```typescript
interface AIModelInterface {
  generateText(prompt: string): Promise<string>;
  transcribeAudio(audioBuffer: Buffer): Promise<string>;
  synthesizeSpeech(text: string): Promise<Buffer>;
}

interface FastMCPRuntime {
  aiModel: AIModelInterface;
  logger: LogType;
  worldState: HyperfyWorldState;
  generateUUID(): string;
}
```

**Memory & State Types**:
```typescript
interface FastMCPMemory {
  id: string;
  content: string;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface BehaviorState {
  worldState: HyperfyWorldState;
  recentMessages: FastMCPMemory[];
  agentStatus: AgentStatus;
}
```

### Custom Utility Functions
```typescript
// Replace ElizaOS utilities
function parseXMLResponse(xmlString: string): BehaviorResponse;
function composePromptFromState(state: BehaviorState, template: string): string;
function formatTimestamp(timestamp: number): string;
```

### Integration Points

1. **Service Integration**: All managers access HyperfyService through FastMCP runtime
2. **AI Model Access**: Centralized AI interface for all model calls
3. **State Management**: Unified state system across all managers
4. **Event System**: FastMCP-compatible event emission and handling

---

## Next Steps

1. **Start with EmoteManager**: Port the simplest manager first to establish patterns
2. **Create AI Interface**: Design FastMCP AI model integration system
3. **Port BehaviorManager**: Critical autonomous behavior functionality
4. **Complete Message/Voice**: Finish user interaction systems

**Priority**: BehaviorManager is the most critical for autonomous agent functionality and should be prioritized after EmoteManager patterns are established.

## ✅ **All Managers Successfully Ported**

**Summary**: All 4 core managers have been successfully ported to FastMCP:
- ✅ **BehaviorManager**: Autonomous agent behavior (15-30s intervals)
- ✅ **EmoteManager**: Avatar emote and animation management  
- ✅ **MessageManager**: Chat processing and AI response generation
- ✅ **VoiceManager**: Voice input/output with LiveKit integration

**Next Phase**: Provider porting to complete the FastMCP transformation.
