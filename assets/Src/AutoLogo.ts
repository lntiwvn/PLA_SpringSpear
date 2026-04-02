import { _decorator, Component, screen, Node, view } from "cc";

const { ccclass, property } = _decorator;

@ccclass("AutoLogo")
export class AutoLogo extends Component {
    @property([Node])
    public hNodes: Node[] = [];

    @property([Node])
    public vNodes: Node[] = [];

    protected onEnable(): void {
        view.on("canvas-resize", this.onCanvasResize, this);
        this.onCanvasResize();
    }

    protected onDisable(): void {
        view.off("canvas-resize", this.onCanvasResize, this);
    }

    protected onCanvasResize(): void {
        const resolution = screen.resolution
        const isHorizontal = resolution.width > resolution.height;
        this.setNodesActive(this.hNodes, isHorizontal);
        this.setNodesActive(this.vNodes, !isHorizontal);
        console.log(">>> Resized ", isHorizontal)
    }

    protected setNodesActive(nodes: Node[], active: boolean): void {
        nodes.forEach((node) => {
            if (node) {
                node.active = active;
            }
        });
    }
}
