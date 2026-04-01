import { State } from "./State";

export interface IState<
    _TContext,
    _TEnterArgs extends unknown[] = any[],
    _TExitArgs extends unknown[] = any[],
> extends State<_TContext, _TEnterArgs, _TExitArgs> {}
