import { KeyCode } from "./.config/sa.enums.js"
import {CarRecordingRecorder} from "./custom-car-recording/CarRecordingRecorder";
import { VehicleRecordingMenuImGui } from "./gui/VehicleRecordingMenuImGui";

const PLAYER = new Player(0);
const PLAYER_CHAR = PLAYER.getChar();
const RECORDING_PATTERN = `${__dirname}\\recordings\\*.rrr`;
const RECORDING_FOLDER = `${__dirname}\\recordings`;

let lastFrameIsRecording = true;

const vehicleRecordingMenuImGui = new VehicleRecordingMenuImGui([]);
const recorder = new CarRecordingRecorder(`${RECORDING_FOLDER}\\rec`);

while(true) {
    wait(0)


    const currentFrameIsRecording = recorder.update();


    if(lastFrameIsRecording !== currentFrameIsRecording) {
        if(!currentFrameIsRecording) {
            const recordings: string[] = [];
            const findFileResult = FindFile.First(RECORDING_PATTERN);

            if(findFileResult) {
                recordings.push(findFileResult.fileName);
                while (true) {
                    wait(0)
                    const fileName = findFileResult.handle.next();
                    if(fileName) {
                        recordings.push(fileName);
                    } else {
                        findFileResult.handle.close();
                        break;
                    }
                }
            }
            vehicleRecordingMenuImGui.setRecordings(recordings);
        }
    }


    lastFrameIsRecording = currentFrameIsRecording;
    vehicleRecordingMenuImGui.update();

    if(vehicleRecordingMenuImGui.isCurrentlyPlayingRecordings(PLAYER_CHAR, PLAYER, RECORDING_FOLDER)) {
        continue;
    }

    if(Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyJustPressed(KeyCode.L)) {
        if(vehicleRecordingMenuImGui.isMenuOpen()) {
            vehicleRecordingMenuImGui.close();
        } else {
            vehicleRecordingMenuImGui.open();
        }
    }
}