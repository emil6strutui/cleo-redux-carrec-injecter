import { CarRecording } from "./CarRecording";

/**
 * NativeCarRecordingViewer uses the game's native CVehicleRecording system
 * to play back car recordings. This is more efficient and compatible with
 * game systems (like car AI) compared to the manual frame-by-frame approach.
 *
 * Memory addresses from gta-reversed VehicleRecording.h:
 * - Each array has 16 slots (TOTAL_VEHICLE_RECORDS = 16)
 */
export class NativeCarRecordingViewer {
    // CVehicleRecording static array addresses (each has 16 slots)
    private static readonly ADDR_VEHICLE_FOR_PLAYBACK = 0x97D840; // CVehicle*[16]
    private static readonly ADDR_PLAYBACK_BUFFER = 0x97D800;      // CVehicleStateEachFrame*[16]
    private static readonly ADDR_PLAYBACK_INDEX = 0x97D7C0;       // int32[16]
    private static readonly ADDR_PLAYBACK_BUFFER_SIZE = 0x97D780; // int32[16]
    private static readonly ADDR_PLAYBACK_RUNNING_TIME = 0x97D740; // float[16]
    private static readonly ADDR_PLAYBACK_SPEED = 0x97D700;       // float[16]
    private static readonly ADDR_PLAYBACK_GOING_ON = 0x97D6F0;    // bool[16]
    private static readonly ADDR_PLAYBACK_LOOPED = 0x97D6E0;      // bool[16]
    private static readonly ADDR_PLAYBACK_PAUSED = 0x97D6D0;      // bool[16]
    private static readonly ADDR_USE_CAR_AI = 0x97D6C0;           // bool[16]

    private static readonly TOTAL_VEHICLE_RECORDS = 16;
    private static readonly MISSION_FOLLOW_PRE_RECORDED_PATH = 14; // eCarMission

    private recording: CarRecording;
    private allocatedMemory: number | null = null;
    private playbackSlot: number = -1;

    /**
     * Creates a new native car recording viewer
     * @param recording The car recording to play back
     */
    constructor(recording: CarRecording) {
        this.recording = recording;
    }

    /**
     * Loads a recording from a file
     * @param filePath Path to the recording file (e.g., "carrec900.rrr")
     * @returns A new NativeCarRecordingViewer instance
     */
    static loadFromFile(filePath: string): NativeCarRecordingViewer {
        const file = File.Open(filePath, "rb" as any);
        if (!file) {
            throw new Error(`Failed to open recording file: ${filePath}`);
        }

        const fileSize = file.getSize();
        if (fileSize === 0) {
            file.close();
            log('Recording file is empty');
            return;
        }

        // Allocate memory to read the file
        const bufferAddr = Memory.Allocate(fileSize);
        if (!bufferAddr) {
            file.close();
            log('Failed to allocate memory for reading file');
            return;
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

        const recording = CarRecording.fromBuffer(buffer);
        return new NativeCarRecordingViewer(recording);
    }

    /**
     * Finds an inactive playback slot in the CVehicleRecording arrays
     * @returns The slot index (0-15) or -1 if all slots are occupied
     */
    private findInactivePlaybackSlot(): number {
        for (let i = 0; i < NativeCarRecordingViewer.TOTAL_VEHICLE_RECORDS; i++) {
            const addr = NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + i;
            if (Memory.ReadU8(addr, false) === 0) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Starts native playback for a vehicle
     * @param vehicleHandle Handle to the vehicle
     * @param useCarAI If true, vehicle will use autopilot to follow the path. If false, physics will be disabled.
     * @param looped If true, playback will loop continuously
     * @returns true if playback started successfully, false otherwise
     */
    startPlayback(vehicle: Car, useCarAI: boolean = false, looped: boolean = true): boolean {
        // Find an inactive playback slot
        this.playbackSlot = this.findInactivePlaybackSlot();
        if (this.playbackSlot === -1) {
            log("Error: All 16 playback slots are occupied");
            return false;
        }

        // Allocate memory for recording frames
        const frameSize = 0x20; // sizeof(CVehicleStateEachFrame)
        const totalSize = this.recording.getFrameCount() * frameSize;
        this.allocatedMemory = Memory.Allocate(totalSize);

        if (this.allocatedMemory === 0) {
            log("Error: Failed to allocate memory for recording frames");
            return false;
        }

        // Write all frames to allocated memory
        let offset = 0;
        for (const frame of this.recording.frames) {
            const frameBuffer = frame.toBuffer();
            const view = new DataView(frameBuffer);

            // Write each byte from the ArrayBuffer to game memory
            for (let i = 0; i < frameSize; i++) {
                Memory.WriteU8(this.allocatedMemory + offset + i, view.getUint8(i), false);
            }
            offset += frameSize;
        }

        // Get vehicle pointer from handle
        const vehiclePtr = Memory.GetVehiclePointer(vehicle);

        // Set up CVehicleRecording static arrays for this playback slot
        const slotOffset = this.playbackSlot * 4; // 4 bytes per pointer/int32

        // pVehicleForPlayback[slot] = vehiclePtr
        Memory.WriteU32(NativeCarRecordingViewer.ADDR_VEHICLE_FOR_PLAYBACK + slotOffset, vehiclePtr, false);

        // pPlaybackBuffer[slot] = allocatedMemory
        Memory.WriteU32(NativeCarRecordingViewer.ADDR_PLAYBACK_BUFFER + slotOffset, this.allocatedMemory, false);

        // PlaybackBufferSize[slot] = totalSize
        Memory.WriteI32(NativeCarRecordingViewer.ADDR_PLAYBACK_BUFFER_SIZE + slotOffset, totalSize, false);

        // PlaybackIndex[slot] = 0
        Memory.WriteI32(NativeCarRecordingViewer.ADDR_PLAYBACK_INDEX + slotOffset, 900, false);

        // PlaybackRunningTime[slot] = 0.0f
        Memory.WriteFloat(NativeCarRecordingViewer.ADDR_PLAYBACK_RUNNING_TIME + slotOffset, 0.0, false);

        // PlaybackSpeed[slot] = 1.0f
        Memory.WriteFloat(NativeCarRecordingViewer.ADDR_PLAYBACK_SPEED + slotOffset, 1.0, false);

        // bPlaybackGoingOn[slot] = true
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + this.playbackSlot, 0, false);

        // bPlaybackLooped[slot] = looped
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_LOOPED + this.playbackSlot, looped ? 1 : 0, false);

        // bPlaybackPaused[slot] = false
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_PAUSED + this.playbackSlot, 0, false);

        // bUseCarAI[slot] = useCarAI
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_USE_CAR_AI + this.playbackSlot, useCarAI ? 1 : 0, false);

