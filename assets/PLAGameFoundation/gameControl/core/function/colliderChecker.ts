import {
    _decorator,
    CircleCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    PhysicsSystem2D,
    IPhysics2DContact,
    Node,
} from "cc";

const {ccclass, property} = _decorator;

@ccclass("ColliderChecker")
export abstract class ColliderChecker extends Component {
    @property(Collider2D)
    public collider: Collider2D = null;

    public start() {
        if (this.collider == null) this.collider = this.getComponent(Collider2D);
        if (this.collider) {
            this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
            this.collider.on(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
            this.collider.on(Contact2DType.POST_SOLVE, this.onPreSolve, this);
        }
    }

    public abstract onBeginContact(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    );

    public abstract onEndContact(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    );

    public abstract onPreSolve(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    );

    public abstract onPostSolve(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    );

    public onDestroy(): void {
        if (this.collider) {
            this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
            this.collider.off(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
        }
    }
}
