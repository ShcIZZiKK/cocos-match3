import { Node, AudioSource, AudioClip, resources, director } from 'cc';

/**
 * это класс Sington для воспроизведения аудио, его можно легко вызвать из любого места проекта.
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
        // Создаём аудиоменеджер
        let audioManager = new Node();
        audioManager.name = '__audioManager__';

        // Добавляем на сцену
        director.getScene().addChild(audioManager);

        // Делаем его постоянным, чтобы он не был уничтожен при смене сцены
        director.addPersistRootNode(audioManager);

        // добавляем AudioSource для воспроизведения аудио
        this._audioSource = audioManager.addComponent(AudioSource);
    }

    public get audioSource() {
        return this._audioSource;
    }

    /**
     * Воспроизводить звуки один раз, например, взрывы, сбор монет
     * @param sound
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
     * Возпроизводит мелодию, например фоновая музыка
     * @param sound
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

    stop() {
        this._audioSource.stop();
    }

    pause() {
        this._audioSource.pause();
    }

    resume(){
        this._audioSource.play();
    }
}