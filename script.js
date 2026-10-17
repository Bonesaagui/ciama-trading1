// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://ufnyqemgcfpxbkitbnxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BWB4tkR__rvsP4CIKMqkGw_a5r15LuC"; 

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- DÉTECTION AUTOMATIQUE DU CODE D'INVITATION DEPUIS L'URL ---
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteParam = urlParams.get('invite');
  
  if (inviteParam) {
    const inviteInput = document.getElementById('regInviteCode');
    if (inviteInput) {
      inviteInput.value = inviteParam.trim().toUpperCase();
    }
  }
});

// --- ÉTAT DU COMPTE ---
let currentUser = null;
let investedBalance = 0;
let dailyGains = 0;
let lockedWithdrawAddress = "";
let hasTradedToday = false;
let lastTradeDate = ""; 
let historyRecords = [];
let hasCopiedAddress = false;
let usedDepositAmounts = [];
let teamMembers = [];

const assetsSchedule = {
  1: "BTC/USDT",
  2: "ETH/USDT",
  3: "BNB/USDT",
  4: "SOL/USDT",
  5: "XRP/USDT"
};

// --- INSCRIPTION AVEC SYSTÈME DE PARRAINAGE MULTI-NIVEAUX (N1, N2, N3) ---
async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPassword').value;
  const confirmPass = document.getElementById('regConfirmPassword').value;
  let inviteCodeInput = document.getElementById('regInviteCode').value.trim();

  // Extraction propre du code si l'utilisateur a collé un lien entier
  if (inviteCodeInput.includes('invite=')) {
    inviteCodeInput = inviteCodeInput.split('invite=')[1].split('&')[0];
  }
  inviteCodeInput = inviteCodeInput.toUpperCase();

  if (!email || !pass) {
    alert("Veuillez remplir tous les champs !");
    return;
  }

  if (!inviteCodeInput) {
    alert("Le code ou lien d'invitation est obligatoire pour s'inscrire !");
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
    lastTradeDate: "",
    historyRecords: [],
    usedDepositAmounts: [],
    inviteCode,
    referredBy: inviteCodeInput || null,
    teamMembers: []
  };

  if (inviteCodeInput) {
    processMultiLevelReferral(inviteCodeInput, email);
  }

  localStorage.setItem('ciama_user_' + email, JSON.stringify(userData));

  if (supabaseClient) {
    try {
      await supabaseClient.from('users').insert([
        { email: email, password: pass, balance: 0, invite_code: inviteCode, referred_by: inviteCodeInput }
      ]);
    } catch (err) {
      console.log("Sauvegarde Supabase en attente.");
    }
  }

  currentUser = userData;
  loadUserDataFromMemory(userData);
  initDashboard();
}

function processMultiLevelReferral(sponsorCode, referralEmail) {
  const todayDate = new Date().toLocaleDateString('fr-FR');

  let level1Key = null;
  let level1Data = null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('ciama_user_')) {
      try {
        const uData = JSON.parse(localStorage.getItem(key));
        if (uData.inviteCode === sponsorCode) {
          level1Key = key;
          level1Data = uData;
          break;
        }
      } catch (err) {}
    }
  }

  if (level1Data) {
    if (!level1Data.teamMembers) level1Data.teamMembers = [];
    level1Data.teamMembers.push({ email: referralEmail, level: "Niveau 1", date: todayDate });
    localStorage.setItem(level1Key, JSON.stringify(level1Data));

    if (level1Data.referredBy) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('ciama_user_')) {
          try {
            const uData2 = JSON.parse(localStorage.getItem(key));
            if (uData2.inviteCode === level1Data.referredBy) {
              if (!uData2.teamMembers) uData2.teamMembers = [];
              uData2.teamMembers.push({ email: referralEmail, level: "Niveau 2", date: todayDate });
              localStorage.setItem(key, JSON.stringify(uData2));

              if (uData2.referredBy) {
                for (let j = 0; j < localStorage.length; j++) {
                  const key3 = localStorage.key(j);
                  if (key3.startsWith('ciama_user_')) {
                    try {
                      const uData3 = JSON.parse(localStorage.getItem(key3));
                      if (uData3.inviteCode === uData2.referredBy) {
                        if (!uData3.teamMembers) uData3.teamMembers = [];
                        uData3.teamMembers.push({ email: referralEmail, level: "Niveau 3", date: todayDate });
                        localStorage.setItem(key3, JSON.stringify(uData3));
                        break;
                      }
                    } catch (e) {}
                  }
                }
              }
              break;
            }
          } catch (err) {}
        }
      }
    }
  }
}

