
import { bezier } from "cc";
import { _decorator, CCBoolean, Component, Enum, tween, Tween, UITransform, Vec3 } from "cc";
import Easing from "./Easing";
import { TweenEasing } from "cc";
import { Vec2 } from "cc";
import { v2 } from "cc";

const { ccclass, property } = _decorator;

enum TutHandReturnMode {
    Snap = 0,
    Move = 1,
}

Enum(TutHandReturnMode);

@ccclass("TutHand")
export class TutHand extends Component {
    @property(UITransform)
    public target: UITransform = null;

    @property({
        tooltip: "Curve height offset from the midpoint between start and target.",
    })
    public XB: Vec2 = v2(0, 0);

    @property({
        tooltip: "Curve height offset from the midpoint between start and target.",
    })
    public YB: Vec2 = v2(6, 12);

    @property({ type: Easing })
    easing: TweenEasing = 'linear'

    @property
    public moveDuration: number = 0.6;

    @property({ type: TutHandReturnMode, tooltip: "How the hand returns to the start position after reaching the target." })
    public returnMode: TutHandReturnMode = TutHandReturnMode.Snap;

    @property
    public pauseDuration: number = 0.15;

    protected readonly _startPosition: Vec3 = new Vec3();
    protected _loopTween: Tween<any> | null = null;

    protected onEnable(): void {
        this._startPosition.set(this.node.position);
        this.playLoop();
    }

    protected onDisable(): void {
        this.stopLoop();
    }

    protected onDestroy(): void {
        this.stopLoop();
    }

    protected playLoop(): void {
        this.stopLoop();

        const targetPosition = this.getTargetPosition();
        if (!targetPosition) {
            return;
        }
        const _ = {
            x: this.node.x,
            y: this.node.y
        }

        const px = (start: number, end: number, current: number, ratio: number) => {
            current = bezier(start, this.XB.x, this.XB.y, end, ratio)
            return current;
        }

        const py = (start: number, end: number, current: number, ratio: number) => {
            current = bezier(start, this.YB.x, this.YB.y, end, ratio)
            return current;
        }

        tween(this.node).parallel(
            tween(_).to(this.moveDuration, { x: targetPosition.x }, { progress: px, easing: this.easing, onUpdate: () => { this.node.setPosition(_.x, _.y) } }),
            tween(_).to(this.moveDuration, { y: targetPosition.y }, { progress: py, easing: this.easing, onUpdate: () => this.node.setPosition(_.x, _.y) })
        ).repeatForever().start();

    }


    protected stopLoop(): void {
        this._loopTween?.stop();
        this._loopTween = null;
    }

    protected getTargetPosition(): Vec3 | null {
        if (!this.target) {
            return null;
        }

        const parent = this.node.parent;
        if (!parent) {
            return this.target.node.position.clone();
        }

        const targetWorld = this.target.node.worldPosition;
        return parent.inverseTransformPoint(new Vec3(), targetWorld);
    }
}
