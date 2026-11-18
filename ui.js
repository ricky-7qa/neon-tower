  /** MENUS & HUD **/
  const DEVICE_MODE_KEY = 'neonTowerDeviceMode';

  const visibleUpgradeKeys = {
    ATTACK: ['damage', 'speed', 'critC', 'critD', 'multishot'],
    DEFENSE: ['hp', 'regen', 'defensePercent'],
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
    renderLevelMode();
    document.getElementById('menu-coins').innerText = '$' + formatMoney(player.coins);
    document.getElementById('menu-wave').innerText = player.highestWave;
    renderPlayerStats();
    
    let ws = document.getElementById('ws-grid'); ws.innerHTML = "";
    ['ATTACK','DEFENSE','UTILITY'].forEach(category=>{
      const section=document.createElement('section'); section.className='workshop-section';
      section.innerHTML='<h2 class="workshop-heading">'+category+'</h2><div class="grid workshop-grid"></div>';
      const grid=section.querySelector('.grid');
      Object.keys(statDefs).filter(k=>isVisibleUpgrade(k) && statDefs[k].category===category).forEach(k=>{
        let d=statDefs[k],lvl=player.ws[k]||0,cost=getCost(k,true),val=getVal(k,true),wsMax=d.workshopMax||d.max,isMax=wsMax&&lvl>=wsMax;
        grid.insertAdjacentHTML('beforeend',`<div class="card">
          <div><h3><span style="color:${d.col}">${d.n}</span><span>LVL ${lvl}${wsMax?' / '+wsMax:''}</span></h3><p>${d.d}<br><br><span style="color:#fff;">Current: ${val}</span></p></div>
          <button class="btn btn-gold" ${player.coins<cost||isMax?'disabled':''} onclick="buyWs('${k}')">${isMax?'MAX LEVEL':`UPGRADE · $${formatMoney(cost)}`}</button>
        </div>`);
      });
      if (category === 'UTILITY') {
        const chanceDefs = [
          {category:'ATTACK',name:'ATTACK DROP',description:'Chance to gain one free random Attack upgrade after each wave.',color:'#31dfff'},
          {category:'DEFENSE',name:'DEFENSE DROP',description:'Chance to gain one free random Defense upgrade after each wave.',color:'#66ff9a'},
          {category:'UTILITY',name:'UTILITY DROP',description:'Chance to gain one free random Utility upgrade after each wave.',color:'#ffd45c'}
        ];
        const chanceGrid = document.createElement('div');
        chanceGrid.className = 'free-upgrade-chance-grid';
        chanceGrid.innerHTML = chanceDefs.map(item => {
          const level = Math.max(0, Math.min(50, Number(player.freeUpgradeChances?.[item.category]) || 0));
          const maxed = level >= 50;
          const cost = maxed ? 0 : getFreeUpgradeChanceCost(item.category);
          return '<article class="free-upgrade-chance-card" style="--chance-accent:'+item.color+'">'+
            '<div class="free-upgrade-chance-head"><span class="free-upgrade-orb">✦</span><span class="free-upgrade-level">LVL '+level+'/50</span></div>'+
            '<h3>'+item.name+'</h3><p>'+item.description+'</p>'+
            '<div class="free-upgrade-chance-value">'+level+'% <small>CHANCE / WAVE</small></div>'+
            '<div class="free-upgrade-progress"><span style="width:'+(level/50*100)+'%"></span></div>'+
            '<button class="btn btn-gold free-upgrade-buy" '+(maxed||player.coins<cost?'disabled':'')+' onclick="buyFreeUpgradeChance(\''+item.category+'\')">'+(maxed?'MAX LEVEL':'UPGRADE · $'+formatMoney(cost))+'</button>'+
          '</article>';
        }).join('');
        grid.appendChild(chanceGrid);
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
      start:[460,20],
      multishot:[240,220], shield:[680,220],
      missiles:[120,420], lasers:[350,420], thorn:[570,420], vampire:[800,420],
      drone:[120,620], overdrive:[350,620], fortify:[570,620]
    };
    const links = skills.filter(s=>s.req).map(s=>{
      const [x1,y1]=positions[s.req], [x2,y2]=positions[s.id];
      const active=hasSkill(s.req)&&hasSkill(s.id);
      const midY=(y1+160+y2)/2;
      return '<path class="skill-branch '+(active?'is-lit':'')+'" d="M '+x1+' '+(y1+160)+' V '+midY+' H '+x2+' V '+y2+'"/>';
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
      '<div class="skill-tree-viewport"><div class="skill-tree-map"><svg class="skill-branches" viewBox="0 0 920 800" aria-hidden="true">'+links+'</svg>'+
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
  function buyWs(k) { if (!isVisibleUpgrade(k)) return; const d=statDefs[k],max=d.workshopMax||d.max; let c=getCost(k,true); if(player.coins>=c && (!max || (player.ws[k]||0)<max)){player.coins-=c;player.ws[k]=(player.ws[k]||0)+1;saveGame();} }
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
    const s = skillDefs[id];
    if (!s || hasSkill(id) || (s.req && !hasSkill(s.req))) return;
    const cost = Number(s.cost);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(Number(player.coins)) || Number(player.coins) < cost) return;
    if (!Array.isArray(player.skills)) player.skills = ['start'];
    player.coins = Number(player.coins) - cost;
    player.skills.push(id);
    saveGame();
    buildSkillTree();
    AudioSys.coin();
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
      const d=statDefs[k], l=run.stats[k]||0, c=getCost(k, false), maxLevel=k==='speed'&&run.wave>100?35:d.max, permanentLevel=run.mode==='level'?0:(player.ws[k]||0), m=!!(maxLevel && permanentLevel+l>=maxLevel);
      const btn=document.getElementById('btn-upg-'+k);
      if(btn) {
        const unlockWave=d.unlockWave||1;
        const waveLocked=run.wave<unlockWave;
        btn.disabled=waveLocked || (run.cash<c) || m;
        btn.classList.toggle('is-max-level', m);
        if (m) {
          btn.style.setProperty('border', '2px solid #ffd700', 'important');
          btn.style.setProperty('box-shadow', '0 0 10px rgba(255,215,0,.5), inset 0 0 14px rgba(255,215,0,.12)', 'important');
        } else {
          btn.style.removeProperty('border');
          btn.style.removeProperty('box-shadow');
        }
        const label=waveLocked ? 'LOCKED · WAVE '+unlockWave : m ? 'MAX' : '$'+formatMoney(c);
        const currentEffect=k==='defensePercent'?' · '+getVal(k)+'%':'';
        btn.innerHTML=`<span style="color:${d.col}">${d.n} · LVL ${Math.min(maxLevel||999,permanentLevel+l)}${currentEffect}</span><span style="color:${waveLocked?'#ffb45c':'#0f0'}">${label}</span>`;
      }
    });
  }

  function buyRunUpg(k) {
    if (!isVisibleUpgrade(k)) return;
    const d=statDefs[k];
    if(!d || run.wave<(d.unlockWave||1)) return;
    const c=getCost(k,false);
    const maxLevel=k==='speed'&&run.wave>100?35:d.max;
    const permanentLevel = run.mode === 'level' ? 0 : (player.ws[k] || 0);
    if(run.cash>=c && (!maxLevel || permanentLevel+(run.stats[k]||0)<maxLevel)) {
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
        run_checkpoint: snapshot.checkpoints || snapshot.checkpoint,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      if (leaderboardPlayerId === userId) {
        cloudSavePendingOffline = false;
        setCloudSyncStatus('saved', 'CLOUD SYNCED — ALL PROGRESS SAVED');
        await syncPublicPlayerProfile();
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
        const checkpointPayload = data.run_checkpoint;
        const checkpointSnapshot = checkpointPayload && typeof checkpointPayload === 'object' && ('infinite' in checkpointPayload || 'level' in checkpointPayload)
          ? { checkpoints: checkpointPayload }
          : { checkpoint: checkpointPayload };
        window.applyNeonTowerCloudSave({ player: data.player_data, ...checkpointSnapshot });
      } else {
        const localSnapshot = window.getNeonTowerCloudSave();
        const { error: insertError } = await leaderboardClient.from('player_cloud_saves').insert({
          user_id: userId,
          player_data: localSnapshot.player,
          run_checkpoint: localSnapshot.checkpoints || localSnapshot.checkpoint,
          updated_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
      }
      cloudSaveReady = true;
      cloudSaveLoadingUserId = '';
      cloudSavePendingOffline = false;
      setCloudSyncStatus('saved', 'CLOUD SYNCED — ALL PROGRESS SAVED');
      setAuthStatus('CLOUD SAVE SYNCED. YOUR PROGRESS IS LINKED TO THIS ACCOUNT.');
      claimWeeklyRewards();
      // Sync lifetime personal bests to the global leaderboard only. Historical runs must not enter the current weekly competition.
      if (typeof submitLeaderboardResult === 'function' && Number(player?.highestWave || 0) > 15) {
        await submitLeaderboardResult({
          wave: player.highestWave,
          kills: player.bestKills || 0,
          bossKills: player.bestBosses || 0,
          elapsed: player.bestDuration || 0
        }, { includeWeekly: false });
      }
      await syncPublicPlayerProfile();
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



  const PROFILE_BANNERS = [
    {id:'default',name:'DEFAULT',unlock:0,style:'linear-gradient(110deg,#102b3c,#07121e)'},
    {id:'blue',name:'BLUE',unlock:5,style:'linear-gradient(110deg,#063b83,#071b45,#1d9bff)'},
    {id:'bronze',name:'BRONZE',unlock:10,style:'linear-gradient(110deg,#59351c,#b87537,#3a2115)'},
    {id:'purple',name:'PURPLE',unlock:15,style:'linear-gradient(110deg,#32105e,#8d45d4,#210d43)'},
    {id:'silver',name:'SILVER',unlock:20,style:'linear-gradient(110deg,#465466,#d7e1eb,#657487)'},
    {id:'red',name:'RED',unlock:25,style:'linear-gradient(110deg,#641a25,#e83d50,#3c101b)'},
    {id:'legendary_gold',name:'LEGENDARY GOLD',unlock:30,style:'linear-gradient(110deg,#68460a,#ffd75b,#8c5d08)'}
  ];
  const PROFILE_TITLES = [
    {id:'none',name:'NO TITLE',unlock:0},
    {id:'survivor',name:'SURVIVOR',unlock:10},
    {id:'veteran',name:'VETERAN',unlock:15},
    {id:'elite',name:'ELITE',unlock:20},
    {id:'master',name:'MASTER',unlock:25},
    {id:'neon_legend',name:'NEON LEGEND',unlock:30}
  ];
  function getPlayerCampaignLevel() {
    return Math.max(1, Math.min(30, Number(player.levelMode?.highestUnlocked) || 1));
  }
  function getPlayerName() {
    return String(leaderboardSession?.user?.user_metadata?.display_name || localStorage.getItem(LEADERBOARD_NAME_KEY) || ('Pilot-' + String(leaderboardPlayerId || '0000').slice(0,4).toUpperCase())).trim();
  }
  function renderProfileCard(profile, isOwn = false) {
    const host = document.getElementById('public-player-profile');
    if (!host) return;
    if (!profile) { host.innerHTML = '<div class="leaderboard-empty">PLAYER PROFILE NOT FOUND. THIS PLAYER MAY NOT HAVE CREATED A PROFILE YET.</div>'; return; }
    const banner = PROFILE_BANNERS.find(item => item.id === profile.banner_id) || PROFILE_BANNERS[0];
    const title = PROFILE_TITLES.find(item => item.id === profile.title_id) || PROFILE_TITLES[0];
    const esc = escapeLeaderboardText;
    const started = profile.started_at ? new Date(profile.started_at).toLocaleDateString('en-GB') : '—';
    host.innerHTML = '<article class="public-profile-card">' +
      '<div class="public-profile-banner" style="background:'+banner.style+'"><span>'+esc(banner.name)+' BANNER</span></div>' +
      '<div class="public-profile-identity"><strong>'+esc(profile.player_name)+'</strong><span>'+esc(title.name)+'</span></div>' +
      '<div class="public-profile-level">PLAYER LEVEL <b>'+Number(profile.player_level || 1)+'</b><small>'+Number(profile.levels_completed || 0)+'/30 LEVELS COMPLETED</small></div>' +
      '<div class="public-profile-stats">' +
      '<div><small>BEST INFINITE WAVE</small><b>'+Number(profile.best_infinite_wave || 1).toLocaleString('en-US')+'</b></div>' +
      '<div><small>TOTAL ENEMIES KILLED</small><b>'+Number(profile.total_kills || 0).toLocaleString('en-US')+'</b></div>' +
      '<div><small>TOTAL RUNS</small><b>'+Number(profile.total_runs || 0).toLocaleString('en-US')+'</b></div>' +
      '<div><small>PLAYER SINCE</small><b>'+esc(started)+'</b></div></div>' +
      (isOwn ? '<button class="btn btn-gold profile-customize-button" onclick="switchTab(\'customization\')">CUSTOMIZE PROFILE</button>' : '') +
      '</article>';
  }
  async function loadOwnPublicProfile() {
    const host = document.getElementById('public-player-profile');
    if (!host) return;
    if (!leaderboardClient || !leaderboardSession) {
      host.innerHTML = '<div class="leaderboard-empty">LOG IN THROUGH THE LEADERBOARD TO CREATE AND VIEW YOUR PUBLIC PROFILE.</div>';
      return;
    }
    host.innerHTML = '<div class="leaderboard-empty">LOADING YOUR PROFILE...</div>';
    await syncPublicPlayerProfile();
    const {data,error} = await leaderboardClient.from('player_profiles').select('*').eq('user_id',leaderboardPlayerId).maybeSingle();
    if (error) { console.error('Own profile load failed:',error); host.innerHTML='<div class="leaderboard-empty">PROFILE COULD NOT BE LOADED. TRY AGAIN.</div>'; return; }
    renderProfileCard(data,true);
  }
  async function searchPlayerProfiles() {
    const input = document.getElementById('player-profile-search');
    const results = document.getElementById('player-profile-search-results');
    const term = String(input?.value || '').trim();
    if (!results) return;
    if (term.length < 3) { results.innerHTML='<div class="leaderboard-empty">ENTER AT LEAST 3 CHARACTERS.</div>'; return; }
    if (!leaderboardClient) { results.innerHTML='<div class="leaderboard-empty">PLAYER SEARCH IS UNAVAILABLE.</div>'; return; }
    results.innerHTML='<div class="leaderboard-empty">SEARCHING...</div>';
    const {data,error}=await leaderboardClient.from('player_profiles').select('user_id,player_name,player_level,title_id,banner_id,best_infinite_wave,total_kills').ilike('player_name','%'+term.replace(/[%,_]/g,'')+'%').order('player_level',{ascending:false}).limit(15);
    if(error){console.error('Profile search failed:',error);results.innerHTML='<div class="leaderboard-empty">SEARCH FAILED. PLEASE TRY AGAIN.</div>';return;}
    if(!data?.length){results.innerHTML='<div class="leaderboard-empty">NO PLAYERS FOUND.</div>';return;}
    results.innerHTML=data.map(p=>'<button class="profile-search-result" onclick="openPlayerProfile(\''+p.user_id+'\')"><strong>'+escapeLeaderboardText(p.player_name)+'</strong><span>LEVEL '+Number(p.player_level||1)+' · WAVE '+Number(p.best_infinite_wave||1)+'</span></button>').join('');
  }
  async function openPlayerProfile(userId) {
    if(!/^[0-9a-f-]{36}$/i.test(String(userId))) return;
    switchTab('profile');
    const host=document.getElementById('public-player-profile');
    const results=document.getElementById('player-profile-search-results');
    if(results) results.innerHTML='';
    if(host) host.innerHTML='<div class="leaderboard-empty">LOADING PLAYER PROFILE...</div>';
    const {data,error}=await leaderboardClient.from('player_profiles').select('*').eq('user_id',userId).maybeSingle();
    if(error){console.error('Player profile load failed:',error);if(host)host.innerHTML='<div class="leaderboard-empty">PROFILE COULD NOT BE LOADED.</div>';return;}
    renderProfileCard(data,userId===leaderboardPlayerId);
  }
  async function syncPublicPlayerProfile() {
    if(!leaderboardClient || !leaderboardSession || !leaderboardPlayerId || !cloudSaveReady) return;
    const progress=player.levelMode || {};
    const completed=Array.isArray(progress.completed)?progress.completed:[];
    const payload={
      user_id:leaderboardPlayerId,
      player_name:getPlayerName(),
      banner_id:PROFILE_BANNERS.some(x=>x.id===player.bannerId)?player.bannerId:'default',
      title_id:PROFILE_TITLES.some(x=>x.id===player.titleId)?player.titleId:'none',
      player_level:getPlayerCampaignLevel(),
      levels_completed:Math.min(30,new Set(completed).size),
      best_infinite_wave:Math.max(1,Number(player.highestWave)||1),
      total_kills:Math.min(1000000000,Math.max(0,Math.floor(Number(player.totalKills)||0))),
      total_runs:Math.min(10000000,Math.max(0,Math.floor(Number(player.runsPlayed)||0))),
      updated_at:new Date().toISOString()
    };
    const {error}=await leaderboardClient.from('player_profiles').upsert(payload,{onConflict:'user_id'});
    if(error) console.error('Public profile sync failed:',error);
  }
  function renderCustomization() {
    const host=document.getElementById('customization-content');
    if(!host)return;
    const level=getPlayerCampaignLevel();
    const bannerCards=PROFILE_BANNERS.map(item=>{
      const unlocked=level>=item.unlock, equipped=(player.bannerId||'default')===item.id;
      return '<article class="cosmetic-card '+(equipped?'is-equipped':'')+'"><div class="cosmetic-preview" style="background:'+item.style+'"></div><strong>'+item.name+'</strong><small>'+(item.unlock?'UNLOCK AT LEVEL '+item.unlock:'AVAILABLE')+'</small><button class="btn" '+(!unlocked||equipped?'disabled':'')+' onclick="equipProfileCosmetic(\'banner\',\''+item.id+'\')">'+(equipped?'EQUIPPED':unlocked?'EQUIP':'LOCKED')+'</button></article>';
    }).join('');
    const titleCards=PROFILE_TITLES.map(item=>{
      const unlocked=level>=item.unlock, equipped=(player.titleId||'none')===item.id;
      return '<article class="cosmetic-card '+(equipped?'is-equipped':'')+'"><div class="cosmetic-title-preview">'+item.name+'</div><strong>'+item.name+'</strong><small>'+(item.unlock?'UNLOCK AT LEVEL '+item.unlock:'AVAILABLE')+'</small><button class="btn" '+(!unlocked||equipped?'disabled':'')+' onclick="equipProfileCosmetic(\'title\',\''+item.id+'\')">'+(equipped?'EQUIPPED':unlocked?'EQUIP':'LOCKED')+'</button></article>';
    }).join('');
    host.innerHTML='<div class="customization-level">CAMPAIGN LEVEL '+level+' · '+(player.levelMode?.completed||[]).length+'/30 COMPLETED</div><h3 class="cosmetic-section-title">BANNERS</h3><div class="cosmetic-grid">'+bannerCards+'</div><h3 class="cosmetic-section-title">TITLES</h3><div class="cosmetic-grid">'+titleCards+'</div>';
  }
  async function equipProfileCosmetic(type,id) {
    const item=(type==='banner'?PROFILE_BANNERS:PROFILE_TITLES).find(x=>x.id===id);
    if(!item || getPlayerCampaignLevel()<item.unlock) return;
    if(type==='banner') player.bannerId=id; else player.titleId=id;
    saveGame();
    renderCustomization();
    await syncPublicPlayerProfile();
    if(document.getElementById('tab-profile')?.style.display!=='none') loadOwnPublicProfile();
  }
  window.searchPlayerProfiles=searchPlayerProfiles;
  window.openPlayerProfile=openPlayerProfile;
  window.equipProfileCosmetic=equipProfileCosmetic;

  function renderLevelMode() {
    const grid = document.getElementById('level-mode-grid');
    if (!grid || !window.NEON_LEVEL_MODE_CONFIG) return;
    const progress = player.levelMode || { highestUnlocked: 1, completed: [] };
    const unlocked = Math.max(1, Number(progress.highestUnlocked) || 1);
    const completed = new Set(Array.isArray(progress.completed) ? progress.completed : []);
    grid.innerHTML = window.NEON_LEVEL_MODE_CONFIG.levels.map(level => {
      const locked = level.id > unlocked, done = completed.has(level.id);
      const objectives = level.objectives.map(objective => {
        const label = objective.type === 'wave' ? 'REACH WAVE ' + objective.target : objective.type === 'kills' ? 'ELIMINATE ' + objective.target + ' ENEMIES' : objective.type === 'bosses' ? 'DEFEAT ' + objective.target + ' BOSSES' : 'SURVIVE ' + Math.floor(objective.target / 60) + ' MIN';
        return '<span>' + label + '</span>';
      }).join('');
      return '<article class="level-card ' + (locked ? 'is-locked' : done ? 'is-completed' : 'is-unlocked') + '"><div class="level-card-head"><strong>LEVEL ' + level.id + '</strong><span>' + (locked ? 'LOCKED' : done ? 'COMPLETED' : 'UNLOCKED') + '</span></div><div class="level-card-objectives">' + objectives + '</div><div class="level-card-reward">REWARD · ' + formatMoney(level.reward) + ' COINS</div><button class="btn ' + (locked ? '' : 'btn-gold') + '" ' + (locked ? 'disabled' : '') + ' onclick="startLevelMode(' + level.id + ')">' + (locked ? 'LOCKED' : done ? 'REPLAY LEVEL' : 'PLAY LEVEL') + '</button></article>';
    }).join('');
    const summary = document.getElementById('level-mode-progress');
    if (summary) summary.textContent = completed.size + ' / 30 LEVELS COMPLETED';
  }

  function switchTab(t) {
    ['workshop', 'skills', 'achievements', 'player-stats', 'profile', 'customization', 'leaderboard', 'levels'].forEach(x => {
      const tab = document.getElementById('tab-'+x);
      tab.style.display = (x===t?'flex':'none');
      if (x===t) tab.scrollTop = 0;
    });
    if (t==='skills') buildSkillTree();
    if (t==='leaderboard') showLeaderboardView();
    if (t==='profile') loadOwnPublicProfile();
    if (t==='customization') renderCustomization();
    if (t==='levels') renderLevelMode();
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
      const { error: weeklyNameError } = await leaderboardClient
        .from('weekly_leaderboard_entries')
        .update({ player_name: name })
        .eq('player_id', leaderboardPlayerId)
        .eq('week_start', getCurrentWeeklyStart());
      if (weeklyNameError) throw weeklyNameError;
      setLeaderboardStatus('PLAYER NAME SAVED TO YOUR ACCOUNT');
      await loadLeaderboard();
    } catch (error) {
      console.error('Leaderboard name update failed:', error);
      setLeaderboardStatus('COULD NOT SAVE PLAYER NAME. PLEASE TRY AGAIN.');
    }
  }

  function getCurrentWeeklyStart() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const value = type => Number(parts.find(part => part.type === type)?.value || 0);
    const localDate = new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
    const daysSinceWednesday = (localDate.getUTCDay() + 4) % 7;
    localDate.setUTCDate(localDate.getUTCDate() - daysSinceWednesday);
    return localDate.toISOString().slice(0, 10);
  }

  function showLeaderboardMode(mode) {
    const weekly = mode === 'weekly';
    const globalView = document.getElementById('global-leaderboard-view');
    const weeklyView = document.getElementById('weekly-leaderboard-view');
    const globalTab = document.getElementById('leaderboard-global-tab');
    const weeklyTab = document.getElementById('leaderboard-weekly-tab');
    if (globalView) globalView.style.display = weekly ? 'none' : 'block';
    if (weeklyView) weeklyView.style.display = weekly ? 'block' : 'none';
    if (globalTab) globalTab.classList.toggle('btn-gold', !weekly);
    if (weeklyTab) weeklyTab.classList.toggle('btn-gold', weekly);
    if (weekly) loadWeeklyLeaderboard();
    else loadLeaderboard();
  }

  async function refreshLeaderboards() {
    await Promise.all([loadLeaderboard(), loadWeeklyLeaderboard()]);
  }

  function renderLeaderboardRows(data, list, isWeekly = false) {
    if (!list) return;
    if (!data || !data.length) {
      list.innerHTML = '<div class="leaderboard-empty">NO SCORES YET — BE THE FIRST!</div>';
      return;
    }
    list.innerHTML = data.map((entry, index) => {
      const own = entry.player_id === leaderboardPlayerId;
      return '<article class="leaderboard-row ' + (own ? 'is-you' : '') + '">' +
        '<span class="leaderboard-rank">' + (isWeekly && index === 0 ? '🥇' : isWeekly && index === 1 ? '🥈' : isWeekly && index === 2 ? '🥉' : '#' + (index + 1)) + '</span>' +
        '<span class="leaderboard-player"><button class="leaderboard-profile-link" onclick="openPlayerProfile(\'' + entry.player_id + '\')">' + escapeLeaderboardText(entry.player_name) + (own ? ' <small>YOU</small>' : '') + '</button><small>WAVE ' + entry.best_wave + ' · ' + Number(entry.best_kills || 0).toLocaleString('en-US') + ' KILLS</small></span>' +
        '<span class="leaderboard-result"><strong>' + entry.best_wave + '</strong><small>WAVE</small></span>' +
        '<span class="leaderboard-result"><strong>' + Number(entry.best_kills || 0).toLocaleString('en-US') + '</strong><small>KILLS</small></span>' +
        '</article>';
    }).join('');
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
      renderLeaderboardRows(data, list);
      setLeaderboardStatus('GLOBAL TOP 100 · ' + (data || []).length + ' PLAYERS');
    } catch (error) {
      console.error('Leaderboard load failed:', error);
      setLeaderboardStatus('COULD NOT LOAD RANKINGS');
      if (list) list.innerHTML = '<div class="leaderboard-empty">RANKINGS ARE TEMPORARILY UNAVAILABLE. TRY REFRESHING.</div>';
    }
  }

  async function loadWeeklyLeaderboard() {
    if (!leaderboardClient || !leaderboardSession) return;
    const status = document.getElementById('weekly-leaderboard-status');
    const list = document.getElementById('weekly-leaderboard-list');
    if (status) status.textContent = 'UPDATING THIS WEEK\'S RANKINGS...';
    try {
      const weekStart = getCurrentWeeklyStart();
      const { data, error } = await leaderboardClient
        .from('weekly_leaderboard_entries')
        .select('player_id, player_name, best_wave, best_kills, best_bosses, best_duration, submitted_at')
        .eq('week_start', weekStart)
        .order('best_wave', { ascending: false })
        .order('best_kills', { ascending: false })
        .order('best_bosses', { ascending: false })
        .order('best_duration', { ascending: false })
        .order('submitted_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      renderLeaderboardRows(data, list, true);
      if (status) status.textContent = 'THIS WEEK · TOP 100 · ' + (data || []).length + ' PLAYERS';
      if (cloudSaveReady) claimWeeklyRewards();
    } catch (error) {
      console.error('Weekly leaderboard load failed:', error);
      if (status) status.textContent = 'COULD NOT LOAD WEEKLY RANKINGS';
      if (list) list.innerHTML = '<div class="leaderboard-empty">WEEKLY RANKINGS ARE TEMPORARILY UNAVAILABLE. TRY REFRESHING.</div>';
    }
  }

  let weeklyRewardClaimInProgress = false;
  async function claimWeeklyRewards() {
    if (!leaderboardClient || !leaderboardSession || !cloudSaveReady || weeklyRewardClaimInProgress) return;
    weeklyRewardClaimInProgress = true;
    try {
      const { data, error } = await leaderboardClient.rpc('claim_weekly_leaderboard_rewards');
      if (error) throw error;
      const reward = Number(data?.reward_coins || 0);
      if (reward > 0) {
        player.coins = Number(data.coins_balance);
        saveGame();
        const status = document.getElementById('weekly-reward-status');
        if (status) status.textContent = 'WEEKLY REWARD RECEIVED · +' + reward.toLocaleString('en-US') + ' COINS';
      } else {
        const status = document.getElementById('weekly-reward-status');
        if (status && !status.dataset.checked) {
          status.textContent = 'REWARDS ARE AUTOMATICALLY ADDED WHEN YOU NEXT OPEN THE GAME AFTER THE WEEK ENDS.';
          status.dataset.checked = 'true';
        }
      }
    } catch (error) {
      console.error('Weekly reward claim failed:', error);
      const status = document.getElementById('weekly-reward-status');
      if (status) status.textContent = 'WEEKLY REWARDS COULD NOT BE CHECKED. OPEN THIS TAB AGAIN LATER.';
    } finally {
      weeklyRewardClaimInProgress = false;
    }
  }

  async function submitLeaderboardResult(result, options = {}) {
    if (!leaderboardClient || !leaderboardSession || !result) return;
    const name = (String(leaderboardSession.user.user_metadata?.display_name || '').trim() || localStorage.getItem(LEADERBOARD_NAME_KEY) || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase())).trim();
    const completedWave = Math.floor(Number(result.wave) || 0);
    if (completedWave <= 15) {
      setLeaderboardStatus('REACH WAVE 16 TO ENTER THE LEADERBOARD');
      return;
    }
    if (options.includeWeekly !== false) {
      try {
        const { error: weeklyError } = await leaderboardClient.rpc('submit_weekly_leaderboard_score', {
          p_player_name: name,
          p_best_wave: Math.max(16, Math.floor(Number(result.wave) || 16)),
          p_best_kills: Math.max(0, Math.floor(Number(result.kills) || 0)),
          p_best_bosses: Math.max(0, Math.floor(Number(result.bossKills) || 0)),
          p_best_duration: Math.min(604800, Math.max(0, Math.floor(Number(result.elapsed) || 0)))
        });
        if (weeklyError) console.error('Weekly leaderboard submit failed:', weeklyError);
      } catch (weeklyError) {
        console.error('Weekly leaderboard submit failed:', weeklyError);
      }
  
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
