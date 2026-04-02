import { _decorator, Component, EventTouch, Node, Vec2, Vec3, UITransform } from "cc";
import { CollisionZone } from "./CollisionZone";
import { GameBoard } from "./GameBoard";
import XGameBridge, { XEnemyHitData, XGameLaserHit } from "./XGameBridge";
import { XEnemy, XEnemyStateId } from "./XEnemy";
import XGameObserver from "./XGameObserver";
import { XSpear, XSpearStateId } from "./XSpear";

const { ccclass, property } = _decorator;

@ccclass("XGameController")
export class XGameController extends Component {
    protected static _instance: XGameController | null = null;

    @property(GameBoard)
    public gameBoard: GameBoard = null;

    @property(XSpear)
    public spear: XSpear = null;

    @property([XEnemy])
    public enemies: XEnemy[] = [];

    protected _observerDisposers: Array<() => void> = [];
    protected _didInvokeEveryEnemyDie: boolean = false;

    public static get instance(): XGameController | null {
        return this._instance;
    }

    protected onLoad(): void {
        XGameController._instance = this;
        XGameBridge.set(this);
    }

    protected start(): void {
        this.spear.init(this.gameBoard);

        this.gameBoard.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        const onEnemyDead = this.onEnemyDead.bind(this);
        const onEnemyFalling = this.onEnemyFalling.bind(this);
        const onBalloonPop = this.onBalloonPop.bind(this);
        XGameObserver.add("onEnemyDead", onEnemyDead);
        XGameObserver.add("onEnemyFalling", onEnemyFalling);
        XGameObserver.add("onBalloonPop", onBalloonPop);
        this._observerDisposers = [
            () => XGameObserver.remove("onEnemyDead", onEnemyDead),
            () => XGameObserver.remove("onEnemyFalling", onEnemyFalling),
            () => XGameObserver.remove("onBalloonPop", onBalloonPop),
        ];
    }

    protected onDestroy(): void {
        this._observerDisposers.forEach((_dispose) => _dispose());
        this._observerDisposers.length = 0;

        if (this.gameBoard?.node) {
            this.gameBoard.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }

        if (XGameController._instance === this) {
            XGameController._instance = null;
        }
        XGameBridge.set(null);
    }

    protected onTouchStart(event: EventTouch): void {
        if (this.spear.state !== XSpearStateId.Idle) {
            return;
        }

        this.spear.startCharge(this.getTouchLocal(event));
    }

    protected onTouchMove(event: EventTouch): void {
        if (this.spear.state !== XSpearStateId.Charging) {
            return;
        }

        this.spear.aimAt(this.getTouchLocal(event));
    }

    protected onTouchEnd(): void {
        if (this.spear.state !== XSpearStateId.Charging) {
            return;
        }

        this.spear.release();
    }

    protected getTouchLocal(event: EventTouch): Vec2 {
        const uiTransform = this.gameBoard.node.getComponent(UITransform);
        const touchWorldPos = event.getUILocation();
        const worldPos = new Vec3(touchWorldPos.x, touchWorldPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        return new Vec2(localPos.x, localPos.y);
    }

    public findSpearHit(spear: XSpear): { enemy: XEnemy; kind: "body" | "balloon" } | null {
        spear.refreshIgnoredCollisionZones(this.enemies);

        for (const enemy of this.enemies) {
            if (enemy.stateMachine.cid === null) {
                continue;
            }

            if (
                enemy.bodyZone?.node.active
                && spear.checkCollisionWithZone(enemy.bodyZone)
                && !spear.shouldIgnoreCollisionZone(enemy.bodyZone)
            ) {
                return { enemy, kind: "body" };
            }

            if (
                enemy.balloonZone?.node.active
                && spear.checkCollisionWithZone(enemy.balloonZone)
                && !spear.shouldIgnoreCollisionZone(enemy.balloonZone)
            ) {
                return { enemy, kind: "balloon" };
            }
        }

        return null;
    }

    public captureSpearLaunchOverlaps(spear: XSpear): void {
        spear.captureIgnoredCollisionZones(this.enemies);
    }

    public findGroundZoneForEnemy(enemy: XEnemy): CollisionZone | null {
        if (!enemy.legZone?.node.active) {
            return null;
        }

        for (const groundZone of this.gameBoard?.groundZones ?? []) {
            if (!groundZone?.node.active) {
                continue;
            }

            if (this.isZoneColliding(enemy.legZone, groundZone)) {
                return groundZone;
            }
        }

        return null;
    }

    public getBoard(): GameBoard | null {
        return this.gameBoard;
    }

    public resolveEnemyHitData(enemy: XEnemy, spear: XSpear): XEnemyHitData {
        const hitDirection = spear.getFlyDirection();
        const isVertical = Math.abs(hitDirection.x) >= Math.abs(hitDirection.y);
        return {
            splitKind: isVertical ? "vertical" : "horizontal",
            hitDirection,
        };
    }

    public castLaser(origin: Vec2, direction: Vec2): XGameLaserHit | null {
        const boardHit = this.gameBoard?.raycastToEdge(origin, direction);
        if (!boardHit) {
            return null;
        }

        let closestHit: XGameLaserHit = {
            enemy: null,
            point: boardHit,
        };
        let closestDistance = Vec2.distance(origin, boardHit);

        for (const enemy of this.enemies) {
            if (!enemy.bodyZone?.node.active) {
                continue;
            }

            const hitPoint = this.raycastRect(origin, direction, enemy.bodyZone.getBoardRect());
            if (!hitPoint) {
                continue;
            }

            const distance = Vec2.distance(origin, hitPoint);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestHit = {
                    enemy,
                    point: hitPoint,
                };
            }
        }

        return closestHit;
    }

