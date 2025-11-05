import { CarRecording, VehicleStateEachFrame, FixedVector3 } from './CarRecording';
import { KeyCode } from '../.config/sa.enums.js'
/**
 * Vehicle memory offsets for GTA San Andreas
 * Based on CVehicle structure from gta-reversed
 */
const VehicleOffsets = {
    VELOCITY_X: 0x44,
    VELOCITY_Y: 0x48,
    VELOCITY_Z: 0x4C,
    MATRIX: 0x14,          // CPlaceable::m_matrix
    RIGHT_X: 0x0,          // Offset from matrix
    RIGHT_Y: 0x4,
    RIGHT_Z: 0x8,
    TOP_X: 0x10,           // Offset from matrix
    TOP_Y: 0x14,
    TOP_Z: 0x18,
    STEER_ANGLE: 0x494,
    GAS_PEDAL: 0x49C,
    BRAKE_PEDAL: 0x4A0,
    VEHICLE_FLAGS: 0x428,
    HANDBRAKE_BIT: 5
};

/**
 * Records vehicle movement data for playback
 */
export class CarRecordingRecorder {
    private recording: CarRecording;
    private isRecording: boolean = false;
    private fileHandle: File | null = null;
    private recordingStartTime: number = 0;
    private lastRecordTime: number = 0;
    private nextRecordingInterval: number = 0;
    private lastKeyCheckTime: number = 0;

    /** Base recording interval in milliseconds */
    private readonly BASE_INTERVAL_MS = 100;
    /** Random variation to add to recording interval (0-50ms) */
    private readonly RANDOM_INTERVAL_MAX = 50;
    /** Minimum time between key presses in milliseconds */
    private readonly KEY_RELEASE_THRESHOLD = 500;

    constructor(private readonly filePath: string) {
        this.recording = new CarRecording();
    }

    /**
     * Main processing loop - call this every frame
     */
    update(): boolean {
        // Check for toggle key combination
        this.checkToggleRecording();

        if (this.isRecording) {
            this.processRecording();
        }

        return this.isRecording;
    }

    /**
     * Check if player pressed SHIFT+R to toggle recording
     */
    private checkToggleRecording(): void {
        try {
            const player = new Player(0);
            const playerChar = player.getChar();

            // Only allow toggling while in a vehicle
            if (!playerChar.isInAnyCar()) {
                if (this.isRecording) {
                    this.stopRecording();
                    showTextBox('Car recording stopped (exited vehicle)');
                }
                return;
            }

            // Check for SHIFT+R key combination with time-based debouncing
            const currentTime = Clock.GetGameTimer();
            const shiftPressed = Pad.IsKeyPressed(KeyCode.Shift);
            const rPressed = Pad.IsKeyPressed(KeyCode.R);

            if (shiftPressed && rPressed && (currentTime - this.lastKeyCheckTime) >= this.KEY_RELEASE_THRESHOLD) {
                this.toggleRecording();
                this.lastKeyCheckTime = currentTime;
            }
        } catch (e) {
            log(e)
        }
    }

    /**
     * Toggle recording on/off
     */
    private toggleRecording(): void {
        if (this.isRecording) {
            this.stopRecording();
            showTextBox('Car recording OFF');
        } else {
            this.startRecording();
            showTextBox('Car recording ON');
        }
    }

    /**
     * Start recording
     */
    private startRecording(): void {
        // Clear previous recording
        this.recording.clear();

        const currentTime = Clock.GetGameTimer();
        this.recordingStartTime = currentTime;
        this.lastRecordTime = currentTime;
        this.nextRecordingInterval = 0;

        const findFileResult = FindFile.First(`${this.filePath}*.rrr`);

        let actualFilePath = this.filePath;

        if(findFileResult) {
            let fileName = findFileResult.fileName;
            while(true) {
                wait(0)
                const carRecordingNumber = fileName.match(/\d/g)?.join('') || '';
                
                if(carRecordingNumber !== '') {
                    actualFilePath = `${this.filePath}${parseInt(carRecordingNumber) + 1}.rrr`;
                } else {
                    actualFilePath = `${this.filePath}1.rrr`;
                }

                fileName = findFileResult.handle.next();

                if(!fileName) {
                    break;
                }
            }
            findFileResult.handle.close();
        } else {
            actualFilePath = `${actualFilePath}1.rrr`;
        }


        log(`actualFilePath:${actualFilePath}`);
        // Open file for writing
        const file = File.Open(actualFilePath, "wb" as any);
        if (!file) {
            showTextBox('Failed to open recording file');
            return;
        }

        this.fileHandle = file;
        this.isRecording = true;
    }

    /**
     * Stop recording and save to file
     */
    private stopRecording(): void {
        if (!this.isRecording) return;

        this.isRecording = false;

        // Close file (frames were written incrementally)
        if (this.fileHandle) {
            this.fileHandle.close();
            this.fileHandle = null;
        }

        const duration = this.recording.getDuration();
        log(`Recording saved: ${this.recording.getFrameCount()} frames, ${duration}ms duration`);
    }

