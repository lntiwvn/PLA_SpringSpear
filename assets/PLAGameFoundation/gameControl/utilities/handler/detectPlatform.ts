import { _decorator, Component, log, sys, System } from "cc";
import { Constant } from "../../../../constant/constant";
const { ccclass, property } = _decorator;

@ccclass
export class DetectPlatform extends Component {
  private _currentLink: string = null;
  public get currentLink(): string {
    return this._currentLink;
  }

  constructor() {
    super();
    this.detectPlatform();
  }

  public detectPlatform() {
    try {
      if (sys.os === sys.OS.IOS) {
        this.SetLink(Constant.SRORE_LINK.IOS_LINK);
      } else {
        this.SetLink(Constant.SRORE_LINK.IOS_LINK);
      }
    } catch (error) {
      throw new Error("Constaint value class missing");
    }
  }

  public SwitchToStore() {
    if (this._currentLink) {
      const url = this._currentLink;
      if (sys.isNative) {
        sys.openURL(url);
      } else {
        if (sys.platform == sys.Platform.IOS) {
          try {
            window.location.href = url;
          } catch (e) {
            console.error("Failed to use window.location.href", e);
          }
        }
        try {
          window.open(url, "_blank");
        } catch (e) {
          console.error("Failed to use window.open with _blank", e);
        }
        try {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (e) {
          console.error("Failed to use anchor tag method", e);
        }
      }
    }
  }

  public SetLink(newLink: string) {
    this._currentLink = newLink;
  }
}

export default new DetectPlatform();
