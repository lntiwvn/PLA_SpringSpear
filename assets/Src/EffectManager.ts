import { _decorator, Component, game, Game, director, Enum, math } from "cc";
import XGameObserver from "./XGameObserver";

const { ccclass, property } = _decorator;

enum EffectEase {
    Linear = 0,
    InQuad,
    OutQuad,
    InOutQuad,
}

Enum(EffectEase);

var timeScale = 1;

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

    @property({ type: EffectEase, tooltip: "Easing used for the slow motion curve." })
    public ease: EffectEase = EffectEase.OutQuad;

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
        const curve = this.evaluateEase(math.clamp01(phaseRatio));
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

    protected evaluateEase(ratio: number): number {
        switch (this.ease) {
            case EffectEase.InQuad:
                return ratio * ratio;
            case EffectEase.OutQuad:
                return 1 - (1 - ratio) * (1 - ratio);
            case EffectEase.InOutQuad:
                return ratio < 0.5
                    ? 2 * ratio * ratio
                    : 1 - Math.pow(-2 * ratio + 2, 2) / 2;
            case EffectEase.Linear:
            default:
                return ratio;
        }
    }

    protected setTimeScale(value: number): void {
        timeScale = Math.max(0.01, value)
    }
}
