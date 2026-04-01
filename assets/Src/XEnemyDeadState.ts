import { IState } from "./IState";
import { XEnemy } from "./XEnemy";

export class XEnemyDeadState implements IState<XEnemy, [string], []> {
    public enter(context: XEnemy, animationName: string): void {
        context.resetFallVelocity();
        context.resetMoveState();
        if (!context.beginSplit()) {
            context.playAnimation(animationName, false);
        }
    }

    public exit(_context: XEnemy): void {}

    public update(_context: XEnemy, _dt: number): void {}
}
