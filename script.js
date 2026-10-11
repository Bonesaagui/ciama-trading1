// --- ÉTAT DU COMPTE AVEC SAUVEGARDE LOCALE PERSISTANTE ---
let currentUser = null;
let investedBalance = 0;
let dailyGains = 0;
let lockedWithdrawAddress = "";
let hasTradedToday = false;
let historyRecords = [];
let hasCopiedAddress = false;
let usedDepositAmounts = [];

const assetsSchedule = {
  1: "BTC/USDT",
  2: "ETH/USDT",
  3: "BNB/USDT",
  4: "SOL/USDT",
  5: "XRP/USDT"
};

function loadUserData(email) {
  const savedData = localStorage.getItem('ciama_user_' + email);
  if (savedData) {
    const data = JSON.parse(savedData);
    investedBalance = data.investedBalance || 0;
    dailyGains = data.dailyGains || 0;
    lockedWithdrawAddress = data.lockedWithdrawAddress || "";
    hasTradedToday = data.hasTradedToday || false;
    historyRecords = data.historyRecords || [];
    usedDepositAmounts = data.usedDepositAmounts || [];
    currentUser = { email, inviteCode: data.inviteCode };
  } else {
    currentUser = { email, inviteCode: "CIAMA" + Math.floor(1000 + Math.random() * 9000) };
    investedBalance = 0;
    dailyGains = 0;
    lockedWithdrawAddress = "";
    hasTradedToday = false;
    historyRecords = [];
    usedDepositAmounts = [];
    saveUserData();
  }
}

function saveUserData() {
  if (!currentUser) return;
  const data = {
    investedBalance,
    dailyGains,
    lockedWithdrawAddress,
    hasTradedToday,
    historyRecords,
    usedDepositAmounts,
    inviteCode: currentUser.inviteCode
  };
  localStorage.setItem('ciama_user_' + currentUser.email, JSON.stringify(data));
}

function switchAuthTab(tab) {
  const regForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const regBtn = document.getElementById('tabRegisterBtn');
  const loginBtn = document.getElementById('tabLoginBtn');

  if (tab === 'register') {
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    regBtn.className = "active-tab";
    loginBtn.className = "";
  } else {
    regForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginBtn.className = "active-tab";
    regBtn.className = "";
  }
}

function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPassword').value;
  const confirmPass = document.getElementById('regConfirmPassword').value;

  if (pass !== confirmPass) {
    alert("Les mots de passe ne correspondent pas !");
    return;
  }

  loadUserData(email);
  initDashboard();
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  loadUserData(email);
  initDashboard();
}

function logout() {
  currentUser = null;
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('appDashboard').classList.add('hidden');
}

function initDashboard() {
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('appDashboard').classList.remove('hidden');
  document.getElementById('userEmailDisplay').innerText = currentUser.email;
  document.getElementById('profileEmail').innerText = currentUser.email;
  document.getElementById('inviteCodeDisplay').value = currentUser.inviteCode;

  const withdrawInput = document.getElementById('withdrawAddress');
  if (lockedWithdrawAddress) {
    withdrawInput.value = lockedWithdrawAddress;
    withdrawInput.disabled = true;
    withdrawInput.style.opacity = "0.6";
  } else {
    withdrawInput.value = "";
    withdrawInput.disabled = false;
    withdrawInput.style.opacity = "1";
  }

  updateBalances();
  setupScheduleHighlight();
  renderHistory();
  switchNavTab('maison');
}

function updateBalances() {
  const totalAssets = investedBalance + dailyGains;
  document.getElementById('totalAssetsBalance').innerText = `$${totalAssets.toFixed(2)}`;
  document.getElementById('investedBalance').innerText = `$${investedBalance.toFixed(2)}`;
  document.getElementById('dailyGainsBalance').innerText = `+$${dailyGains.toFixed(2)}`;
  saveUserData();
}

