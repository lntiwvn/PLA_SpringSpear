import { Component, _decorator, Node } from "cc";
import super_html_playable from "../PLAGameFoundation/gameControl/utilities/super_html/super_html_playable";
const { ccclass, property } = _decorator

@ccclass("AdsComp")
export class AdsComp extends Component {
    @property({})
    apple: string = ""
    @property({})
    google: string = ""

    @property(Node)
    auto: Node = null

    protected onLoad(): void {
        super_html_playable.set_app_store_url(this.apple);
        super_html_playable.set_google_play_url(this.google);
        this.auto.active = false;
    }

    end() {
        super_html_playable.game_end();
    }

    click() {
        super_html_playable.download();
    }

    globalClick() {
        this.auto.active = true;
    }
}
