import { _decorator } from "cc";
import { BasePopupWithoutParams } from "../base/basePopup";
const { ccclass } = _decorator;

@ccclass("UITemplatePopupView")
export class UITemplatePopupView extends BasePopupWithoutParams {

    private presenter: UITemplatePopupPresenter = new UITemplatePopupPresenter(this);

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

class UITemplatePopupPresenter {

    private view: UITemplatePopupView;

    public constructor(view: UITemplatePopupView) {
        this.view = view;
    }

    onInit(): void {
        console.log("UITemplatePopupPresenter.onInit");
    }
    onShow(): void {
        console.log("UITemplatePopupPresenter.onShow");
    }
    onHide(): void {
        console.log("UITemplatePopupPresenter.onHide");
    }
}