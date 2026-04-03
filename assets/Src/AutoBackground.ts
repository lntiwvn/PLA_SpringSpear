import { game } from "cc";
import { Component, _decorator, UITransform, sys, view, Canvas } from "cc";

const { ccclass, property } = _decorator;

@ccclass("AutoBackground")
export class AutoBackground extends Component {
    @property({})
    noCorssDesign: boolean = true;

    @property({ type: UITransform, visible: true })
    protected _root: UITransform = null

    get root() { if(!this._root) this._root = this.getComponent(UITransform); return this._root; }

    protected onLoad(): void {
        if(!sys.isBrowser) {
            this.destroy();
            return;
        }

        const _cv = this.node.getComponent(Canvas);
        _cv?.destroy();
        view.on('canvas-resize', this._resize, this)
    }

    protected _resize() {
        const _rect = game.canvas;
        const _sx = view.getScaleX();
        const _sy = view.getScaleY();

        let _w = _rect.width / _sx
        let _h = _rect.height / _sy

        if(this.noCorssDesign) {
            const _ds = view.getDesignResolutionSize();
            _w = Math.max(_w, _ds.width);
            _h = Math.max(_h, _ds.height);
        }

        this.root.setContentSize(_w, _h);
        console.log("Switch TO", _w, _h, this.root.contentSize.toString());
    }

    protected onEnable(): void {
        this._resize();
    }

}
