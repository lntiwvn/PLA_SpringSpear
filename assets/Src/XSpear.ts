import { _decorator, Collider2D, Color, Component, Enum, EventTouch, Graphics, TweenEasing, easing, math, Node, sp, UITransform, Vec2, Vec3 } from "cc";
import { EDITOR } from "cc/env";
import { AnimSelector } from "./AnimSelector";
import Easing from "./Easing";
import { GameBoard } from "./GameBoard";
import XGameBridge from "./XGameBridge";
import { XEnemy } from "./XEnemy";
import { IState } from "./IState";
import { StateEnterArgs, StateExitArgs } from "./State";
import { StateMachine } from "./StateMachine";
import { XSpearChargingState } from "./XSpearChargingState";
import { XSpearFlyingState } from "./XSpearFlyingState";
import { XSpearIdleState } from "./XSpearIdleState";
import { AudioSource } from "cc";

const { ccclass, property, executeInEditMode } = _decorator;

export enum XSpearStateId {
    Idle = 0,
    Charging,
    Flying,
}

Enum(XSpearStateId);

@ccclass("XSpear")
@executeInEditMode()
export class XSpear extends Component {
    @property
    public spearLength: number = 200;

    @property
    public flySpeed: number = 1500;

    @property({ tooltip: "Initial speed scale applied right after release." })
    public flyScale: number = 1;

    @property({ tooltip: "Duration for flyScale to ease back to 1." })
    public flyScaleDuration: number = 0.25;

    @property({ type: Easing })
    public flyEasing: TweenEasing = "linear";

    @property({ type: Easing })
    public flyScaleEasing: TweenEasing = "linear";

    @property({ tooltip: "Minimum angle from the pinned edge." })
    public minAngleFromEdge: number = 25;

    @property({ tooltip: "Distance threshold to stop rotation or pin when the spear head is already touching a wall." })
    public wallStickThreshold: number = 8;

    @property({ type: XSpearStateId })
    public defaultState: XSpearStateId = XSpearStateId.Idle;

    @property(AudioSource)
    compressAu: AudioSource = null
    @property(AudioSource)
    shootAu: AudioSource = null

    @property({ type: sp.Skeleton })
    protected _visual: sp.Skeleton = null;

    @property({ type: sp.Skeleton })
    public get visual(): sp.Skeleton {
        return this._visual;
    }

    public set visual(value: sp.Skeleton) {
        if (!value || this._visual === value) {
            return;
        }

        this._visual = value;
        this.onFocusInEditor();
    }

    @property([AnimSelector])
    public selectors: AnimSelector<XSpearStateId>[] = [];

    @property(Node)
    public laserHeadNode: Node = null;

    @property(Graphics)
    public laserGraphic: Graphics = null;

    @property
    public laserWidth: number = 4;

    protected readonly _stateMachine: StateMachine<XSpearStateId, XSpear> = new StateMachine();
    protected readonly _flyDirection: Vec2 = new Vec2();
    protected readonly _chargeDir: Vec2 = new Vec2();
    protected readonly _pinnedEdgeNormal: Vec2 = new Vec2(0, 1);
    protected readonly _stuckUpDirection: Vec2 = new Vec2(0, 1);
    protected readonly _dragTouchStart: Vec2 = new Vec2();
    protected readonly _dragFreeEndStart: Vec2 = new Vec2();
    protected readonly _lastDragTouchDelta: Vec2 = new Vec2();
    protected _board: GameBoard = null;
    protected _didInitializeState: boolean = false;
    protected _laserTarget: XEnemy | null = null;
    protected _lastDragRotationDirection: number = 0;
    protected _flightDistance: number = 0;
    protected _flightProgress: number = 0;
    protected _flightScaleElapsed: number = 0;
    protected readonly _previousHeadWorldPosition: Vec3 = new Vec3();
    protected readonly _ignoredColliderIds: Set<string> = new Set();
    protected _map: Record<XSpearStateId, string> = {
        [XSpearStateId.Idle]: "",
        [XSpearStateId.Charging]: "",
        [XSpearStateId.Flying]: "",
    };

