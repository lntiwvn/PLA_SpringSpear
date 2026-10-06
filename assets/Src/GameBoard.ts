import { _decorator, Collider2D, Component, Mat4, Node, UITransform, Vec2, Vec3, Rect } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameBoard')
export class GameBoard extends Component {
    @property([Collider2D])
    public grounds: Collider2D[] = [];

    @property(Node)
    get getter() { return null }
    set getter(x: Node) {
        if(!x) return;
        const colliders = x.getComponents(Collider2D);
        this.walls.push(...colliders.filter(Boolean))
    }

    @property([Collider2D])
    public walls: Collider2D[] = [];

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

    /** Safety boundary even when a wall collider is missing or has not synced yet. */
    public raycastBoundary(origin: Vec2, direction: Vec2, maxDistance: number = Infinity): { point: Vec2; normal: Vec2; distance: number } | null {
        this.updateBounds();
        if (this.width <= 0 || this.height <= 0 || direction.lengthSqr() <= 0.0001) {
            return null;
        }

        const dir = direction.clone().normalize();
        const edges = [
            { axis: "x", value: this.minX, normal: new Vec2(1, 0) },
            { axis: "x", value: this.maxX, normal: new Vec2(-1, 0) },
            { axis: "y", value: this.minY, normal: new Vec2(0, 1) },
            { axis: "y", value: this.maxY, normal: new Vec2(0, -1) },
        ];
        let closest: { point: Vec2; normal: Vec2; distance: number } | null = null;
        for (const edge of edges) {
            // Only stop rays leaving the board, including a hit exactly at the origin.
            if (Vec2.dot(dir, edge.normal) >= 0) continue;
            const distance = (edge.value - origin[edge.axis]) / dir[edge.axis];
            if (distance < -0.001 || distance > maxDistance) continue;
            const point = origin.clone().add(dir.clone().multiplyScalar(Math.max(0, distance)));
            if (point.x < this.minX - 0.001 || point.x > this.maxX + 0.001
                || point.y < this.minY - 0.001 || point.y > this.maxY + 0.001) continue;
            if (!closest || distance < closest.distance) {
                closest = { point, normal: edge.normal, distance: Math.max(0, distance) };
            }
        }
        return closest;
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

    public findWallHit(fromWorldPoint: Vec3, toWorldPoint: Vec3): { point: Vec2; normal: Vec2 } | null {
        const fromBoardPoint = this.toBoardPoint(fromWorldPoint);
        const toBoardPoint = this.toBoardPoint(toWorldPoint);
        const direction = toBoardPoint.clone().subtract(fromBoardPoint);
        const maxDistance = direction.length();
        if (maxDistance <= 0.0001) {
            return null;
        }

        const hit = this.raycastWall(fromBoardPoint, direction, maxDistance + 0.5);
        if (!hit) {
            return null;
        }

        return {
            point: hit.point,
            normal: hit.normal,
        };
    }

    public raycastWall(origin: Vec2, direction: Vec2, maxDistance: number = Number.POSITIVE_INFINITY): { point: Vec2; normal: Vec2; collider: Collider2D; distance: number } | null {
        const dir = direction.clone();
        if (dir.lengthSqr() <= 0.0001) {
            return null;
        }

        dir.normalize();
        let closestHit: { point: Vec2; normal: Vec2; collider: Collider2D; distance: number } | null = null;
        for (const wall of this.walls) {
            if (!wall?.enabledInHierarchy) {
                continue;
            }

            const hit = this.raycastBoardRect(origin, dir, this.getColliderBoardRect(wall), maxDistance);
            if (!hit) {
                continue;
            }

            if (!closestHit || hit.distance < closestHit.distance) {
                closestHit = {
                    point: hit.point,
                    normal: hit.normal,
                    collider: wall,
                    distance: hit.distance,
                };
            }
        }

        return closestHit;
    }

    public findNearestWall(point: Vec2): { point: Vec2; normal: Vec2; collider: Collider2D; distance: number } | null {
        let closestHit: { point: Vec2; normal: Vec2; collider: Collider2D; distance: number } | null = null;
        for (const wall of this.walls) {
            if (!wall?.enabledInHierarchy) {
                continue;
            }

            const rect = this.getColliderBoardRect(wall);
            const hit = this.findClosestPointOnRect(point, rect);
            if (!hit) {
                continue;
            }

            if (!closestHit || hit.distance < closestHit.distance) {
                closestHit = {
                    point: hit.point,
                    normal: hit.normal,
                    collider: wall,
                    distance: hit.distance,
                };
            }
        }

        return closestHit;
    }

    public getColliderBoardRect(collider: Collider2D): { x: number; y: number; width: number; height: number } {
        const aabb = collider.worldAABB;
        const min = this.toBoardPoint(new Vec3(aabb.xMin, aabb.yMin, 0));
        const max = this.toBoardPoint(new Vec3(aabb.xMax, aabb.yMax, 0));
        return {
            x: Math.min(min.x, max.x),
            y: Math.min(min.y, max.y),
            width: Math.abs(max.x - min.x),
            height: Math.abs(max.y - min.y),
        };
    }

    protected raycastBoardRect(
        origin: Vec2,
        direction: Vec2,
        rect: { x: number; y: number; width: number; height: number },
        maxDistance: number,
    ): { point: Vec2; normal: Vec2; distance: number } | null {
        let tMin = -Infinity;
        let tMax = Infinity;
        let minNormal = new Vec2();
        let maxNormal = new Vec2();

        const minX = rect.x;
        const maxX = rect.x + rect.width;
        const minY = rect.y;
        const maxY = rect.y + rect.height;

        if (Math.abs(direction.x) < 0.0001) {
            if (origin.x < minX || origin.x > maxX) {
                return null;
            }
        } else {
            const tx1 = (minX - origin.x) / direction.x;
            const tx2 = (maxX - origin.x) / direction.x;
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

        if (Math.abs(direction.y) < 0.0001) {
            if (origin.y < minY || origin.y > maxY) {
                return null;
            }
        } else {
            const ty1 = (minY - origin.y) / direction.y;
            const ty2 = (maxY - origin.y) / direction.y;
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

        const hitDistance = tMin >= 0 ? tMin : tMax;
        if (hitDistance < 0 || hitDistance > maxDistance) {
            return null;
        }

        return {
            point: new Vec2(origin.x + direction.x * hitDistance, origin.y + direction.y * hitDistance),
            normal: (tMin >= 0 ? minNormal : maxNormal).clone(),
            distance: hitDistance,
        };
    }

    protected findClosestPointOnRect(
        point: Vec2,
        rect: { x: number; y: number; width: number; height: number },
    ): { point: Vec2; normal: Vec2; distance: number } | null {
        const minX = rect.x;
        const maxX = rect.x + rect.width;
        const minY = rect.y;
        const maxY = rect.y + rect.height;
        const candidates = [
            { point: new Vec2(minX, Math.min(maxY, Math.max(minY, point.y))), normal: new Vec2(-1, 0) },
            { point: new Vec2(maxX, Math.min(maxY, Math.max(minY, point.y))), normal: new Vec2(1, 0) },
            { point: new Vec2(Math.min(maxX, Math.max(minX, point.x)), minY), normal: new Vec2(0, -1) },
            { point: new Vec2(Math.min(maxX, Math.max(minX, point.x)), maxY), normal: new Vec2(0, 1) },
        ];

        let closest: { point: Vec2; normal: Vec2; distance: number } | null = null;
        for (const candidate of candidates) {
            const distance = Vec2.distance(point, candidate.point);
            if (!closest || distance < closest.distance) {
                closest = {
                    point: candidate.point,
                    normal: candidate.normal,
                    distance,
                };
            }
        }

        return closest;
    }
}
