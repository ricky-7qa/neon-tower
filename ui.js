  /** MENUS & HUD **/
  const DEVICE_MODE_KEY = 'neonTowerDeviceMode';

  const visibleUpgradeKeys = {
    ATTACK: ['damage', 'speed', 'critC', 'critD', 'multishot'],
    DEFENSE: ['hp', 'regen'],
    UTILITY: ['range', 'cashBonus', 'waveBonus', 'bossBounty']
  };
  const isVisibleUpgrade = key => Object.values(visibleUpgradeKeys).some(keys => keys.includes(key));

  function applyDeviceMode(mode) {
    const app = document.getElementById('app');
    app.classList.remove('device-desktop', 'device-mobile');
    app.classList.add(mode === 'mobile' ? 'device-mobile' : 'device-desktop');
    const label = document.getElementById('menu-device-label');
    if (label) label.textContent = mode === 'mobile' ? 'MOBILE MODE' : 'DESKTOP MODE';
  }

  function selectDeviceMode(mode) {
    if (mode !== 'desktop' && mode !== 'mobile') return;
    localStorage.setItem(DEVICE_MODE_KEY, mode);
    applyDeviceMode(mode);
    document.getElementById('device-select').classList.remove('active-layer');
    document.getElementById('menu').classList.add('active-layer');
    switchTab('workshop');
  }

  function changeDeviceMode() {
    document.getElementById('menu').classList.remove('active-layer');
    document.getElementById('device-select').classList.add('active-layer');
  }

  function initializeDeviceMode() {
    const savedMode = localStorage.getItem(DEVICE_MODE_KEY);
    if (savedMode === 'desktop' || savedMode === 'mobile') {
      applyDeviceMode(savedMode);
      document.getElementById('device-select').classList.remove('active-layer');
      document.getElementById('menu').classList.add('active-layer');
    }
  }

  
  function formatPlayerStatTime(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0 ? hours + 'h ' + minutes + 'm' : minutes + 'm ' + seconds + 's';
  }

  function renderPlayerStats() {
    const grid = document.getElementById('player-stats-grid');
    if (!grid) return;
    const number = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
    const stats = [
      { label:'BEST WAVE', value:number(player.highestWave), note:'Highest wave reached' },
      { label:'TOTAL KILLS', value:number(player.totalKills), note:'Enemies eliminated across all runs' },
      { label:'TOTAL PLAYTIME', value:formatPlayerStatTime(player.playTime), note:'Time spent actively playing' },
      { label:'TOTAL RUNS', value:number(player.runsPlayed), note:'Runs completed' },
      { label:'BOSSES DEFEATED', value:number(player.bossKills), note:'Bosses defeated across all runs' },
      { label:'BEST RUN KILLS', value:number(player.bestKills), note:'Most enemies eliminated in one run' },
      { label:'LONGEST RUN', value:formatPlayerStatTime(player.bestDuration), note:'Longest single run' }
    ];
    grid.innerHTML = stats.map(stat => '<article class="player-stat-card"><span class="player-stat-label">' + stat.label + '</span><strong class="player-stat-value">' + stat.value + '</strong><small class="player-stat-note">' + stat.note + '</small></article>').join('');
  }

  function updateMenuUI() {
    if (typeof completeSpeed3Fabrication === 'function') completeSpeed3Fabrication();
    document.getElementById('menu-coins').innerText = '$' + formatMoney(player.coins);
    document.getElementById('menu-wave').innerText = player.highestWave;
    renderPlayerStats();
    
    let ws = document.getElementById('ws-grid'); ws.innerHTML = "";
    ['ATTACK','DEFENSE','UTILITY'].forEach(category=>{
      const section=document.createElement('section'); section.className='workshop-section';
      section.innerHTML='<h2 class="workshop-heading">'+category+'</h2><div class="grid workshop-grid"></div>';
      const grid=section.querySelector('.grid');
      Object.keys(statDefs).filter(k=>isVisibleUpgrade(k) && statDefs[k].category===category).forEach(k=>{
        let d=statDefs[k],lvl=player.ws[k]||0,cost=getCost(k,true),val=getVal(k,true),isMax=d.max&&lvl>=d.max;
        grid.insertAdjacentHTML('beforeend',`<div class="card">
          <div><h3><span style="color:${d.col}">${d.n}</span><span>LVL ${lvl}${d.max?' / '+d.max:''}</span></h3><p>${d.d}<br><br><span style="color:#fff;">Current: ${val}</span></p></div>
          <button class="btn btn-gold" ${player.coins<cost||isMax?'disabled':''} onclick="buyWs('${k}')">${isMax?'MAX LEVEL':`UPGRADE · $${formatMoney(cost)}`}</button>
        </div>`);
      });
      if (category === 'UTILITY') {
        const speedLevel = Math.max(0, Math.min(3, Number(player.speedControlLevel) || 0));
        const craftStartedAt = Number(player.speed3CraftStartedAt) || 0;
        const craftRemaining = craftStartedAt ? Math.max(0, 86400000 - (Date.now() - craftStartedAt)) : 0;
        const craftHours = Math.ceil(craftRemaining / 3600000);
        const isCraftingSpeed3 = speedLevel === 2 && craftStartedAt > 0 && craftRemaining > 0;
        const speedUpgrades = [
          { level:1, name:'FAST FORWARD I', effect:'Unlocks 1.5x game speed. Requires reaching Wave 50.', cost:1500, wave:50 },
          { level:2, name:'FAST FORWARD II', effect:'Unlocks 2x game speed. Requires reaching Wave 100.', cost:5000, wave:100 },
          { level:3, name:'FAST FORWARD III', effect:'Unlocks 3x game speed. Requires reaching Wave 150. Fabrication takes 24 hours.', cost:10000, wave:150 }
        ];
        const speedSection = document.createElement('div');
        speedSection.className = 'card speed-control-card';
        speedSection.innerHTML = '<div><h3><span style="color:#ffd700">SPEED CONTROL</span><span>LEVEL '+speedLevel+'/3</span></h3><p>Reach the required wave to purchase each permanent speed upgrade. Fast Forward III takes 24 hours to fabricate. Boss fights always remain at 1x.</p></div>' +
          speedUpgrades.map(item => {
            const owned = speedLevel >= item.level;
            const crafting = item.level === 3 && isCraftingSpeed3;
            const available = speedLevel === item.level - 1 && !craftStartedAt && player.highestWave >= item.wave;
            const waveLocked = player.highestWave < item.wave;
            const label = owned ? 'UNLOCKED' : crafting ? 'FABRICATING · '+craftHours+'H LEFT' : waveLocked ? 'REACH WAVE '+item.wave : available ? 'UNLOCK · $' + formatMoney(item.cost) : 'LOCKED';
            return '<button class="btn btn-gold speed-upgrade-btn" '+(!available || player.coins < item.cost ? 'disabled' : '')+' onclick="buySpeedControl('+item.level+')">'+item.name+' · '+label+'</button>';
          }).join('');
        grid.appendChild(speedSection);
      }
      ws.appendChild(section);
    });

    let ach = document.getElementById('achv-grid'); ach.innerHTML = "";
    achvDefs.forEach(a => {
      const earned = a.tiers.filter((tier,i) => player.achievements.includes(a.id+'_'+(i+1)) || (a.id==='waves' && i===1 && player.achievements.includes('w10')) || (a.id==='waves' && i===2 && player.achievements.includes('w30')) || (a.id==='kills' && i===1 && player.achievements.includes('k100'))).length;
      const next = a.tiers[earned];
      const metric = a.metric();
      const currentText = a.format ? a.format(metric) : metric.toLocaleString('en-US');
      const targetText = next ? (a.format ? a.format(next.value) : next.value.toLocaleString('en-US')) : 'MAX';
      const stars = '★'.repeat(earned) + '☆'.repeat(5-earned);
      const progress = next ? Math.min(100, metric / next.value * 100) : 100;
      ach.insertAdjacentHTML('beforeend', `<article class="card achievement-card ${earned===5?'achievement-max':''}">
        <div class="achievement-head"><div><span class="achievement-kicker">PROGRESS ${earned}/5</span><h3>${a.n}</h3></div><span class="achievement-stars" aria-label="${earned} out of 5 stars">${stars}</span></div>
        <p>${a.d}</p>
        <div class="achievement-progress"><span style="width:${progress}%"></span></div>
        <div class="achievement-foot"><span>${currentText} / ${targetText}</span><strong>${next ? '+'+next.reward+' COINS' : 'COMPLETED'}</strong></div>
      </article>`);
    });
  }

  function buildSkillTree() {
    const container = document.getElementById('skill-tree-container');
    const skills = Object.values(skillDefs);
    const positions = {
      start:[460,38],
      multishot:[260,178], shield:[660,178],
      missiles:[120,345], lasers:[360,345], thorn:[560,345], vampire:[800,345],
      drone:[120,535], overdrive:[360,535], fortify:[560,535]
    };
    const links = skills.filter(s=>s.req).map(s=>{
      const [x1,y1]=positions[s.req], [x2,y2]=positions[s.id];
      const active=hasSkill(s.req)&&hasSkill(s.id);
      const midY=(y1+y2)/2;
      return '<path class="skill-branch '+(active?'is-lit':'')+'" d="M '+x1+' '+(y1+37)+' V '+midY+' H '+x2+' V '+(y2-37)+'"/>';
    }).join('');
    const effects = {
      start:'Unlocks the tower core systems.',
      multishot:'Improves Multi-Shot projectile guidance and homing speed.',
      missiles:'Launches a homing missile about every 2 seconds. It deals area damage.',
      lasers:'Fires a piercing laser for 0.5 seconds every 4 seconds.',
      shield:'Blocks one hit and recharges after a cooldown.',
      thorn:'Reflects 50% of collision damage back to the attacker.',
      drone:'Fires an extra homing projectile every 3 seconds.',
      overdrive:'Increases attack speed by 25%.',
      vampire:'Restores 2% of maximum health after every kill.',
      fortify:'Reduces incoming damage by 10%.'
    };
    const icons={start:'◆',multishot:'⟡',missiles:'➤',lasers:'ϟ',shield:'⬡',thorn:'✧',drone:'◉',overdrive:'⚡',vampire:'✚',fortify:'⬢'};
    container.innerHTML =
      '<div class="skill-intro"><span class="eyebrow">PERMANENT UPGRADES</span><h2>Skill Tree</h2><p>Build your tower by unlocking connected systems. Choose your path and power up each branch.</p><div class="skill-wallet">YOUR COINS: <strong>'+formatMoney(player.coins)+'</strong></div></div>'+
      '<div class="skill-tree-viewport"><div class="skill-tree-map"><svg class="skill-branches" viewBox="0 0 920 630" aria-hidden="true">'+links+'</svg>'+
      skills.map(s=>{
        const unlocked=hasSkill(s.id);
        const available=!unlocked&&(s.req===null||hasSkill(s.req));
        const locked=!unlocked&&!available;
        const [x,y]=positions[s.id];
        const status=unlocked?'UNLOCKED':locked?'LOCKED':'AVAILABLE';
        const requirement=s.req?'Requires '+skillDefs[s.req].n:(s.id==='start'?'Starting node':'No requirement');
        const action=unlocked?'<span class="skill-status done">✓ UNLOCKED</span>':
          locked?'<button class="btn skill-buy" disabled>LOCKED</button>':
          '<button class="btn btn-gold skill-buy" '+(player.coins<s.cost?'disabled':'')+' onclick="buySkill(\''+s.id+'\')">'+(s.cost===0?'UNLOCK FREE':player.coins<s.cost?'NEED '+formatMoney(s.cost-player.coins):'UNLOCK · '+formatMoney(s.cost))+'</button>';
        return '<article class="skill-node-card '+(unlocked?'is-unlocked':'')+' '+(available?'is-available':'')+' '+(locked?'is-locked':'')+'" style="--node-x:'+x+'px;--node-y:'+y+'px">'+
          '<div class="skill-node-icon">'+icons[s.id]+'</div><div class="skill-node-copy"><span class="skill-node-status">'+status+'</span><h3>'+s.n+'</h3><p>'+effects[s.id]+'</p><small>'+requirement+'</small></div><div class="skill-node-footer"><strong>'+(s.cost===0?'FREE':formatMoney(s.cost)+' COINS')+'</strong>'+action+'</div></article>';
      }).join('')+'</div></div>'+
      '<div class="skill-tree-legend"><span><i class="legend-dot unlocked"></i> Unlocked</span><span><i class="legend-dot available"></i> Available</span><span><i class="legend-dot locked"></i> Locked</span></div>';
  }
  function buyWs(k) { if (!isVisibleUpgrade(k)) return; let c=getCost(k,true); if(player.coins>=c && (!statDefs[k].max || (player.ws[k]||0)<statDefs[k].max)){player.coins-=c;player.ws[k]=(player.ws[k]||0)+1;saveGame();} }
  function buySpeedControl(level) {
    const currentLevel = Math.max(0, Math.min(3, Number(player.speedControlLevel) || 0));
    const nextLevel = currentLevel + 1;
    const costs = {1:1500, 2:5000, 3:10000};
    const requiredWaves = {1:50, 2:100, 3:150};
    if (level !== nextLevel || !costs[level] || player.highestWave < requiredWaves[level] || player.coins < costs[level]) return;
    if (level === 3 && Number(player.speed3CraftStartedAt)) return;
    player.coins -= costs[level];
    if (level === 3) player.speed3CraftStartedAt = Date.now();
    else player.speedControlLevel = level;
    saveGame();
    if (typeof updateGameSpeedButton === 'function') updateGameSpeedButton();
    if (typeof updateMenuUI === 'function') updateMenuUI();
    AudioSys.coin();
  }
  function buySkill(id) {
    let s = skillDefs[id]; if(hasSkill(id)) return;
    if(player.coins >= s.cost) { player.coins -= s.cost; player.skills.push(id); saveGame(); buildSkillTree(); AudioSys.coin(); }
  }

  function openGameSettings() {
    const panel = document.getElementById('game-settings-panel');
    if (!panel) return;
    const soundButton = document.getElementById('settings-sound-toggle');
    if (soundButton) soundButton.textContent = AudioSys.enabled ? 'SOUND · ON' : 'SOUND · OFF';
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }
  function closeGameSettings() {
    const panel = document.getElementById('game-settings-panel');
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  function toggleGameSound() {
    const enabled = AudioSys.setEnabled(!AudioSys.enabled);
    const soundButton = document.getElementById('settings-sound-toggle');
    if (soundButton) soundButton.textContent = enabled ? 'SOUND · ON' : 'SOUND · OFF';
  }
  function goBackToMenu() {
    if (!game || !game.running) return;
    const confirmed = window.confirm('RETURN TO THE MAIN MENU? Your current run will be saved so you can continue it later.');
    if (!confirmed) return;
    const choicePanel = document.getElementById('perk-choice');
    const choiceOpen = !!(choicePanel && choicePanel.classList.contains('visible'));
    const pendingDecision = choiceOpen && !!choicePanel.querySelector('.decision-dialog');
    const pendingPerk = choiceOpen && !pendingDecision;
    if (typeof window.saveRunCheckpoint === 'function') {
      window.saveRunCheckpoint(pendingPerk, pendingDecision);
    }
    game.running = false;
    closeGameSettings();
    if (choicePanel) choicePanel.classList.remove('visible');
    document.getElementById('gameover').classList.remove('active-layer');
    document.getElementById('hud').classList.remove('active-hud');
    document.getElementById('menu').classList.add('active-layer');
    saveGame();
    if (typeof window.refreshResumeUI === 'function') window.refreshResumeUI();
    updateMenuUI();
  }
  window.openGameSettings = openGameSettings;
  window.closeGameSettings = closeGameSettings;
  window.toggleGameSound = toggleGameSound;
  window.goBackToMenu = goBackToMenu;

  let activeUpgCategory = 'ATTACK';

  function switchUpgCategory(category) {
    if (!['ATTACK','DEFENSE','UTILITY'].includes(category)) return;
    activeUpgCategory = category;
    document.querySelectorAll('.upg-tab').forEach(tab => {
      const active = tab.dataset.category === category;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('upg-category-title').innerText = category + ' UPGRADES';
    document.querySelectorAll('.upg-btn').forEach(btn => {
      btn.style.display = isVisibleUpgrade(btn.dataset.stat) && statDefs[btn.dataset.stat].category === category ? 'flex' : 'none';
    });
  }

  function initUpgBar() {
    let ub = document.getElementById('upg-content'); ub.innerHTML = "";
    Object.keys(statDefs).filter(isVisibleUpgrade).forEach(k => {
      let btn = document.createElement("button");
      btn.className = "btn upg-btn";
      btn.id = "btn-upg-" + k;
      btn.dataset.stat = k;
      btn.onclick = () => buyRunUpg(k);
      ub.appendChild(btn);
    });
    switchUpgCategory('ATTACK');
  }

  function updateHUD() {
    document.getElementById('hud-wave').innerText = run.wave;
    document.getElementById('hud-timer').innerText = game.toSpawn + game.ents.e.length;
    document.getElementById('hud-cash').innerText = '$' + formatMoney(run.cash);
    document.getElementById('hud-coins').innerText = '$' + formatMoney(run.coins);

    if (tower) {
      const perkDamage = 1 + (getPerkValue('power') + getPerkValue('overload')) / 100;
      const overloadSpeed = Object.entries(run.perks?.overload || {}).reduce((sum,[rarity,count])=>sum+(perkDefs.find(p=>p.id==='overload').speedValues[rarity]||0)*count,0);
      const perkFireRate = 1 + (getPerkValue('rapid') + overloadSpeed) / 100;
      const perkRange = 1 + getPerkValue('radar') / 100;
      const baseRegen = parseFloat(getVal('regen')) + parseFloat(getVal('nanoMatrix'));
      const totalRegen = baseRegen * (1 + getPerkValue('repair') / 100);
      const cashBonus = (parseFloat(getVal('cashBonus')) + getPerkValue('fortune'));
      document.getElementById('st-dmg').innerText = Math.round(parseFloat(getVal('damage')) * perkDamage);
      document.getElementById('st-spd').innerText = (parseFloat(getVal('speed')) * perkFireRate).toFixed(2).replace(/\\.00$/, '').replace(/0$/, '') + '/s';
      document.getElementById('st-hp').innerText = `${Math.ceil(Math.max(0, tower.hp))} / ${getVal('hp')}`;
      document.getElementById('st-reg').innerText = totalRegen.toFixed(1).replace(/\\.0$/, '') + '/s';
      document.getElementById('st-range').innerText = Math.round(parseFloat(getVal('range')) * perkRange);
      document.getElementById('st-cashbonus').innerText = '+' + cashBonus.toFixed(0) + '%';
    }

    const tui = document.getElementById('target-ui');
    const bossEnemy = game?.ents?.e?.find(enemy => enemy.type === 'Boss' && enemy.hp > 0);
    if(bossEnemy) {
       tui.classList.add('visible');
       document.getElementById('t-name').innerText = 'BOSS';
       const hpPct = Math.max(0, (bossEnemy.hp / bossEnemy.maxHp) * 100);
       document.getElementById('t-hp-fill').style.width = hpPct + '%';
       document.getElementById('t-hp-text').innerText = `${Math.ceil(Math.max(0, bossEnemy.hp))} / ${Math.ceil(bossEnemy.maxHp)} HP`;
    } else {
       tui.classList.remove('visible');
    }

    Object.keys(statDefs).filter(isVisibleUpgrade).forEach(k => {
      const d=statDefs[k], l=run.stats[k]||0, c=getCost(k, false), m=!!(d.max && (player.ws[k]||0)+l>=d.max);
      const btn=document.getElementById('btn-upg-'+k);
      if(btn) {
        const unlockWave=d.unlockWave||1;
        const waveLocked=run.wave<unlockWave;
        btn.disabled=waveLocked || (run.cash<c) || m;
        const label=waveLocked ? 'LOCKED · WAVE '+unlockWave : m ? 'MAX' : '$'+formatMoney(c);
        btn.innerHTML=`<span style="color:${d.col}">${d.n} · LVL ${Math.min(d.max||999,(player.ws[k]||0)+l)}</span><span style="color:${waveLocked?'#ffb45c':'#0f0'}">${label}</span>`;
      }
    });
  }

  function buyRunUpg(k) {
    if (!isVisibleUpgrade(k)) return;
    const d=statDefs[k];
    if(!d || run.wave<(d.unlockWave||1)) return;
    const c=getCost(k,false);
    if(run.cash>=c && (!d.max || (player.ws[k]||0)+(run.stats[k]||0)<d.max)) {
      run.cash-=c;
      run.stats[k]=(run.stats[k]||0)+1;
      if(k==='hp') {
        const oldMax=tower.maxHp;
        tower.maxHp=parseFloat(getVal('hp'));
        tower.hp+=(tower.maxHp-oldMax);
      }
      updateHUD();
      AudioSys.coin();
      if (typeof window.saveRunCheckpoint === 'function') window.saveRunCheckpoint(false);
    }
  }



  const LEADERBOARD_URL = 'https://iioagfxyzfxyoifjclgw.supabase.co';
  const LEADERBOARD_KEY = 'sb_publishable_Xop-cOuasc5PmiD3e4ed5A_hWr-mclf';
  const LEADERBOARD_NAME_KEY = 'neonTowerLeaderboardName';
  let leaderboardClient = null;
  let leaderboardPlayerId = '';
  let leaderboardSession = null;
  let passwordRecoveryPending = false;
  let authMode = 'signup';

  function escapeLeaderboardText(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function initializeLeaderboard() {
    if (!window.supabase || !window.supabase.createClient) {
      setAuthStatus('ACCOUNT SERVICE UNAVAILABLE. PLEASE TRY AGAIN LATER.');
      return;
    }
    leaderboardClient = window.supabase.createClient(LEADERBOARD_URL, LEADERBOARD_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    if (!cloudNetworkListenersBound) {
      window.addEventListener('offline', () => {
        if (leaderboardSession) setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
      });
      window.addEventListener('online', () => {
        if (!leaderboardSession) return;
        if (cloudSaveReady) {
          setCloudSyncStatus('syncing', 'CONNECTION RESTORED — SYNCING...');
          persistNeonCloudSave();
        } else {
          setCloudSyncStatus('warning', 'CONNECTION RESTORED — RELOAD TO SYNC SAFELY');
        }
      });
      cloudNetworkListenersBound = true;
    }
    leaderboardClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') passwordRecoveryPending = true;
      setLeaderboardSession(session);
      if (event === 'PASSWORD_RECOVERY') { setAuthMode('recovery'); showLeaderboardView(); }
    });
    leaderboardClient.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      passwordRecoveryPending = window.location.hash.includes('type=recovery') || window.location.search.includes('auth=recovery');
      setLeaderboardSession(data.session);
      if (passwordRecoveryPending) { setAuthMode('recovery'); showLeaderboardView(); }
    }).catch(error => {
      console.error('Auth session check failed:', error);
      setAuthStatus('COULD NOT CHECK YOUR ACCOUNT. PLEASE REFRESH.');
    });
  }

  function setLeaderboardSession(session) {
    leaderboardSession = session && session.user ? session : null;
    leaderboardPlayerId = leaderboardSession ? leaderboardSession.user.id : '';
    if (leaderboardSession) {
      initializeNeonCloudSave(leaderboardSession);
    } else {
      cloudSaveReady = false;
      cloudSaveUserId = '';
      cloudSaveLoadingUserId = '';
      cloudSavePendingOffline = false;
      setCloudSyncStatus('signed-out', 'NOT SIGNED IN — CLOUD SAVE DISABLED');
      if (cloudSaveTimer) { clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
    }
    const nameInput = document.getElementById('leaderboard-name');
    if (nameInput && leaderboardSession) {
      const accountName = String(leaderboardSession.user.user_metadata?.display_name || '').trim();
      const savedName = localStorage.getItem(LEADERBOARD_NAME_KEY);
      const currentName = accountName || savedName || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase());
      nameInput.value = currentName;
      if (accountName) localStorage.setItem(LEADERBOARD_NAME_KEY, accountName);
    }
    const tab = document.getElementById('tab-leaderboard');
    if (tab && tab.style.display !== 'none') showLeaderboardView();
  }

  let cloudSaveUserId = '';
  let cloudSaveLoadingUserId = '';
  let cloudSaveReady = false;
  let cloudSaveTimer = null;
  let cloudSaveWriteQueue = Promise.resolve();
  let cloudNetworkListenersBound = false;
  let cloudSavePendingOffline = false;

  function setCloudSyncStatus(state, message) {
    const status = document.getElementById('cloud-sync-status');
    if (!status) return;
    status.dataset.state = state;
    status.textContent = message;
  }

  function scheduleNeonCloudSave() {
    if (!leaderboardSession || !leaderboardPlayerId) return;
    if (!navigator.onLine) {
      if (cloudSaveReady) cloudSavePendingOffline = true;
      setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
      return;
    }
    if (!cloudSaveReady) return;
    setCloudSyncStatus('syncing', 'SAVE QUEUED — SYNCING...');
    if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => {
      cloudSaveTimer = null;
      persistNeonCloudSave();
    }, 900);
  }
  window.scheduleNeonCloudSave = scheduleNeonCloudSave;

  function persistNeonCloudSave() {
    if (!cloudSaveReady || !leaderboardSession || !leaderboardPlayerId || !window.getNeonTowerCloudSave) return;
    if (!navigator.onLine) {
      cloudSavePendingOffline = true;
      setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
      return;
    }
    const userId = leaderboardPlayerId;
    setCloudSyncStatus('syncing', 'SYNCING YOUR PROGRESS...');
    const snapshot = window.getNeonTowerCloudSave();
    cloudSaveWriteQueue = cloudSaveWriteQueue.then(async () => {
      if (!leaderboardSession || leaderboardPlayerId !== userId) return;
      const { error } = await leaderboardClient.from('player_cloud_saves').upsert({
        user_id: userId,
        player_data: snapshot.player,
        run_checkpoint: snapshot.checkpoint,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      if (leaderboardPlayerId === userId) {
        cloudSavePendingOffline = false;
        setCloudSyncStatus('saved', 'CLOUD SYNCED — ALL PROGRESS SAVED');
      }
    }).catch(error => {
      console.error('Cloud save failed:', error);
      if (leaderboardPlayerId === userId) {
        if (!navigator.onLine) {
          cloudSavePendingOffline = true;
          setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
        } else {
          setCloudSyncStatus('error', 'CLOUD SYNC FAILED — YOUR LOCAL PROGRESS IS SAFE');
        }
      }
    });
  }

  async function initializeNeonCloudSave(session) {
    const userId = session && session.user ? session.user.id : '';
    if (!userId || !leaderboardClient || !window.getNeonTowerCloudSave) return;
    if (cloudSaveUserId === userId && (cloudSaveReady || cloudSaveLoadingUserId === userId)) return;
    cloudSaveUserId = userId;
    cloudSaveLoadingUserId = userId;
    cloudSaveReady = false;
    if (cloudSaveTimer) { clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
    if (!navigator.onLine) {
      setCloudSyncStatus('offline', 'OFFLINE — SIGN IN AGAIN WHEN CONNECTED TO SYNC');
      return;
    }
    setCloudSyncStatus('syncing', 'LOADING YOUR CLOUD SAVE...');
    setAuthStatus('SYNCING YOUR CLOUD SAVE...');
    try {
      const { data, error } = await leaderboardClient
        .from('player_cloud_saves')
        .select('user_id, player_data, run_checkpoint')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!leaderboardSession || leaderboardPlayerId !== userId) return;
      if (data) {
        window.applyNeonTowerCloudSave({ player: data.player_data, checkpoint: data.run_checkpoint });
      } else {
        const localSnapshot = window.getNeonTowerCloudSave();
        const { error: insertError } = await leaderboardClient.from('player_cloud_saves').insert({
          user_id: userId,
          player_data: localSnapshot.player,
          run_checkpoint: localSnapshot.checkpoint,
          updated_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
      }
      cloudSaveReady = true;
      cloudSaveLoadingUserId = '';
      cloudSavePendingOffline = false;
      setCloudSyncStatus('saved', 'CLOUD SYNCED — ALL PROGRESS SAVED');
      setAuthStatus('CLOUD SAVE SYNCED. YOUR PROGRESS IS LINKED TO THIS ACCOUNT.');
      // Publish the existing local/cloud personal best before refreshing the leaderboard.
      if (typeof submitLeaderboardResult === 'function' && Number(player?.highestWave || 0) > 15) {
        await submitLeaderboardResult({
          wave: player.highestWave,
          kills: player.bestKills || 0,
          bossKills: player.bestBosses || 0,
          elapsed: player.bestDuration || 0
        });
      }
      if (document.getElementById('tab-leaderboard')?.style.display !== 'none') {
        await loadLeaderboard();
      }
    } catch (error) {
      console.error('Cloud save initialization failed:', error);
      cloudSaveReady = false;
      cloudSaveLoadingUserId = '';
      if (leaderboardPlayerId === userId) {
        if (!navigator.onLine) setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
        else setCloudSyncStatus('error', 'CLOUD SAVE UNAVAILABLE — LOCAL PROGRESS IS SAFE');
        setAuthStatus('CLOUD SAVE UNAVAILABLE. PLEASE REFRESH AND TRY AGAIN.');
      }
    }
  }

  function showLeaderboardView() {
    const authPanel = document.getElementById('leaderboard-auth');
    const boardPanel = document.getElementById('leaderboard-content');
    const signedIn = !!leaderboardSession && !passwordRecoveryPending;
    if (authPanel) authPanel.style.display = signedIn ? 'none' : 'block';
    if (boardPanel) boardPanel.style.display = signedIn ? 'block' : 'none';
    if (signedIn) {
      const account = document.getElementById('leaderboard-account-email');
      if (account) account.textContent = leaderboardSession.user.email || 'SIGNED IN';
      const nameInput = document.getElementById('leaderboard-name');
      if (nameInput && !nameInput.value) {
        const savedName = localStorage.getItem(LEADERBOARD_NAME_KEY);
        nameInput.value = savedName || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase());
      }
      loadLeaderboard();
    } else {
      renderAuthMode();
    }
  }

  function switchTab(t) {
    ['workshop', 'skills', 'achievements', 'player-stats', 'leaderboard'].forEach(x => {
      const tab = document.getElementById('tab-'+x);
      tab.style.display = (x===t?'flex':'none');
      if (x===t) tab.scrollTop = 0;
    });
    if (t==='skills') buildSkillTree();
    if (t==='leaderboard') showLeaderboardView();
  }

  function setLeaderboardStatus(message) {
    const status = document.getElementById('leaderboard-status');
    if (status) status.textContent = message;
  }

  function setAuthStatus(message) {
    const status = document.getElementById('leaderboard-auth-status');
    if (status) status.textContent = message;
  }

  function setAuthMode(mode) {
    authMode = mode;
    renderAuthMode();
  }

  function renderAuthMode() {
    const confirm = document.getElementById('auth-confirm-password');
    const password = document.getElementById('auth-password');
    const passwordLabel = document.getElementById('auth-password-label');
    const submit = document.getElementById('auth-submit');
    const tabs = document.getElementById('auth-mode-tabs');
    const forgot = document.getElementById('auth-forgot');
    const resetNote = document.getElementById('auth-reset-note');
    if (!submit) return;
    const recovery = authMode === 'recovery';
    if (confirm) confirm.style.display = authMode === 'signup' ? 'block' : 'none';
    if (password) password.style.display = recovery ? 'none' : 'block';
    if (passwordLabel) passwordLabel.style.display = recovery ? 'none' : 'block';
    if (submit) submit.textContent = recovery ? 'SAVE NEW PASSWORD' : (authMode === 'signup' ? 'CREATE ACCOUNT' : 'LOG IN');
    if (tabs) tabs.style.display = recovery ? 'none' : 'flex';
    if (forgot) forgot.style.display = authMode === 'login' ? 'inline-flex' : 'none';
    if (resetNote) resetNote.style.display = recovery ? 'block' : 'none';
    const newPassword = document.getElementById('auth-new-password');
    if (newPassword) newPassword.style.display = recovery ? 'block' : 'none';
    const email = document.getElementById('auth-email');
    if (email) email.style.display = recovery ? 'none' : 'block';
    setAuthStatus(recovery ? 'CHOOSE A NEW PASSWORD FOR YOUR ACCOUNT.' : (authMode === 'signup' ? 'CREATE AN ACCOUNT TO ENTER THE GLOBAL LEADERBOARD.' : 'LOG IN TO ACCESS YOUR GLOBAL RANKING.'));
  }

  async function submitLeaderboardAuth() {
    if (!leaderboardClient) return setAuthStatus('ACCOUNT SERVICE UNAVAILABLE.');
    const email = (document.getElementById('auth-email')?.value || '').trim();
    const password = document.getElementById('auth-password')?.value || '';
    if (authMode === 'recovery') return saveRecoveredPassword();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthStatus('ENTER A VALID EMAIL ADDRESS.');
    if (password.length < 8) return setAuthStatus('PASSWORD MUST HAVE AT LEAST 8 CHARACTERS.');
    try {
      if (authMode === 'signup') {
        const confirm = document.getElementById('auth-confirm-password')?.value || '';
        if (password !== confirm) return setAuthStatus('PASSWORDS DO NOT MATCH.');
        const { data, error } = await leaderboardClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
        if (!data.session) {
          setAuthStatus('ACCOUNT CREATED, BUT EMAIL CONFIRMATION IS STILL ENABLED. DISABLE IT IN SUPABASE TO LOG IN WITHOUT EMAIL.');
        } else {
          setAuthStatus('ACCOUNT CREATED. OPENING YOUR ACCOUNT...');
          setLeaderboardSession(data.session);
        }
      } else {
        const { data, error } = await leaderboardClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthStatus('LOGGED IN. OPENING YOUR ACCOUNT...');
        setLeaderboardSession(data.session);
      }
    } catch (error) {
      console.error('Leaderboard authentication failed:', error);
      setAuthStatus(authErrorMessage(error));
    }
  }

  function authErrorMessage(error) {
    const message = String(error && error.message || '').toLowerCase();
    if (message.includes('already registered') || message.includes('already been registered')) return 'THIS EMAIL ALREADY HAS AN ACCOUNT. TRY LOGGING IN.';
    if (message.includes('invalid login credentials')) return 'EMAIL OR PASSWORD IS INCORRECT.';
    if (message.includes('email not confirmed')) return 'CHECK YOUR EMAIL AND CONFIRM YOUR ACCOUNT FIRST.';
    if (message.includes('rate limit')) return 'TOO MANY ATTEMPTS. PLEASE WAIT A LITTLE AND TRY AGAIN.';
    return error && error.message ? error.message.toUpperCase() : 'SOMETHING WENT WRONG. PLEASE TRY AGAIN.';
  }

  async function sendPasswordReset() {
    if (!leaderboardClient) return setAuthStatus('ACCOUNT SERVICE UNAVAILABLE.');
    const email = (document.getElementById('auth-email')?.value || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthStatus('ENTER YOUR EMAIL ADDRESS FIRST.');
    try {
      const { error } = await leaderboardClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '?auth=recovery'
      });
      if (error) throw error;
      setAuthStatus('IF AN ACCOUNT EXISTS, A PASSWORD RESET EMAIL HAS BEEN SENT.');
    } catch (error) {
      console.error('Password reset request failed:', error);
      setAuthStatus(authErrorMessage(error));
    }
  }

  async function saveRecoveredPassword() {
    if (!leaderboardClient) return setAuthStatus('ACCOUNT SERVICE UNAVAILABLE.');
    const password = document.getElementById('auth-new-password')?.value || '';
    if (password.length < 8) return setAuthStatus('PASSWORD MUST HAVE AT LEAST 8 CHARACTERS.');
    try {
      const { error } = await leaderboardClient.auth.updateUser({ password });
      if (error) throw error;
      passwordRecoveryPending = false;
      setAuthStatus('PASSWORD UPDATED. YOU CAN NOW ACCESS THE LEADERBOARD.');
      setAuthMode('login');
      showLeaderboardView();
    } catch (error) {
      console.error('Password update failed:', error);
      setAuthStatus(authErrorMessage(error));
    }
  }

  async function signOutLeaderboard() {
    if (!leaderboardClient) return;
    const { error } = await leaderboardClient.auth.signOut();
    if (error) {
      setAuthStatus(authErrorMessage(error));
      return;
    }
    setAuthMode('login');
    showLeaderboardView();
  }

  async function saveLeaderboardName() {
    const input = document.getElementById('leaderboard-name');
    const name = (input?.value || '').trim();
    if (!leaderboardSession) return setAuthStatus('LOG IN TO USE THE LEADERBOARD.');
    if (!/^[a-zA-Z0-9 _-]{3,16}$/.test(name)) {
      setLeaderboardStatus('USE 3–16 LETTERS, NUMBERS, SPACES, _ OR -');
      return;
    }
    try {
      const { data: updatedUser, error: profileError } = await leaderboardClient.auth.updateUser({
        data: { display_name: name }
      });
      if (profileError) throw profileError;
      if (updatedUser?.user) leaderboardSession.user = updatedUser.user;
      localStorage.setItem(LEADERBOARD_NAME_KEY, name);
      const { error: rankingError } = await leaderboardClient
        .from('leaderboard_entries')
        .update({ player_name: name })
        .eq('player_id', leaderboardPlayerId);
      if (rankingError) throw rankingError;
      setLeaderboardStatus('PLAYER NAME SAVED TO YOUR ACCOUNT');
      await loadLeaderboard();
    } catch (error) {
      console.error('Leaderboard name update failed:', error);
      setLeaderboardStatus('COULD NOT SAVE PLAYER NAME. PLEASE TRY AGAIN.');
    }
  }

  async function loadLeaderboard() {
    if (!leaderboardClient || !leaderboardSession) return;
    setLeaderboardStatus('UPDATING GLOBAL RANKINGS...');
    const list = document.getElementById('leaderboard-list');
    try {
      const { data, error } = await leaderboardClient
        .from('leaderboard_entries')
        .select('player_id, player_name, best_wave, best_kills, best_bosses, best_duration, updated_at')
        .eq('is_verified', true)
        .order('best_wave', { ascending: false })
        .order('best_kills', { ascending: false })
        .order('best_bosses', { ascending: false })
        .order('best_duration', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!data || !data.length) {
        list.innerHTML = '<div class="leaderboard-empty">NO SCORES YET — BE THE FIRST!</div>';
      } else {
        list.innerHTML = data.map((entry, index) => {
          const own = entry.player_id === leaderboardPlayerId;
          return '<article class="leaderboard-row ' + (own ? 'is-you' : '') + '">' +
            '<span class="leaderboard-rank">#' + (index + 1) + '</span>' +
            '<span class="leaderboard-player"><strong>' + escapeLeaderboardText(entry.player_name) + (own ? ' <small>YOU</small>' : '') + '</strong><small>WAVE ' + entry.best_wave + ' · ' + entry.best_kills + ' KILLS</small></span>' +
            '<span class="leaderboard-result"><strong>' + entry.best_wave + '</strong><small>WAVE</small></span>' +
            '<span class="leaderboard-result"><strong>' + entry.best_kills.toLocaleString('en-US') + '</strong><small>KILLS</small></span>' +
            '</article>';
        }).join('');
      }
      setLeaderboardStatus('GLOBAL TOP 100 · ' + data.length + ' PLAYERS');
    } catch (error) {
      console.error('Leaderboard load failed:', error);
      setLeaderboardStatus('COULD NOT LOAD RANKINGS');
      if (list) list.innerHTML = '<div class="leaderboard-empty">RANKINGS ARE TEMPORARILY UNAVAILABLE. TRY REFRESHING.</div>';
    }
  }

  async function submitLeaderboardResult(result) {
    if (!leaderboardClient || !leaderboardSession || !result) return;
    const name = (String(leaderboardSession.user.user_metadata?.display_name || '').trim() || localStorage.getItem(LEADERBOARD_NAME_KEY) || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase())).trim();
    const completedWave = Math.floor(Number(result.wave) || 0);
    if (completedWave <= 15) {
      setLeaderboardStatus('REACH WAVE 16 TO ENTER THE LEADERBOARD');
      return;
    }
    try {
      const { data: previous, error: readError } = await leaderboardClient
        .from('leaderboard_entries')
        .select('best_wave, best_kills, best_bosses, best_duration')
        .eq('player_id', leaderboardPlayerId)
        .maybeSingle();
      if (readError) throw readError;
      const incoming = {
        best_wave: Math.max(1, Math.floor(Number(result.wave) || 1)),
        best_kills: Math.max(0, Math.floor(Number(result.kills) || 0)),
        best_bosses: Math.max(0, Math.floor(Number(result.bossKills) || 0)),
        best_duration: Math.min(604800, Math.max(0, Math.floor(Number(result.elapsed) || 0)))
      };
      const beatsPrevious = !previous ||
        incoming.best_wave > previous.best_wave ||
        (incoming.best_wave === previous.best_wave && incoming.best_kills > previous.best_kills) ||
        (incoming.best_wave === previous.best_wave && incoming.best_kills === previous.best_kills && incoming.best_bosses > previous.best_bosses) ||
        (incoming.best_wave === previous.best_wave && incoming.best_kills === previous.best_kills && incoming.best_bosses === previous.best_bosses && incoming.best_duration > previous.best_duration);
      if (!beatsPrevious) return;
      const { error } = await leaderboardClient.from('leaderboard_entries').upsert({
        player_id: leaderboardPlayerId,
        player_name: name,
        is_verified: true,
        ...incoming,
        updated_at: new Date().toISOString()
      }, { onConflict: 'player_id' });
      if (error) throw error;
      setLeaderboardStatus('YOUR NEW RECORD WAS SUBMITTED');
    } catch (error) {
      console.error('Leaderboard submit failed:', error);
      setLeaderboardStatus('RECORD COULD NOT BE SUBMITTED');
    }
  }

  loadGame();
  if (typeof window.refreshResumeUI === 'function') window.refreshResumeUI();
  initializeDeviceMode();
  initializeLeaderboard();
