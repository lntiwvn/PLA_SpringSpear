import { IVec2Like } from "cc";
import { IState } from "./IState";
import { XEnemy } from "./XEnemy";

export class XEnemyMovingState implements IState<XEnemy, [string, IVec2Like], []> {
    public enter(context: XEnemy, animationName: string, targetPosition: IVec2Like): void {
        context.playAnimation(animationName, true);
        context.beginMoveLoop(targetPosition);
    }

    public exit(context: XEnemy): void {
        context.resetMoveState();
    }

    public update(context: XEnemy, dt: number): void {
        context.updateMoveLoop(dt);
    }
}
