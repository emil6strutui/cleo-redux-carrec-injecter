/**
 * Car Recording System for GTA San Andreas
 *
 * This module provides TypeScript classes to work with vehicle recordings,
 * matching the CVehicleStateEachFrame structure from the game engine.
 */

/**
 * Represents a 3D vector with fixed-point compression
 */
export class FixedVector3 {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public z: number = 0
    ) {}

    /**
     * Compress a float vector to fixed-point integers
     * @param scale The compression scale factor
     * @returns Array of compressed integer values [x, y, z]
     */
    compress<T extends number>(scale: number, bytesPerComponent: 1 | 2): T[] {
        return [
            Math.floor(this.x * scale) as T,
            Math.floor(this.y * scale) as T,
            Math.floor(this.z * scale) as T
        ];
    }

    /**
     * Decompress fixed-point integers to float vector
     * @param values Array of compressed integer values [x, y, z]
     * @param scale The compression scale factor
     */
    static decompress(values: number[], scale: number): FixedVector3 {
        return new FixedVector3(
            values[0] / scale,
            values[1] / scale,
            values[2] / scale
        );
    }

    /**
     * Create from a regular array
     */
    static fromArray(arr: number[]): FixedVector3 {
        return new FixedVector3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
    }

    /**
     * Convert to array
     */
    toArray(): [number, number, number] {
        return [this.x, this.y, this.z];
    }
}

/**
 * Represents the state of a vehicle at a single frame
 * Matches the CVehicleStateEachFrame structure (32 bytes / 0x20)
 */
export class VehicleStateEachFrame {
    /** Time in milliseconds from the start of recording */
    time: number = 0;

    /** Vehicle velocity (compressed as int16 with scale 16383.5) */
    velocity: FixedVector3 = new FixedVector3();

    /** Right vector of vehicle orientation (compressed as int8 with scale 127.0) */
    right: FixedVector3 = new FixedVector3();

    /** Top/Up vector of vehicle orientation (compressed as int8 with scale 127.0) */
    top: FixedVector3 = new FixedVector3();

    /** Steering angle -1.0 to 1.0 (compressed as uint8 with scale 20.0) */
    steeringAngle: number = 0;

    /** Gas pedal power 0.0 to 1.0 (compressed as uint8 with scale 100.0) */
    gasPedal: number = 0;

    /** Brake pedal power 0.0 to 1.0 (compressed as uint8 with scale 100.0) */
    brakePedal: number = 0;

    /** Whether handbrake is active */
    handbrake: boolean = false;

    /** World position of the vehicle */
    position: FixedVector3 = new FixedVector3();

    /**
     * Serialize this frame to a binary buffer (32 bytes)
     */
    toBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        let offset = 0;

        // Time (4 bytes - uint32)
        view.setUint32(offset, this.time, true);
        offset += 4;

        // Velocity (6 bytes - 3 x int16, scale 16383.5)
        const velocity = this.velocity.compress<number>(16383.5, 2);
        view.setInt16(offset, velocity[0], true); offset += 2;
        view.setInt16(offset, velocity[1], true); offset += 2;
        view.setInt16(offset, velocity[2], true); offset += 2;

        // Right vector (3 bytes - 3 x int8, scale 127.0)
        const right = this.right.compress<number>(127.0, 1);
        view.setInt8(offset, right[0]); offset += 1;
        view.setInt8(offset, right[1]); offset += 1;
        view.setInt8(offset, right[2]); offset += 1;

        // Top vector (3 bytes - 3 x int8, scale 127.0)
        const top = this.top.compress<number>(127.0, 1);
        view.setInt8(offset, top[0]); offset += 1;
        view.setInt8(offset, top[1]); offset += 1;
        view.setInt8(offset, top[2]); offset += 1;

        // Steering angle (1 byte - int8, scale 20.0)
        view.setInt8(offset, Math.floor(this.steeringAngle * 20.0)); offset += 1;

        // Gas pedal (1 byte - uint8, scale 100.0)
        view.setUint8(offset, Math.floor(this.gasPedal * 100.0)); offset += 1;

        // Brake pedal (1 byte - uint8, scale 100.0)
        view.setUint8(offset, Math.floor(this.brakePedal * 100.0)); offset += 1;

        // Handbrake (1 byte - bool)
        view.setUint8(offset, this.handbrake ? 1 : 0); offset += 1;

        // Position (12 bytes - 3 x float32)
        view.setFloat32(offset, this.position.x, true); offset += 4;
        view.setFloat32(offset, this.position.y, true); offset += 4;
        view.setFloat32(offset, this.position.z, true); offset += 4;

