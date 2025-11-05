import { ImGuiCond, KeyCode, PedType, SeatId } from "../.config/sa.enums.js";
import { NativeCarRecordingInjector } from "../native-car-recording/NativeCarRecordingInjector";

export type RecordingToPlay = {
    name: string;
    isPlaybackEnabled: boolean;
    isPlayerAsPassanger: boolean;
    startDelay: number;
}


export class VehicleRecordingMenuImGui {


    private static readonly WINDOW_NAME = "Vehicle Recording Menu";
    private static readonly HELP_WINDOW_NAME = "Help Window";
    private static readonly HELP_WINDOW_WIDTH = 400;
    private static readonly HELP_WINDOW_HEIGHT = 400;

    private static readonly WINDOW_WIDTH = 800;
    private static readonly WINDOW_HEIGHT = 600;

    private isHelpOpen = true;
    private isOpen = false;
    private currentPage = 0;
    private itemsPerPage = 10;
    private totalItems = 0;

    private isPlaybackGoingOn = false;
    private carRecordingFileNumbers: {fileNumber: number, startDelay: number, car?: Car, driver?: Char, isStarted?: boolean, isPlayerAsPassanger?: boolean}[] = [];
    private carrecs: RecordingToPlay[] = [];
    private recordingsToPlay: RecordingToPlay[] = [];
    

    public constructor(recordings: string[]) {
        this.totalItems = recordings.length;
        this.carrecs = recordings.map(recording => {
            return {
                name: recording,
                isPlaybackEnabled: false,
                isPlayerAsPassanger: false,
                startDelay: 0
            }
        });
    }

