const mongoose = require('mongoose');
const connectionString = process.env.MONGO_CONNECTION_STRING;
const express = require('express')
const app = express();
const port = process.env.PORT || 4000;
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const {mongo, Schema} = require("mongoose");
const io = new Server(server,{
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const client = mongoose.connect(connectionString);

const CodukuSchema = new mongoose.Schema(
    {
        puzzle: [Number],
        solution: [Number],
        initPuzzle: [Number],
        users: [
            {
                name:String,
            }
        ],
        notes: [],
    },{discriminatorKey: 'type'}
)

// Rework Coduku and Cupedoku into same array list and separate based on mode
const CoopSchema = new Schema({
    currentTurn: String,
});

const CompSchema = new Schema({
    users: [
        {
            startStatus: Boolean,
            score: Number
        }],
    startTime: Date,
    numPlayers:Number,
    isInitialized: Boolean
});

const Coduku = mongoose.model('Coduku', CodukuSchema);
const Coop = Coduku.discriminator('Coop', CoopSchema);
const Comp = Coduku.discriminator('Comp', CompSchema);

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});

io.on('connection', (socket) => {

    socket.on('getGameData', async (msg) => {
        socket.emit('receiveGameData',await Coduku.findById(msg.id))
    });

    socket.on('updateStatus', async (msg) => {
        const gameData = await Comp.findOneAndUpdate(
            {_id: msg.id, 'users': {$elemMatch: {name: `${msg.user}`}}},
            {$set: {'users.$.startStatus': true}},
            {new: true, returnDocument: 'after', projection:{users: 1}});
        io.emit('updateUsers', gameData.users);
    })

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
        const userExist = await Coduku.findOne({_id:msg.id,'users': {$elemMatch: {name: `${msg.name}`}}})
        let gameData;
        if(!userExist){
            gameData = await Coduku.findOne({_id:msg.id})
            if(gameData.type === 'Comp'){
                gameData = await Comp.findOneAndUpdate({_id:msg.id},{$push: {users: { name : msg.name, startStatus: false, score: 0}}},{new: true, returnDocument: 'after'});
                io.emit('updateUsers', gameData.users);
            }else{
                gameData =  await Coop.findOneAndUpdate({_id:msg.id},{$push: {users: {name: msg.name}}}, {new: true, returnDocument: 'after'});
            }
            socket.emit('receiveGameData',gameData);
        }else{
            socket.emit('receiveGameData',userExist)
        }
    })

    socket.on('initiateGame', async (msg) => {
        let gameData;
        if(msg.mode === 'coop'){
            gameData = await new Coop({puzzle: [...msg.puzzle], solution: [...msg.solution], initPuzzle: [...msg.puzzle], currentTurn: msg.name,users: [{name: msg.name}]}).save();
        }
        else{
            gameData = await new Comp({puzzle: [...msg.puzzle], solution: [...msg.solution], initPuzzle: [...msg.puzzle],numPlayers: msg.numPlayers,users: [{name: msg.name,startStatus: false,
                    score: 0}]}).save();
        }
        socket.emit('receiveGameData', gameData);
        socket.emit('navToGame',{mode: msg.mode, id: gameData._id})
    });

    socket.on('setStartTime', async(msg) => {
        const gameData = await Comp.findOneAndUpdate(
            {_id: msg.id},
            {$set:{startTime: new Date(), isInitialized: true}},
            {new: true, returnDocument: 'after', projection:{startTime: 1}});
        console.log(gameData)
        io.emit('startGame',gameData);
    });

    socket.on('getGameList', async (msg) => {
        const gamelist = await Coduku.find({},{_id: 1, currentTurn:1, numPlayers: 1, users: { name: 1}, type: 1 });
        socket.emit('gameListInfo', gamelist);
    });

    socket.on('modifyNotes', async (msg) => {
        const gameData = await Coduku.findById({_id: msg.id},{});
        if(gameData){
            const notes = [...gameData['notes']]
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

    socket.on('updateScore', async (msg) => {
        const gameData = await Comp.findOneAndUpdate(
            {_id: msg.id, 'users': {$elemMatch: {name: `${msg.user}`}}},
            {$inc:{'users.$.score': 1}},
            {new: true, returnDocument: 'after', projection:{users: 1}});
        io.emit('updateUsers', gameData.users);
    })

    // socket.on('ping', async (msg) => {
    //     const gameData = await Coduku.findOneAndUpdate({_id: msg.id},{$push: {"users": msg.name}});
    //     socket.emit('receiveGameData',gameData)
    // })
});
