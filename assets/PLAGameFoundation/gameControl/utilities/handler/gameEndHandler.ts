import {_decorator, Component, director, EventTouch, input, Input, Node} from "cc";
import Super_html_script from "../super_html/super_html_script";
import DetectPlatform from "./detectPlatform";

const {ccclass, property} = _decorator;

declare global {
    interface Window {
        TheOneGamespace: {
            isWinning: {
                isWinning: boolean;
            };
            linkStore: {
                linkStore: string;
            };
        };
    }
}

@ccclass("GameEndHandler")
export class GameEndHandler extends Component {
    public isCheck: boolean = false;

    parameterKey: string = 'DirectLinkStore';

    constructor() {
        super();
        if (!window.TheOneGamespace) {
            window.TheOneGamespace = {
                isWinning: {isWinning: false},
                linkStore: {linkStore: DetectPlatform.currentLink},
            };
        }
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    public StoreGameChanging(condition: boolean) {
        let isWin = condition;
        if (isWin && !this.isCheck) {
            Super_html_script.on_click_game_end();
            Super_html_script.on_click_download();
            this.EventStatus(isWin, DetectPlatform.currentLink);
            this.isCheck = true;
        }
    }

    public StoreGameChangingNoCondition() {
        Super_html_script.on_click_game_end();
        Super_html_script.on_click_download();
        this.EventStatus(true, DetectPlatform.currentLink);
    }

    private EventStatus(isWinning: boolean, linkStore: string) {
        window.TheOneGamespace.isWinning.isWinning = isWinning;
        window.TheOneGamespace.linkStore.linkStore = linkStore;
        const event = new CustomEvent("gameStatusChanged", {
            detail: {
                isWinning: window.TheOneGamespace.isWinning,
                linkStore: window.TheOneGamespace.linkStore,
            },
        });
        window.dispatchEvent(event);
    }

    public onTouchStart(event: EventTouch) {
        if (!this.isCheck) return;
        Super_html_script.on_click_download();
    }

    public download() {
        Super_html_script.on_click_download();
    }
}

export default new GameEndHandler();
