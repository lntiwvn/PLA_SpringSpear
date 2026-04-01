import { _decorator, Prefab, Node, SpriteComponent, SpriteFrame, ImageAsset, resources, error, Texture2D, instantiate, isValid, find, TextAsset, JsonAsset, assetManager } from "cc";
const { ccclass } = _decorator;

@ccclass("ResourceUtil")
export class ResourceUtil {
    /**
     * Load resource
     * @param url   Resource path
     * @param type  Resource type
     * @param cb    Callback
     * @method loadRes
     */
    public static loadRes (url: string, type: any, cb: Function = ()=>{}) {
        resources.load(url, (err: any, res: any)=>{
            if (err) {
                error(err.message || err);
                cb(err, res);
                return;
            }

            cb && cb(null, res);
        })
    }

    /**
     * Load resource with type
     * @param url   Resource path
     * @param type  Resource type
     * @method loadResType
     */
    public static loadResType (url: string, type: any) {
        return new Promise((resolve, reject) => {
            resources.load(url, type, (err: any, res: any) => {
                if (err) {
                    error(err.message || err);
                    reject && reject(err)
                    return;
                }

                resolve && resolve(res);
            })
        })
    }

    /**
     * Get effect prefab
     * @param modulePath Path
     * @returns 
     */
    public static loadEffectRes (modulePath: string) {
        return new Promise((resolve, reject)=>{
            this.loadRes(`prefab/effect/${modulePath}`, Prefab, (err: any, prefab: Prefab)=>{
                if (err) {
                    console.error('effect load failed', modulePath);
                    reject && reject();
                    return;
                } 

                resolve && resolve(prefab);
            })
        })
    }

        /**
     * Get effect prefab
     * @param modulePath Path
     * @returns 
     */
        public static loadUIRes (modulePath: string) {
            return new Promise((resolve, reject)=>{
                this.loadRes(`prefab/UI/${modulePath}`, Prefab, (err: any, prefab: Prefab)=>{
                    if (err) {
                        console.error('UI load failed', modulePath);
                        reject && reject();
                        return;
                    } 
    
                    resolve && resolve(prefab);
                })
            })
        }
    

    /**
     * Get model data
     * @param modulePath Model path
     * @returns 
     */
    public static loadModelRes (modulePath: string) {
        return new Promise((resolve, reject)=>{
            this.loadRes(`prefab/model/${modulePath}`, Prefab, (err: any, prefab: Prefab)=>{
                if (err) {
                    console.error("model load failed", modulePath);
                    reject && reject();
                    return;
                }

                resolve && resolve(prefab);
            })
        })
    }

    /**
     * Get multiple model data
     * @param path Resource path
     * @param arrName Resource names
     * @param progressCb Progress callback
     * @param completeCb Completion callback
     */
    public static loadModelResArr (path: string ,arrName: Array<string>, progressCb: any, completeCb: any) {
        let arrUrls = arrName.map((item)=>{
            return `${path}/${item}`;
        })
        
        resources.load(arrUrls, Prefab, progressCb, completeCb);
    }

    /**
     * Get sprite frame resource
     * @param path Sprite frame path
     * @returns 
     */
    public static loadSpriteFrameRes(path: string) {
        return new Promise((resolve, reject)=>{
            this.loadRes(path, SpriteFrame, (err: any, img: ImageAsset)=>{
                if (err) {
                    console.error('spriteFrame load failed!', path, err);
                    reject && reject();
                    return;
                }

                let texture = new Texture2D();
                texture.image = img;

                let sf = new SpriteFrame();
                sf.texture = texture;
    
                resolve && resolve(sf);
            })
        })
    }

    /**
     * Get sprite frame resource by URL
     * @param url Resource URL
     * @param sprite Sprite component
     */
    public static loadSpriteFrameURL(url: string, sprite: SpriteComponent) {
        assetManager.loadRemote(url, (err: any, img: ImageAsset)=>{
            if (err) {
                console.error('spriteFrame load failed!', url, err);
                return;
            }

            let texture = new Texture2D();
            texture.image = img;

            let sf = new SpriteFrame();
            sf.texture = texture;
            sprite.spriteFrame = sf;
        })
    }

