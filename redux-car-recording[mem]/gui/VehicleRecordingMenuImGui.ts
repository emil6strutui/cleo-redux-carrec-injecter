import { ImGuiCond } from "../.config/sa.enums.js";

export type RecordingToPlay = {
    name: string;
    isPlaybackEnabled: boolean;
    isPlayerAsPassanger: boolean;
    startDelay: number;
}


export class VehicleRecordingMenuImGui {


    private static readonly WINDOW_NAME = "VehicleRecordingMenu";
    private static readonly WINDOW_WIDTH = 800;
    private static readonly WINDOW_HEIGHT = 600;
    private isOpen = false;
    private currentPage = 0;
    private itemsPerPage = 10;
    private totalItems = 0;


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
        if(this.isOpen) {

            ImGui.SetNextWindowPos(100, 100, ImGuiCond.Once);
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

    public playRecordings() {
        this.recordingsToPlay = this.carrecs.filter(carrec => carrec.isPlaybackEnabled);
    }

    public getRecordingsToPlay(): RecordingToPlay[] {
        return this.recordingsToPlay;
    }

    public recordingsToPlayClear() {
        this.recordingsToPlay = [];
    }

}

