// --- CONFIGURATION SUPABASE (CIAMA TRADING) ---
const SUPABASE_URL = "https://ufnyqemgcfpxbkitbnxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BWB4tkR__rvsP4CIKMqkGw_a5r15LuC"; 

// Initialisation du client Supabase
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Fonction pour charger les configurations dynamiques en direct depuis Supabase
async function fetchRemoteConfig() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('app_config')
      .select('*');
      
    if (error) {
      console.log("Supabase: Table 'app_config' en attente de configuration.", error);
      return;
    }

    if (data && data.length > 0) {
      data.forEach(item => {
        // Mettre à jour le nom de la plateforme si la clé 'app_name' existe
        if (item.key === 'app_name') {
          const brandElements = document.querySelectorAll('.logo-text');
          brandElements.forEach(el => el.innerText = item.value);
        }
        // Mettre à jour l'adresse de dépôt si la clé 'deposit_address' existe
        if (item.key === 'deposit_address') {
          const depositInput = document.getElementById('depositAddr');
          if (depositInput) depositInput.value = item.value;
        }
      });
    }
  } catch (err) {
    console.log("Connexion Supabase active");
  }
}

// --- ÉTAT DU COMPTE AVEC SAUVEGARDE LOCALE PERSISTANTE ---
let currentUser = null;
let investedBalance = 0;
let dailyGains = 0;
let lockedWithdrawAddress = "";
let hasTradedToday = false;
let historyRecords = [];

const assetsSchedule = {
  1: "BTC/USDT", // Lundi
  2: "ETH/USDT", // Mardi
  3: "BNB/USDT", // Mercredi
  4: "SOL/USDT", // Jeudi
  5: "XRP/USDT"  // Vendredi
};

