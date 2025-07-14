// Game state
const gameState = {
  roomId: null,
  playerIndex: null,
  socket: null,
  health: 5,
  opponentHealth: 5,
  hand: [],
  fieldCards: [], // Cards on field
  opponentFieldCards: [],
  battleCard: null,
  opponentBattleCard: null,
  gameLocked: false,
  bothPlayersReady: false
};

// Animation durations
const ANIMATION_DURATION = {
  CARD_MOVE: 300,
  BATTLE: 1000,
  RESULT: 1500
};

// Card definitions and deck
const CARDS = {
  ROCK: { type: 'rock', image: 'assets/images/cards/rock.png' },
  PAPER: { type: 'paper', image: 'assets/images/cards/paper.png' },
  SCISSORS: { type: 'scissors', image: 'assets/images/cards/scissors.png' }
};

const FULL_DECK = [
  ...Array(6).fill('ROCK'),
  ...Array(6).fill('PAPER'),
  ...Array(6).fill('SCISSORS')
];

let playerDeck = [...FULL_DECK];

// Add enhanced connection state tracking
const connectionState = {
  isConnected: false,
  lastPing: Date.now(),
  reconnectAttempts: 0,
  isReconnecting: false,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  lastError: null
};

// Shuffle array function
  function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Get random card from deck
function getRandomCard() {
  if (playerDeck.length === 0) {
    playerDeck = [...FULL_DECK];
    shuffle(playerDeck);
  }
  return playerDeck.pop();
}

// DOM Elements
const playerHealth = document.getElementById('player-health');
const opponentHealth = document.getElementById('opponent-health');
const handCards = document.getElementById('hand-cards');
const timerCount = document.getElementById('timer-count');
const endTurnBtn = document.getElementById('end-turn');
const resetBtn = document.getElementById('reset-selection');
const surrenderBtn = document.getElementById('surrender');
const turnTimer = document.getElementById('turn-timer');

// Add CSS for card slots and animations
const style = document.createElement('style');
style.textContent = `
  .card-slot {
    width: 60px;
    height: 90px;
    border: 2px dashed #ccc;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: transform 0.3s ease;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .card-slot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }

  .card-slot.empty {
    background-color: rgba(255, 255, 255, 0.05);
  }
`;
document.head.appendChild(style);

