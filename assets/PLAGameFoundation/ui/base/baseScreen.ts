import { ViewType, ViewWithoutParams, ViewWithParams } from "../view";
import { BaseView } from "./baseView";

export abstract class BaseScreen extends BaseView {

    public get type(): ViewType {
        return ViewType.Screen;
    }
}

export abstract class BaseScreenWithoutParams extends BaseScreen implements ViewWithoutParams {
}

export abstract class BaseScreenWithParams<TParams> extends BaseScreen implements ViewWithParams<TParams> {

    private _params: TParams;

    public set params(value: TParams) {
        this._params = value;
    }

    public get params(): TParams {
        return this._params;
    }
}