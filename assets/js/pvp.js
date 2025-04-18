window.startPvpGame = async function ({ roomId, playerIndex, socket }) {
  window.roomId = roomId;
  window.playerIndex = playerIndex;
  window.socket = socket;

  localStorage.setItem("pvpRoom", roomId);
  localStorage.setItem("pvpPlayer", playerIndex);

  const fullDeck = [...Array(6).fill("rock"), ...Array(6).fill("paper"), ...Array(6).fill("scissors")];
  let deck = [];
  let hand = [];
  let selectedCards = [];
  let field = [];
  let opponentField = [];
  let health = 5;
  let opponentHealth = 5;
  let hasSubmitted = false;
  let hasReturnedCard = false;
  let timer = null;
  let countdown = 10;
  let isHandLocked = false;

  function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
  }

  function playSound(name) {
    const audio = new Audio(`assets/sounds/${name}.mp3`);
    audio.play();
  }

  async function drawCards(n) {
    for (let i = 0; i < n && deck.length > 0; i++) {
      await new Promise(res => setTimeout(res, 300));
      hand.push(deck.pop());
      renderHand(1);
      playSound("draw");
    }
    updateDeckCount();
  }

  function updateDeckCount() {
    document.getElementById("deck-count").textContent = `Deck: ${deck.length} cards`;
  }

  function renderHand(animateLastN = 0) {
    const container = document.getElementById("hand-cards");
    container.innerHTML = "";
    hand.forEach((card, index) => {
      const div = document.createElement("div");
      div.classList.add("card");
      if (index >= hand.length - animateLastN) div.classList.add("fade-in");
      const img = document.createElement("img");
      img.src = `assets/images/cards/${card}.png`;
      img.alt = card;
      div.appendChild(img);
      div.addEventListener("click", () => {
        playSound("click");
        selectCard(index);
      });
      if (selectedCards.includes(index)) div.classList.add("selected");
      container.appendChild(div);
    });
  }

  function selectCard(index) {
    if (selectedCards.includes(index)) {
      selectedCards = selectedCards.filter(i => i !== index);
      isHandLocked = false;
    } else if (selectedCards.length < 2) {
      selectedCards.push(index);
      if (selectedCards.length === 2) isHandLocked = true;
    }
    renderHand();
  }

  function renderField() {
    setCardImage("player-card1", field[0]);
    setCardImage("player-card2", field[1]);
    setCardImage("bot-card1", opponentField[0]);
    setCardImage("bot-card2", opponentField[1]);
  }

  function setCardImage(id, card) {
    const container = document.getElementById(id);
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = card ? `assets/images/cards/${card}.png` : `assets/images/cards/back.png`;
    img.alt = card || "Hidden";
    container.appendChild(img);
  }

  function updateHealth() {
    document.getElementById("player-health").textContent = "❤️".repeat(health);
    document.getElementById("bot-health").textContent = "❤️".repeat(opponentHealth);
  }

  function stopTimer() {
    clearInterval(timer);
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

  function updateTimerDisplay() {
    document.getElementById("turn-timer").innerHTML = `Time left: <span id="timer-count">${countdown}</span> sec`;
  }

  function handlePlayerTurn() {
    if (selectedCards.length !== 2 || hasSubmitted) return;

    stopTimer();
    field = [hand[selectedCards[0]], hand[selectedCards[1]]];
    selectedCards.sort((a, b) => b - a).forEach(i => hand.splice(i, 1));
    selectedCards = [];
    renderHand();
    renderField();
    playSound("card-down");

    socket.emit("submitCard", {
      roomId,
      player: playerIndex,
      card: null,
      fieldCards: field,
      state: {
        hand,
        deck,
        health,
        opponentHealth,
        field,
        opponentField,
        selectedCards,
        hasSubmitted,
        hasReturnedCard
      }
    });

    hasSubmitted = true;
    document.getElementById("turn-timer").textContent = "Waiting for opponent...";
  }

  function promptSelectReturnCard() {
    const card1 = document.getElementById("player-card1");
    const card2 = document.getElementById("player-card2");
    card1.classList.add("selectable");
    card2.classList.add("selectable");

    function selectReturn(index) {
      if (hasReturnedCard) return;
      hasReturnedCard = true;
      const keepIndex = index === 0 ? 1 : 0;
      const returnCard = field[index];
      const playCard = field[keepIndex];
      hand.push(returnCard);
      field = [playCard];
      renderHand();
      setCardImage("player-card1", playCard);
      setCardImage("player-card2", null);
      playSound("rps-battle");

      socket.emit("submitCard", {
        roomId,
        player: playerIndex,
        card: playCard,
        state: {
          hand,
          deck,
          health,
          opponentHealth,
          field,
          opponentField,
          selectedCards,
          hasSubmitted,
          hasReturnedCard
        }
      });

      card1.classList.remove("selectable");
      card2.classList.remove("selectable");
      card1.onclick = null;
      card2.onclick = null;
    }

    card1.onclick = () => selectReturn(0);
    card2.onclick = () => selectReturn(1);
  }

  socket.on("resumeGame", (savedState) => {
    if (savedState[playerIndex]) {
      const s = savedState[playerIndex];
      hand = s.hand || [];
      deck = s.deck || shuffle([...fullDeck]);
      health = s.health ?? 5;
      opponentHealth = s.opponentHealth ?? 5;
      field = s.field || [];
      opponentField = s.opponentField || [];
      selectedCards = s.selectedCards || [];
      hasSubmitted = s.hasSubmitted || false;
      hasReturnedCard = s.hasReturnedCard || false;

      updateHealth();
      renderHand();
      renderField();
      updateDeckCount();
    }
  });

  socket.on("showFields", (data) => {
    field = data[playerIndex];
    opponentField = data[playerIndex === 1 ? 2 : 1];
    renderField();
    document.getElementById("turn-timer").textContent = "Return which card?";
    promptSelectReturnCard();
  });

  socket.on("roundResult", ({ winner, card1, card2 }) => {
    field = playerIndex === 1 ? [card1] : [card2];
    opponentField = playerIndex === 1 ? [card2] : [card1];
    renderField();

    document.getElementById("turn-timer").innerHTML = `Result: <strong>${
      winner === "draw" ? "Draw!" : winner === playerIndex ? "You Win!" : "You Lose!"
    }</strong><br>You: ${field[0]} | Opponent: ${opponentField[0]}`;

    setTimeout(() => {
      if (winner === playerIndex) opponentHealth--;
      else if (winner !== "draw") health--;

      updateHealth();
      drawCards(2);
      field = [];
      opponentField = [];
      renderField();
      hasSubmitted = false;
      hasReturnedCard = false;
      isHandLocked = false;
      updateTimerDisplay();

      if (health <= 0 || opponentHealth <= 0) {
        alert(health <= 0 ? "You Lose!" : "You Win!");
        localStorage.removeItem("pvpRoom");
        localStorage.removeItem("pvpPlayer");
        window.location.href = "mode.html";
        return;
      }

      startTimer(10, () => {
        autoSelectTwoCards();
        handlePlayerTurn();
      });
    }, 1500);
  });

  socket.on("opponentSurrendered", ({ winner }) => {
    alert(winner === playerIndex ? "You Win! Opponent surrendered." : "You Lose!");
    localStorage.removeItem("pvpRoom");
    localStorage.removeItem("pvpPlayer");
    window.location.href = "mode.html";
  });

  function autoSelectTwoCards() {
    selectedCards = [];
    for (let i = 0; i < hand.length && selectedCards.length < 2; i++) {
      selectedCards.push(i);
    }
    renderHand();
  }

  document.getElementById("end-turn").addEventListener("click", handlePlayerTurn);
  document.getElementById("reset-selection").addEventListener("click", () => {
    if (hasSubmitted) return;
    selectedCards = [];
    isHandLocked = false;
    renderHand();
  });

  document.getElementById("surrender").addEventListener("click", () => {
    if (confirm("Are you sure you want to surrender?")) {
      socket.emit("surrender", { roomId, player: playerIndex });
    }
  });

  deck = shuffle([...fullDeck]);
  await drawCards(3);
  renderHand();
  updateHealth();
  renderField();
  updateDeckCount();
  startTimer(10, () => {
    autoSelectTwoCards();
    handlePlayerTurn();
  });
};

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