    /**
     * Write an ArrayBuffer to the file
     */
    private writeBufferToFile(buffer: ArrayBuffer): void {
        if (!this.fileHandle) return;

        const view = new DataView(buffer);

        // Allocate temporary memory for the buffer
        const tempAddr = Memory.Allocate(buffer.byteLength);

        if (!tempAddr) {
            log('Failed to allocate memory for file writing');
            return;
        }

        // Copy ArrayBuffer to allocated memory
        for (let i = 0; i < buffer.byteLength; i++) {
            Memory.WriteU8(tempAddr + i, view.getUint8(i), false);
        }

        // Use writeBlock instead of write for larger sizes (write is limited to 4 bytes)
        const success = this.fileHandle.writeBlock(buffer.byteLength, tempAddr);

        if (!success) {
            log('Failed to write frame to file');
        }

        Memory.Free(tempAddr);
    }

    /**
     * Process recording during active recording
     */
    private processRecording(): void {
        const currentTime = Clock.GetGameTimer();
        const timeSinceLastRecord = currentTime - this.lastRecordTime;

        // Check if it's time to record a new frame
        if (timeSinceLastRecord >= this.nextRecordingInterval) {
            // Calculate elapsed time since recording started
            const totalTime = currentTime - this.recordingStartTime;
            // Record current vehicle state
            this.recordFrame(totalTime);

            // Update last record time and calculate next interval
            this.lastRecordTime = currentTime;
            this.nextRecordingInterval = this.calculateNextInterval();
        }
    }

    /**
     * Calculate next recording interval with randomness
     */
    private calculateNextInterval(): number {
        const randomMs = Math.floor(Math.random() * this.RANDOM_INTERVAL_MAX);
        return this.BASE_INTERVAL_MS + randomMs;
    }

    /**
     * Record a single frame of vehicle data
     * @param totalTime Total time elapsed since recording started (in milliseconds)
     */
    private recordFrame(totalTime: number): void {
        try {
            const player = new Player(0);
            const playerChar = player.getChar();

            if (!playerChar.isInAnyCar()) {
                return;
            }

            const vehicle = playerChar.storeCarIsInNoSave();
            const vehicleAddress = Memory.GetVehiclePointer(vehicle);

            if (vehicleAddress === 0) {
                return;
            }

            const frame = new VehicleStateEachFrame();
            frame.time = totalTime;

            // Read velocity (3 floats at offsets 0x44, 0x48, 0x4C)
            const velX = Memory.ReadFloat(vehicleAddress + VehicleOffsets.VELOCITY_X, false);
            const velY = Memory.ReadFloat(vehicleAddress + VehicleOffsets.VELOCITY_Y, false);
            const velZ = Memory.ReadFloat(vehicleAddress + VehicleOffsets.VELOCITY_Z, false);
            frame.velocity = new FixedVector3(velX, velY, velZ);

            // Read matrix pointer
            const matrixPtr = Memory.ReadU32(vehicleAddress + VehicleOffsets.MATRIX, false);

            // Read right vector from matrix
            const rightX = Memory.ReadFloat(matrixPtr + VehicleOffsets.RIGHT_X, false);
            const rightY = Memory.ReadFloat(matrixPtr + VehicleOffsets.RIGHT_Y, false);
            const rightZ = Memory.ReadFloat(matrixPtr + VehicleOffsets.RIGHT_Z, false);
            frame.right = new FixedVector3(rightX, rightY, rightZ);

            // Read top vector from matrix
            const topX = Memory.ReadFloat(matrixPtr + VehicleOffsets.TOP_X, false);
            const topY = Memory.ReadFloat(matrixPtr + VehicleOffsets.TOP_Y, false);
            const topZ = Memory.ReadFloat(matrixPtr + VehicleOffsets.TOP_Z, false);
            frame.top = new FixedVector3(topX, topY, topZ);

            // Read steering angle
            frame.steeringAngle = Memory.ReadFloat(vehicleAddress + VehicleOffsets.STEER_ANGLE, false);

            // Read gas pedal
            frame.gasPedal = Memory.ReadFloat(vehicleAddress + VehicleOffsets.GAS_PEDAL, false);

            // Read brake pedal
            frame.brakePedal = Memory.ReadFloat(vehicleAddress + VehicleOffsets.BRAKE_PEDAL, false);

            // Read handbrake (bit 5 of vehicle flags at 0x428)
            const vehicleFlags = Memory.ReadU8(vehicleAddress + VehicleOffsets.VEHICLE_FLAGS, false);
            frame.handbrake = (vehicleFlags & (1 << VehicleOffsets.HANDBRAKE_BIT)) !== 0;

            // Read position
            const coords = vehicle.getCoordinates();
            frame.position = new FixedVector3(coords.x, coords.y, coords.z);

            // Add frame to recording and write to file
            this.recording.addFrame(frame);

            // Optionally write immediately to file for safety
            if (this.fileHandle) {
                this.writeBufferToFile(frame.toBuffer());
            }
        } catch (e) {
            log(`Error recording frame: ${e}`);
        }
    }

    /**
     * Check if currently recording
     */
    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Get the current recording
     */
    getRecording(): CarRecording {
        return this.recording;
    }
}