    isChargable() {
        return this.state !== XSpearStateId.Idle
    }

    public onPinned: (() => void) | null = null;

    public get stateMachine(): StateMachine<XSpearStateId, XSpear> {
        return this._stateMachine;
    }

    public get state(): XSpearStateId | null {
        return this._stateMachine.cid;
    }

    protected onLoad(): void {
        if (EDITOR) {
            this.onFocusInEditor();
        }

        if (!this.visual) {
            this.visual = this.getComponentInChildren(sp.Skeleton);
        }
        this._map = this.selectors.reduce((_current, _selector) => {
            _current[_selector.id] = _selector.anim;
            return _current;
        }, {} as Record<XSpearStateId, string>);
        !EDITOR && delete this.selectors;

        this._stateMachine
            .add(XSpearStateId.Idle, new XSpearIdleState())
            .add(XSpearStateId.Charging, new XSpearChargingState())
            .add(XSpearStateId.Flying, new XSpearFlyingState());

    }

    protected update(dt: number): void {
        this._stateMachine.update(this, dt);
    }

    public onFocusInEditor(): void {
        const keys = Object.keys(XSpearStateId).filter((key) => Number.isNaN(Number(key)));
        const enumValues = keys.map((key) => ({ name: key, value: XSpearStateId[key] }));
        if (this.selectors.length >= keys.length) {
            this.selectors.length = keys.length;
            this.selectors.forEach((selector) => selector.editor(this._visual, enumValues));
            return;
        }

        keys.forEach((_, index) => {
            this.selectors[index] = AnimSelector.create(index, this._visual, enumValues);
        });
    }

    public init(board: GameBoard): void {
        this._board = board;
        this.setSpearColliderEnabled(false);
        this.initializeStateFromCurrentPose();
    }

    public getAnim(stateId: XSpearStateId): string {
        return this._map[stateId];
    }

    public playAnimation(animationName: string, loop: boolean): void {
        if (!this.visual || !animationName) {
            return;
        }

        this.visual.setAnimation(0, animationName, loop);
    }

    public getLocalUp(): Vec2 {
        const rad = this.node.angle * Math.PI / 180;
        return new Vec2(-Math.sin(rad), Math.cos(rad));
    }

    public getPinnedPosition(): Vec2 {
        const pos = this.node.getPosition();
        return new Vec2(pos.x, pos.y);
    }

    public getPinnedBoardPosition(): Vec2 {
        if (!this._board) {
            return this.getPinnedPosition();
        }

        return this._board.fromNodePoint(this.node.position, this.node.parent);
    }

    public getFreeEndPosition(): Vec2 {
        const pinned = this.getPinnedPosition();
        const up = this.getLocalUp();
        return new Vec2(
            pinned.x + up.x * this.spearLength,
            pinned.y + up.y * this.spearLength,
        );
    }

    public getFreeEndBoardPosition(): Vec2 {
        if (!this._board) {
            return this.getFreeEndPosition();
        }

        return this._board.fromNodePoint(this.getFreeEndPosition(), this.node.parent);
    }

    public getPinnedWorldPosition(): Vec3 {
        if (!this._board) {
            const position = this.node.worldPosition;
            return new Vec3(position.x, position.y, position.z);
        }

        return this._board.toWorldPoint(this.getPinnedBoardPosition());
    }

    public getFreeEndWorldPosition(): Vec3 {
        if (!this._board) {
            const freeEnd = this.getFreeEndPosition();
            return new Vec3(freeEnd.x, freeEnd.y, 0);
        }

        return this._board.toWorldPoint(this.getFreeEndBoardPosition());
    }

    public getHeadPosition(): Vec2 {
        const sourceNode = this.laserHeadNode ?? this.node;
        const worldPosition = sourceNode.worldPosition;
        const boardNode = this._board?.node ?? this.node.parent;
        if (!boardNode) {
            return new Vec2(worldPosition.x, worldPosition.y);
        }

        const localPosition = boardNode.inverseTransformPoint(new Vec3(), worldPosition);
        return new Vec2(localPosition.x, localPosition.y);
    }

