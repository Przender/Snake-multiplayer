const crypto    = require('crypto');
const MultiGame = require('./game/multiplayer.js');

// helpers

function rotationToDir(rotation){
    switch(rotation){
        case 0:     return 'up';
        case 90:    return 'right';
        case 180:   return 'down';
        case 270:   return 'left';
        default:    throw new Error('illegal rotation');
    }
}

/*  Player ID's:
    0 - watcher
    1 - player 1
    2 - palyer 2
*/

// class
class MultiplayerRoom {
    #io;

    constructor(io, data) {
        // fields initialization
        this.roomID     = crypto.randomUUID();
        this.players    = {
            1: { key: null, socket: undefined },
            2: { key: null, socket: undefined }
        };

        this.ready      = new Set();
        this.game       = new MultiGame();
        this.moves      = {
            1: rotationToDir(this.game.snake.snake[0].rotation),
            2: rotationToDir(this.game.snake2.snake[0].rotation)
        }

        this.#io        = io;
        this.disconnectTimers = new Map();

        // lobby data

        this.name       = data.name;
        this.password   = data.password;
        this.watchable  = data.watchable;
        this.isPrivate  = data.isPrivate;
        this.watchers   = [];

        this.onDestroy          = data.onDestroy;
        this.removeFromJoin     = data.removeFromJoin;
        this.removeOldPointers  = data.removeOldPointers;

        // setup interval

        this.interval = setInterval(() => {
            if(this.gamestate() === 'running'){
                const { 1: dir1, 2: dir2 } = this.moves;
                this.game.tick(dir1, dir2);
                this.#io.to(this.roomID).emit('game:board', this.game.getBoards());
            } else this.#handleGameEnd();
        }, 200);
    }

    gamestate() {
        return this.game.gamestate;
    }

