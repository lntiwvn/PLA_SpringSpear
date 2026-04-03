import { _decorator, CCInteger, Collider2D, Component, instantiate, Node, Vec2, Vec3 } from "cc";
import { XSpear, XSpearStateId } from "./XSpear";

const { ccclass, property } = _decorator;

@ccclass("ClonerSpear")
export class ClonerSpear extends Component {
    protected static readonly _instances: Set<ClonerSpear> = new Set();

    @property({ type: CCInteger, tooltip: "How many spear clones to create." })
    public amount: number = 2;

    @property({ tooltip: "Angle delta in degrees between nearest spears." })
    public angleBetween: number = 20;

    @property({ type: CCInteger, tooltip: "How many times this cloner can be used." })
    public usageCount: number = 1;

    @property(Node)
    public root: Node = null;

    @property(Collider2D)
    public detectCollider: Collider2D = null;

    protected readonly _consumedSpearIds: Set<string> = new Set();

    protected onLoad(): void {
        this.detectCollider ??= this.getComponent(Collider2D);
    }

    protected onEnable(): void {
        ClonerSpear._instances.add(this);
    }

    protected onDisable(): void {
        ClonerSpear._instances.delete(this);
    }

    public spawnClones(sourceSpear: XSpear, spawnWorldPosition: Vec3): XSpear[] {
        if (!sourceSpear || this.amount <= 0 || sourceSpear.state !== XSpearStateId.Flying) {
            return [];
        }

        const sourceDirection = sourceSpear.getFlyDirection();
        const baseDirection = sourceDirection.lengthSqr() > 0.0001
            ? sourceDirection.clone().normalize()
            : sourceSpear.getLocalUp().normalize();
        if (baseDirection.lengthSqr() <= 0.0001) {
            return [];
        }

        const targetRoot = this.root ?? sourceSpear.node.parent;
        if (!targetRoot) {
            return [];
        }

        const offsets = this.getAngleOffsets(this.amount, this.angleBetween);
        const sourceWorldPosition = spawnWorldPosition?.clone?.() ?? sourceSpear.node.worldPosition.clone();
        const clones: XSpear[] = [];

        console.log("CLOOP", clones)

        for (const offset of offsets) {
            const cloneNode = instantiate(sourceSpear.node);
            cloneNode.active = false;
            cloneNode.setParent(targetRoot);
            cloneNode.setWorldPosition(sourceWorldPosition);

            const cloneSpear = cloneNode.getComponent(XSpear);
            if (!cloneSpear) {
                cloneNode.destroy();
                continue;
            }

            const cloneDirection = this.rotateDirection(baseDirection, offset);
            cloneSpear.prepareCloneInitFrom(sourceSpear, cloneDirection);
            cloneNode.active = true;
            clones.push(cloneSpear);
        }

        return clones;
    }

    public getCollider(): Collider2D | null {
        if (!this.detectCollider?.enabledInHierarchy || !this.detectCollider.node.activeInHierarchy) {
            return null;
        }

        return this.detectCollider;
    }

    public tryCloneBySpear(sourceSpear: XSpear, spawnWorldPosition: Vec3): XSpear[] {
        if (!sourceSpear || sourceSpear.state !== XSpearStateId.Flying) {
            return [];
        }
        console.log("tryCloneBySpear", sourceSpear, spawnWorldPosition.toString(), this.usageCount)
        if (this.usageCount <= 0) {
            return [];
        }
        if (this._consumedSpearIds.has(sourceSpear.uuid)) {
            return [];
        }

        this._consumedSpearIds.add(sourceSpear.uuid);
        const clones = this.spawnClones(sourceSpear, spawnWorldPosition);
        if (clones.length <= 0) {
            return clones;
        }

        this.usageCount -= 1;
        if (this.usageCount <= 0 && this.node?.isValid) {
            this.node.destroy();
        }

        return clones;
    }

    public static getActiveCloners(): ClonerSpear[] {
        return Array.from(this._instances)
    }

    protected getAngleOffsets(count: number, step: number): number[] {
        const offsets: number[] = [];
        for (let i = 0; i < count; i++) {
            const rank = Math.floor(i / 2) + 1;
            const sign = i % 2 === 0 ? -1 : 1;
            offsets.push(sign * rank * step);
        }

        return offsets;
    }

    protected rotateDirection(direction: Vec2, angleDegrees: number): Vec2 {
        const rad = angleDegrees * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return new Vec2(
            direction.x * cos - direction.y * sin,
            direction.x * sin + direction.y * cos,
        ).normalize();
    }
}
