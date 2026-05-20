const socket = io();

let activityCheck = null;
let playerID = null;

window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

socket.on('loginStatus:send_state', (state) => {
    if(state.isGuest) {
        activityCheck = setInterval(
            () => { 
                socket.emit('guest:active'); 
            }, 
            1000
        );
    }
});

socket.on('multiplayer:assignRoomData', (data) => {
    playerID    = data.playerID;
});

socket.on('multiplayer:forgetRoomData', () => {
    playerID    = null;
});

