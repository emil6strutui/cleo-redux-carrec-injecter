import {NativeCarRecordingViewer} from "./NativeCarRecordingViewer";
import {KeyCode} from "./.config/sa.enums.js"
import {NativeCarRecordingInjector} from "./NativeCarRecordingInjector";

let nativeViewer: NativeCarRecordingViewer | null = null;
let isPaused = false;

// Load the recording file
try {
    nativeViewer = NativeCarRecordingViewer.loadFromFile(`${__dirname}/recordings/my_recording.rrr`);
    log("Native viewer loaded successfully");
} catch (error) {
    log(`Failed to load recording: ${error}`);
}

while (true) {
    wait(0)

    if (Pad.IsKeyPressed(KeyCode.LeftControl)) {
        if (Pad.IsKeyJustPressed(KeyCode.P)) {
            if (!nativeViewer) {
                log("No recording loaded");
                continue;
            }

            const injector = NativeCarRecordingInjector.loadFromFile(`${__dirname}/recordings/my_recording.rrr`);

            // Inject into game (auto-assigns file number, e.g., 900)
            const fileNumber = injector.injectIntoGame();


            //Stop previous playback if any
            // if (nativeViewer.isPlaying()) {
            //     nativeViewer.stopPlayback();
            //     continue
            // }

            // Get player's vehicle
            const playerChar = new Player(0).getChar();
            if (!playerChar.isInAnyCar()) {
                log("You need to be in a vehicle to start playback");
                continue;
            }

            const vehicle = playerChar.getCarIsUsing();

            // Create a driver for the vehicle if player is in it
            // Warp player to front right seat

            vehicle.startPlayback(900)

            // while(vehicle.isPlaybackGoingOn()) {
            //     wait(0)
            // }
            //
            // const recordings = NativeCarRecordingInjector.listInjectedRecordings()
            // recordings.forEach(recording => {
            //     log(`fileNumber:${recording.fileNumber},
            //     indexInStreamingArray:${recording.index},
            //     size:${recording.size},
            //     frameCount:${recording.frameCount},
            //     dataPtr:${recording.dataPtr}`)
            // })

            Streaming.RemoveCarRecording(900)

            // Start native playback (no AI, looped)
            // if (nativeViewer.startPlayback(vehicle, false, false)) {
            //     log("Native playback started (no AI, physics disabled)");
            //     log("The game's CVehicleRecording system is now handling this vehicle");
            //     vehicle.startPlayback(900)
            // } else {
            //     log("Failed to start native playback");
            // }
        }
        if (Pad.IsKeyJustPressed(KeyCode.L)) {
            const slotNumbers = NativeCarRecordingViewer.getActivePlaybackSlots()

            slotNumbers.forEach(slotNumber => {
                log(`slotNumber:${slotNumber},`)
            })
        }
    }
}

// // Key combo: CTRL+SHIFT+P - Start native playback with Car AI
// onKeyDown(onKey("P", () => {
//     if (!isKeyPressed(Keys.LeftControl) || !isKeyPressed(Keys.LeftShift)) return;
//     if (!nativeViewer) {
//         log("No recording loaded");
//         return;
//     }
//
//     // Stop previous playback if any
//     if (nativeViewer.isPlaying()) {
//         nativeViewer.stopPlayback();
//     }
//
//     // Get player's vehicle
//     const playerPed = playerChar();
//     if (!isCharInAnyCar(playerPed)) {
//         log("You need to be in a vehicle to start playback");
//         return;
//     }
//
//     const vehicleHandle = getCarCharIsUsing(playerPed);
//     lastVehicleHandle = vehicleHandle;
//
//     // Warp player out
//     warpCharFromCarToCoord(playerPed, 0, 0, 0);
//     setCharCoordinates(playerPed, ...getCarCoordinates(vehicleHandle));
//
//     // Create a driver
//     const [x, y, z] = getCarCoordinates(vehicleHandle);
//     const driverHandle = createCharInsideCar(vehicleHandle, PedType.Civmale, 0);
//     setCharCantBeDraggedOut(driverHandle, true);
//
//     // Start native playback with AI
//     if (nativeViewer.startPlayback(vehicleHandle, true, true)) {
//         log("Native playback started (with Car AI)");
//         log("Vehicle will use autopilot to follow the recorded path");
//         isPaused = false;
//     } else {
//         log("Failed to start native playback");
//     }
// }));
//
// // Key combo: CTRL+S - Stop playback
// onKeyDown(onKey("S", () => {
//     if (!isKeyPressed(Keys.LeftControl)) return;
//     if (!nativeViewer) return;
//
//     if (nativeViewer.isPlaying()) {
//         nativeViewer.stopPlayback();
//         log("Native playback stopped");
//     }
// }));
//
// // Key combo: CTRL+[ - Decrease playback speed
// onKeyDown(onKey("OemOpenBrackets", () => {
//     if (!isKeyPressed(Keys.LeftControl)) return;
//     if (!nativeViewer || !nativeViewer.isPlaying()) return;
//
//     const currentSpeed = 1.0; // We don't track this, so we'll adjust incrementally
//     const newSpeed = Math.max(0.1, currentSpeed - 0.1);
//     nativeViewer.setPlaybackSpeed(newSpeed);
//     log(`Playback speed: ${newSpeed.toFixed(1)}x`);
// }));
//
// // Key combo: CTRL+] - Increase playback speed
// onKeyDown(onKey("OemCloseBrackets", () => {
//     if (!isKeyPressed(Keys.LeftControl)) return;
//     if (!nativeViewer || !nativeViewer.isPlaying()) return;
//
//     const currentSpeed = 1.0; // We don't track this, so we'll adjust incrementally
//     const newSpeed = Math.min(5.0, currentSpeed + 0.1);
//     nativeViewer.setPlaybackSpeed(newSpeed);
//     log(`Playback speed: ${newSpeed.toFixed(1)}x`);
// }));
//
// // Key combo: CTRL+SPACE - Pause/Resume playback
// onKeyDown(onKey("Space", () => {
//     if (!isKeyPressed(Keys.LeftControl)) return;
//     if (!nativeViewer || !nativeViewer.isPlaying()) return;
//
//     if (isPaused) {
//         nativeViewer.resume();
//         log("Playback resumed");
//         isPaused = false;
//     } else {
//         nativeViewer.pause();
//         log("Playback paused");
//         isPaused = true;
//     }
// }));
//
//
