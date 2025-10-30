# Native Car Recording Viewer

This document explains the new `NativeCarRecordingViewer` class that injects car recordings directly into GTA San Andreas's native `CVehicleRecording` system.

## Overview

The `NativeCarRecordingViewer` provides a more efficient and compatible way to play back car recordings compared to the manual frame-by-frame approach in `CarRecordingViewer`. Instead of manually writing vehicle state every frame from TypeScript, it leverages the game's built-in recording playback system.

## Key Differences

### Manual Viewer (`CarRecordingViewer`)
- Manually writes to vehicle memory every frame from TypeScript
- Requires continuous script execution
- May have slight timing inconsistencies
- No integration with game AI systems

### Native Viewer (`NativeCarRecordingViewer`)
- Injects recording into game's native `CVehicleRecording` system
- Game engine handles playback automatically
- Perfect frame timing and interpolation
- Supports Car AI for path following
- Can use up to 16 simultaneous playbacks

## How It Works

The native viewer works by directly manipulating the game's `CVehicleRecording` static arrays at their memory addresses:

```typescript
// CVehicleRecording static arrays (each has 16 slots)
private static readonly ADDR_VEHICLE_FOR_PLAYBACK = 0x97D840;  // CVehicle*[16]
private static readonly ADDR_PLAYBACK_BUFFER = 0x97D800;       // CVehicleStateEachFrame*[16]
private static readonly ADDR_PLAYBACK_INDEX = 0x97D7C0;        // int32[16]
private static readonly ADDR_PLAYBACK_BUFFER_SIZE = 0x97D780;  // int32[16]
private static readonly ADDR_PLAYBACK_RUNNING_TIME = 0x97D740; // float[16]
private static readonly ADDR_PLAYBACK_SPEED = 0x97D700;        // float[16]
private static readonly ADDR_PLAYBACK_GOING_ON = 0x97D6F0;     // bool[16]
private static readonly ADDR_PLAYBACK_LOOPED = 0x97D6E0;       // bool[16]
private static readonly ADDR_PLAYBACK_PAUSED = 0x97D6D0;       // bool[16]
private static readonly ADDR_USE_CAR_AI = 0x97D6C0;            // bool[16]
```

These addresses are from `gta-reversed/source/game_sa/VehicleRecording.h:60-72`.

## Usage Example

### Basic Playback (No AI)

```typescript
import { NativeCarRecordingViewer } from "./NativeCarRecordingViewer";

// Load recording from file
const viewer = NativeCarRecordingViewer.loadFromFile("carrec900.rrr");

// Get player's vehicle
const playerPed = playerChar();
const vehicleHandle = getCarCharIsUsing(playerPed);

// Start playback (no AI, looped)
if (viewer.startPlayback(vehicleHandle, false, true)) {
    log("Playback started!");
}

// Stop playback
viewer.stopPlayback();
```

### Playback with Car AI

```typescript
// Start playback with AI (vehicle will use autopilot)
if (viewer.startPlayback(vehicleHandle, true, true)) {
    log("AI playback started!");
}
```

### Controlling Playback

```typescript
// Pause/Resume
viewer.pause();
viewer.resume();

// Change speed
viewer.setPlaybackSpeed(2.0);  // 2x speed
viewer.setPlaybackSpeed(0.5);  // Half speed

// Check status
if (viewer.isPlaying()) {
    const slot = viewer.getPlaybackSlot();  // 0-15
    const frame = viewer.getCurrentFrameIndex();
    const time = viewer.getCurrentTime();  // milliseconds
}
```

### Static Utilities

```typescript
// Stop all active playbacks in the game
NativeCarRecordingViewer.stopAllPlaybacks();

// Get all active playback slots
const activeSlots = NativeCarRecordingViewer.getActivePlaybackSlots();
// Returns: [0, 3, 7] (example - slots currently in use)
```

## Playback Modes

### Mode 1: No AI (Physics Disabled)
```typescript
viewer.startPlayback(vehicleHandle, false, true);
```
- Vehicle follows the recording exactly
- Physics and collision are disabled
- Vehicle becomes a "ghost" that can't interact with world
- Best for cinematic replays

### Mode 2: With Car AI (Autopilot)
```typescript
viewer.startPlayback(vehicleHandle, true, true);
```
- Vehicle uses autopilot to follow the recorded path
- Collision and physics remain active
- Vehicle can interact with traffic and obstacles
- May deviate slightly from recording if blocked
- Best for realistic AI traffic

## Implementation Details

### Memory Management

The viewer allocates memory for the recording frames and maintains a pointer to this memory throughout playback:

1. Allocates memory via `Memory.Allocate(totalSize)`
2. Copies all frames to allocated memory
3. Sets `CVehicleRecording::pPlaybackBuffer[slot]` to point to this memory
4. Game's `SaveOrRetrieveDataForThisFrame()` reads from this buffer
5. Frees memory on `stopPlayback()`

### Playback Slot Management

The game supports 16 simultaneous vehicle recordings (`TOTAL_VEHICLE_RECORDS = 16`). The viewer:

