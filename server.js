//website management imports
const http          = require('http');
const socket        = require('socket.io');
const express       = require('express');

//cookies and session
const cookieParser  = require('cookie-parser');
const session       = require('express-session');
const sharedSession = require("express-socket.io-session");

//local imports
const database      = require('./database.js');
const guests        = require('./guests.js');
const matchmaking   = require('./matchmaking.js');
const connection    = require('./connection.js');
const SingleGame    = require('./game/singleplayer.js');
const MultiGame     = require('./game/multiplayer.js');
const MultiplayerRoom = require('./multiplayerRoom.js');
const lobby         = require('./lobby.js');

/////////////////////////////////////////////////////////////////

//setup for user repository
const userRepo = new database.UserRepository();

//helper functions
function getLoginStatus(req) {
    let username;
    let loggedIn = false;

    if(req.session.user) {
        username = req.session.user;
        if(!username){
            username = req.user;
        }
        loggedIn = true;
    } 
    else {
        if(!req.session.guest || !guests.guestExists(req.sessionID)) {
            req.session.guest = guests.generateGuest(req.sessionID);
        }
        username = req.session.guest
    } 

    return { username, loggedIn }
}

//checks if the user has either a 'user' or 'guest' status
function hasUserStatus(req) {
    return req.session.user || req.session.guest;
}

//express setup
const app = express();
const expressLayouts = require('express-ejs-layouts');
const server = http.createServer(app);
const io = socket(server);

const cookieSecret = 'hnb398v4bnh320n2?359mnuy=214-sas'

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(expressLayouts);
app.use(cookieParser(cookieSecret));

//appsession
const appSession = session({
    secret: cookieSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: null
    }
})

app.use(appSession);

app.use((req, res, next) => {
    if (!req.session.user && !req.session.guest) {
        req.session.user = req.signedCookies.user;
    }
    const { username, loggedIn } = getLoginStatus(req);
    res.locals.username = username;
    res.locals.loggedIn = loggedIn;
    next();
});

app.set('view engine', 'ejs');
app.set('views', './views');
app.set('layout', 'layouts/main');

io.use(sharedSession(appSession, { autoSave: true }));

app.get('/', (req, res) => {
    let loginSuccess = req.session.loginSuccess;
    req.session.loginSuccess = undefined;

    res.render('app', {loginSuccess: loginSuccess, ...getLoginStatus(req)});
});

app.get('/login', (req, res) => {
    let login = req.session.login;
    req.session.login = undefined;
    let loginError = req.session.loginError;
    req.session.loginError = undefined;

    res.render('login', {login: login, loginError: loginError});
});

app.get('/sign-in', (req, res) => {
    let login = req.session.login;
    req.session.login = undefined;
    let password = req.session.password;
    req.session.password = undefined;
    let loginError = req.session.loginError;
    req.session.loginError = undefined;

    res.render('sign-in', {login: login, password: password, loginError: loginError});
});

app.get('/gamemode', (req, res) => {
    let mode = req.query.mode;
    if(mode === "singleplayer"){
        return res.redirect('singleplayer');
    } else if(mode === "multiplayer"){
        return res.redirect('lobby');
    }
    res.render('gamemode');
});

app.get('/lobby', (req, res) => {

    let page = Number(req.query.page) || 1;
    const mode = req.query.mode || 'join';

    let pageRooms, totalPages;

    ({ page, pageRooms, totalPages } = lobby.getRoomsForPage(page, mode));

    if(page > totalPages) page = 1;

    res.render('lobby', { mode, page, totalPages, pageRooms });
});

app.get('/singleplayer', (req, res) => {
    if(!hasUserStatus(req)){
        return res.redirect('/');
    }
    res.render('singleplayer');
});

app.get('/multiplayer', (req, res) => {
    if(!hasUserStatus(req)){
        return res.redirect('/');
    }
    
    res.render('multiplayer', { mode: 'join' });
});

