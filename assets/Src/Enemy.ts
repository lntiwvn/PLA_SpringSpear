import { _decorator, sp, Component, Node } from 'cc';
import { GameBoard } from './GameBoard';
import { CollisionZone } from './CollisionZone';
const { ccclass, property } = _decorator;

interface SplitPiece {
    node: Node;
    velX: number;
    velY: number;
}

@ccclass('Enemy')
export class Enemy extends Component {

    @property(Node)
    public enemyVisualNode: Node = null;

    @property(Node)
    public balloonNode: Node = null;

    @property(CollisionZone)
    public bodyZone: CollisionZone = null;

    @property(CollisionZone)
    public balloonZone: CollisionZone = null;

    @property({ type: Node, tooltip: 'Nửa trái của enemy khi bị chẻ' })
    public splitLeftNode: Node = null;

    @property({ type: Node, tooltip: 'Nửa phải của enemy khi bị chẻ' })
    public splitRightNode: Node = null;

    @property({ tooltip: 'Biên độ bob lên xuống của cả enemy (pixel)' })
    public bobAmplitude: number = 50;

    @property({ tooltip: 'Tốc độ bob lên xuống (rad/s)' })
    public bobSpeed: number = 3;

    @property({ tooltip: 'Gia tốc rơi khi bị bắn balloon (pixel/s²)' })
    public fallGravity: number = 1500;

    @property({ tooltip: 'Tốc độ văng ngang của 2 mảnh (pixel/s)' })
    public splitSpeedX: number = 300;

    @property({ tooltip: 'Tốc độ bay lên ban đầu của 2 mảnh (pixel/s)' })
    public splitSpeedY: number = 400;

    private _board: GameBoard = null;
    private _isDead: boolean = false;
    private _bobTime: number = 0;
    private _baseY: number = 0;
    private _isFalling: boolean = false;
    private _fallSpeed: number = 0;
    private _isBobbing: boolean = true;
    private _isSplitting: boolean = false;
    private _splitPieces: SplitPiece[] = [];

    public get isDead(): boolean { return this._isDead; }
    protected _sp: sp.Skeleton = null;

    protected onLoad(): void {
        this._sp = this.enemyVisualNode.getComponent(sp.Skeleton);
    }

    static get Events() {
        return { onDead: "onDead" }
    }

    public init(board: GameBoard) {
        this._board = board;
        this._isDead = false;
        this._isFalling = false;
        this._isBobbing = true;
        this._isSplitting = false;
        this._fallSpeed = 0;
        this._bobTime = Math.random() * Math.PI * 2;

        const pos = this.node.getPosition();
        this._baseY = pos.y;

        if (this.splitLeftNode) this.splitLeftNode.active = false;
        if (this.splitRightNode) this.splitRightNode.active = false;
    }

    update(deltaTime: number) {
        if (!this._board) return;

        if (this._isSplitting) {
            this.updateSplit(deltaTime);
            return;
        }

        if (this._isDead) return;

        if (this._isFalling) {
            this.updateFalling(deltaTime);
            return;
        }

        // Bob lên xuống
        if (this._isBobbing) {
            this._bobTime += deltaTime * this.bobSpeed;
            const bobY = this._baseY + Math.sin(this._bobTime) * this.bobAmplitude;

            const pos = this.node.getPosition();
            this.node.setPosition(pos.x, bobY, 0);
        }
    }

    private updateFalling(deltaTime: number) {
        this._fallSpeed += this.fallGravity * deltaTime;
        const pos = this.node.getPosition();
        let newY = pos.y - this._fallSpeed * deltaTime;

        if (newY <= this._board.minY) {
            newY = this._board.minY;
            this._isFalling = false;
        }

        this.node.setPosition(pos.x, newY, 0);
    }

    private updateSplit(deltaTime: number) {
        let allDone = true;

        for (const piece of this._splitPieces) {
            if (!piece.node.active) continue;

            const pos = piece.node.getPosition();
            piece.velY -= this.fallGravity * deltaTime;
            let newX = pos.x + piece.velX * deltaTime;

            let newY = pos.y + piece.velY * deltaTime;

            // Clamp X trong board
            newX = Math.max(this._board.minX, Math.min(this._board.maxX, newX));

            // Chạm đáy board → dừng mảnh này
            if (newY <= this._board.minY) {
                newY = this._board.minY;
                piece.velX = 0;
                piece.velY = 0;
            }

            piece.node.setPosition(newX, newY, 0);
            if (piece.velX !== 0 || piece.velY !== 0) {
                allDone = false;
            }
        }

        if (allDone) {
            this._isSplitting = false;
        }
    }

    /** Bắn trúng enemy body → chẻ 2 mảnh văng parabol 2 bên */
    public hitBody() {
        this._isDead = true;

        // Vị trí enemy hiện tại trong board-space
        const enemyPos = this.node.getPosition();
        const boardNode = this.node.parent;

        // Ẩn visual gốc + balloon + zones
        if (this.enemyVisualNode) this.enemyVisualNode.active = false;
        if (this.balloonNode) this.balloonNode.active = false;
        if (this.bodyZone) this.bodyZone.node.active = false;
        if (this.balloonZone) this.balloonZone.node.active = false;

        // Reparent 2 mảnh sang board node, đặt tại vị trí enemy
        this._splitPieces = [];

        if (this.splitLeftNode) {
            this.splitLeftNode.setParent(boardNode);
            this.splitLeftNode.setPosition(enemyPos.x, enemyPos.y, 0);
            this.splitLeftNode.active = true;
            this._splitPieces.push({
                node: this.splitLeftNode,
                velX: -this.splitSpeedX,
                velY: this.splitSpeedY,
            });
        }

        if (this.splitRightNode) {
            this.splitRightNode.setParent(boardNode);
            this.splitRightNode.setPosition(enemyPos.x, enemyPos.y, 0);
            this.splitRightNode.active = true;
            this._splitPieces.push({
                node: this.splitRightNode,
                velX: this.splitSpeedX,
                velY: this.splitSpeedY,
            });
        }

        this._isSplitting = true;
    }

    /** Bắn trúng balloon → balloon biến mất, enemy rơi xuống */
    public hitBalloon() {
        if (this.balloonNode) {
            this.balloonNode.active = false;
        }
        if (this.balloonZone) this.balloonZone.node.active = false;
        this._isFalling = true;
        this._isBobbing = false;
        this._fallSpeed = 0;
        this._sp.setAnimation(0, 'Final/idle_fly', true);
    }


}
