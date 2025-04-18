const fullDeck = [
    ...Array(6).fill("rock"),
    ...Array(6).fill("paper"),
    ...Array(6).fill("scissors")
  ];
  
  let playerDeck = shuffle([...fullDeck]);
  let botDeck = shuffle([...fullDeck]);
  
  let hand = [];
  let botHand = [];
  
  let selectedCards = [];
  
  let playerHealth = 5;
  let botHealth = 5;
  
  let playerField = [];
  let botField = [];
  
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
  
  function updateTimerDisplay() {
    document.getElementById("turn-timer").innerHTML = `Time left: <span id="timer-count">${countdown}</span> sec`;
  }
  
  function stopTimer() {
    clearInterval(timer);
  }
  
  function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
  }
  
  async function drawCards(n) {
    for (let i = 0; i < n && playerDeck.length > 0; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      hand.push(playerDeck.pop());
      renderHand(1);
      playSound("draw");
    }
    updateDeckCount();
  }
  
  function drawBotCards(n) {
    for (let i = 0; i < n && botDeck.length > 0; i++) {
      botHand.push(botDeck.pop());
    }
    updateBotCardCount();
  }
  
  function updateBotCardCount() {
    const botInfo = document.getElementById("bot-card-info");
    if (botInfo) {
      botInfo.textContent = `Bot Hand: ${botHand.length} card(s)`;
    }
  }
  
  function selectBotCardsToField() {
    if (botHand.length === 0) {
      botField = [];
      return;
    }
  
    // ✅ เลือก 2 ใบจากมือ
    const selected = botHand.splice(0, Math.min(2, botHand.length));
    botField = [...selected]; // ✅ แสดงไว้ก่อนทั้ง 2 ใบ
  
    updateBotCardCount();
  }
  
  
  function updateDeckCount() {
    document.getElementById("deck-count").textContent = `Deck Left: ${playerDeck.length} cards`;
  }
  
  function renderHand(animateLastN = 0) {
    const handContainer = document.getElementById("hand-cards");
    handContainer.innerHTML = "";
    hand.forEach((card, index) => {
      const div = document.createElement("div");
      div.classList.add("card");
      if (index >= hand.length - animateLastN) {
        div.classList.add("fade-in");
      }
  
      const img = document.createElement("img");
      img.src = `assets/images/cards/${card}.png`;
      img.alt = card;
  
      div.appendChild(img);
  
      div.addEventListener("click", () => {
        playSound("click");
        selectCard(index);
      });
  
      if (selectedCards.includes(index)) {
        div.classList.add("selected");
      }
  
      handContainer.appendChild(div);
    });
  }
  
  function selectCard(index) {
    if (selectedCards.includes(index)) {
      selectedCards = selectedCards.filter(i => i !== index);
    } else if (selectedCards.length < 2) {
      selectedCards.push(index);
    }
    renderHand();
  }
  
  function renderField() {
    setCardImage("player-card1", playerField[0]);
    setCardImage("player-card2", playerField[1]);
    setCardImage("bot-card1", botField[0]);
    setCardImage("bot-card2", botField[1]);
  }
  
  function setCardImage(id, card) {
    const container = document.getElementById(id);
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = card ? `assets/images/cards/${card}.png` : `assets/images/cards/back.png`;
    img.alt = card || "Hidden";
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
  
    drawBotCards(2);
    selectBotCardsToField();
  
    renderHand();
    renderField();
  
    playSound("card-down");
  
    document.getElementById("turn-timer").textContent = "Return which card?";
    promptSelectReturnCard();
  
  }
  
  function promptSelectReturnCard() {
    stopTimer();
  
    const card1 = document.getElementById("player-card1");
    const card2 = document.getElementById("player-card2");
  
    card1.classList.add("selectable");
    card2.classList.add("selectable");
  
    function selectReturn(index) {
      const keepIndex = index;
      const playCard = playerField[keepIndex === 0 ? 1 : 0];
      const returnCard = playerField[keepIndex];
  
      let botPlayCard = null;
  if (botField.length === 2) {
    const botKeepIndex = Math.floor(Math.random() * 2);
    const botReturnCard = botField[botKeepIndex];
    botPlayCard = botField[botKeepIndex === 0 ? 1 : 0];
    botHand.push(botReturnCard); // ✅ คืน 1 ใบกลับขึ้นมือ
  } else {
    botPlayCard = botField[0] || null;
  }
  
      hand.push(returnCard);
      renderHand();
      playSound("rps-battle");
  
      playerField = [playCard];
      botField = [botPlayCard];
      renderField();
  
      let result;
      if (!botPlayCard) {
        result = { winner: "player", msg: "Bot has no cards left. You win!" };
      } else {
        result = resolveBattle(playCard, botPlayCard);
      }
  
      document.getElementById("turn-timer").innerHTML =
        `Result: <strong>${result.msg}</strong><br>You: ${playCard} | Bot: ${botPlayCard || "-"}`;
  
      const returnDiv = document.getElementById("return-card-info");
      if (returnDiv) {
        returnDiv.innerHTML = `
          <p>You kept:</p>
          <img src="assets/images/cards/${returnCard}.png" alt="return" class="card" style="margin-top:5px">
        `;
      }
  
      setTimeout(() => {
        if (result.winner === "player") {
          botHealth--;
          playSound("win");
        } else if (result.winner === "bot") {
          playerHealth--;
          playSound("lose");
        }
  
        updateHealth();
        drawCards(2);
        playerField = [];
        botField = [];
        renderField();
        gameLocked = false;
        checkGameOver();
  
        card1.classList.remove("selectable");
        card2.classList.remove("selectable");
        card1.onclick = null;
        card2.onclick = null;
        updateTimerDisplay();
  
        startTimer(10, () => {
          autoSelectTwoCards();
          handlePlayerTurn();
        });
      }, 1500);
    }
  
    card1.onclick = () => selectReturn(0);
    card2.onclick = () => selectReturn(1);
  }
  
  function resolveBattle(p1, p2) {
    if (p1 === p2) return { winner: "none", msg: "Draw!" };
  
    const beats = {
      rock: "scissors",
      scissors: "paper",
      paper: "rock"
    };
  
    if (beats[p1] === p2) return { winner: "player", msg: "You Win!" };
    else return { winner: "bot", msg: "You Lose!" };
  }
  
  function updateHealth() {
    document.getElementById("player-health").textContent = "❤️".repeat(playerHealth);
    document.getElementById("bot-health").textContent = "❤️".repeat(botHealth);
  }
  
  function checkGameOver() {
    if (playerHealth <= 0) {
      alert("Game Over! Bot wins.");
      window.location.href = "mode.html";
    } else if (botHealth <= 0) {
      alert("You win!");
      window.location.href = "mode.html";
    }
  }
  
  // === EVENTS ===
  document.getElementById("end-turn").addEventListener("click", handlePlayerTurn);
  document.getElementById("reset-selection").addEventListener("click", () => {
    selectedCards = [];
    renderHand();
  });
  document.getElementById("surrender").addEventListener("click", () => {
    if (confirm("Are you sure you want to surrender and go back?")) {
      window.location.href = "mode.html";
    }
  });
  
  // === START GAME ===
  drawCards(3);
  drawBotCards(3);
  renderHand();
  updateHealth();
  renderField();
  updateDeckCount();
  updateBotCardCount();
  startTimer(10, () => {
    autoSelectTwoCards();
    handlePlayerTurn();
  });
  