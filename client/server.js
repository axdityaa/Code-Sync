const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
// const express = require('express');
// const app = express();
// const http = require('http');
// const path = require('path');
// const cors = require('cors');
// const { Server } = require('socket.io');
// const ACTIONS = require('./src/Actions');

// const server = http.createServer(app);

// // Configure CORS for Socket.IO
// const io = new Server(server, {
//     cors: {
//         origin: ["http://localhost:3000","https://code-sync-part-1-1.onrender.com"], // Your React app URL
//         methods: ["GET", "POST"]
//     }
// });

// // Enable CORS for Express
// app.use(cors({
//     origin: ["http://localhost:3000","https://code-sync-part-1-1.onrender.com"],
//     credentials: true
// }));

// app.use(express.static('build'));

// // Serve React app for any route
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'build', 'index.html'));
// });

// const userSocketMap = {};

// function getAllConnectedClients(roomId) {
//     const room = io.sockets.adapter.rooms.get(roomId);
//     if (!room) {
//         return [];
//     }
    
//     return Array.from(room).map((socketId) => {
//         return {
//             socketId,
//             username: userSocketMap[socketId],
//         };
//     });
// }

// io.on('connection', (socket) => {
//     console.log('Socket connected:', socket.id);

//     socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
//         console.log(`User ${username} joining room ${roomId}`);
        
//         userSocketMap[socket.id] = username;
//         socket.join(roomId);
        
//         const clients = getAllConnectedClients(roomId);
//         console.log('Connected clients:', clients);
        
//         // Notify all clients in the room about the new user
//         clients.forEach(({ socketId }) => {
//             io.to(socketId).emit(ACTIONS.JOINED, {
//                 clients,
//                 username,
//                 socketId: socket.id,
//             });
//         });
//     });

//     socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
//         console.log(`Code change in room ${roomId}`);
//         socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
//     });

//     socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
//         console.log(`Syncing code to ${socketId}`);
//         io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
//     });

//     socket.on('disconnecting', () => {
//         const rooms = [...socket.rooms];
//         console.log(`Socket ${socket.id} disconnecting from rooms:`, rooms);
        
//         rooms.forEach((roomId) => {
//             socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
//                 socketId: socket.id,
//                 username: userSocketMap[socket.id],
//             });
//         });
        
//         delete userSocketMap[socket.id];
//     });

//     socket.on('disconnect', () => {
//         console.log('Socket disconnected:', socket.id);
//     });
// });

// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
//     console.log(`Socket.IO server is ready`);
// });