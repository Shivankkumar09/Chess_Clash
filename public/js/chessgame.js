const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null; 

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

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
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
    }
    else{
        boardElement.classList.remove("flipped");
    }
};

const handleMove = (source, target) => {
   const move ={
    from:`${String.fromCharCode(97 + source.col)}${8 - source.row}`,
    to:`${String.fromCharCode(97 + target.col)}${8 - target.row}`,
    promotion:'q',
   };

   socket.emit("move" ,move);
};

const highlightPossibleMoves = (square) => {
    clearHighlightedMoves();
    const moves = chess.moves({ square: `${String.fromCharCode(97 + square.col)}${8 - square.row}`, verbose: true });
    moves.forEach(move => {
        const row = 8 - move.to.charCodeAt(1);
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
        square.querySelector(".dot").remove();
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
    turnIndicator.innerText = `Current Turn: ${currentTurn}`;
};

socket.on("playerRole", function (role) {
    playerRole = role;
    renderBoard();
    updateTurnIndicator();
});

socket.on("spectatorRole", function () {
    playerRole = null;
    renderBoard();
    updateTurnIndicator();
});



socket.on("boardState", function(fen){
    chess.load(fen);
    renderBoard();
    updateTurnIndicator();
});

socket.on("move", function(move){
    chess.move(move);
    renderBoard();
    updateTurnIndicator();
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

renderBoard();
updateTurnIndicator();