// Initialize socket connection with enhanced error handling
function initializeSocket() {
  const socket = io('http://localhost:3000', {
    reconnection: true,
    reconnectionAttempts: connectionState.maxReconnectAttempts,
    reconnectionDelay: connectionState.reconnectDelay,
    timeout: 20000,
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    connectionState.isConnected = true;
    connectionState.reconnectAttempts = 0;
    connectionState.lastError = null;
    hideConnectionError();
    
    if (connectionState.isReconnecting) {
      console.log('Reconnected, requesting game state sync...');
      socket.emit('requestSync', { 
        roomId: gameState.roomId, 
        player: gameState.playerIndex 
      });
      connectionState.isReconnecting = false;
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    connectionState.isConnected = false;
    connectionState.isReconnecting = true;
    connectionState.lastError = reason;
    showConnectionError(`Connection lost (${reason}). Attempting to reconnect...`);
    attemptReconnect();
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionState.isConnected = false;
    connectionState.lastError = error.message;
    showConnectionError(`Connection error: ${error.message}`);
    attemptReconnect();
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    connectionState.lastError = error.message;
    showConnectionError(`Socket error: ${error.message}`);
  });

  return socket;
}

// Initialize game
window.startPvpGame = function({ roomId, playerIndex, socket }) {
  // Initialize socket first
  gameState.socket = socket || initializeSocket();
  
    gameState.roomId = roomId;
    gameState.playerIndex = playerIndex;
  gameState.health = 5;
  gameState.opponentHealth = 5;
  gameState.hand = [];
  gameState.fieldCards = [];
  gameState.opponentFieldCards = [];
  gameState.battleCard = null;
  gameState.opponentBattleCard = null;
  gameState.gameLocked = false;
  gameState.bothPlayersReady = false;
      
  // Add card hover effect
  document.documentElement.style.setProperty('--card-hover-transform', 'scale(1.1) translateY(-10px)');
  document.documentElement.style.setProperty('--card-transition', 'transform 0.2s ease');
    
    setupEventListeners();
    dealInitialCards();
    updateUI();
};

// Deal initial cards
async function dealInitialCards() {
    const handContainer = document.getElementById('hand-cards');
    handContainer.innerHTML = ''; // Clear existing cards
    
    // Shuffle deck first
    shuffle(playerDeck);
    
    for (let i = 0; i < 3; i++) {
      const card = getRandomCard();
      gameState.hand.push(card);
      
      // Create and add new card with dealing animation
      const div = document.createElement('div');
      div.classList.add('card', 'dealing');
      
      const img = document.createElement('img');
      img.src = CARDS[card].image;
      img.alt = CARDS[card].type;
      div.appendChild(img);
      
      handContainer.appendChild(div);
      
    // Play dealing sound
        playSound('draw');
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // After all cards are dealt, render them normally
    setTimeout(() => {
      renderHand();
    }, 300);
}

// Render player's hand
function renderHand() {
  console.log('Rendering hand:', gameState.hand);
  const handContainer = document.getElementById('hand-cards');
  if (!handContainer) {
    console.error('Hand container not found!');
    return;
  }
  
  handContainer.innerHTML = '';
  
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  
  gameState.hand.forEach((card, index) => {
    const div = document.createElement('div');
    div.classList.add('card');
    
    const img = document.createElement('img');
    img.src = CARDS[card].image;
    img.alt = CARDS[card].type;
    img.onerror = () => {
      console.error('Failed to load card image:', CARDS[card].image);
      img.src = 'assets/images/cards/back.png';
    };
    div.appendChild(img);
    
    // Only allow clicking cards if not locked and field isn't full
    if (!gameState.gameLocked && fieldCardCount < 2) {
      div.style.cursor = 'pointer';
      div.style.opacity = '1';
      div.onclick = () => {
        console.log('Card clicked:', index);
        try {
          playSound('click');
        } catch (error) {
          console.error('Failed to play sound:', error);
        }
        selectCard(index);
      };
    } else {
      div.style.cursor = 'not-allowed';
      div.style.opacity = '0.7';
      div.onclick = null; // Remove click handler completely
    }
    
    handContainer.appendChild(div);
  });
  
  const deckCount = document.getElementById('deck-count');
  if (deckCount) {
    deckCount.textContent = `Hand: ${gameState.hand.length} cards`;
  }
}

// Select card from hand
function selectCard(index) {
  if (gameState.gameLocked) return;
  
  // Count valid cards on field
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  
  // Don't allow selecting if field is full
  if (fieldCardCount >= 2) {
    return;
  }

  const cardSlot1 = document.getElementById('player-card1');
  const cardSlot2 = document.getElementById('player-card2');
  
  // Get the card value
  const selectedCard = gameState.hand[index];
  
  // Check if this card is already on the field
  const fieldIndex = gameState.fieldCards.indexOf(selectedCard);
  if (fieldIndex !== -1) {
    // Return card from field to hand
    gameState.fieldCards.splice(fieldIndex, 1);
    const slotToEmpty = fieldIndex === 0 ? cardSlot1 : cardSlot2;
    slotToEmpty.innerHTML = '';
    slotToEmpty.onclick = null;
    slotToEmpty.classList.remove('selected');
    
    // Return card to hand
    gameState.hand.push(selectedCard);
    
    renderHand();
    renderField();
    updateUI();
    return;
  }
  
  // Find empty slot
  let slotToFill = null;
  let slotIndex = 0;
  
  if (!cardSlot1.innerHTML) {
    slotToFill = cardSlot1;
    slotIndex = 0;
  } else if (!cardSlot2.innerHTML) {
    slotToFill = cardSlot2;
    slotIndex = 1;
  }

  if (slotToFill) {
    // Add to field cards array
    gameState.fieldCards[slotIndex] = selectedCard;
    
    // Remove card from hand
    gameState.hand.splice(index, 1);
    
    // Add to field with animation
    const cardImage = `<img src="${CARDS[selectedCard].image}" alt="${CARDS[selectedCard].type}">`;
    slotToFill.style.transform = 'scale(0)';
    setTimeout(() => {
      slotToFill.innerHTML = cardImage;
      slotToFill.style.transform = 'scale(1)';
      slotToFill.classList.add('selected');
    }, 150);

    // Add click handler to return card
    slotToFill.onclick = () => {
      if (gameState.gameLocked) return;
      
      // Return card to hand
      gameState.hand.push(selectedCard);
      
      // Remove from field cards
      gameState.fieldCards[slotIndex] = null;
      
      // Clear field slot
      slotToFill.innerHTML = '';
      slotToFill.onclick = null;
      slotToFill.classList.remove('selected');
      
      // Play sound
      playSound('reset');
      
      renderHand();
      renderField();
      updateUI();
    };
  }

  renderHand();
  renderField();
  updateUI();
}

// Render battlefield
function renderField() {
  // Only show card backs when game is locked (after end turn)
  const showCardBack = gameState.gameLocked && !gameState.bothPlayersReady;
  
  // Player's field cards
  if (gameState.fieldCards.length > 0) {
    // First card
    if (showCardBack) {
      setCardImage('player-card1', 'back');
    } else {
      setCardImage('player-card1', gameState.fieldCards[0]);
    }
    
    // Second card (if exists)
    if (gameState.fieldCards.length > 1) {
      if (showCardBack) {
        setCardImage('player-card2', 'back');
      } else {
        setCardImage('player-card2', gameState.fieldCards[1]);
      }
    } else {
      setCardImage('player-card2', null);
    }
  } else {
    // No cards on field
    setCardImage('player-card1', null);
    setCardImage('player-card2', null);
  }

  // Opponent's field cards
  if (gameState.opponentFieldCards.length > 0) {
    // First card
    if (showCardBack) {
      setCardImage('opponent-card1', 'back');
    } else {
      setCardImage('opponent-card1', gameState.opponentFieldCards[0]);
    }
    
    // Second card (if exists)
    if (gameState.opponentFieldCards.length > 1) {
      if (showCardBack) {
        setCardImage('opponent-card2', 'back');
      } else {
        setCardImage('opponent-card2', gameState.opponentFieldCards[1]);
      }
    } else {
      setCardImage('opponent-card2', null);
    }
  } else {
    // No opponent cards on field
    setCardImage('opponent-card1', null);
    setCardImage('opponent-card2', null);
  }
}

// Set card image in slot
function setCardImage(slotId, card) {
  const slot = document.getElementById(slotId);
  if (!slot) return;

  if (!card) {
    slot.innerHTML = '';
    slot.classList.add('empty');
    return;
  }

  slot.classList.remove('empty');
  if (card === 'back') {
    slot.innerHTML = `<img src="assets/images/cards/back.png" alt="Card Back">`;
  } else {
    slot.innerHTML = `<img src="${CARDS[card].image}" alt="${CARDS[card].type}">`;
  }
}

// Handle player turn
function handlePlayerTurn() {
  // Count valid cards on field
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  
  if (fieldCardCount !== 2 || gameState.gameLocked) {
    alert('Please place 2 cards on the field first!');
    return;
  }
  
  // Lock the game
  gameState.gameLocked = true;
  
  // Remove null values from field cards
  gameState.fieldCards = gameState.fieldCards.filter(card => card !== null);
  
  // Send field cards to server with error handling
  if (!safeEmit('submitFieldCards', {
    roomId: gameState.roomId,
    player: gameState.playerIndex,
    cards: gameState.fieldCards
  })) {
    // Revert changes if emission failed
    gameState.gameLocked = false;
    return;
  }
  
  playSound('card-down');
  renderHand();
  renderField();
  updateUI();
}

// Select card to return to hand
function promptSelectReturnCard() {
  const card1 = document.getElementById('player-card1');
  const card2 = document.getElementById('player-card2');
  
  // Make sure we have both cards
  if (!card1 || !card2) return;
  
  // Now show the actual cards for selection
  setCardImage('player-card1', gameState.fieldCards[0]);
  setCardImage('player-card2', gameState.fieldCards[1]);
  
  // Also reveal opponent's cards
  setCardImage('opponent-card1', gameState.opponentFieldCards[0]);
  setCardImage('opponent-card2', gameState.opponentFieldCards[1]);
  
  // Add selection styling
  card1.classList.add('selectable');
  card2.classList.add('selectable');
  card1.classList.add('hoverable');
  card2.classList.add('hoverable');
  
  // Clear any existing click handlers
  card1.onclick = null;
  card2.onclick = null;
  
  function selectReturn(index) {
    // Remove selection styling
    card1.classList.remove('selectable', 'hoverable');
    card2.classList.remove('selectable', 'hoverable');
    
    const keepIndex = index;
    const playCard = gameState.fieldCards[keepIndex === 0 ? 1 : 0];
    const returnCard = gameState.fieldCards[keepIndex];
    
    // Return one card to hand
    gameState.hand.push(returnCard);
    
    // Set battle card
    gameState.battleCard = playCard;
    gameState.fieldCards = [playCard];
    
    // Lock game and send battle card to server
    gameState.gameLocked = true;
    gameState.socket.emit('submitBattleCard', {
      roomId: gameState.roomId,
      player: gameState.playerIndex,
      cardIndex: keepIndex,
      card: playCard
    });
    
    // Update UI
    renderHand();
    renderField();
    updateUI();
    playSound('rps-battle');
    
    // Clean up
    card1.onclick = null;
    card2.onclick = null;
    
    // Update status
    document.getElementById('turn-timer').textContent = 'Waiting for opponent...';
  }
  
  // Add new click handlers
  card1.onclick = () => selectReturn(0);
  card2.onclick = () => selectReturn(1);
}

// Play sound
function playSound(name) {
  const audio = new Audio(`assets/sounds/${name}.mp3`);
  audio.play();
}

// Show battle announcement
function showBattleAnnouncement(resultText, resultType, details = '') {
  const announcement = document.createElement('div');
  announcement.className = `battle-announcement announcement-${resultType}`;
  
  const resultClass = resultType === 'win' ? 'win-text' : 
                     resultType === 'lose' ? 'lose-text' : 
                     'draw-text';
  
  announcement.innerHTML = `
    <h2 class="${resultClass}">${resultText}</h2>
    <div class="result-details">${details}</div>
  `;
  
  document.body.appendChild(announcement);
  
  // Play appropriate sound effect
  playSound(resultType === 'win' ? 'win' : 
           resultType === 'lose' ? 'lose' : 
           'rps-battle');
  
  // Remove announcement after animation
  setTimeout(() => {
    announcement.style.animation = 'announceOut 0.5s ease-in forwards';
    setTimeout(() => announcement.remove(), 500);
  }, 2000);
}

// Update UI elements
function updateUI() {
  // Update health
  playerHealth.textContent = '❤️'.repeat(gameState.health);
  opponentHealth.textContent = '❤️'.repeat(gameState.opponentHealth);
  
  // Update turn indicator and phase
  let statusText = '';
  if (gameState.gameLocked) {
    if (gameState.battleCard) {
      statusText = '<span class="timer-text">Waiting for opponent...</span>';
    } else if (gameState.bothPlayersReady) {
      statusText = '<span class="timer-text">Choose a card to return!</span>';
    } else {
      statusText = '<span class="timer-text">Cards placed! Waiting for opponent...</span>';
    }
  } else {
    const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
    if (fieldCardCount === 2) {
      statusText = '<span class="timer-text ready">Ready to end turn!</span>';
    } else {
      statusText = `<span class="timer-text">Select cards (${fieldCardCount}/2)</span>`;
    }
  }
  
  document.getElementById('turn-timer').innerHTML = statusText;
  
  // Update buttons
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  const canEndTurn = !gameState.gameLocked && fieldCardCount === 2;
  endTurnBtn.disabled = !canEndTurn;
  
  // Only enable reset when there are cards on field
  resetBtn.disabled = fieldCardCount === 0;
  
  // Update card interaction states
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    const isInteractable = !gameState.gameLocked && fieldCardCount < 2;
    card.style.cursor = isInteractable ? 'pointer' : 'not-allowed';
    card.style.opacity = isInteractable ? '1' : '0.7';
  });
  
  const fieldCards = document.querySelectorAll('.field-card:not(.opponent)');
  fieldCards.forEach(card => {
    const isInteractable = !gameState.gameLocked;
    card.style.cursor = isInteractable ? 'pointer' : 'not-allowed';
    card.style.opacity = isInteractable ? '1' : '0.7';
  });
}

