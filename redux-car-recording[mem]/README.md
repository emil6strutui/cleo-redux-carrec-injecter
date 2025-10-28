# Car Recording System for GTA San Andreas

A complete car recording and playback system for CLEO Redux, matching the binary format from the original game engine.

## Features

- Record vehicle movement data including:
  - Position and orientation
  - Velocity
  - Steering angle
  - Gas, brake, and handbrake inputs
- Binary file format compatible with GTA SA's `.rrr` format
- Smooth playback with frame interpolation
- Configurable recording intervals
- Easy-to-use TypeScript API

## Structure

The system consists of three main components:

### CarRecording
The core data structure that holds vehicle state frames. Each frame contains:
- Time (milliseconds from start)
- Velocity vector (compressed as int16)
- Right/Top orientation vectors (compressed as int8)
- Steering angle, gas, brake, handbrake
- World position

### CarRecordingRecorder
Records vehicle movement data:
- Press **SHIFT+R** to start/stop recording
- Records at ~225ms intervals with randomness
- Automatically saves to binary file
- Only records when player is in a vehicle

### CarRecordingViewer
Plays back recorded data:
- Load `.rrr` files
- Apply recorded movement to vehicles
- Supports playback speed control
- Frame interpolation for smooth playback
- Loop support

## Usage

### Recording

```typescript
import { CarRecordingRecorder } from './CarRecordingRecorder';

const recorder = new CarRecordingRecorder('./recordings/my_recording.rrr', 900);

// In your main loop
while (true) {
    wait(0);
    recorder.update();
}
```

Press **SHIFT+R** while in a vehicle to toggle recording.

### Playback

```typescript
import { CarRecordingViewer } from './CarRecordingViewer';

const viewer = new CarRecordingViewer('./recordings/my_recording.rrr');
viewer.load();

// Start playback on a vehicle
const vehicle = playerChar.storeCarIsInNoSave();
viewer.startPlayback(vehicle, false); // false = don't loop

// In your main loop
while (true) {
    wait(0);
    const deltaTime = 16.67; // or calculate from timer
    viewer.update(deltaTime);
}
```

## Examples

See the example scripts:
- `example-recorder.ts` - Simple recording script
- `example-viewer.ts` - Simple playback script

## File Format

The recording format matches GTA SA's CVehicleStateEachFrame structure (32 bytes per frame):

```
Offset | Size | Type   | Description
-------|------|--------|------------------
0x00   | 4    | uint32 | Time (milliseconds)
0x04   | 6    | int16  | Velocity (x, y, z) * 16383.5
0x0A   | 3    | int8   | Right vector (x, y, z) * 127.0
0x0D   | 3    | int8   | Top vector (x, y, z) * 127.0
0x10   | 1    | int8   | Steering angle * 20.0
0x11   | 1    | uint8  | Gas pedal * 100.0
0x12   | 1    | uint8  | Brake pedal * 100.0
0x13   | 1    | bool   | Handbrake
0x14   | 12   | float  | Position (x, y, z)
```

## Vehicle Memory Offsets

Based on the CVehicle structure from gta-reversed:

```
0x14  - Matrix pointer
0x44  - Velocity X
0x48  - Velocity Y
0x4C  - Velocity Z
0x428 - Vehicle flags (bit 5 = handbrake)
0x494 - Steering angle
0x49C - Gas pedal
0x4A0 - Brake pedal
```

## Notes

- Recording files are saved in binary format (`.rrr`)
- Each frame is exactly 32 bytes
- Recordings use fixed-point compression to save space
- The system requires direct memory access to vehicle data
- Compatible with gta-reversed and original GTA SA

## Credits

Based on the car recording system from:
- Original GTA San Andreas implementation
- gta-reversed project (CVehicleRecording)
- CLEO Redux scripting system