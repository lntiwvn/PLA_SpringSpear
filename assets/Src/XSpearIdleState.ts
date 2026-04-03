import { IState } from "./IState";
import { XSpear } from "./XSpear";

export class XSpearIdleState implements IState<XSpear, [string?], []> {
    public enter(context: XSpear, animationName?: string): void {
        context.clearLaser();
        context.clearLaserTarget();
        context.setSpearColliderEnabled(false);
        context.playAnimation(animationName ?? context.getAnim(context.stateMachine.cid ?? context.defaultState), true);
    }

    public exit(_context: XSpear): void {}

    public update(_context: XSpear, _dt: number): void {}
}
