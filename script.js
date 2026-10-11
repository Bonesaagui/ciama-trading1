// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://ufnyqemgcfpxbkitbnxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BWB4tkR__rvsP4CIKMqkGw_a5r15LuC"; 

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- ÉTAT DU COMPTE ---
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

// --- INSCRIPTION SÉCURISÉE AVEC AUTHENTIFICATION ---
async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPassword').value;
  const confirmPass = document.getElementById('regConfirmPassword').value;

  if (!email || !pass) {
    alert("Veuillez remplir tous les champs !");
    return;
  }

  if (pass !== confirmPass) {
    alert("Les mots de passe ne correspondent pas !");
    return;
  }

  const existingUser = localStorage.getItem('ciama_user_' + email);
  if (existingUser) {
    alert("Un compte existe déjà avec cette adresse email ! Veuillez vous connecter.");
    return;
  }

  const inviteCode = "CIAMA" + Math.floor(1000 + Math.random() * 9000);
  const userData = {
    email,
    password: pass,
    investedBalance: 0,
    dailyGains: 0,
    lockedWithdrawAddress: "",
    hasTradedToday: false,
    historyRecords: [],
    usedDepositAmounts: [],
    inviteCode
  };

  localStorage.setItem('ciama_user_' + email, JSON.stringify(userData));

  if (supabaseClient) {
    try {
      await supabaseClient.from('users').insert([
        { email: email, password: pass, balance: 0, invite_code: inviteCode }
      ]);
    } catch (err) {
      console.log("Sauvegarde Supabase en attente.");
    }
  }

  currentUser = userData;
  loadUserDataFromMemory(userData);
  initDashboard();
}

// --- CONNEXION AVEC VÉRIFICATION STRICTE DE L'AUTHENTIFICATION ---
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;

  if (!email || !pass) {
    alert("Veuillez renseigner votre email et mot de passe !");
    return;
  }

  // 1. Vérification dans le stockage local
  let savedData = localStorage.getItem('ciama_user_' + email);

  if (savedData) {
    const data = JSON.parse(savedData);
    
    // Vérification stricte du mot de passe
    if (data.password && data.password !== pass) {
      alert("Mot de passe incorrect ! Veuillez réessayer.");
      return;
    }

    currentUser = data;
    loadUserDataFromMemory(data);
    initDashboard();
    return;
  }

  // 2. Vérification dans Supabase (Cloud) si non trouvé localement
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', pass)
        .single();

      if (data) {
        currentUser = {
          email: data.email,
          password: data.password,
          investedBalance: data.balance || 0,
          dailyGains: data.daily_gains || 0,
          lockedWithdrawAddress: data.withdraw_address || "",
          hasTradedToday: false,
          historyRecords: [],
          usedDepositAmounts: [],
          inviteCode: data.invite_code || "CIAMA100"
        };

        saveUserData();
        loadUserDataFromMemory(currentUser);
        initDashboard();
        return;
      }
    } catch (err) {
      console.log("Erreur de vérification cloud", err);
    }
  }

  // Si le compte n'existe ni localement ni sur Supabase avec ce mot de passe
  alert("Aucun compte trouvé avec cet email ou mot de passe incorrect ! Veuillez vous inscrire.");
}

function loadUserDataFromMemory(data) {
  investedBalance = data.investedBalance || 0;
  dailyGains = data.dailyGains || 0;
  lockedWithdrawAddress = data.lockedWithdrawAddress || "";
  hasTradedToday = data.hasTradedToday || false;
  historyRecords = data.historyRecords || [];
  usedDepositAmounts = data.usedDepositAmounts || [];
}

