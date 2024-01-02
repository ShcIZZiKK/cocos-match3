import { _decorator, Component, Node, UITransform, CCInteger, Prefab, instantiate, Input, Vec3, AudioClip, CCFloat, log } from 'cc';
import { Item, ItemState } from './Item';
import { AudioManager } from '../Managers/AudioManager';
import { ScoreManager } from '../Managers/ScoreManager';
const { ccclass, property } = _decorator;

interface GridItem {
    row: number,
    col: number,
    size: number,
    value: number,
    item?: Node,
}

interface FallItem {
    item: Node,
    position: Vec3
}

enum BombEffect {
    BE_NONE,
    BE_BOMB
}

interface GameObject {
    selectedRow: number,
	selectedCol: number,
    selectedPosition: Vec3,
	secondSelectedRow: number,
	secondSelectedCol: number,
    secondSelectedPosition: Vec3,
    yOffset: number,
    xOffset: number,
    selectedType: BombEffect,
    secondType: BombEffect
}

interface AnimationCallbacks {
    revert?: () => void,
    end: () => void
}

interface AnimationData {
    currentTime: number,
    speed: number,
    callbacks: AnimationCallbacks
}

interface MoveItem {
    position: Vec3,
    target: Vec3,
    item: Node
}

enum BoardStage {
    BS_PICK,
    BS_MOVE,
    BS_REVERT,
    BS_REMOVE,
    BS_REFILL,
    BS_ANIMATION_FALING,
    BS_BONUS_STACK
}

@ccclass('Board')
export class Board extends Component {
    @property({group: { name: 'Board nodes' }, type: Prefab, tooltip: 'Префаб гема/фрукта'})
    public itemPrefab: Prefab | null = null;

    @property({group: { name: 'Board nodes' }, type: Node, tooltip: 'Блок фона'})
    public backgroundBoard: Node | null = null;

    @property({group: { name: 'Board nodes' }, type: Prefab, tooltip: 'Префаб фона для гема/фрукта'})
    public tilePrefab: Prefab | null = null;

    @property({group: { name: 'Board nodes' }, type: Node, tooltip: 'Элемент курсора (выделение элемента)'})
    public cursor: Node | null = null;

    @property({group: { name: 'Board nodes' }, type: ScoreManager, tooltip: 'Менеджер подсчёта очков'})
    public scoreManager: ScoreManager | null = null;

    @property({group: { name: 'Game settings' }, type: CCInteger, tooltip: 'Количество очков для победы'})
    public winScore: number = 50;

    @property({group: { name: 'Game settings' }, type: CCInteger, tooltip: 'Количество строк с гемами/фруктами'})
    public countRows: number = 8;

    @property({group: { name: 'Game settings' }, type: CCInteger, tooltip: 'Количество столбцов с гемами/фруктами'})
    public countCols: number = 8;
    
    @property({group: { name: 'Game settings' }, type: CCInteger, range: [1, 10, 1], slide: true, tooltip: 'Колечество вариантов гемов/фруктов'})
    public itemVariantCount: number = 5;

    @property({group: { name: 'Game settings' }, type: CCInteger, tooltip: 'Размер ячейки/гема'})
    public itemSize: number = 64;

    @property({group: { name: 'Game settings' }, type: CCInteger, tooltip: 'Отступ между элементами'})
    public padding: number = 2;

    @property({group: { name: 'Game settings' }, type: CCFloat, tooltip: 'Скорость анимация смещения гема'})
    public switchSpeed: number = 0.3;

    @property({group: { name: 'Game settings' }, type: CCFloat, tooltip: 'Скорость анимации падения гема'})
    public fallSpeed: number = 0.2;

    @property({group: { name: 'Audio settings' }, type: AudioClip, tooltip: 'Основная музыка для игры'})
    public gameplayMusic: AudioClip | null = null;

    @property({group: { name: 'Audio settings' }, type: AudioClip, tooltip: 'Звук смещения элементов'})
    public switchSound: AudioClip | null = null;

    @property({group: { name: 'Audio settings' }, type: AudioClip, tooltip: 'Звук сбора элементов 3+'})
    public stackSound: AudioClip | null = null;

    @property({group: { name: 'Audio settings' }, type: AudioClip, tooltip: 'Звук сбора бомбы'})
    public createBombSound: AudioClip | null = null;

    @property({group: { name: 'Audio settings' }, type: AudioClip, tooltip: 'Звук взрыва бомбы'})
    public explosionBombSound: AudioClip | null = null;

    @property({group: { name: 'Audio settings' }, type: AudioClip, tooltip: 'Звук при выигрыше в раунде'})
    public winSound: AudioClip | null = null;

    public static boardStage: BoardStage = BoardStage.BS_PICK;
    public static audioManager: AudioManager;
    public static gameObject: GameObject = {
        selectedRow: -1,
        selectedCol: -1,
        selectedPosition: new Vec3(0, 0, 0),
        secondSelectedRow: 0,
        secondSelectedCol: 0,
        secondSelectedPosition: new Vec3(0, 0, 0),
        yOffset: 0,
        xOffset: 0,
        selectedType: BombEffect.BE_NONE,
        secondType: BombEffect.BE_NONE
    };

    private itemSizeWithPadding = 0;

    private emptyId = -1;
    private grid: Array<Array<GridItem>> = [];
    private fallItems: Array<FallItem> = [];

    private isRevertMove = false;
    private stack = false;


    // НОВОЕ
    private boardGenerator: BoardGenerator;
    private boardItems: BoardItems;
    private boardAnimations: BoardAnimations;

    private moveItems: Array<MoveItem>;

