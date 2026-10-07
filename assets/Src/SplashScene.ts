import { _decorator, AudioSource, Node, UIOpacity } from "cc";
import { Component } from "cc";
import Easing from "./Easing";
import { TweenEasing } from "cc";
import { Prefab } from "cc";
import { instantiate } from "cc";
import { XGameController } from "./XGameController";
import { XEnemy } from "./XEnemy";
import { ConfettiManager } from "../Asset/VFX nonogram/Script/ConfettiManager";

const { ccclass, property, executionOrder } = _decorator;

@ccclass("SplashScene")
@executionOrder(-100)
export class SplashScene extends Component {
    @property([Node])
    list: Node[] = [];

    @property(UIOpacity)
    opx: UIOpacity = null;

    @property({ type: Easing })
    easingIn: TweenEasing = 'backIn'

    @property({ min: 0 })
    delay: number = 0;

    @property({ min: 0, tooltip: "Seconds to wait after confetti finishes before entering the main level." })
    postConfettiDelay: number = 0.1;

    @property({ type: Easing })
    easingOut: TweenEasing = 'backOut'

    @property({ min: 0})
    duration: number = 0.5;

    @property(Prefab)
    nextLevel: Prefab = null

    @property({ type: Prefab, tooltip: "Previous level shown at startup before enabling the current level." })
    previousLevel: Prefab = null;

    @property({ type: Node, tooltip: "Current level node to enable after Previous Level, and hide on the next transition." })
    off: Node = null;

    @property(Node)
    root: Node = null

    get secondLevelKillTarget(): number {
        return this.off?.getComponentsInChildren(XEnemy).length ?? 0;
    }

    @property({ type: Node, tooltip: "Confetti to finish before leaving the first level." })
    public winConfetti: Node = null;

    private _firstWinCelebrating: boolean = false;
    private _transitionPending: boolean = false;
    private _previousLevelNode: Node = null;
    private _gameController: XGameController = null;
    private _currentLevelTemplate: Node = null;

    protected onLoad(): void {
        // The scene copy is a template, not a wall impact.
        const crackTemplate = this.node.scene?.getChildByName("Canvas")?.getChildByName("Crack");
        if (crackTemplate) crackTemplate.active = false;
        if (this.off?.isValid) {
            // Keep an untouched copy before gameplay destroys enemies or the x10 booster.
            const wasActive = this.off.active;
            this.off.active = false;
            this._currentLevelTemplate = instantiate(this.off);
            this._currentLevelTemplate.active = false;
            this.off.active = this.previousLevel && this.root?.isValid ? false : wasActive;
        }
        if (!this.previousLevel || !this.root?.isValid) {
            if (this.off?.isValid) this.off.active = true;
            return;
        }

        // Hide gameplay before its enemies and spears can initialize.
        if (this.off?.isValid) this.off.active = false;
        this._previousLevelNode = instantiate(this.previousLevel);
        this.root.addChild(this._previousLevelNode);
    }

    protected start(): void {
        this.list.forEach(_ => _.active = false);
        if (this.opx) this.opx.opacity = 0;
        this._gameController = this.getComponent(XGameController);
        if (this._gameController) this._gameController.onLevelRetry = () => this.retryLevel();
        if (this._previousLevelNode) {
            if (this._gameController) {
                this._gameController.setLevel(this._previousLevelNode);
                // Consume the first win so the scene's final-win UI does not run yet.
                this._gameController.onLevelWin = () => this.winPreviousLevel();
            }
        } else if (this._gameController && this.off?.isValid) {
            this._gameController.setLevel(this.off, this.secondLevelKillTarget);
        }
    }

    protected winPreviousLevel(): void {
        if (this._firstWinCelebrating || this._transitionPending) return;
        this._previousLevelNode?.getComponent(AudioSource)?.play();
        const confetti = this.winConfetti?.getComponent(ConfettiManager)
            ?? this.node.scene?.getComponentInChildren(ConfettiManager);
        if (!confetti?.enabledInHierarchy) {
            this.trans();
            return;
        }
        this._firstWinCelebrating = true;
        confetti.playWinThen(() => {
            if (!this.isValid) return;
            this._firstWinCelebrating = false;
            this.trans(this.postConfettiDelay);
        });
    }

    retryLevel(): void {
        if (this._firstWinCelebrating || this._transitionPending || !this.root?.isValid || !this._gameController) return;
        const isPrevious = !!this._previousLevelNode;
        const source = isPrevious ? this.previousLevel : this._currentLevelTemplate;
        if (!source) return;
        const oldLevel = isPrevious ? this._previousLevelNode : this.off;
        if (oldLevel?.isValid) {
            oldLevel.active = false;
            oldLevel.destroy();
        }
        const level: Node = isPrevious ? instantiate(this.previousLevel) : instantiate(this._currentLevelTemplate);
        level.active = false;
        this.root.addChild(level);
        if (isPrevious) this._previousLevelNode = level;
        else this.off = level;
        this._gameController.setLevel(level, isPrevious ? 0 : this.secondLevelKillTarget);
        level.active = true;
    }

    protected onDestroy(): void {
        this._currentLevelTemplate?.destroy();
        if (this._gameController) this._gameController.onLevelRetry = null;
    }

    transWithDelay(dur: number | string) {
        dur = typeof dur === 'string' ? parseFloat(dur) : dur;
        this.scheduleOnce(() => this.trans(), dur);
    }

    trans(delayOverride?: number) {
        const currentLevel = this._previousLevelNode ? this.off : null;
        if (this._firstWinCelebrating || this._transitionPending || (!currentLevel?.isValid && !this.nextLevel) || !this.root?.isValid) return;
        this._transitionPending = true;
        this.list.forEach(_ => _.active = true);
        var transitionDelay = typeof delayOverride === "number"
            ? Math.max(0, delayOverride) : currentLevel ? this.delay * 0.5 : this.delay;
        this.scheduleOnce(() => {
            if (!this.root?.isValid) {
                this._transitionPending = false;
                return;
            }
            const wasShowingPreviousLevel = !!this._previousLevelNode;
            if (this._previousLevelNode?.isValid) {
                this._previousLevelNode.active = false;
                this._previousLevelNode.destroy();
            }
            this._previousLevelNode = null;

            if (wasShowingPreviousLevel && this._gameController) {
                this._gameController.onLevelWin = null;
                if (currentLevel?.isValid) this._gameController.setLevel(currentLevel, this.secondLevelKillTarget);
            }

            if (currentLevel?.isValid) {
                // Reuse the scene level to preserve its controller and enemy references.
                currentLevel.active = true;
            } else {
                const levelNode = instantiate(this.nextLevel);
                if (this.off?.isValid) this.off.active = false;
                this.root.addChild(levelNode);
                this.off = levelNode;
            }
            if (wasShowingPreviousLevel) this.list.forEach(_ => _.active = false);
            this._transitionPending = false;
        }, transitionDelay);
    }
}
