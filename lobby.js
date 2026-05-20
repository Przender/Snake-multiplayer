const MultiplayerRoom = require('./multiplayerRoom');

const rooms = new Map();
const roomsByName = new Map();
const roomPasswords = new Map();

let watchingRoomsOrder = [];
let joinRoomsOrder = [];

function createRoom(socket, data, io){
    const name = data.name;
    const isPrivate = data.isPrivate;
    const password = isPrivate ? data.password : null;
    const watchable = data.watchable;

    if(roomsByName.has(name)){
        return { success: false, cause: 'name already exists' };
    }

    const room = new MultiplayerRoom(io, {
        name, 
        password, 
        isPrivate, 
        watchable, 
        onDestroy: removeRoom, 
        removeFromJoin: removeRoomFromJoin,
        removeOldPointers: removeOldPointers
    });

    rooms.set(room.roomID, room);
    roomsByName.set(name, room.roomID);

    joinRoomsOrder.unshift(room.roomID);
    if(watchable){
        watchingRoomsOrder.unshift(room.roomID);
    }
    roomPasswords.set(room.roomID, password);

    const joinResult = room.join(socket);
    if (!joinResult.success) {
        return joinResult;
    }

    return { success: true, roomID: room.roomID };
}

function joinRoom(socket, data) {
    const id = data.id;
    const password = data.password;

    const room = rooms.get(id);

    if(!room) return { success: false, cause: "room not found" };
    if(room.password !== password) return { success: false, cause: "password" };

    return room.join(socket);
}

function watchRoom(socket, data) {
    const id = data.id;
    const password = data.password;

    const room = rooms.get(id);
    if (!room) return { success: false, cause: "room not found" };
    if(room.password !== password) return { success: false, cause: "password" };

    room.watch(socket);

    return { success: true };
}

function getRoomsForPage(page, mode) {
    const PER_PAGE = 30;

    const roomOrder = mode === 'join'
        ? joinRoomsOrder
        : watchingRoomsOrder;

    const totalPages = Math.ceil(roomOrder.length / PER_PAGE);

    if (page > totalPages) {
        page = 1;
    }

    const start = (page - 1) * PER_PAGE;
    const pageRoomsIDs = roomOrder.slice(start, start + PER_PAGE);

    let pageRooms = [];
    for (let roomID of pageRoomsIDs) {
        const room = rooms.get(roomID);
        if (room) {
            pageRooms.push(room.getLobbyObject());
        }
    }

    return { page, pageRooms, totalPages };
}

function removeRoomFromJoin(roomID) {
    joinRoomsOrder = joinRoomsOrder.filter(id => id !== roomID);
    console.log('Removed room from join:', roomID);
}

function removeRoom(roomID) {
    const room = rooms.get(roomID);
    if (!room) return;

    rooms.delete(roomID);
    roomsByName.delete(room.name);
    roomPasswords.delete(roomID);
    watchingRoomsOrder = watchingRoomsOrder.filter(id => id !== roomID);
    joinRoomsOrder = joinRoomsOrder.filter(id => id !== roomID);
}

function handleReconnect(socket) {
    const roomID = socket.handshake.session.roomID;
    const room = rooms.get(roomID);

    if(roomID && room){
        result = room.handleReconnect(socket);

        if(!result.success){
            if(result.cause === 'game ended') {
                socket.emit("multiplayer:game-alredy-ended");
            } else if(result.cause === 'timeout') {
                socket.emit("multiplayer:timeout");
            }
        }
    } else removeOldPointers(socket);
}

function handleDisconnect(socket) {
    if(socket.room && rooms.get(socket.room.roomID)) {
        rooms.get(socket.room.roomID).handleDisconnect(socket);
    } else removeOldPointers(socket);
}

function getRoom(roomID) {
    return rooms.get(roomID);
}

function forceDisconnect(roomID, playerKey, playerID) {
    const room = rooms.get(roomID);
    if(roomID && room) {
        room.forceDisconnect(playerKey, playerID);
    }
}

function removeOldPointers(socket) {
    delete socket.handshake.session.playerKey;
    delete socket.handshake.session.playerID;
    delete socket.handshake.session.roomID;
    socket.handshake.session.save();
}

module.exports = { 
    createRoom, 
    joinRoom, 
    watchRoom, 
    getRoomsForPage, 
    removeRoom, 
    removeRoomFromJoin, 
    handleReconnect, 
    handleDisconnect,
    forceDisconnect,
    getRoom
};