// Setup event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // End turn button
  const endTurnButton = document.getElementById('end-turn');
  endTurnButton.onclick = () => {
    if (!checkConnection()) {
      showConnectionError('Not connected to server');
      return;
    }
    if (!gameState.gameLocked && gameState.fieldCards.length === 2) {
      handlePlayerTurn();
    }
  };

  // Reset button
  const resetButton = document.getElementById('reset-selection');
  resetButton.onclick = () => {
    if (!gameState.gameLocked) {
      // Return field cards to hand
      gameState.fieldCards.forEach(card => {
        if (card) {
          gameState.hand.push(card);
        }
      });
      
      // Clear card slots
      const cardSlot1 = document.getElementById('player-card1');
      const cardSlot2 = document.getElementById('player-card2');
      if (cardSlot1) {
        cardSlot1.innerHTML = '';
        cardSlot1.onclick = null;
        cardSlot1.classList.remove('selected');
      }
      if (cardSlot2) {
        cardSlot2.innerHTML = '';
        cardSlot2.onclick = null;
        cardSlot2.classList.remove('selected');
      }
      
      // Clear field cards array
      gameState.fieldCards = [];
      
      // Re-render and update UI
      renderHand();
      renderField();
      updateUI();
      
      // Play reset sound if available
      try {
        playSound('reset');
      } catch (error) {
        console.log('Reset sound not available');
      }
    }
  };

  // Surrender button
  const surrenderButton = document.getElementById('surrender');
  surrenderButton.onclick = () => {
    if (!checkConnection()) {
      showConnectionError('Not connected to server');
      return;
    }
    if (confirm('Are you sure you want to surrender?')) {
      safeEmit('surrender', {
        roomId: gameState.roomId,
        player: gameState.playerIndex
      });
    }
  };

  // Socket events
  gameState.socket.on('opponentFieldCards', ({ player, cards }) => {
    if (player !== gameState.playerIndex) {
      gameState.opponentFieldCards = ['back', 'back']; // Mark that opponent has placed cards, but show them as face down
      renderField();
      updateUI();
    }
  });

  // Handle when both players are ready
  gameState.socket.on('allPlayersReady', ({ fieldCards }) => {
    // Update both players' field cards with actual values
    gameState.fieldCards = fieldCards[gameState.playerIndex];
    gameState.opponentFieldCards = fieldCards[gameState.playerIndex === 1 ? 2 : 1];

    // Set ready flag to reveal cards
    gameState.bothPlayersReady = true;
    gameState.gameLocked = false; // Unlock game to allow card selection
    
    // Show the actual cards
    renderField();
    
    // Prompt for return card selection
    document.getElementById('turn-timer').textContent = 'Return which card?';
    promptSelectReturnCard();
  });

  gameState.socket.on('battleResult', ({ winner, cards, health }) => {
    const myCard = cards[gameState.playerIndex];
    const opponentCard = cards[gameState.playerIndex === 1 ? 2 : 1];
    
    gameState.battleCard = myCard;
    gameState.opponentBattleCard = opponentCard;
    gameState.health = health[gameState.playerIndex];
    gameState.opponentHealth = health[gameState.playerIndex === 1 ? 2 : 1];
    
    // Show result with details
    let resultText, resultType;
    const details = `Your ${myCard.toUpperCase()} vs Opponent's ${opponentCard.toUpperCase()}`;
    
    if (winner === 0) {
      resultText = 'DRAW!';
      resultType = 'draw';
    } else if (winner === gameState.playerIndex) {
      resultText = 'YOU WIN!';
      resultType = 'win';
    } else {
      resultText = 'YOU LOSE!';
      resultType = 'lose';
    }
    
    // Show announcement with battle details
    showBattleAnnouncement(resultText, resultType, details);
    
    // Update UI
    renderField();
    updateUI();
  });

  gameState.socket.on('roundReset', async () => {
    gameState.fieldCards = [];
    gameState.opponentFieldCards = [];
    gameState.battleCard = null;
    gameState.opponentBattleCard = null;
    gameState.gameLocked = false;
    gameState.bothPlayersReady = false;
    
    // Draw new card with animation
    const newCard = getRandomCard();
    await addCardToHand(newCard);
    
      renderField();
    updateUI();
  });

  gameState.socket.on('gameOver', ({ winner, reason, finalHealth, finalCards }) => {
    const isWinner = winner === gameState.playerIndex;
    let resultText, resultType, details;
    
    if (winner === 0) {
      resultText = 'DRAW GAME!';
      resultType = 'draw';
      details = 'Both players ran out of cards!';
    } else if (isWinner) {
      resultText = 'VICTORY!';
      resultType = 'win';
      details = 'You defeated your opponent!';
    } else {
      resultText = 'DEFEAT!';
      resultType = 'lose';
      details = 'Your opponent was victorious!';
    }
    
    // Show final announcement
    showBattleAnnouncement(resultText, resultType, details);
    
    // Disable all game controls
    gameState.gameLocked = true;
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    
    // Return to main menu after delay
    setTimeout(() => {
      window.location.href = '/';
    }, 3000);
  });

  gameState.socket.on('opponentDisconnected', () => {
    alert('Opponent disconnected!');
    window.location.href = 'mode.html';
  });

  // Game state sync
  gameState.socket.on('syncState', (serverState) => {
    syncGameState(serverState);
  });

  // Ping every 5 seconds to check connection
  setInterval(() => {
    if (connectionState.isConnected) {
      const now = Date.now();
      if (now - connectionState.lastPing > 10000) {
        console.warn('No ping response for 10 seconds');
        showConnectionError('Connection may be unstable');
      }
      gameState.socket.emit('ping');
    }
  }, 5000);

  gameState.socket.on('pong', () => {
    connectionState.lastPing = Date.now();
  });
}

