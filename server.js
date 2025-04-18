const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

const rooms = {};
const playerMoves = {};
const readyToReturn = {};
const gameState = {};

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("joinRoom", ({ roomId, player }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];

    // บันทึก socket ใหม่ของผู้เล่น
    rooms[roomId][player - 1] = socket.id;

    // ส่งสถานะเกมเดิมให้ client ถ้ามี
    if (gameState[roomId]) {
      socket.emit("resumeGame", gameState[roomId]);
    }

    // ถ้าทั้งสองฝั่งเชื่อมต่อครบแล้ว เริ่มเกม
    const socket1 = rooms[roomId][0] && io.sockets.sockets.get(rooms[roomId][0]);
    const socket2 = rooms[roomId][1] && io.sockets.sockets.get(rooms[roomId][1]);
    if (socket1 && socket2) {
      io.to(roomId).emit("startGame");
    }
  });

  socket.on("submitCard", ({ roomId, player, card, fieldCards, state }) => {
    if (!playerMoves[roomId]) playerMoves[roomId] = {};
    if (!readyToReturn[roomId]) readyToReturn[roomId] = {};
    if (!gameState[roomId]) gameState[roomId] = {};

    gameState[roomId][player] = state;

    if (fieldCards) {
      playerMoves[roomId][player] = { ...playerMoves[roomId][player], fieldCards };
    }

    if (
      playerMoves[roomId][1]?.fieldCards &&
      playerMoves[roomId][2]?.fieldCards &&
      !readyToReturn[roomId].sent
    ) {
      io.to(roomId).emit("showFields", {
        1: playerMoves[roomId][1].fieldCards,
        2: playerMoves[roomId][2].fieldCards,
      });
      readyToReturn[roomId].sent = true;
    }

    if (card) {
      playerMoves[roomId][player] = { ...playerMoves[roomId][player], card };
      readyToReturn[roomId][player] = true;

      if (
        readyToReturn[roomId][1] &&
        readyToReturn[roomId][2] &&
        playerMoves[roomId][1]?.card &&
        playerMoves[roomId][2]?.card
      ) {
        const card1 = playerMoves[roomId][1].card;
        const card2 = playerMoves[roomId][2].card;
        const winner = resolveBattle(card1, card2);

        io.to(roomId).emit("roundResult", { winner, card1, card2 });

        // reset รอบใหม่
        playerMoves[roomId] = {};
        readyToReturn[roomId] = {};
        gameState[roomId][1].field = [];
        gameState[roomId][2].field = [];
      }
    }
  });

  socket.on("surrender", ({ roomId, player }) => {
    const opponent = player === 1 ? 2 : 1;
    if (rooms[roomId]) {
      io.to(roomId).emit("opponentSurrendered", { loser: player, winner: opponent });
      delete playerMoves[roomId];
      delete readyToReturn[roomId];
      delete gameState[roomId];
      delete rooms[roomId];
    }
  });

  socket.on("disconnect", () => {
    for (const room in rooms) {
      rooms[room] = rooms[room].filter(id => id !== socket.id);
      if (rooms[room].length === 0) {
        delete rooms[room];
        delete playerMoves[room];
        delete readyToReturn[room];
        delete gameState[room];
      }
    }
    console.log("🔴 Disconnected:", socket.id);
  });
});

function resolveBattle(p1, p2) {
  if (p1 === p2) return "draw";
  const beats = { rock: "scissors", scissors: "paper", paper: "rock" };
  return beats[p1] === p2 ? 1 : 2;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
