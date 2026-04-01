import { Constructor, instantiate, Prefab } from "cc";
import { AssetsManager } from "../assetsManager/assetsManager";
import { RootUICanvas } from "./rootUICanvas";
import { View, ViewType, ViewWithoutParams, ViewWithParams } from "./view";

export class UIManager {

    private static _instance: UIManager = new UIManager();

    public static get instance(): UIManager {
        return this._instance;
    }

    private views: Map<string, View> = new Map<string, View>();

    public async showViewWithoutParamsAsync<TView extends ViewWithoutParams>(type: Constructor<TView>, force: boolean = false): Promise<TView> {
        const view = await this.getViewAsync(type) as TView;
        if (view.node.parent !== RootUICanvas.instance.hiddens) {
            if (force) this.hide(view);
            else return view;
        }
        this.show(view);
        view.onShow();
        return view;
    }

    public async showViewWithParamsAsync<TView extends ViewWithParams<TParams>, TParams>(type: Constructor<TView>, params: TParams, force: boolean = false): Promise<TView> {
        const view = await this.getViewAsync(type) as TView;
        if (view.node.parent !== RootUICanvas.instance.hiddens) {
            if (force) this.hide(view);
            else return view;
        }
        this.show(view);
        view.params = params;
        view.onShow();
        return view;
    }

    public hideView<TView extends View>(type: Constructor<TView>): void {
        const id = type.name;
        if (!this.views.has(id)) return;
        const view = this.views.get(id);
        this.hide(view);
    }

    private async getViewAsync(type: any): Promise<View> {
        const id = type.name;
        if (this.views.has(id)) {
            return this.views.get(id);
        }
        const prefab = await AssetsManager.instance.loadAsync(Prefab, id);
        const node = instantiate(prefab);
        node.setParent(RootUICanvas.instance.hiddens, false);
        const view = node.getComponent(type) as any as View;
        view.onInit();
        this.views.set(id, view);
        return view;
    }

    private show(view: View): void {
        if (view.type === ViewType.Screen) {
            for (const other of this.views.values()) {
                this.hide(other);
            }
            view.node.setParent(RootUICanvas.instance.screens, false);
        }
        if (view.type === ViewType.Popup) {
            view.node.setParent(RootUICanvas.instance.popups, false);
        }
    }

    private hide(view: View): void {
        if (view.node.parent === RootUICanvas.instance.hiddens) {
            return;
        }
        view.node.setParent(RootUICanvas.instance.hiddens, false);
        view.onHide();
    }
}