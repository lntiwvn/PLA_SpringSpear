import { CollisionZone } from "./CollisionZone";
import { XEnemy } from "./XEnemy";
import { XSpear } from "./XSpear";

export type XGameObserverEvent =
    | "onBalloonPop"
    | "onEnemyDead"
    | "onEnemyFalling"
    | "onEnemyIdle"
    | "onEveryEnemyDie"
    | "onSpearFly"
    | "onSpearPinned";

export type XGameObserverArgs = {
    onBalloonPop: [XEnemy];
    onEnemyDead: [XEnemy, XSpear];
    onEnemyFalling: [XEnemy, XSpear];
    onEnemyIdle: [XEnemy, CollisionZone | null];
    onEveryEnemyDie: [];
    onSpearFly: [XSpear];
    onSpearPinned: [XSpear, CollisionZone | null];
};

type XGameObserverListener<_T extends XGameObserverEvent> = (...args: XGameObserverArgs[_T]) => void;

const _map: Record<XGameObserverEvent, Function[]> = {
    onBalloonPop: [],
    onEnemyDead: [],
    onEnemyFalling: [],
    onEnemyIdle: [],
    onEveryEnemyDie: [],
    onSpearFly: [],
    onSpearPinned: [],
};

const _ = {
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