    public update() {
        ImGui.BeginFrame("VRMFrame");
        ImGui.SetCursorVisible(this.isOpen);
        log(this.carrecs.length);


        if(this.isHelpOpen) {
            ImGui.SetNextWindowPos(0, 0, ImGuiCond.Once);
            ImGui.SetWindowSize(VehicleRecordingMenuImGui.HELP_WINDOW_WIDTH, VehicleRecordingMenuImGui.HELP_WINDOW_HEIGHT, ImGuiCond.Once);
            ImGui.Begin(VehicleRecordingMenuImGui.HELP_WINDOW_NAME, this.isHelpOpen, false, false, false, true);
            ImGui.Text("Welcome to the Vehicle Recording Menu!");
            ImGui.Separator();
            ImGui.Text("This mod allows you to record and play back vehicle recordings.");
            ImGui.Text("To record a vehicle, you must be in a vehicle. \nTo start recording press SHIFT+R and SHIFT+R again to stop recording.");
            ImGui.Text("To open the playback menu, press SHIFT+L.");
            ImGui.Text("To close the help menu, press SHIFT+H.");
            ImGui.End();
        }

        if(Pad.IsKeyPressed(KeyCode.Shift) && Pad.IsKeyJustPressed(KeyCode.H)) {
            this.isHelpOpen = !this.isHelpOpen;
        }

        if(this.isOpen) {

            ImGui.SetNextWindowPos(200, 200, ImGuiCond.Once);
            ImGui.SetWindowSize(VehicleRecordingMenuImGui.WINDOW_WIDTH, VehicleRecordingMenuImGui.WINDOW_HEIGHT, ImGuiCond.Once);

            this.isOpen = ImGui.Begin(VehicleRecordingMenuImGui.WINDOW_NAME, this.isOpen, false, false, false, true);
            

            if(ImGui.Button("Play", 100, 40)) {
                this.playRecordings();
            }

            const startIdx = this.currentPage * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, this.carrecs.length);

            // Display current page items
            for (let i = startIdx; i < endIdx; i++) {
                ImGui.Text(this.carrecs[i].name);
                ImGui.SameLine();
                this.carrecs[i].isPlaybackEnabled = ImGui.Checkbox(`playback##${i}`, this.carrecs[i].isPlaybackEnabled);

                
                ImGui.SameLine();
                this.carrecs[i].isPlayerAsPassanger = ImGui.Checkbox(`playerAsPassanger##${i}`, this.carrecs[i].isPlayerAsPassanger);


                ImGui.SameLine();
                ImGui.PushItemWidth(150);
                this.carrecs[i].startDelay = ImGui.InputInt(`start-delay-ms##${i}`, 0, 0, 10000);
            
            }

            ImGui.Separator();

            // Pagination controls
            ImGui.Text(`Page ${this.currentPage + 1} of ${Math.ceil(this.totalItems / this.itemsPerPage)}`);

            // Add dummy spacing to push buttons to the right
            ImGui.SameLine();
            ImGui.Dummy(310, 0);

            ImGui.SameLine();
            if (ImGui.Button("Previous", 150, 40) && this.currentPage > 0) {
                this.currentPage--;
            }

            ImGui.SameLine();
            if (ImGui.Button("Next", 150, 40) && this.currentPage < Math.ceil(this.totalItems / this.itemsPerPage) - 1) {
                this.currentPage++;
            }


            ImGui.End();
        }
        ImGui.EndFrame();
    }

    public open() {
        this.isOpen = true;
    }


    public close() {
        this.isOpen = false;
    }

    public isMenuOpen(): boolean {
        return this.isOpen;
    }

    public playRecordings() {
        this.recordingsToPlay = this.carrecs.filter(carrec => carrec.isPlaybackEnabled);
    }

    public getRecordingsToPlay(): RecordingToPlay[] {
        return this.recordingsToPlay;
    }

    public recordingsToPlayClear() {
        this.recordingsToPlay = [];
    }

    public setRecordings(recordings: string[]) {
        this.totalItems = recordings.length;
        this.carrecs = recordings.map(recording => {
            return {
                name: recording,
                isPlaybackEnabled: false,
                isPlayerAsPassanger: false,
                startDelay: 0
            }
        });
    }

    public isCurrentlyPlayingRecordings(playerChar: Char, player: Player, recordingFolder: string): boolean {
        if(this.isPlaybackGoingOn) {

            if(this.carRecordingFileNumbers.length === 0) {
                this.isPlaybackGoingOn = false;
                return true;
            }
    
            const createdCars = this.carRecordingFileNumbers.filter(carRecording => carRecording.car);
            const notCreatedCars = this.carRecordingFileNumbers.filter(carRecording => !carRecording.car);
    
            if(notCreatedCars.length === 0 && createdCars.length === 0) {
                this.isPlaybackGoingOn = false;
                return true;
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
                    if(playerChar.isInCar(carRecording.car)) {
                        playerChar.warpFromCarToCoord(carRecording.car.getCoordinates().x, carRecording.car.getCoordinates().y, carRecording.car.getCoordinates().z + 1.0)
                    }
                    player.setControl(true);
                    carRecording.car.delete()
                    const index = this.carRecordingFileNumbers.indexOf(carRecording);
                    if(index > -1) {
                        this.carRecordingFileNumbers.splice(index, 1);
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
                        if(playerChar.isInAnyCar()) {
                            const {x, y, z} = playerChar.getCoordinates();
                            playerChar.warpFromCarToCoord(x, y, z + 1.0)
                            wait(0)
                        }
                        playerChar.warpIntoCarAsPassenger(car, SeatId.FrontRight);
                    }
                    car.startPlayback(carRecording.fileNumber);
                    car.pausePlayback();
                    Camera.Restore();
                    carRecording.isStarted = false;
                });
            }
            return true;
        }
    
        if(this.recordingsToPlay.length > 0) {
            this.recordingsToPlay.forEach(recording => {
    
                const injector = NativeCarRecordingInjector.loadFromFile(`${recordingFolder}\\${recording.name}`);
    
                // Inject into game (auto-assigns file number, e.g., 900)
                const fileNumber = injector.injectIntoGame();
                this.carRecordingFileNumbers.push({fileNumber: fileNumber, startDelay: recording.startDelay, isPlayerAsPassanger: recording.isPlayerAsPassanger});
            });
    
            this.isPlaybackGoingOn = true;
            TIMERA = 0
            this.recordingsToPlayClear();
            this.close();
            return true;
        }
        return false;
    }

}