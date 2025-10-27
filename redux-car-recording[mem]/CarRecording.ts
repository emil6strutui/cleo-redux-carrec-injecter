/**
 * Represents a 3D vector for position or velocity
 */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Represents a 3x3 rotation matrix (right and up vectors)
 * The "at" vector can be calculated from cross product of right and up
 */
export interface RotationMatrix {
    right: Vector3;
    up: Vector3;
}

/**
 * Represents the vehicle control inputs
 */
export interface VehicleControls {
    /** Steering angle: negative = wheels right, positive = wheels left */
    steeringAngle: number;
    /** Accelerator pedal power (0.0 to 1.0) */
    accelerator: number;
    /** Brake pedal power (0.0 to 1.0) */
    brake: number;
    /** Hand brake status (16 = off, 48 = on) */
    handBrake: number;
    /** Horn status (0 = off, non-zero = on) */
    horn: number;
}

/**
 * Represents a single frame in the car recording
 * Frame size: 0x30 (48) bytes
 */
export class CarRecordingFrame {
    /** Timestamp in milliseconds */
    public timestamp: number;

    /** Rotation matrix (right and up vectors as INT16 compressed) */
    public rotation: RotationMatrix;

    /** Position in world coordinates (x, y, z as FLOAT) */
    public position: Vector3;

    /** Movement speed/push (velocity) */
    public movementSpeed: Vector3;

    /** Turn speed (angular velocity) */
    public turnSpeed: Vector3;

    /** Vehicle control inputs */
    public controls: VehicleControls;