function saveUserData() {
  if (!currentUser) return;
  const data = {
    email: currentUser.email,
    password: currentUser.password,
    investedBalance,
    dailyGains,
    lockedWithdrawAddress,
    hasTradedToday,
    historyRecords,
    usedDepositAmounts,
    inviteCode: currentUser.inviteCode
  };
  
  localStorage.setItem('ciama_user_' + currentUser.email, JSON.stringify(data));

  if (supabaseClient) {
    supabaseClient.from('users').upsert({
      email: currentUser.email,
      password: currentUser.password,
      balance: investedBalance,
      daily_gains: dailyGains,
      withdraw_address: lockedWithdrawAddress
    }).then();
  }
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

  const record = { id: Date.now(), type: "Dépôt USDT (BEP20)", amount: `$${amount.toFixed(2)}`, status: "En attente (1 min)", statusClass: "text-gold" };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert("Demande de dépôt enregistrée. Votre compte sera crédité automatiquement dans 1 minute !");

  setTimeout(() => {
    investedBalance += amount + 1.00;
    updateBalances();
    setupScheduleHighlight(); 
    record.status = "Approuvé";
    record.statusClass = "text-green";
    renderHistory();
    saveUserData();
  }, 60000); 
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

  setTimeout(() => {
    record.status = "Approuvé";
    record.statusClass = "text-green";
    renderHistory();
    saveUserData();
  }, 40000); 
}

// --- CONTRÔLE HORAIRE DU SIGNAL (18H00 À 20H00 STRICT) ---
function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  const activeAsset = assetsSchedule[currentDay] || "BTC/USDT (Week-end)";
  document.getElementById('todayAsset').innerText = activeAsset;

  let rateText = "1.5%";
  if (investedBalance >= 50 && investedBalance <= 200) {
    rateText = "2%";
  } else if (investedBalance >= 300) {
    rateText = "3%";
  }
  const vipRateDisplay = document.getElementById('currentVipRate');
  if (vipRateDisplay) {
    vipRateDisplay.innerText = rateText;
  }

  const isSignalTime = (currentHour >= 18 && currentHour < 20);
  const btn = document.getElementById('executeTradeBtn');

  if (hasTradedToday) {
    btn.disabled = true;
    btn.style.background = "#334155";
    btn.style.color = "#94a3b8";
    btn.innerText = "SIGNAL DÉJÀ EXÉCUTÉ AUJOURD'HUI";
  } else if (!isSignalTime) {
    btn.disabled = true;
    btn.style.background = "#1e293b";
    btn.style.color = "#64748b";
    btn.innerText = "ACCÈS FERMÉ (OUVERTURE À 18H00)";
  } else {
    btn.disabled = false;
    btn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    btn.style.color = "#070913";
    btn.innerText = "CONFIRMER L'OUVERTURE DE LA POSITION";
  }
}

function executeDailySignal() {
  const now = new Date();
  const currentHour = now.getHours();

  if (currentHour < 18 || currentHour >= 20) {
    alert("Le signal est accessible uniquement entre 18h00 et 20h00 !");
    return;
  }

  if (hasTradedToday) {
    alert("Vous avez déjà exécuté votre trade aujourd'hui ! Revenez demain à 18h00.");
    return;
  }

  if (investedBalance < 10) {
    alert("Capital investi insuffisant. Un minimum de 10$ est requis.");
    return;
  }

  let rate = 0.015;
  if (investedBalance >= 50 && investedBalance <= 200) {
    rate = 0.02;
  } else if (investedBalance >= 300) {
    rate = 0.03;
  }

  const profit = investedBalance * rate;
  dailyGains += profit;
  hasTradedToday = true;

  updateBalances();
  setupScheduleHighlight();

  const record = { 
    id: Date.now(), 
    type: "Signal Minier", 
    amount: `+$${profit.toFixed(2)}`, 
    status: "Exécuté", 
    statusClass: "text-green" 
  };
  historyRecords.unshift(record);
  renderHistory();
  saveUserData();

  alert(`Position confirmée ! Gains journaliers ajoutés : +$${profit.toFixed(2)} (${(rate * 100)}%)`);
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
  