// Charger les données sauvegardées du compte s'il existe
function loadUserData(email) {
  const savedData = localStorage.getItem('ciama_user_' + email);
  if (savedData) {
    const data = JSON.parse(savedData);
    investedBalance = data.investedBalance || 0;
    dailyGains = data.dailyGains || 0;
    lockedWithdrawAddress = data.lockedWithdrawAddress || "";
    hasTradedToday = data.hasTradedToday || false;
    historyRecords = data.historyRecords || [];
    currentUser = { email, inviteCode: data.inviteCode };
  } else {
    currentUser = { email, inviteCode: "CIAMA" + Math.floor(1000 + Math.random() * 9000) };
    investedBalance = 0;
    dailyGains = 0;
    lockedWithdrawAddress = "";
    hasTradedToday = false;
    historyRecords = [];
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
  document.getElementById('inviteCodeDisplay').value = currentUser.inviteCode;

  // Gérer l'adresse de retrait verrouillée
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

  // Chargement automatique des paramètres en direct depuis Supabase
  fetchRemoteConfig();
}

function updateBalances() {
  document.getElementById('investedBalance').innerText = `$${investedBalance.toFixed(2)}`;
  document.getElementById('dailyGainsBalance').innerText = `+$${dailyGains.toFixed(2)}`;
  document.getElementById('tradeCapitalText').innerText = `$${(investedBalance + dailyGains).toFixed(2)}`;
  saveUserData();
}

function copyDepositAddress() {
  const depositAddr = document.getElementById('depositAddr').value;
  navigator.clipboard.writeText(depositAddr);
  alert("Adresse BEP20 copiée !");
}

function copyInviteCode() {
  navigator.clipboard.writeText(currentUser.inviteCode);
  alert("Code d'invitation copié !");
}

function submitDeposit() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  if (!amount || amount < 10) {
    alert("Le montant minimum de dépôt simulé est de $10");
    return;
  }

  const record = { id: Date.now(), type: "Dépôt USDT (BEP20)", amount: `$${amount.toFixed(2)}`, details: "Bonus $1 inclus", status: "En attente (10 min)", statusClass: "text-gold", date: "Instant" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert("Demande de dépôt enregistrée. Compte crédité sous 10 minutes !");

  setTimeout(() => {
    investedBalance += amount + 1.00; // +$1 bonus
    updateBalances();
    record.status = "Approuvé";
    record.statusClass = "text-green";
    renderHistory();
    saveUserData();
  }, 10000);
}

function submitWithdrawal() {
  const addressInput = document.getElementById('withdrawAddress');
  const amountInput = document.getElementById('withdrawAmount');
  const amount = parseFloat(amountInput.value);

  if (!addressInput.value && !lockedWithdrawAddress) {
    alert("Veuillez renseigner votre adresse crypto !");
    return;
  }

  if (!amount || amount <= 0 || amount > (investedBalance + dailyGains)) {
    alert("Solde insuffisant pour effectuer ce retrait !");
    return;
  }

  if (!lockedWithdrawAddress) {
    lockedWithdrawAddress = addressInput.value;
    addressInput.value = lockedWithdrawAddress;
    addressInput.disabled = true;
    addressInput.style.opacity = "0.6";
  }

  if (dailyGains >= amount) {
    dailyGains -= amount;
  } else {
    const diff = amount - dailyGains;
    dailyGains = 0;
    investedBalance -= diff;
  }
  updateBalances();

  const record = { id: Date.now(), type: "Retrait USDT", amount: `$${amount.toFixed(2)}`, details: lockedWithdrawAddress, status: "Retrait en attente", statusClass: "text-gold", date: "Instant" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert("Demande de retrait enregistrée. Validation automatique sous 24h.");

  setTimeout(() => {
    record.status = "Approuvé";
    record.statusClass = "text-green";
    renderHistory();
    saveUserData();
  }, 20000);
}

function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay();
  const activeAsset = assetsSchedule[currentDay] || "BTC/USDT (Week-end)";
  document.getElementById('todayAsset').innerText = activeAsset;

  if (currentDay >= 1 && currentDay <= 5) {
    const el = document.getElementById(`day-${currentDay}`);
    if (el) el.classList.add("active-day");
  }

  // Vérifier si le trade a déjà été fait
  if (hasTradedToday) {
    lockTradeButton();
  }
}

function executeDailySignal() {
  if (hasTradedToday) {
    alert("Vous avez déjà exécuté votre trade unique aujourd'hui ! Revenez demain à 18h00.");
    return;
  }

  const totalCapital = investedBalance + dailyGains;
  if (totalCapital < 10) {
    alert("Capital insuffisant. Un minimum de $10 est requis.");
    return;
  }

  let rate = totalCapital >= 100 ? 0.02 : 0.015; // 2% ou 1.5%
  const profit = totalCapital * rate;
  dailyGains += profit;
  hasTradedToday = true;

  updateBalances();
  lockTradeButton();

  const record = { id: Date.now(), type: "Signal de Trading", amount: `+$${profit.toFixed(2)}`, details: `Gain ${(rate * 100)}%`, status: "Exécuté", statusClass: "text-green", date: "Aujourd'hui" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert(`Trade réussi ! Gains : +$${profit.toFixed(2)} (${(rate * 100)}%)`);
}

function lockTradeButton() {
  const btn = document.getElementById('executeTradeBtn');
  btn.disabled = true;
  btn.style.background = "#334155";
  btn.style.color = "#94a3b8";
  btn.innerText = "SIGNAL EXÉCUTÉ (COMPLÉTÉ)";

  document.getElementById('signalStatus').innerText = "Terminé";
  document.getElementById('signalStatus').className = "signal-val text-green";
}

function renderHistory() {
  const tbody = document.getElementById('historyTable');
  tbody.innerHTML = "";
  historyRecords.forEach(rec => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${rec.type}</b></td>
      <td><b>${rec.amount}</b></td>
      <td style="font-family:monospace; font-size:10px;">${rec.details}</td>
      <td class="${rec.statusClass}" style="font-weight:bold;">${rec.status}</td>
      <td style="color:#64748b;">${rec.date}</td>
    `;
    tbody.appendChild(tr);
  });
}
