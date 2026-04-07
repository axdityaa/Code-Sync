const express =  require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require("dotenv").config();

const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

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
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
};

const userSocketMap = {};

const getAllConnectedClients = (roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
        socketId,
        username: userSocketMap[socketId],
    }));
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
    });
});




// Activate 
server.listen(PORT,() => {
    console.log("Server Run at ",PORT);
})

app.get("/", (req,res) => {
    res.send("<h1>Auth App</h1>")
})