    /**
     * Инициализация
     */
    start() {
        this.itemSizeWithPadding = this.itemSize + this.padding;
        this.itemPrefab.data.getComponent(Item).setParent(this.node);
        Board.audioManager = AudioManager.instance;

        if (Board.audioManager && this.gameplayMusic) {
            Board.audioManager.play(this.gameplayMusic, 0.8);
        }

        if (this.scoreManager) {
            this.scoreManager.winScore = this.winScore;
        }

        // Иницизируем класс который сравнивает элементы
        BoardComparison.setGridSize(this.countRows, this.countCols);
        BoardBomb.setGridSize(this.countRows, this.countCols);

        // Инициализируем доску
        const boardParams = {
            backgroundBoard: this.backgroundBoard,
            countCols: this.countCols,
            countRows: this.countRows,
            cellSize: this.itemSizeWithPadding,
            padding: this.padding,
            itemVariantCount: this.itemVariantCount,
            parentNode: this.node,
            itemPrefab: this.itemPrefab,
            tilePrefab: this.tilePrefab
        };

        this.boardGenerator = new BoardGenerator(boardParams);
        this.boardGenerator.setBackgroudSize();
        this.boardGenerator.createGrid();
        this.grid = this.boardGenerator.getGrid();

        // Инициализруем взаимодействие с элементами доски
        const boardItemsParams = {
            switchSound: this.switchSound,
            countCols: this.countCols,
            countRows: this.countRows,
            emptyId: this.emptyId,
            bombId: BoardBomb.bombId,
            cellSize: this.itemSizeWithPadding,
            cursor: this.cursor
        };

        this.boardItems = new BoardItems(boardItemsParams);
        this.boardItems.grid = this.grid;
        this.boardItems.generateEvents();

        // Инициализируем анимации
        const boardAnimationsParams = {
            cellSize: this.itemSizeWithPadding,
            switchAnimation: {
                currentTime: 0,
                speed: this.switchSpeed,
                callbacks: {
                    revert: () => {
                        this.onSwitchEnd();
                    },
                    end: () => {
                        Board.boardStage = BoardStage.BS_REVERT;
            
                        this.stack = true;
            
                        this.checkAfterSwitch();
                    }
                }
            },
            fallAnimation: {
                currentTime: 0,
                speed: this.fallSpeed,
                callbacks: {
                    end: () => {
                        Board.boardStage = BoardStage.BS_REFILL;

                        this.fallItems = [];

                        this.checkAfterSwitch();
                    }
                }
            },
            moveAnimation: {
                currentTime: 0,
                speed: 0.15,
                callbacks: {
                    end: () => {
                        this.moveItems = [];

                        this.grid[BoardBomb.bombPosition.row][BoardBomb.bombPosition.col].item.getComponent(Item).setItemData(BoardBomb.bombId, true);

                        BoardBomb.bombPosition.row = -1;
                        BoardBomb.bombPosition.col = -1;

                        Board.boardStage = BoardStage.BS_REMOVE;
            
                        this.revertItems();
                        this.checkAfterSwitch();
                    }
                }
            }
        };

        this.boardAnimations = new BoardAnimations(boardAnimationsParams);
    }

    /**
     * Постоянное выполнение
     * @param deltaTime 
     */
    update(deltaTime: number) {
        if (Board.boardStage === BoardStage.BS_MOVE && this.boardAnimations) {
            this.boardAnimations.switch(deltaTime, this.grid, this.isRevertMove);
        }

        if (Board.boardStage === BoardStage.BS_ANIMATION_FALING && this.boardAnimations) {
            this.boardAnimations.fall(deltaTime, this.fallItems);
        }

        if (Board.boardStage === BoardStage.BS_BONUS_STACK && this.boardAnimations) {
            this.boardAnimations.moveToTarget(deltaTime, this.moveItems);
        }
    }

    /**
     * Действие в конце полного (туда-обратно) перемещения элемента (фрукта) 
     */
    onSwitchEnd() {
        Board.gameObject.selectedRow = this.emptyId;

        this.isRevertMove = false;

        this.grid.forEach((row) => {
            row.forEach((col) => {
                if (col.value !== BoardBomb.bombId) {
                    col.item.getComponent(Item).changeState(ItemState.STATE_DEFAULT);
                }
            });
        });

        Board.boardStage = BoardStage.BS_PICK;

        if (this.scoreManager?.isWin) {
            this.node.active = false;

            if (Board.audioManager && this.winSound) {
                Board.audioManager.stop();
                Board.audioManager.playOneShot(this.winSound);
            }
        }

        console.log(this.grid);
        
    }

    /**
     * Событие при создании бомбы
     * @param moveItems 
     */
    onCreateBomb(moveItems: Array<MoveItem>) {
        this.moveItems = moveItems;

        Board.boardStage = BoardStage.BS_BONUS_STACK;

        if (Board.audioManager && this.createBombSound) {
            Board.audioManager.playOneShot(this.createBombSound, 0.5);
        }
    }

