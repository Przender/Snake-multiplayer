const Snake = require("./snakeLogic");
const Fruits = require("./fruitLogic");

// CLASS

class SingleGame {

    // public logic

    constructor() {
        this.snake = new Snake([
            {x: 1, y: 0},
            {x: 0, y: 0},
            {x: 11, y: 0},
        ]);
        this.fruits = new Fruits();
        this.gamestate = 'inactive'
    }

    start() {
        this.gamestate = 'running'
        this.fruits.generateFruit([this.snake]);
        this.ouch = null;
    }

    tick(dir) {
        if (this.gamestate !== 'running') return;

        const { ateFruit, ouch } = this.snake.move(dir, this.fruits);
        this.ouch = ouch;

        let genResult = null;
        if(ateFruit){
            genResult = this.fruits.generateFruit([this.snake]);
        }

        // check whether the game should end
        if(genResult !== null){
            this.gamestate = genResult;
        } else if(this.ouch !== null){
            this.gamestate = 'lost'
        }
    }

    stop() {
        this.gamestate = 'inactive'
    }

    getBoards() {
        let bottom  = this.snake.toArray();
        let top     = this.fruits.toArray();
        if(this.ouch !== null){
            top[this.ouch.y][this.ouch.x] = {
                content: 'ouch',
                rotation: this.ouch.rotation
            }
        }

        return { top, bottom };
    }
}

module.exports = SingleGame;
