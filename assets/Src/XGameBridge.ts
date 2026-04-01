import { CollisionZone } from "./CollisionZone";
import { GameBoard } from "./GameBoard";
import { Vec2 } from "cc";
import { XEnemy } from "./XEnemy";
import { XSpear } from "./XSpear";

export type XSpearHitResult = { enemy: XEnemy; kind: "body" | "balloon" } | null;
export type XEnemySplitKind = "vertical" | "horizontal";
export type XEnemyHitData = {
    splitKind: XEnemySplitKind;
    hitDirection: Vec2;
};

export type XGameLaserHit = {
    enemy: XEnemy | null;
    point: Vec2;
};

export type XGameBridgeRuntime = {
    findSpearHit(spear: XSpear): XSpearHitResult;
    findGroundZoneForEnemy(enemy: XEnemy): CollisionZone | null;
    getBoard(): GameBoard | null;
    resolveEnemyHitData(enemy: XEnemy, spear: XSpear): XEnemyHitData;
    castLaser(origin: Vec2, direction: Vec2): XGameLaserHit | null;
};

let _runtime: XGameBridgeRuntime | null = null;

const _ = {
    set(runtime: XGameBridgeRuntime | null): void {
        _runtime = runtime;
    },

    get(): XGameBridgeRuntime | null {
        return _runtime;
    },
};

export default _;
