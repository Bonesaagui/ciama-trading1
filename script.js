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

// --- INSCRIPTION SÉCURISÉE AVEC SUPABASE ---
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

  const existingUser = localStorage.getItem('ciama_user_' + email);
  if (existingUser) {
    alert("Un compte existe déjà avec cette adresse email ! Veuillez vous connecter.");
    return;
  }

  const MASTER_FOUNDER_CODE = "CIAMA001";
  let sponsorFound = false;

  if (inviteCodeInput === MASTER_FOUNDER_CODE || inviteCodeInput === "") {
    sponsorFound = true;
    if (inviteCodeInput === MASTER_FOUNDER_CODE) inviteCodeInput = "CIAMA001";
    else inviteCodeInput = null;
  } else {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('users')
          .select('invite_code')
          .eq('invite_code', inviteCodeInput);

        if (data && data.length > 0) {
          sponsorFound = true;
        }
      } catch (err) {
        console.log("Erreur de recherche Supabase :", err);
      }
    }

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
    alert("Code d'invitation invalide ou inconnu ! Veuillez utiliser le code de votre parrain.");
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
    referredBy: inviteCodeInput,
    teamMembers: []
  };

  localStorage.setItem('ciama_user_' + email, JSON.stringify(userData));

  if (inviteCodeInput) {
    processMultiLevelReferral(inviteCodeInput, email);
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from('users').upsert([
        { 
          email: email, 
          password: pass, 
          balance: 0, 
          daily_gains: 0,
          invite_code: inviteCode, 
          referred_by: inviteCodeInput,
          history_records: []
        }
      ], { onConflict: 'email' });
    } catch (err) {
      console.log("Sauvegarde Supabase :", err);
    }
  }

  currentUser = userData;
  loadUserDataFromMemory(userData);
  await initDashboard();
  alert("Inscription réussie avec succès ! Bienvenue sur CIAMA TRADING.");
}

function processMultiLevelReferral(sponsorCode, referralEmail) {
  const todayDate = new Date().toLocaleDateString('fr-FR');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('ciama_user_')) {
      try {
        const uData = JSON.parse(localStorage.getItem(key));
        if (uData.inviteCode === sponsorCode) {
          if (!uData.teamMembers) uData.teamMembers = [];
          if (!uData.teamMembers.some(m => m.email === referralEmail)) {
            uData.teamMembers.push({ email: referralEmail, level: "Niveau 1", date: todayDate });
            localStorage.setItem(key, JSON.stringify(uData));
          }
          break;
        }
      } catch (err) {}
    }
  }
}