    /**
     * Проверяем совпадения после перемещения
     */
    checkAfterSwitch() {
        // Провека не идёт ли сейчас стадия падения гемов
        if (Board.boardStage === BoardStage.BS_REMOVE) {
            this.checkFalling();

            return;
        }

        // Провека не идёт ли сейчас стадия создания гемов
        if (Board.boardStage === BoardStage.BS_REFILL) {
            this.createNewItems();

            return;
        }

        // Провека - не перемещаем ли мы сейчас бомбу
        if (Board.gameObject.selectedType === BombEffect.BE_BOMB || Board.gameObject.secondType === BombEffect.BE_BOMB) {
            const onExplosionEnd = () => {
                this.hideRemoveItems(this.explosionBombSound);
            }

            if (Board.gameObject.selectedType === BombEffect.BE_BOMB) {
                BoardBomb.explosionBomb(this.grid, Board.gameObject.secondSelectedRow, Board.gameObject.secondSelectedCol, this.emptyId, onExplosionEnd);
            } else {
                BoardBomb.explosionBomb(this.grid, Board.gameObject.selectedRow, Board.gameObject.selectedCol, this.emptyId, onExplosionEnd);
            }

            return;
        }

        // Проверка на стак бомбы
        const isStackBombSelected = BoardBomb.isStackBomb(this.grid, Board.gameObject.selectedRow, Board.gameObject.selectedCol);
        const isStackBombPrev = BoardBomb.isStackBomb(this.grid, Board.gameObject.secondSelectedRow, Board.gameObject.secondSelectedCol);

        if (isStackBombSelected || isStackBombPrev) {
            if (isStackBombSelected) {
                BoardBomb.createBomb(this.grid, Board.gameObject.selectedRow, Board.gameObject.selectedCol, this.emptyId, this.onCreateBomb.bind(this));
            }
            
            if (isStackBombPrev) {
                BoardBomb.createBomb(this.grid, Board.gameObject.secondSelectedRow, Board.gameObject.secondSelectedCol, this.emptyId, this.onCreateBomb.bind(this));
            }
            
            return;
        }

        // Проверка на стак 3+ в ряд
        const isStackSelected = BoardComparison.isLineStacking(this.grid, Board.gameObject.selectedRow, Board.gameObject.selectedCol);
        const isStackPrevSelected = BoardComparison.isLineStacking(this.grid, Board.gameObject.secondSelectedRow, Board.gameObject.secondSelectedCol);

        // Если стака нет, то возвращаем гем обратно
        if (!isStackSelected && !isStackPrevSelected) {
            this.isRevertMove = true;

            Board.boardStage = BoardStage.BS_MOVE;

            if (Board.audioManager && this.switchSound) {
                Board.audioManager.playOneShot(this.switchSound, 0.5);
            }
            
            return;
        }

        // Иначе отмечаем элементы которые нужно удалить и удаляем их
        Board.boardStage = BoardStage.BS_REMOVE;

        if (isStackSelected) {
            this.removeItems(Board.gameObject.selectedRow, Board.gameObject.selectedCol);
        }

        if (isStackPrevSelected) {
            this.removeItems(Board.gameObject.secondSelectedRow, Board.gameObject.secondSelectedCol);
        }

        this.hideRemoveItems();
    }

    /**
     * Отмечает элементы в массиве которые требуется удалить
     * @param row индекс строки элемента от которого проверяем
     * @param col индекс столбца элемента от которого проверяем
     */
    removeItems(row, col) {
        let itemValue = this.grid[row][col].value;
        let tempPosition = row;

        if (BoardComparison.isVerticalLineStacking(this.grid, row, col)) {
            while(tempPosition > 0 && this.grid[tempPosition - 1][col].value == itemValue) {
                this.grid[tempPosition - 1][col].value = this.emptyId;

                tempPosition--;
            }

            tempPosition = row;

            while(tempPosition < this.countRows - 1 && this.grid[tempPosition + 1][col].value == itemValue) {
                this.grid[tempPosition + 1][col].value = this.emptyId;

                tempPosition++;
            }
        }

        if (BoardComparison.isHorizontalLineStacking(this.grid, row, col)) {
            tempPosition = col;

            while(tempPosition > 0 && this.grid[row][tempPosition - 1].value == itemValue) {
                this.grid[row][tempPosition - 1].value = this.emptyId;

                tempPosition--;
            }

            tempPosition = col;

            while(tempPosition < this.countCols - 1 && this.grid[row][tempPosition + 1].value == itemValue) {
                this.grid[row][tempPosition + 1].value = this.emptyId;

                tempPosition++;
            }
        }

        this.grid[row][col].value = this.emptyId;
    }

    /**
     * Удаляем элемента с доски
     * Добавляем очки, запуск анимации сбора элемента, звук сбора
     */
    hideRemoveItems(costomSound: AudioClip = null) {
        for (let row = 0; row < this.countRows; row++) {
            for (let col = 0; col < this.countCols; col++) {
                if (this.grid[row][col].value === this.emptyId) {
                    this.grid[row][col].item.getComponent(Item).playAnimationDead();
                    this.scoreManager.addScore(1);
                }
            }
        }

        if (Board.audioManager) {
            const sound = costomSound ?? this.stackSound
  
            if (sound) {
                Board.audioManager.playOneShot(sound, 0.5);
            }
        }

        this.revertItems();
        this.checkAfterSwitch();
    }

    /**
     * Меняет позиции в сетке у элементов местами
     */
    revertItems() {
        if (!this.stack) {
            return;
        }

        const {
            selectedRow,
            selectedCol,
            secondSelectedRow,
            secondSelectedCol
        } = Board.gameObject;
        const tempRow = this.grid[selectedRow][selectedCol].row;
        const tempCol = this.grid[selectedRow][selectedCol].col;

        this.grid[selectedRow][selectedCol].row = this.grid[secondSelectedRow][secondSelectedCol].row;
        this.grid[selectedRow][selectedCol].col = this.grid[secondSelectedRow][secondSelectedCol].col;
        this.grid[secondSelectedRow][secondSelectedCol].row = tempRow;
        this.grid[secondSelectedRow][secondSelectedCol].col = tempCol;

        this.stack = false;
    }

    /**
     * Проверяет есть ли незаполненные ячейки
     * Если есть, то смещаем элементы сверху вниз
     */
    checkFalling() {
        let fallDown = 0;

        for (let col = 0; col < this.countCols; col++) {
            for (let row = this.countRows - 1; row > 0; row--) {
                if (this.grid[row][col].value === this.emptyId && this.grid[row - 1][col].value >= 0) {
                    this.grid[row][col].value = this.grid[row - 1][col].value;
                    this.grid[row - 1][col].value = this.emptyId;

                    this.grid[row][col].item.setPosition(this.grid[row - 1][col].item.getPosition());
                    this.grid[row - 1][col].item.getComponent(Item).hideBody();

                    const isBomb = this.grid[row][col].value === BoardBomb.bombId;

                    this.grid[row][col].item.getComponent(Item).setItemData(this.grid[row][col].value, isBomb);

                    this.fallItems.push({
                        item: this.grid[row][col].item,
                        position: this.grid[row][col].item.getPosition()
                    });

                    fallDown++;
                }
            }
        }

        if (fallDown === 0) {
            Board.boardStage = BoardStage.BS_REFILL;

            this.checkAfterSwitch();
        } else {
            Board.boardStage = BoardStage.BS_ANIMATION_FALING;
        }
    }

