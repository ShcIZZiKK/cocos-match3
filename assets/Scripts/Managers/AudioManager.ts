import { Node, AudioSource, AudioClip, resources, director } from 'cc';

/**
 * this is a sington class for audio play, can be easily called from anywhere in you project.
 */ 
export class AudioManager {
    private static _instance: AudioManager;

    public static get instance(): AudioManager {
        if (this._instance == null) {
            this._instance = new AudioManager();
        }

        return this._instance;
    }

    private _audioSource: AudioSource;
    
    constructor() {
        // create a node as audioMgr
        let audioManager = new Node();
        audioManager.name = '__audioManager__';

        // add to the scene.
        director.getScene().addChild(audioManager);

        // make it as a persistent node, so it won't be destroied when scene change.
        director.addPersistRootNode(audioManager);

        // add AudioSource componrnt to play audios.
        this._audioSource = audioManager.addComponent(AudioSource);
    }

    public get audioSource() {
        return this._audioSource;
    }

    /**
     * @en
     * play short audio, such as strikes,explosions
     * @param sound clip or url for the audio
     * @param volume 
     */
    playOneShot(sound: AudioClip | string, volume: number = 1.0) {
        if (sound instanceof AudioClip) {
            this._audioSource.playOneShot(sound, volume);
        }
        else {
            resources.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    console.log(err);
                }
                else {
                    this._audioSource.playOneShot(clip, volume);
                }
            });
        }
    }

    /**
     * @en
     * play long audio, such as the bg music
     * @param sound clip or url for the sound
     * @param volume 
     */
    play(sound: AudioClip | string, volume: number = 1.0) {
        if (sound instanceof AudioClip) {
            this._audioSource.clip = sound;
            this._audioSource.play();
            this.audioSource.volume = volume;
        }
        else {
            resources.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    console.log(err);
                }
                else {
                    this._audioSource.clip = clip;
                    this._audioSource.play();
                    this.audioSource.volume = volume;
                }
            });
        }
    }

    /**
     * stop the audio play
     */
    stop() {
        this._audioSource.stop();
    }

    /**
     * pause the audio play
     */
    pause() {
        this._audioSource.pause();
    }

    /**
     * resume the audio play
     */
    resume(){
        this._audioSource.play();
    }
}