    constructor(
        timestamp: number = 0,
        rotation: RotationMatrix = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 } },
        position: Vector3 = { x: 0, y: 0, z: 0 },
        movementSpeed: Vector3 = { x: 0, y: 0, z: 0 },
        turnSpeed: Vector3 = { x: 0, y: 0, z: 0 },
        controls: VehicleControls = { steeringAngle: 0, accelerator: 0, brake: 0, handBrake: 16, horn: 0 }
    ) {
        this.timestamp = timestamp;
        this.rotation = rotation;
        this.position = position;
        this.movementSpeed = movementSpeed;
        this.turnSpeed = turnSpeed;
        this.controls = controls;
    }

    /**
     * Serialize frame to binary buffer (48 bytes)
     *
     * Frame structure:
     * 0x00 - INT32 - Timestamp in ms
     * 0x04 - INT16 - rotation.right.x (compressed × 30000)
     * 0x06 - INT16 - rotation.right.y
     * 0x08 - INT16 - rotation.right.z
     * 0x0A - INT16 - rotation.up.x
     * 0x0C - INT16 - rotation.up.y
     * 0x0E - INT16 - rotation.up.z
     * 0x10 - FLOAT - position.x
     * 0x14 - FLOAT - position.y
     * 0x18 - FLOAT - position.z
     * 0x1C - INT16 - movementSpeed.x (compressed × 10000)
     * 0x1E - INT16 - movementSpeed.y
     * 0x20 - INT16 - movementSpeed.z
     * 0x22 - INT16 - turnSpeed.x
     * 0x24 - INT16 - turnSpeed.y
     * 0x26 - INT16 - turnSpeed.z
     * 0x28 - INT8 - steering angle (× 20)
     * 0x29 - INT8 - accelerator (× 100)
     * 0x2A - INT8 - brake (× 100)
     * 0x2B - INT8 - hand brake status
     * 0x2C - INT8 - horn status
     * 0x2D-0x2F - 3 bytes reserved
     */
    toBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(0x30); // 48 bytes
        const view = new DataView(buffer);

        // 0x00: Timestamp (INT32)
        view.setInt32(0x00, this.timestamp, true);

        // 0x04-0x0E: Rotation matrix (6 × INT16)
        view.setInt16(0x04, this.compressRotation(this.rotation.right.x), true);
        view.setInt16(0x06, this.compressRotation(this.rotation.right.y), true);
        view.setInt16(0x08, this.compressRotation(this.rotation.right.z), true);
        view.setInt16(0x0A, this.compressRotation(this.rotation.up.x), true);
        view.setInt16(0x0C, this.compressRotation(this.rotation.up.y), true);
        view.setInt16(0x0E, this.compressRotation(this.rotation.up.z), true);

        // 0x10-0x18: Position (3 × FLOAT)
        view.setFloat32(0x10, this.position.x, true);
        view.setFloat32(0x14, this.position.y, true);
        view.setFloat32(0x18, this.position.z, true);

        // 0x1C-0x26: Movement and turn speed (6 × INT16)
        view.setInt16(0x1C, this.compressSpeed(this.movementSpeed.x), true);
        view.setInt16(0x1E, this.compressSpeed(this.movementSpeed.y), true);
        view.setInt16(0x20, this.compressSpeed(this.movementSpeed.z), true);
        view.setInt16(0x22, this.compressSpeed(this.turnSpeed.x), true);
        view.setInt16(0x24, this.compressSpeed(this.turnSpeed.y), true);
        view.setInt16(0x26, this.compressSpeed(this.turnSpeed.z), true);

        // 0x28-0x2C: Controls (5 × INT8)
        view.setInt8(0x28, Math.round(this.controls.steeringAngle * 20));
        view.setInt8(0x29, Math.round(this.controls.accelerator * 100));
        view.setInt8(0x2A, Math.round(this.controls.brake * 100));
        view.setInt8(0x2B, this.controls.handBrake);
        view.setInt8(0x2C, this.controls.horn);

        // 0x2D-0x2F: Reserved (3 bytes, set to 0)
        view.setUint8(0x2D, 0);
        view.setUint8(0x2E, 0);
        view.setUint8(0x2F, 0);

        return buffer;
    }

    /**
     * Deserialize frame from binary buffer
     */
    static fromBuffer(buffer: ArrayBuffer, offset: number = 0): CarRecordingFrame {
        const view = new DataView(buffer, offset, 0x30);

        const timestamp = view.getInt32(0x00, true);

        const rotation: RotationMatrix = {
            right: {
                x: CarRecordingFrame.decompressRotation(view.getInt16(0x04, true)),
                y: CarRecordingFrame.decompressRotation(view.getInt16(0x06, true)),
                z: CarRecordingFrame.decompressRotation(view.getInt16(0x08, true)),
            },
            up: {
                x: CarRecordingFrame.decompressRotation(view.getInt16(0x0A, true)),
                y: CarRecordingFrame.decompressRotation(view.getInt16(0x0C, true)),
                z: CarRecordingFrame.decompressRotation(view.getInt16(0x0E, true)),
            }
        };

        const position: Vector3 = {
            x: view.getFloat32(0x10, true),
            y: view.getFloat32(0x14, true),
            z: view.getFloat32(0x18, true),
        };

        const movementSpeed: Vector3 = {
            x: CarRecordingFrame.decompressSpeed(view.getInt16(0x1C, true)),
            y: CarRecordingFrame.decompressSpeed(view.getInt16(0x1E, true)),
            z: CarRecordingFrame.decompressSpeed(view.getInt16(0x20, true)),
        };

        const turnSpeed: Vector3 = {
            x: CarRecordingFrame.decompressSpeed(view.getInt16(0x22, true)),
            y: CarRecordingFrame.decompressSpeed(view.getInt16(0x24, true)),
            z: CarRecordingFrame.decompressSpeed(view.getInt16(0x26, true)),
        };

        const controls: VehicleControls = {
            steeringAngle: view.getInt8(0x28) / 20.0,
            accelerator: view.getInt8(0x29) / 100.0,
            brake: view.getInt8(0x2A) / 100.0,
            handBrake: view.getUint8(0x2B),
            horn: view.getUint8(0x2C),
        };

        return new CarRecordingFrame(timestamp, rotation, position, movementSpeed, turnSpeed, controls);
    }

    /**
     * Compress rotation value to INT16 (multiply by 30000)
     */
    private compressRotation(value: number): number {
        return Math.max(-32768, Math.min(32767, Math.round(value * 30000)));
    }

    /**
     * Decompress rotation value from INT16 (divide by 30000)
     */
    private static decompressRotation(value: number): number {
        return value / 30000.0;
    }

    /**
     * Compress speed value to INT16 (multiply by 10000)
     */
    private compressSpeed(value: number): number {
        return Math.max(-32768, Math.min(32767, Math.round(value * 10000)));
    }

    /**
     * Decompress speed value from INT16 (divide by 10000)
     */
    private static decompressSpeed(value: number): number {
        return value / 10000.0;
    }
}

