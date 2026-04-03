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
        XGameBridge.get()?.captureSpearLaunchOverlaps(context);
        XGameObserver.invoke("onSpearFly", context);
    }

    public exit(_context: XSpear): void {}

    public update(context: XSpear, dt: number): void {
        const pinnedZone = context.updateFlying(dt);
        if (pinnedZone !== undefined) {
            XGameObserver.invoke("onSpearPinned", context, pinnedZone);
            return;
        }

        const runtime = XGameBridge.get();
        if (!runtime) {
            return;
        }

        const hit = runtime.findSpearHit(context);
        if (!hit) {
            return;
        }

        if (hit.kind === "body") {
            XGameObserver.invoke("onEnemyDead", hit.enemy, context);
            return;
        }

        hit.enemy.hideBalloon();
        hit.enemy.setBalloonColliderEnabled(false);
        XGameObserver.invoke("onBalloonPop", hit.enemy);
    }
}
