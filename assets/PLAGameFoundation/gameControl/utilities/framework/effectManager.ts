import { _decorator, Node, Prefab, AnimationComponent, ParticleSystemComponent, Vec3, find, AnimationState, AnimationClip, director } from 'cc';
import { PoolManager } from './poolManager';
import { ResourceUtil } from './resourceUtil';
import { GameManager } from '../../core/manager/gameManager';

const { ccclass, property } = _decorator;

@ccclass('EffectManager')
export class EffectManager{
    private _ndParent: Node = null!;
    public get ndParent() {
        if (!this._ndParent) {
            let ndEffectParent = find("effectManager") as Node;

            if (ndEffectParent) {
                this._ndParent = ndEffectParent;
            } else {
                this._ndParent = new Node("effectManager");
                
                GameManager.instance.SetObjectCantDestroy(this._ndParent);
            }
        }

        return this._ndParent;
    }

    /**
     * Play animation
     * @param {string} path Animation node path
     * @param {string} aniName Animation name
     * @param {vec3} worPos world position
     * @param {boolean} isLoop Whether to loop
     * @param {boolean} isRecycle Whether to recycle
     * @param {number} [scale=1] Effect scale 
     * @param {Function} [callback=()=>{}] Callback 
     */
    public playAni (path: string, aniName: string, worPos: Vec3 = new Vec3(),  isLoop: boolean = false,  isRecycle: boolean = false, scale: number = 1, callback: Function = ()=>{}) {
        let childName: string = path.split("/")[1];
        let ndEffect: Node | null = this.ndParent.getChildByName(childName);

        let cb = ()=>{
            ndEffect?.setScale(scale, scale, scale);
            ndEffect?.setWorldPosition(worPos); 
            let ani: AnimationComponent= ndEffect?.getComponent(AnimationComponent) as AnimationComponent;
            ani.play(aniName);
            let aniState: AnimationState= ani.getState(aniName) as AnimationState;
            if (aniState) {
                if (isLoop) {
                    aniState.wrapMode = AnimationClip.WrapMode.Loop;    
                } else {
                    aniState.wrapMode = AnimationClip.WrapMode.Normal;    
                }
            }

            ani.once(AnimationComponent.EventType.FINISHED, ()=>{
                callback && callback();
                if (isRecycle && ndEffect) {
                    PoolManager.instance.putNode(ndEffect);
                }
            })
        }

        if (!ndEffect) {
            ResourceUtil.loadEffectRes(path).then((prefab: unknown)=>{
                ndEffect = PoolManager.instance.getNode(prefab as Prefab, this.ndParent) as Node;
                ndEffect.setScale(scale, scale, scale);
                ndEffect.setWorldPosition(worPos);                
                cb();
            })
        } else {
          cb();
        }
    }

    /**
     * Remove effects
     * @param {string} name  Effect name
     * @param {Node} ndParent Special effects parent node
     */
    public removeEffect (name: string, ndParent: Node = this.ndParent) {
        let ndEffect: Node | null = ndParent.getChildByName(name);
        if (ndEffect) {
            let arrAni: AnimationComponent[] = ndEffect.getComponentsInChildren(AnimationComponent);
            arrAni.forEach((element: AnimationComponent)=>{    
                element.stop();
            })

            let arrParticle: [] = ndEffect?.getComponentsInChildren(ParticleSystemComponent) as any;
            arrParticle.forEach((element:ParticleSystemComponent)=>{
                element?.clear();
                element?.stop();
            })
            PoolManager.instance.putNode(ndEffect);        
        }
    }

    /**
     * Play particle effects
     * @param {string} path Effects path
     * @param {vec3}worPos World position 
     * @param {number} [recycleTime=0] Special effect node recycling time, if it is 0, the default duration is used
     * @param  {number} [scale=1] Effects scale
     * @param {vec3} eulerAngles Effects angle
     * @param {Function} [callback=()=>{}] Callback
     */
    public playParticle (path: string, worPos: Vec3,  recycleTime: number = 0, scale: number = 1, eulerAngles?: Vec3 | null, callback?: Function) {
        ResourceUtil.loadEffectRes(path).then((prefab: any)=>{
            let ndEffect: Node = PoolManager.instance.getNode(prefab as Prefab, this.ndParent) as Node;
            ndEffect.setScale(scale, scale, scale);
            ndEffect.setWorldPosition(worPos);  
            
            if (eulerAngles) {
                ndEffect.eulerAngles = eulerAngles;
            }
            
            let maxDuration: number = 0;

            let arrParticle:  ParticleSystemComponent[]= ndEffect.getComponentsInChildren(ParticleSystemComponent);
            arrParticle.forEach((item: ParticleSystemComponent)=>{
                item.simulationSpeed = 1;
                item?.clear();
                item?.stop();
                item?.play()

                let duration: number= item.duration;
                maxDuration = duration > maxDuration ? duration : maxDuration;
            })

            let seconds: number = recycleTime && recycleTime > 0 ? recycleTime : maxDuration;

            setTimeout(()=>{
                if (ndEffect.parent) {
                    callback && callback();
                    PoolManager.instance.putNode(ndEffect);
                }
            }, seconds * 1000)  
        })
    }

