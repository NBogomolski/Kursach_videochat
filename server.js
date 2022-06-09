const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const {v4: uuidv4} = require('uuid');
const {validate: isUuidValid} = require('uuid');
const bodyParser = require('body-parser');

const MAX_CLIENTS = 500;
const PORT = process.env.PORT || 5000;

let activeRooms = new Set();
const clientNames = {};

app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(bodyParser.json());

app.get('/connect', (req, res) => {
    const reqUrl = new URL(req.url, 'http://localhost:5000');
    const uid = reqUrl.searchParams.get('uid');

    if (!uid) {
        res.render(__dirname + '/public/errorPage.ejs', {
            errorString: 'uid not specified'
        })
    } else if (!clientNames[uid]) {
        res.render(__dirname + '/public/errorPage.ejs', {
            errorString: 'Wrong uid'
        })
    } else if (!activeRooms.has(clientNames[uid].room)) {
        res.render(__dirname + '/public/errorPage.ejs', {
            errorString: 'Room doesn\'t exist'
        })
    } else if (clientNames[uid].isConnected) {
        res.render(__dirname + '/public/errorPage.ejs', {
            errorString: 'Client is already connected'
        })
    } else {
        res.sendFile(__dirname + '/public/client.html')
    }
    console.log(clientNames)
});

app.post('/set_client_create_params', (req, res) => {
    let newRoomId;
    let errorMessage = null;

    if (!req.body.name || req.body.name === '') {
        errorMessage = 'Name is not specified'
    }

    if (!req.body.uid || req.body.uid === '') {
        errorMessage = 'User ID is not specified'
    }

    if (errorMessage === null) {
        newRoomId = uuidv4(); //'1'//
        activeRooms.add(newRoomId);
        clientNames[req.body.uid] = {
            name: req.body.name,
            room: newRoomId,
            isCreator: true,
            isConnected: false
        };
        res.status(200).end()
    } else {
        res.status(400).send(JSON.stringify({message: errorMessage})).end()
    }
});

app.post('/set_client_join_params', (req, res) => {
    let errorMessage = null;

    if (!req.body.name || req.body.name === '') {
        errorMessage = 'Name is not specified'
    }

    if (!req.body.uid || req.body.uid === '') {
        errorMessage = 'User ID is not specified'
    }

    if (!req.body.room || req.body.room === '') {
        errorMessage = 'Room is not specified'
    }

    if (!isUuidValid(req.body.room)) {
        errorMessage = 'Illegal room format'
    }

    if (!activeRooms.has(req.body.room)) {
        errorMessage = 'Room doesn\'t exist'
    }

    if (errorMessage === null) {
        clientNames[req.body.uid] = {
            name: req.body.name,
            room: req.body.room,
            isCreator: false,
            isConnected: false
        };
        res.status(200).end()
    } else {
        res.status(400).send(JSON.stringify({message: errorMessage})).end()
    }
});

app.post('/end_session', (req, res) => {
    const reqUrl = new URL(req.url, 'http://localhost:5000');
    const uid = reqUrl.searchParams.get('uid');

    if (uid && clientNames[uid]) {
        console.log('ROOMS1' + activeRooms);
        delete clientNames[uid];
        const rooms = io.of('/').adapter.rooms;
        let tmp = new Set();
        rooms.forEach((val, key) => tmp.add(key));
        activeRooms = new Set([...activeRooms].filter(el => tmp.has(el)));
        console.log('ROOMS2' + activeRooms)
    }
    res.end()
});

app.get('/get_room_id', (req,res) => {
    const reqUrl = new URL(req.url, 'http://localhost:5000');
    const uid = reqUrl.searchParams.get('uid');
    if (uid && clientNames[uid]) {
        res.status(200).send(JSON.stringify({id: clientNames[uid].room}))
    }
    res.end();

});

app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/welcome.html')
});


io.sockets.on('connection', (socket) => {

    const rooms = io.of('/').adapter.rooms;

    socket.on('join', (clientId) => {

        if (!clientNames[clientId]) {
            return
        }

        if (clientNames[clientId].isConnected) {
            return
        }

        const room = clientNames[clientId].room;

        let clientCount = 0;

        if (rooms.get(room)) {
            clientCount = rooms.get(room).size
        }

        if (clientCount < MAX_CLIENTS) {

            socket.on('ready', (clientId) => {
                socket.to(room).emit('ready', socket.id, clientNames[clientId].name)
            });

            socket.on('offer', (id, message, clientId) => {
                socket.to(id).emit('offer', socket.id, message, clientNames[clientId].name)
            });

            socket.on('answer', (id, message) => {
                socket.to(id).emit('answer', socket.id, message)
            });

            socket.on('candidate', (id, message) => {
                socket.to(id).emit('candidate', socket.id, message)
            });

            socket.on('end_session', (clientId) => {
                delete clientNames[clientId];
                console.log(rooms)
            });

            socket.on('disconnect', () => {
                socket.to(room).emit('end', socket.id)
            });

            socket.on('send_message', async (clientId, message) => {
                socket.to(room).emit('send_message', clientNames[clientId].name, message);
            });

            clientNames[clientId].isConnected = true;

            socket.join(room);
            console.log(rooms)
        } else {
            socket.emit('full_room', room)
        }
    })
});

io.sockets.on('error', (e) => {
    console.error(e)
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));