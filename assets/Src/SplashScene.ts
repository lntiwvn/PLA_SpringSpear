import { _decorator, Node, UIOpacity } from "cc";
import { Component } from "cc";

const { ccclass, property } = _decorator;

@ccclass("SplashScene")
export class SplashScene extends Component {
    @property(Node)
    root: Node = null;

    @property(UIOpacity)
    opx: UIOpacity = null;

    @property({ min: 0})
    duration: number = 0.5;

    trans() {
    }
}
