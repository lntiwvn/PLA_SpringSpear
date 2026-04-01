import { Asset, Constructor, resources } from "cc";

export class AssetsManager {
    private static _instance: AssetsManager = new AssetsManager();

    public static get instance(): AssetsManager {
        return this._instance;
    }

    public async loadAsync<T extends Asset>(type: Constructor<T>, id: string): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(`prefab/UI/${id}`, type, (err, asset) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(asset as T);
            });
        });
    }
}