// Add new card to hand with animation
async function addCardToHand(card) {
  gameState.hand.push(card);
  
  const handContainer = document.getElementById('hand-cards');
  
  // Create new card with dealing animation
  const div = document.createElement('div');
  div.classList.add('card', 'dealing');
  
  const img = document.createElement('img');
  img.src = CARDS[card].image;
  img.alt = CARDS[card].type;
  div.appendChild(img);
  
  handContainer.appendChild(div);
  
  // Play dealing sound
  playSound('draw');
  
  // Wait for animation
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Render hand normally after animation
  renderHand();
}

// Enhanced reconnection logic
function attemptReconnect() {
  if (connectionState.reconnectAttempts < connectionState.maxReconnectAttempts) {
    connectionState.reconnectAttempts++;
    const delay = connectionState.reconnectDelay * Math.min(connectionState.reconnectAttempts, 3);
    
    console.log(`Reconnect attempt ${connectionState.reconnectAttempts} in ${delay}ms`);
    showConnectionError(`Reconnecting... Attempt ${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts}`);
    
    setTimeout(() => {
      if (!connectionState.isConnected) {
        console.log('Attempting to reconnect...');
        gameState.socket.connect();
      }
    }, delay);
  } else {
    const error = 'Maximum reconnection attempts reached. Please refresh the page.';
    console.error(error);
    showConnectionError(error);
  }
}

