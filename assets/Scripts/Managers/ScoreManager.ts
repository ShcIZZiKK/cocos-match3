import { _decorator, Component, ProgressBar, Label, Animation, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ScoreManager')
export class ScoreManager extends Component {
    @property({type: Label})
    public scoreLabel: Label | null = null;

    @property({type: ProgressBar})
    public scoreBar: ProgressBar | null = null;

    @property({type: Animation})
    public animationController: Animation = null;

    @property({type: Node})
    public winWindow: Node | null = null;

    @property({type: Node})
    public comboLabel: Node | null = null;

    private score = 0;
    private combo = 1;
    private currentScaleTime = 0;
    private scaleTime = 0.3;
    private isCanPlayScaleScore = true;
    private _winScore = 1;
    private _isWin = false;
    private plaingAnimationCount = 0;

    set winScore(value) {
        if (!Number.isInteger(value) || value < 1) {
            this._winScore = 1;
        }

        this._winScore = value;
    }

    get winScore() {
        return this._winScore;
    }

    get isWin() {
        return this._isWin;
    }

    // start() {

    // }

    update(deltaTime: number) {
        if (this.combo > 1 && this.isCanPlayScaleScore) {
            this.showCombo(deltaTime);
        }
    }

    addScore(value: number) {
        this.score += value * this.combo;

        this.updateScoreLabel();
    }

    updateScoreLabel() {
        if (!this.scoreLabel) {
            return;
        }

        if (this.score > this.winScore) {
            this.score = this.winScore;

            // win
            this._isWin = true;
            this.winWindow.active = true;
        }

        const winStage = this.score / this.winScore;
        const percent = Math.floor(winStage * 100);

        if (this.animationController) {
            let step = '';

            switch (true) {
                case percent > 50 && percent < 70:
                    step = this.plaingAnimationCount === 0 ? '1' : '';

                    break;
                case percent >= 70 && percent < 90:
                    step = this.plaingAnimationCount === 1 ? '2' : '';

                    break;
                case percent > 90:
                    step = this.plaingAnimationCount === 2 ? '3' : '';

                    break;
            }

            if (step) {
                this.plaingAnimationCount++;
                this.animationController.play(`winstep${step}`);
            }
        }

        this.scoreLabel.string = ` ${percent}% `;

        if (!this.scoreBar) {
            return;
        }

        this.scoreBar.progress = winStage;
    }

    addCombo() {
        if (!this.comboLabel) {
            return;
        }

        this.combo += 1;
        this.isCanPlayScaleScore = true;

        this.comboLabel.getComponent(Label).string = `COMBO X${this.combo}`;

        const comboEnd = () => {
            this.combo = 1;
            
            this.comboLabel.setScale(0, 0);
        }

        this.unschedule(comboEnd);
        this.scheduleOnce(comboEnd, 2);
    }

    showCombo(deltaTime) {
        this.currentScaleTime += deltaTime;

        if (this.currentScaleTime > this.scaleTime) {
            this.comboLabel.setScale(1, 1);
            this.currentScaleTime = 0;
            this.isCanPlayScaleScore = false;
        } else {
            const percent = this.currentScaleTime / this.scaleTime;

            this.comboLabel.setScale(1 * percent, 1 * percent);
        }
    }
}


