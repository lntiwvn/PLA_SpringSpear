import { isValid } from "cc";
import { _decorator, Component, Node } from "cc";

const { ccclass, property } = _decorator;

@ccclass("SuicideNode")
export class SuicideNode extends Component {
    @property([Node])
    nodes: Node[] = []

    kill() {
        this.nodes.forEach(_ => _ && _.isValid &&( _.destroy() ))
    }

    killDelay(delay: number | string) {
        delay = typeof delay === 'string' ? parseFloat(delay) : delay;
        this.scheduleOnce( () => this.kill(), delay)

    }

}
