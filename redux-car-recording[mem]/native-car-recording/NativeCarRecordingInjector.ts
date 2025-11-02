import { CarRecording } from "../custom-car-recording/CarRecording";

/**
 * NativeCarRecordingInjector injects car recordings into the game's StreamingArray,
 * allowing them to be used with native GTA SA opcodes like car.startPlayback(pathId).
 *
 * This is the cleanest approach - we just inject the recording and let the game
 * handle everything through its native CVehicleRecording system.
 *
 * Memory addresses from gta-reversed VehicleRecording.h:
 * - StreamingArray: 0x97D880 (array of 475 CPath structures)
 * - NumPlayBackFiles: 0x97F630 (int32)
 */
export class NativeCarRecordingInjector {
    // CVehicleRecording static addresses
    private static readonly ADDR_STREAMING_ARRAY = 0x97D880;     // CPath[475]
    private static readonly ADDR_NUM_PLAYBACK_FILES = 0x97F630;  // int32
    private static readonly TOTAL_RRR_MODEL_IDS = 475;            // From VehicleRecording.h
    private static readonly CPATH_SIZE = 0x10;                   // sizeof(CPath) = 16 bytes

    // CMemoryMgr function addresses (from MemoryMgr.cpp)
    private static readonly ADDR_CMEMORY_MGR_MALLOC = 0x72F420;  // void* Malloc(uint32 size, uint32 hint)
    private static readonly ADDR_CMEMORY_MGR_FREE = 0x72F430;    // void Free(void* memory)

    // Memory hints (from MemoryMgr.h eMemoryId)
    private static readonly MEM_STREAMING = 7;
    private static readonly MEM_PATHS = 29;

    /**
     * CPath structure offsets (16 bytes total):
     * +0x00: int32 m_nNumber      - File number (e.g., 900 for carrec900.rrr)
     * +0x04: int32 m_pData        - Pointer to CVehicleStateEachFrame array
     * +0x08: int32 m_nSize        - Byte size of data
     * +0x0C: int8  m_nRefCount    - Reference count
     */
    private static readonly CPATH_OFFSET_NUMBER = 0x00;
    private static readonly CPATH_OFFSET_DATA = 0x04;
    private static readonly CPATH_OFFSET_SIZE = 0x08;
    private static readonly CPATH_OFFSET_REFCOUNT = 0x0C;

    private static initialFileNumber = 900

    private recording: CarRecording;
    private allocatedMemory: number | null = null;
    private injectedFileNumber: number | null = null;
    private streamingArrayIndex: number = -1;

    /**
     * Creates a new native car recording injector
     * @param recording The car recording to inject
     */
    constructor(recording: CarRecording) {
        this.recording = recording;
    }

    /**
     * Loads a recording from a file
     * @param filePath Path to the recording file (e.g., "carrec900.rrr")
     * @returns A new NativeCarRecordingInjector instance
     */
    static loadFromFile(filePath: string): NativeCarRecordingInjector {
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
        return new NativeCarRecordingInjector(recording);
    }

    /**
     * Finds a free slot in the StreamingArray
     * @returns The slot index (0-474) or -1 if all slots are occupied
     */
    private findFreeStreamingSlot(): number {
        for (let i = 0; i < NativeCarRecordingInjector.TOTAL_RRR_MODEL_IDS; i++) {
            const cpathAddr = NativeCarRecordingInjector.ADDR_STREAMING_ARRAY + (i * NativeCarRecordingInjector.CPATH_SIZE);
            const CPathOffsetNumber = Memory.ReadU32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_NUMBER, false);
            const dataPtr = Memory.ReadU32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_DATA, false);

