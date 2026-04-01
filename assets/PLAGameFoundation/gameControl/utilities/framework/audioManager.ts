import {_decorator, Node, AudioClip, AudioSource, director} from "cc";
import {Lodash} from "./lodash";
import {ResourceUtil} from "./resourceUtil";
import { GameManager } from "../../core/manager/gameManager";

const {ccclass, property} = _decorator;

interface AudioData {
    source: AudioSource;
    isMusic: boolean;
}

interface AudioDataMap {
    [name: string]: AudioData;
}

@ccclass("AudioManager")
export class AudioManager {
    private _persistRootNode: Node = null!;
    private _audioSources: AudioSource[] = [];
    dictWeaponSoundIndex: any = {};

    musicVolume: number = 1;
    soundVolume: number = 1;
    audios: AudioDataMap = {};
    arrSound: AudioData[] = [];

    init() {
        if (this._persistRootNode) return; //Avoid switching scene initialization errors
        this._persistRootNode = new Node("audio");
        this.openAudio();
        GameManager.instance.SetObjectCantDestroy(this._persistRootNode);
    }

    private _getAudioSource(clip: AudioClip) {
        let result: AudioSource | undefined;
        for (let i = 0; i < this._audioSources.length; ++i) {
            let audioSource = this._audioSources[i];
            if (!audioSource.playing) {
                result = audioSource;
                break;
            }
        }
        if (!result) {
            result = this._persistRootNode.addComponent(AudioSource);
            result.playOnAwake = false;
            this._audioSources.push(result);
        }
        result.node.off(AudioSource.EventType.ENDED);
        result.clip = clip;
        result.currentTime = 0;
        return result;
    }

    /**
     * Play music
     * @param {String} name The music name can be obtained through Constant.AUDIO_MUSIC
     * @param {Boolean} loop Whether to loop
     */
    playMusic(name: string, loop: boolean) {
        let path = "audio/music/" + name;
        ResourceUtil.loadRes(path, AudioClip, (err: any, clip: any) => {
            let source = this._getAudioSource(clip);
            let tmp: AudioData = {
                source,
                isMusic: true,
            };
            this.audios[name] = tmp;
            source.volume = this.musicVolume;
            source.loop = loop;
            source.play();
        });
    }
    /**
     * Play sound effects
     * @param {String} name The music name can be obtained through Constant.AUDIO_SOUND
     * @param {Boolean} loop Whether to loop
     */
    playSound(name: string, loop: boolean = false) {
        if (!this.soundVolume) {
            return;
        }

        let path = "audio/sound/" + name;
        ResourceUtil.loadRes(path, AudioClip, (err: any, clip: AudioClip) => {
            if (err || !clip) {
                console.error("[Audio] Load failed:", path, err);
                return;
            }

            let source = this._getAudioSource(clip);
            let tmp: AudioData = {
                source,
                isMusic: false,
            };
            this.arrSound.push(tmp);

            if (loop) {
                this.audios[name] = tmp;
            }

            source.volume = this.soundVolume;
            source.loop = loop;
            source.play();

            source.node.on(AudioSource.EventType.ENDED, () => {
                Lodash.remove(this.arrSound, (obj: AudioData) => {
                    return obj.source === tmp.source;
                });
            });
        });
    }


    stop(name: string) {
        if (this.audios.hasOwnProperty(name)) {
            let audio = this.audios[name];
            audio.source.stop();
        }
    }

    stopAll() {
        for (const i in this.audios) {
            if (this.audios.hasOwnProperty(i)) {
                let audio = this.audios[i];
                audio.source.stop();
            }
        }
    }

    getMusicVolume() {
        return this.musicVolume;
    }

    setMusic(flag: number) {
        this.musicVolume = flag;
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item) && this.audios[item].isMusic) {
                let audio = this.audios[item];
                audio.source.volume = this.musicVolume;
            }
        }
    }

    //Pause the music first when watching ads
    pauseAll() {
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item)) {
                let audio = this.audios[item];
                audio.source.pause();
            }
        }
    }

    resumeAll() {
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item)) {
                let audio = this.audios[item];
                audio.source.play();
            }
        }
    }

    openMusic() {
        this.setMusic(0.8);
    }

    closeMusic() {
        this.setMusic(0);
    }

    openSound() {
        this.setSound(1);
    }

    closeSound() {
        this.setSound(0);
    }

    openAudio() {
        this.openMusic();
        this.openSound();
    }

    closeAudio() {
        this.closeMusic();
        this.closeSound();
    }

    setSound(flag: number) {
        this.soundVolume = flag;
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item) && !this.audios[item].isMusic) {
                let audio = this.audios[item];
                audio.source.volume = this.soundVolume;
            }
        }

        for (let idx = 0; idx < this.arrSound.length; idx++) {
            let audio = this.arrSound[idx];
            audio.source.volume = this.soundVolume;
        }
    }

    stopSingleSound(name: string) {
        if (this.audios.hasOwnProperty(name) && !this.audios[name].isMusic) {
            let audio = this.audios[name];
            audio.source.stop();
        }
    }
}
