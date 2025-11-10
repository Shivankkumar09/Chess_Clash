const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};
let currentPlayer = "w";
let gameReady = false;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("mainp", { title: "Chess Game" });
});

app.get('/play', (req, res) => {
    res.render('index'); 
});

io.on("connection", (socket) => {
    console.log("connected");

    if (!players.white) {
        players.white = socket.id;
        socket.emit("playerRole", "w");
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit("playerRole", "b");
    } else {
        socket.emit("spectatorRole");
    }

    // Check if both players have joined
    if (players.white && players.black) {
        gameReady = true;
        io.emit("gameReady", true);
        console.log("Both players joined! Game starting...");
    } else {
        socket.emit("waitingForPlayer", { white: !!players.white, black: !!players.black });
    }

    socket.on("disconnect", () => {
        if (socket.id === players.white) {
            delete players.white;
            gameReady = false;
            io.emit("playerDisconnected", "white");
        } else if (socket.id === players.black) {
            delete players.black;
            gameReady = false;
            io.emit("playerDisconnected", "black");
        }
        
        // Notify remaining players that game is paused
        if (!gameReady && (players.white || players.black)) {
            io.emit("waitingForPlayer", { white: !!players.white, black: !!players.black });
        }
    });

    socket.on("move", (move) => {
        try {
            // Don't allow moves until both players have joined
            if (!gameReady) {
                socket.emit("gameNotReady");
                return;
            }

            if (chess.turn() === "w" && socket.id !== players.white) return;
            if (chess.turn() === "b" && socket.id !== players.black) return;

            const result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardState", chess.fen());
                
                if (result.flags.includes("c")) {
                    io.emit("capture");
                } else {
                    io.emit("selfMove");
                }
                
                if (chess.isCheckmate()) {
                    io.emit("notify");
                }
            } else {
                io.emit("invalid");
                console.log("Invalid move:", move);
                socket.emit("invalidMove", move);
               
            }
        } catch (err) {
            io.emit("invalid");
            console.log(err);
            socket.emit("invalidMove", move);
        }
    });
});

server.listen(3000, function () {
    console.log("listening on 3000");
});