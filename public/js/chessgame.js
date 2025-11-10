const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let possibleMoves = [];
let moveHistory = [];
let lastMove = null;
let capturedPieces = { white: [], black: [] };
let gameReady = false;

// Get UI elements
const whitePlayerPanel = document.getElementById('whitePlayerPanel');
const blackPlayerPanel = document.getElementById('blackPlayerPanel');
const whiteCaptured = document.getElementById('whiteCaptured');
const blackCaptured = document.getElementById('blackCaptured');
const moveHistoryElement = document.getElementById('moveHistory');
const playerRoleDisplay = document.getElementById('playerRoleDisplay');
const currentTurnDisplay = document.getElementById('currentTurnDisplay');
const moveCount = document.getElementById('moveCount');
const waitingOverlay = document.getElementById('waitingOverlay');
const waitingMessage = document.getElementById('waitingMessage');
const whiteSlot = document.getElementById('whiteSlot');
const blackSlot = document.getElementById('blackSlot');
const boardWithCoords = document.getElementById('boardWithCoords');

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square",
                (rowindex + squareindex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;

            // Highlight last move
            if (lastMove) {
                const squareNotation = `${String.fromCharCode(97 + squareindex)}${8 - rowindex}`;
                if (squareNotation === lastMove.from || squareNotation === lastMove.to) {
                    squareElement.classList.add("last-move");
                }
            }

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                if (pieceElement.draggable) {
                    pieceElement.classList.add("draggable");
                }

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                        pieceElement.classList.add("dragging");
                        
                        // Highlight possible moves
                        highlightPossibleMoves(sourceSquare);
                        squareElement.classList.add("selected");
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
                    pieceElement.classList.remove("dragging");
                    clearHighlightedMoves();
                    document.querySelectorAll(".selected").forEach(sq => sq.classList.remove("selected"));
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => { 
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col),
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement); 
        });
    });

    if(playerRole === 'b'){
        boardElement.classList.add("flipped");
        boardWithCoords.classList.add("flipped-coords");
    }
    else{
        boardElement.classList.remove("flipped");
        boardWithCoords.classList.remove("flipped-coords");
    }
};

const handleMove = (source, target) => {
    // Don't allow moves if game isn't ready
    if (!gameReady) {
        return;
    }

    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q',
    };

    // Check if the move captures a piece
    const targetSquare = chess.get(move.to);
    if (targetSquare) {
        const capturedBy = targetSquare.color === 'w' ? 'black' : 'white';
        capturedPieces[capturedBy].push(targetSquare);
    }

    socket.emit("move", move);
};

const highlightPossibleMoves = (square) => {
    clearHighlightedMoves();
    const moves = chess.moves({ 
        square: `${String.fromCharCode(97 + square.col)}${8 - square.row}`, 
        verbose: true 
    });
    
    moves.forEach(move => {
        const row = 8 - parseInt(move.to[1]);
        const col = move.to.charCodeAt(0) - 97;
        const squareElement = document.querySelector(`.square[data-row='${row}'][data-col='${col}']`);
        if (squareElement) {
            const dot = document.createElement("div");
            dot.classList.add("dot");
            squareElement.classList.add("highlight");
            squareElement.appendChild(dot);
            possibleMoves.push(squareElement);
        }
    });
};

const clearHighlightedMoves = () => {
    possibleMoves.forEach(square => {
        square.classList.remove("highlight");
        const dot = square.querySelector(".dot");
        if (dot) dot.remove();
    });
    possibleMoves = [];
};

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♙",
        r: "♜",
        n: "♞",
        b: "♝",
        q: "♛",
        k: "♚",
        P: "♙",
        R: "♖",
        N: "♘",
        B: "♗",
        Q: "♕",
        K: "♔",
    };
    return unicodePieces[piece.type] || "";
};

const updateTurnIndicator = () => {
    const currentTurn = chess.turn() === 'w' ? 'White' : 'Black';
    currentTurnDisplay.innerText = currentTurn;
    
    // Update active player panel
    if (currentTurn === 'White') {
        whitePlayerPanel.classList.add('active');
        blackPlayerPanel.classList.remove('active');
    } else {
        blackPlayerPanel.classList.add('active');
        whitePlayerPanel.classList.remove('active');
    }
};

const updateCapturedPieces = () => {
    // Clear existing
    whiteCaptured.innerHTML = '';
    blackCaptured.innerHTML = '';
    
    // Add captured pieces
    capturedPieces.white.forEach(piece => {
        const pieceElement = document.createElement('span');
        pieceElement.classList.add('captured-piece');
        pieceElement.innerText = getPieceUnicode(piece);
        whiteCaptured.appendChild(pieceElement);
    });
    
    capturedPieces.black.forEach(piece => {
        const pieceElement = document.createElement('span');
        pieceElement.classList.add('captured-piece');
        pieceElement.innerText = getPieceUnicode(piece);
        blackCaptured.appendChild(pieceElement);
    });
};