// Enhanced error display
function showConnectionError(message) {
  console.warn('Connection Error:', message);
  
  const errorDiv = document.getElementById('connection-error') || document.createElement('div');
  errorDiv.id = 'connection-error';
  errorDiv.className = 'connection-error';
  errorDiv.innerHTML = `
    <div class="error-content">
      <strong>Connection Error</strong>
      <p>${message}</p>
      ${connectionState.reconnectAttempts > 0 ? 
        `<p>Attempt ${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts}</p>` : 
        ''}
    </div>
  `;
  
  if (!document.body.contains(errorDiv)) {
    document.body.appendChild(errorDiv);
  }
}

// Enhanced connection check
function checkConnection() {
  if (!connectionState.isConnected) {
    showConnectionError('Not connected to server');
    if (!connectionState.isReconnecting) {
      attemptReconnect();
    }
    return false;
  }
  return true;
}

// Enhanced safe emit with retry
function safeEmit(eventName, data, retries = 2) {
  if (!checkConnection()) {
    console.warn(`Failed to emit ${eventName}: Not connected`);
    return false;
  }
  
  try {
    gameState.socket.emit(eventName, data, (response) => {
      if (response && response.error) {
        console.error(`Server error for ${eventName}:`, response.error);
        showConnectionError(`Server error: ${response.error}`);
        return false;
      }
    });
    return true;
  } catch (error) {
    console.error(`Error emitting ${eventName}:`, error);
    if (retries > 0) {
      console.log(`Retrying ${eventName} (${retries} attempts left)...`);
      setTimeout(() => safeEmit(eventName, data, retries - 1), 1000);
    } else {
      showConnectionError(`Failed to communicate with server: ${error.message}`);
      resetGameState();
    }
    return false;
  }
}

