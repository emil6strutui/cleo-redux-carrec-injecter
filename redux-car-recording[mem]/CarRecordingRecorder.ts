import { CarRecording, CarRecordingFrame, Vector3, RotationMatrix, VehicleControls } from "./CarRecording";

/**
 * Records vehicle movement data to a CarRecording
 */
export class CarRecordingRecorder {
    private car: Car;
    private recording: CarRecording;
    private isRecording: boolean = false;
    private startTime: number = 0;
    private showInfo: boolean = false;
    private maxFrames: number = 0;
    private carStructAddress: number = 0;

    constructor(car: Car, showInfo: boolean = false, maxFrames: number = 13650) {
        this.car = car;
        this.recording = new CarRecording();
        this.showInfo = showInfo;
        this.maxFrames = maxFrames; // ~13650 frames = 640KB at 48 bytes/frame

        // Get vehicle struct address for direct memory access
        this.carStructAddress = Memory.GetVehiclePointer(this.car);
    }

    /**
     * Start recording
     */
    start(): void {
        this.isRecording = true;
        this.startTime = Clock.GetGameTimer();
        this.recording.clear();
        log("Recording started");
    }

    /**
     * Stop recording
     */
    stop(): void {
        this.isRecording = false;
        log(`Recording stopped. Total frames: ${this.recording.getFrameCount()}`);
    }

    /**
     * Check if recording
     */
    isActive(): boolean {
        return this.isRecording;
    }

    /**
     * Update - should be called every frame
     * Returns true if memory is not full, false if full
     */
    update(): boolean {
        if (!this.isRecording) {
            return true;
        }

        // Check if memory is full
        if (this.recording.getFrameCount() >= this.maxFrames) {
            if (this.showInfo) {
                showTextBox("~r~RECORDING MEMORY FULL!");
            }
            return false;
        }

        // Capture current frame
        const frame = this.captureFrame();
        this.recording.addFrame(frame);

        // Show info if enabled
        if (this.showInfo) {
            const duration = Math.floor((Date.now() - this.startTime) / 1000);
            const frameCount = this.recording.getFrameCount();
            const memoryUsed = Math.floor((frameCount / this.maxFrames) * 100);
            const memoryFree = 100 - memoryUsed;

            let color = "~o~"; // orange
            if (memoryFree <= 20) {
                color = "~r~"; // red
            } else if (memoryFree <= 50) {
                color = "~y~"; // yellow
            }

            Text.PrintStringNow(
                `${color}RECORDING: ${duration} sec. ~h~Frame: ${color}${frameCount} ~h~(Free memory: ${color}${memoryFree}%~h~)`, 100
            );
        }

        return true;
    }

    /**
     * Capture current vehicle state as a frame
     */
    private captureFrame(): CarRecordingFrame {
        const timestamp = Clock.GetGameTimer() - this.startTime;

        // Get position
        const coords = this.car.getCoordinates();
        const position: Vector3 = { x: coords.x, y: coords.y, z: coords.z };

        // Get velocity (movement speed)
        const velocity = this.car.getSpeedVector();
        const movementSpeed: Vector3 = { x: velocity.x, y: velocity.y, z: velocity.z };

        // Read rotation matrix from vehicle struct
        // Vehicle matrix offsets: 0x04 = right, 0x14 = forward, 0x24 = up
        const rotation = this.readRotationMatrix();

        // Read turn speed (angular velocity) from vehicle struct
        // Offset: 0x7C
        const turnSpeed = this.readTurnSpeed();

        // Read vehicle controls from struct
        const controls = this.readControls();

        return new CarRecordingFrame(
            timestamp,
            rotation,
            position,
            movementSpeed,
            turnSpeed,
            controls
        );
    }

    /**
     * Read rotation matrix from vehicle struct memory
     */
    private readRotationMatrix(): RotationMatrix {
        const struct = this.carStructAddress;

        return {
            right: {
                x: Memory.ReadFloat(struct + 0x04, false),
                y: Memory.ReadFloat(struct + 0x08, false),
                z: Memory.ReadFloat(struct + 0x0C, false),
            },
            up: {
                x: Memory.ReadFloat(struct + 0x24, false),
                y: Memory.ReadFloat(struct + 0x28, false),
                z: Memory.ReadFloat(struct + 0x2C, false),
            }
        };
    }

    /**
     * Read turn speed (angular velocity) from vehicle struct
     */
    private readTurnSpeed(): Vector3 {
        const struct = this.carStructAddress;

        return {
            x: Memory.ReadFloat(struct + 0x7C, false),
            y: Memory.ReadFloat(struct + 0x80, false),
            z: Memory.ReadFloat(struct + 0x84, false),
        };
    }

    /**
     * Read vehicle control inputs from struct
     */
    private readControls(): VehicleControls {
        const struct = this.carStructAddress;

        // CVehicle offsets:
        // 0x46C = steering angle
        // 0x470 = accelerator (gas pedal)
        // 0x474 = brake pedal
        // 0x479 = handbrake status
        // 0x4C0 = horn status

        return {
            steeringAngle: Memory.ReadFloat(struct + 0x46C, false),
            accelerator: Memory.ReadFloat(struct + 0x470, false),
            brake: Memory.ReadFloat(struct + 0x474, false),
            handBrake: Memory.ReadU8(struct + 0x479, false),
            horn: Memory.ReadU8(struct + 0x4C0, false),
        };
    }

    /**
     * Get the recording
     */
    getRecording(): CarRecording {
        return this.recording;
    }

    /**
     * Get recording stats
     */
    getStats(): {
        frameCount: number;
        duration: number;
        memoryUsed: number;
        isFull: boolean;
    } {
        return {
            frameCount: this.recording.getFrameCount(),
            duration: this.recording.getDuration(),
            memoryUsed: Math.floor((this.recording.getFrameCount() / this.maxFrames) * 100),
            isFull: this.recording.getFrameCount() >= this.maxFrames
        };
    }

    /**
     * Export recording to binary buffer (for saving to file)
     */
    toBuffer(): ArrayBuffer {
        return this.recording.toBuffer();
    }
}