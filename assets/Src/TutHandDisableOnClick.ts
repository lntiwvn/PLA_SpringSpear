import { _decorator, Component, input, Input, Node, UITransform } from "cc";
import XGameObserver from "./XGameObserver";

const { ccclass, property } = _decorator;

@ccclass("TutHandDisableOnClick")
export class TutHandDisableOnClick extends Component {
    @property(UITransform)
    public clickArena: UITransform = null;

    @property([Node])
    public nodes: Node[] = [];

    @property({ tooltip: "Hide on any touch without adding a UI input blocker." })
    public useGlobalTouch: boolean = false;

    protected _didDisable: boolean = false;

    protected onEnable(): void {
        if (this._didDisable) {
            this.nodes.forEach(node => { if (node) node.active = false; });
            return;
        }
        if (this.useGlobalTouch) {
            input.on(Input.EventType.TOUCH_START, this.onClickArenaTouchStart, this);
            input.on(Input.EventType.MOUSE_DOWN, this.onClickArenaTouchStart, this);
        } else {
            this.clickArena?.node.on(Node.EventType.TOUCH_START, this.onClickArenaTouchStart, this);
        }
    }

    protected lateUpdate(): void {
        if (this._didDisable) {
            this.nodes.forEach(node => { if (node?.active) node.active = false; });
        }
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onClickArenaTouchStart, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onClickArenaTouchStart, this);
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
