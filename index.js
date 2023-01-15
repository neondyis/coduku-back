const mongoose = require('mongoose');
const connectionString = process.env.MONGO_CONNECTION_STRING;
const express = require('express')
const app = express();
const port = 4000;
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server,{
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const client = mongoose.connect(connectionString);

const codukuSchema = new mongoose.Schema({
    puzzle: [Number],
    solution: [Number]
});

const Coduku = mongoose.model ('Coduku', codukuSchema);

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});

io.on('connection', (socket) => {

    socket.on('getGameData', async (msg) => {
        const coduku = await Coduku.findById(msg.id)
        io.emit('receiveGameData',coduku)
    });

    socket.on('playTurn', async (msg) => {
        const boardData = await Coduku.findById(msg.id);

    });

    socket.on('numberInput', (msg) => {
        console.log('message: ' + msg);
        io.emit('numberInput', msg);
    });

    socket.on('initiateGame', (msg) => {
        const coduku = new Coduku({puzzle: [...msg.puzzle], solution: [...msg.solution]}).save();
        io.emit('receiveGameData',coduku)
    });
});
