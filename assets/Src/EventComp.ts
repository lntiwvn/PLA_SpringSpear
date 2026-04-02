import { EventHandler } from "cc";
import { Component, _decorator } from "cc";
import XGameObserver, { EXE, XGameObserverEvent } from "./XGameObserver";

const { ccclass, property } = _decorator

@ccclass("_EventComp")
class _EventComp {
    @property({ type: EXE })
    event: XGameObserverEvent = 'onSpearFly'

    @property([EventHandler])
    events: EventHandler[] = []

    static create(event: XGameObserverEvent) {
        const _ret = new _EventComp();
        _ret.event = event;
        return _ret;
    }

    invoke(...args: any[]) {
        EventHandler.emitEvents(this.events, ...args);
    }

    add() {
        XGameObserver.add(this.event, () => this.invoke());
    }
}

@ccclass("EventComp")
export class EventComp extends Component {

    @property([_EventComp])
    events: _EventComp[] = []

    protected onLoad(): void {
        this.events.forEach(_ev => _ev.add());
    }
}