app.get('/log-out', (req, res) => {
    req.session.user = undefined;
    req.session.guest = req.session.guest || guests.generateGuest(req.sessionID);
    res.clearCookie('user');
    return res.redirect(`/`);
});

app.post('/login', async (req, res) => {
    if(!hasUserStatus(req)){
        return res.redirect('login');
    }

    let { login, password, remember } = req.body;
    req.body.login      = undefined;
    req.body.password   = undefined;
    login    = login?.trim();
    password = password?.trim();

    remember = !!remember
    req.session.remember = remember;

    //if inserted user data is not complete
    if(!login || !password){
        req.session.loginError = "Please type in your username and password."
        req.session.login = login;
        return res.redirect(`login`);
    }

    //check if user data is campatable with the database
    const fine = await userRepo.isLoginCorrect( login, password );

    if ( fine ) {

        if(req.session.remember){
            res.cookie('user', login, { signed: true, maxAge: 1000 * 60 * 60 * 24 * 30 }); //one month
        } else{
            res.cookie('user', login, { signed: true, maxAge: null }); //disappears after leaving the site
        }

        guests.removeGuestByName(req.session.guest);
        req.session.user = login;

        req.session.loginSuccess = true;
        res.redirect('/');
    } else {
        req.session.loginError = "Incorrect username or password."
        req.session.login = login;
        return res.redirect(`login`);
    }
});

app.post('/sign-in', async (req, res) => {
    if(!hasUserStatus(req)){
        return res.redirect('sign-in');
    }

    let { login, password, confirm, remember } = req.body;
    req.body.login     = undefined;
    req.body.password  = undefined;
    req.body.confirm   = undefined;
    login    = login?.trim();
    password = password?.trim();
    confirm  = confirm?.trim();

    remember = !!remember
    req.session.remember = remember;
    
    if(login && password && confirm){
        if(await userRepo.usernameExists( login )){
            req.session.loginError = "This username already exists."
            return res.redirect(`sign-in`);
        }
        if(password != confirm){
            req.session.loginError = "\"Password\" and \"Confirm password\" don't match."
            req.session.login = login;
            return res.redirect(`sign-in`);
        } 
        if(password.length < 8){
            req.session.loginError = "Your password needs to be at least 8 characters long."
            req.session.login = login;
            return res.redirect(`sign-in`);
        }

        await userRepo.insertNewLoginData( login, password );
        req.session.loginSuccess = true;
        
        if(req.session.remember){
            res.cookie('user', login, { signed: true, maxAge: 1000 * 60 * 60 * 24 * 30 }); //one month
        } else{
            res.cookie('user', login, { signed: true, maxAge: 1000 * 60 * 60 }); //one hour
        }

        guests.removeGuestByName(req.session.guest);
        req.session.user = login;
        res.redirect('/');
    
    } else if (login && password) {
        req.session.loginError = "Confirm your password."
        req.session.login = login;
        req.session.password = password;
        return res.redirect(`sign-in`);
    } else{
        req.session.loginError = "Please type in a username and password."
        req.session.login = login;
        return res.redirect(`sign-in`);
    } 
});

app.use((req, res) => {
    res.render('404.ejs', { url : req.url });
});

