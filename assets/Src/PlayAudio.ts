import { AudioSource } from "cc";
import { _decorator } from "cc";
import { Component } from "cc";
const { ccclass, property } = _decorator

@ccclass("PlayAudio")
export class PlayAudio extends Component {
    @property([AudioSource])
    sources: AudioSource[] = []

    playAudio() {
        this.sources.forEach(_ => _?.play())

    }
}