    public getHeadLocalOffset(): Vec2 {
        const sourceNode = this.laserHeadNode;
        if (!sourceNode || sourceNode === this.node) {
            return new Vec2(0, this.spearLength);
        }

        const localPosition = sourceNode.position;
        return new Vec2(localPosition.x, localPosition.y);
    }

    public getHeadWorldPosition(): Vec3 {
        const sourceNode = this.laserHeadNode ?? this.node;
        return sourceNode.worldPosition.clone();
    }


    public getPreviousHeadWorldPosition(): Vec3 {
        return this._previousHeadWorldPosition.clone();
    }

    public pinToEdge(edgePoint: Vec2, inwardDir: Vec2): void {
        this._pinnedEdgeNormal.set(inwardDir.x, inwardDir.y).normalize();
        this._stuckUpDirection.set(inwardDir.x, inwardDir.y).normalize();
        const angleDeg = math.toDegree(Math.atan2(-inwardDir.x, inwardDir.y));
        this.node.angle = angleDeg;
        if (this._board) {
            const parentSpacePoint = this._board.toNodePoint(edgePoint, this.node.parent);
            this.node.setPosition(parentSpacePoint.x, parentSpacePoint.y, parentSpacePoint.z);
        } else {
            this.node.setPosition(edgePoint.x, edgePoint.y, 0);
        }
        this.syncCollider();
        this.changeState<XSpearIdleState>(XSpearStateId.Idle, [this.getAnim(XSpearStateId.Idle)]);
    }

    protected initializeStateFromCurrentPose(): void {
        if (this._didInitializeState || !this._board) {
            return;
        }

        const currentPosition = this.getPinnedBoardPosition();
        const currentUp = this.getLocalUp().normalize();
        const edgeNormal = this._board.findNearestWall(currentPosition)?.normal ?? new Vec2(0, 1);

        this._pinnedEdgeNormal.set(edgeNormal.x, edgeNormal.y);
        this._stuckUpDirection.set(currentUp.x, currentUp.y);
        this._chargeDir.set(currentUp.x, currentUp.y);
        this._flyDirection.set(currentUp.x, currentUp.y);

        this._didInitializeState = true;
        this.changeState(this.defaultState, [this.getAnim(this.defaultState)]);
    }


    public startCharge(touchPos: Vec2): void {
        if (this.state !== XSpearStateId.Idle || !this._board) {
            return;
        }
        this.compressAu?.play();

        this.changeState<XSpearChargingState>(XSpearStateId.Charging, [this.getAnim(XSpearStateId.Charging)]);
        this.aimDirectAt(touchPos);
        this.beginDrag(touchPos);
    }

    public aimAt(touchPos: Vec2, _world: Vec2): void {
        if (this.state !== XSpearStateId.Charging) {
            return;
        }

        const pinnedPos = this.getPinnedPosition();
        const touchDelta = touchPos.clone().subtract(this._dragTouchStart);
        if (this.shouldRebaseDrag(touchDelta)) {
            this.rebaseDrag(touchPos);
            return;
        }

        const direction = this.getDragDirection(touchDelta, pinnedPos);
        if (!direction || !this.isDirectionValid(direction)) {
            return;
        }

        const laserOrigin = this.getHeadPosition();
        const laserHit = XGameBridge.get()?.castLaser(laserOrigin, direction);
        if (!laserHit) {
            return;
        }

        const minAimDistance = this.spearLength * 0.5;
        const aimDistance = Vec2.distance(laserOrigin, laserHit.point);
        if (aimDistance <= minAimDistance) {
            return;
        }

        this.applyAimDirection(direction);
        this._lastDragTouchDelta.set(touchDelta.x, touchDelta.y);
    }

    public release(): void {
        if (this.state !== XSpearStateId.Charging || !this._board) {
            return;
        }
        this.shootAu?.play();

        this.resetDragState();
        this._flyDirection.set(this._chargeDir.x, this._chargeDir.y);
        this.beginFlightMotion();
        this.changeState<XSpearFlyingState>(XSpearStateId.Flying, [this.getAnim(XSpearStateId.Flying)]);
    }

    public getFlyDirection(): Vec2 {
        return this._flyDirection.clone();
    }