// --- CONNEXION SÉCURISÉE ET CHARGEMENT PRIORITAIRE CLOUD ---
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;

  if (!email || !pass) {
    alert("Veuillez renseigner votre email et mot de passe !");
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

        let historyArr = data.history_records || [];
        if (typeof historyArr === 'string') {
          try { historyArr = JSON.parse(historyArr); } catch (e) { historyArr = []; }
        }

        currentUser = {
          email: data.email || email,
          password: data.password || pass,
          investedBalance: Number(data.balance) || 0,
          dailyGains: Number(data.daily_gains) || 0,
          lockedWithdrawAddress: data.withdraw_address || "",
          hasTradedToday: false,
          lastTradeDate: "",
          historyRecords: historyArr,
          usedDepositAmounts: [],
          inviteCode: data.invite_code || "CIAMA100",
          referredBy: data.referred_by || null,
          teamMembers: []
        };

        loadUserDataFromMemory(currentUser);
        localStorage.setItem('ciama_user_' + email, JSON.stringify(currentUser));
        await initDashboard();
        return;
      }
    } catch (err) {
      console.log("Erreur cloud connexion", err);
    }
  }

  let savedData = localStorage.getItem('ciama_user_' + email);
  if (savedData) {
    const data = JSON.parse(savedData);
    if (data.password && data.password !== pass) {
      alert("Mot de passe incorrect ! Veuillez réessayer.");
      return;
    }
    currentUser = data;
    loadUserDataFromMemory(data);
    await initDashboard();
    return;
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

// --- SAUVEGARDE SYNC DANS SUPABASE (AVEC AWAIT GARANTI) ---
async function saveUserData() {
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
    try {
      await supabaseClient.from('users').upsert({
        email: currentUser.email,
        password: currentUser.password,
        balance: investedBalance,
        daily_gains: dailyGains,
        withdraw_address: lockedWithdrawAddress,
        invite_code: currentUser.inviteCode,
        referred_by: currentUser.referredBy,
        history_records: historyRecords
      }, { onConflict: 'email' });
    } catch (err) {
      console.log("Erreur sauvegarde cloud :", err);
    }
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

async function initDashboard() {
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('appDashboard').classList.remove('hidden');
  
  const displayEmail = (currentUser && currentUser.email) ? currentUser.email : "Utilisateur";
  document.getElementById('userEmailDisplay').innerText = displayEmail;
  document.getElementById('profileEmail').innerText = displayEmail;

  if (currentUser && currentUser.email && supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (data) {
        investedBalance = Number(data.balance) || 0;
        dailyGains = Number(data.daily_gains) || 0;
        if (data.withdraw_address) lockedWithdrawAddress = data.withdraw_address;
        if (data.history_records) {
          let recs = data.history_records;
          if (typeof recs === 'string') {
            try { recs = JSON.parse(recs); } catch (e) {}
          }
          if (Array.isArray(recs)) historyRecords = recs;
        }
      }
    } catch (err) {
      console.log("Erreur de rafraîchissement Supabase :", err);
    }
  }

  // Vérifie et valide automatiquement tout dépôt en attente si la page a été fermée
  await checkAndApprovePendingDeposits();

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

  await updateBalances();
  setupScheduleHighlight();
  await renderHistory();
  renderTeam();
  switchNavTab('maison');
}

// --- VÉRIFICATION & APPROBATION AUTOMATIQUE DES DÉPÔTS EN ATTENTE ---
async function checkAndApprovePendingDeposits() {
  if (!historyRecords || historyRecords.length === 0) return;
  const now = Date.now();
  let updated = false;

  for (let rec of historyRecords) {
    if (rec.type.includes("Dépôt") && rec.status === "En attente (1 min)") {
      if (!rec.id || (now - rec.id >= 60000)) {
        let amount = parseFloat(rec.amount.replace(/[^0-9.]/g, '')) || 0;
        investedBalance += amount + 1.00;
        rec.status = "Approuvé";
        rec.statusClass = "text-green";
        updated = true;

        let sponsorCode = currentUser ? currentUser.referredBy : null;
        if (sponsorCode && currentUser) {
          await distributeReferralCommissions(amount, currentUser.email, sponsorCode);
        }
      }
    }
  }

  if (updated) {
    await saveUserData();
    await updateBalances();
  }
}

async function updateBalances() {
  const totalAssets = investedBalance + dailyGains;
  document.getElementById('totalAssetsBalance').innerText = `$${totalAssets.toFixed(2)}`;
  document.getElementById('investedBalance').innerText = `$${investedBalance.toFixed(2)}`;
  document.getElementById('dailyGainsBalance').innerText = `+$${dailyGains.toFixed(2)}`;
  await saveUserData();
}

async function renderTeam() {
  const tbody = document.getElementById('teamMembersTable');
  const totalCountEl = document.getElementById('totalTeamMembers');
  const l1CountEl = document.getElementById('teamL1Count');
  const l2l3CountEl = document.getElementById('teamL2L3Count');

  if (!tbody) return;

  if (!currentUser || !currentUser.inviteCode) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">Veuillez vous connecter</td></tr>`;
    return;
  }

  let teamList = [];

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('email, created_at, referred_by')
        .eq('referred_by', currentUser.inviteCode);

      if (data && data.length > 0) {
        teamList = data.map(user => {
          let dateStr = "Récemment";
          if (user.created_at) {
            const d = new Date(user.created_at);
            dateStr = d.toLocaleDateString('fr-FR');
          }
          return { email: user.email, level: "Niveau 1", date: dateStr };
        });
      }
    } catch (err) {
      console.log("Erreur filleuls Cloud :", err);
    }
  }

  if (teamList.length === 0 && currentUser.teamMembers) {
    teamList = currentUser.teamMembers;
  }

  tbody.innerHTML = "";
  
  const l1List = teamList.filter(m => m.level === "Niveau 1");
  const l2l3List = teamList.filter(m => m.level === "Niveau 2" || m.level === "Niveau 3");

  if (totalCountEl) totalCountEl.innerText = teamList.length;
  if (l1CountEl) l1CountEl.innerText = l1List.length;
  if (l2l3CountEl) l2l3CountEl.innerText = l2l3List.length;

  if (teamList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">Aucun filleul pour le moment</td></tr>`;
    return;
  }

  teamList.forEach(m => {
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
    renderHistory();
  } else if (tabName === 'vip') {
    document.getElementById('viewVip').classList.remove('hidden');
    document.getElementById('navVip').classList.add('active');
  } else if (tabName === 'mining') {
    document.getElementById('viewMining').classList.remove('hidden');
    document.getElementById('navMining').classList.add('active');
  } else if (tabName === 'team') {
    document.getElementById('viewTeam').classList.remove('hidden');
    document.getElementById('navTeam').classList.add('active');
    renderTeam(); 
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
    if (modalId === 'activityModal') {
      renderHistory();
    }
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

// --- DISTRIBUTION MULTI-NIVEAUX DES COMMISSIONS (5%, 2%, 1%) ---
async function distributeReferralCommissions(depositAmount, userEmail, sponsorCode) {
  if (!sponsorCode || !supabaseClient) return;

  try {
    const commissionL1 = depositAmount * 0.05;
    const { data: level1Sponsor } = await supabaseClient
      .from('users')
      .select('email, daily_gains, history_records, referred_by')
      .eq('invite_code', sponsorCode)
      .maybeSingle();

    if (level1Sponsor) {
      const currentGainsL1 = Number(level1Sponsor.daily_gains) || 0;
      let historyL1 = level1Sponsor.history_records || [];
      if (typeof historyL1 === 'string') {
        try { historyL1 = JSON.parse(historyL1); } catch (e) { historyL1 = []; }
      }

      historyL1.unshift({
        id: Date.now(),
        type: `Bonus Parrainage 5% (${userEmail})`,
        amount: `+$${commissionL1.toFixed(2)}`,
        status: "Approuvé",
        statusClass: "text-green"
      });

      await supabaseClient
        .from('users')
        .update({
          daily_gains: currentGainsL1 + commissionL1,
          history_records: historyL1
        })
        .eq('invite_code', sponsorCode);

      if (level1Sponsor.referred_by) {
        const commissionL2 = depositAmount * 0.02;
        const { data: level2Sponsor } = await supabaseClient
          .from('users')
          .select('email, daily_gains, history_records, referred_by')
          .eq('invite_code', level1Sponsor.referred_by)
          .maybeSingle();

        if (level2Sponsor) {
          const currentGainsL2 = Number(level2Sponsor.daily_gains) || 0;
          let historyL2 = level2Sponsor.history_records || [];
          if (typeof historyL2 === 'string') {
            try { historyL2 = JSON.parse(historyL2); } catch (e) { historyL2 = []; }
          }

          historyL2.unshift({
            id: Date.now() + 1,
            type: `Bonus Parrainage 2% (${userEmail})`,
            amount: `+$${commissionL2.toFixed(2)}`,
            status: "Approuvé",
            statusClass: "text-green"
          });

          await supabaseClient
            .from('users')
            .update({
              daily_gains: currentGainsL2 + commissionL2,
              history_records: historyL2
            })
            .eq('invite_code', level1Sponsor.referred_by);

          if (level2Sponsor.referred_by) {
            const commissionL3 = depositAmount * 0.01;
            const { data: level3Sponsor } = await supabaseClient
              .from('users')
              .select('email, daily_gains, history_records')
              .eq('invite_code', level2Sponsor.referred_by)
              .maybeSingle();

            if (level3Sponsor) {
              const currentGainsL3 = Number(level3Sponsor.daily_gains) || 0;
              let historyL3 = level3Sponsor.history_records || [];
              if (typeof historyL3 === 'string') {
                try { historyL3 = JSON.parse(historyL3); } catch (e) { historyL3 = []; }
              }

              historyL3.unshift({
                id: Date.now() + 2,
                type: `Bonus Parrainage 1% (${userEmail})`,
                amount: `+$${commissionL3.toFixed(2)}`,
                status: "Approuvé",
                statusClass: "text-green"
              });

              await supabaseClient
                .from('users')
                .update({
                  daily_gains: currentGainsL3 + commissionL3,
                  history_records: historyL3
                })
                .eq('invite_code', level2Sponsor.referred_by);
            }
          }
        }
      }
    }
  } catch (err) {
    console.log("Erreur distribution commissions :", err);
  }
}

// --- SOUMISSION DE DÉPÔT AVEC SYNCHRONISATION CLOUD IMMÉDIATE ---
async function submitDeposit() {
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

  const record = { 
    id: Date.now(), 
    type: "Dépôt USDT (BEP20)", 
    amount: `+$${amount.toFixed(2)}`, 
    status: "En attente (1 min)", 
    statusClass: "text-gold" 
  };
  
  historyRecords.unshift(record);
  await saveUserData(); // Sauvegarde immédiate de l'état "En attente"
  await renderHistory();

  alert("Demande de dépôt enregistrée. Votre compte sera crédité automatiquement dans 1 minute !");

  setTimeout(async () => {
    investedBalance += amount + 1.00;
    record.status = "Approuvé";
    record.statusClass = "text-green";
    
    // IMPORTANT : Sauvegarde synchrone prioritaire dans Supabase avant de rafraîchir l'écran
    await saveUserData();
    
    await updateBalances();
    setupScheduleHighlight(); 
    await renderHistory();

    let sponsorCode = currentUser ? currentUser.referredBy : null;
    if (!sponsorCode && supabaseClient && currentUser) {
      const { data: userData } = await supabaseClient
        .from('users')
        .select('referred_by')
        .eq('email', currentUser.email)
        .maybeSingle();
      if (userData && userData.referred_by) {
        sponsorCode = userData.referred_by;
      }
    }

    if (sponsorCode && currentUser) {
      await distributeReferralCommissions(amount, currentUser.email, sponsorCode);
    }
  }, 60000); 
}

// --- SOUMISSION DE RETRAIT ---
async function submitWithdrawal() {
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
  closeModal('withdrawModal');

  const record = { 
    id: Date.now(), 
    type: "Retrait des Gains", 
    amount: `-$${amount.toFixed(2)}`, 
    status: "En attente (24h-72h)", 
    statusClass: "text-gold" 
  };
  
  historyRecords.unshift(record);
  await saveUserData();
  await renderHistory();
  await updateBalances();

  alert("Demande de retrait enregistrée. En attente d'approbation (délai de 24h à 72h).");
}

// --- EXÉCUTION DE L'ORDRE DE TRADING / MINIER (RESTREINT À 18H00 - 20H00) ---
async function executeDailySignal() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  if (currentDay === 0 || currentDay === 6) {
    alert("Le marché est fermé pendant le week-end !");
    return;
  }

  if (currentHour < 18 || currentHour >= 20) {
    alert("Le signal minier est accessible uniquement entre 18h00 et 20h00 !");
    return;
  }

  if (investedBalance < 10) {
    alert("Solde insuffisant ! Un dépôt minimum de $10 est requis pour lancer le trading.");
    return;
  }

  if (hasTradedToday) {
    alert("Vous avez déjà exécuté votre position aujourd'hui. Rendez-vous demain !");
    return;
  }

  const tradeGain = investedBalance * 0.015;
  dailyGains += tradeGain;
  hasTradedToday = true;
  lastTradeDate = now.toISOString().split('T')[0];

  const record = {
    id: Date.now(),
    type: "Signal Minier",
    amount: `+$${tradeGain.toFixed(2)}`,
    status: "Exécuté",
    statusClass: "text-green"
  };

  historyRecords.unshift(record);
  await updateBalances();
  setupScheduleHighlight();
  await renderHistory();

  alert(`Position exécutée avec succès ! Vous avez gagné +$${tradeGain.toFixed(2)}.`);
}

// --- GESTION DU BOUTON ET DES HORAIRES DU SIGNAL (18H00 - 20H00) ---
function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Dimanche, 6 = Samedi
  const currentHour = now.getHours(); // Heure actuelle (0 à 23)
  const todayStr = now.toISOString().split('T')[0];

  if (lastTradeDate !== todayStr) {
    hasTradedToday = false;
  }

  const isWeekend = (currentDay === 0 || currentDay === 6);
  const activeAsset = isWeekend ? "Fermé (Week-end)" : (assetsSchedule[currentDay] || "Fermé");
  
  const todayAssetEl = document.getElementById('todayAsset');
  if (todayAssetEl) {
    todayAssetEl.innerText = activeAsset;
  }

  const tradeBtn = document.getElementById('executeTradeBtn');
  
  if (tradeBtn) {
    // 1. VÉRIFICATION WEEK-END
    if (isWeekend) {
      tradeBtn.innerText = "MARCHÉ FERMÉ (WEEK-END)";
      tradeBtn.style.backgroundColor = "#ef4444";
      tradeBtn.style.color = "#ffffff";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
      return;
    }

    // 2. VÉRIFICATION SI DÉJÀ TRADÉ AUJOURD'HUI
    if (hasTradedToday) {
      tradeBtn.innerText = "POSITION DÉJÀ EXÉCUTÉE AUJOURD'HUI";
      tradeBtn.style.backgroundColor = "#475569";
      tradeBtn.style.color = "#94a3b8";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
      return;
    }

    // 3. VÉRIFICATION DE LA PLAGE HORAIRE (18H00 - 20H00)
    if (currentHour < 18) {
      // Avant 18h00
      tradeBtn.innerText = "SIGNAL FERMÉ (OUVERTURE À 18H00)";
      tradeBtn.style.backgroundColor = "#334155";
      tradeBtn.style.color = "#94a3b8";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
    } else if (currentHour >= 20) {
      // Après 20h00
      tradeBtn.innerText = "SIGNAL FERMÉ (DISPONIBLE DEMAIN À 18H00)";
      tradeBtn.style.backgroundColor = "#334155";
      tradeBtn.style.color = "#94a3b8";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
    } else {
      // Entre 18h00 et 20h00
      tradeBtn.innerText = "CONFIRMER L'OUVERTURE DE LA POSITION";
      tradeBtn.style.backgroundColor = "#eab308";
      tradeBtn.style.color = "#000000";
      tradeBtn.style.cursor = "pointer";
      tradeBtn.disabled = false;
    }
  }
}

