import { _decorator, Collider2D, Component, EventTouch, Node, Vec2, Vec3, UITransform } from "cc";
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

        this.spear.aimAt(this.getTouchLocal(event), event.getUILocation());
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
        spear.refreshIgnoredColliders(this.enemies);
        const shaftHit = this.findEnemyHitAlongSegmentBoard(
            spear.getPinnedBoardPosition(),
            spear.getFreeEndBoardPosition(),
            spear,
        );
        if (shaftHit) {
            return shaftHit;
        }

        const previousHeadBoard = this.gameBoard.toBoardPoint(spear.getPreviousHeadWorldPosition());
        const currentHeadBoard = spear.getHeadPosition();
        return this.findEnemyHitAlongSegmentBoard(
            previousHeadBoard,
            currentHeadBoard,
            spear,
        );
    }

    public captureSpearLaunchOverlaps(spear: XSpear): void {
        spear.captureIgnoredColliders(this.enemies);
    }

    public findGroundColliderForEnemy(enemy: XEnemy): Collider2D | null {
        const legCollider = enemy.getLegCollider();
        const legRect = enemy.getLegColliderRect();
        if (!legCollider?.enabledInHierarchy || !legRect) {
            return null;
        }

        for (const groundCollider of this.gameBoard?.grounds ?? []) {
            if (!groundCollider?.enabledInHierarchy) {
                continue;
            }

            if (groundCollider.worldAABB.intersects(legRect)) {
                return groundCollider;
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
        const boardHit = this.gameBoard?.raycastWall(origin, direction);
        if (!boardHit) {
            return null;
        }
        let closestHit: XGameLaserHit = { enemy: null, point: boardHit.point };
        let closestDistance = boardHit.distance;

        for (const enemy of this.enemies) {
            const bodyCollider = enemy.getBodyCollider();
            if (!bodyCollider?.enabledInHierarchy) {
                continue;
            }

            const hitPoint = this.raycastBoardRect(origin, direction, this.getColliderBoardRect(bodyCollider));
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

        for (const boardCollider of [...(this.gameBoard.walls ?? []), ...(this.gameBoard.grounds ?? [])]) {
            if (!boardCollider?.enabledInHierarchy) {
                continue;
            }

            const hitPoint = this.raycastBoardRect(origin, direction, this.getColliderBoardRect(boardCollider));
            if (!hitPoint) {
                continue;
            }

            const distance = Vec2.distance(origin, hitPoint);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestHit = {
                    enemy: null,
                    point: hitPoint,
                };
            }
        }

        return closestHit;
    }

    protected findEnemyHitAlongSegmentBoard(from: Vec2, to: Vec2, spear: XSpear): { enemy: XEnemy; kind: "body" | "balloon" } | null {
        for (const enemy of this.enemies) {
            if (enemy.stateMachine.cid === null) {
                continue;
            }

            const bodyCollider = enemy.getBodyCollider();
            if (
                bodyCollider?.enabledInHierarchy
                && !spear.shouldIgnoreCollider(bodyCollider)
                && this.segmentIntersectsRect(from, to, this.getColliderBoardRect(bodyCollider))
            ) {
                return { enemy, kind: "body" };
            }

            const balloonCollider = enemy.getBalloonCollider();
            if (
                balloonCollider?.enabledInHierarchy
                && !spear.shouldIgnoreCollider(balloonCollider)
                && this.segmentIntersectsRect(from, to, this.getColliderBoardRect(balloonCollider))
            ) {
                return { enemy, kind: "balloon" };
            }
        }

        return null;
    }

    protected getColliderBoardRect(collider: Collider2D): { x: number; y: number; width: number; height: number } {
        const aabb = collider.worldAABB;
        const min = this.gameBoard.toBoardPoint(new Vec3(aabb.xMin, aabb.yMin, 0));
        const max = this.gameBoard.toBoardPoint(new Vec3(aabb.xMax, aabb.yMax, 0));
        return {
            x: Math.min(min.x, max.x),
            y: Math.min(min.y, max.y),
            width: Math.abs(max.x - min.x),
            height: Math.abs(max.y - min.y),
        };
    }

    protected raycastBoardRect(origin: Vec2, direction: Vec2, rect: { x: number; y: number; width: number; height: number }): Vec2 | null {
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

    protected segmentIntersectsRect(segA: Vec2, segB: Vec2, rect: { x: number; y: number; width: number; height: number }): boolean {
        const minX = rect.x;
        const maxX = rect.x + rect.width;
        const minY = rect.y;
        const maxY = rect.y + rect.height;

        if (this.isPointInsideRect(segA, minX, maxX, minY, maxY) || this.isPointInsideRect(segB, minX, maxX, minY, maxY)) {
            return true;
        }

        const topLeft = new Vec2(minX, maxY);
        const topRight = new Vec2(maxX, maxY);
        const bottomLeft = new Vec2(minX, minY);
        const bottomRight = new Vec2(maxX, minY);

        return this.segmentsIntersect(segA, segB, topLeft, topRight)
            || this.segmentsIntersect(segA, segB, topRight, bottomRight)
            || this.segmentsIntersect(segA, segB, bottomRight, bottomLeft)
            || this.segmentsIntersect(segA, segB, bottomLeft, topLeft);
    }

    protected isPointInsideRect(point: Vec2, minX: number, maxX: number, minY: number, maxY: number): boolean {
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }

    protected segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
        const d1 = this.cross(a1, a2, b1);
        const d2 = this.cross(a1, a2, b2);
        const d3 = this.cross(b1, b2, a1);
        const d4 = this.cross(b1, b2, a2);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }

        return (d1 === 0 && this.onSegment(a1, a2, b1))
            || (d2 === 0 && this.onSegment(a1, a2, b2))
            || (d3 === 0 && this.onSegment(b1, b2, a1))
            || (d4 === 0 && this.onSegment(b1, b2, a2));
    }

    protected cross(a: Vec2, b: Vec2, c: Vec2): number {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    protected onSegment(a: Vec2, b: Vec2, point: Vec2): boolean {
        return point.x >= Math.min(a.x, b.x)
            && point.x <= Math.max(a.x, b.x)
            && point.y >= Math.min(a.y, b.y)
            && point.y <= Math.max(a.y, b.y);
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

}
