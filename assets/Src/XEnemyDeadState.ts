import { ParticleSystem } from "cc";
import { IState } from "./IState";
import { XEnemy } from "./XEnemy";
import { AudioSource } from "cc";

export class XEnemyDeadState implements IState<XEnemy, [string, ParticleSystem[], AudioSource], []> {
    public enter(context: XEnemy, animationName: string, part: ParticleSystem[], au: AudioSource): void {
        context.resetFallVelocity();
        context.resetMoveState();
        if (!context.beginSplit()) {
            context.playAnimation(animationName, false);
        }
        if(part) {
            part.forEach(_ => _.play());
        }
        au?.play()
    }

    public exit(_context: XEnemy): void {}

    public update(_context: XEnemy, _dt: number): void {}
}
