const cookie = require('cookie');
const cookieParser    = require('cookie-parser');

const pendingDisconnects = new Map();
const DISCONNECT_TIME = 1000; // 1 hour

function handleDisconnect(user, session) {
    if (!user) return;

    // clear any previous timeout
    if (pendingDisconnects.has(user)) clearTimeout(pendingDisconnects.get(user));

    const timeoutID = setTimeout(() => {
        if (session.user === user) {
            session.user = undefined;
            session.save();
            console.log(`User ${user} logged out due to inactivity.`);
        }
        pendingDisconnects.delete(user);
    }, DISCONNECT_TIME);

    pendingDisconnects.set(user, timeoutID);
}

function handleReconnect(socket, cookieSecret) {
    const session = socket.handshake.session;
    let user = session.user;

    if (!user && socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        if (cookies.user) {
            // unsign the cookie
            user = cookieParser.signedCookie(cookies.user, cookieSecret);
            if (user) {
                session.user = user;
                session.save();
            }
        }
    }

    if(!user) return;

    if (pendingDisconnects.has(user)) {
        clearTimeout(pendingDisconnects.get(user));
        pendingDisconnects.delete(user);
        //console.log(`User ${user} reconnected, cancel logout.`);
    }
}

module.exports = { handleDisconnect, handleReconnect };