    public updateLaser(): void {
        const origin = this.getHeadPosition();
        const direction = this._chargeDir.lengthSqr() > 0.0001 ? this._chargeDir.clone() : this.getLocalUp().normalize();
        const hit = XGameBridge.get()?.castLaser(origin, direction);
        if (!hit) {
            this.clearLaser();
            this.clearLaserTarget();
            return;
        }

        const nextTarget = hit.enemy;
        if (this._laserTarget && this._laserTarget !== nextTarget) {
            this._laserTarget.clearScare();
        }

        this._laserTarget = nextTarget;
        if (this._laserTarget) {
            this._laserTarget.enterScare();
        }

        this.drawLaser(origin, hit.point, nextTarget ? Color.GREEN : Color.RED);
    }

    public clearLaser(): void {
        if (!this.laserGraphic) {
            return;
        }

        this.laserGraphic.clear();
    }

    public clearLaserTarget(): void {
        if (!this._laserTarget) {
            return;
        }

        this._laserTarget.clearScare();
        this._laserTarget = null;
    }

    public updateFlying(dt: number): Collider2D | null | undefined {
        if (!this._board) {
            return undefined;
        }

        const previousHeadWorld = this.getHeadWorldPosition();
        const moveDistance = this.getFlightMoveDistance(dt);
        const pos = this.node.getPosition();
        this.node.setPosition(
            pos.x + this._flyDirection.x * moveDistance,
            pos.y + this._flyDirection.y * moveDistance,
            0,
        );
        this.syncCollider();

        const currentHeadWorld = this.getHeadWorldPosition();
        const wallHit = this._board.findWallHit(previousHeadWorld, currentHeadWorld);
        this._previousHeadWorldPosition.set(previousHeadWorld.x, previousHeadWorld.y, previousHeadWorld.z);
        if (wallHit) {
            this.pinAtWallHit(wallHit.point, wallHit.normal);
            return null;
        }

        const currentHead = this.getHeadPosition();
        const nearWallHit = this.getWallHitForDirection(currentHead, this._flyDirection, this.wallStickThreshold + 0.5);
        if (nearWallHit && Vec2.distance(currentHead, nearWallHit.point) <= this.wallStickThreshold) {
            this.pinAtWallHit(nearWallHit.point, nearWallHit.normal);
            return null;
        }

        return undefined;
    }

    public checkCollisionWithCircle(center: Vec2, radius: number): boolean {
        const p1 = this.getPinnedBoardPosition();
        const p2 = this.getFreeEndBoardPosition();
        return this.pointToSegmentDistance(center, p1, p2) <= radius;
    }

    public intersectsCollider(collider: Collider2D | null): boolean {
        if (!collider?.enabledInHierarchy) {
            return false;
        }

        const rect = this.getColliderBoardRect(collider);
        if (this.segmentIntersectsRect(this.getPinnedBoardPosition(), this.getFreeEndBoardPosition(), rect)) {
            return true;
        }

        const previousHeadBoard = this._board.toBoardPoint(this._previousHeadWorldPosition);
        const currentHeadBoard = this.getHeadPosition();
        return this.segmentIntersectsRect(previousHeadBoard, currentHeadBoard, rect);
    }

    public captureIgnoredColliders(enemies: XEnemy[]): void {
        this._ignoredColliderIds.clear();

        for (const enemy of enemies) {
            if (enemy.stateMachine.cid === null) {
                continue;
            }

            this.captureIgnoredCollider(enemy.getBodyCollider());
            this.captureIgnoredCollider(enemy.getBalloonCollider());
        }
    }

    public refreshIgnoredColliders(enemies: XEnemy[]): void {
        if (this._ignoredColliderIds.size <= 0) {
            return;
        }

        for (const enemy of enemies) {
            this.refreshIgnoredCollider(enemy.getBodyCollider());
            this.refreshIgnoredCollider(enemy.getBalloonCollider());
        }
    }

    public shouldIgnoreCollider(collider: Collider2D | null): boolean {
        const colliderId = collider?.uuid;
        return !!colliderId && this._ignoredColliderIds.has(colliderId);
    }

