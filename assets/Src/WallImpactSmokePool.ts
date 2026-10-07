import { _decorator, Component, Node, Vec2, Vec3 } from 'cc';
import { WallImpactSmoke } from './WallImpactSmoke';

var ccclass = _decorator.ccclass;
var property = _decorator.property;

/** All effect instances already exist in the scene's editor-authored prefab pool. */
@ccclass('WallImpactSmokePool')
export class WallImpactSmokePool extends Component {
    @property([WallImpactSmoke])
    public effects: WallImpactSmoke[] = [];

    private _next = 0;
    private _board: Node = null;

    public playAt(board: Node, position: Vec3, normal: Vec2): void {
        if (!board || this.effects.length === 0) return;
        if (this._board !== board) this.clear();
        this._board = board;
        var effect: WallImpactSmoke = null;
        for (var i = 0; i < this.effects.length; i++) {
            var index = (this._next + i) % this.effects.length;
            var candidate = this.effects[index];
            if (candidate && !candidate.node.active) {
                effect = candidate;
                this._next = (index + 1) % this.effects.length;
                break;
            }
        }
        if (!effect) {
            effect = this.effects[this._next];
            this._next = (this._next + 1) % this.effects.length;
        }
        if (!effect) return;
        effect.node.setWorldPosition(position);
        effect.node.setWorldRotation(board.worldRotation);
        effect.node.setWorldScale(board.worldScale);
        effect.node.active = true;
        effect.play(normal);
    }

    public clear(): void {
        for (var i = 0; i < this.effects.length; i++) {
            if (this.effects[i]) this.effects[i].node.active = false;
        }
    }

    protected update(): void {
        if (this._board && (!this._board.isValid || !this._board.activeInHierarchy)) {
            this.clear();
            this._board = null;
        }
    }
}