io.on('connection', (socket) => {

    connection.handleReconnect(socket, cookieSecret);
    
    const session = socket.handshake.session;
    const logged = session.user;
    const user = session.user || session.guest;
    socket.spGame = null;

    //console.log('client connected:', user, socket.id);

    // needed for guest:active to be sent
    socket.emit('loginStatus:send_state', {
        isGuest:    !!session.guest && !session.user,
        loggedIn:   !!session.user
    });

    // allows the user to keep their guest stsus in between reloads
    socket.on('guest:active', () => {
        const sessionID = socket.handshake.sessionID;
        //console.log(sessionID + " Active")
        guests.updateLastSeen(sessionID);
    });

    // matchmaking DEPRICATED
    socket.on('matchmaking:join', () => {
        console.log('joining');
        matchmaking.joinQueue(user, socket, io);
    });

    socket.on('matchmaking:leave', () => {
        matchmaking.leaveQueue(user, socket);
    });

    // lobby
    socket.on('lobby:join-attempt', data => {
        const result = lobby.joinRoom(socket, data);
        socket.emit('lobby:join-result', result);
    });

    socket.on('lobby:watch-attempt', data => {
        const result = lobby.watchRoom(socket, data);
        socket.emit('lobby:watch-result', result);
    });

    socket.on('lobby:create-room-attempt', data => {
        const result = lobby.createRoom(socket, data, io);
        socket.emit('lobby:create-room-result', result);
    });

    // singleplayer
    socket.on('singleplayer:start', () => {
        console.log('starting singleplayer');
        if (socket.spGame) return; // already running
        

        socket.spGame = new SingleGame();
        socket.spGame.start();

        const board = socket.spGame.getBoards();
        socket.emit('game:board', board);
    });

    socket.on('singleplayer:tick', (dir) => {
        if (!socket.spGame) return;

        socket.spGame.tick(dir);

        const boards = socket.spGame.getBoards();
        socket.emit('game:board', boards);

        switch(socket.spGame.gamestate){
            case 'won' :  
                socket.emit('game:won');
                break;
            case 'lost' : 
                socket.emit('game:lost');
                break;
            default     :
                break;
        };
    });

    // multiplayer
    socket.on('multiplayer:validate', () => {
        lobby.handleReconnect(socket);
        const roomID = socket.handshake.session.roomID;
        const success = !!roomID;

        if(!success){
            socket.emit('multiplayer:validate-result', { success });
            return;
        }

        const playerID = socket.handshake.session.playerID;

        console.log('client joined multiplayer:', user, playerID, roomID);

        const room = lobby.getRoom(roomID);
        const gamestate = room.gamestate();
        socket.emit('multiplayer:validate-result', { success, gamestate, dir: room.moves[playerID] });

        if(gamestate === "pregame") {
            socket.emit('multiplayer:joined');

            if (room.players[1].key && room.players[2].key) {
                io.to(roomID).emit('multiplayer:prestart');
            }
        }
    });

    socket.on('multiplayer:ready', () => {
        const room = socket.room;
        if (!room) return;
        if (room.gamestate() !== 'pregame') return;

        room.ready.add(socket.playerID);

        if (room.ready.size === 2) {
            room.game.start();
            const boards = socket.room.game.getBoards();
            socket.emit('game:board', boards);
            io.to(room.roomID).emit('multiplayer:start');
        }
    });

    socket.on('multiplayer:move', (dir) => {
        const room = socket.room;
        if (!room) return;
        room.moves[socket.playerID] = dir;
    });

    //multiplayer ticking gets handled in multiplayerRoom.js

    // navbar
    socket.on('navbar:account-deletion', async ({ password }) => {
        let result;

        if(!logged) {
            socket.emit('navbar:account-deletion-result', { success: false, cause: 'not logged in' });
        }

        try {
            result = await userRepo.deleteAccount(logged, password);
        } catch(err) {
            console.error(err);
            result = { success: false, cause: 'unexpected error' };
        }

        socket.emit('navbar:account-deletion-result', result);
    });

    socket.on('navbar:logout', () => {
        const sess = socket.handshake.session;
        sess.user = undefined;
        sess.guest = sess.guest || guests.generateGuest(req.sessionID);
        sess.save();
        socket.emit('navbar:logged-out');
    });

    // disconnect
    socket.on('disconnect', () => {
        connection.handleDisconnect(logged, session);
        lobby.handleDisconnect(socket);
        socket.spGame = null;

        //console.log('client disconneted:', user, socket.id);
    });
});

server.listen(3000);
console.log( 'server online' );