
const idsToSid = new Map();
const sidsToGuest = new Map();

const MAX_RANDOM = 9999;
const TTD = 1000 * 60 * 5; // 5 minutes; Time 'till the guest is freed after disconnection

function generateGuest(sessionID) {
    let counter = 0
    let id = Math.floor(Math.random() * MAX_RANDOM) + 1;

    while( idsToSid.has(id) && counter < 1000 ) {
        id = Math.floor(Math.random() * MAX_RANDOM) + 1;
        counter++;
    }
    if( counter == 1000 ){
        let i = 1;
        while( idsToSid.has(i) ) {
            i++;
        }

        id = i;
    }

    const guest = {
        id,
        lastSeen: Date.now()
    };

    idsToSid.set(Number(id), sessionID);
    sidsToGuest.set(sessionID, guest);

    id = id + ""
    while(id.length < 4){
        id = '0' + id
    }
    return "Guest#" + id
}

function updateLastSeen(sessionID) {
    const guest = sidsToGuest.get(sessionID);
    if (guest) guest.lastSeen = Date.now();
}

function removeGuestByName(name) {
    name = name.slice(6);
    while(name.at(0) == '0'){
        name = name.slice(1);
    }

    let id = Number(name);
    let sid = idsToSid.get(id);
    
    idsToSid.delete(id);
    sidsToGuest.delete(sid);
}

function removeGuestBySessionID(sessionID) {
    let guest = sidsToGuest.get(sessionID);
    if (!guest) return;
    
    idsToSid.delete(guest.id);
    sidsToGuest.delete(sessionID);
}

function cleanupGuests() {
    const now = Date.now();

    for (const [sessionID, guest] of sidsToGuest.entries()) {
        if (now - guest.lastSeen > TTD) {
            console.log("Guest#" + guest.id + " deleted")
            idsToSid.delete(guest.id);
            sidsToGuest.delete(sessionID);
        }
    }
}

setInterval(cleanupGuests, 60 * 1000); // every minute

function guestExists(sessionID) {
    return sidsToGuest.has(sessionID);
}

module.exports = { generateGuest, removeGuestByName, removeGuestBySessionID, guestExists, updateLastSeen };
