/**
 * Example: Car Recording
 *
 * This script demonstrates how to record vehicle movement.
 * Press SHIFT+R while in a vehicle to start/stop recording.
 */

import { CarRecordingRecorder } from './CarRecordingRecorder';

// Create recorder instance
/** Recording folder path 
 * This folder will be created if it doesn't exist.
 * The recordings will be saved in this folder.
 * Just make sure that you only have the fileName as the number and the extension will be added by the recorder.
 * Example: rec, recording, my_recording, etc.
 * The recorder will save the recordings in the format: 
 * rec1.rrr,rec2.rrr,rec3.rrr, etc. 
 * recording1.rrr, recording2.rrr, recording3.rrr, etc.
 *
*/
const RECORDING_FILE = `${__dirname}/recordings/rec`;
const recorder = new CarRecordingRecorder(RECORDING_FILE);

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