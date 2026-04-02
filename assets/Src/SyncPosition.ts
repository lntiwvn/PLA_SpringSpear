import { _decorator, Component, Node, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("SyncPosition")
export class SyncPosition extends Component {
    @property(Node)
    public target: Node = null;

    @property([Node])
    public syncNodes: Node[] = [];

    @property({ tooltip: "Sync once on enable only. Disable to keep syncing every frame." })
    public syncOnEnableOnly: boolean = false;

    protected onEnable(): void {
        this.syncPositions();
    }

    protected update(): void {
        if (this.syncOnEnableOnly) {
            return;
        }

        this.syncPositions();
    }

    public syncPositions(): void {
        if (!this.target) {
            return;
        }

        const targetWorld = this.target.worldPosition;
        this.syncNodes.forEach((node) => this.syncNodeToWorldPosition(node, targetWorld));
    }

    protected syncNodeToWorldPosition(node: Node | null, targetWorld: Readonly<Vec3>): void {
        if (!node) {
            return;
        }

        const parent = node.parent;
        if (!parent) {
            node.setPosition(targetWorld.x, targetWorld.y, targetWorld.z);
            return;
        }

        const localPosition = parent.inverseTransformPoint(new Vec3(), targetWorld);
        node.setPosition(localPosition);
    }
}