    /**
     * Get level data
     * @param level Level
     * @param cb Callback function
     */
    public static getMap (level: number, cb: Function) {
        let levelStr: string = 'map';
        // Prefix with zeroes
        if (level >= 100) {
            levelStr += level;
        } else if (level >= 10) {
            levelStr += '0' + level;
        } else {
            levelStr += '00' + level;
        }

        this.loadRes(`map/config/${levelStr}`, null, (err: {}, txtAsset: any)=>{
            if (err) {
                cb(err, txtAsset);
                return;
            }

            let content: string = '';
            if (txtAsset._file) {
                //@ts-ignore
                if (window['LZString']) {
                    //@ts-ignore
                    content = window['LZString'].decompressFromEncodedURIComponent(txtAsset._file);
                }
                var objJson = JSON.parse(content);
                cb(null, objJson);
            } else if (txtAsset.text) {
                //@ts-ignore
                if (window['LZString']) {
                    //@ts-ignore
                    content = window['LZString'].decompressFromEncodedURIComponent(txtAsset.text);
                }
                var objJson = JSON.parse(content);
                cb(null, objJson);
            } else if (txtAsset.json) {
                cb(null, txtAsset.json);
            } else {
                cb('failed');
            }
        });
    }

    /**
     * Get level data
     * @param type Level type
     * @param arrName Resource names
     * @param progressCb Progress callback
     * @param completeCb Completion callback
     */
    public static getMapObj(type: string, arrName: Array<string>, progressCb?:any, completeCb?:any) {
        let arrUrls: string[] = [];
        for (let idx = 0; idx < arrName.length; idx++) {
            arrUrls.push(`map/${type}/${arrName[idx]}`)
        }

        resources.load(arrUrls, Prefab, progressCb, completeCb);
    }

    /**
     * Get UI prefab
     * @param prefabPath Prefab path 
     * @param cb Callback function
     */
    public static getUIPrefabRes (prefabPath: string, cb?: Function) {
        this.loadRes("prefab/ui/" + prefabPath, Prefab, cb);
    }

    /**
     * Create UI interface
     * @param path UI path
     * @param cb Callback function
     * @param parent Parent node
     */
    public static createUI (path: string, cb?: Function, isTip?:boolean) {
        this.getUIPrefabRes(path, function (err: {}, prefab: Prefab) {
            if (err) return;
            let node: Node = instantiate(prefab);
            node.setPosition(0, 0, 0);
            var parent:Node = null;
            if(isTip){
                parent = find("Canvas/ui/tip") as Node;
            }else{
                parent = find("Canvas/ui/dislog") as Node;
            }

            parent.addChild(node);
            cb && cb(null, node);
        });
    }

    /**
     * Get JSON data
     * @param fileName File name
     * @param cb Callback function 
     */
    public static getJsonData (fileName: string, cb: Function) {
        this.loadRes("datas/" + fileName, null, function (err: any, content: JsonAsset) {
            if (err) {
                error(err.message || err);
                return;
            }

            if (content.json) {
                cb(err, content.json);
            } else {
                cb('failed!!!');
            }
        });
    }

    /**
     * Get text data
     * @param fileName File name
     * @param cb Callback function
     */
    public static getTextData (fileName:string, cb: Function) {
        this.loadRes("datas/" + fileName,  null, function (err: any, content: TextAsset) {
            if (err) {
                error(err.message || err);
                return;
            }

            let text: string = content.text;
            cb(err, text);
        });
    }

    /**
     * Set sprite frame
     * @param path Resource path
     * @param sprite Sprite component
     * @param cb Callback function
     */
    public static setSpriteFrame (path: string, sprite: SpriteComponent, cb: Function) {
        this.loadRes(path + '/spriteFrame', SpriteFrame, (err: any, spriteFrame: SpriteFrame)=> {
            if (err) {
                console.error('set sprite frame failed! err:', path, err);
                cb(err);
                return;
            }

            if (sprite && isValid(sprite)) {
                sprite.spriteFrame = spriteFrame;
                cb(null);
            }
        });
    } 

    /**
     * Get effect prefab
     * @param effectName Effect name
     * @param cb Callback function
     */
    public static getEffectPrefab (effectName: string, cb: Function) {
        this.loadRes(`prefab/effect/${effectName}/${effectName}`, Prefab, cb);
    }
}
