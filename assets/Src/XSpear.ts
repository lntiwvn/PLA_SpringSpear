import { _decorator, Collider2D, Color, Component, Enum, EventTouch, Graphics, math, Node, Prefab, instantiate, sp, UITransform, Vec2, Vec3 } from "cc";
import { EDITOR } from "cc/env";
import { AnimSelector } from "./AnimSelector";
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
import { ReflectionSpear } from "./ReflectionSpear";
import { WallImpactSmokePool } from "./WallImpactSmokePool";

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

    @property({ min: 0, tooltip: "Maximum flight speed in board pixels per second." })
    public flySpeed: number = 2250;

    @property({ min: 0, max: 1, tooltip: "Unity SpearFlightDefault: fraction of maximum speed at launch." })
    public flightInitialSpeedRatio: number = 0.75;

    @property({ min: 0, tooltip: "Seconds to reach maximum speed after launch." })
    public flightAccelerationDuration: number = 0.07;

    @property({ min: 1, step: 1, tooltip: "Speed curve t^power. Unity player spear uses 4." })
    public flightAccelerationPower: number = 4;

    @property({ min: 0, max: 90, tooltip: "Optional angle margin from a wall. Zero allows aiming parallel to the wall." })
    public aimAngleMargin: number = 10;

    @property({ tooltip: "Distance threshold to stop rotation or pin when the spear head is already touching a wall." })
    public wallStickThreshold: number = 8;

    @property({ type: XSpearStateId })
    public defaultState: XSpearStateId = XSpearStateId.Idle;

    @property({ type: Prefab, tooltip: "Wall impact mark spawned when the spear pins." })
    public crackPrefab: Prefab = null;

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

    @property({ type: Node, tooltip: "Editor marker at the visible spear tip, used to stop flight at walls." })
    public wallContactNode: Node = null;

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
    protected _board: GameBoard = null;
    protected _wallImpactSmokePool: WallImpactSmokePool = null;
    protected _didInitializeState: boolean = false;
    protected readonly _laserTargets: Set<XEnemy> = new Set();
    protected _flightElapsed: number = 0;
    protected _skipInitializeStateFromPoseOnInit: boolean = false;
    protected _pendingInitStateId: XSpearStateId | null = null;
    protected readonly _previousHeadWorldPosition: Vec3 = new Vec3();
    protected _flightHitSegments: Array<{ from: Vec2; to: Vec2 }> = [];
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
        if (!this._skipInitializeStateFromPoseOnInit) {
            const selectors = this.selectors ?? [];
            const mapped = selectors.reduce((_current, _selector) => {
                _current[_selector.id] = _selector.anim;
                return _current;
            }, {} as Record<XSpearStateId, string>);
            this._map = {
                [XSpearStateId.Idle]: mapped[XSpearStateId.Idle] ?? this._map[XSpearStateId.Idle],
                [XSpearStateId.Charging]: mapped[XSpearStateId.Charging] ?? this._map[XSpearStateId.Charging],
                [XSpearStateId.Flying]: mapped[XSpearStateId.Flying] ?? this._map[XSpearStateId.Flying],
            };
        }
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
        this._wallImpactSmokePool = this.node.scene.getComponentInChildren(WallImpactSmokePool);
        this.setSpearColliderEnabled(false);
        if (this._skipInitializeStateFromPoseOnInit) {
            const nextState = this._pendingInitStateId ?? XSpearStateId.Flying;
            this._skipInitializeStateFromPoseOnInit = false;
            this._pendingInitStateId = null;
            this._didInitializeState = true;
            this.syncCollider();
            this.enterState(nextState, [this.getAnim(nextState)]);
            return;
        }
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
        const worldPosition = this.getHeadWorldPosition();
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
        // Flying collisions follow the visible tip; the laser marker belongs to aiming.
        if (this.state === XSpearStateId.Flying) {
            return this.getWallContactWorldPosition();
        }
        if (this.laserHeadNode) {
            return this.laserHeadNode.worldPosition.clone();
        }

        return Vec3.transformMat4(new Vec3(), new Vec3(0, this.spearLength, 0), this.node.worldMatrix);
    }

    public getWallContactWorldPosition(): Vec3 {
        if (this.wallContactNode) {
            return this.wallContactNode.worldPosition.clone();
        }

        var visualTransform = this.visual ? this.visual.getComponent(UITransform) : null;
        if (visualTransform) {
            return Vec3.transformMat4(new Vec3(),
                new Vec3(0, visualTransform.height * (1 - visualTransform.anchorY), 0),
                this.visual.node.worldMatrix);
        }
        return Vec3.transformMat4(new Vec3(), new Vec3(0, this.spearLength, 0), this.node.worldMatrix);
    }


    public getPreviousHeadWorldPosition(): Vec3 {
        return this._previousHeadWorldPosition.clone();
    }

    public pinToEdge(edgePoint: Vec2, inwardDir: Vec2): void {
        this._pinnedEdgeNormal.set(inwardDir.x, inwardDir.y).normalize();
        const localDirection = this.getLocalDirectionFromBoard(inwardDir);
        this._stuckUpDirection.set(localDirection.x, localDirection.y).normalize();
        this._chargeDir.set(localDirection.x, localDirection.y).normalize();
        const angleDeg = math.toDegree(Math.atan2(-localDirection.x, localDirection.y));
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

    protected onEnable(): void {
        const _brige = XGameBridge.get()
        if(!_brige || EDITOR) return;

        _brige.addSpear(this);
        console.log("Spear Enable", this)
    }

    public startCharge(touchPos: Vec2): void {
        if (this.state !== XSpearStateId.Idle || !this._board) {
            return;
        }
        this.compressAu?.play();

        this.changeState<XSpearChargingState>(XSpearStateId.Charging, [this.getAnim(XSpearStateId.Charging)]);
        const localTouch = this._board.toNodePoint(touchPos, this.node.parent);
        const localTouchPos = new Vec2(localTouch.x, localTouch.y);
        this.aimDirectAt(localTouchPos);
        this.beginDrag(localTouchPos);
    }

    public aimAt(touchPos: Vec2, _world: Vec2): void {
        if (this.state !== XSpearStateId.Charging) {
            return;
        }

        const localTouch = this._board.toNodePoint(touchPos, this.node.parent);
        const localTouchPos = new Vec2(localTouch.x, localTouch.y);
        const pinnedPos = this.getPinnedPosition();
        const touchDelta = localTouchPos.clone().subtract(this._dragTouchStart);
        const direction = this.getDragDirection(touchDelta, pinnedPos);
        if (direction) {
            const clamped = this.clampAimDirection(direction);
            if (!this.isDirectionBlockedByWall(clamped)) this.applyAimDirection(clamped);
        }
        // Consume each movement so reversing at an aim limit responds immediately.
        this.beginDrag(localTouchPos);
    }

    public release(): void {
        if (this.state !== XSpearStateId.Charging || !this._board) {
            return;
        }
        this.shootAu?.play();

        this.resetDragState();
        const boardDirection = this.getBoardDirection(this._chargeDir);
        this._flyDirection.set(boardDirection.x, boardDirection.y);
        this.beginFlightMotion();
        this.changeState<XSpearFlyingState>(XSpearStateId.Flying, [this.getAnim(XSpearStateId.Flying)]);
    }

    public getFlyDirection(): Vec2 {
        return this._flyDirection.clone();
    }

    public launchCloneFrom(source: XSpear, direction: Vec2): void {
        if (!source || direction.lengthSqr() <= 0.0001) {
            return;
        }

        const normalizedDirection = direction.clone().normalize();
        const localDirection = this.getLocalDirectionFromBoard(normalizedDirection);
        this._pinnedEdgeNormal.set(source._pinnedEdgeNormal.x, source._pinnedEdgeNormal.y);
        this._stuckUpDirection.set(source._stuckUpDirection.x, source._stuckUpDirection.y);
        this._chargeDir.set(localDirection.x, localDirection.y);
        this._flyDirection.set(normalizedDirection.x, normalizedDirection.y);
        // Unity's CloneSpearPowerup launches each clone with its own acceleration clock.
        this.beginFlightMotion();
        this.resetDragState();
        this.node.angle = math.toDegree(Math.atan2(-localDirection.x, localDirection.y));
        this.syncCollider();
        this.changeState<XSpearFlyingState>(XSpearStateId.Flying, [this.getAnim(XSpearStateId.Flying)]);
    }

    public prepareCloneInitFrom(source: XSpear, direction: Vec2): void {
        if (!source || direction.lengthSqr() <= 0.0001) {
            return;
        }

        const normalizedDirection = direction.clone().normalize();
        this._board = source._board;
        const localDirection = this.getLocalDirectionFromBoard(normalizedDirection);
        this._map = {
            [XSpearStateId.Idle]: source._map[XSpearStateId.Idle],
            [XSpearStateId.Charging]: source._map[XSpearStateId.Charging],
            [XSpearStateId.Flying]: source._map[XSpearStateId.Flying],
        };
        this._pinnedEdgeNormal.set(source._pinnedEdgeNormal.x, source._pinnedEdgeNormal.y);
        this._stuckUpDirection.set(source._stuckUpDirection.x, source._stuckUpDirection.y);
        this._chargeDir.set(localDirection.x, localDirection.y);
        this._flyDirection.set(normalizedDirection.x, normalizedDirection.y);
        this.beginFlightMotion();
        this._pendingInitStateId = source.state;
        this._skipInitializeStateFromPoseOnInit = true;
        this._didInitializeState = true;
        this.resetDragState();
        this.node.angle = math.toDegree(Math.atan2(-localDirection.x, localDirection.y));
        this.syncCollider();
    }

    protected enterState(stateId: XSpearStateId, enterArgs: any[] = []): void {
        if (this.state !== stateId) {
            this.changeState(stateId, enterArgs);
            return;
        }

        this._stateMachine.cstate?.exit(this);
        this._stateMachine.cstate?.enter(this, ...enterArgs);
    }

    public updateLaser(): void {
        const origin = this.getHeadPosition();
        const direction = this.getBoardDirection(this._chargeDir.lengthSqr() > 0.0001 ? this._chargeDir : this.getLocalUp());
        const path = XGameBridge.get()?.castLaserPath(origin, direction);
        if (!path) {
            this.clearLaser();
            this.clearLaserTarget();
            return;
        }

        const nextTargets = new Set(path.enemies);
        for (const target of this._laserTargets) {
            if (!nextTargets.has(target)) target.clearScare();
        }
        this._laserTargets.clear();
        for (const target of nextTargets) {
            this._laserTargets.add(target);
            target.enterScare();
        }

        this.drawLaserPath(path.segments.map(segment => ({
            from: segment.from, to: segment.to,
            color: segment.enemies.length > 0 ? Color.GREEN : Color.RED,
        })));
    }

    public clearLaser(): void {
        if (!this.laserGraphic) {
            return;
        }

        this.laserGraphic.clear();
    }

    public clearLaserTarget(): void {
        for (const target of this._laserTargets) target.clearScare();
        this._laserTargets.clear();
    }

    public updateFlying(dt: number): Collider2D | null | undefined {
        if (!this._board) {
            return undefined;
        }

        var previousHeadWorld = this.getHeadWorldPosition();
        var previousHeadBoard = this._board.toBoardPoint(previousHeadWorld);
        var previousWallContact = this._board.toBoardPoint(this.getWallContactWorldPosition());
        this._flightHitSegments = [{ from: this.getPinnedBoardPosition(), to: previousHeadBoard }];
        this._board.updateBounds();
        if (!this._board.containsPoint(previousWallContact)) {
            var edgePoint = this._board.clampPoint(previousWallContact);
            var inward = new Vec2(-edgePoint.x, -edgePoint.y);
            if (edgePoint.x <= this._board.minX) inward.set(1, 0);
            else if (edgePoint.x >= this._board.maxX) inward.set(-1, 0);
            else if (edgePoint.y <= this._board.minY) inward.set(0, 1);
            else inward.set(0, -1);
            this.pinToEdge(edgePoint, inward);
            this.spawnWallImpact(edgePoint, inward);
            if (this.onPinned) this.onPinned();
            return null;
        }
        var moveDistance = this.getFlightMoveDistance(dt);
        var runtime = XGameBridge.get();
        var reflectionHitAhead = runtime ? runtime.findReflectionHitForDirection(previousHeadBoard, this._flyDirection, moveDistance + 0.0001) : null;
        // Sweep the rendered tip before moving so this frame cannot cross the wall.
        var wallHitAhead = this.getWallHitForDirection(previousWallContact, this._flyDirection, moveDistance + 0.0001);

        var firstHitKind: "reflection" | "wall" | null = null;
        var firstHitDistance = moveDistance;
        if (reflectionHitAhead && reflectionHitAhead.distance <= firstHitDistance) {
            firstHitKind = "reflection";
            firstHitDistance = reflectionHitAhead.distance;
        }
        if (wallHitAhead && wallHitAhead.distance <= firstHitDistance) {
            firstHitKind = "wall";
            firstHitDistance = wallHitAhead.distance;
        }
        var travelDistance = Math.max(0, Math.min(moveDistance, firstHitDistance));

        var boardPosition = this.getPinnedBoardPosition();
        boardPosition.add(this._flyDirection.clone().multiplyScalar(travelDistance));
        var parentPosition = this._board.toNodePoint(boardPosition, this.node.parent);
        this.node.setPosition(parentPosition.x, parentPosition.y, parentPosition.z);
        this.syncCollider();
        this._previousHeadWorldPosition.set(previousHeadWorld.x, previousHeadWorld.y, previousHeadWorld.z);
        // Keep the starting shaft so nearby enemies still hit after a large frame step.
        this._flightHitSegments.push(
            { from: previousHeadBoard, to: this.getHeadPosition() },
            { from: this.getPinnedBoardPosition(), to: this.getHeadPosition() },
        );
        if (runtime) runtime.tryCloneSpear(this);
        if (firstHitKind === "reflection" && reflectionHitAhead) {
            this.reflectFlightDirection(reflectionHitAhead.point, reflectionHitAhead.normal);
            return undefined;
        }

        if (firstHitKind === "wall" && wallHitAhead) {
            this.pinAtWallHit(wallHitAhead.point, wallHitAhead.normal);
            return null;
        }

        return undefined;
    }

    public getFlightHitSegments(): Array<{ from: Vec2; to: Vec2 }> {
        return this._flightHitSegments;
    }

    public checkCollisionWithCircle(center: Vec2, radius: number): boolean {
        const p1 = this.getPinnedBoardPosition();
        const p2 = this.getHeadPosition();
        return this.pointToSegmentDistance(center, p1, p2) <= radius;
    }

    public intersectsCollider(collider: Collider2D | null): boolean {
        if (!collider?.enabledInHierarchy) {
            return false;
        }

        const rect = this.getColliderBoardRect(collider);
        if (this.segmentIntersectsRect(this.getPinnedBoardPosition(), this.getHeadPosition(), rect)) {
            return true;
        }

        const previousHeadBoard = this._board.toBoardPoint(this._previousHeadWorldPosition);
        const currentHeadBoard = this.getHeadPosition();
        return this.segmentIntersectsRect(previousHeadBoard, currentHeadBoard, rect);
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
            this._flightHitSegments = [{ from: this.getPinnedBoardPosition(), to: this.getHeadPosition() }];
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

        const clamped = this.clampAimDirection(direction.normalize());
        if (!this.isDirectionBlockedByWall(clamped)) this.applyAimDirection(clamped);
    }

    protected beginDrag(touchPos: Vec2): void {
        this._dragTouchStart.set(touchPos.x, touchPos.y);
        const headWorld = this.getHeadWorldPosition();
        const freeEnd = this.node.parent
            ? this.node.parent.inverseTransformPoint(new Vec3(), headWorld) : headWorld;
        this._dragFreeEndStart.set(freeEnd.x, freeEnd.y);
    }

    protected resetDragState(): void {
        this._dragTouchStart.set(0, 0);
        this._dragFreeEndStart.set(0, 0);
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
        this._flightElapsed = 0;
    }

    protected getFlightMoveDistance(dt: number): number {
        var previousTime = this._flightElapsed;
        this._flightElapsed += Math.max(0, dt);
        // Integrate the speed curve so the same flight travels the same distance at any FPS.
        return Math.max(0, this.flySpeed) * (this.integrateFlightSpeedScale(this._flightElapsed)
            - this.integrateFlightSpeedScale(previousTime));
    }

    protected evaluateFlightSpeedScale(elapsed: number): number {
        var duration = Math.max(0, this.flightAccelerationDuration);
        if (duration <= 0) return 1;
        var ratio = math.clamp01(this.flightInitialSpeedRatio);
        var progress = math.clamp01(elapsed / duration);
        return math.lerp(ratio, 1, Math.pow(progress, Math.max(1, this.flightAccelerationPower)));
    }

    protected integrateFlightSpeedScale(elapsed: number): number {
        var time = Math.max(0, elapsed);
        var duration = Math.max(0, this.flightAccelerationDuration);
        if (duration <= 0) return time;
        var ratio = math.clamp01(this.flightInitialSpeedRatio);
        var power = Math.max(1, this.flightAccelerationPower);
        var progress = math.clamp01(time / duration);
        return duration * (ratio * progress + (1 - ratio) * Math.pow(progress, power + 1) / (power + 1))
            + Math.max(0, time - duration);
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

    protected getBoardDirection(direction: Vec2): Vec2 {
        if (!this._board) return direction.clone().normalize();
        const pinned = this.getPinnedPosition();
        const target = this._board.fromNodePoint(
            new Vec2(pinned.x + direction.x, pinned.y + direction.y), this.node.parent);
        return target.subtract(this.getPinnedBoardPosition()).normalize();
    }

    protected clampAimDirection(direction: Vec2): Vec2 {
        const normal = this._pinnedEdgeNormal.clone().normalize();
        const boardDirection = this.getBoardDirection(direction);
        let angle = Math.atan2(normal.x * boardDirection.y - normal.y * boardDirection.x,
            Vec2.dot(normal, boardDirection));
        const limit = math.toRadian(90 - math.clamp(this.aimAngleMargin, 0, 90));
        let minAngle = -limit, maxAngle = limit;
        for (const contact of this.getAimContactNormals()) {
            const contactAngle = Math.atan2(normal.x * contact.y - normal.y * contact.x, Vec2.dot(normal, contact));
            minAngle = Math.max(minAngle, contactAngle - limit);
            maxAngle = Math.min(maxAngle, contactAngle + limit);
        }
        if (minAngle > maxAngle) return this._chargeDir.clone();
        const current = this.getBoardDirection(this.getLocalUp());
        const currentAngle = math.clamp(Math.atan2(normal.x * current.y - normal.y * current.x,
            Vec2.dot(normal, current)), minAngle, maxAngle);
        // Keep the same rotation branch when a drag crosses the outward direction.
        while (angle - currentAngle > Math.PI) angle -= 2 * Math.PI;
        while (angle - currentAngle < -Math.PI) angle += 2 * Math.PI;
        const targetAngle = math.clamp(angle, minAngle, maxAngle);
        const atAngle = (value: number) => this.getLocalDirectionFromBoard(new Vec2(
            normal.x * Math.cos(value) - normal.y * Math.sin(value),
            normal.x * Math.sin(value) + normal.y * Math.cos(value)));
        const target = atAngle(targetAngle);
        if (!this.isDirectionBlockedByWall(target)) return target;
        let validAngle = currentAngle;
        if (this.isDirectionBlockedByWall(atAngle(validAngle))) validAngle = (minAngle + maxAngle) * 0.5;
        if (this.isDirectionBlockedByWall(atAngle(validAngle))) return this._chargeDir.clone();
        let blockedAngle = targetAngle;
        // Clamp to the wall contact instead of freezing at the last sampled direction.
        for (let step = 0; step < 18; step++) {
            const middle = (validAngle + blockedAngle) * 0.5;
            if (this.isDirectionBlockedByWall(atAngle(middle))) blockedAngle = middle;
            else validAngle = middle;
        }
        return atAngle(validAngle);
    }

    protected getAimContactNormals(): Vec2[] {
        return [this._pinnedEdgeNormal.clone().normalize(),
            ...(this._board?.getAimContactNormals(this.getPinnedBoardPosition()) ?? [])];
    }

    protected isDirectionAngleValid(direction: Vec2): boolean {
        const normalizedDirection = this.getBoardDirection(direction);
        const maxAngleToNormal = math.toRadian(90 - math.clamp(this.aimAngleMargin, 0, 90));
        const minDot = Math.cos(maxAngleToNormal);
        return this.getAimContactNormals().every(normal => Vec2.dot(normalizedDirection, normal) >= minDot - 0.0001);
    }

    protected isDirectionBlockedByWall(direction: Vec2): boolean {
        return this._board?.isAimSegmentBlocked(this.getPinnedBoardPosition(), this.getHeadPositionForDirection(direction)) ?? false;
    }

    protected getHeadPositionForDirection(direction: Vec2): Vec2 {
        const pinned = this.getPinnedPosition();
        const angle = Math.atan2(-direction.x, direction.y);
        const headOffset = this.getHeadLocalOffset();
        // The aiming limit covers the whole shaft even if the laser marker is closer.
        headOffset.y = Math.max(Math.abs(headOffset.y), this.spearLength);
        const visualTransform = this.visual?.getComponent(UITransform);
        if (visualTransform) {
            const tipWorld = Vec3.transformMat4(new Vec3(),
                new Vec3(0, visualTransform.height * (1 - visualTransform.anchorY), 0), this.visual.node.worldMatrix);
            const tipLocal = this.node.inverseTransformPoint(new Vec3(), tipWorld);
            headOffset.y = Math.max(headOffset.y, tipLocal.y);
        }
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = headOffset.x * this.node.scale.x;
        const y = headOffset.y * this.node.scale.y;
        const head = new Vec2(pinned.x + x * cos - y * sin, pinned.y + x * sin + y * cos);
        return this._board ? this._board.fromNodePoint(head, this.node.parent) : head;
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

    protected drawLaserPath(segments: { from: Vec2; to: Vec2; color: Color }[]): void {
        if (!this.laserGraphic) {
            return;
        }

        this.laserGraphic.clear();
        this.laserGraphic.lineWidth = this.laserWidth;
        for (const segment of segments) {
            const fromLocal = this.convertBoardPointToGraphicLocal(segment.from);
            const toLocal = this.convertBoardPointToGraphicLocal(segment.to);
            this.laserGraphic.strokeColor = segment.color;
            this.laserGraphic.moveTo(fromLocal.x, fromLocal.y);
            this.laserGraphic.lineTo(toLocal.x, toLocal.y);
            this.laserGraphic.stroke();
        }
    }

    protected convertBoardPointToGraphicLocal(point: Vec2): Vec2 {
        const boardNode = this._board?.node ?? this.node.parent;
        const graphicNode = this.laserGraphic?.node;
        if (!boardNode || !graphicNode) {
            return point.clone();
        }

        const worldPoint = this._board
            ? this._board.toWorldPoint(point)
            : Vec3.transformMat4(new Vec3(), new Vec3(point.x, point.y, 0), boardNode.worldMatrix);

        const localPoint = graphicNode.inverseTransformPoint(new Vec3(), worldPoint);
        return new Vec2(localPoint.x, localPoint.y);
    }

    protected getWallHitForDirection(origin: Vec2, direction: Vec2, maxDistance: number = Number.POSITIVE_INFINITY): { point: Vec2; normal: Vec2; distance: number } | null {
        if (!this._board || direction.lengthSqr() <= 0.0001) {
            return null;
        }

        const wallHit = this._board.raycastWall(origin, direction, maxDistance);
        const boundaryHit = this._board.raycastBoundary(origin, direction, maxDistance);
        const hit = boundaryHit && (!wallHit || boundaryHit.distance <= wallHit.distance)
            ? boundaryHit : wallHit;
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
        this.spawnWallImpact(point, normal);
        this._pinnedEdgeNormal.set(normal.x, normal.y);
        this.node.angle += 180;
        const parentSpacePoint = this._board.toNodePoint(point, this.node.parent);
        this.node.setPosition(parentSpacePoint.x, parentSpacePoint.y, parentSpacePoint.z);
        this.syncCollider();
        const stuckUp = this.getLocalUp();
        this._stuckUpDirection.set(stuckUp.x, stuckUp.y).normalize();
        this._chargeDir.set(stuckUp.x, stuckUp.y).normalize();
        this.changeState<XSpearIdleState, XSpearFlyingState>(
            XSpearStateId.Idle,
            [this.getAnim(XSpearStateId.Idle)],
            [],
        );
        this.onPinned?.();
    }

    protected spawnWallImpact(point: Vec2, normal: Vec2): void {
        if (this._board && this._wallImpactSmokePool) {
            this._wallImpactSmokePool.playAt(this._board.node, this._board.toWorldPoint(point), normal);
        }
        if (!this._board || !this.node.parent) return;
        const template = this.node.scene?.getChildByName("Canvas")?.getChildByName("Crack");
        const crack = this.crackPrefab ? instantiate(this.crackPrefab) : template ? instantiate(template) : null;
        if (!crack) return;
        crack.active = true;
        crack.setParent(this.node.parent);
        crack.setPosition(this._board.toNodePoint(point, this.node.parent));
        const localNormal = this.getLocalDirectionFromBoard(normal);
        crack.angle = math.toDegree(Math.atan2(-localNormal.x, localNormal.y)) + 90;
        crack.setSiblingIndex(this.node.getSiblingIndex());
    }

    protected getLocalDirectionFromBoard(direction: Vec2): Vec2 {
        if (!this._board) return direction.clone().normalize();
        const origin = this.getPinnedBoardPosition();
        const from = this._board.toNodePoint(origin, this.node.parent);
        const to = this._board.toNodePoint(origin.add(direction), this.node.parent);
        return new Vec2(to.x - from.x, to.y - from.y).normalize();
    }

    protected reflectFlightDirection(hitPoint: Vec2, normal: Vec2): void {
        const reflectedDirection = ReflectionSpear.reflectDirection(this._flyDirection, normal);
        this._flyDirection.set(reflectedDirection.x, reflectedDirection.y);
        const localDirection = this.getLocalDirectionFromBoard(reflectedDirection);
        this._chargeDir.set(localDirection.x, localDirection.y);
        this.node.angle = math.toDegree(Math.atan2(-localDirection.x, localDirection.y));

        // The impact end becomes the tail. Keeping the new head at the mirror would
        // teleport the shaft through it and hit enemies on the opposite side.
        const pushedTailBoard = hitPoint.clone().add(reflectedDirection.clone().multiplyScalar(0.5));
        this.node.setPosition(this._board.toNodePoint(pushedTailBoard, this.node.parent));
        this.syncCollider();
    }
}