// Hide connection error message
function hideConnectionError() {
  const errorDiv = document.getElementById('connection-error');
  if (errorDiv) {
    errorDiv.remove();
  }
}

// Sync game state with server
function syncGameState(serverState) {
  // Update local state with server state
  gameState.health = serverState.health;
  gameState.opponentHealth = serverState.opponentHealth;
  gameState.fieldCards = serverState.fieldCards;
  gameState.opponentFieldCards = serverState.opponentFieldCards;
  gameState.battleCard = serverState.battleCard;
  gameState.opponentBattleCard = serverState.opponentBattleCard;
  gameState.gameLocked = serverState.gameLocked;
  gameState.bothPlayersReady = serverState.bothPlayersReady;

  // Re-render UI
  renderHand();
  renderField();
  updateUI();
}

// Reset game state
function resetGameState() {
  gameState.gameLocked = false;
  gameState.selectedCards = [];
  gameState.fieldCards = [];
  gameState.opponentFieldCards = [];
  gameState.battleCard = null;
  gameState.opponentBattleCard = null;
  gameState.bothPlayersReady = false;
  renderHand();
  renderField();
  updateUI();
}

window.resumeGame = function (socket) {
  const roomId = localStorage.getItem("pvpRoom");
  const player = parseInt(localStorage.getItem("pvpPlayer"));

  if (roomId && player) {
    // ส่ง player ไปด้วยเพื่อให้ server จำได้
    socket.emit("joinRoom", { roomId, player });

    socket.on("startGame", () => {
      document.getElementById("loader-overlay").style.display = "none";
      document.getElementById("game-ui").style.display = "block";
      window.startPvpGame({ roomId, playerIndex: player, socket });
    });
  }
};