const addMoveToHistory = (move) => {
    const moveNumber = Math.floor(moveHistory.length / 2) + 1;
    const isWhiteMove = moveHistory.length % 2 === 0;
    
    if (isWhiteMove) {
        // Start new row for white's move
        const moveItem = document.createElement('div');
        moveItem.classList.add('move-item');
        moveItem.id = `move-${moveNumber}`;
        
        const numberSpan = document.createElement('span');
        numberSpan.classList.add('move-number');
        numberSpan.innerText = `${moveNumber}.`;
        
        const whiteSpan = document.createElement('span');
        whiteSpan.innerText = move.san || `${move.from}-${move.to}`;
        
        const blackSpan = document.createElement('span');
        blackSpan.innerText = '';
        
        moveItem.appendChild(numberSpan);
        moveItem.appendChild(whiteSpan);
        moveItem.appendChild(blackSpan);
        
        if (moveHistory.length === 0) {
            moveHistoryElement.innerHTML = '';
        }
        moveHistoryElement.appendChild(moveItem);
    } else {
        // Add black's move to existing row
        const currentMoveItem = document.getElementById(`move-${moveNumber}`);
        if (currentMoveItem) {
            const blackSpan = currentMoveItem.children[2];
            blackSpan.innerText = move.san || `${move.from}-${move.to}`;
        }
    }
    
    moveHistory.push(move);
    moveCount.innerText = moveHistory.length;
    
    // Scroll to bottom
    moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
};

const updatePlayerRoleDisplay = () => {
    if (playerRole === 'w') {
        playerRoleDisplay.innerText = 'White Player';
        playerRoleDisplay.style.color = '#667eea';
    } else if (playerRole === 'b') {
        playerRoleDisplay.innerText = 'Black Player';
        playerRoleDisplay.style.color = '#667eea';
    } else {
        playerRoleDisplay.innerText = 'Spectator';
        playerRoleDisplay.style.color = '#999';
    }
};

socket.on("playerRole", function (role) {
    playerRole = role;
    updatePlayerRoleDisplay();
    renderBoard();
    updateTurnIndicator();
});

socket.on("spectatorRole", function () {
    playerRole = null;
    updatePlayerRoleDisplay();
    renderBoard();
    updateTurnIndicator();
});

socket.on("boardState", function(fen){
    chess.load(fen);
    renderBoard();
    updateTurnIndicator();
    updateCapturedPieces();
});

socket.on("move", function(move){
    // Store last move for highlighting
    lastMove = move;
    
    // Check for captures before making the move
    const targetSquare = chess.get(move.to);
    if (targetSquare) {
        const capturedBy = targetSquare.color === 'w' ? 'black' : 'white';
        capturedPieces[capturedBy].push(targetSquare);
    }
    
    const result = chess.move(move);
    if (result) {
        addMoveToHistory(result);
    }
    
    renderBoard();
    updateTurnIndicator();
    updateCapturedPieces();
});

socket.on("selfMove", () => {
    document.getElementById("move-self").play();
});

socket.on("capture", () => {
    document.getElementById("capture").play();
});

socket.on("notify", () => {
    document.getElementById("notify").play();
});

socket.on("invalid", () => {
    document.getElementById("invalid").play();
});

socket.on("gameReady", () => {
    gameReady = true;
    waitingOverlay.classList.add('hidden');
    document.getElementById("notify").play();
});

socket.on("waitingForPlayer", (data) => {
    gameReady = false;
    waitingOverlay.classList.remove('hidden');
    
    // Update player slots
    if (data.white) {
        whiteSlot.classList.add('joined');
    } else {
        whiteSlot.classList.remove('joined');
    }
    
    if (data.black) {
        blackSlot.classList.add('joined');
    } else {
        blackSlot.classList.remove('joined');
    }
    
    // Update message
    if (data.white && !data.black) {
        waitingMessage.innerText = 'Waiting for Black player to join...';
    } else if (!data.white && data.black) {
        waitingMessage.innerText = 'Waiting for White player to join...';
    } else {
        waitingMessage.innerText = 'Waiting for players to join...';
    }
});

socket.on("playerDisconnected", (color) => {
    gameReady = false;
    waitingOverlay.classList.remove('hidden');
    waitingMessage.innerText = `${color === 'white' ? 'White' : 'Black'} player disconnected. Waiting for reconnection...`;
    
    if (color === 'white') {
        whiteSlot.classList.remove('joined');
    } else {
        blackSlot.classList.remove('joined');
    }
});

socket.on("gameNotReady", () => {
    // Visual feedback that game hasn't started yet
    document.getElementById("invalid").play();
});

// Initialize
renderBoard();
updateTurnIndicator();
updatePlayerRoleDisplay();
updateCapturedPieces();
