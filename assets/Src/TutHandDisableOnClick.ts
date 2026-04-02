import { _decorator, Component, Node, UITransform } from "cc";
import XGameObserver from "./XGameObserver";

const { ccclass, property } = _decorator;

@ccclass("TutHandDisableOnClick")
export class TutHandDisableOnClick extends Component {
    @property(UITransform)
    public clickArena: UITransform = null;

    @property([Node])
    public nodes: Node[] = [];

    protected _didDisable: boolean = false;

    protected onLoad(): void {
        this.clickArena?.node.on(Node.EventType.TOUCH_START, this.onClickArenaTouchStart, this);
    }

    protected onDestroy(): void {
        this.clickArena?.node.off(Node.EventType.TOUCH_START, this.onClickArenaTouchStart, this);
    }

    protected onClickArenaTouchStart(): void {
        if (this._didDisable) {
            return;
        }

        this._didDisable = true;
        this.nodes.forEach((node) => {
            if (node) {
                node.active = false;
            }
        });
        XGameObserver.invoke("onTurHandClicked");
    }
}