        return buffer;
    }

    /**
     * Deserialize a frame from a binary buffer
     */
    static fromBuffer(buffer: ArrayBuffer): VehicleStateEachFrame {
        const frame = new VehicleStateEachFrame();
        const view = new DataView(buffer);
        let offset = 0;

        // Time (4 bytes - uint32)
        frame.time = view.getUint32(offset, true);
        offset += 4;

        // Velocity (6 bytes - 3 x int16, scale 16383.5)
        const velocityX = view.getInt16(offset, true); offset += 2;
        const velocityY = view.getInt16(offset, true); offset += 2;
        const velocityZ = view.getInt16(offset, true); offset += 2;
        frame.velocity = FixedVector3.decompress([velocityX, velocityY, velocityZ], 16383.5);

        // Right vector (3 bytes - 3 x int8, scale 127.0)
        const rightX = view.getInt8(offset); offset += 1;
        const rightY = view.getInt8(offset); offset += 1;
        const rightZ = view.getInt8(offset); offset += 1;
        frame.right = FixedVector3.decompress([rightX, rightY, rightZ], 127.0);

        // Top vector (3 bytes - 3 x int8, scale 127.0)
        const topX = view.getInt8(offset); offset += 1;
        const topY = view.getInt8(offset); offset += 1;
        const topZ = view.getInt8(offset); offset += 1;
        frame.top = FixedVector3.decompress([topX, topY, topZ], 127.0);

        // Steering angle (1 byte - int8, scale 20.0)
        frame.steeringAngle = view.getInt8(offset) / 20.0; offset += 1;

        // Gas pedal (1 byte - uint8, scale 100.0)
        frame.gasPedal = view.getUint8(offset) / 100.0; offset += 1;

        // Brake pedal (1 byte - uint8, scale 100.0)
        frame.brakePedal = view.getUint8(offset) / 100.0; offset += 1;

        // Handbrake (1 byte - bool)
        frame.handbrake = view.getUint8(offset) !== 0; offset += 1;

        // Position (12 bytes - 3 x float32)
        const posX = view.getFloat32(offset, true); offset += 4;
        const posY = view.getFloat32(offset, true); offset += 4;
        const posZ = view.getFloat32(offset, true); offset += 4;
        frame.position = new FixedVector3(posX, posY, posZ);

        return frame;
    }
}

/**
 * Represents a complete vehicle recording (collection of frames)
 */
export class CarRecording {
    /** Array of recorded frames */
    frames: VehicleStateEachFrame[] = [];

    /**
     * Add a frame to the recording
     */
    addFrame(frame: VehicleStateEachFrame): void {
        this.frames.push(frame);
    }

    /**
     * Get the total duration of the recording in milliseconds
     */
    getDuration(): number {
        if (this.frames.length === 0) return 0;
        return this.frames[this.frames.length - 1].time;
    }

    /**
     * Get the number of frames in this recording
     */
    getFrameCount(): number {
        return this.frames.length;
    }

    /**
     * Get the total size in bytes
     */
    getByteSize(): number {
        return this.frames.length * 32; // Each frame is 32 bytes
    }

    /**
     * Serialize the entire recording to a binary buffer
     */
    toBuffer(): ArrayBuffer {
        const totalSize = this.getByteSize();
        const buffer = new ArrayBuffer(totalSize);
        const uint8View = new Uint8Array(buffer);

        let offset = 0;
        for (const frame of this.frames) {
            const frameBuffer = frame.toBuffer();
            const frameView = new Uint8Array(frameBuffer);
            uint8View.set(frameView, offset);
            offset += 32;
        }

        return buffer;
    }

    /**
     * Deserialize a recording from a binary buffer
     */
    static fromBuffer(buffer: ArrayBuffer): CarRecording {
        const recording = new CarRecording();
        const frameSize = 32;
        const frameCount = buffer.byteLength / frameSize;

        for (let i = 0; i < frameCount; i++) {
            const frameBuffer = buffer.slice(i * frameSize, (i + 1) * frameSize);
            const frame = VehicleStateEachFrame.fromBuffer(frameBuffer);
            recording.addFrame(frame);
        }

        return recording;
    }

    /**
     * Clear all frames from the recording
     */
    clear(): void {
        this.frames = [];
    }

    /**
     * Get a frame at a specific index
     */
    getFrame(index: number): VehicleStateEachFrame | undefined {
        return this.frames[index];
    }

    /**
     * Get the frame closest to a specific time
     */
    getFrameAtTime(time: number): VehicleStateEachFrame | undefined {
        if (this.frames.length === 0) return undefined;

        // Binary search for the closest frame
        let left = 0;
        let right = this.frames.length - 1;
        let closest = this.frames[0];
        let minDiff = Math.abs(this.frames[0].time - time);

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const frame = this.frames[mid];
            const diff = Math.abs(frame.time - time);

            if (diff < minDiff) {
                minDiff = diff;
                closest = frame;
            }

            if (frame.time < time) {
                left = mid + 1;
            } else if (frame.time > time) {
                right = mid - 1;
            } else {
                return frame; // Exact match
            }
        }

        return closest;
    }

    /**
     * Get two frames for interpolation at a specific time
     * Returns [previousFrame, nextFrame, interpolationFactor]
     */
    getInterpolationFrames(time: number): [VehicleStateEachFrame, VehicleStateEachFrame, number] | undefined {
        if (this.frames.length < 2) return undefined;

        // Find the two frames to interpolate between
        for (let i = 0; i < this.frames.length - 1; i++) {
            const current = this.frames[i];
            const next = this.frames[i + 1];

            if (current.time <= time && time <= next.time) {
                const timeDiff = next.time - current.time;
                const factor = timeDiff > 0 ? (time - current.time) / timeDiff : 0;
                return [current, next, factor];
            }
        }

        // If time is beyond the last frame, return the last two frames
        const last = this.frames[this.frames.length - 1];
        const beforeLast = this.frames[this.frames.length - 2];
        return [beforeLast, last, 1.0];
    }
}