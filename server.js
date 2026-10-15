const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// إعدادات الاتصال للسماح للعبة بالاتصال بالسيرفر
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// الصفحة الرئيسية للتأكد من أن السيرفر يعمل
app.get('/', (req, res) => {
    res.send('Cyber Horizon 6226 Multiplayer Server is Running Successfully!');
});

// تخزين الغرف واللاعبين
let rooms = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // 1. عند انضمام لاعب للغرفة
    socket.on('join_room', (data) => {
        let roomCode = data.roomCode || 'cyber6226';
        let playerName = data.playerName || 'Player';
        let vehicleType = data.vehicleType || 0;

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerName = playerName;

        // إذا لم تكن الغرفة موجودة، يتم إنشاؤها وتعيين هذا اللاعب كقائد لها (Party Leader)
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

        // إرسال التحديثات لجميع أجهزة اللاعبين الموجودين داخل نفس الغرفة
        io.to(roomCode).emit('update_party', rooms[roomCode]);
        io.to(roomCode).emit('update_players', rooms[roomCode].players);
    });

    // 2. أمر بدء اللعب من قائد الفريق (Party Leader)
    socket.on('start_game_party', () => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].leader === socket.id) {
            io.to(roomCode).emit('launch_game_for_all');
        }
    });

    // 3. مزامنة حركة وإحداثيات اللاعبين أونلاين
    socket.on('player_move', (data) => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            let p = rooms[roomCode].players[socket.id];
            p.x = data.x;
            p.y = data.y;
            p.z = data.z;
            p.score = data.score;

            socket.to(roomCode).emit('player_moved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                z: data.z
            });
        }
    });

    // 4. عند خروج لاعب أو انقطاع الاتصال
    socket.on('disconnect', () => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            delete rooms[roomCode].players[socket.id];

            if (Object.keys(rooms[roomCode].players).length === 0) {
                delete rooms[roomCode];
            } else {
                // نقل القيادة للاعب التالي في حال خروج القائد
                if (rooms[roomCode].leader === socket.id) {
                    rooms[roomCode].leader = Object.keys(rooms[roomCode].players)[0];
                }
                io.to(roomCode).emit('update_party', rooms[roomCode]);
                io.to(roomCode).emit('update_players', rooms[roomCode].players);
            }
        }
        console.log('Player disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
