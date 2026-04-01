import { _decorator, Canvas, Component, Node, UITransform, Widget } from "cc";
const { ccclass, requireComponent } = _decorator;

@ccclass("RootUICanvas")
@requireComponent(UITransform)
@requireComponent(Canvas)
@requireComponent(Widget)
export class RootUICanvas extends Component {

    private static _instance: RootUICanvas = null!;

    public static get instance(): RootUICanvas {
        return this._instance;
    }

    private _hiddens: Node = null!;
    private _screens: Node = null!;
    private _popups: Node = null!;

    public get hiddens(): Node {
        return this._hiddens;
    }

    public get screens(): Node {
        return this._screens;
    }

    public get popups(): Node {
        return this._popups;
    }

    protected onLoad(): void {
        RootUICanvas._instance = this;

        this._hiddens = this.createChild("Hidden");
        this._screens = this.createChild("Screen");
        this._popups = this.createChild("Popup");

        this._hiddens.active = false;
    }

    private createChild(name: string): Node {
        const child = new Node(name);
        child.addComponent(UITransform);
        var widget = child.addComponent(Widget);
        widget.alignFlags = -1;
        child.setParent(this.node);
        return child;
    }
}