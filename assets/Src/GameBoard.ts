import { _decorator, Component, Mat4, Node, UITransform, Vec2, Vec3, Rect } from 'cc';
import { CollisionZone } from './CollisionZone';
const { ccclass, property } = _decorator;

@ccclass('GameBoard')
export class GameBoard extends Component {
    @property([CollisionZone])
    public groundZones: CollisionZone[] = [];

    private _bounds: Rect = new Rect();
    private _uiTransform: UITransform = null;
    private readonly _worldMatrix: Mat4 = new Mat4();
    private readonly _inverseWorldMatrix: Mat4 = new Mat4();

    public get bounds(): Rect {
        return this._bounds;
    }

    public get minX(): number { return this._bounds.xMin; }
    public get maxX(): number { return this._bounds.xMax; }
    public get minY(): number { return this._bounds.yMin; }
    public get maxY(): number { return this._bounds.yMax; }
    public get width(): number { return this._bounds.width; }
    public get height(): number { return this._bounds.height; }

    onLoad() {
        this._uiTransform = this.node.getComponent(UITransform);
        this.updateBounds();
    }

    public updateBounds() {
        this._uiTransform ??= this.node.getComponent(UITransform);
        if (!this._uiTransform) return;
        const w = this._uiTransform.width;
        const h = this._uiTransform.height;
        const anchorX = this._uiTransform.anchorX;
        const anchorY = this._uiTransform.anchorY;

        this._bounds.x = -w * anchorX;
        this._bounds.y = -h * anchorY;
        this._bounds.width = w;
        this._bounds.height = h;
    }

    public toBoardPoint(worldPoint: Readonly<Vec2> | Readonly<Vec3>): Vec2 {
        const source = worldPoint instanceof Vec3
            ? worldPoint
            : new Vec3(worldPoint.x, worldPoint.y, 0);
        this.node.getWorldMatrix(this._worldMatrix);
        Mat4.invert(this._inverseWorldMatrix, this._worldMatrix);
        const local = Vec3.transformMat4(new Vec3(), source, this._inverseWorldMatrix);
        return new Vec2(local.x, local.y);
    }

    public toWorldPoint(boardPoint: Readonly<Vec2> | Readonly<Vec3>): Vec3 {
        const source = boardPoint instanceof Vec3
            ? boardPoint
            : new Vec3(boardPoint.x, boardPoint.y, 0);
        this.node.getWorldMatrix(this._worldMatrix);
        return Vec3.transformMat4(new Vec3(), source, this._worldMatrix);
    }

    public toNodePoint(boardPoint: Readonly<Vec2> | Readonly<Vec3>, targetNode: Node | null): Vec3 {
        const world = this.toWorldPoint(boardPoint);
        if (!targetNode) {
            return world;
        }

        return targetNode.inverseTransformPoint(new Vec3(), world);
    }

    public fromNodePoint(point: Readonly<Vec2> | Readonly<Vec3>, sourceNode: Node | null): Vec2 {
        const source = point instanceof Vec3
            ? point
            : new Vec3(point.x, point.y, 0);
        let world = source;
        if (sourceNode) {
            sourceNode.getWorldMatrix(this._worldMatrix);
            world = Vec3.transformMat4(new Vec3(), source, this._worldMatrix);
        }
        return this.toBoardPoint(world);
    }

    /** Clamp a point inside the board */
    public clampPoint(pos: Vec2): Vec2 {
        return new Vec2(
            Math.max(this.minX, Math.min(this.maxX, pos.x)),
            Math.max(this.minY, Math.min(this.maxY, pos.y))
        );
    }

    /** Check if a point is inside the board */
    public containsPoint(pos: Vec2): boolean {
        return pos.x >= this.minX && pos.x <= this.maxX
            && pos.y >= this.minY && pos.y <= this.maxY;
    }

    /**
     * Raycast from origin in direction, return the intersection point with board edge.
     * Returns the point where the ray exits the board rectangle.
     */
    public raycastToEdge(origin: Vec2, direction: Vec2): Vec2 | null {
        if (direction.lengthSqr() < 0.0001) return null;

        const dir = direction.clone().normalize();
        let tMin = Infinity;

        // Check all 4 edges
        // Left edge: x = minX
        if (dir.x !== 0) {
            const t = (this.minX - origin.x) / dir.x;
            if (t > 0) {
                const y = origin.y + t * dir.y;
                if (y >= this.minY && y <= this.maxY && t < tMin) {
                    tMin = t;
                }
            }
        }
        // Right edge: x = maxX
        if (dir.x !== 0) {
            const t = (this.maxX - origin.x) / dir.x;
            if (t > 0) {
                const y = origin.y + t * dir.y;
                if (y >= this.minY && y <= this.maxY && t < tMin) {
                    tMin = t;
                }
            }
        }
        // Bottom edge: y = minY
        if (dir.y !== 0) {
            const t = (this.minY - origin.y) / dir.y;
            if (t > 0) {
                const x = origin.x + t * dir.x;
                if (x >= this.minX && x <= this.maxX && t < tMin) {
                    tMin = t;
                }
            }
        }
        // Top edge: y = maxY
        if (dir.y !== 0) {
            const t = (this.maxY - origin.y) / dir.y;
            if (t > 0) {
                const x = origin.x + t * dir.x;
                if (x >= this.minX && x <= this.maxX && t < tMin) {
                    tMin = t;
                }
            }
        }

        if (tMin === Infinity) return null;
        return new Vec2(origin.x + tMin * dir.x, origin.y + tMin * dir.y);
    }
}
