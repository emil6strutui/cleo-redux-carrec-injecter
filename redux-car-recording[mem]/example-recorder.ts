/**
 * Example: Car Recording
 *
 * This script demonstrates how to record vehicle movement.
 * Press SHIFT+R while in a vehicle to start/stop recording.
 */

import { CarRecordingRecorder } from './CarRecordingRecorder';

// Create recorder instance
const RECORDING_FILE = `${__dirname}/recordings/my_recording.rrr`;
const recorder = new CarRecordingRecorder(RECORDING_FILE, 900);

// Display instructions
showTextBox('Car Recorder Ready! Press SHIFT+R to toggle recording.');
log('Car Recording System initialized');
log(`Recording will be saved to: ${RECORDING_FILE}`);

// Main loop
while (true) {
    wait(0);

    // Update recorder every frame
    recorder.update();
}