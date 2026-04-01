import { ViewType, ViewWithoutParams, ViewWithParams } from "../view";
import { BaseView } from "./baseView";

export abstract class BasePopup extends BaseView {

    public get type(): ViewType {
        return ViewType.Popup;
    }
}

export abstract class BasePopupWithoutParams extends BasePopup implements ViewWithoutParams {
}

export abstract class BasePopupWithParams<TParams> extends BasePopup implements ViewWithParams<TParams> {

    private _params: TParams;

    public set params(value: TParams) {
        this._params = value;
    }

    public get params(): TParams {
        return this._params;
    }
}