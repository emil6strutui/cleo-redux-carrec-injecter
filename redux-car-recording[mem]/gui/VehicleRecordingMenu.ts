import { DrawEvent, KeyCode } from "./.config/sa.enums.js";

export class VehicleRecordingMenu {

    //The Drawing Canvas of San Andreas is 640x448
    private static readonly CANVAS_WIDTH = 640;
    private static readonly CANVAS_HEIGHT = 448;
    private static readonly MENU_WIDTH = 500.0;
    private static readonly MENU_HEIGHT = 200.0;
    private static readonly MENU_X = 320.0;
    private static readonly MENU_Y = 224.0;


    private isOpen = true;
    private listOfCarrecs: {name: string, isPlaybackEnabled: boolean, isPlayerAsPassanger: boolean}[] = [];
    private cursorPosition: {x: number, y: number} = {x: 0, y: 0};

    constructor() {
        this.listOfCarrecs = [
            {name: "INT01-CEMET-SEB", isPlaybackEnabled: true, isPlayerAsPassanger: false},
            {name: "rec2", isPlaybackEnabled: false, isPlayerAsPassanger: true},
        ];
    }

    /**
     * Handles the vehicle menu rendering and updates
     * Needs to be called every frame
     */
    public update() {
        Text.UseCommands(true);
        Txd.DrawTexturePlus(
            0,
            DrawEvent.AfterHud,
            VehicleRecordingMenu.MENU_X,
            VehicleRecordingMenu.MENU_Y,
            VehicleRecordingMenu.MENU_WIDTH,
            VehicleRecordingMenu.MENU_HEIGHT,
            0,
            0,
            false,
            0,
            0,
            0, 0, 0,
            180
        );
        // Title at top-center of menu (50% width, 10% height)
        const titlePos = this.toMenuRelative(0.5, 0.0);
        Text.DrawString("Vehicle Recording Menu", DrawEvent.AfterFade, 
                       titlePos.x, titlePos.y, 1, 1.5, true, 0);

        if(Pad.IsKeyJustPressed(KeyCode.Up)) {
            if(this.cursorPosition.y -1 >= 0) {
                this.cursorPosition.y -= 1;
            }
        }
        if(Pad.IsKeyJustPressed(KeyCode.Down)) {
            if(this.cursorPosition.y +1 < this.listOfCarrecs.length) {
                this.cursorPosition.y += 1;
            }
        }
        if(Pad.IsKeyJustPressed(KeyCode.Left)) {
            if(this.cursorPosition.x - 1 >= 0) {
                this.cursorPosition.x -= 1;
            }
        }
        if(Pad.IsKeyJustPressed(KeyCode.Right)) {
            if(this.cursorPosition.x + 1 < 2) { // 2 is the number of the two checkboxes
                this.cursorPosition.x += 1;
            }
        }


        log(this.cursorPosition.x, this.cursorPosition.y);
        if(Pad.IsKeyJustPressed(KeyCode.Return)) {
            if(this.cursorPosition.x === 0) {
                //If Player is assigned as passanger, reset to false
                if(this.listOfCarrecs[this.cursorPosition.y].isPlayerAsPassanger) {
                    this.listOfCarrecs[this.cursorPosition.y].isPlayerAsPassanger = false;
                }
                this.listOfCarrecs[this.cursorPosition.y].isPlaybackEnabled = !this.listOfCarrecs[this.cursorPosition.y].isPlaybackEnabled;
            } else if(this.cursorPosition.x === 1) {
                //Reset all other carrecs to false
                this.listOfCarrecs.forEach(carrec => {
                    carrec.isPlayerAsPassanger = false;
                });

                //Verify if the current carrec is not already assigned as passanger and that it's playback is enabled
                if(!this.listOfCarrecs[this.cursorPosition.y].isPlayerAsPassanger && this.listOfCarrecs[this.cursorPosition.y].isPlaybackEnabled) {
                    this.listOfCarrecs[this.cursorPosition.y].isPlayerAsPassanger = true;
                }
            }
        }

        this.drawCarRecordingControls(this.cursorPosition);
        Text.UseCommands(false);
    }


    public open() {
        this.isOpen = true;
    }

    public close() {
        this.isOpen = false;
    }

