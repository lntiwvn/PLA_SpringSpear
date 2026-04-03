import { _decorator, Collider2D, Component, IVec2Like, RigidBody2D, UITransform, Vec2, Vec3, sp, v2, v3 } from "cc";
import { IState } from "./IState";
import { PhysicManager } from "./PhysicManager";
import { StateEnterArgs, StateExitArgs } from "./State";
import { StateMachine } from "./StateMachine";
import { XEnemyDeadState } from "./XEnemyDeadState";
import { XEnemyFallingState } from "./XEnemyFallingState";
import { XEnemyIdleState } from "./XEnemyIdleState";
import { XEnemyMovingState } from "./XEnemyMovingState";
import { XEnemyScareState } from "./XEnemyScareState";
import { AnimSelector } from "./AnimSelector";
import { Enum } from "cc";
import { EDITOR } from "cc/env";
import XGameBridge, { XEnemySplitKind } from "./XGameBridge";
import { ERigidBody2DType } from "cc";
import { ParticleSystem } from "cc";
import { AudioSource } from "cc";
const { ccclass, property, executeInEditMode } = _decorator;

type XEnemySplitPiece = {
    body: RigidBody2D;
    localPosition: Vec3;
    localAngle: number;
};

export enum XEnemyStateId {
    Idle = 0,
    Falling,
    Dead,
    Moving,
    Scare,
}

Enum(XEnemyStateId);

@ccclass("XEnemy")
@executeInEditMode()
export class XEnemy extends Component {
    @property({ type: XEnemyStateId })
    startState: XEnemyStateId = XEnemyStateId.Moving
    @property({ type: sp.Skeleton })
    protected _visual: sp.Skeleton = null;
    @property({ type: sp.Skeleton, tooltip: "Spine skeleton used as the enemy visual." })
    get visual(): sp.Skeleton { return this._visual }
    set visual(x) {
        if(!x ||  this._visual === x) return;
        this._visual = x;
        this.onFocusInEditor()
    }

    @property([ParticleSystem])
    bloods: ParticleSystem[] = [] 

    @property(AudioSource)
    deadAu: AudioSource = null

    @property(AudioSource)
    scareAu: AudioSource = null

    @property(AudioSource)
    balloonPop: AudioSource = null

    @property([ParticleSystem])
    baloonPopPart: ParticleSystem[] = [] 

    onFocusInEditor(): void {
        const _att = Object.keys(XEnemyStateId).filter((_key) => Number.isNaN(Number(_key)));
        const _es = _att.map((_a) => ({ name: _a, value: XEnemyStateId[_a] }))
        if(this.selectors.length >= _att.length) {
            this.selectors.length = _att.length;
            this.selectors.forEach(_s => _s.editor(this._visual, _es))
            return;
        }

        _att.forEach((_, i) => this.selectors[i] = AnimSelector.create(i, this._visual, _es))
    }

    @property([AnimSelector])
    selectors: AnimSelector<XEnemyStateId>[] = []

    @property(Collider2D)
    public bodyCollider: Collider2D = null;

    @property(Collider2D)
    public balloonCollider: Collider2D = null;

    @property(Collider2D)
    public legCollider: Collider2D = null;

    @property(RigidBody2D)
    public splitTopNode: RigidBody2D = null;

    @property(RigidBody2D)
    public splitBottomNode: RigidBody2D = null;

    @property(RigidBody2D)
    public splitLeftNode: RigidBody2D = null;

    @property(RigidBody2D)
    public splitRightNode: RigidBody2D = null;

    @property({ tooltip: "Movement speed in pixels per second while looping between start and target." })
    public moveSpeed: number = 150;

    @property({ tooltip: "Horizontal speed applied to split pieces." })
    public splitSpeedX: number = 300;

    @property({ tooltip: "Initial vertical speed applied to split pieces." })
    public splitSpeedY: number = 400;

    @property(UITransform)
    public targetPos: UITransform = null;

    protected readonly _stateMachine: StateMachine<XEnemyStateId, XEnemy> = new StateMachine();
    protected readonly _fallVelocity: Vec2 = new Vec2();
    protected _startPosition: Vec3 = new Vec3();
    protected _moveTargetPosition: Vec3 = new Vec3();
    protected _moveProgress: number = 0;
    protected _moveDirection: 1 | -1 = 1;
    protected _moveDistance: number = 0;
    protected _splitPieces: XEnemySplitPiece[] = [];
    protected _pendingSplitKind: XEnemySplitKind = "vertical";
    protected _pendingHitDirection: Vec2 = new Vec2(0, 1);
    protected _stateBeforeScare: XEnemyStateId = XEnemyStateId.Idle;
    protected _map: Record<XEnemyStateId, string> = {
        [XEnemyStateId.Idle]: "",
        [XEnemyStateId.Falling]: "",
        [XEnemyStateId.Dead]: "",
        [XEnemyStateId.Moving]: "",
        [XEnemyStateId.Scare]: "",
    }

