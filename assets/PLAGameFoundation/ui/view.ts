import { Node } from "cc";

export enum ViewType {
    Screen,
    Popup,
}

export interface View {

    get node(): Node;
    get type(): ViewType;

    onInit(): void;
    onShow(): void;
    onHide(): void;
}

export interface ViewWithoutParams extends View {
}

export interface ViewWithParams<TParams> extends View {
    set params(value: TParams);
}