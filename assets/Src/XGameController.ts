import { _decorator, BoxCollider2D, PolygonCollider2D, CCInteger, Collider2D, Component, ERaycast2DType, EventHandler, EventTouch, Input, input, Label, Node, PhysicsSystem2D, UIOpacity, Vec2, Vec3, UITransform, v2 } from "cc";
import { GameBoard } from "./GameBoard";
import XGameBridge, { XEnemyHitData, XGameLaserHit, XGameLaserPath, XGameReflectionHit } from "./XGameBridge";
import { XEnemy, XEnemyStateId } from "./XEnemy";
import XGameObserver from "./XGameObserver";
import { XSpear, XSpearStateId } from "./XSpear";
import { ReflectionSpear } from "./ReflectionSpear";
import { ClonerSpear } from "./ClonerSpear";
import { TutHandDisableOnClick } from "./TutHandDisableOnClick";

const { ccclass, property } = _decorator;

@ccclass("XGameController")
export class XGameController extends Component {
    protected static _instance: XGameController | null = null;

    @property(GameBoard)
    public gameBoard: GameBoard = null;

    @property(Node)
    get enemyHolder() { return null }
    set enemyHolder(x: Node) { 
        if(!x) return;
        const _es = x.getComponentsInChildren(XEnemy)
        const _v = _es.filter(_ => !this.enemies.find(__ => __.uuid === _.uuid))
        this.enemies.push(..._v)
    }

    @property([XEnemy])
    public enemies: XEnemy[] = [];

    @property({})
    isAllowDrag: boolean = true;

    @property({ type: CCInteger, min: 1 })
    public throwLimit: number = 5;

    @property(Label)
    public killCounter: Label = null;

    @property([UIOpacity])
    public throwIcons: UIOpacity[] = [];

    @property(Node)
    public losePopup: Node = null;

    @property([EventHandler])
    public storeEvents: EventHandler[] = [];

    @property({ type: Node, tooltip: "Canvas that captures store taps before gameplay and UI consume them." })
    public storeTapArea: Node = null;

    @property({ type: CCInteger, min: 1, tooltip: "Main level: the next tap opens the store after this many kills." })
    public storeTapKillThreshold: number = 3;

    public onLevelRetry: (() => void) | null = null;
    public throwsUsed: number = 0;
    public storeKillTarget: number = 0;
    protected _outcome: "playing" | "won" | "lost" | "store" = "playing";
    protected _shotInFlight: boolean = false;

    protected _observerDisposers: Array<() => void> = [];
    protected _didInvokeEveryEnemyDie: boolean = false;

    public onLevelWin: (() => void) | null = null;

    public static get instance(): XGameController | null {
        return this._instance;
    }

    protected onLoad(): void {
        XGameController._instance = this;
        XGameBridge.set(this);
        this.resetRound();
    }

    protected _spear: Map<string, XSpear> = new Map();

    public setLevel(level: Node, storeKillTarget: number = 0): void {
        this.bindLevelHandHints(level);
        this._spear.clear();
        this._didInvokeEveryEnemyDie = false;
        this.enemies = level.getComponentsInChildren(XEnemy);
        this.storeKillTarget = storeKillTarget;
        this.resetRound();
        for (const spear of level.getComponentsInChildren(XSpear)) {
            if (spear.enabledInHierarchy) this.addSpear(spear);
        }
    }

    protected bindLevelHandHints(level: Node): void {
        const hands: Node[] = [];
        const visit = (node: Node) => {
            if (node.name === "iconHand") hands.push(node);
            node.children.forEach(visit);
        };
        visit(level);
        if (!hands.length) return;
        // Register on the level root so animation events cannot revive an understood hint.
        const hint = level.getComponent(TutHandDisableOnClick) ?? level.addComponent(TutHandDisableOnClick);
        level.getComponentsInChildren(TutHandDisableOnClick).forEach(component => component.enabled = false);
        hint.useGlobalTouch = true;
        hint.nodes = hands;
        hint.enabled = true;
    }

