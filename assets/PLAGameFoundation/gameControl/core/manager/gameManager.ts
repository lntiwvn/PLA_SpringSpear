import {
  _decorator,
  Component,
  director,
  Node,
} from "cc";
import { AudioManager } from "../../utilities/framework/audioManager";
import { EffectManager } from "../../utilities/framework/effectManager";
const { ccclass, property } = _decorator;

@ccclass("GameManager")
export class GameManager extends Component {
  static _instance: GameManager;

  static get instance() {
    if (this._instance) {
      return this._instance;
    }

    this._instance = new GameManager();
    return this._instance;
  }
  public audioManager: AudioManager = new AudioManager();
  public effectManager: EffectManager = new EffectManager();
  
  private _persistRootNode: Node = null!;
  private _nameCantDestroyObject = "Don'tDestroyOnLoad";

  SetupManagerInit(){
    // Setup Audio Manager
    if (this._persistRootNode) return;
    const dontDestroyNode = new Node(this._nameCantDestroyObject);
    director.getScene()!.addChild(dontDestroyNode);
    director.addPersistRootNode(dontDestroyNode);
    this._persistRootNode = new Node('gameManager');
    dontDestroyNode.addChild(this._persistRootNode);
    this._persistRootNode.addComponent(GameManager);
    this.audioManager.init();
  }
  
  public SetObjectCantDestroy(node:Node){
    const scene = director.getScene()!;
    const dontDestroyNode = scene.getChildByName(this._nameCantDestroyObject);
    if (dontDestroyNode) {
        dontDestroyNode.addChild(node);
    } else {
        scene.addChild(node);
        director.addPersistRootNode(node);
    }
  }

  // For setup load component
  public ComponentSetUp<T extends Component>(
    comp: T | null,
    componentClass: { new (): T }
  ): T | null {
    if (comp) return comp;
    const foundComp = this.node.getComponentInChildren(componentClass);
    if (foundComp) {
      console.log("Is load " + componentClass.name);
    }
    return foundComp;
  }
}