import { CarRecording, VehicleStateEachFrame, FixedVector3 } from './CarRecording';

/**
 * Plays back recorded vehicle movement data
 */
export class CarRecordingViewer {
    private recording: CarRecording | null = null;
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private playbackVehicle: Car | null = null;
    private currentTime: number = 0;
    private playbackSpeed: number = 1.0;
    private looped: boolean = false;
    private currentFrameIndex: number = 0;

    constructor(private readonly filePath: string) {}

    /**
     * Load a recording from file
     */
    load(): boolean {
        try {
            const file = File.Open(this.filePath, "rb");
            if (!file) {
                log(`Failed to open recording file: ${this.filePath}`);
                return false;
            }

            const fileSize = file.getSize();
            if (fileSize === 0) {
                file.close();
                log('Recording file is empty');
                return false;
            }

            // Allocate memory to read the file
            const bufferAddr = Memory.Allocate(fileSize);
            if (!bufferAddr) {
                file.close();
                log('Failed to allocate memory for reading file');
                return false;
            }

            file.readBlock(fileSize, bufferAddr);
            file.close();

            // Convert memory to ArrayBuffer
            const buffer = new ArrayBuffer(fileSize);
            const view = new DataView(buffer);

            for (let i = 0; i < fileSize; i++) {
                const byte = Memory.ReadU8(bufferAddr + i, false);
                view.setUint8(i, byte);
            }

            Memory.Free(bufferAddr);

            // Parse the recording
            this.recording = CarRecording.fromBuffer(buffer);

            log(`Loaded recording: ${this.recording.getFrameCount()} frames, ${this.recording.getDuration()}ms`);
            return true;
        } catch (e) {
            log(`Error loading recording: ${e}`);
            return false;
        }
    }

    /**
     * Start playback on a vehicle
     */
    startPlayback(vehicle: Car, looped: boolean = false): boolean {
        if (!this.recording || this.recording.getFrameCount() === 0) {
            log('No recording loaded or recording is empty');
            return false;
        }

        this.playbackVehicle = vehicle;
        this.isPlaying = true;
        this.isPaused = false;
        this.looped = looped;
        this.currentTime = 0;
        this.currentFrameIndex = 0;

        log('Playback started');
        return true;
    }

    /**
     * Stop playback
     */
    stopPlayback(): void {
        this.isPlaying = false;
        this.isPaused = false;
        this.playbackVehicle = null;
        this.currentTime = 0;
        this.currentFrameIndex = 0;
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (this.isPlaying) {
            this.isPaused = true;
        }
    }

    /**
     * Resume playback
     */
    resume(): void {
        this.isPaused = false;
    }

    /**
     * Set playback speed multiplier
     */
    setPlaybackSpeed(speed: number): void {
        this.playbackSpeed = Math.max(0.1, Math.min(10.0, speed));
    }

    /**
     * Main update loop - call this every frame
     * @param deltaTime Time since last frame in milliseconds
     */
    update(deltaTime: number = 16.67): void {
        if (!this.isPlaying || this.isPaused || !this.playbackVehicle || !this.recording) {
            return;
        }

        // Check if vehicle still exists
        if (Car.IsDead(+this.playbackVehicle)) {
            this.stopPlayback();
            return;
        }

        // Update playback time
        this.currentTime += deltaTime * this.playbackSpeed;

        // Check if playback finished
        if (this.currentTime >= this.recording.getDuration()) {
            if (this.looped) {
                this.currentTime = 0;
                this.currentFrameIndex = 0;
            } else {
                this.stopPlayback();
                log('Playback finished');
                return;
            }
        }

        // Get frames for interpolation
        const interpolationData = this.recording.getInterpolationFrames(this.currentTime);
        if (!interpolationData) {
            return;
        }

        const [prevFrame, nextFrame, factor] = interpolationData;

        // Apply interpolated vehicle state
        this.applyVehicleState(prevFrame, nextFrame, factor);
    }

