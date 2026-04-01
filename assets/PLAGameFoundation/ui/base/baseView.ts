import { _decorator, Component, Constructor, UITransform, Widget } from "cc";
import { UIManager } from "../uiManager";
import { View, ViewType } from "../view";
const { requireComponent } = _decorator;

@requireComponent(UITransform)
@requireComponent(Widget)
export abstract class BaseView extends Component implements View {

    public abstract get type(): ViewType;

    public abstract onInit(): void;
    public abstract onShow(): void;
    public abstract onHide(): void;
}
