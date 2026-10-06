import { _decorator, Node, UIOpacity } from "cc";
import { Component } from "cc";
import Easing from "./Easing";
import { TweenEasing } from "cc";
import { Prefab } from "cc";
import { instantiate } from "cc";

const { ccclass, property } = _decorator;

@ccclass("SplashScene")
export class SplashScene extends Component {
    @property([Node])
    list: Node[] = [];

    @property(UIOpacity)
    opx: UIOpacity = null;

    @property({ type: Easing })
    easingIn: TweenEasing = 'backIn'

    @property({ min: 0 })
    delay: number = 0;

    @property({ type: Easing })
    easingOut: TweenEasing = 'backOut'

    @property({ min: 0})
    duration: number = 0.5;

    @property(Prefab)
    nextLevel: Prefab = null

    @property({ type: Prefab, tooltip: "Previous level prefab to load when transitioning. Takes priority over Next Level." })
    previousLevel: Prefab = null;

    @property(Node)
    off: Node = null;

    @property(Node)
    root: Node = null

    private _transitionPending: boolean = false;

    protected start(): void {
        this.list.forEach(_ => _.active = false);
        if (this.opx) this.opx.opacity = 0;
    }

    transWithDelay(dur: number | string) {
        dur = typeof dur === 'string' ? parseFloat(dur) : dur;
        this.scheduleOnce(() => this.trans(), dur);
    }

    trans() {
        const levelPrefab = this.previousLevel ?? this.nextLevel;
        if (this._transitionPending || !levelPrefab || !this.root?.isValid) return;
        this._transitionPending = true;
        this.list.forEach(_ => _.active = true);
        this.scheduleOnce(() => {
            if (!this.root?.isValid) {
                this._transitionPending = false;
                return;
            }
            const levelNode = instantiate(levelPrefab);
            if (this.off?.isValid) this.off.active = false;
            this.root.addChild(levelNode);
            this.off = levelNode;
            this._transitionPending = false;
        }, this.delay);
    }
}