    protected onEnemyDead(enemy: XEnemy, _spear: XSpear): void {
        const hitData = this.resolveEnemyHitData(enemy, _spear);
        const didChange = enemy.enterDead(hitData.splitKind, hitData.hitDirection);
        if (!didChange) {
            return;
        }

        this.invokeEveryEnemyDieIfNeeded();
    }

    protected onEnemyFalling(enemy: XEnemy, _spear: XSpear): void {
        enemy.enterFalling();
    }

    protected onBalloonPop(enemy: XEnemy): void {
        enemy.enterFalling();
    }

    protected invokeEveryEnemyDieIfNeeded(): void {
        if (this._didInvokeEveryEnemyDie || this.enemies.length <= 0) {
            return;
        }

        const isEveryEnemyDead = this.enemies.every((_enemy) => _enemy?.stateMachine.cid === XEnemyStateId.Dead);
        if (!isEveryEnemyDead) {
            return;
        }

        this._didInvokeEveryEnemyDie = true;
        XGameObserver.invoke("onEveryEnemyDie");
    }

    protected isZoneColliding(a: CollisionZone, b: CollisionZone): boolean {
        const rectA = a.getBoardRect();
        const rectB = b.getBoardRect();
        return rectA.x < rectB.x + rectB.width
            && rectA.x + rectA.width > rectB.x
            && rectA.y < rectB.y + rectB.height
            && rectA.y + rectA.height > rectB.y;
    }

    protected raycastRect(origin: Vec2, direction: Vec2, rect: { x: number; y: number; width: number; height: number }): Vec2 | null {
        const dir = direction.clone().normalize();
        if (dir.lengthSqr() <= 0.0001) {
            return null;
        }

        let tMin = -Infinity;
        let tMax = Infinity;

        const minX = rect.x;
        const maxX = rect.x + rect.width;
        const minY = rect.y;
        const maxY = rect.y + rect.height;

        if (Math.abs(dir.x) < 0.0001) {
            if (origin.x < minX || origin.x > maxX) {
                return null;
            }
        } else {
            const tx1 = (minX - origin.x) / dir.x;
            const tx2 = (maxX - origin.x) / dir.x;
            tMin = Math.max(tMin, Math.min(tx1, tx2));
            tMax = Math.min(tMax, Math.max(tx1, tx2));
        }

        if (Math.abs(dir.y) < 0.0001) {
            if (origin.y < minY || origin.y > maxY) {
                return null;
            }
        } else {
            const ty1 = (minY - origin.y) / dir.y;
            const ty2 = (maxY - origin.y) / dir.y;
            tMin = Math.max(tMin, Math.min(ty1, ty2));
            tMax = Math.min(tMax, Math.max(ty1, ty2));
        }

        if (tMax < 0 || tMin > tMax) {
            return null;
        }

        const hitT = tMin >= 0 ? tMin : tMax;
        if (hitT < 0) {
            return null;
        }

        return new Vec2(origin.x + dir.x * hitT, origin.y + dir.y * hitT);
    }
}