    public get stateMachine(): StateMachine<XEnemyStateId, XEnemy> {
        return this._stateMachine;
    }

    public get gravity(): Vec2 {
        const manager = PhysicManager.instance;
        if (!manager) {
            return v2(0, -980);
        }

        return manager.gravity;
    }

    public get fallVelocity(): Vec2 {
        return this._fallVelocity;
    }

    protected onLoad(): void {
        if(EDITOR) {
            this.onFocusInEditor()
        }

        if (!this.visual) {
            this.visual = this.getComponentInChildren(sp.Skeleton);
        }
        this._map = this.selectors.reduce((_c, _b) => { _c[_b.id] = _b.anim; return _c }, {  } as Record<XEnemyStateId, string>)
        !EDITOR && delete this.selectors;

        this._startPosition = this.node.getPosition().clone();
        this._moveTargetPosition = this._startPosition.clone();
        this.cacheSplitPieces();
        this.resetSplitState();

        this._stateMachine
            .add(XEnemyStateId.Idle, new XEnemyIdleState())
            .add(XEnemyStateId.Falling, new XEnemyFallingState())
            .add(XEnemyStateId.Moving, new XEnemyMovingState())
            .add(XEnemyStateId.Dead, new XEnemyDeadState())
            .add(XEnemyStateId.Scare, new XEnemyScareState());
    }

    protected start(): void {
        switch (this.startState) {
            case XEnemyStateId.Falling:
                this.enterFalling();
                break;
            case XEnemyStateId.Dead:
                this.enterDead();
                break;
            case XEnemyStateId.Moving:
                this.enterMoving();
                break;
            case XEnemyStateId.Scare:
                this.enterScare();
                break;
            case XEnemyStateId.Idle:
            default:
                this.enterIdle();
                break;
        }
    }

    getAnim(what: XEnemyStateId) {
        return this._map[what]
    }

    protected update(dt: number): void {
        if(EDITOR) return
        this._stateMachine.update(this, dt);
    }

    public playAnimation(animationName: string, loop: boolean): void {
        if (!this.visual || !animationName) {
            return;
        }

        this.visual.setAnimation(0, animationName, loop);
    }

    public resetFallVelocity(): void {
        this._fallVelocity.set(0, 0);
    }

    public resetMoveState(): void {
        this._moveProgress = 0;
        this._moveDirection = 1;
        this._moveDistance = 0;
        this._startPosition = this.node.getPosition().clone();
        this._moveTargetPosition = this._startPosition.clone();
    }

    public hideDefaultVisuals(): void {
        if (this.visual) {
            this.visual.node.active = false;
        }

        this.setBodyColliderEnabled(false);
        this.setBalloonColliderEnabled(false);
    }

    public resetSplitState(): void {
        for (const piece of this._splitPieces) {
            piece.body.node.active = false;
            piece.body.node.setPosition(piece.localPosition);
            piece.body.node.angle = piece.localAngle;
            piece.body.linearVelocity = v2();
            piece.body.angularVelocity = 0;
        }
    }

    protected cacheSplitPieces(): void {
        const bodies = [
            this.splitTopNode,
            this.splitBottomNode,
            this.splitLeftNode,
            this.splitRightNode,
        ].filter((_body): _body is RigidBody2D => !!_body);

        this._splitPieces = bodies.map((_body) => ({
            body: _body,
            localPosition: _body.node.position.clone(),
            localAngle: _body.node.angle,
        }));
    }

    protected getSplitPiecesForKind(splitKind: XEnemySplitKind): XEnemySplitPiece[] {
        if (splitKind === "vertical") {
            return this._splitPieces.filter((_piece) => _piece.body === this.splitLeftNode || _piece.body === this.splitRightNode);
        }

        return this._splitPieces.filter((_piece) => _piece.body === this.splitTopNode || _piece.body === this.splitBottomNode);
    }

    public prepareSplit(splitKind: XEnemySplitKind, hitDirection: Vec2): void {
        this._pendingSplitKind = splitKind;
        this._pendingHitDirection.set(hitDirection.x, hitDirection.y).normalize();
    }

