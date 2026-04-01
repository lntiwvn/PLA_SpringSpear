import { _decorator, Component, Node, Vec2, Vec3, UITransform, math } from 'cc';
import { CollisionZone } from './CollisionZone';
import { GameBoard } from './GameBoard';
import { sp } from 'cc';
const { ccclass, property } = _decorator;

export enum SpearState {
    IDLE,
    CHARGING,
    FLYING,
}

@ccclass('Spear')
export class Spear extends Component {

    @property
    public spearLength: number = 200;

    @property
    public flySpeed: number = 1500;

    @property({ tooltip: 'Góc tối thiểu so với cạnh board đang ghim (độ)' })
    public minAngleFromEdge: number = 25;

    @property({ tooltip: 'Thời gian play compress khi hold (giây)' })
    public chargePreviewTime: number = 0.2;

    private animSkel: sp.Skeleton = null;
    private _state: SpearState = SpearState.IDLE;
    private _flyDirection: Vec2 = new Vec2();
    private _board: GameBoard = null;
    private _pinnedEdgeNormal: Vec2 = new Vec2(0, 1);
    private _chargeDir: Vec2 = new Vec2();

    public onPinned: () => void = null;

    public get state(): SpearState { return this._state; }

    public init(board: GameBoard) {
        this._board = board;
        this.animSkel = this.node.getComponentInChildren(sp.Skeleton);
    }

    /**
     * Anchor luôn ở tail (bottom) của sprite.
     * node.position = vị trí đầu đang ghim (pinned end).
     * Đầu tự do (free end) = node.position + localUp * spearLength.
     *
     * Khi swap: flip 180° để anchor đổi sang đầu kia,
     * rồi đặt node.position = vị trí ghim mới.
     */

    private getLocalUp(): Vec2 {
        const rad = this.node.angle * Math.PI / 180;
        return new Vec2(-Math.sin(rad), Math.cos(rad));
    }

    /** Vị trí đầu đang ghim (= node.position, vì anchor ở đây) */
    public getPinnedPosition(): Vec2 {
        const pos = this.node.getPosition();
        return new Vec2(pos.x, pos.y);
    }

    /** Vị trí đầu tự do (đầu kia, cách pinned end một spearLength) */
    public getFreeEndPosition(): Vec2 {
        const pinned = this.getPinnedPosition();
        const up = this.getLocalUp();
        return new Vec2(
            pinned.x + up.x * this.spearLength,
            pinned.y + up.y * this.spearLength
        );
    }

    /**
     * Xác định normal của cạnh board tại 1 điểm (hướng vào trong board).
     */
    private detectEdgeNormal(point: Vec2): Vec2 {
        const eps = 2;
        if (Math.abs(point.y - this._board.minY) < eps) return new Vec2(0, 1);   // bottom -> up
        if (Math.abs(point.y - this._board.maxY) < eps) return new Vec2(0, -1);  // top -> down
        if (Math.abs(point.x - this._board.minX) < eps) return new Vec2(1, 0);   // left -> right
        if (Math.abs(point.x - this._board.maxX) < eps) return new Vec2(-1, 0);  // right -> left
        return new Vec2(0, 1); // fallback
    }

    /**
     * Clamp hướng bắn: góc so với cạnh >= minAngleFromEdge.
     * edgeNormal là pháp tuyến hướng vào board.
     * Hướng cạnh vuông góc với normal.
     */
    private clampDirection(direction: Vec2, edgeNormal: Vec2): Vec2 {
        // Góc giữa direction và edge normal
        const dot = direction.x * edgeNormal.x + direction.y * edgeNormal.y;

        // Nếu bắn ngược ra ngoài board (dot <= 0), buộc bắn theo normal
        if (dot <= 0) return edgeNormal.clone();

        // Góc giữa direction và cạnh = 90° - góc với normal
        // angleFromNormal = acos(dot) (direction & normal đều normalized)
        const angleFromNormal = Math.acos(Math.min(1, Math.max(-1, dot)));
        const maxAngleFromNormal = math.toRadian(90 - this.minAngleFromEdge);

        if (angleFromNormal <= maxAngleFromNormal) return direction.clone();

        // Cần clamp: xác định chiều xoay (cross product sign)
        const cross = edgeNormal.x * direction.y - edgeNormal.y * direction.x;
        const sign = cross >= 0 ? 1 : -1;

        // Xoay normal đi maxAngleFromNormal theo chiều sign
        const cos = Math.cos(sign * maxAngleFromNormal);
        const sin = Math.sin(sign * maxAngleFromNormal);
        return new Vec2(
            edgeNormal.x * cos - edgeNormal.y * sin,
            edgeNormal.x * sin + edgeNormal.y * cos
        ).normalize();
    }