// --- AFFICHAGE UNIFIÉ DE L'HISTORIQUE (ACCUEIL & MODAL) ---
async function renderHistory() {
  const homeTbody = document.getElementById('homeHistoryTable');
  const modalTbody = document.getElementById('historyTable');

  if (currentUser && currentUser.email && supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from('users')
        .select('history_records')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (data && data.history_records) {
        let recs = data.history_records;
        if (typeof recs === 'string') {
          try { recs = JSON.parse(recs); } catch (e) {}
        }
        if (Array.isArray(recs) && recs.length > 0) {
          historyRecords = recs;
        }
      }
    } catch (err) {
      console.log("Erreur chargement historique :", err);
    }
  }

  const targets = [homeTbody, modalTbody].filter(Boolean);

  targets.forEach(tbody => {
    tbody.innerHTML = "";

    if (!historyRecords || historyRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 15px; color:#64748b;">Aucune activité récente</td></tr>`;
      return;
    }

    historyRecords.forEach(rec => {
      let isExecutedOrApproved = rec.status === 'Exécuté' || rec.status === 'Approuvé' || rec.statusClass === 'text-green';
      let statusColor = isExecutedOrApproved ? '#22c55e' : '#eab308';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 10px 5px; font-weight: bold; font-size: 13px; color: #f8fafc;">${rec.type}</td>
        <td style="padding: 10px 5px; font-weight: bold; font-size: 13px; color: #f8fafc;">${rec.amount}</td>
        <td style="padding: 10px 5px; font-weight: bold; font-size: 13px; color: ${statusColor};">${rec.status}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function copyInviteCodeOnly() {
  const input = document.getElementById('inviteCodeOnlyDisplay');
  if (input && input.value) {
    navigator.clipboard.writeText(input.value);
    alert("Code d'invitation copié : " + input.value);
  }
}

function copyInviteCode() {
  const input = document.getElementById('inviteCodeDisplay');
  if (input && input.value) {
    navigator.clipboard.writeText(input.value);
    alert("Lien d'invitation copié !");
  }
}
