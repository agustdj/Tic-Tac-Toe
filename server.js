
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const createCaroGame = (size = 3) => {
    const board = Array(size).fill(null).map(() => Array(size).fill(null));
    let currentPlayer = 'X';

    const printBoard = () =>
        board.map(row => row.map(cell => cell || '-').join(' ')).join('\n');

    const playMove = (x, y) => {
        // Kiểm tra nước đi hợp lệ
        // if (x < 0 || y < 0 || x > size || y > size ) {
        //     return 'invalid'; // Nước đi không hợp lệ
        // }
        
        if(board[x][y] !== null) {
            console.log("full");
            //board[x][y] = currentPlayer;
            return 'invalid';
        }

        board[x][y] = currentPlayer;

        if (checkWin(board, currentPlayer)) {
            console.log("Win!");
            return `${currentPlayer} wins!`;
        }

        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        return 'valid';
    };

    const WIN_COMBINATIONS = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    
    const checkWin = (board, currentPlayer) => {
        for (const combination of WIN_COMBINATIONS) {
            if (combination.every(index => {
                const x = Math.floor(index / size);
                const y = index % size;
                return board[x][y] === currentPlayer;
            })) {
                return true; 
            }
        }
        return false; 
    };

    return {
        board,
        printBoard,
        playMove,
        checkWin,
        get currentPlayer() { return currentPlayer; }
    };
};

let game = createCaroGame();
let players = {};

io.on('connection', (socket) => {
    if (Object.keys(players).length >= 2) {
        socket.emit('message', 'Game is full.');
        socket.disconnect(); 
        return;
    }

    const player = Object.keys(players).length === 0 ? 'X' : 'O';
    players[socket.id] = player;
    // socket.emit('message', `Chào mừng bạn, người chơi ${player}!`);
    socket.emit('message', `Chào mừng bạn, đang tìm đối thủ!`);

    if (Object.keys(players).length === 2) {
        io.emit('message', 'Bắt đầu trò chơi!');
        io.emit('updateBoard', game.board);
        io.to(Object.keys(players)[0]).emit('message', 'Đến lượt bạn!');
    }

    socket.on('playMove', ({ x, y }) => {
        if (players[socket.id] !== game.currentPlayer) {
            socket.emit('message', 'Không phải lượt của bạn!');
            return;
        }

        const result = game.playMove(x, y);
        if (result === 'valid') {
            io.emit('updateBoard', game.board);
            if (game.checkWin(game.board, game.currentPlayer)) {
                io.emit('message', `${game.currentPlayer} đã thắng!`);
                resetGame();
            } else {
                const nextPlayer = Object.keys(players).find(id => players[id] === game.currentPlayer);
                io.to(nextPlayer).emit('message', 'Đến lượt bạn!');
            }
        } else if (result === 'invalid') {
            //socket.emit('message', 'Nước đi không hợp lệ! Vui lòng chọn lại.');
            io.emit('message', `${game.currentPlayer} đã thắng!`);
            return;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        if (Object.keys(players).length < 2) {
            io.emit('message', 'Một người chơi đã thoát. Trò chơi sẽ được khởi động lại!');
            resetGame();
        }
        if (game.checkWin(game.board, game.currentPlayer)) {
            io.emit('message', 'Game Over!');
        }
    });

    const resetGame = () => {
        game = createCaroGame();
        players = {};
        io.emit('updateBoard', game.board);
    };
});

app.use(express.static('public'));

server.listen(3000, () => {
    console.log('Server chạy tại http://localhost:3000');
});