    protected resetRound(): void {
        this.throwsUsed = 0;
        this._outcome = "playing";
        this._shotInFlight = false;
        if (this.losePopup) this.losePopup.active = false;
        this.refreshRoundUI();
    }

    protected get deadCount(): number {
        return this.enemies.filter(enemy => enemy?.stateMachine.cid === XEnemyStateId.Dead).length;
    }

    protected refreshRoundUI(): void {
        const displayedKills = this.storeKillTarget > 0 ? Math.min(this.deadCount, this.storeKillTarget) : this.deadCount;
        if (this.killCounter) this.killCounter.string = `${displayedKills}/${this.storeKillTarget || this.enemies.length}`;
        this.throwIcons.forEach((icon, index) => {
            if (icon) icon.opacity = index < this.throwLimit - this.throwsUsed ? 255 : 45;
        });
    }

    protected canStartThrow(): boolean {
        return this._outcome === "playing" && !this.isStoreTapReady()
            && !this._shotInFlight && this.throwsUsed < this.throwLimit;
    }

    protected isStoreTapReady(): boolean {
        return this.storeKillTarget > 0 && this.deadCount >= Math.max(1, this.storeTapKillThreshold);
    }

    protected onStoreTouchStart(event?: EventTouch): void {
        if (!this.enabledInHierarchy || this._outcome !== "playing" || !this.isStoreTapReady()) return;
        this._outcome = "store";
        // Keep the CTA tap from also starting gameplay or clicking a child button.
        if (event) event.propagationStopped = true;
        EventHandler.emitEvents(this.storeEvents);
    }

    protected lateUpdate(): void {
        if (!this._shotInFlight || this._outcome !== "playing") return;
        const isFlying = Array.from(this._spear.values()).some(spear => spear.isValid
            && spear.enabledInHierarchy && spear.state === XSpearStateId.Flying);
        if (isFlying) return;
        this._shotInFlight = false;
        this.invokeEveryEnemyDieIfNeeded();
        if (this._outcome === "playing" && !this.isStoreTapReady() && this.throwsUsed >= this.throwLimit) {
            this._outcome = "lost";
            if (this.losePopup) this.losePopup.active = true;
        }
    }

    public retryLevel(): void {
        if (this._outcome !== "lost") return;
        this.onLevelRetry?.();
    }

    addSpear(spear: XSpear) {
        if(!spear) return;

        this._spear.set(spear.uuid, spear);
        spear.init(this.gameBoard)
    }

    protected start(): void {
        if (this.storeTapArea) {
            this.storeTapArea.on(Node.EventType.TOUCH_START, this.onStoreTouchStart, this, true);
        }
        input.on(Input.EventType.TOUCH_START, this.onStoreTouchStart, this);
        this.gameBoard.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);

        if(this.isAllowDrag) {
            this.gameBoard.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.gameBoard.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.gameBoard.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        } else {
            this.gameBoard.node.on(Node.EventType.TOUCH_START, this._onOneTouchStart, this);
        }

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

    protected _onOneTouchStart() {
        if (!this.canStartThrow()) return;
        for(const _sp of this._spear.values()) {
            if (_sp.enabledInHierarchy) _sp.startCharge(_sp.getHeadPosition());
        }
    }

