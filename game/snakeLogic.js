const Fruits = require('./fruitLogic');

// constants

const snakeParts = Object.freeze(new Set(['head', 'body', 'turn', 'tail']));
const directions = Object.freeze(new Set(['up', 'down', 'left', 'right']));
const BOARD_SIZE = 12;

// helpers

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

const modulo = (val, mod) => {
    while(val < 0){
        val += mod;
    }
    return val % mod;
}

const modulo12 = val => modulo(val, 12);

    // coordsToSnake

function delta(a, b) {
    let d = a - b;
    if (d > BOARD_SIZE / 2) return d - BOARD_SIZE;
    if (d < -BOARD_SIZE / 2) return d + BOARD_SIZE;
    return d;
}

function parseHeadRotation(head, next){
    let dx = delta(head.x, next.x);
    let dy = delta(head.y, next.y);

    if(dy > 0) return 0;
    if(dy < 0) return 180;
    if(dx > 0) return 90;
    return 270;
}

function parseBody(prev, curr, next, suffix){
    let dxPrev = delta(curr.x, prev.x);
    let dyPrev = delta(curr.y, prev.y);

    let dxNext = delta(next.x, curr.x);
    let dyNext = delta(next.y, curr.y);

    // straight vertical
    if(dxPrev === 0 && dxNext === 0){
        return { content: 'body'.concat(suffix), rotation: dyNext > 0 ? 180 : 0 };
    }

    // straight horizontal
    if(dyPrev === 0 && dyNext === 0){
        return { content: 'body'.concat(suffix), rotation: dxNext > 0 ? 270 : 90 };
    }

     // determine directions
    const dirPrev = dxPrev === 0 ? (dyPrev > 0 ? 'down' : 'up') : (dxPrev > 0 ? 'right' : 'left');
    const dirNext = dxNext === 0 ? (dyNext > 0 ? 'down' : 'up') : (dxNext > 0 ? 'right' : 'left');

    // turn
    // define rotation for each combination
    const turnRotationMap = {
        'up->right':    90,
        'right->up':    270,
        'up->left':     180,
        'left->up':     0,
        'down->right':  0,
        'right->down':  180,
        'down->left':   270,
        'left->down':   90,
    };

    const key = `${dirPrev}->${dirNext}`;
    const rotation = turnRotationMap[key];
    if(rotation === undefined){
        throw new Error(`Impossible turn from ${dirPrev} to ${dirNext}`);
    }

    return { content: 'turn'.concat(suffix), rotation };
}

function parseTailRotation(prev, tail){
    let dx = delta(prev.x, tail.x);
    let dy = delta(prev.y, tail.y);

    if(dy > 0) return 180;
    if(dy < 0) return 0;
    if(dx > 0) return 90;
    return 270;
}

    // move
function dirToRotation(dir){
    switch(dir){
        case 'up':      return 0;
        case 'right':   return 90;
        case 'down':    return 180;
        case 'left':    return 270;
        default:        throw new Error('illegal direction');
    }
}

function rotationToDir(rotation){
    switch(rotation){
        case 0:     return 'up';
        case 90:    return 'right';
        case 180:   return 'down';
        case 270:   return 'left';
        default:    throw new Error('illegal rotation');
    }
}

function addDir(x, y, dir){
    if(dir === 'up') 
        return { x: x, y: modulo12(y-1) }

    if(dir === 'down') 
        return { x: x, y: modulo12(y+1) }

    if(dir === 'left') 
        return { x: modulo12(x-1), y: y }

    if(dir === 'right') 
        return { x: modulo12(x+1), y: y }

    if(dir === 'still')
        return {x, y}

    return {x, y}
}

function key(part){ return `${part.x},${part.y}`; }

function parseKey(key) { 
    const [x, y] = key.split(',').map(Number); 
    return { x, y }; 
}

// class

class Snake{

    constructor(coords, suffix = ''){
        this.snake = this.coordsToSnake(coords);
        this.suffix = suffix;
    }

    getSnake(){
        return this.snake;
    }

    coordsToSnake(coords){
        if(coords.length < 2) throw new Error("Snake must have at least 2 segments");

        let snake = [];
        snake.push({ 
            x: coords[0].x,
            y: coords[0].y,
            content: 'head'.concat(this.suffix), 
            rotation: parseHeadRotation(coords[0], coords[1]) 
        });
        
         for(let i = 1; i < coords.length - 1; i++){
            snake.push({
                x: coords[i].x,
                y: coords[i].y,
                ...parseBody(coords[i-1], coords[i], coords[i+1], this.suffix)
            });
        }

        snake.push({
            x: coords[coords.length - 1].x,
            y: coords[coords.length - 1].y,
            content: 'tail'.concat(this.suffix),
            rotation: parseTailRotation(coords[coords.length - 2], coords[coords.length - 1])
        });

        return snake;
    }

    snakeToCoordSet() {
        const set = new Set();
        for(const part of this.snake){
            set.add(`${part.x},${part.y}`);
        }
        return set;
    }

    toArray() {
        let board = getEmptyBoard();
        for(const part of this.snake){
            board[part.y][part.x] = { content: part.content, rotation: part.rotation };
        }
        return board;
    }

    move(dir, fruits) {
        if(!directions.has(dir)) throw new Error("Incorrect direction");

        const head = this.snake[0];
        
        // avoid reversing in place
        if(Math.abs(dirToRotation(dir) - head.rotation) === 180){
            dir = rotationToDir(head.rotation);
        }

        // create new head
        const nextCoords = addDir(head.x, head.y, dir);
        const next = {
            x: nextCoords.x,
            y: nextCoords.y,
            content: 'head'.concat(this.suffix), 
            rotation: dirToRotation(dir)
        };

        // switch old head for a body of a turn
        this.snake[0] = {
            x: head.x,
            y: head.y,
            ...parseBody(next, head, this.snake[1], this.suffix)
        }

        // check for collision with itself
        let ouch = null;
        const willGrow = fruits.hasFruit(nextCoords);
        
        const collision = this.snake.some((part, index) => {
            if (!willGrow && index === this.snake.length - 1) {
                return false;
            }
            return part.x === next.x && part.y === next.y;
        });

        if(collision){
            // ouch will be added on a higher layer instead of the head
            ouch = next;
            ouch.content = 'ouch'.concat(this.suffix);
        } else {
            // add new head to the snake
            this.snake.unshift(next);
        }

        // update tail and check ia any fruits were eaten
        let ateFruit = false;
        if(!willGrow){
            this.snake.pop();

            let tail = this.snake[this.snake.length - 1];
            let prev = this.snake[this.snake.length - 2];
            tail.content = 'tail'.concat(this.suffix);
            tail.rotation = parseTailRotation(prev, tail);
        } else{
            ateFruit = true;
            fruits.deleteFruit(nextCoords);
        }

        return { ateFruit, ouch };
    }

    static checkCollision(snake, snake2){
        let set = snake.snakeToCoordSet();
        let set2 = snake2.snakeToCoordSet();

        let snakeArr = snake.snake;
        let snakeArr2 = snake2.snake;

        let ouch = null;
        let ouch2 = null;
        if(set.has(key(snakeArr2[0]))){
            ouch2 = { ...snakeArr2[0] };
            snake2.snake.shift();
            ouch2.content = 'ouch';
        }

        if(set2.has(key(snakeArr[0]))){
            ouch = { ...snakeArr[0] };
            snake.snake.shift();
            ouch.content = 'ouch';
        }

        return { ouch, ouch2 };
    }
}

module.exports = Snake;