    /**
     * Создаёт новые элементы в массиве, когда закончены все смещения
     * @returns 
     */
    createNewItems() {
        let countNewItems = 0;

        // Создаём новые элементы в самом верху, так как все элементы опускаются вниз
        for (let col = 0; col < this.countCols; col++) {
            const currentCol = this.grid[0][col];

            if (currentCol.value === this.emptyId) {
                currentCol.value = Math.floor(Math.random() * this.itemVariantCount);

                currentCol.item.getComponent(Item).setItemData(currentCol.value);

                countNewItems++;
            }
        }

        // Если новые элементы были созданы, проверяем есть ли что-то под ними, может им нужно упасть вниз
        if (countNewItems) {
            Board.boardStage === BoardStage.BS_REMOVE;
            this.checkFalling();
        } else {
            let isHaveEmpty = false;

            // Проверяем нет ли пустых ячеек на поле
            this.grid.forEach((row) => {
                row.forEach((col) => {
                    if (col.value === this.emptyId) {
                        isHaveEmpty = true;
                    }
                });
            });

            // Если пустые ячейки есть, запускаем падениние гемов
            if (isHaveEmpty) {
                Board.boardStage === BoardStage.BS_REMOVE;
                this.checkFalling();
                
                return;
            }

            let hasBomb = false;

            // Проверяем не стакнулась ли бомба
            for (let row = 0; row < this.countRows; row++) {
                for (let col = 0; col < this.countCols; col++) {
                    if (BoardBomb.isStackBomb(this.grid, row, col)) {
                        BoardBomb.createBomb(this.grid, row, col, this.emptyId, this.onCreateBomb.bind(this));

                        hasBomb = true;

                        break;
                    }
                }

                if (hasBomb) {
                    break;
                }
            }

            if (hasBomb) {
                return;
            }

            let combo = 0;

            // Проверяем не стакнулись ли элементы 3+ в ряд
            for (let row = 0; row < this.countRows; row++) {
                for (let col = 0; col < this.countCols; col++) {
                    if (this.grid[row][col].value === BoardBomb.bombId) {
                        continue;
                    }

                    if (col <= this.countCols - 3 && this.grid[row][col].value === this.grid[row][col + 1].value && this.grid[row][col].value === this.grid[row][col + 2].value) {
                        combo++;

                        this.removeItems(row, col);
                    }

                    if (row <= this.countRows - 3 && this.grid[row][col].value === this.grid[row + 1][col].value && this.grid[row][col].value === this.grid[row + 2][col].value) {
                        combo++;

                        this.removeItems(row, col);
                    }
                }
            }

            // Если стакнулись то запускаем анимации, добавляем очки, удаляем гемы
            if (combo > 0) {
                Board.boardStage === BoardStage.BS_REMOVE;

                this.scoreManager.addCombo();

                this.scheduleOnce(() => {
                    this.hideRemoveItems();
                }, 0.2);
            } else { // Иначе заканчиваем перемещение
                this.onSwitchEnd();
            }
        }
    }
}

class BoardComparison {
    /**
     * Количество строк
     */
    static countRows = 0;

    /**
     * Количество столбцов
     */
    static countCols = 0;

    /**
     * Устанавливает размер поля
     * @param countRows количество строк
     * @param countCols количество столбцов
     */
    static setGridSize(countRows: number, countCols: number) {
        BoardComparison.countRows = countRows || 0;
        BoardComparison.countCols = countCols || 0;
    }

    /**
     * Проверяет есть ли стакнутые элементы (3+ в ряде/столбце)
     * @param grid сетка с элементами для проверки
     * @param row индекс по вертикали проверяемого элемента
     * @param col индекс по горизонтали проверяемого элемента
     * @returns 
     */
    static isLineStacking(grid: Array<Array<GridItem>>, row: number, col: number) {
        if (grid[row][col].value === BoardBomb.bombId) {
            return false;
        }

        return BoardComparison.isVerticalLineStacking(grid, row, col) || BoardComparison.isHorizontalLineStacking(grid, row, col);
    }

    /**
     * Проверяет есть ли 3+ элемента в столбе
     * [1]
     * [1]
     * [1]
     * @param grid сетка с элементами для проверки
     * @param row индекс по вертикали проверяемого элемента
     * @param col индекс по горизонтали проверяемого элемента
     * @returns 
     */
    static isVerticalLineStacking(grid: Array<Array<GridItem>>, row: number, col: number) {
        let itemValue = grid[row][col].value;
        let streak = 0;
        let tempRow = row;
    
        while(tempRow > 0 && grid[tempRow - 1][col].value == itemValue){
            streak++;
            tempRow--;
        }
    
        tempRow = row;
    
        while(tempRow < BoardComparison.countRows - 1 && grid[tempRow + 1][col].value == itemValue){
            streak++;
            tempRow++;
        }
    
        return streak > 1;
    }

    /**
     * Проверяет есть ли 3+ элемента в строке
     * [1][1][1]
     * @param grid сетка с элементами для проверки
     * @param row индекс по вертикали проверяемого элемента
     * @param col индекс по горизонтали проверяемого элемента
     * @returns 
     */
    static isHorizontalLineStacking(grid: Array<Array<GridItem>>, row: number, col: number) {
        let itemValue = grid[row][col].value;
        let streak = 0;
        let tempCol = col;

        while(tempCol > 0 && grid[row][tempCol - 1].value == itemValue){
            streak++;
            tempCol--;
        }

        tempCol = col;

        while(tempCol < BoardComparison.countCols - 1 && grid[row][tempCol + 1].value == itemValue){
            streak++;
            tempCol++;
        }

        return streak > 1;
    }
}