    /**
     * Ghim spear lên cạnh board lần đầu.
     * @param edgePoint Điểm trên cạnh board
     * @param inwardDir Hướng từ cạnh vào trong board
     */
    public pinToEdge(edgePoint: Vec2, inwardDir: Vec2) {
        this._state = SpearState.IDLE;
        this._pinnedEdgeNormal = inwardDir.clone().normalize();

        const angleDeg = math.toDegree(Math.atan2(-inwardDir.x, inwardDir.y));
        this.node.angle = angleDeg;

        this.node.setPosition(edgePoint.x, edgePoint.y, 0);

        if (this.animSkel) {
            this.animSkel.setAnimation(0, 'IDle2', true);
        }
    }

    /**
     * Touch start: bắt đầu xoay spear theo touch.
     */
    public startCharge(touchPos: Vec2) {
        if (this._state !== SpearState.IDLE || !this._board) return;

        this._state = SpearState.CHARGING;

        if (this.animSkel) {
            this.animSkel.setAnimation(0, 'IDle', true);
        }

        this.aimAt(touchPos);
    }

    /**
     * Touch move: xoay spear theo ngón tay (kim đồng hồ, neo tại pinned point).
     */
    public aimAt(touchPos: Vec2) {
        if (this._state !== SpearState.CHARGING) return;

        const pinnedPos = this.getPinnedPosition();
        let direction = touchPos.clone().subtract(pinnedPos).normalize();
        if (direction.lengthSqr() < 0.0001) return;

        direction = this.clampDirection(direction, this._pinnedEdgeNormal);
        this._chargeDir = direction;

        const angleDeg = math.toDegree(Math.atan2(-direction.x, direction.y));
        this.node.angle = angleDeg;
    }

    /**
     * Touch end: play Compress full rồi bắn.
     */
    public release() {
        if (this._state !== SpearState.CHARGING || !this._board) return;

        if (this.animSkel) {
            this.animSkel.setAnimation(0, 'Compress', false);
            this.animSkel.setCompleteListener(() => {
                this.animSkel.setCompleteListener(null);
                this.doShoot();
            });
        } else {
            this.doShoot();
        }
    }

    private doShoot() {
        this._flyDirection = this._chargeDir;
        this._state = SpearState.FLYING;

        if (this.animSkel) {
            this.animSkel.setAnimation(0, 'IDle2', true);
        }
    }

    update(deltaTime: number) {
        if (this._state !== SpearState.FLYING || !this._board) return;

        // Di chuyển cả thanh
        const moveDistance = this.flySpeed * deltaTime;
        const pos = this.node.getPosition();
        this.node.setPosition(
            pos.x + this._flyDirection.x * moveDistance,
            pos.y + this._flyDirection.y * moveDistance,
            0
        );

        // Kiểm tra đầu tự do (free end) chạm cạnh board chưa
        const freeEnd = this.getFreeEndPosition();

        if (!this._board.containsPoint(freeEnd)) {
            // Clamp free end vào cạnh board
            const clampedFreeEnd = this._board.clampPoint(freeEnd);

            // Detect normal của cạnh mới
            this._pinnedEdgeNormal = this.detectEdgeNormal(clampedFreeEnd);

            // Flip 180°: đầu tự do giờ thành đầu ghim mới
            this.node.angle += 180;

            // Đặt node.position = vị trí ghim mới
            this.node.setPosition(clampedFreeEnd.x, clampedFreeEnd.y, 0);

            this._state = SpearState.IDLE;

            if (this.animSkel) {
                this.animSkel.setCompleteListener(null);
                this.animSkel.setAnimation(0, 'IDle2', true);
            }

            if (this.onPinned) this.onPinned();
        }
    }

    /**
     * Check va chạm spear (line segment) với hình tròn (enemy).
     */
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

    private pointToSegmentDistance(point: Vec2, segA: Vec2, segB: Vec2): number {
        const dx = segB.x - segA.x;
        const dy = segB.y - segA.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) return Vec2.distance(point, segA);

        let t = ((point.x - segA.x) * dx + (point.y - segA.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = segA.x + t * dx;
        const projY = segA.y + t * dy;

        const distX = point.x - projX;
        const distY = point.y - projY;
        return Math.sqrt(distX * distX + distY * distY);
    }

    private segmentIntersectsRect(segA: Vec2, segB: Vec2, rect: { x: number; y: number; width: number; height: number }): boolean {
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

    private isPointInsideRect(point: Vec2, minX: number, maxX: number, minY: number, maxY: number): boolean {
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }

    private segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
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

    private cross(a: Vec2, b: Vec2, c: Vec2): number {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    private onSegment(a: Vec2, b: Vec2, point: Vec2): boolean {
        return point.x >= Math.min(a.x, b.x)
            && point.x <= Math.max(a.x, b.x)
            && point.y >= Math.min(a.y, b.y)
            && point.y <= Math.max(a.y, b.y);
    }
}
