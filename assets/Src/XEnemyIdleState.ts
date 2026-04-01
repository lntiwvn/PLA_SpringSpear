import { IState } from "./IState";
import { XEnemy } from "./XEnemy";

export class XEnemyIdleState implements IState<XEnemy, [string], []> {
    public enter(context: XEnemy, animationName: string): void {
        context.playAnimation(animationName, true);
        context.resetMoveState();
    }

    public exit(_context: XEnemy): void {}

    public update(_context: XEnemy, _dt: number): void {}
}