class BoardBomb {
    /**
     * ID бомбы
     */
    static bombId = 100;

    /**
     * Позиция бомбы в момент создания
     */
    static bombPosition = {
        row: -1,
        col: -1
    }

    /**
     * Количество строк
     */
    static countRows = 0;

    /**
     * Количество столбцов
     */
    static countCols = 0;

    /**
     * Устанавливает размер поля
     * @param countRows количество строк
     * @param countCols количество столбцов
     */
    static setGridSize(countRows: number, countCols: number) {
        BoardBomb.countRows = countRows || 0;
        BoardBomb.countCols = countCols || 0;
    }

    static isStackBomb(grid: Array<Array<GridItem>>, row: number, col: number) {
        const isRightEqual = col + 1 === BoardBomb.countCols ? false : grid[row][col].value === grid[row][col + 1].value;
        const isLeftEqual = col === 0 ? false : grid[row][col].value === grid[row][col - 1].value;

        if (!isRightEqual && !isLeftEqual) {
            return false;
        }

        const isBottomEqual = row + 1 === BoardBomb.countRows ? false : grid[row][col].value === grid[row + 1][col].value;
        const isTopEqual = row === 0 ? false : grid[row][col].value === grid[row - 1][col].value;

        if (!isBottomEqual && !isTopEqual) {
            return false;
        }

        return BoardBomb.isStackBombRightBottom(grid, row, col) || 
            BoardBomb.isStackBombRightTop(grid, row, col) || 
            BoardBomb.isStackBombLeftBottom(grid, row, col) || 
            BoardBomb.isStackBombLeftTop(grid, row, col);
    }

    static isStackBombRightBottom(grid: Array<Array<GridItem>>, row: number, col: number) {
        const isRightEqual = col + 1 === BoardBomb.countCols ? false : grid[row][col].value === grid[row][col + 1].value;
        const isBottomEqual = row + 1 === BoardBomb.countRows ? false : grid[row][col].value === grid[row + 1][col].value;
        const isRightBottomEqual = !isRightEqual || !isBottomEqual ? false : grid[row][col].value === grid[row + 1][col + 1].value;
        
        return isRightEqual && isBottomEqual && isRightBottomEqual;
    }

    static isStackBombRightTop(grid: Array<Array<GridItem>>, row: number, col: number) {
        const isRightEqual = col + 1 === BoardBomb.countCols ? false : grid[row][col].value === grid[row][col + 1].value;
        const isTopEqual = row === 0 ? false : grid[row][col].value === grid[row - 1][col].value;
        const isRightTopEqual = !isRightEqual || !isTopEqual ? false : grid[row][col].value === grid[row - 1][col + 1].value;

        return isRightEqual && isTopEqual && isRightTopEqual;
    }

    static isStackBombLeftBottom(grid: Array<Array<GridItem>>, row: number, col: number) {
        const isLeftEqual = col === 0 ? false : grid[row][col].value === grid[row][col - 1].value;
        const isBottomEqual = row + 1 === BoardBomb.countRows ? false : grid[row][col].value === grid[row + 1][col].value;
        const isLeftBottomEqual = !isLeftEqual || !isBottomEqual ? false : grid[row][col].value === grid[row + 1][col - 1].value;

        return isLeftEqual && isBottomEqual && isLeftBottomEqual;
    }

    static isStackBombLeftTop(grid: Array<Array<GridItem>>, row: number, col: number) {
        const isLeftEqual = col === 0 ? false : grid[row][col].value === grid[row][col - 1].value;
        const isTopEqual = row === 0 ? false : grid[row][col].value === grid[row - 1][col].value;
        const isLeftTopEqual = !isLeftEqual || !isTopEqual ? false : grid[row][col].value === grid[row - 1][col - 1].value;

        return isLeftEqual && isTopEqual && isLeftTopEqual;
    }

