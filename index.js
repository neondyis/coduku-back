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
    solution: [Number],
    initPuzzle: [Number],
    currentTurn: String,
    users: [String],
    startTime: Date,
    notes: []
});

const Coduku = mongoose.model ('Coduku', codukuSchema);

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});

io.on('connection', (socket) => {

    socket.on('getGameData', async (msg) => {
        const coduku = await Coduku.findById(msg.id)
        socket.emit('receiveGameData',coduku)
    });

    socket.on('playTurn', async (msg) => {
        let coduku = await Coduku.findOne({_id:msg.id});
        const users = [...coduku['users']]
        const currentUserIndex = users.findIndex(name => name === msg.currentTurn);
       if(currentUserIndex < coduku['users'].length-1){
            coduku = await Coduku.findOneAndUpdate({ _id: msg.id }, { $set: { currentTurn: users[currentUserIndex+1] ,puzzle: msg.puzzle} },{new: true, returnDocument: 'after'})
       }else{
           coduku =  await Coduku.findOneAndUpdate({ _id: msg.id }, { $set: { currentTurn: users[0] ,puzzle: msg.puzzle}},{new: true, returnDocument: 'after'})
       }
       io.emit('updateGameData',coduku);
    });

    socket.on('joinGame', async (msg) => {
        const coduku = await Coduku.findOne({users: {'$all': msg.name},_id: msg.id})
        if(coduku){
            socket.emit('receiveGameData',coduku)
        }else{
            const coduku = await Coduku.findOneAndUpdate({_id: msg.id},{$push: {users: msg.name}});
            socket.emit('receiveGameData',coduku)
        }
    })

    socket.on('initiateGame', async (msg) => {
        const coduku = await new Coduku({puzzle: [...msg.puzzle], solution: [...msg.solution], initPuzzle: [...msg.puzzle], currentTurn: msg.name,users: [msg.name], startTime: msg.startTime}).save();
        socket.emit('receiveGameData',coduku)
    });


    socket.on('getGameList', async (msg) => {
        const coduku = await Coduku.find({},{_id: 1, currentTurn:1})
        socket.emit('gameListInfo', coduku);
    });

    socket.on('modifyNotes', async (msg) => {
        const coduku = await Coduku.findById({_id: msg.id},{});
        if(coduku){
            const notes = [...coduku['notes']]
            const notesExistIndex = notes.findIndex(noteArray => noteArray[0].boardIndex === msg.notes[0].boardIndex)
            let updatedNotes;
            if(notesExistIndex > -1){
                notes[notesExistIndex] = msg.notes;
                updatedNotes = await Coduku.findByIdAndUpdate({_id: msg.id},{$set: {notes: notes}},{new: true, returnDocument: 'after'})
            }else{
                updatedNotes = await Coduku.findByIdAndUpdate({_id: msg.id},{$push: {notes: msg.notes}},{new: true, returnDocument: 'after'})
            }
            io.emit('updateClientNotes', updatedNotes.notes);
        }
    })

    socket.on('ping', async (msg) => {
        const coduku = await Coduku.findOneAndUpdate({_id: msg.id},{$push: {"users": msg.name}});
        socket.emit('receiveGameData',coduku)
    })
});