    public beginSplit(): boolean {
        const activePieces = this.getSplitPiecesForKind(this._pendingSplitKind);
        if (activePieces.length <= 0) {
            return false;
        }

        this.hideDefaultVisuals();
        this.resetSplitState();

        const normalizedHit = this._pendingHitDirection.clone().normalize();
        const isVertical = this._pendingSplitKind === "vertical";
        const splitBias = isVertical ? new Vec2(this.splitSpeedX, this.splitSpeedY * 0.3) : new Vec2(this.splitSpeedX * 0.3, this.splitSpeedY);

        for (const piece of activePieces) {
            const outward = this.getSplitPieceOutward(piece.body);
            const linearVelocity = new Vec2(
                normalizedHit.x * this.splitSpeedX * 0.6 + outward.x * splitBias.x,
                Math.max(0, normalizedHit.y) * this.splitSpeedY * 0.35 + splitBias.y + outward.y * splitBias.y,
            );

            piece.body.node.active = true;
            piece.body.type = ERigidBody2DType.Dynamic
            const mass = piece.body.getMass();
            piece.body.linearVelocity = linearVelocity;
            piece.body.angularVelocity = 180 * (outward.x !== 0 ? -outward.x : outward.y || 1);
            piece.body.applyForceToCenter(new Vec2(
                linearVelocity.x * mass,
                linearVelocity.y * mass,
            ), true);
        }

        return true;
    }

    protected getSplitPieceOutward(body: RigidBody2D): Vec2 {
        if (body === this.splitLeftNode) {
            return new Vec2(-1, 0);
        }

        if (body === this.splitRightNode) {
            return new Vec2(1, 0);
        }

        if (body === this.splitTopNode) {
            return new Vec2(0, 1);
        }

        return new Vec2(0, -1);
    }

    public beginMoveLoop(targetPosition: IVec2Like): void {
        this._startPosition = this.node.getPosition().clone();
        this._moveTargetPosition = v3(targetPosition.x, targetPosition.y, this._startPosition.z);
        this._moveProgress = 0;
        this._moveDirection = 1;
        this._moveDistance = Vec2.distance(
            v2(this._startPosition.x, this._startPosition.y),
            v2(this._moveTargetPosition.x, this._moveTargetPosition.y),
        );
    }

    public updateMoveLoop(dt: number): void {
        if (this._moveDistance <= 0 || this.moveSpeed <= 0) {
            return;
        }

        this._moveProgress += (this.moveSpeed * dt / this._moveDistance) * this._moveDirection;

        if (this._moveProgress >= 1) {
            this._moveProgress = 1;
            this._moveDirection = -1;
        } else if (this._moveProgress <= 0) {
            this._moveProgress = 0;
            this._moveDirection = 1;
        }

        const nextPosition = new Vec3();
        Vec3.lerp(nextPosition, this._startPosition, this._moveTargetPosition, this._moveProgress);
        this.node.setPosition(nextPosition);
        this.syncColliders();
    }

    public resolveMoveTargetPosition(targetPosition?: IVec2Like | null): Vec3 {
        if (targetPosition) {
            return v3(targetPosition.x, targetPosition.y, this.node.position.z);
        }

        if (!this.targetPos) {
            return this.node.getPosition().clone();
        }

        const worldPosition = this.targetPos.node.worldPosition;
        if (!this.node.parent) {
            return v3(worldPosition.x, worldPosition.y, this.node.position.z);
        }

        const localPosition = this.node.parent.inverseTransformPoint(new Vec3(), worldPosition);
        return v3(localPosition.x, localPosition.y, this.node.position.z);
    }

    public isOnGround(): boolean {
        return !!this.getGroundCollider();
    }

    public landOnGround(groundCollider?: Collider2D | null): void {
        const resolvedGroundCollider = groundCollider ?? this.getGroundCollider();
        if (resolvedGroundCollider) {
            const position = this.node.getPosition();
            const legRect = this.getLegColliderRect();
            const groundRect = resolvedGroundCollider.worldAABB;
            const legBottom = legRect ? legRect.yMin : this.getLegColliderBottomWorldY();
            const groundTop = groundRect.yMax;
            this.node.setPosition(position.x, position.y + (groundTop - legBottom), position.z);
            this.syncColliders();
        }

        this.resetFallVelocity();
        this.enterIdle();
    }

    protected getLandingOffsetY(): number {
        if (this.legCollider) {
            return this.legCollider.node.position.y;
        }

        const uiTransform = this.getComponent(UITransform) ?? this.visual?.getComponent(UITransform);
        if (!uiTransform) {
            return 0;
        }

        return -uiTransform.height * uiTransform.anchorY;
    }

    public getLegColliderBottomWorldY(): number {
        const collider = this.getLegCollider();
        if (collider?.worldAABB) {
            return collider.worldAABB.yMin;
        }

        const worldPosition = this.node.worldPosition;
        return worldPosition.y + this.getLandingOffsetY();
    }

    public getGroundCollider(): Collider2D | null {
        return XGameBridge.get()?.findGroundColliderForEnemy(this) ?? null;
    }