    static createBomb(grid: Array<Array<GridItem>>, row: number, col: number, emptyId: number, callback: (moveItems: Array<MoveItem>) => void) {
        const moveItems: Array<MoveItem> = [];
        let isBomb = false;

        switch (true) {
            case BoardBomb.isStackBombRightBottom(grid, row, col):
                grid[row][col + 1].value = emptyId;
                grid[row + 1][col].value = emptyId;
                grid[row + 1][col + 1].value = emptyId;

                moveItems.push({
                    position: grid[row][col + 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row][col + 1].item.getPosition()),
                    item: grid[row][col + 1].item
                });

                moveItems.push({
                    position: grid[row + 1][col].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row + 1][col].item.getPosition()),
                    item: grid[row + 1][col].item
                });

                moveItems.push({
                    position: grid[row + 1][col + 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row + 1][col + 1].item.getPosition()),
                    item: grid[row + 1][col + 1].item
                });

                isBomb = true;

                break;
            case BoardBomb.isStackBombRightTop(grid, row, col):
                grid[row][col + 1].value = emptyId;
                grid[row - 1][col].value = emptyId;
                grid[row - 1][col + 1].value = emptyId;

                moveItems.push({
                    position: grid[row][col + 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row][col + 1].item.getPosition()),
                    item: grid[row][col + 1].item
                });

                moveItems.push({
                    position: grid[row - 1][col].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row - 1][col].item.getPosition()),
                    item: grid[row - 1][col].item
                });

                moveItems.push({
                    position: grid[row - 1][col + 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row - 1][col + 1].item.getPosition()),
                    item: grid[row - 1][col + 1].item
                });

                isBomb = true;

                break;
            case BoardBomb.isStackBombLeftBottom(grid, row, col):
                grid[row][col - 1].value = emptyId;
                grid[row + 1][col].value = emptyId;
                grid[row + 1][col - 1].value = emptyId;

                moveItems.push({
                    position: grid[row][col - 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row][col - 1].item.getPosition()),
                    item: grid[row][col - 1].item
                });

                moveItems.push({
                    position: grid[row + 1][col].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row + 1][col].item.getPosition()),
                    item: grid[row + 1][col].item
                });

                moveItems.push({
                    position: grid[row + 1][col - 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row + 1][col - 1].item.getPosition()),
                    item: grid[row + 1][col - 1].item
                });

                isBomb = true;

                break;
            case BoardBomb.isStackBombLeftTop(grid, row, col):
                grid[row][col - 1].value = emptyId;
                grid[row - 1][col].value = emptyId;
                grid[row - 1][col - 1].value = emptyId;

                moveItems.push({
                    position: grid[row][col - 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row][col - 1].item.getPosition()),
                    item: grid[row][col - 1].item
                });

                moveItems.push({
                    position: grid[row - 1][col].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row - 1][col].item.getPosition()),
                    item: grid[row - 1][col].item
                });

                moveItems.push({
                    position: grid[row - 1][col - 1].item.getPosition(),
                    target: grid[row][col].item.getPosition().subtract(grid[row - 1][col - 1].item.getPosition()),
                    item: grid[row - 1][col - 1].item
                });

                isBomb = true;

                break;
        }

        if (isBomb) {
            BoardBomb.bombPosition.row = row;
            BoardBomb.bombPosition.col = col;

            grid[row][col].value = BoardBomb.bombId;

            callback(moveItems);
        }
    }

    static explosionBomb(grid: Array<Array<GridItem>>, row: number, col: number, emptyId: number, callback: () => void) {
        const otherBombs = [];
        grid[row][col].value = emptyId;

        // Проверяем что с нужной стороны не пусто, и убираем ячейку

        // Справа
        if (col + 1 !== BoardBomb.countCols) {
            if (grid[row][col + 1].value === BoardBomb.bombId) {
                otherBombs.push({
                    row,
                    col: col + 1
                })
            }

            grid[row][col + 1].value = emptyId;
        }

        // Слева
        if (col !== 0) {
            if (grid[row][col - 1].value === BoardBomb.bombId) {
                otherBombs.push({
                    row,
                    col: col - 1
                })
            }

            grid[row][col - 1].value = emptyId;
        }

        // Снизу
        if (row + 1 !== BoardBomb.countRows) {
            if (grid[row + 1][col].value === BoardBomb.bombId) {
                otherBombs.push({
                    row: row + 1,
                    col
                })
            }

            grid[row + 1][col].value = emptyId;
        }

        // Сверху
        if (row !== 0) {
            if (grid[row - 1][col].value === BoardBomb.bombId) {
                otherBombs.push({
                    row: row - 1,
                    col
                })
            }
            
            grid[row - 1][col].value = emptyId;
        }

        // Нижний правый угол
        if (col + 1 !== BoardBomb.countCols && row + 1 !== BoardBomb.countRows) {
            if (grid[row + 1][col + 1].value === BoardBomb.bombId) {
                otherBombs.push({
                    row: row + 1,
                    col: col + 1
                })
            }
            
            grid[row + 1][col + 1].value = emptyId;
        }

        // Нижний левый угол
        if (col !== 0 && row + 1 !== BoardBomb.countRows) {
            if (grid[row + 1][col - 1].value === BoardBomb.bombId) {
                otherBombs.push({
                    row: row + 1,
                    col: col - 1
                })
            }
            
            grid[row + 1][col - 1].value = emptyId;
        }

        // Верхний левый угол
        if (col !== 0 && row !== 0) {
            if (grid[row - 1][col - 1].value === BoardBomb.bombId) {
                otherBombs.push({
                    row: row - 1,
                    col: col - 1
                })
            }
            
            grid[row - 1][col - 1].value = emptyId;
        }

        // Верхний правый угол
        if (col + 1 !== BoardBomb.countCols && row !== 0) {
            if (grid[row - 1][col + 1].value === BoardBomb.bombId) {
                otherBombs.push({
                    row: row - 1,
                    col: col + 1
                })
            }
            
            grid[row - 1][col + 1].value = emptyId;
        }

        Board.gameObject.selectedType = BombEffect.BE_NONE;
        Board.gameObject.secondType = BombEffect.BE_NONE;

        if (otherBombs.length) {
            BoardBomb.explosionBomb(grid, otherBombs[0].row, otherBombs[0].col, emptyId, callback);
        } else {
            Board.boardStage = BoardStage.BS_REMOVE;

            callback();
        }
    }
}

class BoardGenerator {
    private grid: Array<Array<GridItem>> = [];
    private backgroundBoard: Node | null = null;
    private countCols = 0;
    private countRows = 0;
    private cellSize = 0;
    private padding = 0;
    private emptyId = -1;
    private itemVariantCount = 0;
    private parentNode: Node;
    private itemPrefab: Prefab;
    private tilePrefab: Prefab;

    constructor(params) {
        this.backgroundBoard = params.backgroundBoard;
        this.countCols = params.countCols || 0;
        this.countRows = params.countRows || 0;
        this.cellSize = params.cellSize || 0;
        this.padding = params.padding || 0;
        this.itemVariantCount = params.itemVariantCount || 0;
        this.parentNode = params.parentNode;
        this.itemPrefab = params.itemPrefab;
        this.tilePrefab = params.tilePrefab;
    }

    /**
     * Устанавливаем размер фона
     */
    public setBackgroudSize() {
        if (!this.backgroundBoard) {
            return;
        }

        const width = this.countCols * this.cellSize + this.countCols * this.padding;
        const height = this.countRows * this.cellSize + this.countRows * this.padding;

        this.backgroundBoard.getComponent(UITransform).setContentSize(width, height);
    }