/**
 * Represents a complete car recording with header and frames
 */
export class CarRecording {
    /** Global timer for playback synchronization */
    private globalTimer: number = 0;

    /** Total file size */
    private fileSize: number = 0;

    /** Current frame number for recording/playback */
    private currentFrameNumber: number = 0;

    /** Array of recorded frames */
    public frames: CarRecordingFrame[] = [];

    constructor(frames: CarRecordingFrame[] = []) {
        this.frames = frames;
        this.updateFileSize();
    }

    /**
     * Add a frame to the recording
     */
    addFrame(frame: CarRecordingFrame): void {
        this.frames.push(frame);
        this.updateFileSize();
    }

    /**
     * Update file size based on current frame count
     */
    private updateFileSize(): void {
        this.fileSize = 0x0C + (this.frames.length * 0x30);
    }

    /**
     * Get total frame count
     */
    getFrameCount(): number {
        return this.frames.length;
    }

    /**
     * Get frame at specific index
     */
    getFrame(index: number): CarRecordingFrame | undefined {
        return this.frames[index];
    }

    /**
     * Clear all frames
     */
    clear(): void {
        this.frames = [];
        this.globalTimer = 0;
        this.currentFrameNumber = 0;
        this.updateFileSize();
    }

    /**
     * Serialize entire recording to binary buffer (.cr file format)
     *
     * File structure:
     * 0x00 - INT32 - Global timer (reserved for playback)
     * 0x04 - INT32 - File size
     * 0x08 - INT32 - Current frame number (reserved for playback)
     * 0x0C - [...] - Frame data (0x30 bytes per frame)
     */
    toBuffer(): ArrayBuffer {
        const headerSize = 0x0C;
        const totalSize = headerSize + (this.frames.length * 0x30);
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);

        // Write header
        view.setInt32(0x00, this.globalTimer, true);
        view.setInt32(0x04, totalSize - headerSize, true); // File size (excluding header)
        view.setInt32(0x08, this.currentFrameNumber, true);

        // Write frames
        this.frames.forEach((frame, index) => {
            const frameBuffer = frame.toBuffer();
            const frameView = new Uint8Array(frameBuffer);
            const offset = headerSize + (index * 0x30);

            for (let i = 0; i < frameView.length; i++) {
                view.setUint8(offset + i, frameView[i]);
            }
        });

        return buffer;
    }

    /**
     * Deserialize recording from binary buffer (.cr file)
     */
    static fromBuffer(buffer: ArrayBuffer): CarRecording {
        const view = new DataView(buffer);

        // Read header
        const globalTimer = view.getInt32(0x00, true);
        const fileSize = view.getInt32(0x04, true);
        const currentFrameNumber = view.getInt32(0x08, true);

        // Calculate frame count
        const frameCount = Math.floor(fileSize / 0x30);

        // Read frames
        const frames: CarRecordingFrame[] = [];
        for (let i = 0; i < frameCount; i++) {
            const offset = 0x0C + (i * 0x30);
            frames.push(CarRecordingFrame.fromBuffer(buffer, offset));
        }

        const recording = new CarRecording(frames);
        recording.globalTimer = globalTimer;
        recording.fileSize = fileSize;
        recording.currentFrameNumber = currentFrameNumber;

        return recording;
    }

    /**
     * Get recording duration in seconds
     */
    getDuration(): number {
        if (this.frames.length === 0) return 0;
        const lastFrame = this.frames[this.frames.length - 1];
        return lastFrame.timestamp / 1000.0;
    }

    /**
     * Get recording progress percentage
     */
    getProgress(currentFrame: number): number {
        if (this.frames.length === 0) return 0;
        return (currentFrame / this.frames.length) * 100;
    }
}