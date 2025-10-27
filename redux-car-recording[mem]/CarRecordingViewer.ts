import { CarRecording, CarRecordingFrame, Vector3 } from "./CarRecording";

/**
 * Plays back a recorded car recording on a vehicle
 */
export class CarRecordingViewer {
    private car: Car;
    private recording: CarRecording;
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private currentFrameIndex: number = 0;
    private showInfo: boolean = false;
    private loop: boolean = false;
    private carStructAddress: number = 0;
    private setFrame: number = 0; // For seeking to specific frame

    constructor(car: Car, recording: CarRecording, showInfo: boolean = false, loop: boolean = false) {
        this.car = car;
        this.recording = recording;
        this.showInfo = showInfo;
        this.loop = loop;

        // Get vehicle struct address
        this.carStructAddress = Memory.GetVehiclePointer(this.car);

        // Set car status for proper engine sounds and physics
        // Use 1 for cars, 0 for boats/helis/planes
        this.car.setStatus(1);
    }

    /**
     * Start playback from beginning
     */
    start(): void {
        this.isPlaying = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.currentFrameIndex = 0;
        this.setFrame = 0;
        log("Playback started");
    }

    /**
     * Stop playback
     */
    stop(): void {
        this.isPlaying = false;
        this.isPaused = false;
        log("Playback stopped");
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (this.isPlaying && !this.isPaused) {
            this.isPaused = true;
            this.pauseTime = Date.now();
        }
    }

    /**
     * Resume playback
     */
    resume(): void {
        if (this.isPlaying && this.isPaused) {
            this.isPaused = false;
            const pauseDuration = Date.now() - this.pauseTime;
            this.startTime += pauseDuration;
        }
    }

    /**
     * Seek to specific frame
     */
    seekToFrame(frameIndex: number): void {
        if (frameIndex >= 0 && frameIndex < this.recording.getFrameCount()) {
            this.setFrame = frameIndex;
            this.currentFrameIndex = frameIndex;

            // If playing, adjust start time
            if (this.isPlaying) {
                const frame = this.recording.getFrame(frameIndex);
                if (frame) {
                    this.startTime = Date.now() - frame.timestamp;
                }
            }
        }
    }

    /**
     * Check if playing
     */
    isActive(): boolean {
        return this.isPlaying;
    }

    /**
     * Update - should be called every frame
     * Returns current frame index, or -1 if playback ended
     */
    update(): number {
        if (!this.isPlaying) {
            return -1;
        }

        // Handle pause
        if (this.isPaused) {
            // Apply current frame position without advancing
            const frame = this.recording.getFrame(this.currentFrameIndex);
            if (frame) {
                this.applyFrameStatic(frame);
            }
            return this.currentFrameIndex;
        }

        // Calculate elapsed time
        const elapsedTime = Date.now() - this.startTime;

        // Handle seeking
        if (this.setFrame > 0) {
            const frame = this.recording.getFrame(this.setFrame);
            if (frame) {
                this.startTime = Date.now() - frame.timestamp;
                this.currentFrameIndex = this.setFrame;
            }
            this.setFrame = 0; // Reset seek flag
        }

        // Find appropriate frame for current time
        const targetFrame = this.findFrameForTime(elapsedTime);

        if (targetFrame === -1) {
            // Reached end of recording
            if (this.loop) {
                // Restart playback
                this.start();
                return 0;
            } else {
                this.stop();
                return -1;
            }
        }

        this.currentFrameIndex = targetFrame;
        const frame = this.recording.getFrame(targetFrame);

        if (frame) {
            // Apply frame data to vehicle
            if (elapsedTime > 0) {
                this.applyFrameDynamic(frame);
            } else {
                this.applyFrameStatic(frame);
            }

            // Show info if enabled
            if (this.showInfo) {
                const duration = Math.floor(elapsedTime / 1000);
                const progress = Math.floor(this.recording.getProgress(this.currentFrameIndex));
                Text.PrintStringNow(
                    `~p~PLAYBACK: ${duration} sec. ~h~Frame: ~p~${this.currentFrameIndex} ~h~(~p~${progress}% ~h~of full recording)`, 100
                );
            }
        }

        return this.currentFrameIndex;
    }

    /**
     * Find the correct frame for a given timestamp
     */
    private findFrameForTime(time: number): number {
        const frameCount = this.recording.getFrameCount();

        if (frameCount === 0) {
            return -1;
        }

        // Skip ahead to find the right frame
        while (this.currentFrameIndex < frameCount - 1) {
            const nextFrame = this.recording.getFrame(this.currentFrameIndex + 1);
            if (nextFrame && nextFrame.timestamp <= time) {
                this.currentFrameIndex++;
            } else {
                break;
            }
        }

        // Check if we've reached the end of recording
        const currentFrame = this.recording.getFrame(this.currentFrameIndex);
        if (!currentFrame) {
            return -1;
        }

        // If we're on the last frame and time has exceeded it, playback is complete
        if (this.currentFrameIndex >= frameCount - 1) {
            const lastFrame = this.recording.getFrame(frameCount - 1);
            if (lastFrame && time > lastFrame.timestamp) {
                return -1;
            }
        }

        return this.currentFrameIndex;
    }