    /**
     * Заполняем доску элементами
     */
    public createGrid() {
        for (let row = 0; row < this.countRows; row++) {
            this.grid[row] = [];

            for (let col = 0; col < this.countCols; col++) {
                this.grid[row][col] = {
                    size: this.cellSize - this.padding,
                    value: this.emptyId,
                    row,
                    col
                };
            }
        }

        let posX = -this.cellSize * this.countCols / 2 - this.cellSize / 2;
        let posY = this.cellSize * this.countRows / 2 - this.cellSize / 2;
        let startX = posX;

        for (let row = 0; row < this.countRows; row++) {
            for (let col = 0; col < this.countCols; col++) {
                const gridItem = this.grid[row][col];

                posX += this.cellSize;

                gridItem.value = Math.floor(Math.random() * this.itemVariantCount);

                while (BoardComparison.isLineStacking(this.grid, row, col) || BoardBomb.isStackBomb(this.grid, row, col)) {
                    gridItem.value = Math.floor(Math.random() * this.itemVariantCount);
                }

                this.spawnTile(posX, posY);

                let item: Node | null = this.spawnItem(posX, posY);

                const itemController = item.getComponent(Item);

                itemController.setItemData(gridItem.value);
                itemController.setBodySize(gridItem.size);

                gridItem.item = item;
            }

            posX = startX;
            posY -= this.cellSize;
        }
    }

    /**
     * Возвращает доску с элементами
     * @returns 
     */
    public getGrid() {
        return this.grid;
    }

    /**
     * Создаём экземпляр элемента (фрукта)
     * @param posX 
     * @param posY 
     * @returns 
     */
    private spawnItem(posX: number, posY: number) {
        if (!this.itemPrefab) {
            return;
        }

        const item = instantiate(this.itemPrefab);

        this.parentNode.addChild(item);

        item.setPosition(posX, posY, 0);

        return item;
    }

    /**
     * Создаём экземпляр ячейки (фона фрукта)
     * @param posX 
     * @param posY 
     */
    private spawnTile(posX: number, posY: number) {
        if (!this.tilePrefab || !this.backgroundBoard) {
            return;
        }

        const tile = instantiate(this.tilePrefab);
        const transformTile = tile.getComponent(UITransform);

        this.backgroundBoard.addChild(tile);

        tile.setPosition(posX, posY, 0);

        transformTile.setContentSize(this.cellSize, this.cellSize);
    }
}

class BoardItems {
    private _grid: Array<Array<GridItem>> = [];
    private switchSound: AudioClip;
    private countCols = 0;
    private countRows = 0;
    private emptyId = -1;
    private bombId = 100;
    private cellSize = 0;
    private cursor: Node;

    public set grid(newGrid: Array<Array<GridItem>>) {
        this._grid = newGrid;
    }

    public get grid() {
        return this._grid;
    }

    constructor(params) {
        this.switchSound = params.switchSound;
        this.countCols = params.countCols;
        this.countRows = params.countRows;
        this.emptyId = params.emptyId;
        this.bombId = params.bombId;
        this.cellSize = params.cellSize;
        this.cursor = params.cursor;
    }

    /**
     * Генерируем события (клик по элементу)
     */
    generateEvents() {
        this._grid.forEach((row) => {
            row.forEach((element) => {
                element.item.on(Input.EventType.MOUSE_DOWN, () => {
                    this.onItemClick(element);
                }, this)
            });
        });
    }

    /**
     * Обрабатываем событие клика по элементу (фрукту)
     * @param item 
     */
    onItemClick(item) {
        if (Board.boardStage !== BoardStage.BS_PICK) {
            return;
        }

        const { row, col } = item;
        const isSamePosition = Board.gameObject.selectedRow === row && Board.gameObject.selectedCol === col;

        if (isSamePosition) {
            return;
        }

        if (Board.gameObject.selectedRow === this.emptyId) {
            this.itemSelected(item);

            return;
        }

        const isVerticalNear = Math.abs(Board.gameObject.selectedRow - row) === 1 && Board.gameObject.selectedCol === col;
        const isHorisontalNear = Math.abs(Board.gameObject.selectedCol - col) === 1 && Board.gameObject.selectedRow === row;

        if (isVerticalNear || isHorisontalNear) {
            this.saveGameObjectData(row, col);
            this.hideCursor();

            if (Board.audioManager && this.switchSound) {
                Board.audioManager.playOneShot(this.switchSound, 0.5);
            }

            Board.boardStage = BoardStage.BS_MOVE;

            return;
        }

        this.itemSelected(item);
    }

    /**
     * Устанавливаем новый выбранный элемент
     * @param item
     */
    itemSelected(element) {
        Board.gameObject.selectedRow = element.row;
        Board.gameObject.selectedCol = element.col;
        
        this._grid.forEach((row) => {
            row.forEach((col) => {
                if (col.value !== BoardBomb.bombId) {
                    col.item.getComponent(Item).changeState(ItemState.STATE_DEFAULT);
                }
            });
        });

        if (this._grid[element.row][element.col].value !== BoardBomb.bombId) {
            element.item.getComponent(Item).changeState(ItemState.STATE_SELECTED);
        }

        this.showCursor();
    }

    /**
     * 
     * @returns Показывает курсор
     */
    showCursor() {
        if (!this.cursor) {
            return;
        }

        let posX = (-this.cellSize * this.countCols / 2 - this.cellSize / 2) + this.cellSize * (Board.gameObject.selectedCol + 1);
        let posY = (this.cellSize * this.countRows / 2 - this.cellSize / 2) - this.cellSize * Board.gameObject.selectedRow;

        this.cursor.setPosition(posX, posY);
        this.cursor.setScale(1, 1);
    }

    /**
     * Скрывает курсор
     */
    hideCursor() {
        this.cursor.setScale(0, 0);
    }