    /**
     * Apply vehicle state from recording frames with interpolation
     */
    private applyVehicleState(prevFrame: VehicleStateEachFrame, nextFrame: VehicleStateEachFrame, factor: number): void {
        if (!this.playbackVehicle) return;

        try {
            // Interpolate position
            const x = this.lerp(prevFrame.position.x, nextFrame.position.x, factor);
            const y = this.lerp(prevFrame.position.y, nextFrame.position.y, factor);
            const z = this.lerp(prevFrame.position.z, nextFrame.position.z, factor);

            // Set vehicle position
            this.playbackVehicle.setCoordinates(x, y, z);

            // Get vehicle memory address for direct manipulation
            const vehicleAddr = Memory.GetVehiclePointer(this.playbackVehicle);

            if (vehicleAddr !== 0) {
                // Interpolate and set velocity
                const velX = this.lerp(prevFrame.velocity.x, nextFrame.velocity.x, factor);
                const velY = this.lerp(prevFrame.velocity.y, nextFrame.velocity.y, factor);
                const velZ = this.lerp(prevFrame.velocity.z, nextFrame.velocity.z, factor);

                Memory.WriteFloat(vehicleAddr + 0x44, velX, false);
                Memory.WriteFloat(vehicleAddr + 0x48, velY, false);
                Memory.WriteFloat(vehicleAddr + 0x4C, velZ, false);

                // Set orientation vectors (right and top)
                const matrixPtr = Memory.ReadU32(vehicleAddr + 0x14, false);

                if (matrixPtr !== 0) {
                    // Interpolate right vector
                    const rightX = this.lerp(prevFrame.right.x, nextFrame.right.x, factor);
                    const rightY = this.lerp(prevFrame.right.y, nextFrame.right.y, factor);
                    const rightZ = this.lerp(prevFrame.right.z, nextFrame.right.z, factor);

                    Memory.WriteFloat(matrixPtr + 0x0, rightX, false);
                    Memory.WriteFloat(matrixPtr + 0x4, rightY, false);
                    Memory.WriteFloat(matrixPtr + 0x8, rightZ, false);

                    // Interpolate top vector
                    const topX = this.lerp(prevFrame.top.x, nextFrame.top.x, factor);
                    const topY = this.lerp(prevFrame.top.y, nextFrame.top.y, factor);
                    const topZ = this.lerp(prevFrame.top.z, nextFrame.top.z, factor);

                    Memory.WriteFloat(matrixPtr + 0x10, topX, false);
                    Memory.WriteFloat(matrixPtr + 0x14, topY, false);
                    Memory.WriteFloat(matrixPtr + 0x18, topZ, false);

                    // Calculate and set forward vector (cross product of right and top)
                    const fwdX = rightY * topZ - rightZ * topY;
                    const fwdY = rightZ * topX - rightX * topZ;
                    const fwdZ = rightX * topY - rightY * topX;

                    Memory.WriteFloat(matrixPtr + 0x20, fwdX, false);
                    Memory.WriteFloat(matrixPtr + 0x24, fwdY, false);
                    Memory.WriteFloat(matrixPtr + 0x28, fwdZ, false);
                }

                // Set control inputs (use next frame's values, no interpolation for discrete inputs)
                Memory.WriteFloat(vehicleAddr + 0x494, nextFrame.steeringAngle, false);
                Memory.WriteFloat(vehicleAddr + 0x49C, nextFrame.gasPedal, false);
                Memory.WriteFloat(vehicleAddr + 0x4A0, nextFrame.brakePedal, false);

                // Set handbrake flag
                const flags = Memory.ReadU8(vehicleAddr + 0x428, false);
                if (nextFrame.handbrake) {
                    Memory.WriteU8(vehicleAddr + 0x428, flags | (1 << 5), false);
                } else {
                    Memory.WriteU8(vehicleAddr + 0x428, flags & ~(1 << 5), false);
                }
            }
        } catch (e) {
            log(`Error applying vehicle state: ${e}`);
        }
    }

    /**
     * Linear interpolation
     */
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    /**
     * Check if currently playing
     */
    isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Check if paused
     */
    isCurrentlyPaused(): boolean {
        return this.isPaused;
    }

    /**
     * Get current playback time
     */
    getCurrentTime(): number {
        return this.currentTime;
    }

    /**
     * Get total duration
     */
    getDuration(): number {
        return this.recording ? this.recording.getDuration() : 0;
    }

    /**
     * Seek to a specific time in the recording
     */
    seekTo(time: number): void {
        if (!this.recording) return;

        this.currentTime = Math.max(0, Math.min(time, this.recording.getDuration()));

        // Update frame index
        for (let i = 0; i < this.recording.getFrameCount(); i++) {
            const frame = this.recording.getFrame(i);
            if (frame && frame.time >= this.currentTime) {
                this.currentFrameIndex = i;
                break;
            }
        }
    }

    /**
     * Get the loaded recording
     */
    getRecording(): CarRecording | null {
        return this.recording;
    }
}