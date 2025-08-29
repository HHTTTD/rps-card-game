// Game state
const gameState = {
  health: 5,
  botHealth: 5,
  hand: [],
  fieldCards: [],
  botFieldCards: [],
  battleCard: null,
  botBattleCard: null,
  gameLocked: false,
  deck: shuffle([...Array(6).fill('ROCK'), ...Array(6).fill('PAPER'), ...Array(6).fill('SCISSORS')]),
  // Timer system
  timer: null,
  countdown: 30,
  isReturnPhase: false
};

// Card definitions
const CARDS = {
  ROCK: { type: 'rock', image: 'assets/images/cards/rock.png' },
  PAPER: { type: 'paper', image: 'assets/images/cards/paper.png' },
  SCISSORS: { type: 'scissors', image: 'assets/images/cards/scissors.png' }
};

// DOM Elements
const playerHealth = document.getElementById('player-health');
const botHealth = document.getElementById('bot-health');
const handCards = document.getElementById('hand-cards');
const endTurnBtn = document.getElementById('end-turn');
const resetBtn = document.getElementById('reset-selection');
const surrenderBtn = document.getElementById('surrender');
const turnTimer = document.getElementById('turn-timer');

// Initialize game
function initGame() {
  gameState.health = 5;
  gameState.botHealth = 5;
  gameState.hand = [];
  gameState.fieldCards = [null, null]; // Initialize with null values for 2 slots
  gameState.botFieldCards = [];
  gameState.battleCard = null;
  gameState.botBattleCard = null;
  gameState.gameLocked = false;
  gameState.timer = null;
  gameState.countdown = 20;
  gameState.isReturnPhase = false;
  
  setupEventListeners();
  dealInitialCards();
  updateUI();
}

// Shuffle array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Timer functions
function startTimer(seconds, onExpire) {
  gameState.countdown = seconds;
  gameState.isReturnPhase = seconds === 10;
  updateTimerDisplay();
  clearInterval(gameState.timer);
  
  gameState.timer = setInterval(() => {
    gameState.countdown--;
    updateTimerDisplay();
    
    if (gameState.countdown <= 0) {
      clearInterval(gameState.timer);
      onExpire();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(gameState.timer);
  gameState.timer = null;
}

function updateTimerDisplay() {
  const timerElement = document.getElementById('turn-timer');
  if (!timerElement) return;
  
  const minutes = Math.floor(gameState.countdown / 60);
  const seconds = gameState.countdown % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  let statusText = '';
  if (gameState.isReturnPhase) {
    statusText = `<span class="timer-text urgent">Return card: ${timeString}</span>`;
  } else {
    statusText = `<span class="timer-text">Select cards: ${timeString}</span>`;
  }
  
  timerElement.innerHTML = statusText;
  
  // Add visual warning when time is running out
  if (gameState.countdown <= 5) {
    timerElement.classList.add('urgent');
  } else {
    timerElement.classList.remove('urgent');
  }
}

// Auto-select functions
function autoSelectFieldCards() {
  console.log('Auto-selecting field cards due to timeout');
  console.log('Initial state:', {
    hand: [...gameState.hand],
    fieldCards: [...gameState.fieldCards],
    handLength: gameState.hand.length
  });
  
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  const neededCards = 2 - fieldCardCount;
  
  console.log('Cards needed:', neededCards);
  
  if (neededCards > 0 && gameState.hand.length > 0) {
    // Randomly select cards from hand (allow duplicates)
    for (let i = 0; i < neededCards && gameState.hand.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * gameState.hand.length);
      const selectedCard = gameState.hand[randomIndex];
      
      console.log(`Selection ${i + 1}:`, {
        randomIndex: randomIndex,
        selectedCard: selectedCard,
        handBeforeSplice: [...gameState.hand]
      });
      
      // Find empty slot
      let slotIndex = 0;
      if (gameState.fieldCards[0] !== null) {
        slotIndex = 1;
      }
      
      // Add to field (allow duplicates)
      gameState.fieldCards[slotIndex] = selectedCard;
      gameState.hand.splice(randomIndex, 1);
      
      console.log(`After selection ${i + 1}:`, {
        fieldCards: [...gameState.fieldCards],
        handAfterSplice: [...gameState.hand],
        handLength: gameState.hand.length
      });
    }
    
    renderHand();
    renderField();
    updateUI();
  }
  
  console.log('Final state:', {
    fieldCards: [...gameState.fieldCards],
    hand: [...gameState.hand],
    fieldCardCount: gameState.fieldCards.filter(card => card !== null).length
  });
  
  // Auto-end turn
  if (gameState.fieldCards.filter(card => card !== null).length === 2) {
    handlePlayerTurn();
  }
}

function autoSelectReturnCard() {
  console.log('Auto-selecting return card due to timeout');
  
  if (gameState.fieldCards.length >= 2) {
    // Randomly choose which card to return
    const returnIndex = Math.floor(Math.random() * 2);
    const keepIndex = returnIndex === 0 ? 1 : 0;
    
    const returnCard = gameState.fieldCards[returnIndex];
    const playCard = gameState.fieldCards[keepIndex];
    
    // Return one card to hand
    gameState.hand.push(returnCard);
    
    // Set battle card
    gameState.battleCard = playCard;
    gameState.fieldCards = [playCard];
    
    // Bot randomly selects a card to keep (same logic as manual selection)
    const botKeepIndex = Math.floor(Math.random() * 2);
    gameState.botBattleCard = gameState.botFieldCards[botKeepIndex];
    gameState.botFieldCards = [gameState.botBattleCard];
    
    // Debug logging
    console.log('Auto select return card:', {
      returnIndex: returnIndex,
      keepIndex: keepIndex,
      returnCard: returnCard,
      playCard: playCard,
      botKeepIndex: botKeepIndex,
      botBattleCard: gameState.botBattleCard,
      botFieldCards: gameState.botFieldCards
    });
    
    // Update UI
    renderHand();
    renderField();
    updateUI();
    playSound('rps-battle');
    
    // Resolve battle after a delay
    setTimeout(() => {
      resolveBattle();
    }, 1000);
  }
}

// Deal initial cards
async function dealInitialCards() {
  const handContainer = document.getElementById('hand-cards');
  handContainer.innerHTML = ''; // Clear existing cards
  
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
    // Start timer for card selection
    startTimer(20, autoSelectFieldCards);
  }, 300);
}