    /**
     * Apply frame data to vehicle (dynamic - with velocity)
     */
    private applyFrameDynamic(frame: CarRecordingFrame): void {
        const struct = this.carStructAddress;

        // Apply rotation matrix (right and up vectors only)
        // Note: The original CLEO implementation skips the forward vector
        // The game calculates it automatically from right and up vectors

        // Right vector (offsets 0x04, 0x08, 0x0C)
        Memory.WriteFloat(struct + 0x04, frame.rotation.right.x, false);
        Memory.WriteFloat(struct + 0x08, frame.rotation.right.y, false);
        Memory.WriteFloat(struct + 0x0C, frame.rotation.right.z, false);

        // Skip forward vector at 0x14, 0x18, 0x1C - game handles this automatically

        // Up vector (offsets 0x24, 0x28, 0x2C)
        Memory.WriteFloat(struct + 0x24, frame.rotation.up.x, false);
        Memory.WriteFloat(struct + 0x28, frame.rotation.up.y, false);
        Memory.WriteFloat(struct + 0x2C, frame.rotation.up.z, false);

        // Apply position
        this.car.setCoordinates(frame.position.x, frame.position.y, frame.position.z);

        // Apply movement speed (velocity)
        Memory.WriteFloat(struct + 0x70, frame.movementSpeed.x, false);
        Memory.WriteFloat(struct + 0x74, frame.movementSpeed.y, false);
        Memory.WriteFloat(struct + 0x78, frame.movementSpeed.z, false);

        // Apply turn speed (angular velocity)
        Memory.WriteFloat(struct + 0x7C, frame.turnSpeed.x, false);
        Memory.WriteFloat(struct + 0x80, frame.turnSpeed.y, false);
        Memory.WriteFloat(struct + 0x84, frame.turnSpeed.z, false);

        // Apply controls
        this.applyControls(frame);
    }

    /**
     * Apply frame data to vehicle (static - position only, no velocity)
     * Used for paused playback or initial frame
     */
    private applyFrameStatic(frame: CarRecordingFrame): void {
        const struct = this.carStructAddress;

        // Apply rotation matrix (right and up vectors only)
        // Note: The original CLEO implementation skips the forward vector
        // The game calculates it automatically from right and up vectors

        // Right vector (offsets 0x04, 0x08, 0x0C)
        Memory.WriteFloat(struct + 0x04, frame.rotation.right.x, false);
        Memory.WriteFloat(struct + 0x08, frame.rotation.right.y, false);
        Memory.WriteFloat(struct + 0x0C, frame.rotation.right.z, false);

        // Skip forward vector at 0x14, 0x18, 0x1C - game handles this automatically

        // Up vector (offsets 0x24, 0x28, 0x2C)
        Memory.WriteFloat(struct + 0x24, frame.rotation.up.x, false);
        Memory.WriteFloat(struct + 0x28, frame.rotation.up.y, false);
        Memory.WriteFloat(struct + 0x2C, frame.rotation.up.z, false);

        // Apply position
        this.car.setCoordinates(frame.position.x, frame.position.y, frame.position.z);

        // Zero out velocities for static display
        Memory.WriteFloat(struct + 0x70, 0.0, false);
        Memory.WriteFloat(struct + 0x74, 0.0, false);
        Memory.WriteFloat(struct + 0x78, 0.0, false);
        Memory.WriteFloat(struct + 0x7C, 0.0, false);
        Memory.WriteFloat(struct + 0x80, 0.0, false);
        Memory.WriteFloat(struct + 0x84, 0.0, false);

        // Apply controls
        this.applyControls(frame);
    }

    /**
     * Apply vehicle controls from frame
     */
    private applyControls(frame: CarRecordingFrame): void {
        const struct = this.carStructAddress;

        // Apply steering, accelerator, brake
        Memory.WriteFloat(struct + 0x46C, frame.controls.steeringAngle, false);
        Memory.WriteFloat(struct + 0x470, frame.controls.accelerator, false);
        Memory.WriteFloat(struct + 0x474, frame.controls.brake, false);
        Memory.WriteU8(struct + 0x479, frame.controls.handBrake, false);

        // Handle horn
        Memory.WriteU8(struct + 0x4C0, frame.controls.horn, false);

        // Handle helicopter weapons (Hunter, Seasparrow)
        const model = this.car.getModel();
        if (frame.controls.handBrake > 16 && (model === 155 || model === 177)) {
            // Fire helicopter weapons
            // This would need a proper opcode call
            // native("FIRE_GUNS_ON_VEHICLE", this.car.handle);
        }
    }

    /**
     * Get playback stats
     */
    getStats(): {
        currentFrame: number;
        totalFrames: number;
        progress: number;
        elapsedTime: number;
        isPlaying: boolean;
        isPaused: boolean;
    } {
        return {
            currentFrame: this.currentFrameIndex,
            totalFrames: this.recording.getFrameCount(),
            progress: this.recording.getProgress(this.currentFrameIndex),
            elapsedTime: this.isPlaying ? Date.now() - this.startTime : 0,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused
        };
    }

    /**
     * Load recording from binary buffer
     */
    static fromBuffer(car: Car, buffer: ArrayBuffer, showInfo: boolean = false, loop: boolean = false): CarRecordingViewer {
        const recording = CarRecording.fromBuffer(buffer);
        return new CarRecordingViewer(car, recording, showInfo, loop);
    }
}