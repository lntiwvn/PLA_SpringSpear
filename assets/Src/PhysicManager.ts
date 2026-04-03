import { _decorator, Component, EPhysics2DDrawFlags, PhysicsSystem2D, Vec2, warn } from "cc";

const { ccclass, property } = _decorator;

@ccclass("PhysicManager")
export class PhysicManager extends Component {
    protected static _instance: PhysicManager | null = null;

    @property({ tooltip: "Show collider shapes in 2D physics debug draw." })
    public showCollider: boolean = false;

    @property({ tooltip: "Show 2D physics collider AABB boxes in debug draw." })
    public showPhysicColliderBox: boolean = false;

    @property({ type: Vec2, tooltip: "Global gravity used by PhysicsSystem2D and custom falling states." })
    public gravity: Vec2 = new Vec2(0, -980);

    public static get instance(): PhysicManager | null {
        return this._instance;
    }

    public static hasInstance(): boolean {
        return this._instance !== null;
    }

    public static setInstance(instance: PhysicManager | null): void {
        this._instance = instance;
    }

    public static requireInstance(): PhysicManager {
        if (!this._instance) {
            throw new Error("PhysicManager singleton has not been initialized.");
        }

        return this._instance;
    }

    protected onLoad(): void {
        if (PhysicManager._instance && PhysicManager._instance !== this) {
            warn("PhysicManager already has an instance. Replacing the previous singleton reference.");
        }

        PhysicManager._instance = this;
        this.applySettings();
    }

    protected start(): void {
        this.applySettings();
    }

    protected onEnable(): void {
        this.applySettings();
    }

    protected update(): void {
        this.applySettings();
    }

    protected onDestroy(): void {
        if (PhysicManager._instance === this) {
            PhysicManager._instance = null;
        }
    }

    public refresh(): void {
        this.applySettings();
    }

    protected applySettings(): void {
        if (!PhysicsSystem2D.instance) {
            return;
        }

        PhysicsSystem2D.instance.gravity = new Vec2(this.gravity.x, this.gravity.y);

        let flags = EPhysics2DDrawFlags.None;
        if (this.showCollider) {
            flags |= EPhysics2DDrawFlags.Shape;
        }

        if (this.showPhysicColliderBox) {
            flags |= EPhysics2DDrawFlags.Aabb;
        }

        PhysicsSystem2D.instance.debugDrawFlags = flags;
    }
}
