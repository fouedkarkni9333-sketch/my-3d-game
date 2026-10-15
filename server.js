const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let rooms = {};

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('join_room', (data) => {
        let roomCode = data.roomCode || 'cyber6226';
        let playerName = data.playerName || 'Player';
        let vehicleType = data.vehicleType || 0;

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerName = playerName;

        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                leader: socket.id,
                players: {}
            };
        }

        rooms[roomCode].players[socket.id] = {
            id: socket.id,
            name: playerName,
            vehicle: vehicleType,
            x: 0, y: 0, z: 0,
            score: 0
        };

        io.to(roomCode).emit('update_party', rooms[roomCode]);
        io.to(roomCode).emit('update_players', rooms[roomCode].players);
    });

    socket.on('player_move', (data) => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].x = data.x;
            rooms[roomCode].players[socket.id].y = data.y;
            rooms[roomCode].players[socket.id].z = data.z;
            rooms[roomCode].players[socket.id].score = data.score;

            socket.to(roomCode).emit('player_moved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                z: data.z
            });
        }
    });

    socket.on('start_game_party', () => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].leader === socket.id) {
            io.to(roomCode).emit('launch_game_for_all');
        }
    });

    socket.on('disconnect', () => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            delete rooms[roomCode].players[socket.id];
            if (Object.keys(rooms[roomCode].players).length === 0) {
                delete rooms[roomCode];
            } else {
                if (rooms[roomCode].leader === socket.id) {
                    rooms[roomCode].leader = Object.keys(rooms[roomCode].players)[0];
                }
                io.to(roomCode).emit('update_party', rooms[roomCode]);
                io.to(roomCode).emit('update_players', rooms[roomCode].players);
            }
        }
        console.log('A player disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
