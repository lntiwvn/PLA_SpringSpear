import { _decorator, Component, Rect, UITransform, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CollisionZone')
export class CollisionZone extends Component {

    @property(UITransform)
    public box: UITransform = null;

    protected get resolvedBox(): UITransform | null {
        return this.box ?? this.node.getComponent(UITransform);
    }

    /** Lấy position relative to board (Board > Enemy > Zone) */
    public getBoardPos2D(): Vec2 {
        const localPos = this.node.getPosition();
        const parentPos = this.node.parent.getPosition();
        return new Vec2(parentPos.x + localPos.x, parentPos.y + localPos.y);
    }

    public getBoardRect(): Rect {
        const center = this.getBoardPos2D();
        const box = this.resolvedBox;
        if (!box) {
            return new Rect(center.x, center.y, 0, 0);
        }

        return new Rect(
            center.x - box.width * box.anchorX,
            center.y - box.height * box.anchorY,
            box.width,
            box.height,
        );
    }
}