1. Finds an inactive slot by checking `bPlaybackGoingOn[i]` for each slot
2. Claims the slot by setting up all static arrays
3. Game automatically processes active slots every frame
4. Releases the slot on stop by clearing arrays

### Game Integration

When playback starts:

**Without AI:**
- Sets `m_nPhysicalFlags.bDisableCollisionForce = true`
- Game's `CVehicleRecording::SaveOrRetrieveDataForThisFrame()` applies frames
- `CVehicleRecording::RestoreInfoForCar()` writes steering, pedals, etc.
- `CVehicleRecording::RestoreInfoForMatrix()` writes position and rotation

**With AI:**
- Sets `m_autoPilot.m_nCarMission = MISSION_FOLLOW_PRE_RECORDED_PATH` (14)
- Sets `m_autoPilot.field_94 = playbackSlot`
- AI system uses recording as a navigation path
- Vehicle's driver controls the car following the path

## Comparison with LDYOM's Implementation

This implementation is directly inspired by LDYOM's `CarrecPathsService::startPlaybackRecordedCar()`:

**Similarities:**
- Both manipulate the same `CVehicleRecording` static arrays
- Both support AI and non-AI modes
- Both handle looping and cleanup

**Differences:**
- LDYOM is C++ native code injected into the game
- This implementation is TypeScript using CLEO Redux memory APIs
- LDYOM has access to game functions directly (via Plugin-SDK)
- This implementation must manually read/write memory addresses

## Memory Addresses Reference

All addresses are from `gta-reversed/source/game_sa/VehicleRecording.h`:

| Array | Address | Type | Size | Purpose |
|-------|---------|------|------|---------|
| `pVehicleForPlayback` | `0x97D840` | `CVehicle*[16]` | 64 bytes | Pointer to vehicle being controlled |
| `pPlaybackBuffer` | `0x97D800` | `CVehicleStateEachFrame*[16]` | 64 bytes | Pointer to frame data |
| `PlaybackIndex` | `0x97D7C0` | `int32[16]` | 64 bytes | Current byte index in buffer |
| `PlaybackBufferSize` | `0x97D780` | `int32[16]` | 64 bytes | Total byte size of recording |
| `PlaybackRunningTime` | `0x97D740` | `float[16]` | 64 bytes | Current playback time (ms) |
| `PlaybackSpeed` | `0x97D700` | `float[16]` | 64 bytes | Speed multiplier (default 1.0) |
| `bPlaybackGoingOn` | `0x97D6F0` | `bool[16]` | 16 bytes | Is this slot active? |
| `bPlaybackLooped` | `0x97D6E0` | `bool[16]` | 16 bytes | Should playback loop? |
| `bPlaybackPaused` | `0x97D6D0` | `bool[16]` | 16 bytes | Is playback paused? |
| `bUseCarAI` | `0x97D6C0` | `bool[16]` | 16 bytes | Use autopilot AI? |

## Example Scripts

See `example-native-viewer.ts` for a complete working example with keyboard controls:

**Controls:**
- `CTRL+P`: Start native playback (no AI, looped)
- `CTRL+SHIFT+P`: Start native playback with Car AI
- `CTRL+S`: Stop playback
- `CTRL+[`: Decrease playback speed
- `CTRL+]`: Increase playback speed
- `CTRL+SPACE`: Pause/Resume playback

## Limitations

1. **Maximum 16 simultaneous playbacks** - This is a game engine limitation
2. **No hot-swapping vehicles** - Must stop and restart to change vehicles
3. **Memory must persist** - Allocated memory must remain valid during playback
4. **Address hardcoding** - Addresses are specific to GTA SA v1.0 US

## Advantages Over Manual Viewer

✅ **Performance**: Game engine handles playback (C++ native code)
✅ **Timing**: Perfect frame interpolation and timing
✅ **Compatibility**: Works with game's AI and physics systems
✅ **Efficiency**: No TypeScript overhead per frame
✅ **Multiple playbacks**: Support for 16 simultaneous vehicles
✅ **Advanced features**: Speed control, pause/resume, AI modes

## Future Enhancements

Potential improvements:

- **Hot-reload support**: Update recording while playing
- **Frame seeking**: Jump to specific frame index
- **Reverse playback**: Play recording backwards
- **Recording chaining**: Seamlessly transition between recordings
- **Networked playback**: Sync playback across multiplayer
- **Recording editor**: Cut, splice, and modify recordings

## Credits

Implementation based on:
- **gta-reversed**: `source/game_sa/VehicleRecording.h` and `.cpp`
- **LDYOM**: `source/LDYOM_R/utils/CarrecPathsService.h` and `.cpp`
- **Original research**: Analysis of GTA SA's car recording system

## See Also

- `CarRecording.ts` - Frame data structures
- `CarRecordingRecorder.ts` - Recording vehicles
- `CarRecordingViewer.ts` - Manual playback viewer
- `example-native-viewer.ts` - Complete usage example
