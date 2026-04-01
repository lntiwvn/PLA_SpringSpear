import { IState } from "./IState";
import { XSpear } from "./XSpear";

export class XSpearChargingState implements IState<XSpear, [string], []> {
    public enter(context: XSpear, animationName: string): void {
        context.playAnimation(animationName, true);
        context.updateLaser();
    }

    public exit(context: XSpear): void {
        context.clearLaser();
        context.clearLaserTarget();
    }

    public update(context: XSpear, _dt: number): void {
        context.updateLaser();
    }
}
