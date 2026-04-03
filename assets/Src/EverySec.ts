import { _decorator, Node } from "cc";
import { Component } from "cc";

const { ccclass, property } = _decorator

@ccclass("EverySec")
export class EverySec extends Component {
    @property([Node])
    nodes: Node[] = []
    @property(Node)
    clicker: Node = null

    @property({ min: 0 })
    dur: number = 5;

    @property({ visible: true, displayName: "Active" })
    protected _a: boolean = false;
    active() {
        this._a = true;
        this._stop();
    }
    inactive() {
        this._a = false;
    }

    protected onLoad(): void {
        this.clicker.on(Node.EventType.TOUCH_START, this._stop, this)
        this._func = this._re.bind(this)
    }

    protected _re() {
        if(!this._a) return;
        this.nodes.forEach(_ => _.active = true)
    }

    protected _func: Function
    protected _stop() {
        if(!this._a) return;
        this.unschedule(this._func)
        this.nodes.forEach(_ => _.active = false)
        this.scheduleOnce(this._func, this.dur)
    }
}
