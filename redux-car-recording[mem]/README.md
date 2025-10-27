# Car Recording System for GTA San Andreas (CLEO Redux)

A TypeScript implementation of the car recording system for GTA San Andreas using CLEO Redux. This allows you to record and playback vehicle movements with full physics data.

## Features

- **Full vehicle state capture**: Position, rotation, velocity, angular velocity, and control inputs
- **Efficient binary format**: 48 bytes per frame with INT16 compression
- **Real-time recording**: Frame-based recording tied to game timer (FPS-independent)
- **Smooth playback**: Automatic frame interpolation and timing synchronization
- **Memory efficient**: Configurable frame limit (~13,650 frames = 640KB by default)
- **Visual feedback**: Optional on-screen info display during recording/playback
- **Loop support**: Continuous playback with automatic restart

## File Structure

```
CarRecording.ts           - Core data structures (CarRecording, CarRecordingFrame)
CarRecordingRecorder.ts   - Recording implementation
CarRecordingViewer.ts     - Playback implementation
exports.ts                - Module exports
example-recorder-viewer.ts - Complete usage example
```

## Quick Start

### Recording

```typescript
import { CarRecordingRecorder } from "./CarRecordingRecorder";

const player = new Player(0);
const car = player.storeCarIsInNoSave();

// Create recorder with info display enabled
const recorder = new CarRecordingRecorder(car, true);

// Start recording
recorder.start();

// Update every frame
(async function() {
    while (recorder.isActive()) {
        await asyncWait(0);
        const hasSpace = recorder.update();
        if (!hasSpace) {
            recorder.stop(); // Memory full
        }
    }
})();

// Get recording buffer
const buffer = recorder.toBuffer();
```

### Playback

```typescript
import { CarRecordingViewer } from "./CarRecordingViewer";

// Create vehicle for playback
const car = Car.Create(411, x, y, z); // Infernus

// Create viewer with loop enabled
const viewer = CarRecordingViewer.fromBuffer(car, buffer, true, true);

// Start playback
viewer.start();

// Update every frame
(async function() {
    while (true) {
        await asyncWait(0);
        const frameIndex = viewer.update();
        if (frameIndex === -1) {
            break; // Playback ended
        }
    }
})();
```

## API Reference

### CarRecordingRecorder

#### Constructor
```typescript
constructor(car: Car, showInfo?: boolean, maxFrames?: number)
```
- `car`: Vehicle to record
- `showInfo`: Show on-screen recording info (default: false)
- `maxFrames`: Maximum frames to record (default: 13650)

#### Methods
- `start()`: Start recording
- `stop()`: Stop recording
- `update()`: Update recording (call every frame), returns false if memory full
- `isActive()`: Check if currently recording
- `getRecording()`: Get CarRecording object
- `getStats()`: Get recording statistics
- `toBuffer()`: Export to binary ArrayBuffer

### CarRecordingViewer

#### Constructor
```typescript
constructor(car: Car, recording: CarRecording, showInfo?: boolean, loop?: boolean)
```
- `car`: Vehicle for playback
- `recording`: CarRecording to play
- `showInfo`: Show on-screen playback info (default: false)
- `loop`: Loop playback automatically (default: false)

#### Methods
- `start()`: Start playback from beginning
- `stop()`: Stop playback
- `pause()`: Pause playback
- `resume()`: Resume playback
- `seekToFrame(index)`: Jump to specific frame
- `update()`: Update playback (call every frame), returns current frame or -1 if ended
- `isActive()`: Check if currently playing
- `getStats()`: Get playback statistics
- `static fromBuffer(car, buffer, showInfo?, loop?)`: Create viewer from ArrayBuffer

### CarRecording

#### Methods
- `addFrame(frame)`: Add a frame
- `getFrame(index)`: Get frame at index
- `getFrameCount()`: Get total frames
- `getDuration()`: Get duration in seconds
- `getProgress(currentFrame)`: Get playback progress percentage
- `toBuffer()`: Serialize to binary
- `static fromBuffer(buffer)`: Deserialize from binary
- `clear()`: Remove all frames

### CarRecordingFrame

Represents a single frame (48 bytes):
- `timestamp`: Time in milliseconds
- `rotation`: Rotation matrix (right & up vectors)
- `position`: World position (x, y, z)
- `movementSpeed`: Velocity vector
- `turnSpeed`: Angular velocity vector
- `controls`: Steering, accelerator, brake, handbrake, horn

## Binary Format

Each recording file (.cr) consists of:

### Header (12 bytes)
- `0x00` (4 bytes): Global timer (for playback sync)
- `0x04` (4 bytes): File size in bytes
- `0x08` (4 bytes): Current frame number (playback state)

### Frame Data (48 bytes per frame)
- `0x00` (4 bytes): Timestamp (INT32)
- `0x04` (6 bytes): Rotation right vector (3 × INT16, compressed ×30000)
- `0x0A` (6 bytes): Rotation up vector (3 × INT16, compressed ×30000)
- `0x10` (12 bytes): Position (3 × FLOAT)
- `0x1C` (6 bytes): Movement speed (3 × INT16, compressed ×10000)
- `0x22` (6 bytes): Turn speed (3 × INT16, compressed ×10000)
- `0x28` (1 byte): Steering angle (INT8, ×20)
- `0x29` (1 byte): Accelerator (INT8, ×100)
- `0x2A` (1 byte): Brake (INT8, ×100)
- `0x2B` (1 byte): Handbrake status
- `0x2C` (1 byte): Horn status
- `0x2D` (3 bytes): Reserved

## Vehicle Struct Offsets (CVehicle)

The implementation uses direct memory access to the vehicle struct:

### Matrix (Rotation)
- `0x04`: Right vector X (FLOAT)
- `0x08`: Right vector Y (FLOAT)
- `0x0C`: Right vector Z (FLOAT)
- `0x14`: Forward vector X (FLOAT)
- `0x18`: Forward vector Y (FLOAT)
- `0x1C`: Forward vector Z (FLOAT)
- `0x24`: Up vector X (FLOAT)
- `0x28`: Up vector Y (FLOAT)
- `0x2C`: Up vector Z (FLOAT)

### Physics
- `0x70`: Movement speed X (FLOAT)
- `0x74`: Movement speed Y (FLOAT)
- `0x78`: Movement speed Z (FLOAT)
- `0x7C`: Turn speed X (FLOAT)
- `0x80`: Turn speed Y (FLOAT)
- `0x84`: Turn speed Z (FLOAT)

### Controls
- `0x46C`: Steering angle (FLOAT)
- `0x470`: Accelerator pedal (FLOAT)
- `0x474`: Brake pedal (FLOAT)
- `0x479`: Handbrake status (BYTE)
- `0x4C0`: Horn status (BYTE)

## Notes

- Recordings are FPS-independent (use game timer)
- Compatible with the original CLEO .cr file format
- Requires CLEO Redux with TypeScript support
- Vehicle must have `setStatus(1)` for proper physics during playback
- For boats/helis/planes, use `setStatus(0)` and add a driver ped

## TODO

- Implement file I/O helpers for saving/loading .cr files
- Add support for object recording (.or format)
- Add frame interpolation for smoother playback
- Add recording compression/optimization
- Add recording editing capabilities (trim, merge, etc.)

## Credits

Based on the original CLEO car recording system by [Original Author].
TypeScript implementation for CLEO Redux.