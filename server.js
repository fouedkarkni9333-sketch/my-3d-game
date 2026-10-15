const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// إعدادات الـ CORS لضمان توافق الاتصال مع أي نطاق (Domain)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Cyber Horizon 6226 Multiplayer Quantum Server is Online & Active!');
});

// تخزين بيانات الغرف واللاعبين
const rooms = {}; // roomCode -> { leader: socketId, players: { socketId: { name, vehicle, x, y, z, score } } }

io.on('connection', (socket) => {
    console.log(`⚡ New Quantum Connection: ${socket.id}`);

    // انضمام اللاعب إلى الغرفة أو اللوبي
    socket.on('join_room', (data) => {
        const { roomCode, playerName, vehicleType } = data;
        
        // إذا كان هناك غرفة قديمة للاعب، نخرجه منها أولاً
        leaveAllRooms(socket);

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerName = playerName || "Player";

        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                leader: socket.id, // أول شخص ينشئ الغرفة يصبح قائد الفريق تلقائياً
                players: {}
            };
        }

        rooms[roomCode].players[socket.id] = {
            name: socket.playerName,
            vehicle: vehicleType || 0,
            x: 0, y: 0, z: 0,
            score: 0
        };

        console.log(`👤 Player [${socket.playerName}] joined room: ${roomCode}`);

        // تحديث بيانات البارتي والغرفة لجميع المتواجدين
        io.to(roomCode).emit('update_party', rooms[roomCode]);
        io.to(roomCode).emit('update_players', rooms[roomCode].players);
    });

    // بدء اللعبة جماعياً من قِبل قائد الفريق (Party Leader) فقط
    socket.on('start_game_party', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].leader === socket.id) {
            console.log(`🚀 Party Leader [${socket.id}] launched the game for room: ${roomCode}`);
            io.to(roomCode).emit('launch_game_for_all');
        }
    });

    // استقبال وتحديث إحداثيات وتحركات اللاعب بثاً حياً
    socket.on('player_move', (posData) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            let p = rooms[roomCode].players[socket.id];
            p.x = posData.x;
            p.y = posData.y;
            p.z = posData.z;
            p.score = posData.score;

            // بث الحركة لباقي اللاعبين في نفس الغرفة
            socket.to(roomCode).emit('player_moved', {
                id: socket.id,
                x: p.x,
                y: p.y,
                z: p.z
            });
        }
    });

    // عند انقطاع الاتصال أو خروج اللاعب
    socket.on('disconnect', () => {
        console.log(`❌ Player Disconnected: ${socket.id}`);
        leaveAllRooms(socket);
    });

    function leaveAllRooms(sock) {
        const roomCode = sock.roomCode;
        if (roomCode && rooms[roomCode]) {
            if (rooms[roomCode].players[sock.id]) {
                delete rooms[roomCode].players[sock.id];
            }

            // إذا خرج قائد الفريق، نعين قائداً جديداً تلقائياً لمن تبقى في الغرفة
            if (rooms[roomCode].leader === sock.id) {
                const remainingIds = Object.keys(rooms[roomCode].players);
                if (remainingIds.length > 0) {
                    rooms[roomCode].leader = remainingIds[0];
                } else {
                    delete rooms[roomCode]; // حذف الغرفة إن كانت فارغة تماماً
                }
            }

            if (rooms[roomCode]) {
                io.to(roomCode).emit('update_party', rooms[roomCode]);
                io.to(roomCode).emit('update_players', rooms[roomCode].players);
            }
            sock.roomCode = null;
        }
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Quantum Backend Server running on port ${PORT}`);
});
