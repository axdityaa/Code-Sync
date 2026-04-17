const express =  require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require("dotenv").config();

const PORT = process.env.PORT || 4000;

const envOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    ...envOrigins,
];

const corsOrigin = (origin, callback) => {
    // Allow non-browser requests and same-origin requests without Origin header.
    if (!origin) {
        return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
        return callback(null, true);
    }

    return callback(new Error("CORS origin not allowed"));
};

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    ROOM_CLOSED: 'room-closed',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    ROOM_META: 'room-meta',
    WRITE_ACCESS_REQUEST: 'write-access-request',
    WRITE_ACCESS_UPDATE: 'write-access-update',
};

const userSocketMap = {};
const roomOwnerMap = {};
const roomWriteAccessMap = {};

const closeRoom = (roomId, message = 'Owner left. Room closed.') => {
    io.to(roomId).emit(ACTIONS.ROOM_CLOSED, {
        roomId,
        message,
    });

    io.in(roomId).socketsLeave(roomId);
    delete roomOwnerMap[roomId];
    delete roomWriteAccessMap[roomId];
};

const getAllConnectedClients = (roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
        socketId,
        username: userSocketMap[socketId],
        canWrite: hasWriteAccess(roomId, socketId),
    }));
};

const hasWriteAccess = (roomId, socketId) => {
    if (!socketId) {
        return false;
    }

    if (roomOwnerMap[roomId] === socketId) {
        return true;
    }

    return roomWriteAccessMap[roomId]?.has(socketId) || false;
};

const emitRoomMeta = (roomId) => {
    const clients = getAllConnectedClients(roomId);
    const ownerSocketId = roomOwnerMap[roomId] || null;

    clients.forEach(({ socketId }) => {
        io.to(socketId).emit(ACTIONS.ROOM_META, {
            ownerSocketId,
            clients,
            canWrite: hasWriteAccess(roomId, socketId),
        });
    });
};

app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
  }));
app.use(express.json());
app.use(cookieParser());

require("./config/database").connect()

// route import and mount 
const user = require("./routes/user");
app.use("/api/v1/auth",user);


const aiRoutes = require('./routes/ai');
app.use('/api/v1/ai', aiRoutes);


io.on('connection', (socket) => {
    socket.on(ACTIONS.JOIN, ({ roomId, username, joinMode }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        const roomClients = io.sockets.adapter.rooms.get(roomId) || new Set();
        const isFirstClientInRoom = roomClients.size === 1;
        const currentOwner = roomOwnerMap[roomId];
        const ownerStillConnected = currentOwner && roomClients.has(currentOwner);
        const ownerUsername = currentOwner ? userSocketMap[currentOwner] : null;

        // Deterministic rule: room creator always becomes owner.
        if (joinMode === 'create') {
            roomOwnerMap[roomId] = socket.id;
        } else if (isFirstClientInRoom) {
            roomOwnerMap[roomId] = socket.id;
        } else if (ownerUsername && ownerUsername === username && currentOwner !== socket.id) {
            // Preserve ownership when owner reconnects with a new socket id.
            roomOwnerMap[roomId] = socket.id;
        } else if (!currentOwner || !ownerStillConnected) {
            closeRoom(roomId, 'Owner unavailable. Room closed.');
            return;
        }

        if (!roomWriteAccessMap[roomId]) {
            roomWriteAccessMap[roomId] = new Set();
        }

        // Owner always has write access.
        roomWriteAccessMap[roomId].add(roomOwnerMap[roomId]);

        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
                ownerSocketId: roomOwnerMap[roomId],
                canWrite: hasWriteAccess(roomId, socketId),
            });
        });

        emitRoomMeta(roomId);
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        if (!hasWriteAccess(roomId, socket.id)) {
            io.to(socket.id).emit(ACTIONS.WRITE_ACCESS_UPDATE, {
                canWrite: false,
                status: 'denied',
                message: 'You do not have write access for this room.',
            });
            return;
        }

        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.WRITE_ACCESS_REQUEST, ({ roomId }) => {
        const ownerSocketId = roomOwnerMap[roomId];

        if (!ownerSocketId) {
            return;
        }

        if (socket.id === ownerSocketId) {
            io.to(socket.id).emit(ACTIONS.WRITE_ACCESS_UPDATE, {
                canWrite: true,
                status: 'accepted',
                message: 'You are the room owner.',
            });
            return;
        }

        io.to(ownerSocketId).emit(ACTIONS.WRITE_ACCESS_REQUEST, {
            roomId,
            requesterSocketId: socket.id,
            requesterUsername: userSocketMap[socket.id],
        });

        io.to(socket.id).emit(ACTIONS.WRITE_ACCESS_UPDATE, {
            canWrite: false,
            status: 'pending',
            message: 'Access request sent to room owner.',
        });
    });

    socket.on(ACTIONS.WRITE_ACCESS_UPDATE, ({ roomId, requesterSocketId, decision }) => {
        const ownerSocketId = roomOwnerMap[roomId];
        if (!ownerSocketId || socket.id !== ownerSocketId || !requesterSocketId) {
            return;
        }

        if (!roomWriteAccessMap[roomId]) {
            roomWriteAccessMap[roomId] = new Set();
        }

        if (decision === 'accept') {
            roomWriteAccessMap[roomId].add(requesterSocketId);
        } else {
            roomWriteAccessMap[roomId].delete(requesterSocketId);
        }

        io.to(requesterSocketId).emit(ACTIONS.WRITE_ACCESS_UPDATE, {
            canWrite: decision === 'accept',
            status: decision === 'accept' ? 'accepted' : 'rejected',
            message:
                decision === 'accept'
                    ? 'Owner granted you write access.'
                    : 'Owner rejected your write access request.',
        });

        io.to(ownerSocketId).emit(ACTIONS.WRITE_ACCESS_UPDATE, {
            requesterSocketId,
            status: 'resolved',
            decision,
        });

        emitRoomMeta(roomId);
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            if (roomId === socket.id) {
                return;
            }

            const isOwnerLeaving = roomOwnerMap[roomId] === socket.id;

            if (isOwnerLeaving) {
                closeRoom(roomId, 'Owner left. Room closed.');
                return;
            }

            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });

            roomWriteAccessMap[roomId]?.delete(socket.id);

            if (roomOwnerMap[roomId] && !io.sockets.sockets.has(roomOwnerMap[roomId])) {
                closeRoom(roomId, 'Owner unavailable. Room closed.');
                return;
            }

            emitRoomMeta(roomId);
        });

        delete userSocketMap[socket.id];
    });
});




// Activate 
server.listen(PORT,() => {
    console.log("Server Run at ",PORT);
})

app.get("/", (req,res) => {
    res.send("<h1>Auth App</h1>")
})