        // Register vehicle reference (important for game's entity management)
        // Note: This would normally be done via vehicle->RegisterReference(), but we're
        // setting up the arrays directly, so the game's SaveOrRetrieveDataForThisFrame()
        // function will handle the vehicle updates.

        if (useCarAI) {
            // Set vehicle autopilot to follow pre-recorded path
            const autoPilotOffset = 0x5A8; // CVehicle::m_autoPilot offset
            const carMissionOffset = autoPilotOffset + 0x0; // CAutoPilot::m_nCarMission
            const field94Offset = autoPilotOffset + 0x94; // CAutoPilot::field_94 (playback slot ID)

            Memory.WriteU8(vehiclePtr + carMissionOffset, NativeCarRecordingViewer.MISSION_FOLLOW_PRE_RECORDED_PATH, false);
            Memory.WriteI8(vehiclePtr + field94Offset, this.playbackSlot, false);

            // Optionally set recording to point closest to vehicle's current position
            // This is done by calling CVehicleRecording::SetRecordingToPointClosestToCoors
            // but we'll let it start from the beginning for simplicity
        } else {
            // Disable collision and physics for non-AI playback
            const physicalFlagsOffset = 0x38; // CPhysical::m_nPhysicalFlags offset
            const flags = Memory.ReadU32(vehiclePtr + physicalFlagsOffset, false);

            // Set bDisableCollisionForce and bCollidable flags
            const newFlags = flags | (1 << 7); // bDisableCollisionForce
            // Note: bCollidable is actually in a different bitfield, handling it would require
            // more complex bit manipulation. For now, the game's playback system will handle this.

            Memory.WriteU32(vehiclePtr + physicalFlagsOffset, newFlags, false);
        }

        log(`Native playback started in slot ${this.playbackSlot} (useCarAI: ${useCarAI}, looped: ${looped})`);
        log(`Recording: ${this.recording.getFrameCount()} frames, ${this.recording.getDuration()}ms duration`);