            if(CPathOffsetNumber >= NativeCarRecordingInjector.initialFileNumber && dataPtr == 0) {
                return i;
            }
            // Slot is free if CPathOffsetNumber is 0 because those slots are not occupied by .rrr files from the carrec.img
            if (CPathOffsetNumber === 0) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Finds an unused file number for the recording
     * @returns A unique file number (starting from 900)
     */
    private findUnusedFileNumber(): number {
        // Start from 900 (common for custom recordings)
        for (let fileNumber = 900; fileNumber < 999; fileNumber++) {
            let found = false;

            // Check if this file number is already in use
            for (let i = 0; i < NativeCarRecordingInjector.TOTAL_RRR_MODEL_IDS; i++) {
                const cpathAddr = NativeCarRecordingInjector.ADDR_STREAMING_ARRAY + (i * NativeCarRecordingInjector.CPATH_SIZE);
                const existingNumber = Memory.ReadI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_NUMBER, false);
                const dataPtr = Memory.ReadI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_DATA, false);

                if (existingNumber === fileNumber && dataPtr != 0) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                return fileNumber;
            }
        }

        throw new Error("No available file numbers (900-998 all in use)");
    }

    /**
     * Injects the recording into the game's StreamingArray so it can be used
     * with native opcodes like car.startPlayback(fileNumber).
     *
     * @param fileNumber Optional file number (e.g., 900). If not provided, finds an unused one.
     * @returns The file number that was used for injection
     */
    injectIntoGame(fileNumber?: number): number {
        if (this.injectedFileNumber !== null) {
            log(`Recording already injected as file ${this.injectedFileNumber}`);
            return this.injectedFileNumber;
        }

        // Find a free slot in StreamingArray
        this.streamingArrayIndex = this.findFreeStreamingSlot();
        if (this.streamingArrayIndex === -1) {
            throw new Error("All 475 StreamingArray slots are occupied");
        }

        // Determine file number to use
        if (fileNumber === undefined) {
            fileNumber = this.findUnusedFileNumber();
        }

        // Allocate memory for recording frames using game's memory manager
        // This is CRITICAL: We must use CMemoryMgr::Malloc so the game can later
        // free it with CMemoryMgr::Free without crashing!
        const frameSize = 0x20; // sizeof(CVehicleStateEachFrame)
        const totalSize = this.recording.getFrameCount() * frameSize;

        // Call CMemoryMgr::Malloc(size, hint) using cdecl convention
        const mallocFn = Memory.Fn.Cdecl(NativeCarRecordingInjector.ADDR_CMEMORY_MGR_MALLOC);
        this.allocatedMemory = mallocFn(totalSize, NativeCarRecordingInjector.MEM_PATHS);

        if (!this.allocatedMemory || this.allocatedMemory === 0) {
            throw new Error("Failed to allocate memory for recording frames via CMemoryMgr::Malloc");
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

        // Set up CPath structure in StreamingArray
        const cpathAddr = NativeCarRecordingInjector.ADDR_STREAMING_ARRAY +
                         (this.streamingArrayIndex * NativeCarRecordingInjector.CPATH_SIZE);

        // m_nNumber = fileNumber
        Memory.WriteI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_NUMBER, fileNumber, false);

        // m_pData = allocatedMemory
        Memory.WriteU32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_DATA, this.allocatedMemory, false);

        // m_nSize = totalSize
        Memory.WriteI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_SIZE, totalSize, false);

        // m_nRefCount = 0
        Memory.WriteI8(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_REFCOUNT, 0, false);

        // Increment NumPlayBackFiles
        const currentNumFiles = Memory.ReadI32(NativeCarRecordingInjector.ADDR_NUM_PLAYBACK_FILES, false);
        Memory.WriteI32(NativeCarRecordingInjector.ADDR_NUM_PLAYBACK_FILES, currentNumFiles + 1, false);

        this.injectedFileNumber = fileNumber;

        log(`Recording injected into StreamingArray[${this.streamingArrayIndex}] as file ${fileNumber}`);
        log(`  Frames: ${this.recording.getFrameCount()}, Size: ${totalSize} bytes, Duration: ${this.recording.getDuration()}ms`);

        return fileNumber;
    }

    /**
     * Removes the recording from the game's StreamingArray
     */
    removeFromGame(): void {
        if (this.injectedFileNumber === null || this.streamingArrayIndex === -1) {
            log("Recording not currently injected");
            return;
        }

        // IMPORTANT: Free memory BEFORE clearing CPath structure
        // Must use CMemoryMgr::Free to match CMemoryMgr::Malloc
        if (this.allocatedMemory !== null) {
            const freeFn = Memory.Fn.Cdecl(NativeCarRecordingInjector.ADDR_CMEMORY_MGR_FREE);
            freeFn(this.allocatedMemory);
            log(`Freed game memory at 0x${this.allocatedMemory.toString(16)}`);
            this.allocatedMemory = null;
        }

        // Clear CPath structure in StreamingArray
        const cpathAddr = NativeCarRecordingInjector.ADDR_STREAMING_ARRAY +
                         (this.streamingArrayIndex * NativeCarRecordingInjector.CPATH_SIZE);

        // m_nNumber = 0
        Memory.WriteI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_NUMBER, 0, false);

        // m_pData = NULL
        Memory.WriteU32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_DATA, 0, false);

        // m_nSize = 0
        Memory.WriteI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_SIZE, 0, false);

        // m_nRefCount = 0
        Memory.WriteI8(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_REFCOUNT, 0, false);

        // Decrement NumPlayBackFiles
        const currentNumFiles = Memory.ReadI32(NativeCarRecordingInjector.ADDR_NUM_PLAYBACK_FILES, false);
        Memory.WriteI32(NativeCarRecordingInjector.ADDR_NUM_PLAYBACK_FILES, Math.max(0, currentNumFiles - 1), false);

        log(`Recording removed from StreamingArray[${this.streamingArrayIndex}], file ${this.injectedFileNumber}`);

        this.injectedFileNumber = null;
        this.streamingArrayIndex = -1;
    }

    /**
     * Gets the file number that was injected
     * @returns The file number or null if not injected
     */
    getFileNumber(): number | null {
        return this.injectedFileNumber;
    }

    /**
     * Checks if the recording is currently injected
     * @returns true if injected
     */
    isInjected(): boolean {
        return this.injectedFileNumber !== null;
    }

    /**
     * Gets the recording data
     * @returns The CarRecording instance
     */
    getRecording(): CarRecording {
        return this.recording;
    }

    /**
     * Static utility to list all recordings currently in StreamingArray
     * @returns Array of {index, fileNumber, size, frameCount, dataPtr} objects
     */
    static listRecordings(): Array<{index: number, fileNumber: number, size: number, frameCount: number, dataPtr: number}> {
        const recordings: Array<{index: number, fileNumber: number, size: number, frameCount: number, dataPtr: number}> = [];

        for (let i = 0; i < NativeCarRecordingInjector.TOTAL_RRR_MODEL_IDS; i++) {
            const cpathAddr = NativeCarRecordingInjector.ADDR_STREAMING_ARRAY + (i * NativeCarRecordingInjector.CPATH_SIZE);
            const dataPtr = Memory.ReadU32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_DATA, false);

            const fileNumber = Memory.ReadI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_NUMBER, false);
            const size = Memory.ReadI32(cpathAddr + NativeCarRecordingInjector.CPATH_OFFSET_SIZE, false);
            const frameCount = Math.floor(size / 0x20); // 0x20 = sizeof(CVehicleStateEachFrame)

            recordings.push({
                index: i,
                fileNumber,
                size,
                frameCount,
                dataPtr
            });
        }

        return recordings;
    }
}
