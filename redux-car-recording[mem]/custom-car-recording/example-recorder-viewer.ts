/**
 * Example: Car Recording Playback
 *
 * This script demonstrates how to play back a recorded vehicle movement.
 * Press CTRL+P to start playback on the nearest vehicle.
 * Press CTRL+S to stop playback.
 */

import { CarRecordingViewer } from './CarRecordingViewer';

// Create viewer instance
const RECORDING_FILE = `${__dirname}/recordings/my_recording.rrr`;
const viewer = new CarRecordingViewer(RECORDING_FILE);

// Load the recording
if (!viewer.load()) {
    showTextBox('Failed to load recording!');
    exit('Recording file not found or invalid');
}

showTextBox('Recording loaded! Press CTRL+P to play, CTRL+S to stop');
log(`Loaded recording: ${viewer.getRecording()?.getFrameCount()} frames`);

const KEY_P = 80; // P key
const KEY_S = 83; // S key
const KEY_CTRL = 17; // CTRL key

let lastFrameTime = TIMERA;

// Main loop
while (true) {
    wait(0);

    const currentTime = TIMERA;
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Update viewer
    viewer.update(deltaTime);

    try {
        const player = new Player(0);
        const playerChar = player.getChar();

        // Check for playback control keys
        const ctrlPressed = Pad.IsKeyPressed(KEY_CTRL);

        // Start playback on nearest vehicle (CTRL+P)
        if (ctrlPressed && Pad.IsKeyPressed(KEY_P) && !viewer.isCurrentlyPlaying()) {
            if (playerChar.isInAnyCar()) {
                const vehicle = playerChar.storeCarIsInNoSave();
                if (viewer.startPlayback(vehicle, false)) {
                    showTextBox('Playback started');
                }
            } else {
                showTextBox('You must be in a vehicle to start playback');
            }
        }

        // Stop playback (CTRL+S)
        if (ctrlPressed && Pad.IsKeyPressed(KEY_S) && viewer.isCurrentlyPlaying()) {
            viewer.stopPlayback();
            showTextBox('Playback stopped');
        }

        // Display playback info
        if (viewer.isCurrentlyPlaying()) {
            const progress = (viewer.getCurrentTime() / viewer.getDuration() * 100).toFixed(1);
            // You can display this info on screen if you have text rendering
            // For now, we'll just log it periodically
            if (currentTime % 1000 === 0) {
                log(`Playback: ${progress}%`);
            }
        }
    } catch (e) {
        // Player might not exist
    }
}