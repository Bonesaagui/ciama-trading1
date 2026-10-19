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
  await saveUserData(); 
  await renderHistory();

  alert("Demande de dépôt enregistrée. Votre compte sera crédité automatiquement dans 1 minute !");

  setTimeout(async () => {
    investedBalance += amount + 1.00;
    record.status = "Approuvé";
    record.statusClass = "text-green";
    
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

// --- EXÉCUTION DE L'ORDRE DE TRADING / MINIER (AVEC PALIERS DYNAMIQUES) ---
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

  // --- CALCUL DU POURCENTAGE SELON LE PALIER D'INVESTISSEMENT ---
  let profitPercentage = 0.015; // 1.5% par défaut (10$ à 49$)
  if (investedBalance >= 50 && investedBalance <= 299) {
    profitPercentage = 0.02;  // 2.0% (50$ à 299$)
  } else if (investedBalance >= 300) {
    profitPercentage = 0.03;  // 3.0% (300$ et plus)
  }

  const tradeGain = investedBalance * profitPercentage;
  dailyGains += tradeGain;
  hasTradedToday = true;
  lastTradeDate = now.toISOString().split('T')[0];

  const record = {
    id: Date.now(),
    type: `Signal Minier (${(profitPercentage * 100).toFixed(1)}%)`,
    amount: `+$${tradeGain.toFixed(2)}`,
    status: "Exécuté",
    statusClass: "text-green"
  };

  historyRecords.unshift(record);
  await saveUserData();
  await updateBalances();
  setupScheduleHighlight();
  await renderHistory();

  alert(`Position exécutée avec succès ! Vous avez gagné +$${tradeGain.toFixed(2)} (${(profitPercentage * 100).toFixed(1)}%).`);
}

// --- GESTION DU BOUTON, HORAIRES & MISE À JOUR DU TAUX DYNAMIQUE ---
function setupScheduleHighlight() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
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

  // --- MISE À JOUR DYNAMIQUE DU TAUX DANS L'ONGLET BASSIN MINIER ---
  let profitPercentage = 0.015;
  if (investedBalance >= 50 && investedBalance <= 299) {
    profitPercentage = 0.02;
  } else if (investedBalance >= 300) {
    profitPercentage = 0.03;
  }

  const yieldRateEl = document.getElementById('miningYieldRate');
  if (yieldRateEl) {
    yieldRateEl.innerText = `${(profitPercentage * 100).toFixed(1)}%`;
  }

  const tradeBtn = document.getElementById('executeTradeBtn');
  
  if (tradeBtn) {
    if (isWeekend) {
      tradeBtn.innerText = "MARCHÉ FERMÉ (WEEK-END)";
      tradeBtn.style.backgroundColor = "#ef4444";
      tradeBtn.style.color = "#ffffff";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
      return;
    }

    if (hasTradedToday) {
      tradeBtn.innerText = "POSITION DÉJÀ EXÉCUTÉE AUJOURD'HUI";
      tradeBtn.style.backgroundColor = "#475569";
      tradeBtn.style.color = "#94a3b8";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
      return;
    }

    if (currentHour < 18) {
      tradeBtn.innerText = "SIGNAL FERMÉ (OUVERTURE À 18H00)";
      tradeBtn.style.backgroundColor = "#334155";
      tradeBtn.style.color = "#94a3b8";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
    } else if (currentHour >= 20) {
      tradeBtn.innerText = "SIGNAL FERMÉ (DISPONIBLE DEMAIN À 18H00)";
      tradeBtn.style.backgroundColor = "#334155";
      tradeBtn.style.color = "#94a3b8";
      tradeBtn.style.cursor = "not-allowed";
      tradeBtn.disabled = true;
    } else {
      tradeBtn.innerText = "CONFIRMER L'OUVERTURE DE LA POSITION";
      tradeBtn.style.backgroundColor = "#eab308";
      tradeBtn.style.color = "#000000";
      tradeBtn.style.cursor = "pointer";
      tradeBtn.disabled = false;
    }
  }
}

// --- AFFICHAGE UNIFIÉ DE L'HISTORIQUE ---
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
