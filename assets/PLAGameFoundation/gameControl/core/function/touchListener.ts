import {_decorator, Component, EventTouch, Node} from 'cc';

const {ccclass, property} = _decorator;

@ccclass('TouchListener')
export abstract class TouchListener extends Component {

    protected _targetNode: Node | null = null;

    public init(node: Node) {
        this._targetNode = node;
        this.addListeners();
    }

    protected onLoad() {
        if (this._targetNode) {
            this.addListeners();
        }
    }

    protected addListeners() {
        if (!this._targetNode) return;
        this._targetNode.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this._targetNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this._targetNode.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
        this._targetNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this._targetNode.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    protected removeListeners() {
        try {
            if (!this._targetNode) return;

            this._targetNode.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this._targetNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this._targetNode.off(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
            this._targetNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this._targetNode.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        } catch (error) {

        }

    }

    onDestroy() {
        this.removeListeners();
    }

    public abstract onTouchStart(event: EventTouch): void;

    public abstract onTouchMove(event: EventTouch): void;

    public abstract onMouseEnter(event: EventTouch): void;

    public abstract onTouchEnd(event: EventTouch): void;

    public abstract onTouchCancel(event: EventTouch): void;
}
