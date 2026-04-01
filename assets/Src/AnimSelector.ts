import { sp } from "cc";
import { CCClass } from "cc";
import { Enum } from "cc";
import { _decorator } from "cc";

const { ccclass, property } = _decorator;

@ccclass("AnimSelector")
export class AnimSelector<_TId extends pFlex.TKey> {
    static create<_TId extends pFlex.TKey>(id: _TId, sp: sp.Skeleton, enums: { name: string, value: string | number }[] = null) {

        const _ret = new AnimSelector<_TId>()
        _ret.id = id;
        _ret.editor(sp, enums);
        return _ret;
    }

    @property( { readonly: true } )
    id: _TId = 0 as _TId;

    @property({ type: Enum({}) })
    anim: string = ""

    public editor(sp: sp.Skeleton, enums: { name: string, value: string | number }[] = null) {
        const _anims = sp.skeletonData.getRuntimeData().animations;
        const _e = _anims.map(_a => ( { name: _a.name, value: _a.name } ) )

        CCClass.Attr.setClassAttr(AnimSelector, 'anim', 'enumList', _e);
        if(enums) {
            CCClass.Attr.setClassAttr(AnimSelector, 'id', 'enumList', enums)
            CCClass.Attr.setClassAttr(AnimSelector, 'id', 'type', 'Enum')
        }

        this.anim = _e.find(_x => _x.value === this.anim)?.value || ""
    }

    is(target: _TId) {
        return this.id === target
    }
}
