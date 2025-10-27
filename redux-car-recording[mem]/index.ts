

/**
 * Example: Car Recording and Playback with CLEO Redux
 *
 * This example demonstrates:
 * 1. Recording vehicle movement
 * 2. Saving recording to file (placeholder)
 * 3. Loading and playing back recording
 *
 * Controls:
 * - Press KEY_1 to start recording
 * - Press KEY_2 to stop recording and save
 * - Press KEY_3 to load and playback recording
 */

import { KeyCode } from "./.config/sa.enums.js";
import { CarRecordingRecorder } from "./CarRecordingRecorder";
import { CarRecordingViewer } from "./CarRecordingViewer";
import { CarRecording } from "./CarRecording";

const player = new Player(0);
const playerChar = player.getChar()
let recorder: CarRecordingRecorder | null = null;
let viewer: CarRecordingViewer | null = null;
let recordingBuffer: ArrayBuffer | null = null;

// Get player's vehicle
function getPlayerCar(): Car | null {
    if (playerChar.isInAnyCar()) {
        return playerChar.storeCarIsInNoSave();
    }
    return null;
}

// Main loop
(async function main() {
    log("Car Recording System loaded!");
    log("Press R to start recording");
    log("Press S to stop recording");
    log("Press L to playback recording");

    while (true) {
        await asyncWait(0);

        // Start recording
        if (Pad.IsKeyJustPressed(KeyCode.R)) {
            const car = getPlayerCar();
            if (car) {
                recorder = new CarRecordingRecorder(car, true); // showInfo = true
                recorder.start();
                log("Recording started! Drive around...");
            } else {
                showTextBox("~r~You need to be in a vehicle!");
            }
        }

        // Stop recording and save
        if (Pad.IsKeyJustPressed(KeyCode.S)) {
            if (recorder && recorder.isActive()) {
                recorder.stop();

                const stats = recorder.getStats();
                log(`Recording complete: ${stats.frameCount} frames, ${stats.duration.toFixed(1)}s`);

                // Export to buffer (in-memory)
                recordingBuffer = recorder.toBuffer();

                // TODO: Save to file
                // This would require implementing file I/O with CLEO Redux File API
                // For now, we keep it in memory

                log(recordingBuffer);

                showTextBox(`~g~Recording saved! ~h~${stats.frameCount} frames`);
                recorder = null;
            } else {
                showTextBox("~r~No active recording!");
            }
        }

        // Load and playback recording
        if (Pad.IsKeyJustPressed(KeyCode.L)) {
            if (recordingBuffer) {
                if(viewer && viewer.isActive()) {
                    continue
                }
                // Spawn a new vehicle for playback
                const playerPos = player.getChar().getCoordinates();
                const model = 411; // Infernus

                Streaming.RequestModel(model);
                Streaming.LoadAllModelsNow();

                const plabackCar = Car.Create(model, playerPos.x + 5, playerPos.y, playerPos.z);
                plabackCar.setStatus(1); // Enable physics

                // Load recording and start playback
                viewer = CarRecordingViewer.fromBuffer(plabackCar, recordingBuffer, true, false); // showInfo = true, loop = true
                viewer.start();

                showTextBox("~g~Playback started!");
                log("Playback started on new vehicle");
            } else {
                showTextBox("~r~No recording to playback!");
            }
        }

        // Update recorder
        if (recorder && recorder.isActive()) {
            const hasSpace = recorder.update();
            if (!hasSpace) {
                // Memory full, auto-stop
                recorder.stop();
                recordingBuffer = recorder.toBuffer();
                showTextBox("~y~Recording stopped (memory full)");
            }
        }

        // Update viewer
        if (viewer && viewer.isActive()) {
            const frameIndex = viewer.update();
            if (frameIndex === -1) {
                // Playback ended
                log("Playback completed");
                viewer = null;
            }
        }
    }
})();