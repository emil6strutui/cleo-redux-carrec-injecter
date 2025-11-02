import {NativeCarRecordingViewer} from "./native-car-recording/NativeCarRecordingViewer";
import { KeyCode, PedType, SeatId} from "./.config/sa.enums.js"
import {NativeCarRecordingInjector} from "./native-car-recording/NativeCarRecordingInjector";
import {CarRecordingRecorder} from "./custom-car-recording/CarRecordingRecorder";
import { VehicleRecordingMenuImGui } from "./gui/VehicleRecordingMenuImGui";

const PLAYER = new Player(0);
const PLAYER_CHAR = PLAYER.getChar();
const RECORDING_PATTERN = `${__dirname}\\recordings\\*.rrr`;
const RECORDING_FOLDER = `${__dirname}\\recordings`;
const recordings: string[] = [];

let isPlaybackGoingOn = false;
let carRecordingFileNumbers: {fileNumber: number, startDelay: number, car?: Car, driver?: Char, isStarted?: boolean, isPlayerAsPassanger?: boolean}[] = [];
const findFileResult = FindFile.First(RECORDING_PATTERN);

if(findFileResult) {
    recordings.push(findFileResult.fileName);
    while (true) {
        wait(0)
        const fileName = findFileResult.handle.next();
        if(fileName) {
            recordings.push(fileName);
        } else {
            break;
        }
    }
}

const vehicleRecordingMenuImGui = new VehicleRecordingMenuImGui(recordings);
const recorder = new CarRecordingRecorder(`${RECORDING_FOLDER}\\rec`);

while(true) {
    wait(0)

    recorder.update()
    vehicleRecordingMenuImGui.update();

    const recordingsToPlay = vehicleRecordingMenuImGui.getRecordingsToPlay();


    if(isPlaybackGoingOn) {

        if(carRecordingFileNumbers.length === 0) {
            isPlaybackGoingOn = false;
            continue;
        }

        const createdCars = carRecordingFileNumbers.filter(carRecording => carRecording.car);
        const notCreatedCars = carRecordingFileNumbers.filter(carRecording => !carRecording.car);

        if(notCreatedCars.length === 0 && createdCars.length === 0) {
            isPlaybackGoingOn = false;
            continue;
        }

        if(createdCars.length > 0) {
            createdCars.forEach(carRecording => {

                if(!carRecording.isStarted) {
                    if(TIMERA > carRecording.startDelay) {
                        carRecording.isStarted = true;
                        carRecording.car.unpausePlayback();
                        return;
                    } else {
                        return;
                    } 
                }

                if(carRecording.car.isPlaybackGoingOn()) {
                    return;
                }

                Streaming.RemoveCarRecording(carRecording.fileNumber);
                
                carRecording.driver.delete()
                if(PLAYER_CHAR.isInCar(carRecording.car)) {
                    PLAYER_CHAR.warpFromCarToCoord(carRecording.car.getCoordinates().x, carRecording.car.getCoordinates().y, carRecording.car.getCoordinates().z + 1.0)
                }
                PLAYER.setControl(true);
                carRecording.car.delete()
                const index = carRecordingFileNumbers.indexOf(carRecording);
                if(index > -1) {
                    carRecordingFileNumbers.splice(index, 1);
                }
            });
        }

        if(notCreatedCars.length > 0) {
            notCreatedCars.forEach(carRecording => {

                Streaming.RequestModel(445)//Admiral
                Streaming.RequestModel(14)
                Streaming.LoadAllModelsNow()
                const car = Car.Create(445, 0, 0, 0);
                carRecording.car = car;
                carRecording.driver = Char.Create(PedType.CivMale, 14, 0, 0, 0);
                Streaming.MarkModelAsNoLongerNeeded(445)
                Streaming.MarkModelAsNoLongerNeeded(14)
                carRecording.driver.warpIntoCar(car);
                if(carRecording.isPlayerAsPassanger) {
                    PLAYER_CHAR.warpIntoCarAsPassenger(car, SeatId.FrontRight);
                }
                car.startPlayback(carRecording.fileNumber);
                car.pausePlayback();
                carRecording.isStarted = false;
            });
        }
        continue;
    }

    if(recordingsToPlay.length > 0) {
        recordingsToPlay.forEach(recording => {

            const injector = NativeCarRecordingInjector.loadFromFile(`${RECORDING_FOLDER}\\${recording.name}`);

            // Inject into game (auto-assigns file number, e.g., 900)
            const fileNumber = injector.injectIntoGame();
            carRecordingFileNumbers.push({fileNumber: fileNumber, startDelay: recording.startDelay, isPlayerAsPassanger: recording.isPlayerAsPassanger});
        });

        isPlaybackGoingOn = true;
        TIMERA = 0
        vehicleRecordingMenuImGui.recordingsToPlayClear();
        vehicleRecordingMenuImGui.close();
        continue;
    }



    if(Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyJustPressed(KeyCode.L)) {
        vehicleRecordingMenuImGui.open();
    }
}