import { _decorator, Color, Component, Enum, EventTouch, Graphics, math, Node, sp, UITransform, Vec2, Vec3 } from "cc";
import { EDITOR } from "cc/env";
import { AnimSelector } from "./AnimSelector";
import { CollisionZone } from "./CollisionZone";
import { GameBoard } from "./GameBoard";
import XGameBridge from "./XGameBridge";
import { XEnemy } from "./XEnemy";
import { IState } from "./IState";
import { StateEnterArgs, StateExitArgs } from "./State";
import { StateMachine } from "./StateMachine";
import { XSpearChargingState } from "./XSpearChargingState";
import { XSpearFlyingState } from "./XSpearFlyingState";
import { XSpearIdleState } from "./XSpearIdleState";

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

    @property({ tooltip: "Minimum angle from the pinned edge." })
    public minAngleFromEdge: number = 25;

    @property({ type: XSpearStateId })
    public defaultState: XSpearStateId = XSpearStateId.Idle;

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
    protected _board: GameBoard = null;
    protected _didInitializeState: boolean = false;
    protected _laserTarget: XEnemy | null = null;
    protected _map: Record<XSpearStateId, string> = {
        [XSpearStateId.Idle]: "",
        [XSpearStateId.Charging]: "",
        [XSpearStateId.Flying]: "",
    };

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

    protected start(): void {
        this.initializeStateFromCurrentPose();
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

    public getFreeEndPosition(): Vec2 {
        const pinned = this.getPinnedPosition();
        const up = this.getLocalUp();
        return new Vec2(
            pinned.x + up.x * this.spearLength,
            pinned.y + up.y * this.spearLength,
        );
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

    public pinToEdge(edgePoint: Vec2, inwardDir: Vec2): void {
        this._pinnedEdgeNormal.set(inwardDir.x, inwardDir.y).normalize();
        this._stuckUpDirection.set(inwardDir.x, inwardDir.y).normalize();
        const angleDeg = math.toDegree(Math.atan2(-inwardDir.x, inwardDir.y));
        this.node.angle = angleDeg;
        this.node.setPosition(edgePoint.x, edgePoint.y, 0);
        this.changeState<XSpearIdleState>(XSpearStateId.Idle, [this.getAnim(XSpearStateId.Idle)]);
    }

    protected initializeStateFromCurrentPose(): void {
        if (this._didInitializeState || !this._board) {
            return;
        }

        const currentPosition = this.getPinnedPosition();
        const currentUp = this.getLocalUp().normalize();
        const edgeNormal = this.detectEdgeNormal(this._board.clampPoint(currentPosition));

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

        this.changeState<XSpearChargingState>(XSpearStateId.Charging, [this.getAnim(XSpearStateId.Charging)]);
        this.aimAt(touchPos);
    }

    public aimAt(touchPos: Vec2): void {
        if (this.state !== XSpearStateId.Charging) {
            return;
        }

        const pinnedPos = this.getPinnedPosition();
        let direction = touchPos.clone().subtract(pinnedPos);
        if (direction.lengthSqr() < 0.0001) {
            return;
        }

        direction = direction.normalize();
        if (!this.isDirectionValid(direction)) {
            return;
        }

        this._chargeDir.set(direction.x, direction.y);

        const angleDeg = math.toDegree(Math.atan2(-direction.x, direction.y));
        this.node.angle = angleDeg;
    }

    public release(): void {
        if (this.state !== XSpearStateId.Charging || !this._board) {
            return;
        }

        this._flyDirection.set(this._chargeDir.x, this._chargeDir.y);
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

    public updateFlying(dt: number): CollisionZone | null | undefined {
        if (!this._board) {
            return undefined;
        }

        const moveDistance = this.flySpeed * dt;
        const pos = this.node.getPosition();
        this.node.setPosition(
            pos.x + this._flyDirection.x * moveDistance,
            pos.y + this._flyDirection.y * moveDistance,
            0,
        );

        const freeEnd = this.getFreeEndPosition();
        if (!this._board.containsPoint(freeEnd)) {
            const clampedFreeEnd = this._board.clampPoint(freeEnd);
            const normal = this.detectEdgeNormal(clampedFreeEnd);
            this._pinnedEdgeNormal.set(normal.x, normal.y);
            this.node.angle += 180;
            this.node.setPosition(clampedFreeEnd.x, clampedFreeEnd.y, 0);
            const stuckUp = this.getLocalUp();
            this._stuckUpDirection.set(stuckUp.x, stuckUp.y).normalize();
            this.changeState<XSpearIdleState, XSpearFlyingState>(
                XSpearStateId.Idle,
                [this.getAnim(XSpearStateId.Idle)],
                [],
            );

            this.onPinned?.();
            return null;
        }

        return undefined;
    }

    public checkCollisionWithCircle(center: Vec2, radius: number): boolean {
        const p1 = this.getPinnedPosition();
        const p2 = this.getFreeEndPosition();
        return this.pointToSegmentDistance(center, p1, p2) <= radius;
    }

    public checkCollisionWithZone(zone: CollisionZone): boolean {
        const p1 = this.getPinnedPosition();
        const p2 = this.getFreeEndPosition();
        return this.segmentIntersectsRect(p1, p2, zone.getBoardRect());
    }

    public getTouchLocal(event: EventTouch, targetNode: Node): Vec2 {
        const uiTransform = targetNode.getComponent(UITransform);
        const touchWorldPos = event.getUILocation();
        const worldPos = new Vec3(touchWorldPos.x, touchWorldPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);
        return new Vec2(localPos.x, localPos.y);
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

    protected detectEdgeNormal(point: Vec2): Vec2 {
        const eps = 2;
        if (Math.abs(point.y - this._board.minY) < eps) return new Vec2(0, 1);
        if (Math.abs(point.y - this._board.maxY) < eps) return new Vec2(0, -1);
        if (Math.abs(point.x - this._board.minX) < eps) return new Vec2(1, 0);
        if (Math.abs(point.x - this._board.maxX) < eps) return new Vec2(-1, 0);
        return new Vec2(0, 1);
    }

    protected isDirectionValid(direction: Vec2): boolean {
        return this.isDirectionAngleValid(direction) && this.isDirectionInsideBoard(direction);
    }

    protected isDirectionAngleValid(direction: Vec2): boolean {
        const normalizedDirection = direction.clone().normalize();
        const normalizedNormal = this._pinnedEdgeNormal.clone().normalize();
        const maxAngleToNormal = math.toRadian(90 - this.minAngleFromEdge);
        const minDot = Math.cos(maxAngleToNormal);
        const directionDot = Vec2.dot(normalizedDirection, normalizedNormal);
        return directionDot >= minDot - 0.0001;
    }

    protected isDirectionInsideBoard(direction: Vec2): boolean {
        return this._board.containsPoint(this.getHeadPositionForDirection(direction));
    }

    protected getHeadPositionForDirection(direction: Vec2): Vec2 {
        const pinned = this.getPinnedPosition();
        const angle = Math.atan2(-direction.x, direction.y);
        const headOffset = this.getHeadLocalOffset();
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(
            pinned.x + headOffset.x * cos - headOffset.y * sin,
            pinned.y + headOffset.x * sin + headOffset.y * cos,
        );
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
}
