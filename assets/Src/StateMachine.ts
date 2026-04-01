import { IState } from "./IState";
import { StateEnterArgs, StateExitArgs } from "./State";

export class StateMachine<_TID extends pFlex.TKey, _TContext> {
    protected readonly _states: Map<_TID, IState<_TContext, any[], any[]>> = new Map();
    protected _cid: _TID | null = null;
    protected _cstate: IState<_TContext, any[], any[]> | null = null;

    public get cid(): _TID | null {
        return this._cid;
    }

    public get cstate(): IState<_TContext, any[], any[]> | null {
        return this._cstate;
    }

    public add(id: _TID, state: IState<_TContext, any[], any[]>): this {
        this._states.set(id, state);
        return this;
    }

    public remove(id: _TID, context?: _TContext, exitArgs: any[] = []): boolean {
        const state = this._states.get(id);
        if (!state) {
            return false;
        }

        if (this._cid === id) {
            if (context !== undefined) {
                state.exit(context, ...exitArgs);
            }

            this._cid = null;
            this._cstate = null;
        }

        return this._states.delete(id);
    }

    public change<
        _TEnter extends IState<_TContext, any[], any[]> = IState<_TContext, any[], any[]>,
        _TExit extends IState<_TContext, any[], any[]> = IState<_TContext, any[], any[]>,
    >(
        id: _TID,
        context: _TContext,
        enterArgs: StateEnterArgs<_TEnter> = [] as unknown as StateEnterArgs<_TEnter>,
        exitArgs: StateExitArgs<_TExit> = [] as unknown as StateExitArgs<_TExit>,
    ): boolean {
        const nextState = this._states.get(id);
        if (!nextState) {
            return false;
        }

        if (this._cid === id) {
            return true;
        }

        this._cstate?.exit(context, ...exitArgs);

        this._cid = id;
        this._cstate = nextState;
        this._cstate.enter(context, ...enterArgs);

        return true;
    }

    public update(context: _TContext, dt: number): void {
        this._cstate?.update(context, dt);
    }
}
