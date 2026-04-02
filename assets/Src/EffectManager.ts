import { _decorator, Component, game, Game, director, Enum, math, easing } from "cc";
import XGameObserver from "./XGameObserver";
import { TweenEasing } from "cc";
import Easing from "./Easing";

const { ccclass, property } = _decorator;


var timeScale =1;


//@ts-ignore
game._calculateDT = function(now: number) {
    if (!now) now = performance.now();
        this._deltaTime = now > this._startTime ? (now - this._startTime) / 1000 : 0;
        if (this._deltaTime > Game.DEBUG_DT_THRESHOLD) {
            this._deltaTime = this.frameTime / 1000;
        }
        this._startTime = now;
        return this._deltaTime * timeScale;

}

@ccclass("XEffectManager")
export class XEffectManager extends Component {
    @property({ tooltip: "Lowest timescale reached during slow motion." })
    public slowScale: number = 0.2;

    @property({ tooltip: "Whole slow motion duration in seconds." })
    public slowMotionDuration: number = 1.2;

    //@property({ type: Easing })
    public ease: TweenEasing = 'linear';

    protected _elapsed: number = 0;
    protected _isPlaying: boolean = false;
    protected readonly _onEveryEnemyDie = this.playSlowMotion.bind(this);

    protected onEnable(): void {
        XGameObserver.add("onEveryEnemyDie", this._onEveryEnemyDie);
    }

    protected onDisable(): void {
        XGameObserver.remove("onEveryEnemyDie", this._onEveryEnemyDie);
        this.setTimeScale(1);
        this._isPlaying = false;
        this._elapsed = 0;
    }

    protected update(dt: number): void {
        if (!this._isPlaying) {
            return;
        }

        const duration = Math.max(0.0001, this.slowMotionDuration);
        this._elapsed += dt;
        const ratio = math.clamp01(this._elapsed / duration);
        const phaseRatio = ratio <= 0.5 ? ratio / 0.5 : (ratio - 0.5) / 0.5;
        const _efunc = easing[this.ease];
        const curve = _efunc ? _efunc(phaseRatio) : phaseRatio;// this.evaluateEase(math.clamp01(phaseRatio));
        console.log(curve)
        const targetScale = ratio <= 0.5
            ? math.lerp(1, this.slowScale, curve)
            : math.lerp(this.slowScale, 1, curve);
        this.setTimeScale(targetScale);

        if (ratio >= 1) {
            this._isPlaying = false;
            this._elapsed = 0;
            this.setTimeScale(1);
        }
    }

    protected playSlowMotion(): void {
        this._elapsed = 0;
        this._isPlaying = true;
        this.setTimeScale(1);
    }

    protected setTimeScale(value: number): void {
        timeScale = Math.max(0.01, value)
    }
}
