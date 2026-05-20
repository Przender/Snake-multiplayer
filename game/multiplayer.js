const Snake = require("./snakeLogic");
const Fruits = require("./fruitLogic");

// CONSTANTS

const endgameStates = Object.freeze(new Set(['lostBoth', 'lost1', 'lost2', 'destroyed']))

// HELPERS

function getEmptyBoard(boardSize = 12) {
    const array = [];
    for (let y = 0; y < boardSize; y++) {
        array.push([]);
        for (let x = 0; x < boardSize; x++) {
            array[y].push({ content: '' });
        }
    }
    return array;
}

function key(fruit){ return `${fruit.x},${fruit.y}`; }

function parseKey(key) { 
    const [x, y] = key.split(',').map(Number); 
    return { x, y }; 
}

// CLASS

class MultiGame {

    // public logic

    constructor() {
        this.snake = new Snake([
            {x: 2, y: 0},
            {x: 1, y: 0},
            {x: 0, y: 0},
        ]);
        this.snake2 = new Snake([
            {x: 9, y: 11},
            {x: 10, y: 11},
            {x: 11, y: 11},
        ], '2');
        this.fruits = new Fruits();
        this.gamestate = 'pregame'
    }

    start() {
        this.gamestate = 'running'
        this.fruits.generateFruit([this.snake, this.snake2]);
        this.ouch = null;
        this.ouch2 = null;
    }

    tick(dir, dir2) {
        if (this.gamestate !== 'running') return;

        let moveRes = this.snake.move(dir, this.fruits);
        let moveRes2 = this.snake2.move(dir2, this.fruits);
        
        this.ouch = moveRes.ouch;
        this.ouch2 = moveRes2.ouch;

        let collRes = Snake.checkCollision(this.snake, this.snake2);

        if(this.ouch === null){
            this.ouch = collRes.ouch;
        }
        if(this.ouch2 === null){
            this.ouch2 = collRes.ouch2;
        }

        let genResult = null;
        if(moveRes.ateFruit || moveRes2.ateFruit){
            genResult = this.fruits.generateFruit([this.snake, this.snake2], 'multiplayer');
        }

        // check whether the game should end
        if(genResult !== null){
            this.gamestate = genResult;
        } 
        else if(this.ouch !== null || this.ouch2 !== null){

            if(this.ouch !== null && this.ouch2 !== null){
                this.gamestate = 'lostBoth';
            } 
            else if(this.ouch !== null){
                this.gamestate = 'lost1';
            } 
            else this.gamestate = 'lost2';
        }
    }

    getBoards() {
        let bottom    = this.snake.toArray();
        let top       = this.snake2.toArray();
        let topper    = this.fruits.toArray();

        const placeOuch = (board, ouch, type) => {
            if(!ouch) return;
            board[ouch.y][ouch.x] = {
                content: type,
                rotation: ouch.rotation
            };
        }

        // if both ouch exist and are on the same coordinate
        if (this.ouch !== null && this.ouch2 !== null && 
            this.ouch.x === this.ouch2.x && 
            this.ouch.y === this.ouch2.y) {
            
            // if they'd bump into each other on top of snake2
            if(top[this.ouch.y][this.ouch.x].content !== ''){
                ({ bottom, top } = { top, bottom })
            }

            top[this.ouch.y][this.ouch.x] = { content: 'ouch', rotation: this.ouch.rotation };
            topper[this.ouch2.y][this.ouch2.x] = { content: 'ouch2', rotation: this.ouch2.rotation };
        } 
        else{
            if(this.ouch !== null){
                placeOuch(topper, this.ouch, 'ouch');
            }
            if(this.ouch2 !== null){
                placeOuch(topper, this.ouch2, 'ouch2');
            }
        }

        return { bottom, top, topper };
    }

    gameEnded() {
        return endgameStates.has(this.gamestate);
    }
}

module.exports = MultiGame;
