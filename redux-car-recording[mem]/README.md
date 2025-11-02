# Vehicle Recording System for GTA San Andreas

A comprehensive TypeScript-based vehicle recording and playback system for GTA San Andreas using CLEO Redux. This system allows you to record vehicle movements and play them back using either custom frame-by-frame playback or native GTA SA game mechanics.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [File Structure](#file-structure)
- [Technical Details](#technical-details)
- [API Reference](#api-reference)

## Overview

This module provides two distinct approaches to vehicle recording and playback:

1. **Custom Recording System**: Manual frame-by-frame recording and playback with full control over vehicle state
2. **Native Recording System**: Integration with GTA SA's built-in `CVehicleRecording` system for seamless compatibility with game mechanics

Both systems work with the same binary `.rrr` recording format, matching GTA SA's `CVehicleStateEachFrame` structure (32 bytes per frame).

## Architecture

### Custom Car Recording System (`custom-car-recording/`)

The custom system provides manual control over recording and playback:

- **CarRecording.ts**: Core data structures for vehicle state frames
  - `FixedVector3`: 3D vector with fixed-point compression
  - `VehicleStateEachFrame`: Complete vehicle state (32 bytes) - position, velocity, orientation, controls
  - `CarRecording`: Collection of frames with search/interpolation utilities

- **CarRecordingRecorder.ts**: Records vehicle movement data in real-time
  - Captures vehicle state at ~30 FPS with randomized intervals
  - Reads directly from vehicle memory (velocity, orientation, pedals, etc.)
  - Toggle recording with `SHIFT+R` while in a vehicle
  - Auto-increments filename (rec1.rrr, rec2.rrr, etc.)

- **CarRecordingViewer.ts**: Manual frame-by-frame playback
  - Interpolates between frames for smooth playback
  - Direct memory manipulation for vehicle position, velocity, and orientation
  - Supports playback speed control and looping
  - Disables collision during playback

### Native Car Recording System (`native-car-recording/`)

The native system integrates with GTA SA's built-in recording infrastructure:

- **NativeCarRecordingInjector.ts**: Injects recordings into the game's StreamingArray
  - Allocates memory using `CMemoryMgr::Malloc` for safe game integration
  - Injects into one of 475 available StreamingArray slots
  - Auto-assigns file numbers (900-998) for custom recordings
  - Enables usage with native opcodes like `car.startPlayback(fileNumber)`

- **NativeCarRecordingViewer.ts**: Uses native CVehicleRecording system (16 playback slots)
  - Leverages game's built-in playback mechanism
  - Supports AI-driven playback (vehicle follows path using autopilot)
  - Or physics-disabled playback (direct frame application)
  - More efficient and compatible with game systems

### GUI System (`gui/`)

- **VehicleRecordingMenuImGui.ts**: ImGui-based recording manager
  - Browse and select recordings from the `recordings/` folder
  - Configure multiple recordings for simultaneous playback
  - Set start delays for each recording
  - Option to warp player as passenger during playback
  - Paginated list view for large recording collections

## Features

### Recording
- **Hotkey Toggle**: Press `SHIFT+R` while in a vehicle to start/stop recording
- **Automatic File Naming**: Recordings are auto-numbered (rec1.rrr, rec2.rrr, etc.)
- **Optimized Capture**: Records at ~33ms intervals with random variance (50ms) to reduce file size
- **Complete Vehicle State**: Captures position, velocity, orientation (right/top vectors), steering angle, gas/brake pedals, handbrake

### Playback
- **Multiple Simultaneous Playbacks**: Play several recordings at once with individual start delays
- **Player Integration**: Option to warp player as passenger in playback vehicles
- **Native Game Integration**: Use injected recordings with GTA SA opcodes
- **Smooth Interpolation**: Frame interpolation for fluid motion
- **Playback Controls**: Pause, resume, seek, speed control

### Data Format
- **Binary Format**: Efficient `.rrr` files (32 bytes per frame)
- **Compressed Vectors**: Fixed-point compression reduces file size
  - Velocity: int16 with scale 16383.5
  - Orientation: int8 with scale 127.0
  - Controls: uint8 with appropriate scales
- **Compatible**: Matches GTA SA's native `CVehicleStateEachFrame` structure

## Installation

1. Ensure you have CLEO Redux installed in your GTA San Andreas directory
2. Place the `redux-car-recording[mem]` folder in your CLEO Redux scripts directory
3. Create a `recordings/` subfolder for storing `.rrr` files
4. Launch GTA San Andreas

## Usage

### Recording a Vehicle Path

1. Get into any vehicle in-game
2. Press `SHIFT+R` to start recording
3. Drive the desired path
4. Press `SHIFT+R` again to stop recording
5. The recording is saved to `redux-car-recording[mem]/recordings/recN.rrr`

### Playing Back Recordings

The main script (`index.ts`) automatically:
1. Scans the `recordings/` folder for `.rrr` files on startup
2. Provides an ImGui menu for selecting and configuring playbacks
3. Handles vehicle creation, driver assignment, and synchronized playback

**Playback Configuration:**
- Select recordings using checkboxes
- Set individual start delays (in milliseconds)
- Choose whether player should be passenger
- Click "Play" to execute

**What Happens:**
1. Selected recordings are injected into game memory using `NativeCarRecordingInjector`
2. Vehicles (Admiral/Model 445) are spawned for each recording
3. Drivers (CivMale/Model 14) are created and warped into vehicles
4. Player is optionally warped as passenger
5. Playback begins with configured delays using native `car.startPlayback()`

## File Structure

```
redux-car-recording[mem]/
   custom-car-recording/
      CarRecording.ts              # Core data structures
      CarRecordingRecorder.ts      # Recording implementation
      CarRecordingViewer.ts        # Custom playback engine
      example-recorder.ts          # Standalone recorder example
      example-recorder-viewer.ts   # Standalone viewer example
   native-car-recording/
      NativeCarRecordingInjector.ts # StreamingArray injection
      NativeCarRecordingViewer.ts   # Native playback system
   gui/
      VehicleRecordingMenu.ts      # Menu interface (base)
      VehicleRecordingMenuImGui.ts # ImGui implementation
   recordings/                       # Storage for .rrr files
   index.ts                          # Main script
   tsconfig.json                     # TypeScript configuration
   README.md                         # This file
```

## Technical Details

### Memory Offsets (Vehicle Structure)

Based on `CVehicle` structure from gta-reversed:

```typescript
VELOCITY_X: 0x44      // m_vecMoveSpeed.x
VELOCITY_Y: 0x48      // m_vecMoveSpeed.y
VELOCITY_Z: 0x4C      // m_vecMoveSpeed.z
MATRIX: 0x14          // CPlaceable::m_matrix pointer
STEER_ANGLE: 0x494    // m_fSteerAngle
GAS_PEDAL: 0x49C      // m_fGasPedal
BRAKE_PEDAL: 0x4A0    // m_fBrakePedal
VEHICLE_FLAGS: 0x428  // m_nVehicleFlags (bit 5 = handbrake)
```

### CVehicleStateEachFrame Structure (32 bytes / 0x20)

```
Offset | Type    | Name             | Description
-------|---------|------------------|----------------------------------
0x00   | uint32  | time             | Milliseconds from recording start
0x04   | int16   | velocity_x       | Compressed velocity (scale 16383.5)
0x06   | int16   | velocity_y       |
0x08   | int16   | velocity_z       |
0x0A   | int8    | right_x          | Compressed right vector (scale 127.0)
0x0B   | int8    | right_y          |
0x0C   | int8    | right_z          |
0x0D   | int8    | top_x            | Compressed top vector (scale 127.0)
0x0E   | int8    | top_y            |
0x0F   | int8    | top_z            |
0x10   | int8    | steeringAngle    | Steering -1.0 to 1.0 (scale 20.0)
0x11   | uint8   | gasPedal         | Gas 0.0 to 1.0 (scale 100.0)
0x12   | uint8   | brakePedal       | Brake 0.0 to 1.0 (scale 100.0)
0x13   | uint8   | handbrake        | Boolean (0 or 1)
0x14   | float32 | position_x       | World position
0x18   | float32 | position_y       |
0x1C   | float32 | position_z       |
```

### StreamingArray Memory Addresses

From gta-reversed `VehicleRecording.h`:

```typescript
ADDR_STREAMING_ARRAY: 0x97D880     // CPath[475]
ADDR_NUM_PLAYBACK_FILES: 0x97F630  // int32
TOTAL_RRR_MODEL_IDS: 475           // Maximum slots
```

### CPath Structure (16 bytes / 0x10)

```
Offset | Type  | Name         | Description
-------|-------|--------------|------------------------------------
0x00   | int32 | m_nNumber    | File number (e.g., 900)
0x04   | int32 | m_pData      | Pointer to frame data
0x08   | int32 | m_nSize      | Total size in bytes
0x0C   | int8  | m_nRefCount  | Reference count
```

## API Reference

### CarRecording Class

```typescript
class CarRecording {
  frames: VehicleStateEachFrame[]

  addFrame(frame: VehicleStateEachFrame): void
  getDuration(): number
  getFrameCount(): number
  getByteSize(): number
  toBuffer(): ArrayBuffer
  static fromBuffer(buffer: ArrayBuffer): CarRecording
  getFrameAtTime(time: number): VehicleStateEachFrame | undefined
  getInterpolationFrames(time: number): [prev, next, factor] | undefined
}
```

### CarRecordingRecorder Class

```typescript
class CarRecordingRecorder {
  constructor(filePath: string)

  update(): void                    // Call every frame
  isCurrentlyRecording(): boolean
  getRecording(): CarRecording
}
```

### CarRecordingViewer Class

```typescript
class CarRecordingViewer {
  constructor(filePath: string)

  load(): boolean
  startPlayback(vehicle: Car, looped: boolean): boolean
  stopPlayback(): void
  pause(): void
  resume(): void
  setPlaybackSpeed(speed: number): void
  update(deltaTime: number): void
}
```

### NativeCarRecordingInjector Class

```typescript
class NativeCarRecordingInjector {
  constructor(recording: CarRecording)

  static loadFromFile(filePath: string): NativeCarRecordingInjector
  injectIntoGame(fileNumber?: number): number
  removeFromGame(): void
  getFileNumber(): number | null
  isInjected(): boolean
  static listRecordings(): Array<{index, fileNumber, size, frameCount, dataPtr}>
}
```

### NativeCarRecordingViewer Class

```typescript
class NativeCarRecordingViewer {
  constructor(recording: CarRecording)

  static loadFromFile(filePath: string): NativeCarRecordingViewer
  startPlayback(vehicle: Car, useCarAI: boolean, looped: boolean): boolean
  stopPlayback(): void
  pause(): void
  resume(): void
  setPlaybackSpeed(speed: number): void
  getCurrentTime(): number
  getCurrentFrameIndex(): number
  static stopAllPlaybacks(): void
  static getActivePlaybackSlots(): number[]
}
```

## Examples

### Example 1: Simple Recording

```typescript
import { CarRecordingRecorder } from './custom-car-recording/CarRecordingRecorder';

const recorder = new CarRecordingRecorder('./recordings/myrecording');

while (true) {
  wait(0);
  recorder.update(); // Handles SHIFT+R toggle and recording
}
```

### Example 2: Custom Playback

```typescript
import { CarRecordingViewer } from './custom-car-recording/CarRecordingViewer';

const viewer = new CarRecordingViewer('./recordings/rec1.rrr');
viewer.load();

const vehicle = Car.Create(445, 0, 0, 0); // Create Admiral
viewer.startPlayback(vehicle, true); // Start looped playback

while (viewer.isCurrentlyPlaying()) {
  wait(0);
  viewer.update(16.67); // ~60 FPS
}
```

### Example 3: Native Injection

```typescript
import { NativeCarRecordingInjector } from './native-car-recording/NativeCarRecordingInjector';

// Load and inject recording
const injector = NativeCarRecordingInjector.loadFromFile('./recordings/rec1.rrr');
const fileNumber = injector.injectIntoGame(); // Returns 900

// Now use with native opcode
const vehicle = Car.Create(445, 0, 0, 0);
vehicle.startPlayback(fileNumber);

// Cleanup when done
Streaming.RemoveCarRecording(fileNumber);
```

## Performance Considerations

- **Recording Interval**: Default 100ms + 0-50ms random variance balances file size and smoothness
- **Frame Size**: 32 bytes per frame means ~1MB for 8.5 hours of recording
- **Memory Management**: Native injection uses `CMemoryMgr::Malloc` to prevent memory leaks
- **Simultaneous Playback**: Limited by game's 16 native playback slots and 475 StreamingArray slots

## License

This project is part of the gta-reversed and CLEO Redux ecosystem. Refer to parent project licenses.

## Credits

- Based on the `CVehicle` and `CVehicleRecording` structures from [gta-reversed](https://github.com/gta-reversed/gta-reversed-modern)
- Uses [CLEO Redux](https://re.cleo.li/) scripting runtime
- Original game: Rockstar North / Rockstar Games
