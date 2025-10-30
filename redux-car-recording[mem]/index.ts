/**
 * Car Recording System for GTA San Andreas
 *
 * Main entry point for the car recording system.
 * This exports all classes for use in CLEO Redux scripts.
 */

export { CarRecording, VehicleStateEachFrame, FixedVector3 } from './CarRecording';
export { CarRecordingRecorder } from './CarRecordingRecorder';
export { CarRecordingViewer } from './CarRecordingViewer';
export { NativeCarRecordingViewer } from './NativeCarRecordingViewer';


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