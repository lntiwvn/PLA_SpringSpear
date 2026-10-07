import { IState } from "./IState";
import XGameBridge from "./XGameBridge";
import XGameObserver from "./XGameObserver";
import { XSpear } from "./XSpear";

export class XSpearFlyingState implements IState<XSpear, [string], []> {
    public enter(context: XSpear, animationName: string): void {
        context.clearLaser();
        context.clearLaserTarget();
        context.setSpearColliderEnabled(true);
        context.playAnimation(animationName, true);
        XGameObserver.invoke("onSpearFly", context);
    }

    public exit(_context: XSpear): void {}

    public update(context: XSpear, dt: number): void {
        const pinnedZone = context.updateFlying(dt);
        const runtime = XGameBridge.get();
        if (runtime) {
            // The last travel segment still hits enemies when this frame pins or reflects.
            for (const hit of runtime.findSpearHits(context)) {
                if (hit.kind === "body") {
                    XGameObserver.invoke("onEnemyDead", hit.enemy, context);
                } else {
                    hit.enemy.hideBalloon();
                    hit.enemy.setBalloonColliderEnabled(false);
                    XGameObserver.invoke("onBalloonPop", hit.enemy);
                }
            }
        }
        if (pinnedZone !== undefined) {
            XGameObserver.invoke("onSpearPinned", context, pinnedZone);
        }
    }
}
