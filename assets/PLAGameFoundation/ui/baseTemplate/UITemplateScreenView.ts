import { _decorator } from "cc";
import { BaseScreenWithoutParams } from "../base/baseScreen";
const { ccclass } = _decorator;

@ccclass("UITemplateScreenView")
export class UITemplateScreenView extends BaseScreenWithoutParams {

    private presenter: UITemplateScreenPresenter = new UITemplateScreenPresenter(this);

    onInit(): void {
        this.presenter.onInit();
    }

    onShow(): void {
        this.presenter.onShow();
    }

    onHide(): void {
        this.presenter.onHide();
    }

}

class UITemplateScreenPresenter {

    private view: UITemplateScreenView;

    public constructor(view: UITemplateScreenView) {
        this.view = view;
    }

    onInit(): void {
        console.log("UITemplateScreenPresenter.onInit");
    }
    onShow(): void {
        console.log("UITemplateScreenPresenter.onShow");
    }
    onHide(): void {
        console.log("UITemplateScreenPresenter.onHide");
    }
}