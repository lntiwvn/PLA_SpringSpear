import { EDITOR } from "cc/env";
import { Collider2D } from "cc";
import { XEnemy } from "./XEnemy";
import { XSpear } from "./XSpear";
import { Enum } from "cc";

const __events_ = [
    "onTurHandClicked",
    "onBalloonPop",
    "onEnemyDead",
    "onEnemyFalling",
    "onEnemyIdle",
    "onEveryEnemyDie",
    "onSpearFly",
    "onSpearPinned"] as const
const __length_ = EDITOR ? 8 : __events_.length;

export const EXE = __events_.reduce((a, b) => { a[b] = b; return a }, {})
Enum(EXE)

export type XGameObserverEvent = typeof __events_[number]

export type XGameObserverArgs = {
    onTurHandClicked: [];
    onBalloonPop: [XEnemy];
    onEnemyDead: [XEnemy, XSpear];
    onEnemyFalling: [XEnemy, XSpear];
    onEnemyIdle: [XEnemy, Collider2D | null];
    onEveryEnemyDie: [];
    onSpearFly: [XSpear];
    onSpearPinned: [XSpear, Collider2D | null];
};

type XGameObserverListener<_T extends XGameObserverEvent> = (...args: XGameObserverArgs[_T]) => void;

const _map: Record<XGameObserverEvent, Function[]> = {
    onTurHandClicked: [],
    onBalloonPop: [],
    onEnemyDead: [],
    onEnemyFalling: [],
    onEnemyIdle: [],
    onEveryEnemyDie: [],
    onSpearFly: [],
    onSpearPinned: [],
};

const _ = {
    get list() { return __events_ },
    get length() { return __length_ },
    has(event: string) {
        for(const _ret of __events_) {
            if(_ret === event) return true;
        }
        return false
    },
    invoke<_T extends XGameObserverEvent>(event: _T, ...prag: XGameObserverArgs[_T]): void {
        _map[event].forEach((_listener) => (_listener as XGameObserverListener<_T>)(...prag));
    },

    add<_T extends XGameObserverEvent>(
        event: _T,
        func: XGameObserverListener<_T> | Array<XGameObserverListener<_T>>,
        ...funcs: Array<XGameObserverListener<_T>>
    ): void {
        const listeners = Array.isArray(func) ? func : [func, ...funcs];
        _map[event].push(...listeners);
    },

    remove<_T extends XGameObserverEvent>(
        event: _T,
        func: XGameObserverListener<_T> | Array<XGameObserverListener<_T>>,
        ...funcs: Array<XGameObserverListener<_T>>
    ): void {
        const listeners = Array.isArray(func) ? func : [func, ...funcs];
        _map[event] = _map[event].filter((_listener) => !listeners.includes(_listener as XGameObserverListener<_T>));
    },
};

export default _;