// --- CONNEXION ---
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;

  if (!email || !pass) {
    alert("Veuillez renseigner votre email et mot de passe !");
    return;
  }

  let savedData = localStorage.getItem('ciama_user_' + email);

  if (savedData) {
    const data = JSON.parse(savedData);
    
    if (data.password && data.password !== pass) {
      alert("Mot de passe incorrect ! Veuillez réessayer.");
      return;
    }

    if (!data.password) {
      data.password = pass;
    }

    data.email = email;
    currentUser = data;
    loadUserDataFromMemory(data);
    saveUserData();
    initDashboard();
    return;
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (data) {
        if (data.password && data.password !== pass) {
          alert("Mot de passe incorrect !");
          return;
        }

        currentUser = {
          email: data.email || email,
          password: data.password || pass,
          investedBalance: data.balance || 0,
          dailyGains: data.daily_gains || 0,
          lockedWithdrawAddress: data.withdraw_address || "",
          hasTradedToday: false,
          lastTradeDate: "",
          historyRecords: [],
          usedDepositAmounts: [],
          inviteCode: data.invite_code || "CIAMA100",
          teamMembers: []
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

  alert("Aucun compte trouvé avec cet email ! Veuillez d'abord vous inscrire.");
}

function loadUserDataFromMemory(data) {
  investedBalance = Number(data.investedBalance) || 0;
  dailyGains = Number(data.dailyGains) || 0;
  lockedWithdrawAddress = data.lockedWithdrawAddress || "";
  lastTradeDate = data.lastTradeDate || "";
  
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastTradeDate !== todayStr) {
    hasTradedToday = false;
  } else {
    hasTradedToday = data.hasTradedToday || false;
  }

  historyRecords = data.historyRecords || [];
  usedDepositAmounts = data.usedDepositAmounts || [];
  teamMembers = data.teamMembers || [];
}

function saveUserData() {
  if (!currentUser || !currentUser.email) return;
  const data = {
    email: currentUser.email,
    password: currentUser.password,
    investedBalance,
    dailyGains,
    lockedWithdrawAddress,
    hasTradedToday,
    lastTradeDate,
    historyRecords,
    usedDepositAmounts,
    inviteCode: currentUser.inviteCode,
    teamMembers
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
  
  const displayEmail = (currentUser && currentUser.email) ? currentUser.email : "Utilisateur";
  document.getElementById('userEmailDisplay').innerText = displayEmail;
  document.getElementById('profileEmail').innerText = displayEmail;
  
  // AFFICHER LE LIEN COMPLET D'INVITATION
  if (document.getElementById('inviteCodeDisplay')) {
    const fullInviteLink = `${window.location.origin}/?invite=${currentUser.inviteCode || ""}`;
    document.getElementById('inviteCodeDisplay').value = fullInviteLink;
  }

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
  renderTeam();
  switchNavTab('maison');
}

function updateBalances() {
  const totalAssets = investedBalance + dailyGains;
  document.getElementById('totalAssetsBalance').innerText = `$${totalAssets.toFixed(2)}`;
  document.getElementById('investedBalance').innerText = `$${investedBalance.toFixed(2)}`;
  document.getElementById('dailyGainsBalance').innerText = `+$${dailyGains.toFixed(2)}`;
  saveUserData();
}

function renderTeam() {
  const tbody = document.getElementById('teamMembersTable');
  const totalCountEl = document.getElementById('totalTeamMembers');
  const l1CountEl = document.getElementById('teamL1Count');
  const l2l3CountEl = document.getElementById('teamL2L3Count');

  if (!tbody) return;

  tbody.innerHTML = "";
  
  const l1List = teamMembers.filter(m => m.level === "Niveau 1");
  const l2l3List = teamMembers.filter(m => m.level === "Niveau 2" || m.level === "Niveau 3");

  if (totalCountEl) totalCountEl.innerText = teamMembers.length;
  if (l1CountEl) l1CountEl.innerText = l1List.length;
  if (l2l3CountEl) l2l3CountEl.innerText = l2l3List.length;

  if (teamMembers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">Aucun filleul pour le moment</td></tr>`;
    return;
  }

  teamMembers.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${m.email}</b></td>
      <td><span class="${m.level === 'Niveau 1' ? 'text-green' : 'text-gold'}" style="font-weight:bold;">${m.level}</span></td>
      <td style="font-size: 11px; color: #cbd5e1;">${m.date}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- GESTION ISOLÉE DE LA NAVIGATION ---
function switchNavTab(tabName) {
  closeAllModals();

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

// --- GESTION INDÉPENDANTE DES MODALES ---
function openModal(modalId) {
  closeAllModals();
  const targetModal = document.getElementById(modalId);
  if (targetModal) {
    targetModal.classList.remove('hidden');
  }
}

function closeModal(modalId) {
  const targetModal = document.getElementById(modalId);
  if (targetModal) {
    targetModal.classList.add('hidden');
  }
}

function closeAllModals() {
  const modals = ['depositModal', 'withdrawModal', 'activityModal'];
  modals.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
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

// --- GESTION DE L'AFFICHAGE ET DE L'ÉTAT DU BOUTON DU SIGNAL ---
function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  if (lastTradeDate !== todayStr) {
    hasTradedToday = false;
  }

  const activeAsset = assetsSchedule[currentDay] || "Fermé (Week-end)";
  document.getElementById('todayAsset').innerText = (currentDay === 0 || currentDay === 6) ? "Fermé (Week-end)" : activeAsset;

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

  const isWeekend = (currentDay === 0 || currentDay === 6);
  const isSignalTime = (currentHour >= 18 && currentHour < 20);
  const btn = document.getElementById('executeTradeBtn');

  if (isWeekend) {
    btn.disabled = true;
    btn.style.background = "#1e293b";
    btn.style.color = "#ef4444";
    btn.innerText = "SIGNAL FERMÉ LE WEEK-END";
  } else if (hasTradedToday) {
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
    btn.style.cursor = "pointer";
    btn.innerText = "CONFIRMER L'OUVERTURE DE LA POSITION";
  }
}

// --- EXÉCUTION DU SIGNAL PAR CLIC D'UTILISATEUR ---
function executeDailySignal() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  if (currentDay === 0 || currentDay === 6) {
    alert("Le Bassin Minier est fermé pendant le week-end !");
    return;
  }

  if (currentHour < 18 || currentHour >= 20) {
    alert("Le signal est accessible uniquement entre 18h00 et 20h00 !");
    return;
  }

  if (hasTradedToday) {
    alert("Vous avez déjà exécuté votre trade aujourd'hui ! Revenez demain à 18h00.");
    return;
  }

  if (investedBalance < 10) {
    alert("Capital investi insuffisant. Un minimum de 10$ est requis pour valider le signal.");
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
  lastTradeDate = todayStr;

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

  alert(`Position confirmée avec succès ! Gains journaliers ajoutés : +$${profit.toFixed(2)} (${(rate * 100)}%)`);
}

function renderHistory() {
  const tbody = document.getElementById('historyTable');
  if (!tbody) return;
  tbody.innerHTML = "";
  historyRecords.forEach(rec => {
    const tr = document
