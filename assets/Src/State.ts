export interface State<
    _TContext,
    _TEnterArgs extends unknown[] = any[],
    _TExitArgs extends unknown[] = any[],
> {
    enter(context: _TContext, ...args: _TEnterArgs): void;
    exit(context: _TContext, ...args: _TExitArgs): void;
    update(context: _TContext, dt: number): void;
}

export type StateEnterArgs<_TState extends State<any, any[], any[]>> =
    _TState extends State<any, infer _TEnterArgs, any[]> ? _TEnterArgs : any[];

export type StateExitArgs<_TState extends State<any, any[], any[]>> =
    _TState extends State<any, any[], infer _TExitArgs> ? _TExitArgs : any[];
