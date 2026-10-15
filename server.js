// server.js - Real-time Multiplayer Socket.io Server for Cyber Horizon 6226
const express = require('http');
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // الانضمام إلى غرفة معينة
    socket.on('join_room', (data) => {
        const { roomCode, playerName, vehicleType } = data;
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerName = playerName;

        if (!rooms[roomCode]) {
            rooms[roomCode] = {};
        }

        rooms[roomCode][socket.id] = {
            id: socket.id,
            name: playerName,
            vehicle: vehicleType,
            x: 0, y: 0, z: 0,
            score: 0
        };

        // إعلام الجميع في الغرفة بوجود لاعب جديد
        io.to(roomCode).emit('update_players', rooms[roomCode]);
        console.log(`Player ${playerName} joined room: ${roomCode}`);
    });

    // استقبال حركة اللاعب وبثها لباقي أصدقائه في الغرفة أونلاين
    socket.on('player_move', (posData) => {
        const room = socket.roomCode;
        if (room && rooms[room] && rooms[room][socket.id]) {
            rooms[room][socket.id].x = posData.x;
            rooms[room][socket.id].y = posData.y;
            rooms[room][socket.id].z = posData.z;
            rooms[room][socket.id].score = posData.score;

            // بث الإحداثيات للاعبين الآخرين في الغرفة فوراً
            socket.to(room).emit('player_moved', {
                id: socket.id,
                x: posData.x,
                y: posData.y,
                z: posData.z,
                score: posData.score
            });
        }
    });

    // مغادرة اللعبة أو انقطاع الاتصال
    socket.on('disconnect', () => {
        const room = socket.roomCode;
        if (room && rooms[room]) {
            delete rooms[room][socket.id];
            io.to(room).emit('update_players', rooms[room]);
            if (Object.keys(rooms[room]).length === 0) {
                delete rooms[room];
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cyber Horizon Server running on port ${PORT}`);
});
