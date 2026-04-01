import { _decorator, Component, Node, EventTouch, Vec2, Vec3, UITransform } from 'cc';
import { GameBoard } from './GameBoard';
import { Spear, SpearState } from './Spear';
import { Enemy } from './Enemy';
import { XEnemy } from './XEnemy';
const { ccclass, property } = _decorator;

@ccclass('GameControl')
export class GameControl extends Component {

    @property(GameBoard)
    public gameBoard: GameBoard = null;

    @property(Spear)
    public spear: Spear = null;

    @property([Enemy])
    public enemies: Enemy[] = [];

    @property([XEnemy])
    public xenimies: XEnemy[] = []

    start() {
        this.spear.init(this.gameBoard);

        // Init enemies
        for (const enemy of this.enemies) {
            enemy.init(this.gameBoard);
        }

        // Pin spear to bottom edge initially
        const bottomCenter = new Vec2(0, this.gameBoard.minY);
        const inwardDir = new Vec2(0, 1); // pointing up into the board
        this.spear.pinToEdge(bottomCenter, inwardDir);

        // Setup spear callbacks
        this.spear.onPinned = () => {
            // Spear just pinned, ready for next shot
        };

        // Listen for touch on the board node
        this.gameBoard.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private getTouchLocal(event: EventTouch): Vec2 {
        const uiTransform = this.gameBoard.node.getComponent(UITransform);
        const touchWorldPos = event.getUILocation();
        const worldPos = new Vec3(touchWorldPos.x, touchWorldPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        return new Vec2(localPos.x, localPos.y);
    }

    private onTouchStart(event: EventTouch) {
        if (this.spear.state !== SpearState.IDLE) return;
        this.spear.startCharge(this.getTouchLocal(event));
    }

    private onTouchMove(event: EventTouch) {
        if (this.spear.state !== SpearState.CHARGING) return;
        this.spear.aimAt(this.getTouchLocal(event));
    }

    private onTouchEnd() {
        if (this.spear.state !== SpearState.CHARGING) return;
        this.spear.release();
    }

    update() {
        if (this.spear.state !== SpearState.FLYING) return;

        // Check spear collision with enemies during flight
        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            // Check collision with enemy body → play dead anim
            if (enemy.bodyZone && this.spear.checkCollisionWithZone(enemy.bodyZone)) {
                enemy.hitBody();
                continue;
            }

            // Check collision with balloon → balloon mất, enemy rơi
            if (enemy.balloonZone && enemy.balloonZone.node.active && this.spear.checkCollisionWithZone(enemy.balloonZone)) {
                enemy.hitBalloon();
            }
        }
    }

    onDestroy() {
        if (this.gameBoard && this.gameBoard.node) {
            this.gameBoard.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }
}