    #handleGameEnd() {
        switch(this.game.gamestate){
            case 'lostBoth' :  
                this.#io.to(this.roomID).emit('game:lostBoth');
                this.destroy();
                break;
            case 'lost1' : 
                this.players[1].socket.emit('game:lost');
                this.players[2].socket.emit('game:won');
                for(let watcher of this.watchers){
                    if(!this.disconnectTimers[watcher.key])
                        watcher.socket.emit('game:player1-won');
                    else this.forceDisconnect(watcher.key, 0);
                }
                this.destroy();
                break;
            case 'lost2' : 
                this.players[2].socket.emit('game:lost');
                this.players[1].socket.emit('game:won');
                for(let watcher of this.watchers){
                    if(!this.disconnectTimers[watcher.key])
                        watcher.socket.emit('game:player2-won');
                    else this.forceDisconnect(watcher.key, 0);
                }
                this.destroy();
                break;
            case 'tie':
                this.#io.to(this.roomID).emit('game:tied');
                this.destroy();
                break;
            default     :
                break;
        };
    }

    destroy(playersDisconnected = 0) {
        clearInterval(this.interval);
        this.game.gamestate = 'destroyed';

        for(const id of [1, 2]){
            const player = this.players[id];
            if(player.socket){
                player.socket.emit('multiplayer:forgetRoomData');
                player.socket = undefined;
            }
            player.key = null;
        }

        for(let watcher of this.watchers) {
            if(watcher.socket){
                watcher.socket.emit('multiplayer:forgetRoomData');
                watcher.socket = undefined;
            }
            watcher.key = null;
        }

        this.onDestroy(this.roomID);

        if(playersDisconnected === 1)
            this.#io.to(this.roomID).emit('multiplayer:opponentDisconnected');

        if(playersDisconnected === 2)
            this.#io.to(this.roomID).emit('multiplayer:bothPlayersDisconnected');

        this.#io.of(this.roomID).socketsLeave(this.roomID);
    }

    watch(socket) {
        const watcherKey = crypto.randomUUID();
        socket.handshake.session.playerKey = watcherKey;
        socket.handshake.session.roomID = this.roomID;

        socket.room = this;
        socket.join(this.roomID);

        socket.playerID = 0;

        this.watchers.push({ key: watcherKey, socket });

        this.#assignRoomData(socket, 0);

        socket.handshake.session.playerID = 0;
        socket.handshake.session.save();

        return true;
    }

    leaveWatch(socket){
        if(socket.handshake.session.roomID) {
            delete socket.handshake.session.roomID;

            socket.room = undefined;
            socket.leave(this.roomID);

            socket.playerID = undefined;

            const watcherKey = socket.handshake.session.playerKey;
            this.watchers = this.watchers.filter(w => w.key !== watcherKey );
            delete socket.handshake.session.playerKey;
            
            socket.emit('multiplayer:forgetRoomData');

            delete socket.handshake.session.playerID;
            socket.handshake.session.save();
        }
    }

    join(socket) {
        if(socket.handshake.session.playerKey) {
            return this.handleReconnect(socket);
        }

        if(this.players[1].key !== null && this.players[2].key !== null)
            return { success: false, cause: "game started" };


        const playerKey = crypto.randomUUID();
        socket.handshake.session.playerKey = playerKey;
        socket.handshake.session.roomID = this.roomID;

        socket.room = this;
        socket.join(this.roomID);

        const playerID = this.players[1].key === null ? 1 : 2;

        // MultRoom-side
        this.players[playerID] = {
            key: playerKey,
            socket
        };

        // socket-side
        socket.playerID = playerID;
        this.#assignRoomData(socket, playerID);

        //session-side
        socket.handshake.session.playerID = playerID;
        socket.handshake.session.save();

        if(this.players[1].key && this.players[2].key) {
            console.log('Removing room from join:', this.roomID);
            this.removeFromJoin(this.roomID);
        }
        return { success: true };
    }

    handleReconnect(socket) {
        if(this.game.gameEnded() === true){
            this.removeOldPointers(socket);
            return { success: false, cause: 'game ended' };
        }

        const playerKey = socket.handshake.session.playerKey;
        const playerID = socket.handshake.session.playerID;

        socket.room = this;
        socket.join(this.roomID);

        if(playerID === 0) {
            let found = false;
            for(let watcher of this.watchers) {
                if(watcher.key === playerKey) {
                    watcher.socket = socket;
                    found = true;
                    break;
                }
            }
            if(!found){
                this.watch(socket);
                return { success: true };
            }
        } else {
            this.players[playerID].socket = socket;
        }

        clearInterval(this.disconnectTimers.get(playerKey));

        socket.playerID = playerID;
        this.#assignRoomData(socket, playerID);

        return { success: true };
    }

    handleDisconnect(socket) {
        const playerKey = socket.handshake.session.playerKey;
        const playerID = socket.handshake.session.playerID;
        socket.leave(this.roomID);

        if(playerID === 0) { // watcher disconnected
            this.disconnectTimers.set(playerKey, setTimeout(
                () => this.#disconnect(playerKey, playerID),
                1000 * 10
            ));
        } else { // player disconnected

            this.players[playerID].socket = undefined;

            if(this.gamestate() === 'pregame') {
                this.ready.delete(playerID);
            }

            let playersDisconnected = 1;
            if(!this.players[1].socket && !this.players[2].socket){
                playersDisconnected = 2;
            }


            this.disconnectTimers.set(playerKey, setTimeout(
                () => this.#disconnect(playerKey, playerID, playersDisconnected),
                1000 * 10
            ));
        }
    }

    forceDisconnect(playerKey, playerID) {
        clearInterval(this.disconnectTimers.get(playerKey));
        this.#disconnect(playerKey, playerID);
    }

    getLobbyObject() {
        return {
            active:     true,
            id:         this.roomID,
            name:       this.name,
            password:   this.password,
            isPrivate:    this.isPrivate,
            watchable:  this.watchable
        };
    }
    
    #disconnect(playerKey, playerID, playersDisconnected = 1) {
        if(!playerKey || !playerID) return;

        if(playerID === 0) {
            this.watchers = this.watchers.filter(w => w.key !== playerKey );
        } else {
            console.log('destroying ', this.name);
            this.destroy(playersDisconnected);
        }
    }

    #assignRoomData(socket, playerID) {
        socket.emit('multiplayer:assignRoomData', {
            playerID
        });
    }
}

module.exports = MultiplayerRoom;