// Get random card from deck
function getRandomCard() {
  if (gameState.deck.length === 0) {
    gameState.deck = [...Array(6).fill('ROCK'), ...Array(6).fill('PAPER'), ...Array(6).fill('SCISSORS')];
    shuffle(gameState.deck);
  }
  return gameState.deck.pop();
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

// Render player's hand
function renderHand() {
  const handContainer = document.getElementById('hand-cards');
  if (!handContainer) return;
  
  handContainer.innerHTML = '';
  
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  
  gameState.hand.forEach((card, index) => {
    const div = document.createElement('div');
    div.classList.add('card');
    
    const img = document.createElement('img');
    img.src = CARDS[card].image;
    img.alt = CARDS[card].type;
    div.appendChild(img);
    
    // Only allow clicking cards if not locked and field isn't full
    if (!gameState.gameLocked && fieldCardCount < 2) {
      div.style.cursor = 'pointer';
      div.style.opacity = '1';
      div.onclick = () => {
        playSound('click');
        selectCard(index);
      };
    } else {
      div.style.cursor = 'not-allowed';
      div.style.opacity = '0.7';
      div.onclick = null;
      div.classList.add('disabled'); // Add disabled class for visual feedback
    }
    
    handContainer.appendChild(div);
  });
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
  
  // Find empty slot
  let slotToFill = null;
  let slotIndex = 0;
  
  if (gameState.fieldCards[0] === null) {
    slotToFill = cardSlot1;
    slotIndex = 0;
  } else if (gameState.fieldCards[1] === null) {
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

// Handle player turn
async function handlePlayerTurn() {
  // Count valid cards on field
  const fieldCardCount = gameState.fieldCards.filter(card => card !== null).length;
  
  if (fieldCardCount !== 2 || gameState.gameLocked) {
    alert('Please place 2 cards on the field first!');
    return;
  }
  
  // Stop timer since player ended turn
  stopTimer();
  
  gameState.gameLocked = true;
  
  // Remove null values from field cards
  gameState.fieldCards = gameState.fieldCards.filter(card => card !== null);
  
  // Bot selects cards
  const botCard1 = getRandomCard();
  const botCard2 = getRandomCard();
  
  // Ensure bot cards are valid
  if (!botCard1 || !botCard2) {
    console.error('Bot cards are invalid:', { botCard1, botCard2 });
    // Fallback to random cards
    const fallbackCards = ['ROCK', 'PAPER', 'SCISSORS'];
    gameState.botFieldCards = [
      fallbackCards[Math.floor(Math.random() * 3)],
      fallbackCards[Math.floor(Math.random() * 3)]
    ];
  } else {
    gameState.botFieldCards = [botCard1, botCard2];
  }
  
  console.log('Bot selected field cards:', gameState.botFieldCards);
  
  playSound('card-down');
  renderHand();
  renderField();
  
  // Show bot's cards after a delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Prompt for return card selection and start timer
  document.getElementById('turn-timer').textContent = 'Return which card?';
  promptSelectReturnCard();
  // Start 10-second timer for return card selection
  startTimer(10, autoSelectReturnCard);
}

// Select card to return to hand
function promptSelectReturnCard() {
  const card1 = document.getElementById('player-card1');
  const card2 = document.getElementById('player-card2');
  const botCard1 = document.getElementById('opponent-card1');
  const botCard2 = document.getElementById('opponent-card2');

  // Show all cards clearly
  setCardImage('player-card1', gameState.fieldCards[0]);
  setCardImage('player-card2', gameState.fieldCards[1]);
  setCardImage('opponent-card1', gameState.botFieldCards[0]);
  setCardImage('opponent-card2', gameState.botFieldCards[1]);

  // Make player cards selectable
  card1.classList.add('selectable');
  card2.classList.add('selectable');

  // Add hover effect
  card1.classList.add('hoverable');
  card2.classList.add('hoverable');

  // Clear previous event listeners
  card1.onclick = null;
  card2.onclick = null;

  // Add new event listeners
  card1.onclick = () => selectReturn(0);
  card2.onclick = () => selectReturn(1);

  function selectReturn(index) {
    // Stop timer since player made a choice
    stopTimer();
    
    // Remove hover and selectable effects
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

    // Bot randomly selects a card to keep
    const botKeepIndex = Math.floor(Math.random() * 2);
    gameState.botBattleCard = gameState.botFieldCards[botKeepIndex];
    gameState.botFieldCards = [gameState.botBattleCard];
    
    // Debug logging
    console.log('Manual select return card:', {
      keepIndex: keepIndex,
      returnCard: returnCard,
      playCard: playCard,
      botKeepIndex: botKeepIndex,
      botBattleCard: gameState.botBattleCard,
      botFieldCards: gameState.botFieldCards
    });

    // Update UI
    renderHand();
    renderField();
    
    // Clean up
      card1.onclick = null;
      card2.onclick = null;
      
    // Resolve battle after a delay
      setTimeout(() => {
        resolveBattle();
      }, 1000);
  }
}

// Resolve battle between cards
function resolveBattle() {
  const playerCard = gameState.battleCard;
  const botCard = gameState.botBattleCard;
  
  // Debug logging
  console.log('Resolving battle:', {
    playerCard: playerCard,
    botCard: botCard,
    battleCard: gameState.battleCard,
    botBattleCard: gameState.botBattleCard
  });
  
  // Ensure cards are valid
  if (!playerCard || !botCard) {
    console.error('Invalid cards in battle:', { playerCard, botCard });
    // Use fallback cards
    const fallbackPlayerCard = playerCard || 'ROCK';
    const fallbackBotCard = botCard || 'PAPER';
    
    const resultText = 'ERROR!';
    const resultType = 'draw';
    const details = `Card error - using fallback cards`;
    
    showBattleAnnouncement(resultText, resultType, details, fallbackPlayerCard, fallbackBotCard);
    return;
  }
  
  let winner = 'draw';
  if (
    (playerCard === 'ROCK' && botCard === 'SCISSORS') ||
    (playerCard === 'PAPER' && botCard === 'ROCK') ||
    (playerCard === 'SCISSORS' && botCard === 'PAPER')
  ) {
    winner = 'player';
  } else if (playerCard !== botCard) {
    winner = 'bot';
  }
  
  // Update health
  if (winner === 'bot') {
    gameState.health--;
  } else if (winner === 'player') {
    gameState.botHealth--;
  }
  
  // Show battle result
  const resultText = winner === 'player' ? 'YOU WIN!' :
                    winner === 'bot' ? 'YOU LOSE!' :
                    'DRAW!';
  const resultType = winner === 'player' ? 'win' :
                    winner === 'bot' ? 'lose' :
                    'draw';
  const details = `Your ${playerCard} vs Bot's ${botCard}`;
  
  showBattleAnnouncement(resultText, resultType, details, playerCard, botCard);
  
  // Check for game over
  if (gameState.health <= 0 || gameState.botHealth <= 0) {
    setTimeout(() => {
      const gameOverText = gameState.health <= 0 ? 'DEFEAT!' : 'VICTORY!';
      const gameOverType = gameState.health <= 0 ? 'lose' : 'win';
      const gameOverDetails = gameState.health <= 0 ? 
        'The training bot defeated you!' : 
        'You defeated the training bot!';
      
      showBattleAnnouncement(gameOverText, gameOverType, gameOverDetails);
      
      // Return to menu after delay
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }, 1500);
    return;
  }
  
  // Start next round
  setTimeout(() => {
    gameState.fieldCards = [null, null]; // Reset to null values for 2 slots
    gameState.botFieldCards = [];
    gameState.battleCard = null;
    gameState.botBattleCard = null;
    gameState.gameLocked = false;
    
    // Stop any existing timer
    stopTimer();
    
    // Draw new card
    addCardToHand(getRandomCard());
    
    renderField();
    updateUI();
    
    // Start new timer for next round
    startTimer(20, autoSelectFieldCards);
  }, 2000);
}

// Show battle announcement
function showBattleAnnouncement(resultText, resultType, details = '', myCard = null, opponentCard = null) {
  const announcement = document.createElement('div');
  announcement.className = `battle-announcement announcement-${resultType}`;
  
  const resultClass = resultType === 'win' ? 'win-text' : 
                     resultType === 'lose' ? 'lose-text' : 
                     'draw-text';
  
  // Create card display HTML if cards are provided
  let cardDisplayHTML = '';
  if (myCard && opponentCard && CARDS[myCard] && CARDS[opponentCard]) {
    cardDisplayHTML = `
      <div class="battle-cards-display">
        <div class="battle-card player-card">
          <img src="${CARDS[myCard].image}" alt="${myCard}" />
          <span>Your ${myCard}</span>
        </div>
        <div class="vs-battle">VS</div>
        <div class="battle-card opponent-card">
          <img src="${CARDS[opponentCard].image}" alt="${opponentCard}" />
          <span>Bot's ${opponentCard}</span>
        </div>
      </div>
    `;
  } else {
    console.error('Cannot display cards:', { myCard, opponentCard, myCardExists: CARDS[myCard], opponentCardExists: CARDS[opponentCard] });
  }
  
  announcement.innerHTML = `
    <h2 class="${resultClass}">${resultText}</h2>
    <div class="result-details">${details}</div>
    ${cardDisplayHTML}
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
  }, 3000); // Increased time to show cards longer
}

// Update setCardImage function
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

// Render battlefield
function renderField() {
  // Player's field cards
  if (gameState.fieldCards.length > 0) {
    setCardImage('player-card1', gameState.fieldCards[0]);
    if (gameState.fieldCards.length > 1) {
      setCardImage('player-card2', gameState.fieldCards[1]);
    } else {
      setCardImage('player-card2', null);
    }
  } else {
    setCardImage('player-card1', null);
    setCardImage('player-card2', null);
  }
  
  // Bot's field cards
  if (gameState.botFieldCards.length > 0) {
    if (gameState.gameLocked) {
    setCardImage('opponent-card1', gameState.botFieldCards[0]);
    if (gameState.botFieldCards.length > 1) {
      setCardImage('opponent-card2', gameState.botFieldCards[1]);
    } else {
      setCardImage('opponent-card2', null);
    }
  } else {
      setCardImage('opponent-card1', 'back');
      setCardImage('opponent-card2', 'back');
    }
  } else {
    setCardImage('opponent-card1', null);
    setCardImage('opponent-card2', null);
      }
    }

// Update UI elements
function updateUI() {
  // Update health
  playerHealth.textContent = '❤️'.repeat(gameState.health);
  botHealth.textContent = '❤️'.repeat(gameState.botHealth);
  
  // Update turn indicator and phase
  let statusText = '';
  if (gameState.gameLocked) {
    if (gameState.battleCard) {
      statusText = '<span class="timer-text">Resolving battle...</span>';
    } else {
      statusText = '<span class="timer-text">Choose a card to return!</span>';
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
  endTurnBtn.disabled = !(!gameState.gameLocked && fieldCardCount === 2);
  resetBtn.disabled = fieldCardCount === 0;
}

// Play sound
function playSound(name) {
  const audio = new Audio(`assets/sounds/${name}.mp3`);
  audio.play();
}

// Setup event listeners
function setupEventListeners() {
  // End turn button
  endTurnBtn.onclick = () => {
    if (!gameState.gameLocked && gameState.fieldCards.filter(card => card !== null).length === 2) {
      handlePlayerTurn();
    }
  };
  
  // Reset button
  resetBtn.onclick = () => {
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
  
  // Return to menu button
  surrenderBtn.onclick = () => {
    if (confirm('Are you sure you want to return to the main menu?')) {
      window.location.href = '/';
    }
  };
}

// Start game
initGame();
  