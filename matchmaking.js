
const MultiplayerRoom = require('./multiplayerRoom');

const matchmakingUsers  = new Map(); // keeps track of users playing
const matchmakingQueue  = []         // keeps track of the players in order of joining

/**
 * @deprecated not used in this version
 */
function joinQueue(user, socket, io) {
    if(matchmakingUsers.has(user)) {
        socket.emit("matchmaking:error", "You are already joining in another instance. Log out or end that session.");
        return;
    }

    console.log(matchmakingQueue);
    console.log('joining matchmaking:', user, socket.id);
    

    matchmakingUsers.set(user, socket);
    matchmakingQueue.push(user);
    socket.emit("matchmaking:joined");

    console.log(matchmakingQueue);

    pairUsers(io);
}

/**
 * @deprecated not used in this version
 */
function leaveQueue(user, socket) {
    matchmakingUsers.delete(user);
    removeFromQueue(user);
    socket.emit("matchmaking:left");
}

/**
 * @deprecated not used in this version
 */
function removeFromQueue(user) {
    const idx = matchmakingQueue.indexOf(user);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

/**
 * @deprecated not used in this version
 */
function handleDisconnect(user) {
    matchmakingUsers.delete(user);
    removeFromQueue(user);
}

/**
 * @deprecated not used in this version
 */
function pairUsers(io) {
    while(matchmakingQueue.length > 1){
        const user1 = matchmakingQueue.shift();
        const user2 = matchmakingQueue.shift();
        const socket1 = matchmakingUsers.get(user1);
        const socket2 = matchmakingUsers.get(user2);

        if (!socket1 || !socket2) continue;

        matchmakingUsers.delete(user1);
        matchmakingUsers.delete(user2);

        //does not work anymore
        const room = new MultiplayerRoom(socket1, socket2, io);

        room.join(socket1);
        room.join(socket2);
    }
}

module.exports = { joinQueue, leaveQueue, handleDisconnect };
