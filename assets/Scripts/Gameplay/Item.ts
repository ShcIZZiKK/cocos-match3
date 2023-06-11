import { _decorator, Component, SpriteFrame, Node, Sprite, UITransform, instantiate, Animation, find } from 'cc';
const { ccclass, property } = _decorator;

export enum ItemState {
    STATE_DEFAULT,
    STATE_SELECTED,
    STATE_SWITCH,
    STATE_MATCHED
}

@ccclass('Item')
export class Item extends Component {
    @property({ type: Node })
    public parentElement: Node | null = null;

    @property({ type: Node })
    public body: Node | null = null;

    @property({ type: Sprite })
    public eye: Sprite | null = null;

    @property({ type: [SpriteFrame] })
    public eyeList: SpriteFrame[] = [];

    @property({ type: Sprite })
    public mouth: Sprite | null = null;

    @property({ type: [SpriteFrame] })
    public mouthList: SpriteFrame[] = [];

    @property({ type: [SpriteFrame] })
    public bombList: SpriteFrame[] = [];

    private itemState: ItemState;
    private bodySprite: Sprite;
    private bodyImagesList: Array<SpriteFrame>;
    private bodyTransform: UITransform;

    setParent(newParent: Node) {
        this.parentElement = newParent;
    }

    changeState(newState: ItemState) {
        this.itemState = newState;

        this.setMouth();
    }

    setItemData(size, id) {
        this.setBodySprite(id);
        this.setBodySize(size);
        this.changeState(ItemState.STATE_DEFAULT);
    }

    setBodySprite(spriteIndex) {
        this.bodySprite = this.body?.getComponent(Sprite);
        this.bodyImagesList = this.bodySprite?.spriteAtlas.getSpriteFrames();
        
        if (!this.bodySprite || !this.bodyImagesList) {
            return;
        }

        this.bodySprite.spriteFrame = this.bodyImagesList[spriteIndex];

        this.setEye(spriteIndex);
    }

    setEye(spriteIndex) {
        let eyeFrameIndex = 0;

        switch (spriteIndex) {
            case 0:
            case 5:
                eyeFrameIndex = 0;

                break;
            case 1:
            case 6:
                eyeFrameIndex = 1;

                break;
            case 2:
            case 7:
                eyeFrameIndex = 2;

                break;
            case 3:
            case 8:
                eyeFrameIndex = 3;

                break;
            case 4:
            case 9:
                eyeFrameIndex = 4;

                break;
        }

        this.eye.spriteFrame = this.eyeList[eyeFrameIndex];
    }

    setMouth() {
        let mouthFrameIndex = 0;

        switch (this.itemState) {
            case ItemState.STATE_DEFAULT:
                mouthFrameIndex = 0;

                break;
            case ItemState.STATE_SELECTED:
                mouthFrameIndex = 1;

                break;
            case ItemState.STATE_MATCHED:
                mouthFrameIndex = 2;

                break;
            case ItemState.STATE_SWITCH:
                mouthFrameIndex = 0;

                break;
        }

        this.mouth.spriteFrame = this.mouthList[mouthFrameIndex];
    }

    setBodySize(size) {
        this.bodyTransform = this.body?.getComponent(UITransform);

        if (!this.bodyTransform) {
            return;
        }

        this.bodyTransform.setContentSize(size, size);
    }

    setBodyBomb(spriteIndex) {
        this.eye.spriteFrame = null;
        this.mouth.spriteFrame = null;

        let bombFrameIndex = 0;

        switch (spriteIndex) {
            case 0:
            case 5:
                bombFrameIndex = 0;

                break;
            case 1:
            case 6:
                bombFrameIndex = 1;

                break;
            case 2:
            case 7:
                bombFrameIndex = 2;

                break;
            case 3:
            case 8:
                bombFrameIndex = 3;

                break;
            case 4:
            case 9:
                bombFrameIndex = 4;

                break;
        }

        if (!this.bodySprite) {
            this.bodySprite = this.body?.getComponent(Sprite);
        }

        this.bodySprite.spriteFrame = this.bombList[bombFrameIndex];
    }

    playAnimationDead() {
        this.changeState(ItemState.STATE_MATCHED);

        const cloneItem = instantiate(this.node);
        const animationFrame = Math.floor(Math.random() * 3 + 1);
        const animationFrameName = `dead${animationFrame}`;

        if (this.parentElement) {
            cloneItem.parent = this.parentElement;
        } else {
            cloneItem.parent = find('Canvas');
        }

        cloneItem.getComponent(Animation).play(animationFrameName);

        this.hideBody();

        this.scheduleOnce(function() {
            cloneItem.destroy();
        }, 2);
    }

    hideBody() {
        this.bodySprite = this.body?.getComponent(Sprite);
        this.bodySprite.spriteFrame = null;
        this.eye.spriteFrame = null;
        this.mouth.spriteFrame = null;
    }
}


