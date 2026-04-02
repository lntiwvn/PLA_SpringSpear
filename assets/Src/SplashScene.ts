import { _decorator, Node, UIOpacity } from "cc";
import { Component } from "cc";
import Easing from "./Easing";
import { TweenEasing } from "cc";
import { Tween } from "cc";
import { tween } from "cc";
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

    @property(Node)
    off: Node = null;

    @property(Node)
    root: Node = null

    protected start(): void {
        this.list.forEach(_ => _.active = false);
        this.opx.opacity = 0;
    }

    transWithDelay(dur: number | string) {
        dur = typeof dur === 'string' ? parseFloat(dur) : dur;
        this.scheduleOnce(() => this.trans(), dur);
    }

    trans() {
        this.list.forEach(_ => _.active = true);

        this.scheduleOnce( () => {

                        this.off.active = false;
                        const _node = instantiate(this.nextLevel)
                        this.root.addChild(_node);
        }, this.delay )
        //tween(this.opx).to(this.duration, { opacity: 255 }, { easing: this.easingIn })
        //            .call( () => {
        //                this.off.active = false;
        //                const _node = instantiate(this.nextLevel)
        //                this.root.addChild(_node);
        //            } )
        //            .delay(this.delay)
        //            .to(this.duration, { opacity: 0 }, { easing: this.easingIn })
        //            .start();

    }
}