    public changeState<
        _TEnter extends IState<XEnemy, any[], any[]> = IState<XEnemy, any[], any[]>,
        _TExit extends IState<XEnemy, any[], any[]> = IState<XEnemy, any[], any[]>,
    >(
        stateId: XEnemyStateId,
        enterArgs: StateEnterArgs<_TEnter> = [] as unknown as StateEnterArgs<_TEnter>,
        exitArgs: StateExitArgs<_TExit> = [] as unknown as StateExitArgs<_TExit>,
    ): boolean {
        return this._stateMachine.change<_TEnter, _TExit>(stateId, this, enterArgs, exitArgs);
    }

    public enterIdle(): boolean {
        this.scareAu?.stop();
        this.setBodyColliderEnabled(true);
        this.setBalloonColliderEnabled(this.isBalloonAvailable());
        return this.changeState<XEnemyIdleState>(XEnemyStateId.Idle, [this.getAnim(XEnemyStateId.Idle)]);
    }

    public enterFalling(): boolean {
        this.hideBalloon();
        this.setBodyColliderEnabled(true);
        this.setBalloonColliderEnabled(false);
        return this.changeState<XEnemyFallingState>(XEnemyStateId.Falling, [this.getAnim(XEnemyStateId.Falling)]);
    }

    public enterMoving(targetPosition?: IVec2Like | null): boolean {
        const resolvedTarget = this.resolveMoveTargetPosition(targetPosition);
        this.setBodyColliderEnabled(true);
        this.setBalloonColliderEnabled(this.isBalloonAvailable());
        return this.changeState<XEnemyMovingState>(XEnemyStateId.Moving, [this.getAnim(XEnemyStateId.Moving), resolvedTarget]);
    }

    public enterScare(): boolean {
        if (this.stateMachine.cid === XEnemyStateId.Moving) {
            this._scare();
            return false;
        }

        if (this.stateMachine.cid !== XEnemyStateId.Idle) {
            return false;
        }

        this._stateBeforeScare = this.stateMachine.cid ?? XEnemyStateId.Idle;
        this._scare();
        this.setBodyColliderEnabled(true);
        this.setBalloonColliderEnabled(this.isBalloonAvailable());
        return this.changeState<XEnemyScareState>(XEnemyStateId.Scare, [this.getAnim(XEnemyStateId.Scare)]);
    }

    protected _scare() {
        if(!this.scareAu) return;

        if (!this.scareAu.playing) {
            this.scareAu.play()
        }
    }

    public clearScare(): boolean {
        if (this.stateMachine.cid === XEnemyStateId.Moving) {
            this.scareAu?.stop();
            return false;
        }

        if (this.stateMachine.cid !== XEnemyStateId.Scare) {
            return false;
        }

        if (this._stateBeforeScare === XEnemyStateId.Moving) {
            return this.enterMoving();
        }

        return this.enterIdle();
    }

    public enterDead(splitKind?: XEnemySplitKind, hitDirection?: Vec2): boolean {
        if (this.stateMachine.cid === XEnemyStateId.Dead) {
            return false;
        }

        this.setBodyColliderEnabled(false);
        this.setBalloonColliderEnabled(false);
        this.hideBalloon();

        if (splitKind && hitDirection) {
            this.prepareSplit(splitKind, hitDirection);
        }
        return this.changeState<XEnemyDeadState>(XEnemyStateId.Dead, [this.getAnim(XEnemyStateId.Dead), this.bloods, this.deadAu]);
    }

    public getBodyCollider(): Collider2D | null {
        return this.bodyCollider;
    }

    public getBalloonCollider(): Collider2D | null {
        return this.balloonCollider;
    }

    public setBodyColliderEnabled(value: boolean): void {
        const collider = this.getBodyCollider();
        if (collider) {
            collider.enabled = value;
            collider.apply();
        }
    }

    public setBalloonColliderEnabled(value: boolean): void {
        const collider = this.getBalloonCollider();
        if (collider) {
            collider.enabled = value;
            collider.apply();
        }
    }

    public getLegCollider(): Collider2D | null {
        return this.legCollider;
    }

    public getLegColliderRect(): { xMin: number; yMin: number; xMax: number; yMax: number } | null {
        const collider = this.getLegCollider();
        return collider?.worldAABB ?? null;
    }

    public syncColliders(): void {
        this.getBodyCollider()?.apply();
        this.getBalloonCollider()?.apply();
        this.getLegCollider()?.apply();
    }

    public isBalloonAvailable(): boolean {
        return !!this.balloonCollider?.node.active;
    }

    public hideBalloon(): void {
        if (this.balloonCollider?.node) {
            this.balloonCollider.node.active = false;
            if(this.balloonCollider.node.active) {
                this.balloonPop?.play();
                this.baloonPopPart.forEach(_ => _?.play())
            }
        }
    }
}
