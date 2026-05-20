const Snake = require('./snakeLogic');

// constants

const fullSet = allCoordsSet();

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

function allCoordsSet(boardSize = 12) {
    const set = new Set();
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            set.add(`${x},${y}`);
        }
    }
    return set;
}

function intersectSets(sets) {
    if (sets.length === 0) return new Set();

    return sets.reduce(
        (acc, set) => new Set([...acc].filter(x => set.has(x)))
    );
}

function unionSets(sets) {
    return sets.reduce(
        (acc, set) => new Set([...acc, ...set]), 
        new Set()
    );
}

function differenceOfSets(a, b) {
    return new Set([...a].filter(x => !b.has(x)));
}

function key(fruit){ return `${fruit.x},${fruit.y}`; }

function parseKey(key) { 
    const [x, y] = key.split(',').map(Number); 
    return { x, y }; 
}

// class

class Fruits {

    constructor(){
        this.fruits = new Set();
    }

    getFruits(){
        return this.fruits;
    }

    addFruit(fruit){
        this.fruits.add(`${fruit.x},${fruit.y}`);
    }

    hasFruit(fruit){
        return this.fruits.has(`${fruit.x},${fruit.y}`);
    }

    deleteFruit(fruit){
        return this.fruits.delete(`${fruit.x},${fruit.y}`);
    }

    size(){
        return this.fruits.size;
    }

    generateFruit(snakes, mode='singleplayer'){
        let snakeTiles = unionSets(
            snakes.map(snake => snake.snakeToCoordSet())
        );
        let occupiedTiles = unionSets([snakeTiles, this.fruits]);
        let freeTiles = differenceOfSets(fullSet, occupiedTiles);

        if(freeTiles.size === 0){
            if(this.size() === 0){
                if(mode === 'singleplayer')
                    return 'won';
                else return 'tie';
            }
            return null;
        }

        const freeArray = [...freeTiles];
        const fruit = freeArray[Math.floor(Math.random() * freeArray.length)];
        this.fruits.add(fruit);
        return null;
    }

    toArray() {
        let board = getEmptyBoard();
        let array = [...this.fruits]

        for(let fruit of array){
            fruit = parseKey(fruit);
            board[fruit.y][fruit.x] = { content: 'fruit', rotation: 0 };
        }
        return board;
    }
}

module.exports = Fruits;