function switchNavTab(tabName) {
  document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-bar-item').forEach(el => el.classList.remove('active'));

  if (tabName === 'maison') {
    document.getElementById('viewMaison').classList.remove('hidden');
    document.getElementById('navMaison').classList.add('active');
  } else if (tabName === 'vip') {
    document.getElementById('viewVip').classList.remove('hidden');
    document.getElementById('navVip').classList.add('active');
  } else if (tabName === 'mining') {
    document.getElementById('viewMining').classList.remove('hidden');
    document.getElementById('navMining').classList.add('active');
  } else if (tabName === 'team') {
    document.getElementById('viewTeam').classList.remove('hidden');
    document.getElementById('navTeam').classList.add('active');
  } else if (tabName === 'profile') {
    document.getElementById('viewProfile').classList.remove('hidden');
    document.getElementById('navProfile').classList.add('active');
  }
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function markAddressCopied() {
  const depositAddr = document.getElementById('depositAddr').value;
  navigator.clipboard.writeText(depositAddr);
  hasCopiedAddress = true;
  alert("Adresse BEP20 copiée ! Vous pouvez maintenant saisir le montant.");
}

function submitDeposit() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  const proofFile = document.getElementById('depositProof').files[0];

  if (!hasCopiedAddress) {
    alert("Veuillez d'abord cliquer sur le bouton 'Copier' de l'adresse BEP20 !");
    return;
  }
  if (!amount || amount < 10) {
    alert("Le montant minimum de dépôt est de 10$.");
    return;
  }
  if (usedDepositAmounts.includes(amount)) {
    alert("Ce montant exact a déjà été utilisé. Veuillez modifier légèrement le montant du dépôt.");
    return;
  }
  if (!proofFile) {
    alert("Veuillez joindre la capture d'écran de la preuve de paiement !");
    return;
  }

  usedDepositAmounts.push(amount);
  closeModal('depositModal');

  const record = { id: Date.now(), type: "Dépôt USDT (BEP20)", amount: `$${amount.toFixed(2)}`, status: "En attente (5 min)", statusClass: "text-gold" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert("Demande de dépôt enregistrée. Compte crédité automatiquement dans 5 minutes !");

  setTimeout(() => {
    investedBalance += amount + 1.00; // +$1 bonus
    updateBalances();
    record.status = "Approuvé";
    record.statusClass = "text-green";
    renderHistory();
    saveUserData();
  }, 300000); // 5 minutes
}

function submitWithdrawal() {
  const addressInput = document.getElementById('withdrawAddress');
  const amountInput = document.getElementById('withdrawAmount');
  const amount = parseFloat(amountInput.value);

  if (!addressInput.value && !lockedWithdrawAddress) {
    alert("Veuillez renseigner votre adresse USDT !");
    return;
  }
  if (!amount || amount <= 0 || amount > dailyGains) {
    alert("Solde insuffisant dans vos gains journaliers ! (Le capital investi est gelé).");
    return;
  }

  if (!lockedWithdrawAddress) {
    lockedWithdrawAddress = addressInput.value;
    addressInput.disabled = true;
  }

  dailyGains -= amount;
  updateBalances();
  closeModal('withdrawModal');

  const record = { id: Date.now(), type: "Retrait des Gains", amount: `$${amount.toFixed(2)}`, status: "En attente (24h-72h)", statusClass: "text-gold" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert("Demande de retrait enregistrée. En attente d'approbation (délai de 24h à 72h).");

  // Simulation d'approbation automatique après un délai de test
  setTimeout(() => {
    record.status = "Approuvé";
    record.statusClass = "text-green";
    renderHistory();
    saveUserData();
  }, 40000); 
}

function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay();
  const activeAsset = assetsSchedule[currentDay] || "BTC/USDT (Week-end)";
  document.getElementById('todayAsset').innerText = activeAsset;

  if (hasTradedToday) {
    lockTradeButton();
  }
}

function executeDailySignal() {
  if (hasTradedToday) {
    alert("Vous avez déjà exécuté votre trade aujourd'hui ! Verrouillé pendant 18h.");
    return;
  }

  if (investedBalance < 10) {
    alert("Capital investi insuffisant. Un minimum de 10$ est requis.");
    return;
  }

  let rate = 0.015; // 1.5% (10$- 49$)
  if (investedBalance >= 50 && investedBalance <= 200) {
    rate = 0.02; // 2% (50$- 200$)
  } else if (investedBalance >= 300 && investedBalance <= 500) {
    rate = 0.03; // 3% (300$- 500$)
  } else if (investedBalance > 500) {
    rate = 0.03;
  }

  const profit = investedBalance * rate;
  dailyGains += profit;
  hasTradedToday = true;

  updateBalances();
  lockTradeButton();

  const record = { id: Date.now(), type: "Signal Minier", amount: `+$${profit.toFixed(2)}`, status: "Exécuté", statusClass: "text-green" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert(`Position confirmée ! Gains journaliers : +$${profit.toFixed(2)} (${(rate * 100)}%)`);
}

function lockTradeButton() {
  const btn = document.getElementById('executeTradeBtn');
  btn.disabled = true;
  btn.style.background = "#334155";
  btn.style.color = "#94a3b8";
  btn.innerText = "POSITION VERROUILLÉE (18H)";
}

function renderHistory() {
  const tbody = document.getElementById('historyTable');
  tbody.innerHTML = "";
  historyRecords.forEach(rec => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${rec.type}</b></td>
      <td><b>${rec.amount}</b></td>
      <td class="${rec.statusClass}" style="font-weight:bold;">${rec.status}</td>
    `;
    tbody.appendChild(tr);
  });
}

function copyInviteCode() {
  navigator.clipboard.writeText(currentUser.inviteCode);
  alert("Code d'invitation copié !");
                                                                         }
    
