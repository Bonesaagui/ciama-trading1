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
  switchAuthTab('register');
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

// --- INSCRIPTION AVEC VÉRIFICATION SUPABASE STRICTE ET UNIVERSELLE ---
async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPassword').value;
  const confirmPass = document.getElementById('regConfirmPassword').value;
  let inviteCodeInput = document.getElementById('regInviteCode').value.trim();

  if (inviteCodeInput.includes('invite=')) {
    inviteCodeInput = inviteCodeInput.split('invite=')[1].split('&')[0];
  }
  inviteCodeInput = inviteCodeInput.toUpperCase();

  if (!email || !pass) {
    alert("Veuillez remplir tous les champs !");
    return;
  }

  if (pass !== confirmPass) {
    alert("Les mots de passe ne correspondent pas !");
    return;
  }

  // --- VÉRIFICATION DU PARRAIN (GLOBALEMENT DANS SUPABASE) ---
  const MASTER_FOUNDER_CODE = "CIAMA001";
  let sponsorFound = false;

  if (inviteCodeInput === MASTER_FOUNDER_CODE || inviteCodeInput === "") {
    sponsorFound = true;
    if (inviteCodeInput === MASTER_FOUNDER_CODE) inviteCodeInput = "CIAMA001";
    else inviteCodeInput = null;
  } else {
    if (supabaseClient) {
      try {
        // On cherche le code d'invitation directement dans la base de données Supabase
        const { data, error } = await supabaseClient
          .from('users')
          .select('invite_code')
          .eq('invite_code', inviteCodeInput);

        if (data && data.length > 0) {
          sponsorFound = true;
        }
      } catch (err) {
        console.log("Erreur de connexion à Supabase pour le parrain :", err);
      }
    }

    // Fallback de secours local si Supabase ne répond pas
    if (!sponsorFound) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('ciama_user_')) {
          try {
            const uData = JSON.parse(localStorage.getItem(key));
            if (uData && uData.inviteCode === inviteCodeInput) {
              sponsorFound = true;
              break;
            }
          } catch (err) {}
        }
      }
    }
  }

  if (!sponsorFound) {
    alert("Code d'invitation invalide ou inconnu ! Ce code n'existe pas sur la plateforme.");
    return;
  }

  // Génération du nouveau code unique de l'utilisateur
  const inviteCode = "CIAMA" + Math.floor(1000 + Math.random() * 9000);

  // --- SAUVEGARDE OBLIGATOIRE DANS SUPABASE EN PREMIER ---
  if (supabaseClient) {
    try {
      const { error: insertError } = await supabaseClient.from('users').insert([
        { 
          email: email, 
          password: pass, 
          balance: 0, 
          invite_code: inviteCode, 
          referred_by: inviteCodeInput 
        }
      ]);

      if (insertError) {
        console.error("Erreur d'insertion Supabase :", insertError);
        alert("Erreur lors de l'inscription sur le serveur. Veuillez réessayer.");
        return;
      }
    } catch (err) {
      console.log("Erreur critique Supabase :", err);
      alert("Impossible de joindre le serveur distant. Vérifiez votre connexion.");
      return;
    }
  }

  // Création de l'objet utilisateur local
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
    referredBy: inviteCodeInput,
    teamMembers: []
  };

  // Enregistrement local
  localStorage.setItem('ciama_user_' + email, JSON.stringify(userData));

  // Traitement multi-niveaux si un parrain existe
  if (inviteCodeInput) {
    processMultiLevelReferral(inviteCodeInput, email);
  }

  currentUser = userData;
  loadUserDataFromMemory(userData);
  initDashboard();
  alert("Inscription réussie avec succès ! Bienvenue sur CIAMA TRADING.");
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
    if (!level1Data.teamMembers.some(m => m.email === referralEmail)) {
      level1Data.teamMembers.push({ email: referralEmail, level: "Niveau 1", date: todayDate });
      localStorage.setItem(level1Key, JSON.stringify(level1Data));
    }

    if (level1Data.referredBy) {
      let level2Key = null;
      let level2Data = null;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('ciama_user_')) {
          try {
            const uData2 = JSON.parse(localStorage.getItem(key));
            if (uData2.inviteCode === level1Data.referredBy) {
              level2Key = key;
              level2Data = uData2;
              break;
            }
          } catch (err) {}
        }
      }

      if (level2Data) {
        if (!level2Data.teamMembers) level2Data.teamMembers = [];
        if (!level2Data.teamMembers.some(m => m.email === referralEmail)) {
          level2Data.teamMembers.push({ email: referralEmail, level: "Niveau 2", date: todayDate });
          localStorage.setItem(level2Key, JSON.stringify(level2Data));
        }

        if (level2Data.referredBy) {
          let level3Key = null;
          let level3Data = null;

          for (let j = 0; j < localStorage.length; j++) {
            const key3 = localStorage.key(j);
            if (key3.startsWith('ciama_user_')) {
              try {
                const uData3 = JSON.parse(localStorage.getItem(key3));
                if (uData3.inviteCode === level2Data.referredBy) {
                  level3Key = key3;
                  level3Data = uData3;
                  break;
                }
              } catch (e) {}
            }
          }

          if (level3Data) {
            if (!level3Data.teamMembers) level3Data.teamMembers = [];
            if (!level3Data.teamMembers.some(m => m.email === referralEmail)) {
              level3Data.teamMembers.push({ email: referralEmail, level: "Niveau 3", date: todayDate });
              localStorage.setItem(level3Key, JSON.stringify(level3Data));
            }
          }
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
        .maybeSingle();

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
          referredBy: data.referred_by || null,
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
    referredBy: currentUser.referredBy || null,
    teamMembers
  };
  
  localStorage.setItem('ciama_user_' + currentUser.email, JSON.stringify(data));

  if (supabaseClient) {
    supabaseClient.from('users').upsert({
      email: currentUser.email,
      password: currentUser.password,
      balance: investedBalance,
      daily_gains: dailyGains,
      withdraw_address: lockedWithdrawAddress,
      invite_code: currentUser.inviteCode,
      referred_by: currentUser.referredBy
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
  
  if (currentUser && currentUser.email) {
    const latestData = localStorage.getItem('ciama_user_' + currentUser.email);
    if (latestData) {
      currentUser = JSON.parse(latestData);
      loadUserDataFromMemory(currentUser);
    }
  }

  if (document.getElementById('inviteCodeOnlyDisplay')) {
    document.getElementById('inviteCodeOnlyDisplay').value = currentUser.inviteCode || "";
  }

  if (document.getElementById('inviteCodeDisplay')) {
    const fullInviteLink = `${window.location.origin}${window.location.pathname}?invite=${currentUser.inviteCode || ""}`;
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
    if (currentUser && currentUser.email) {
      const latestData = localStorage.getItem('ciama_user_' + currentUser.email);
      if (latestData) {
        currentUser = JSON.parse(latestData);
        teamMembers = currentUser.teamMembers || [];
      }
      renderTeam();
    }
    document.getElementById('viewTeam').classList.remove('hidden');
    document.getElementById('navTeam').classList.add('active');
  } else if (tabName === 'profile') {
    document.getElementById('viewProfile').classList.remove('hidden');
    document.getElementById('navProfile').classList.add('active');
  }
}

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

function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay();

  if (lastTradeDate !== now.toISOString().split('T')[0]) {
    hasTradedToday = false;
  }

  const activeAsset = assetsSchedule[currentDay] || "Fermé (Week-end)";
  document.getElementById('todayAsset').innerText = (currentDay === 0 || currentDay === 6) ? "Fermé (Week-end)" : activeAsset;
}

function renderHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  historyList.innerHTML = "";
  if (historyRecords.length === 0) {
    historyList.innerHTML = "<p style='text-align:center; color:#64748b;'>Aucune transaction récente</p>";
    return;
  }
  historyRecords.forEach(rec => {
    const div = document.createElement('div');
    div.className = "history-item";
    div.innerHTML = `
      <div>
        <p><b>${rec.type}</b></p>
        <p class="${rec.statusClass}">${rec.status}</p>
      </div>
      <p><b>${rec.amount}</b></p>
    `;
    historyList.appendChild(div);
  });
}