    /**
     * Play the animation and particles under the node
     *
     * @param {Node} targetNode Effect Mounting Node
     * @param {string} effectPath Effects Path
     * @param {boolean} [isPlayAni=true] Whether to play animation
     * @param {boolean} [isPlayParticle=true] Whether to play particle 
     * @param {number} [recycleTime=0] Effect node recycling time, if it is 0, the default duration is used
     * @param {number} [scale=1] Effect scale
     * @param {Vec3} [pos=new Vec3()] Displacement
     * @param {boolean} [isRecycle=true] Whether to recycle
     * @param {Function} [callback=()=>{}] Callback
     * @returns
     * @memberof EffectManager
     */
    public playEffect (targetNode: Node, effectPath: string, isPlayAni: boolean = true, isPlayParticle: boolean = true, recycleTime: number = 0, scale: number = 1, pos?: Vec3 | null, eulerAngles?: Vec3 | null, isRecycle: boolean = true, callback?: Function | null) {
        if (!targetNode || !targetNode.parent) {//Do not play when the parent node is recycled
            return;
        }

        ResourceUtil.loadEffectRes(effectPath).then((prefab: any)=>{
            let ndEffect: Node = PoolManager.instance.getNode(prefab as Prefab, targetNode) as Node;
            ndEffect.setScale(scale, scale, scale);

            if (pos) {
                ndEffect.setPosition(pos);
            }

            if (eulerAngles) {
                ndEffect.eulerAngles = eulerAngles;
            }
            
            let maxDuration: number = 0;

            if (isPlayAni) {
                let arrAni: AnimationComponent[] = ndEffect.getComponentsInChildren(AnimationComponent);
    
                if (arrAni.length) {
                    arrAni.forEach((element: AnimationComponent, idx: number)=>{
                        element?.play();
                        
                        let aniName = element?.defaultClip?.name;
                        if (aniName) {
                            let aniState = element.getState(aniName);
                            if (aniState) {
                                aniState.time = 0;
                                aniState.sample();
                                
                                let duration = aniState.duration;
                                maxDuration = duration > maxDuration ? duration : maxDuration;
    
                                aniState.speed = 1;
                            }
                        }
                    })
                }
            }
    
            if (isPlayParticle) {
                let arrParticle: ParticleSystemComponent[]= ndEffect.getComponentsInChildren(ParticleSystemComponent);
                
                if (arrParticle.length) {
                    arrParticle.forEach((element:ParticleSystemComponent)=>{
                        element.simulationSpeed = 1;
                        element?.clear();
                        element?.stop();
                        element?.play()
        
                        let duration: number= element.duration;
                        maxDuration = duration > maxDuration ? duration : maxDuration;
                    })
                }
            }
    
            let seconds: number = recycleTime && recycleTime > 0 ? recycleTime : maxDuration;
            
            setTimeout(()=>{
                if (ndEffect.parent) {
                    callback && callback();
                    if (isRecycle) {
                        PoolManager.instance.putNode(ndEffect);
                    } else {
                        ndEffect.destroy();
                    }
                }
            }, seconds * 1000)   
        })
    }

    /**
     * Particle effects on the playback node/tail particle effects
     *
     * @param {Node} ndParent
     * @memberof EffectManager
     */
    public playTrail (ndParent: Node, recycleTime:number = 0, callback?:Function, speed: number = 1) {
        let maxDuration: number = 0;

        if (!ndParent.active) {
            ndParent.active = true;
        }

        let arrParticle: ParticleSystemComponent[]= ndParent.getComponentsInChildren(ParticleSystemComponent);
        arrParticle.forEach((element:ParticleSystemComponent)=>{
            element.simulationSpeed = speed;
            element?.clear();
            element?.stop();
            element?.play();

            let duration: number= element.duration;
            maxDuration = duration > maxDuration ? duration : maxDuration;
        })

        if (callback) {
            let seconds: number = recycleTime && recycleTime > 0 ? recycleTime : maxDuration;

            setTimeout(()=>{
                callback();
            }, seconds * 1000)  
        }
    }

    /**
     * Play the prop disappearing effect
     * @param {string} path Effect path
     * @param {vec3}worPos World position 
     * @param {Function} [callback=()=>{}] Callback
     */
    public playDisappearEff (path: string, worPos: Vec3, cb: Function) {
        ResourceUtil.loadEffectRes(path).then((prefab: any)=>{
            let ndEffect: Node = PoolManager.instance.getNode(prefab as Prefab, this.ndParent) as Node;
            ndEffect.setWorldPosition(worPos);  
            
            let maxDuration: number = 0;

            let arrParticle:  ParticleSystemComponent[]= ndEffect.getComponentsInChildren(ParticleSystemComponent);
            arrParticle.forEach((item: ParticleSystemComponent)=>{
                item.simulationSpeed = 1;
                item?.clear();
                item?.stop();
                item?.play()

                let duration: number= item.duration;
                maxDuration = duration > maxDuration ? duration : maxDuration;
            })

            setTimeout(()=>{
                if (ndEffect && ndEffect.parent) {
                    PoolManager.instance.putNode(ndEffect);
                }
            }, maxDuration * 1000) 

            cb && cb(()=>{
                if (ndEffect && ndEffect.parent) {
                    PoolManager.instance.putNode(ndEffect);
                }
            });
        })
    }
}
