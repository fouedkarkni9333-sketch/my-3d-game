const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Cyber Horizon 6226 Ultimate Server is Running!');
});

let rooms = {};
let globalLeaderboard = []; // لوحة الصدارة العالمية السحابية

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // الانضمام للغرفة واللوبي
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

    // بدء اللعبة جماعياً بأمر من قائد الفريق
    socket.on('start_game_party', () => {
        let roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].leader === socket.id) {
            io.to(roomCode).emit('launch_game_for_all');
        }
    });

    // مزامنة حركة اللاعبين أثناء اللعب على المضمار (النقاط 1 و 4)
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
                z: data.z,
                score: data.score
            });
        }
    });

    // تحديث لوحة الصدارة العالمية (النقطة 2)
    socket.on('submit_score', (data) => {
        globalLeaderboard.push({ name: data.name, score: data.score });
        globalLeaderboard.sort((a, b) => b.score - a.score);
        globalLeaderboard = globalLeaderboard.slice(0, 10); // حفظ أفضل 10 لاعبين عالمياً
        io.emit('update_leaderboard', globalLeaderboard);
    });

    // إدارة انقطاع الاتصال
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
        console.log('Player disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