    /**
     * Сохроняем данные игрового объекта
     */
    saveGameObjectData(row: number, col: number) {
        Board.gameObject.secondSelectedCol = col;
        Board.gameObject.secondSelectedRow = row;

        Board.gameObject.yOffset = Board.gameObject.selectedRow - row;
        Board.gameObject.xOffset = Board.gameObject.selectedCol - col;

        Board.gameObject.selectedPosition = this._grid[Board.gameObject.selectedRow][Board.gameObject.selectedCol].item.getPosition();
        Board.gameObject.secondSelectedPosition = this._grid[row][col].item.getPosition();

        if (this._grid[row][col].value === BoardBomb.bombId) {
            Board.gameObject.secondType = BombEffect.BE_BOMB;
        } else {
            Board.gameObject.secondType = BombEffect.BE_NONE;
        }

        if (this._grid[Board.gameObject.selectedRow][Board.gameObject.selectedCol].value === BoardBomb.bombId) {
            Board.gameObject.selectedType = BombEffect.BE_BOMB;
        } else {
            Board.gameObject.selectedType = BombEffect.BE_NONE;
        }
    }
}

class BoardAnimations {
    /**
     * Размер ячейки
     */
    private cellSize = 0;

    /**
     * Данные для анимации перемещения элементов
     */
    private switchAnimation: AnimationData = {
        currentTime: 0,
        speed: 0.5,
        callbacks: null
    };

    /**
     * Данные для анимации падения (спускания) элементов
     */
    private fallAnimation: AnimationData = {
        currentTime: 0,
        speed: 0.5,
        callbacks: null
    };

    /**
     * Данные для анимации стака (сбор бомбы и т.п. из гемов)
     */
    private moveAnimation: AnimationData = {
        currentTime: 0,
        speed: 0.5,
        callbacks: null
    }

    constructor(params) {
        this.cellSize = params.cellSize;
        this.switchAnimation = params.switchAnimation;
        this.fallAnimation = params.fallAnimation;
        this.moveAnimation = params.moveAnimation;
    }

    /**
     * Анимация движения элементов (меняем местами фрукты)
     * @param deltaTime 
     */
    switch(deltaTime: number, grid: Array<Array<GridItem>>, isRevertMove: boolean) {
        const { 
            selectedRow, 
            selectedCol, 
            secondSelectedRow, 
            secondSelectedCol, 
            secondSelectedPosition, 
            selectedPosition, 
            xOffset,
            yOffset
        } = Board.gameObject;

        const lastItem = grid[selectedRow][selectedCol].item;
        const prevItem = grid[secondSelectedRow][secondSelectedCol].item;

        this.switchAnimation.currentTime += deltaTime;

        if (this.switchAnimation.currentTime > this.switchAnimation.speed) {
            Board.boardStage = BoardStage.BS_REVERT;

            this.switchAnimation.currentTime = 0;

            // меняем элементы в сетке
            const temp = grid[selectedRow][selectedCol];
            grid[selectedRow][selectedCol] = grid[secondSelectedRow][secondSelectedCol];
            grid[secondSelectedRow][secondSelectedCol] = temp;

            const lastItemTarget = new Vec3(selectedPosition.x + xOffset * -1 * this.cellSize, selectedPosition.y + yOffset * this.cellSize);
            const prevItemTarget = new Vec3(secondSelectedPosition.x + xOffset * this.cellSize, secondSelectedPosition.y + yOffset * -1 * this.cellSize);

            lastItem.setPosition(lastItemTarget);
            prevItem.setPosition(prevItemTarget);

            if (isRevertMove) {
                this.switchAnimation.callbacks?.revert();
            } else {
                this.switchAnimation.callbacks?.end();
            }
        } else {
            // move
            const percent = this.switchAnimation.currentTime / this.switchAnimation.speed;
            const lastItemTarget = new Vec3(selectedPosition.x + xOffset * -1 * this.cellSize * percent, selectedPosition.y + yOffset * this.cellSize * percent);
            const prevItemTarget = new Vec3(secondSelectedPosition.x + xOffset * this.cellSize  * percent, secondSelectedPosition.y + yOffset * -1 * this.cellSize * percent);

            lastItem.setPosition(lastItemTarget);
            prevItem.setPosition(prevItemTarget);
        }
    }

    /**
     * Анимация падения элементов (фруктов)
     * @param deltaTime 
     */
    fall(deltaTime: number, fallItems: Array<FallItem>) {
        this.fallAnimation.currentTime += deltaTime;

        if (this.fallAnimation.currentTime > this.fallAnimation.speed) {
            this.fallAnimation.currentTime = 0;

            fallItems.forEach((fallItem) => {
                fallItem.item.setPosition(fallItem.position.x, fallItem.position.y - this.cellSize);
            });

            this.fallAnimation.callbacks?.end();
        } else {
            const percent = this.fallAnimation.currentTime / this.fallAnimation.speed;

            fallItems.forEach((fallItem) => {
                fallItem.item.setPosition(fallItem.position.x, fallItem.position.y - this.cellSize * percent);
            });
        }
    }

    moveToTarget(deltaTime: number, items: Array<MoveItem>) {
        this.moveAnimation.currentTime += deltaTime;

        if (this.moveAnimation.currentTime > this.moveAnimation.speed) {
            this.moveAnimation.currentTime = 0;

            items.forEach((moveItem) => {
                moveItem.item.getComponent(Item).hideBody();
                moveItem.item.setPosition(moveItem.position);
            });

            this.moveAnimation.callbacks?.end();
        } else {
            const percent = this.moveAnimation.currentTime / this.moveAnimation.speed;

            items.forEach((moveItem) => {
                const target = new Vec3(moveItem.target.x * percent, moveItem.target.y * percent);

                moveItem.item.setPosition(moveItem.position.x + target.x, moveItem.position.y + target.y);
            });
        }
    }
}
