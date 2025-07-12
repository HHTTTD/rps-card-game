const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 20000,
  pingInterval: 5000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname)));

const rooms = new Map();
const matchmakingQueue = [];

// สร้าง Room ID แบบสุ่ม
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

function createGameState() {
  return {
    started: false,
    players: {},
    fieldCards: {},
    battleCards: {},
    turnEnded: {},
    roundCount: 1,
    lastActivity: Date.now()
  };
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("ping", () => {
    socket.emit("pong");
  });

  // Add reconnection handling
  socket.on("reconnect_attempt", () => {
    const playerRooms = [...socket.rooms].filter(room => rooms.has(room));
    
    if (playerRooms.length > 0) {
      const roomId = playerRooms[0];
      const gameState = rooms.get(roomId);
      
      if (!gameState) {
        socket.emit("error", { message: "Game not found" });
        return;
      }
      
      // Find player index
      let playerIndex = null;
      Object.entries(gameState.players).forEach(([index, player]) => {
        if (player.socketId === socket.id) {
          playerIndex = parseInt(index);
        }
      });
      
      if (playerIndex) {
        // Update socket connection
        gameState.players[playerIndex].connected = true;
        gameState.players[playerIndex].socketId = socket.id;
        
        // Send current game state
        socket.emit("syncState", {
          health: gameState.players[playerIndex].health,
          opponentHealth: gameState.players[playerIndex === 1 ? 2 : 1].health,
          fieldCards: gameState.fieldCards[playerIndex] || [],
          opponentFieldCards: gameState.fieldCards[playerIndex === 1 ? 2 : 1] || [],
          battleCard: gameState.battleCards[playerIndex],
          opponentBattleCard: gameState.battleCards[playerIndex === 1 ? 2 : 1],
          gameLocked: true, // Lock game until sync complete
          bothPlayersReady: Object.keys(gameState.turnEnded).length === 2
        });
      }
    }
  });

  // Handle disconnection with improved timeout
  socket.on("disconnect", () => {
    const playerRooms = [...socket.rooms].filter(room => rooms.has(room));
    
    playerRooms.forEach(roomId => {
      const gameState = rooms.get(roomId);
      
      if (!gameState) return;
      
      // Find and mark disconnected player
      Object.entries(gameState.players).forEach(([index, player]) => {
        if (player.socketId === socket.id) {
          player.connected = false;
          player.disconnectedAt = Date.now();
          
          // Notify opponent
          socket.to(roomId).emit("opponentDisconnected");
          
          // Start disconnect timer
          setTimeout(() => {
            // Check if player is still disconnected
            if (!player.connected && (Date.now() - player.disconnectedAt) >= 30000) {
              // End game if player hasn't reconnected
              io.to(roomId).emit("gameOver", {
                winner: index === "1" ? 2 : 1,
                reason: "disconnect"
              });
              rooms.delete(roomId);
            }
          }, 30000); // 30 second timeout
        }
      });
    });
  });

  // Request sync handler
  socket.on("requestSync", ({ roomId, player }) => {
    const gameState = rooms.get(roomId);
    
    if (!gameState) {
      socket.emit("error", { message: "Game not found" });
      return;
    }
    
    socket.emit("syncState", {
      health: gameState.players[player].health,
      opponentHealth: gameState.players[player === 1 ? 2 : 1].health,
      fieldCards: gameState.fieldCards[player] || [],
      opponentFieldCards: gameState.fieldCards[player === 1 ? 2 : 1] || [],
      battleCard: gameState.battleCards[player],
      opponentBattleCard: gameState.battleCards[player === 1 ? 2 : 1],
      gameLocked: false,
      bothPlayersReady: Object.keys(gameState.turnEnded).length === 2
    });
  });

  // Quick Match system
  socket.on("quickMatch", () => {
    console.log("Player searching for match:", socket.id);
    
    if (matchmakingQueue.length > 0) {
      const opponent = matchmakingQueue.shift();
      const opponentSocket = io.sockets.sockets.get(opponent);
      
      if (opponentSocket) {
        const roomId = generateRoomId();
        rooms.set(roomId, createGameState());
        socket.emit("matched", { roomId, player: 2 });
        opponentSocket.emit("matched", { roomId, player: 1 });
      } else {
        matchmakingQueue.push(socket.id);
        socket.emit("waitingForMatch");
      }
    } else {
      matchmakingQueue.push(socket.id);
      socket.emit("waitingForMatch");
    }
  });

  // Join room
  socket.on("joinRoom", ({ roomId, player }) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, createGameState());
      }

      const gameState = rooms.get(roomId);
      
      gameState.players[player] = {
        socketId: socket.id,
        health: 5,
        connected: true
      };

      socket.join(roomId);

      if (Object.keys(gameState.players).length === 2 && !gameState.started) {
        gameState.started = true;
        io.to(roomId).emit("startGame");
      }
  });

  // Submit field cards
  socket.on("submitFieldCards", ({ roomId, player, cards }) => {
      const gameState = rooms.get(roomId);
    if (!gameState) return;

      gameState.fieldCards[player] = cards;
      gameState.turnEnded[player] = true;

      // Notify opponent about card submission (face-down)
    const opponent = player === 1 ? 2 : 1;
      const opponentSocket = io.sockets.sockets.get(gameState.players[opponent]?.socketId);
      if (opponentSocket) {
        opponentSocket.emit("opponentFieldCards", { player });
      }

      // Check if both players have ended their turn
      if (gameState.turnEnded[1] && gameState.turnEnded[2]) {
        // Reveal all field cards to both players
        io.to(roomId).emit("allPlayersReady", {
          fieldCards: gameState.fieldCards
        });
      }
  });

  // Submit battle card
  socket.on("submitBattleCard", ({ roomId, player, cardIndex, card }) => {
    const gameState = rooms.get(roomId);
    if (!gameState) return;

    gameState.battleCards[player] = card;

    // If both players have chosen their battle cards
    if (Object.keys(gameState.battleCards).length === 2) {
      const winner = resolveBattle(
        gameState.battleCards[1],
        gameState.battleCards[2]
      );

      // Update health
      if (winner !== 0) {
        const loser = winner === 1 ? 2 : 1;
        gameState.players[loser].health--;
        
        // Check for game over
        if (gameState.players[loser].health <= 0) {
          io.to(roomId).emit("gameOver", { 
            winner, 
            reason: 'health',
            finalHealth: {
              1: gameState.players[1].health,
              2: gameState.players[2].health
            },
            finalCards: {
              winner: gameState.battleCards[winner],
              loser: gameState.battleCards[loser]
            }
          });
          rooms.delete(roomId);
          return;
        }
      }

      // Send battle result to both players
      io.to(roomId).emit("battleResult", {
        winner,
        cards: gameState.battleCards,
        health: {
          1: gameState.players[1].health,
          2: gameState.players[2].health
        }
      });

      // Reset for next round
      setTimeout(() => {
        gameState.fieldCards = {};
        gameState.battleCards = {};
        gameState.turnEnded = {};
        gameState.roundCount++;
        
        // Notify clients to reset field
        io.to(roomId).emit("roundReset");
      }, 2000);
    }
  });

  // Reset round
  socket.on("resetRound", ({ roomId }) => {
    const gameState = rooms.get(roomId);
    if (!gameState) return;
    
    gameState.fieldCards = {};
    gameState.battleCards = {};
    gameState.turnEnded = {};
    gameState.roundCount++;
    
    io.to(roomId).emit("roundReset");
  });

  socket.on("surrender", ({ roomId, player }) => {
    const gameState = rooms.get(roomId);
    if (!gameState) return;

    const winner = player === 1 ? 2 : 1;
    io.to(roomId).emit("gameOver", { winner, reason: 'surrender' });
    rooms.delete(roomId);
  });
});

// Determine battle winner
function resolveBattle(card1, card2) {
  if (!card1 || !card2) return 0; // Invalid cards
  if (card1 === card2) return 0; // Draw
  
  const rules = {
    'rock': 'scissors',
    'paper': 'rock',
    'scissors': 'paper'
  };
  
  return rules[card1] === card2 ? 1 : 2;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
