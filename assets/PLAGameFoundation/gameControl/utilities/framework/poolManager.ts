import { _decorator, Prefab, Node, instantiate, NodePool, Vec3, log } from "cc";
const { ccclass, property } = _decorator;

@ccclass("PoolManager")
export class PoolManager {

    private _dictPool: any = {}
    private _dictPrefab: any = {}

    static _instance: PoolManager;

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new PoolManager();
        return this._instance;
    }

    /**
     * Get the corresponding node from the object pool based on the prefab.
     */
    public getNode(prefab: Prefab, parent: Node, position : Vec3 = new Vec3(0, 0, 0)): Node {
        let name = prefab.name;
        //@ts-ignore
        if (!prefab.position) {
            //@ts-ignore
            name = prefab.data.name;
        }

        this._dictPrefab[name] = prefab;
        let node: Node = null!;
        if (this._dictPool.hasOwnProperty(name)) {
            // Object pool for this prefab already exists
            let pool = this._dictPool[name];
            if (pool.size() > 0) {
                node = pool.get();
            } else {
                node = instantiate(prefab);
            }
        } else {
            // No object pool for this prefab, create one!
            let pool = new NodePool();
            this._dictPool[name] = pool;

            node = instantiate(prefab);
        }
        node.parent = parent;
        node.active = true;
        node.setWorldPosition(position)
        log(position)
        return node;
    }

    /**
     * Put the corresponding node back into the object pool.
     */
    public putNode(node: Node) {
        if (!node) {
            return;
        }
        let name = node.name;
        let pool = null;
        if (this._dictPool.hasOwnProperty(name)) {
            // Object pool for this prefab already exists
            pool = this._dictPool[name];
        } else {
            // No object pool for this prefab, create one!
            pool = new NodePool();
            this._dictPool[name] = pool;
        }

        pool.put(node);
    }

    /**
     * Clear the object pool for the given name.
     */
    public clearPool(name: string) {
        if (this._dictPool.hasOwnProperty(name)) {
            let pool = this._dictPool[name];
            pool.clear();
        }
    }

    /**
     * Pre-generate the object pool.
     * @param prefab The prefab to pool.
     * @param nodeNum The number of nodes to generate.
     * Usage — PoolManager.instance.prePool(prefab, 40);
     */
    public prePool(prefab: Prefab, nodeNum: number) {
        const name = prefab.name;

        let pool = new NodePool();
        this._dictPool[name] = pool;

        for (let i = 0; i < nodeNum; i++) {
            const node = instantiate(prefab);
            pool.put(node);
        }
    }
}
