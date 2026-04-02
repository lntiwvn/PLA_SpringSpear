import { Enum, tween, TweenEasing, Node, CCInteger, Component, _decorator, Vec3, Tween } from "cc";
import Easing from "./Easing";
import { v3 } from "cc";

const { ccclass, property } = _decorator;
enum BT {
    By = 0,
    To
}

Enum(BT)

@ccclass("_ScalingHelp")
class _ScalingHelp {
    @property({ type: Vec3 })
    target: Vec3 = v3(0, 0, 0)

    @property({ min: 0 })
    duration: number = 0.25;

    @property({ type: BT })
    bt: BT = BT.By;

    @property({ type: Easing })
    easing: TweenEasing = 'linear'

    tween(tween: Tween<Node>) {
        switch(this.bt) {
            case BT.By: return tween.by( this.duration, { scale: this.target }, { easing: this.easing } )
            case BT.To: return tween.to( this.duration, { scale: this.target }, { easing: this.easing } )
        }

    }
}

@ccclass("ScalingComp")
export class ScalingComp extends Component {
    @property({ type: Node })
    target: Node = null;

    @property({ min: 0, type: CCInteger })
    loop: number = 0;

    @property([_ScalingHelp])
    helpers: _ScalingHelp[] = []

    protected _tween: Tween = null

    protected onLoad(): void {
        let _tw = tween(this.target);
        this.helpers.forEach(_h => _tw = _h.tween(_tw))
        this._tween = this.loop <= 0 ? tween(this.target).repeatForever(_tw) : tween(this.target).repeat(this.loop, _tw)
    }

    protected start(): void {
        this._execute();
    }

    protected _execute() {
        this._tween?.stop();
        this._tween?.start();
    }
}
