import { IState } from "./IState";
import XGameBridge from "./XGameBridge";
import XGameObserver from "./XGameObserver";
import { XEnemy } from "./XEnemy";

export class XEnemyFallingState implements IState<XEnemy, [string], []> {
    public enter(context: XEnemy, animationName: string): void {
        context.playAnimation(animationName, true);
        context.resetFallVelocity();
    }

    public exit(context: XEnemy): void {
        context.resetFallVelocity();
    }

    public update(context: XEnemy, dt: number): void {
        const gravity = context.gravity;
        const velocity = context.fallVelocity;
        velocity.x += gravity.x * dt;
        velocity.y += gravity.y * dt;

        const position = context.node.getPosition();
        context.node.setPosition(
            position.x + velocity.x * dt,
            position.y + velocity.y * dt,
            position.z,
        );

        const groundZone = XGameBridge.get()?.findGroundZoneForEnemy(context) ?? null;
        if (groundZone) {
            context.landOnGround(groundZone);
            XGameObserver.invoke("onEnemyIdle", context, groundZone);

        }
    }
}
