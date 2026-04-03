import { _decorator, Collider2D, Component, Vec2 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("ReflectionSpear")
export class ReflectionSpear extends Component {
    protected static readonly _instances: Set<ReflectionSpear> = new Set();

    @property(Collider2D)
    public mirrorCollider: Collider2D = null;

    protected onLoad(): void {
        this.mirrorCollider ??= this.getComponent(Collider2D);
    }

    protected onEnable(): void {
        ReflectionSpear._instances.add(this);
        this.mirrorCollider.apply();
    }

    protected onDisable(): void {
        ReflectionSpear._instances.delete(this);
    }

    public getCollider(): Collider2D | null {
        if (!this.mirrorCollider?.enabledInHierarchy || !this.mirrorCollider.node.activeInHierarchy) {
            return null;
        }

        return this.mirrorCollider;
    }

    public static getActiveColliders(): Collider2D[] {
        const colliders: Collider2D[] = [];
        for (const reflection of this._instances) {
            const collider = reflection.getCollider();
            if (!collider) {
                continue;
            }

            colliders.push(collider);
        }

        return colliders;
    }

    public static reflectDirection(direction: Vec2, normal: Vec2): Vec2 {
        const dir = direction.clone().normalize();
        const norm = normal.clone().normalize();
        const projection = dir.dot(norm);
        return new Vec2(
            dir.x - 2 * projection * norm.x,
            dir.y - 2 * projection * norm.y,
        ).normalize();
    }
}
