import { GameBoard } from "./GameBoard";
import { Collider2D, Vec2 } from "cc";
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

export type XGameReflectionHit = {
    point: Vec2;
    normal: Vec2;
    distance: number;
};

export type XGameLaserPath = {
    enemy: XEnemy | null;
    point: Vec2;
    reflectionPoint: Vec2 | null;
};

export type XGameBridgeRuntime = {
    captureSpearLaunchOverlaps(spear: XSpear): void;
    tryCloneSpear(spear: XSpear): void;
    findSpearHit(spear: XSpear): XSpearHitResult;
    findReflectionHitForDirection(origin: Vec2, direction: Vec2, maxDistance: number): XGameReflectionHit | null;
    findGroundColliderForEnemy(enemy: XEnemy): Collider2D | null;
    getBoard(): GameBoard | null;
    resolveEnemyHitData(enemy: XEnemy, spear: XSpear): XEnemyHitData;
    castLaser(origin: Vec2, direction: Vec2): XGameLaserHit | null;
    castLaserPath(origin: Vec2, direction: Vec2): XGameLaserPath | null;
    findReflectionHitAlongSegment(from: Vec2, to: Vec2): XGameReflectionHit | null;
    addSpear(spear: XSpear): void
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
