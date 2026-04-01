import { _decorator, Button, Color, Component, instantiate, Label, Node, Prefab, Sprite } from 'cc';
import super_html_playable from './super_html_playable';
import { Constant } from '../../../../constant/constant';
const { ccclass, property } = _decorator;

@ccclass('Super_html_script')
export class Super_html_script extends Component {
    constructor(){
        super();
        try {
            super_html_playable.set_google_play_url(Constant.SRORE_LINK.ANDROID_LINK);
            super_html_playable.set_app_store_url(Constant.SRORE_LINK.IOS_LINK);
            if (super_html_playable.is_hide_download()) {
                return;
            }
        } catch (error) {
            throw new Error("Constant class value missing");
        }
    }

    public on_click_game_end() {
        super_html_playable.game_end();
    }

    public on_click_download() {
        super_html_playable.download();
    }

    public on_first_click(){
        super_html_playable.is_audio();
    }
}

export default new Super_html_script();