    public getTouchLocal(event: EventTouch, targetNode: Node): Vec2 {
        const uiTransform = targetNode.getComponent(UITransform);
        const touchWorldPos = event.getUILocation();
        const worldPos = new Vec3(touchWorldPos.x, touchWorldPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        return new Vec2(localPos.x, localPos.y);
    }

    public setSpearColliderEnabled(value: boolean): void {
        if (value) {
            const headWorld = this.getHeadWorldPosition();
            this._previousHeadWorldPosition.set(headWorld.x, headWorld.y, headWorld.z);
        }
    }

    public syncCollider(): void {
        const headWorld = this.getHeadWorldPosition();
        this._previousHeadWorldPosition.set(headWorld.x, headWorld.y, headWorld.z);
    }

    public changeState<
        _TEnter extends IState<XSpear, any[], any[]> = IState<XSpear, any[], any[]>,
        _TExit extends IState<XSpear, any[], any[]> = IState<XSpear, any[], any[]>,
    >(
        stateId: XSpearStateId,
        enterArgs: StateEnterArgs<_TEnter> = [] as unknown as StateEnterArgs<_TEnter>,
        exitArgs: StateExitArgs<_TExit> = [] as unknown as StateExitArgs<_TExit>,
    ): boolean {
        return this._stateMachine.change<_TEnter, _TExit>(stateId, this, enterArgs, exitArgs);
    }

    protected isDirectionValid(direction: Vec2): boolean {
        return this.isDirectionAngleValid(direction) && !this.isDirectionBlockedByWall(direction);
    }

    protected aimDirectAt(touchPos: Vec2): void {
        const pinnedPos = this.getPinnedPosition();
        const direction = touchPos.clone().subtract(pinnedPos);
        if (direction.lengthSqr() < 0.0001) {
            return;
        }

        direction.normalize();
        if (!this.isDirectionValid(direction)) {
            return;
        }

        this.applyAimDirection(direction);
    }

    protected beginDrag(touchPos: Vec2): void {
        this._dragTouchStart.set(touchPos.x, touchPos.y);
        const freeEnd = this.getFreeEndPosition();
        this._dragFreeEndStart.set(freeEnd.x, freeEnd.y);
        this.resetDragState();
    }

    protected resetDragState(): void {
        this._lastDragRotationDirection = 0;
        this._lastDragTouchDelta.set(0, 0);
    }

    protected shouldRebaseDrag(touchDelta: Vec2): boolean {
        const rebaseEpsilon = 0.0005;
        const xFlip = Math.abs(touchDelta.x) > rebaseEpsilon
            && Math.abs(this._lastDragTouchDelta.x) > rebaseEpsilon
            && Math.sign(touchDelta.x) !== Math.sign(this._lastDragTouchDelta.x);
        const yFlip = Math.abs(touchDelta.y) > rebaseEpsilon
            && Math.abs(this._lastDragTouchDelta.y) > rebaseEpsilon
            && Math.sign(touchDelta.y) !== Math.sign(this._lastDragTouchDelta.y);
        if (xFlip || yFlip) {
            return true;
        }

        const direction = this.getDragDirection(touchDelta, this.getPinnedPosition());
        if (!direction) {
            return false;
        }

        const targetAngle = math.toDegree(Math.atan2(-direction.x, direction.y));
        const desiredDelta = this.deltaAngle(this.node.angle, targetAngle);
        if (Math.abs(desiredDelta) <= 0.0001) {
            return false;
        }

        const desiredDirection = Math.sign(desiredDelta);
        const didFlipRotationDirection = this._lastDragRotationDirection !== 0
            && desiredDirection !== this._lastDragRotationDirection;
        if (didFlipRotationDirection) {
            return true;
        }

        this._lastDragRotationDirection = desiredDirection;
        return false;
    }

    protected rebaseDrag(touchPos: Vec2): void {
        this._dragTouchStart.set(touchPos.x, touchPos.y);
        const freeEnd = this.getFreeEndPosition();
        this._dragFreeEndStart.set(freeEnd.x, freeEnd.y);
        this.resetDragState();
    }

    protected getDragDirection(touchDelta: Vec2, pinnedPos: Vec2): Vec2 | null {
        const targetFreeEnd = this._dragFreeEndStart.clone().add(touchDelta);
        const direction = targetFreeEnd.subtract(pinnedPos);
        if (direction.lengthSqr() < 0.0001) {
            return null;
        }

        direction.normalize();
        return direction;
    }

    protected applyAimDirection(direction: Vec2): void {
        this._chargeDir.set(direction.x, direction.y);
        this.node.angle = math.toDegree(Math.atan2(-direction.x, direction.y));
        this.syncCollider();
    }

    protected beginFlightMotion(): void {
        this._flightDistance = Math.max(0, this.computeFlightDistance());
        this._flightProgress = 0;
        this._flightScaleElapsed = 0;
    }

    protected computeFlightDistance(): number {
        if (!this._board || this._flyDirection.lengthSqr() < 0.0001) {
            return 0;
        }

        const head = this.getHeadPosition();
        const target = this.getWallHitForDirection(head, this._flyDirection);
        if (!target) {
            return 0;
        }

        return target.distance;
    }

    protected getFlightMoveDistance(dt: number): number {
        const speedScale = this.evaluateFlightSpeedScale(dt);
        const linearDistance = this.flySpeed * speedScale * dt;
        if (linearDistance <= 0 || this._flightDistance <= 0) {
            return linearDistance;
        }

        const previousProgress = this._flightProgress;
        this._flightProgress = math.clamp01(previousProgress + linearDistance / this._flightDistance);
        const previousCurve = this.evaluateFlightEasing(previousProgress);
        const currentCurve = this.evaluateFlightEasing(this._flightProgress);
        const easedDistance = this._flightDistance * Math.max(0, currentCurve - previousCurve);
        return easedDistance > 0 ? easedDistance : linearDistance;
    }

    protected evaluateFlightEasing(ratio: number): number {
        const curve = easing[this.flyEasing];
        const progress = math.clamp01(ratio);
        return curve ? math.clamp01(curve(progress)) : progress;
    }

    protected evaluateFlightSpeedScale(dt: number): number {
        const startScale = Math.max(0, this.flyScale);
        if (Math.abs(startScale - 1) <= 0.0001) {
            return 1;
        }

        const duration = Math.max(0, this.flyScaleDuration);
        if (duration <= 0) {
            return 1;
        }

        this._flightScaleElapsed += dt;
        const ratio = math.clamp01(this._flightScaleElapsed / duration);
        const curve = easing[this.flyScaleEasing];
        const easedRatio = curve ? math.clamp01(curve(ratio)) : ratio;
        return math.lerp(startScale, 1, easedRatio);
    }

    protected captureIgnoredCollider(collider: Collider2D | null): void {
        if (!collider?.enabledInHierarchy || !this.intersectsCollider(collider)) {
            return;
        }

        this._ignoredColliderIds.add(collider.uuid);
    }

    protected refreshIgnoredCollider(collider: Collider2D | null): void {
        const colliderId = collider?.uuid;
        if (!colliderId || !this._ignoredColliderIds.has(colliderId)) {
            return;
        }

        if (!collider.enabledInHierarchy || !this.intersectsCollider(collider)) {
            this._ignoredColliderIds.delete(colliderId);
        }
    }

    protected getColliderBoardRect(collider: Collider2D): { x: number; y: number; width: number; height: number } {
        const aabb = collider.worldAABB;
        const min = this._board.toBoardPoint(new Vec3(aabb.xMin, aabb.yMin, 0));
        const max = this._board.toBoardPoint(new Vec3(aabb.xMax, aabb.yMax, 0));
        return {
            x: Math.min(min.x, max.x),
            y: Math.min(min.y, max.y),
            width: Math.abs(max.x - min.x),
            height: Math.abs(max.y - min.y),
        };
    }

    protected isDirectionAngleValid(direction: Vec2): boolean {
        const normalizedDirection = direction.clone().normalize();
        const normalizedNormal = this._pinnedEdgeNormal.clone().normalize();
        const maxAngleToNormal = math.toRadian(90 - this.minAngleFromEdge);
        const minDot = Math.cos(maxAngleToNormal);
        const directionDot = Vec2.dot(normalizedDirection, normalizedNormal);
        return directionDot >= minDot - 0.0001;
    }

    protected isDirectionBlockedByWall(direction: Vec2): boolean {
        const wallHit = this.getWallHitForDirection(this.getPinnedBoardPosition(), direction);
        if (!wallHit) {
            return false;
        }

        return Vec2.distance(this.getHeadPositionForDirection(direction), wallHit.point) <= this.wallStickThreshold;
    }

    protected getHeadPositionForDirection(direction: Vec2): Vec2 {
        const pinned = this.getPinnedBoardPosition();
        const angle = Math.atan2(-direction.x, direction.y);
        const headOffset = this.getHeadLocalOffset();
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(
            pinned.x + headOffset.x * cos - headOffset.y * sin,
            pinned.y + headOffset.x * sin + headOffset.y * cos,
        );
    }

    protected deltaAngle(current: number, target: number): number {
        let delta = (target - current) % 360;
        if (delta > 180) {
            delta -= 360;
        } else if (delta < -180) {
            delta += 360;
        }

        return delta;
    }

    protected pointToSegmentDistance(point: Vec2, segA: Vec2, segB: Vec2): number {
        const dx = segB.x - segA.x;
        const dy = segB.y - segA.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) {
            return Vec2.distance(point, segA);
        }

        let t = ((point.x - segA.x) * dx + (point.y - segA.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = segA.x + t * dx;
        const projY = segA.y + t * dy;
        const distX = point.x - projX;
        const distY = point.y - projY;
        return Math.sqrt(distX * distX + distY * distY);
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

    protected drawLaser(from: Vec2, to: Vec2, color: Color): void {
        if (!this.laserGraphic) {
            return;
        }

        const fromLocal = this.convertBoardPointToGraphicLocal(from);
        const toLocal = this.convertBoardPointToGraphicLocal(to);

        this.laserGraphic.clear();
        this.laserGraphic.lineWidth = this.laserWidth;
        this.laserGraphic.strokeColor = color;
        this.laserGraphic.moveTo(fromLocal.x, fromLocal.y);
        this.laserGraphic.lineTo(toLocal.x, toLocal.y);
        this.laserGraphic.stroke();
    }

    protected convertBoardPointToGraphicLocal(point: Vec2): Vec2 {
        const boardNode = this._board?.node ?? this.node.parent;
        const graphicNode = this.laserGraphic?.node;
        if (!boardNode || !graphicNode) {
            return point.clone();
        }

        const worldPoint = boardNode.getWorldPosition().clone();
        worldPoint.x += point.x;
        worldPoint.y += point.y;

        const localPoint = graphicNode.inverseTransformPoint(new Vec3(), worldPoint);
        return new Vec2(localPoint.x, localPoint.y);
    }

    protected getWallHitForDirection(origin: Vec2, direction: Vec2, maxDistance: number = Number.POSITIVE_INFINITY): { point: Vec2; normal: Vec2; distance: number } | null {
        if (!this._board || direction.lengthSqr() <= 0.0001) {
            return null;
        }

        const hit = this._board.raycastWall(origin, direction, maxDistance);
        if (!hit) {
            return null;
        }

        return {
            point: hit.point,
            normal: hit.normal,
            distance: hit.distance,
        };
    }

    protected pinAtWallHit(point: Vec2, normal: Vec2): void {
        this._pinnedEdgeNormal.set(normal.x, normal.y);
        this.node.angle += 180;
        const parentSpacePoint = this._board.toNodePoint(point, this.node.parent);
        this.node.setPosition(parentSpacePoint.x, parentSpacePoint.y, parentSpacePoint.z);
        this.syncCollider();
        const stuckUp = this.getLocalUp();
        this._stuckUpDirection.set(stuckUp.x, stuckUp.y).normalize();
        this.changeState<XSpearIdleState, XSpearFlyingState>(
            XSpearStateId.Idle,
            [this.getAnim(XSpearStateId.Idle)],
            [],
        );
        this.onPinned?.();
    }
}