        return true;
    }

    /**
     * Stops the playback for this recording
     */
    stopPlayback(): void {
        if (this.playbackSlot === -1) {
            return;
        }

        // Get vehicle pointer to restore physics
        const slotOffset = this.playbackSlot * 4;
        const vehiclePtr = Memory.ReadU32(NativeCarRecordingViewer.ADDR_VEHICLE_FOR_PLAYBACK + slotOffset, false);

        if (vehiclePtr !== 0) {
            // Reset autopilot field_94
            const autoPilotOffset = 0x5A8;
            const field94Offset = autoPilotOffset + 0x94;
            Memory.WriteI8(vehiclePtr + field94Offset, -1, false);

            // Re-enable collision
            const physicalFlagsOffset = 0x38;
            const flags = Memory.ReadU32(vehiclePtr + physicalFlagsOffset, false);
            const newFlags = flags & ~(1 << 7); // Clear bDisableCollisionForce
            Memory.WriteU32(vehiclePtr + physicalFlagsOffset, newFlags, false);
        }

        // Clear CVehicleRecording arrays for this slot
        Memory.WriteU32(NativeCarRecordingViewer.ADDR_VEHICLE_FOR_PLAYBACK + slotOffset, 0, false);
        Memory.WriteU32(NativeCarRecordingViewer.ADDR_PLAYBACK_BUFFER + slotOffset, 0, false);
        Memory.WriteI32(NativeCarRecordingViewer.ADDR_PLAYBACK_BUFFER_SIZE + slotOffset, 0, false);
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + this.playbackSlot, 0, false);

        log(`Native playback stopped for slot ${this.playbackSlot}`);

        // Free allocated memory
        if (this.allocatedMemory !== null) {
            Memory.Free(this.allocatedMemory);
            this.allocatedMemory = null;
        }

        this.playbackSlot = -1;
    }

    /**
     * Checks if playback is currently active
     * @returns true if playback is active
     */
    isPlaying(): boolean {
        if (this.playbackSlot === -1) {
            return false;
        }
        return Memory.ReadU8(NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + this.playbackSlot, false) !== 0;
    }

    /**
     * Pauses the playback
     */
    pause(): void {
        if (this.playbackSlot === -1) {
            return;
        }
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_PAUSED + this.playbackSlot, 1, false);
        log(`Playback paused for slot ${this.playbackSlot}`);
    }

    /**
     * Resumes the playback
     */
    resume(): void {
        if (this.playbackSlot === -1) {
            return;
        }
        Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_PAUSED + this.playbackSlot, 0, false);
        log(`Playback resumed for slot ${this.playbackSlot}`);
    }

    /**
     * Sets the playback speed
     * @param speed Speed multiplier (1.0 = normal speed, 2.0 = double speed, 0.5 = half speed)
     */
    setPlaybackSpeed(speed: number): void {
        if (this.playbackSlot === -1) {
            return;
        }
        const slotOffset = this.playbackSlot * 4;
        Memory.WriteFloat(NativeCarRecordingViewer.ADDR_PLAYBACK_SPEED + slotOffset, speed, false);
        log(`Playback speed set to ${speed}x for slot ${this.playbackSlot}`);
    }

    /**
     * Gets the current playback time in milliseconds
     * @returns Current playback time
     */
    getCurrentTime(): number {
        if (this.playbackSlot === -1) {
            return 0;
        }
        const slotOffset = this.playbackSlot * 4;
        return Memory.ReadFloat(NativeCarRecordingViewer.ADDR_PLAYBACK_RUNNING_TIME + slotOffset, false);
    }

    /**
     * Gets the current frame index
     * @returns Current frame index (0-based)
     */
    getCurrentFrameIndex(): number {
        if (this.playbackSlot === -1) {
            return 0;
        }
        const slotOffset = this.playbackSlot * 4;
        const byteIndex = Memory.ReadI32(NativeCarRecordingViewer.ADDR_PLAYBACK_INDEX + slotOffset, false);
        return Math.floor(byteIndex / 0x20); // 0x20 = sizeof(CVehicleStateEachFrame)
    }

    /**
     * Gets the playback slot being used
     * @returns Playback slot (0-15) or -1 if not playing
     */
    getPlaybackSlot(): number {
        return this.playbackSlot;
    }

    /**
     * Static utility to stop all active playbacks
     */
    static stopAllPlaybacks(): void {
        for (let i = 0; i < NativeCarRecordingViewer.TOTAL_VEHICLE_RECORDS; i++) {
            const isActive = Memory.ReadU8(NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + i, false);
            if (isActive !== 0) {
                // Clear the slot
                const slotOffset = i * 4;
                Memory.WriteU32(NativeCarRecordingViewer.ADDR_VEHICLE_FOR_PLAYBACK + slotOffset, 0, false);
                Memory.WriteU32(NativeCarRecordingViewer.ADDR_PLAYBACK_BUFFER + slotOffset, 0, false);
                Memory.WriteI32(NativeCarRecordingViewer.ADDR_PLAYBACK_BUFFER_SIZE + slotOffset, 0, false);
                Memory.WriteU8(NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + i, 0, false);
                log(`Stopped playback in slot ${i}`);
            }
        }
    }

    /**
     * Static utility to get all active playback slots
     * @returns Array of active slot indices
     */
    static getActivePlaybackSlots(): number[] {
        const activeSlots: number[] = [];
        for (let i = 0; i < NativeCarRecordingViewer.TOTAL_VEHICLE_RECORDS; i++) {
            const isActive = Memory.ReadU8(NativeCarRecordingViewer.ADDR_PLAYBACK_GOING_ON + i, false);
            if (isActive !== 0) {
                activeSlots.push(i);
            }
        }
        return activeSlots;
    }
}