    protected onDestroy(): void {
        if (this.storeTapArea) {
            this.storeTapArea.off(Node.EventType.TOUCH_START, this.onStoreTouchStart, this, true);
        }
        input.off(Input.EventType.TOUCH_START, this.onStoreTouchStart, this);
        this._observerDisposers.forEach((_dispose) => _dispose());
        this._observerDisposers.length = 0;

        if (this.gameBoard?.node) {
            this.gameBoard.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.gameBoard.node.off(Node.EventType.TOUCH_START, this._onOneTouchStart, this);
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
        if (!this.canStartThrow()) return;
        const _t = this.getTouchLocal(event);
        for(const _sp of this._spear.values()) {
            if (_sp.enabledInHierarchy) _sp.startCharge(_t);
        }
    }

    protected onTouchMove(event: EventTouch): void {
        if (!this.canStartThrow()) return;
        const _t = this.getTouchLocal(event);
        const _w = event.getUILocation();
        for(const _sp of this._spear.values()) {
            _sp.aimAt(_t, _w);
        }
    }

    protected onTouchEnd(): void {
        if (!this.canStartThrow()) return;
        const charged = Array.from(this._spear.values()).filter(spear => spear.enabledInHierarchy
            && spear.state === XSpearStateId.Charging);
        if (!charged.length) return;
        this.throwsUsed += 1;
        this._shotInFlight = true;
        this.refreshRoundUI();
        charged.forEach(spear => spear.release());
    }

    protected getTouchLocal(event: EventTouch): Vec2 {
        const uiTransform = this.gameBoard.node.getComponent(UITransform);
        const touchWorldPos = event.getUILocation();
        const worldPos = new Vec3(touchWorldPos.x, touchWorldPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        return new Vec2(localPos.x, localPos.y);
    }

    public findSpearHit(spear: XSpear): { enemy: XEnemy; kind: "body" | "balloon" } | null {
        return this.findSpearHits(spear)[0] ?? null;
    }

    public findSpearHits(spear: XSpear): Array<{ enemy: XEnemy; kind: "body" | "balloon" }> {
        const segments = spear.getFlightHitSegments();
        const hits: Array<{ enemy: XEnemy; kind: "body" | "balloon" }> = [];
        for (const enemy of this.enemies) {
            if (enemy.isDamageImmune() || enemy.stateMachine.cid === null || enemy.stateMachine.cid === XEnemyStateId.Dead) continue;
            const intersects = (collider: Collider2D | null) => collider?.enabledInHierarchy
                && segments.some(segment => this.segmentIntersectsCollider(segment.from, segment.to, collider));
            // A body hit wins over a balloon hit for the same enemy.
            if (intersects(enemy.getBodyCollider())) hits.push({ enemy, kind: "body" });
            else if (intersects(enemy.getBalloonCollider())) hits.push({ enemy, kind: "balloon" });
        }
        return hits;
    }

    public tryCloneSpear(spear: XSpear): void {
        if (!spear || spear.state !== XSpearStateId.Flying) {
            return;
        }

        const previousHeadBoard = this.gameBoard.toBoardPoint(spear.getPreviousHeadWorldPosition());
        const currentHeadBoard = spear.getHeadPosition();
        console.log("[XGameController] BEFORE Try Get ActiveCloners >>>", ClonerSpear.getActiveCloners())
        for (const cloner of ClonerSpear.getActiveCloners()) {
            console.log("[XGameController] Try Get ActiveCloners >>>", cloner)
            const collider = cloner.getCollider();
            if (!collider) {
                continue;
            }

            const hit = this.findSegmentRectHit(
                previousHeadBoard,
                currentHeadBoard,
                this.getColliderBoardRect(collider),
            );
            console.log("Found hit", hit)
            if (!hit) {
                continue;
            }

            const hitWorld = this.gameBoard.toWorldPoint(hit.point);
            cloner.tryCloneBySpear(spear, hitWorld);
        }
    }

    public findReflectionHitForDirection(origin: Vec2, direction: Vec2, maxDistance: number): XGameReflectionHit | null {
        const hit = this.findReflectionHit(origin, direction, maxDistance);
        if (!hit) {
            return null;
        }

        return {
            point: hit.point,
            normal: hit.normal,
            distance: hit.distance,
        };
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

            const groundRect = groundCollider.worldAABB;
            if (legRect.xMin <= groundRect.xMax && legRect.xMax >= groundRect.xMin
                && legRect.yMin <= groundRect.yMax && legRect.yMax >= groundRect.yMin) {
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

    public castLaser(origin: Vec2, direction: Vec2, maxDistance: number = Number.POSITIVE_INFINITY): XGameLaserHit | null {
        if (direction.lengthSqr() <= 0.0001) return null;
        const boardHit = this.findClosestBoardHit(origin, direction, true);
        if (!boardHit) return null;
        const distance = Math.min(boardHit.distance, Math.max(0, maxDistance));
        const point = origin.clone().add(direction.clone().normalize().multiplyScalar(distance));
        const hits: { enemy: XEnemy; distance: number }[] = [];
        for (const enemy of this.enemies) {
            const bodyCollider = enemy.getBodyCollider();
            if (!bodyCollider?.enabledInHierarchy) continue;
            const hit = this.raycastBoardRectHit(origin, direction, this.getColliderBoardRect(bodyCollider), distance);
            if (hit) hits.push({ enemy, distance: hit.distance });
        }
        hits.sort((a, b) => a.distance - b.distance);
        const enemies = hits.map(hit => hit.enemy);
        // Bodies are targets, so the preview continues through them up to the wall.
        return { enemy: enemies[0] ?? null, enemies, point };
    }

    public castLaserPath(origin: Vec2, direction: Vec2): XGameLaserPath | null {
        if (direction.lengthSqr() <= 0.0001) return null;
        const segments: XGameLaserPath["segments"] = [];
        let from = origin.clone(), dir = direction.clone().normalize();
        let reflectionPoint: Vec2 | null = null;
        // Match consecutive mirrors while keeping the preview bounded in a mirror loop.
        for (let bounce = 0; bounce < 8; bounce++) {
            const wallHit = this.castLaser(from, dir);
            if (!wallHit) break;
            const distance = Vec2.distance(from, wallHit.point);
            const mirror = this.findReflectionHit(from, dir, distance);
            if (!mirror || mirror.distance >= distance - 0.0001) {
                segments.push({ from, to: wallHit.point, enemies: wallHit.enemies });
                break;
            }
            const hit = this.castLaser(from, dir, mirror.distance);
            segments.push({ from, to: mirror.point, enemies: hit?.enemies ?? [] });
            reflectionPoint ??= mirror.point;
            dir = ReflectionSpear.reflectDirection(dir, mirror.normal);
            from = mirror.point.clone().add(dir.clone().multiplyScalar(0.5));
        }
        if (!segments.length) return null;
        const directEnemies = segments[0].enemies;
        const reflectedTargets: XEnemy[] = [];
        segments.slice(1).forEach(segment => reflectedTargets.push(...segment.enemies));
        const reflectedEnemies = Array.from(new Set(reflectedTargets));
        const enemies = Array.from(new Set([...directEnemies, ...reflectedEnemies]));
        return { segments, enemies, directEnemies, reflectedEnemies, enemy: enemies[0] ?? null,
            point: segments[segments.length - 1].to, reflectionPoint };
    }

    public findReflectionHitAlongSegment(from: Vec2, to: Vec2): XGameReflectionHit | null {
        const direction = to.clone().subtract(from);
        const maxDistance = direction.length();
        if (maxDistance <= 0.0001) {
            return null;
        }

        return this.findReflectionHit(from, direction, maxDistance + 0.0001);
    }

    protected getColliderBoardPolygon(collider: Collider2D): Vec2[] | null {
        let points: Vec2[];
        if (collider instanceof BoxCollider2D) {
            if (collider.size.width <= 0 || collider.size.height <= 0) return [];
            const halfWidth = collider.size.width * 0.5;
            const halfHeight = collider.size.height * 0.5;
            points = [new Vec2(-halfWidth, -halfHeight), new Vec2(halfWidth, -halfHeight),
                new Vec2(halfWidth, halfHeight), new Vec2(-halfWidth, halfHeight)];
        } else if (collider instanceof PolygonCollider2D) {
            if (collider.points.length < 3) return [];
            points = collider.points;
        } else {
            return null;
        }
        return points.map(point => this.gameBoard.fromNodePoint(
            new Vec2(point.x + collider.offset.x, point.y + collider.offset.y), collider.node));
    }

    protected segmentIntersectsCollider(from: Vec2, to: Vec2, collider: Collider2D): boolean {
        const points = this.getColliderBoardPolygon(collider);
        if (points === null) return this.segmentIntersectsRect(from, to, this.getColliderBoardRect(collider));
        if (points.length < 3) return false;
        if (this.isPointInsidePolygon(from, points) || this.isPointInsidePolygon(to, points)) return true;
        return points.some((point, index) => this.segmentsIntersect(from, to,
            point, points[(index + 1) % points.length]));
    }

    protected isPointInsidePolygon(point: Vec2, points: Vec2[]): boolean {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[j], b = points[i];
            if (this.cross(a, b, point) === 0 && this.onSegment(a, b, point)) return true;
            if ((a.y > point.y) !== (b.y > point.y)
                && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    protected getColliderBoardRect(collider: Collider2D): { x: number; y: number; width: number; height: number } {
        const points = this.getColliderBoardPolygon(collider);
        if (points !== null) {
            if (points.length < 3) return { x: 0, y: 0, width: 0, height: 0 };
            const xs = points.map(point => point.x), ys = points.map(point => point.y);
            return { x: Math.min(...xs), y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
        }
        const aabb = collider.worldAABB;
        // Empty physics shapes can expose inverted bounds with enormous sentinel coordinates.
        if (!aabb || !Number.isFinite(aabb.width) || !Number.isFinite(aabb.height)
            || aabb.width <= 0 || aabb.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
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
        const hit = this.raycastBoardRectHit(origin, direction, rect);
        if (!hit) {
            return null;
        }

        return hit.point;
    }

    protected raycastBoardRectHit(
        origin: Vec2,
        direction: Vec2,
        rect: { x: number; y: number; width: number; height: number },
        maxDistance: number = Number.POSITIVE_INFINITY,
    ): { point: Vec2; normal: Vec2; distance: number } | null {
        if (rect.width <= 0 || rect.height <= 0) return null;
        const dir = direction.clone();
        if (dir.lengthSqr() <= 0.0001) {
            return null;
        }
        dir.normalize();

        let tMin = -Infinity;
        let tMax = Infinity;
        let minNormal = new Vec2();
        let maxNormal = new Vec2();

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
            const txMin = Math.min(tx1, tx2);
            const txMax = Math.max(tx1, tx2);
            const entryNormal = tx1 < tx2 ? new Vec2(-1, 0) : new Vec2(1, 0);
            const exitNormal = tx1 < tx2 ? new Vec2(1, 0) : new Vec2(-1, 0);

            if (txMin > tMin) {
                tMin = txMin;
                minNormal = entryNormal;
            }
            if (txMax < tMax) {
                tMax = txMax;
                maxNormal = exitNormal;
            }
        }

        if (Math.abs(dir.y) < 0.0001) {
            if (origin.y < minY || origin.y > maxY) {
                return null;
            }
        } else {
            const ty1 = (minY - origin.y) / dir.y;
            const ty2 = (maxY - origin.y) / dir.y;
            const tyMin = Math.min(ty1, ty2);
            const tyMax = Math.max(ty1, ty2);
            const entryNormal = ty1 < ty2 ? new Vec2(0, -1) : new Vec2(0, 1);
            const exitNormal = ty1 < ty2 ? new Vec2(0, 1) : new Vec2(0, -1);

            if (tyMin > tMin) {
                tMin = tyMin;
                minNormal = entryNormal;
            }
            if (tyMax < tMax) {
                tMax = tyMax;
                maxNormal = exitNormal;
            }
        }

        if (tMax < 0 || tMin > tMax) {
            return null;
        }

        const hitT = tMin >= 0 ? tMin : tMax;
        if (hitT < 0) {
            return null;
        }
        if (hitT > maxDistance) {
            return null;
        }

        return {
            point: new Vec2(origin.x + dir.x * hitT, origin.y + dir.y * hitT),
            normal: tMin >= 0 ? minNormal : maxNormal,
            distance: hitT,
        };
    }

    protected segmentIntersectsRect(segA: Vec2, segB: Vec2, rect: { x: number; y: number; width: number; height: number }): boolean {
        if (rect.width <= 0 || rect.height <= 0) return false;
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

    protected findReflectionHit(origin: Vec2, direction: Vec2, maxDistance: number = Number.POSITIVE_INFINITY): (XGameReflectionHit & { collider: Collider2D }) | null {
        if (!this.gameBoard || direction.lengthSqr() <= 0.0001) {
            return null;
        }

        const activeReflectionColliders = ReflectionSpear.getActiveColliders();
        if (activeReflectionColliders.length <= 0) {
            return null;
        }

        const reflectionIds = new Set(activeReflectionColliders.filter(collider => !(collider instanceof BoxCollider2D)).map(collider => collider.uuid));
        const normalizedDirection = direction.clone().normalize();
        const maxDistanceSafe = Number.isFinite(maxDistance)
            ? Math.max(0, maxDistance)
            : Math.max(this.gameBoard.width, this.gameBoard.height) * 4;

        const fromWorld = this.gameBoard.toWorldPoint(origin);
        const toBoard = new Vec2(
            origin.x + normalizedDirection.x * maxDistanceSafe,
            origin.y + normalizedDirection.y * maxDistanceSafe,
        );
        const toWorld = this.gameBoard.toWorldPoint(toBoard);
        let closestHit: (XGameReflectionHit & { collider: Collider2D }) | null = null;
        // Box mirrors use their current node transform, independent of physics sync.
        for (const collider of activeReflectionColliders) {
            if (!(collider instanceof BoxCollider2D)) continue;
            const localOrigin3 = collider.node.inverseTransformPoint(new Vec3(), fromWorld);
            const localEnd3 = collider.node.inverseTransformPoint(new Vec3(), toWorld);
            const localOrigin = new Vec2(localOrigin3.x, localOrigin3.y);
            const localDirection = new Vec2(localEnd3.x - localOrigin3.x, localEnd3.y - localOrigin3.y);
            const hit = this.raycastBoardRectHit(localOrigin, localDirection, {
                x: collider.offset.x - collider.size.width * 0.5,
                y: collider.offset.y - collider.size.height * 0.5,
                width: collider.size.width, height: collider.size.height,
            }, localDirection.length());
            if (!hit) continue;
            const point = this.gameBoard.fromNodePoint(hit.point, collider.node);
            const distance = Vec2.distance(origin, point);
            if (distance <= 0.0001 || distance > maxDistanceSafe + 0.0001) continue;
            const tangentPoint = this.gameBoard.fromNodePoint(new Vec2(
                hit.point.x - hit.normal.y, hit.point.y + hit.normal.x), collider.node);
            const tangent = tangentPoint.subtract(point).normalize();
            const normal = new Vec2(-tangent.y, tangent.x);
            if (Vec2.dot(normal, normalizedDirection) > 0) normal.multiplyScalar(-1);
            if (!closestHit || distance < closestHit.distance) closestHit = { point, normal, distance, collider };
        }
        if (!reflectionIds.size) return closestHit;
        const hits = PhysicsSystem2D.instance.raycast(
            v2(fromWorld.x, fromWorld.y),
            v2(toWorld.x, toWorld.y),
            ERaycast2DType.AllClosest,
        );
        if (hits.length <= 0) return closestHit;
        for (const hit of hits) {
            const collider = hit.collider;
            if (!collider || !reflectionIds.has(collider.uuid)) {
                continue;
            }

            const hitWorld = new Vec3(hit.point.x, hit.point.y, 0);
            const hitBoard = this.gameBoard.toBoardPoint(hitWorld);
            const distance = Vec2.distance(origin, hitBoard);
            if (distance <= 0.0001 || distance > maxDistanceSafe + 0.0001) {
                continue;
            }

            const normalWorldEnd = new Vec3(hit.point.x + hit.normal.x, hit.point.y + hit.normal.y, 0);
            const normalBoardEnd = this.gameBoard.toBoardPoint(normalWorldEnd);
            const normalBoard = normalBoardEnd.clone().subtract(hitBoard).normalize();
            if (normalBoard.lengthSqr() <= 0.0001) {
                continue;
            }

            if (!closestHit || distance < closestHit.distance) {
                closestHit = {
                    point: hitBoard,
                    normal: normalBoard,
                    distance,
                    collider,
                };
            }
        }

        return closestHit;
    }

    protected findClosestBoardHit(
        origin: Vec2,
        direction: Vec2,
        skipReflectionColliders: boolean,
    ): { point: Vec2; distance: number } | null {
        let closest: { point: Vec2; distance: number } | null = null;
        for (const boardCollider of [...(this.gameBoard.walls ?? []), ...(this.gameBoard.grounds ?? [])]) {
            if (!boardCollider?.enabledInHierarchy) {
                continue;
            }
            if (skipReflectionColliders && this.isReflectionCollider(boardCollider)) {
                continue;
            }

            const hit = this.raycastBoardRectHit(origin, direction, this.getColliderBoardRect(boardCollider));
            if (!hit) {
                continue;
            }

            if (!closest || hit.distance < closest.distance) {
                closest = {
                    point: hit.point,
                    distance: hit.distance,
                };
            }
        }

        return closest;
    }

    protected findSegmentRectHit(
        from: Vec2,
        to: Vec2,
        rect: { x: number; y: number; width: number; height: number },
    ): { point: Vec2; normal: Vec2; distance: number } | null {
        const direction = to.clone().subtract(from);
        const maxDistance = direction.length();
        if (maxDistance <= 0.0001) {
            return null;
        }

        return this.raycastBoardRectHit(from, direction, rect, maxDistance + 0.0001);
    }

    protected isReflectionCollider(collider: Collider2D): boolean {
        return ReflectionSpear.getActiveColliders().some((_reflectionCollider) => _reflectionCollider.uuid === collider.uuid);
    }

    protected onEnemyDead(enemy: XEnemy, _spear: XSpear): void {
        // Spears already in flight finish their hits while the next tap is waiting for CTA.
        if ((this._outcome !== "playing" && this._outcome !== "store") || !this.enemies.includes(enemy) || enemy.isDamageImmune()) return;
        const hitData = this.resolveEnemyHitData(enemy, _spear);
        const didChange = enemy.enterDead(hitData.splitKind, hitData.hitDirection);
        if (!didChange) {
            return;
        }

        this.refreshRoundUI();
        if (this._outcome !== "playing") return;
        this.invokeEveryEnemyDieIfNeeded();
    }

    protected onEnemyFalling(enemy: XEnemy, _spear: XSpear): void {
        enemy.enterFalling();
    }

    protected onBalloonPop(enemy: XEnemy): void {
        enemy.enterFalling();
    }

    protected invokeEveryEnemyDieIfNeeded(): void {
        if (this._outcome !== "playing" || this.isStoreTapReady() || this._didInvokeEveryEnemyDie || this.enemies.length <= 0) {
            return;
        }

        const isEveryEnemyDead = this.enemies.every((_enemy) => _enemy?.stateMachine.cid === XEnemyStateId.Dead);
        if (!isEveryEnemyDead) {
            return;
        }

        this._didInvokeEveryEnemyDie = true;
        this._outcome = "won";
        if (this.onLevelWin) {
            this.onLevelWin();
        } else {
            XGameObserver.invoke("onEveryEnemyDie");
        }
    }

}