    private drawCarRecordingControls(cursorPosition: {x: number, y: number}) {
        let pos = this.toMenuRelative(0.1, 0.35);
        Text.DrawString("Carrec Name", DrawEvent.AfterFade, pos.x, pos.y, 0.5, 1.0, true, 1);
        pos = this.toMenuRelative(0.75, 0.35);
        Text.DrawString("Playback Enabled", DrawEvent.AfterFade, pos.x, pos.y, 0.5, 1.0, true, 1);
        pos = this.toMenuRelative(1.3, 0.35);
        Text.DrawString("Player as Passanger", DrawEvent.AfterFade, pos.x, pos.y, 0.5, 1.0, true, 1);

        let drawingPositionVertical = {text: 0.6, texture: 0.70};

        for(let i = 0; i < this.listOfCarrecs.length; i++) {
            if(i == cursorPosition.y) {
                this.drawCarrecEntry(this.listOfCarrecs[i].name, this.listOfCarrecs[i].isPlaybackEnabled, this.listOfCarrecs[i].isPlayerAsPassanger, drawingPositionVertical, cursorPosition.x);
            } else {
                this.drawCarrecEntry(this.listOfCarrecs[i].name, this.listOfCarrecs[i].isPlaybackEnabled, this.listOfCarrecs[i].isPlayerAsPassanger, drawingPositionVertical, -1);
            }
            drawingPositionVertical.text += 0.3;
            drawingPositionVertical.texture += 0.3;
        }
    }

    private drawCarrecEntry(carrecName: string, isPlaybackEnabled: boolean, isPlayerAsPassanger: boolean, drawingPositionVertical: {text: number, texture: number}, cursorActive: number) {
        let pos = this.toMenuRelative(0.1, drawingPositionVertical.text);
        Text.DrawString(carrecName, DrawEvent.AfterFade, pos.x, pos.y, 0.5, 1.0, true, 1);
        pos = this.toMenuRelative(1.00, drawingPositionVertical.texture);
        Txd.DrawTexturePlus(
            0,
            DrawEvent.AfterFade,
            pos.x,
            pos.y,
            15,
            15,
            0,
            0,
            false,
            0,
            0,
            isPlaybackEnabled ? 0 : 255, 
            255, 
            isPlaybackEnabled ? 0 : 255,
            255
        );

        if(cursorActive == 0) {
            Txd.DrawTexturePlus(
                0,
                DrawEvent.AfterFade,
                pos.x,
                pos.y,
                8,
                8,
                0,
                0,
                false,
                0,
                0,
                255, 
                165, 
                0,
                255
            );
        }

        
        pos = this.toMenuRelative(1.6, drawingPositionVertical.texture);

        
        Txd.DrawTexturePlus(
            0,
            DrawEvent.AfterFade,
            pos.x,
            pos.y,
            15,
            15,
            0,
            0,
            false,
            0,
            0,
            isPlayerAsPassanger ? 0 : 255, 
            255, 
            isPlayerAsPassanger ? 0 : 255,
            255
        );

        if(cursorActive == 1) {
            Txd.DrawTexturePlus(
                0,
                DrawEvent.AfterFade,
                pos.x,
                pos.y,
                8,
                8,
                0,
                0,
                false,
                0,
                0,
                255, 
                165, 
                0,
                255
            );
        }
    }

    /**
         * Converts relative position within the menu to absolute canvas coordinates
         * 
         * @param relativeX - Position within menu width (0.0 = left edge, 1.0 = right edge)
         * @param relativeY - Position within menu height (0.0 = top edge, 1.0 = bottom edge)
         * @returns Absolute canvas coordinates
         * 
         * @example
         * // Text at top-left corner of menu (with 5% padding)
         * const pos = toMenuRelative(0.05, 0.05);
         * 
         * // Text at center of menu
         * const pos = toMenuRelative(0.5, 0.5);
         * 
         * // Text at bottom-right of menu
         * const pos = toMenuRelative(0.95, 0.95);
         */
    private toMenuRelative(relativeX: number, relativeY: number): { x: number, y: number } {
        return {
            x: VehicleRecordingMenu.MENU_X - (VehicleRecordingMenu.MENU_WIDTH/2) + (relativeX * (VehicleRecordingMenu.MENU_WIDTH/2)),
            y: VehicleRecordingMenu.MENU_Y - (VehicleRecordingMenu.MENU_HEIGHT/2) + (relativeY * (VehicleRecordingMenu.MENU_HEIGHT/2))
        };
    }

    
}