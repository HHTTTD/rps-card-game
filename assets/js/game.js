// ✅ game.js สำหรับ PvP Multiplayer เวอร์ชันเต็ม
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room") || "default";
const playerIndex = parseInt(urlParams.get("player")) || 1;

const fullDeck = [...Array(6).fill("rock"), ...Array(6).fill("paper"), ...Array(6).fill("scissors")];
let playerDeck = shuffle([...fullDeck]);
let hand = [];
let selectedCards = [];
let playerHealth = 5;
let opponentHealth = 5;
let playerField = [];
let opponentField = [];
let gameLocked = false;
let timer = null;
let countdown = 10;

function playSound(name) {
  const audio = new Audio(`assets/sounds/${name}.mp3`);
  audio.play();
}

function startTimer(seconds, onExpire) {
  countdown = seconds;
  updateTimerDisplay();
  clearInterval(timer);
  timer = setInterval(() => {
    countdown--;
    updateTimerDisplay();
    if (countdown <= 0) {
      clearInterval(timer);
      onExpire();
    }
  }, 1000);
}

function stopTimer() { clearInterval(timer); }
function updateTimerDisplay() {
  document.getElementById("turn-timer").innerHTML = `Time left: <span id="timer-count">${countdown}</span> sec`;
}

function shuffle(array) { return array.sort(() => Math.random() - 0.5); }

async function drawCards(n) {
  for (let i = 0; i < n && playerDeck.length > 0; i++) {
    await new Promise(r => setTimeout(r, 300));
    hand.push(playerDeck.pop());
    renderHand(1);
    playSound("draw");
  }
  updateDeckCount();
}

function updateDeckCount() {
  document.getElementById("deck-count").textContent = `Deck: ${playerDeck.length} cards`;
}

function renderHand(animateLastN = 0) {
  const container = document.getElementById("hand-cards");
  container.innerHTML = "";
  hand.forEach((card, i) => {
    const div = document.createElement("div");
    div.className = "card";
    if (i >= hand.length - animateLastN) div.classList.add("fade-in");
    const img = document.createElement("img");
    img.src = `assets/images/cards/${card}.png`;
    div.appendChild(img);
    div.onclick = () => selectCard(i);
    if (selectedCards.includes(i)) div.classList.add("selected");
    container.appendChild(div);
  });
}

function selectCard(i) {
  if (selectedCards.includes(i)) {
    selectedCards = selectedCards.filter(x => x !== i);
  } else if (selectedCards.length < 2) {
    selectedCards.push(i);
  }
  renderHand();
}

function renderField() {
  setCardImage("player-card1", playerField[0]);
  setCardImage("player-card2", playerField[1]);
  setCardImage("bot-card1", opponentField[0]);
  setCardImage("bot-card2", opponentField[1]);
}

function setCardImage(id, card) {
  const container = document.getElementById(id);
  container.innerHTML = "";
  const img = document.createElement("img");
  img.src = card ? `assets/images/cards/${card}.png` : `assets/images/cards/back.png`;
  container.appendChild(img);
}

function autoSelectTwoCards() {
  selectedCards = [];
  for (let i = 0; i < hand.length && selectedCards.length < 2; i++) {
    selectedCards.push(i);
  }
}

function handlePlayerTurn() {
  if (selectedCards.length !== 2 || gameLocked) return;
  gameLocked = true;
  stopTimer();
  playerField = [hand[selectedCards[0]], hand[selectedCards[1]]];
  selectedCards.sort((a, b) => b - a).forEach(i => hand.splice(i, 1));
  selectedCards = [];
  renderHand();
  renderField();
  playSound("card-down");
  document.getElementById("turn-timer").textContent = "Return which card?";
  promptSelectReturnCard();
}

function promptSelectReturnCard() {
  stopTimer();
  const c1 = document.getElementById("player-card1");
  const c2 = document.getElementById("player-card2");
  c1.classList.add("selectable");
  c2.classList.add("selectable");
  function returnChoice(index) {
    const keep = index;
    const play = playerField[keep === 0 ? 1 : 0];
    const back = playerField[keep];
    hand.push(back);
    renderHand();
    socket.emit("playCard", { room: roomId, playerIndex, card: play });
    playerField = [play];
    renderField();
    c1.classList.remove("selectable");
    c2.classList.remove("selectable");
    c1.onclick = null;
    c2.onclick = null;
  }
  c1.onclick = () => returnChoice(0);
  c2.onclick = () => returnChoice(1);
}

function resolveBattle(p1, p2) {
  if (p1 === p2) return { winner: "none", msg: "Draw!" };
  const beats = { rock: "scissors", scissors: "paper", paper: "rock" };
  if (beats[p1] === p2) return { winner: "player", msg: "You Win!" };
  else return { winner: "opponent", msg: "You Lose!" };
}

function updateHealth() {
  document.getElementById("player-health").textContent = "❤️".repeat(playerHealth);
  document.getElementById("bot-health").textContent = "❤️".repeat(opponentHealth);
}

function checkGameOver() {
  if (playerHealth <= 0 || opponentHealth <= 0) {
    alert(playerHealth <= 0 ? "Game Over! You Lose." : "You Win!");
    window.location.href = "mode.html";
  }
}

// === SOCKET EVENT ===
socket.on("opponentCardPlayed", ({ card }) => {
  opponentField = [card];
  renderField();
});

socket.on("battleResult", ({ playerCard, opponentCard, result }) => {
  playerField = [playerCard];
  opponentField = [opponentCard];
  renderField();
  playSound("rps-battle");
  document.getElementById("turn-timer").innerHTML =
    `Result: <strong>${result.msg}</strong><br>You: ${playerCard} | Opponent: ${opponentCard}`;
  setTimeout(() => {
    if (result.winner === "player") opponentHealth--;
    else if (result.winner === "opponent") playerHealth--;
    updateHealth();
    drawCards(2);
    playerField = [];
    opponentField = [];
    renderField();
    gameLocked = false;
    checkGameOver();
    startTimer(10, () => {
      autoSelectTwoCards();
      handlePlayerTurn();
    });
  }, 1500);
});

// === INITIAL ===
socket.emit("joinRoom", roomId);
drawCards(3);
renderHand();
updateHealth();
renderField();
updateDeckCount();
startTimer(10, () => {
  autoSelectTwoCards();
  handlePlayerTurn();
});
