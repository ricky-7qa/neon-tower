  /** MENUS & HUD **/
  const DEVICE_MODE_KEY = 'neonTowerDeviceMode';

  const isVisibleUpgrade = key => !!(window.isNeonUpgradeVisible && window.isNeonUpgradeVisible(key));

  function applyDeviceMode(mode) {
    const app = document.getElementById('app');
    app.classList.remove('device-desktop', 'device-mobile');
    app.classList.add(mode === 'mobile' ? 'device-mobile' : 'device-desktop');
    const label = document.getElementById('menu-device-label');
    if (label) label.textContent = mode === 'mobile' ? 'MOBILE MODE' : 'DESKTOP MODE';
  }

  function selectDeviceMode(mode) {
    if (mode !== 'desktop' && mode !== 'mobile') return;
    window.neonStorage.setItem(DEVICE_MODE_KEY, mode);
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
    const systemInfo = window.NEON_CRAZYGAMES_SYSTEM_INFO || {};
    const deviceType = String(systemInfo.device?.type || '').toLowerCase();
    const isPortrait = !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
    const fallbackMobile = !!(window.matchMedia && window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches);
    const mode = deviceType === 'mobile' || (deviceType === 'tablet' && isPortrait)
      ? 'mobile'
      : deviceType === 'desktop'
        ? 'desktop'
        : (fallbackMobile ? 'mobile' : 'desktop');
    applyDeviceMode(mode);
    const deviceSelect = document.getElementById('device-select');
    if (deviceSelect) deviceSelect.classList.remove('active-layer');
    const menu = document.getElementById('menu');
    if (menu) menu.classList.add('active-layer');
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
      const section=document.createElement('section'); section.className='workshop-section'; section.dataset.category=category;
      section.innerHTML='<h2 class="workshop-heading">'+category+'</h2><div class="grid workshop-grid"></div>';
      const grid=section.querySelector('.grid');
      Object.keys(statDefs).filter(k=>isVisibleUpgrade(k) && statDefs[k].category===category).forEach(k=>{
        let d=statDefs[k],lvl=player.ws[k]||0,cost=getCost(k,true),val=getVal(k,true),wsMax=d.workshopMax||d.max,isMax=wsMax&&lvl>=wsMax,unlockWave=d.unlockWave||1,waveLocked=player.highestWave<unlockWave;
        grid.insertAdjacentHTML('beforeend',`<div class="card">
          <div><h3><span style="color:${d.col}">${d.n}</span><span>LVL ${lvl}${wsMax?' / '+wsMax:''}</span></h3><p>${d.d}<br><br><span style="color:#fff;">Current: ${val}</span>${waveLocked?'<br><br><span class="upgrade-unlock-note">UNLOCK AT WAVE '+unlockWave+'</span>':''}</p></div>
          <button class="btn btn-gold" ${player.coins<cost||isMax||waveLocked?'disabled':''} onclick="buyWs('${k}')">${isMax?'MAX LEVEL':waveLocked?'LOCKED · WAVE '+unlockWave:`UPGRADE · ${formatMoney(cost)}`}</button>
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
  function buyWs(k) {
    if (!isVisibleUpgrade(k)) return;
    const d = statDefs[k];
    if (!d || player.highestWave < (d.unlockWave || 1)) return;
    const max = d.workshopMax || d.max;
    const cost = getCost(k, true);
    if (player.coins >= cost && (!max || (player.ws[k] || 0) < max)) {
      player.coins -= cost;
      player.ws[k] = (player.ws[k] || 0) + 1;
      saveGame(true);
    }
  }
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
    saveGame(true);
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
    saveGame(true);
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
    if (window.NEON_CRAZYGAMES_MUTE_AUDIO) {
      AudioSys.setEnabled(false);
      const mutedButton = document.getElementById('settings-sound-toggle');
      if (mutedButton) mutedButton.textContent = 'SOUND · OFF';
      return false;
    }
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
    window.NeonCrazyGamesBridge?.gameplayStop();
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
  const GUEST_SAVE_KEY = 'neonTowerGuestSaveV1';
  const ACCOUNT_BAN_NOTICE_KEY = 'neonTowerAccountBanNoticeV1';
  let guestModeConfirmed = false;
  let accountBanNotice = '';
  let banEnforcementInProgress = false;
  let accountRunSessionKey = '';
  let leaderboardClient = null;
  let leaderboardPlayerId = '';
  let leaderboardSession = null;
  let passwordRecoveryPending = false;
  let authMode = 'signup';

  function escapeLeaderboardText(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function createBlankGuestSnapshot() {
    return {
      player: {
        coins: 0, highestWave: 1, totalKills: 0, bossKills: 0, playTime: 0,
        runsPlayed: 0, bestKills: 0, bestBosses: 0, bestDuration: 0,
        ws: {}, freeUpgradeChances: { ATTACK: 0, DEFENSE: 0, UTILITY: 0 },
        freeUpgradeChanceRefundV2: false, speedControlLevel: 0, speed3CraftStartedAt: 0,
        skills: ['start'], achievements: [], tutorialSeen: false,
        bannerId: 'default', titleId: 'none', startedAt: Date.now(),
        levelMode: { highestUnlocked: 1, completed: [], claimedRewards: [] }
      },
      checkpoint: null,
      checkpoints: { infinite: null, level: null }
    };
  }

  function saveGuestNeonCloudSnapshot(snapshot = null, onlyIfMissing = false) {
    if (leaderboardSession || (!guestModeConfirmed && !onlyIfMissing)) return false;
    try {
      if (onlyIfMissing && window.neonStorage.getItem(GUEST_SAVE_KEY)) return true;
      const value = snapshot || (window.getNeonTowerCloudSave && window.getNeonTowerCloudSave());
      if (!value) return false;
      window.neonStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Could not save guest progress separately:', error);
      return false;
    }
  }

  function restoreGuestNeonCloudSnapshot() {
    try {
      const raw = window.neonStorage.getItem(GUEST_SAVE_KEY);
      if (!raw || !window.applyNeonTowerCloudSave) return false;
      const snapshot = JSON.parse(raw);
      if (!snapshot || !snapshot.player) return false;
      window.applyNeonTowerCloudSave({ ...snapshot, replacePlayer: true });
      return true;
    } catch (error) {
      console.warn('Could not restore guest progress:', error);
      return false;
    }
  }

  function formatAccountBanNotice(bannedUntil) {
    const untilMs = Date.parse(bannedUntil || '');
    if (!untilMs || untilMs <= Date.now()) return 'YOUR ACCOUNT IS BANNED. ACCESS TO THIS ACCOUNT IS BLOCKED.';
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon', dateStyle: 'long', timeStyle: 'short', hour12: false
    }).format(new Date(untilMs));
    const remaining = untilMs - Date.now();
    const totalMinutes = Math.max(1, Math.ceil(remaining / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const duration = [days ? days + 'D' : '', hours ? hours + 'H' : '', minutes && !days ? minutes + 'M' : ''].filter(Boolean).join(' ');
    return 'YOUR ACCOUNT IS BANNED. ACCESS IS BLOCKED FOR ' + (duration || 'LESS THAN 1M') + '. UNBAN: ' + date + ' (PORTUGAL TIME).';
  }

  function clearAccountBanNotice() {
    accountBanNotice = '';
    window.neonStorage.removeItem(ACCOUNT_BAN_NOTICE_KEY);
  }

  async function rejectBannedAccount(bannedUntil) {
    accountBanNotice = formatAccountBanNotice(bannedUntil);
    window.neonStorage.setItem(ACCOUNT_BAN_NOTICE_KEY, JSON.stringify({ banned_until: bannedUntil || null, message: accountBanNotice }));
    banEnforcementInProgress = true;
    try { await leaderboardClient.auth.signOut({ scope: 'local' }); } catch (error) { console.warn('Could not clear banned local session:', error); }
    banEnforcementInProgress = false;
    setLeaderboardSession(null);
    guestModeConfirmed = true;
    if (!restoreGuestNeonCloudSnapshot()) {
      const blank = createBlankGuestSnapshot();
      window.neonStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(blank));
      window.applyNeonTowerCloudSave({ ...blank, replacePlayer: true });
    }
    setAuthMode('login');
    setAuthStatus(accountBanNotice);
    showLeaderboardView();
    return false;
  }

  async function verifyAccountIsNotBanned(session) {
    if (!session || !session.access_token) return false;
    const { data, error } = await leaderboardClient.functions.invoke('account-status', {
      headers: { Authorization: 'Bearer ' + session.access_token }
    });
    if (error) throw error;
    if (data && data.banned === true) {
      await rejectBannedAccount(data.banned_until);
      return false;
    }
    if (!data || data.banned !== false || typeof data.run_session_key !== 'string') throw new Error('Account status could not be verified.');
    accountRunSessionKey = data.run_session_key;
    clearAccountBanNotice();
    return true;
  }

  function initializeLeaderboard() {
    if (window.NEON_CRAZYGAMES_BUILD) return;
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
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') return;
      if (event === 'PASSWORD_RECOVERY') passwordRecoveryPending = true;
      if (event === 'SIGNED_OUT') {
        if (banEnforcementInProgress) return;
        if (leaderboardSession && isNeonLocalRunActive()) {
          // Keep the already-open run's last valid access token available for its final cloud checkpoints.
          if (leaderboardSession.access_token && leaderboardClient.rest?.setAuth) leaderboardClient.rest.setAuth(leaderboardSession.access_token);
          return;
        }
        setLeaderboardSession(null);
        guestModeConfirmed = true;
        if (!restoreGuestNeonCloudSnapshot()) {
          const blank = createBlankGuestSnapshot();
          window.neonStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(blank));
          window.applyNeonTowerCloudSave({ ...blank, replacePlayer: true });
        }
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        leaderboardSession = session;
        leaderboardPlayerId = session.user?.id || '';
        // Account run-session keys expire after 12 hours. Renew them when the
        // Supabase access token refreshes so long-running sessions keep syncing.
        verifyAccountIsNotBanned(session).catch(error => {
          console.warn('Could not refresh the account run session:', error);
        });
        return;
      }
      if (event === 'PASSWORD_RECOVERY') { setAuthMode('recovery'); showLeaderboardView(); }
    });
    leaderboardClient.auth.getSession().then(async ({ data, error }) => {
      if (error) throw error;
      passwordRecoveryPending = window.location.hash.includes('type=recovery') || window.location.search.includes('auth=recovery');
      const session = data.session;
      if (session) {
        if (!window.neonStorage.getItem(GUEST_SAVE_KEY)) {
          window.neonStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(createBlankGuestSnapshot()));
        }
        try {
          const allowed = await verifyAccountIsNotBanned(session);
          if (allowed) {
            guestModeConfirmed = false;
            setLeaderboardSession(session);
          }
        } catch (statusError) {
          console.error('Account ban check failed:', statusError);
          banEnforcementInProgress = true;
          try { await leaderboardClient.auth.signOut({ scope: 'local' }); } catch (_) {}
          banEnforcementInProgress = false;
          setLeaderboardSession(null);
          guestModeConfirmed = true;
          restoreGuestNeonCloudSnapshot();
          setAuthStatus('ACCOUNT STATUS COULD NOT BE VERIFIED. LOG IN IS TEMPORARILY DISABLED. GUEST MODE IS AVAILABLE.');
        }
      } else {
        setLeaderboardSession(null);
        guestModeConfirmed = true;
        if (!restoreGuestNeonCloudSnapshot()) saveGuestNeonCloudSnapshot(window.getNeonTowerCloudSave?.());
        const storedNotice = (() => { try { return JSON.parse(window.neonStorage.getItem(ACCOUNT_BAN_NOTICE_KEY) || 'null'); } catch (_) { return null; } })();
        if (storedNotice?.banned_until && Date.parse(storedNotice.banned_until) <= Date.now()) clearAccountBanNotice();
        else if (storedNotice?.message) accountBanNotice = storedNotice.message;
      }
      if (passwordRecoveryPending) { setAuthMode('recovery'); showLeaderboardView(); }
      else if (accountBanNotice) { setAuthMode('login'); setAuthStatus(accountBanNotice); }
    }).catch(async error => {
      console.error('Auth session check failed:', error);
      banEnforcementInProgress = true;
      try { await leaderboardClient.auth.signOut({ scope: 'local' }); } catch (_) {}
      banEnforcementInProgress = false;
      setLeaderboardSession(null);
      guestModeConfirmed = true;
      if (!restoreGuestNeonCloudSnapshot()) saveGuestNeonCloudSnapshot(window.getNeonTowerCloudSave?.(), true);
      setAuthStatus('COULD NOT VERIFY YOUR ACCOUNT. LOG IN IS TEMPORARILY DISABLED. GUEST MODE IS AVAILABLE.');
    });
  }

  function setLeaderboardSession(session) {
    leaderboardSession = session && session.user ? session : null;
    leaderboardPlayerId = leaderboardSession ? leaderboardSession.user.id : '';
    if (leaderboardSession) {
      initializeNeonCloudSave(leaderboardSession);
    } else {
      leaderboardRunToken = '';
      leaderboardRunTokenUserId = '';
      leaderboardRunTokenPromise = Promise.resolve('');
      accountRunSessionKey = '';
      cloudSaveReady = false;
      cloudSaveUserId = '';
      cloudSaveLoadingUserId = '';
      cloudSavePendingOffline = false;
      cloudSaveRemotePending = null;
      cloudSaveLastWriteAt = 0;
      cloudSaveLastAppliedAt = 0;
      if (cloudRealtimeChannel && leaderboardClient) leaderboardClient.removeChannel(cloudRealtimeChannel);
      cloudRealtimeChannel = null;
      setCloudSyncStatus('signed-out', 'NOT SIGNED IN — CLOUD SAVE DISABLED');
      if (cloudSaveTimer) { clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
    }
    const nameInput = document.getElementById('leaderboard-name');
    if (nameInput && leaderboardSession) {
      const accountName = String(leaderboardSession.user.user_metadata?.display_name || '').trim();
      const savedName = window.neonStorage.getItem(LEADERBOARD_NAME_KEY);
      const currentName = accountName || savedName || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase());
      nameInput.value = currentName;
      if (accountName) window.neonStorage.setItem(LEADERBOARD_NAME_KEY, accountName);
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
  let cloudRealtimeChannel = null;
  let cloudSaveLastWriteAt = 0;
  let cloudSaveLastAppliedAt = 0;
  let cloudSaveRemotePending = null;
  let leaderboardRunToken = '';
  let leaderboardRunTokenUserId = '';
  let leaderboardRunTokenPromise = Promise.resolve('');

  function startNeonLeaderboardRun() {
    if (!leaderboardClient || !leaderboardSession || !leaderboardPlayerId || !accountRunSessionKey ||
        !cloudSaveReady || !isNeonLocalRunActive() || run.mode === 'level') return Promise.resolve('');
    const userId = leaderboardPlayerId;
    leaderboardRunToken = '';
    leaderboardRunTokenUserId = userId;
    leaderboardRunTokenPromise = (async () => {
      try {
        // The server must see the exact wave-start checkpoint before issuing a score token.
        await cloudSaveWriteQueue;
        if (!leaderboardSession || leaderboardPlayerId !== userId || !cloudSaveReady ||
            !isNeonLocalRunActive() || run.mode === 'level') return '';
        const snapshot = window.getNeonTowerCloudSave();
        const localSaveAt = Number(snapshot.player?.localSaveAt) || 0;
        if (!localSaveAt) throw new Error('A current cloud save revision is required.');
        const { data, error } = await leaderboardClient.functions.invoke('start-game-run', {
          body: { run_session_key: accountRunSessionKey, local_save_at: localSaveAt }
        });
        if (error) throw error;
        if (!data || typeof data.run_token !== 'string') throw new Error('Server did not issue a run token.');
        if (leaderboardPlayerId !== userId) return '';
        leaderboardRunToken = data.run_token;
        return leaderboardRunToken;
      } catch (error) {
        console.error('Could not start validated leaderboard run:', error);
        if (leaderboardPlayerId === userId) setLeaderboardStatus('LEADERBOARD SESSION UNAVAILABLE — THIS RUN MAY NOT BE SUBMITTED');
        return '';
      }
    })();
    return leaderboardRunTokenPromise;
  }
  window.startNeonLeaderboardRun = startNeonLeaderboardRun;

  function getCloudCheckpointVersion(payload) {
    if (!payload || typeof payload !== 'object') return 0;
    if ('infinite' in payload || 'level' in payload) {
      return Math.max(
        Number(payload.revisions?.infinite) || Number(payload.infinite?.savedAt) || 0,
        Number(payload.revisions?.level) || Number(payload.level?.savedAt) || 0
      );
    }
    return Number(payload.savedAt) || 0;
  }

  function setCloudSyncStatus(state, message) {
    const status = document.getElementById('cloud-sync-status');
    if (!status) return;
    status.dataset.state = state;
    status.textContent = message;
  }

  function scheduleNeonCloudSave(immediate = false) {
    if (!leaderboardSession || !leaderboardPlayerId) {
      if (guestModeConfirmed) saveGuestNeonCloudSnapshot();
      return;
    }
    if (!navigator.onLine) {
      if (cloudSaveReady) cloudSavePendingOffline = true;
      setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
      return;
    }
    if (!cloudSaveReady) return;
    setCloudSyncStatus('syncing', immediate ? 'WAVE SAVED — SYNCING TO CLOUD...' : 'SAVE QUEUED — SYNCING...');
    if (cloudSaveTimer) { clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
    if (immediate) {
      persistNeonCloudSave();
      return;
    }
    cloudSaveTimer = setTimeout(() => {
      cloudSaveTimer = null;
      persistNeonCloudSave();
    }, 900);
  }
  window.scheduleNeonCloudSave = scheduleNeonCloudSave;

  function isNeonLocalRunActive() {
    return typeof window.isNeonTowerRunActive === 'function' && window.isNeonTowerRunActive();
  }

  function applyRemoteNeonCloudRow(row) {
    if (!row || !row.player_data || !window.applyNeonTowerCloudSave) return false;
    const updatedAt = Date.parse(row.updated_at || '') || 0;
    if (updatedAt && updatedAt <= cloudSaveLastAppliedAt) return false;
    if (isNeonLocalRunActive()) {
      cloudSaveRemotePending = row;
      setCloudSyncStatus('warning', 'NEWER CLOUD SAVE AVAILABLE — FINISH THIS RUN TO SYNC');
      return false;
    }
    const checkpointPayload = row.run_checkpoint;
    const checkpointSnapshot = checkpointPayload && typeof checkpointPayload === 'object' && ('infinite' in checkpointPayload || 'level' in checkpointPayload)
      ? { checkpoints: checkpointPayload }
      : { checkpoint: checkpointPayload };
    const localSnapshot = window.getNeonTowerCloudSave();
    const localSaveAt = Number(localSnapshot.player?.localSaveAt) || 0;
    const remoteSaveAt = Number(row.player_data.localSaveAt) || 0;
    const localCheckpointAt = getCloudCheckpointVersion(localSnapshot.cloudCheckpoints || localSnapshot.checkpoints || localSnapshot.checkpoint);
    const remoteCheckpointAt = getCloudCheckpointVersion(row.run_checkpoint);
    if (localSaveAt > remoteSaveAt || (localSaveAt === remoteSaveAt && localCheckpointAt > remoteCheckpointAt)) {
      cloudSaveRemotePending = null;
      setCloudSyncStatus('syncing', 'KEEPING NEWER LOCAL PURCHASES — SYNCING TO CLOUD...');
      persistNeonCloudSave();
      return false;
    }
    window.applyNeonTowerCloudSave({ player: row.player_data, ...checkpointSnapshot });
    cloudSaveLastAppliedAt = updatedAt || Date.now();
    cloudSaveRemotePending = null;
    setCloudSyncStatus('saved', 'PROGRESS UPDATED FROM CLOUD');
    return true;
  }

  async function pullLatestNeonCloudSave(allowActiveRun = false) {
    if (!cloudSaveReady || !leaderboardSession || !leaderboardPlayerId || !navigator.onLine || (!allowActiveRun && isNeonLocalRunActive())) return;
    const userId = leaderboardPlayerId;
    try {
      const { data, error } = await leaderboardClient
        .from('player_cloud_saves')
        .select('user_id, player_data, run_checkpoint, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (leaderboardPlayerId === userId && data) applyRemoteNeonCloudRow(data);
    } catch (error) {
      console.warn('Could not refresh cloud progress:', error);
    }
  }

  function subscribeToNeonCloudSave(userId) {
    if (!leaderboardClient || !userId) return;
    if (cloudRealtimeChannel) leaderboardClient.removeChannel(cloudRealtimeChannel);
    cloudRealtimeChannel = leaderboardClient
      .channel('neon-cloud-save-' + userId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_cloud_saves',
        filter: 'user_id=eq.' + userId
      }, payload => {
        if (leaderboardPlayerId === userId && payload.new && payload.new.user_id === userId) {
          applyRemoteNeonCloudRow(payload.new);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Cloud progress realtime subscription:', status);
      });
  }

  if (!window.neonCloudRefreshListenersBound) {
    window.addEventListener('focus', () => {
      if (cloudSaveRemotePending && !isNeonLocalRunActive()) applyRemoteNeonCloudRow(cloudSaveRemotePending);
      else pullLatestNeonCloudSave();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (cloudSaveRemotePending && !isNeonLocalRunActive()) applyRemoteNeonCloudRow(cloudSaveRemotePending);
      else pullLatestNeonCloudSave();
    });
    // Periodic cloud refresh: reconcile remote progress every five minutes.
    // Never apply a remote snapshot while a local run is active; keep it pending instead.
    window.setInterval(() => {
      if (!leaderboardSession || !cloudSaveReady || !navigator.onLine) return;
      if (cloudSaveRemotePending && !isNeonLocalRunActive()) {
        applyRemoteNeonCloudRow(cloudSaveRemotePending);
        return;
      }
      pullLatestNeonCloudSave();
    }, 5 * 60 * 1000);
    window.neonCloudRefreshListenersBound = true;
  }


  function persistNeonCloudSave() {
    if (!cloudSaveReady || !leaderboardSession || !leaderboardPlayerId || !accountRunSessionKey || !window.getNeonTowerCloudSave) return;
    if (!navigator.onLine) {
      cloudSavePendingOffline = true;
      setCloudSyncStatus('offline', 'OFFLINE — PROGRESS IS SAVED ON THIS DEVICE');
      return;
    }
    const userId = leaderboardPlayerId;
    setCloudSyncStatus('syncing', 'SYNCING YOUR PROGRESS...');
    const snapshot = window.getNeonTowerCloudSave();
    const savedAt = new Date().toISOString();
    cloudSaveLastWriteAt = Date.parse(savedAt) || Date.now();
    cloudSaveWriteQueue = cloudSaveWriteQueue.then(async () => {
      if (!leaderboardSession || leaderboardPlayerId !== userId) return;
      const { data, error } = await leaderboardClient.functions.invoke('account-cloud-save', {
        body: {
          run_session_key: accountRunSessionKey,
          player_data: snapshot.player,
          run_checkpoint: snapshot.cloudCheckpoints || snapshot.checkpoints || snapshot.checkpoint,
          updated_at: savedAt
        }
      });
      if (error) throw error;
      if (data?.stale === true) {
        setCloudSyncStatus('warning', 'NEWER CLOUD SAVE FOUND — KEEPING LOCAL BACKUP AND CHECKING CLOUD');
        await pullLatestNeonCloudSave(true);
        return;
      }
      if (!data || data.saved !== true) throw new Error('Account cloud save was not confirmed.');
      if (leaderboardPlayerId === userId) {
        cloudSavePendingOffline = false;
        setCloudSyncStatus('saved', 'CLOUD SYNCED — ALL PROGRESS SAVED');
        try { await syncPublicPlayerProfile(); }
        catch (profileError) { console.warn('Public profile sync is temporarily unavailable:', profileError); }
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
        .select('user_id, player_data, run_checkpoint, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!leaderboardSession || leaderboardPlayerId !== userId) return;
      if (data) {
        const localSnapshot = window.getNeonTowerCloudSave();
        const localSaveAt = Number(localSnapshot.player?.localSaveAt) || 0;
        const remoteSaveAt = Number(data.player_data?.localSaveAt) || 0;
        const localCheckpointAt = getCloudCheckpointVersion(localSnapshot.cloudCheckpoints || localSnapshot.checkpoints || localSnapshot.checkpoint);
        const remoteCheckpointAt = getCloudCheckpointVersion(data.run_checkpoint);
        if (localSaveAt > remoteSaveAt || (localSaveAt === remoteSaveAt && localCheckpointAt > remoteCheckpointAt)) {
          cloudSaveReady = true;
          cloudSaveLoadingUserId = '';
          persistNeonCloudSave();
          subscribeToNeonCloudSave(userId);
          cloudSavePendingOffline = false;
          setCloudSyncStatus('syncing', 'NEWER LOCAL PROGRESS FOUND — SYNCING TO CLOUD...');
          setAuthStatus('NEWER LOCAL PROGRESS FOUND. YOUR PURCHASES ARE BEING SYNCED.');
          return;
        }
        const checkpointPayload = data.run_checkpoint;
        const checkpointSnapshot = checkpointPayload && typeof checkpointPayload === 'object' && ('infinite' in checkpointPayload || 'level' in checkpointPayload)
          ? { checkpoints: checkpointPayload }
          : { checkpoint: checkpointPayload };
        window.applyNeonTowerCloudSave({ player: data.player_data, ...checkpointSnapshot });
        cloudSaveLastAppliedAt = Date.parse(data.updated_at || '') || Date.now();
      } else {
        let localSnapshot = window.getNeonTowerCloudSave();
        // New devices start with localSaveAt=0 so an empty default save can never
        // overwrite an existing account. Only stamp it when the cloud row is absent.
        if (!(Number(localSnapshot.player?.localSaveAt) > 0)) {
          player.localSaveAt = Math.max(Date.now(), (Number(player.localSaveAt) || 0) + 1);
          saveGame(false, false);
          localSnapshot = window.getNeonTowerCloudSave();
        }
        const { data: saveResult, error: insertError } = await leaderboardClient.functions.invoke('account-cloud-save', {
          body: {
            run_session_key: accountRunSessionKey,
            player_data: localSnapshot.player,
            run_checkpoint: localSnapshot.cloudCheckpoints || localSnapshot.checkpoints || localSnapshot.checkpoint,
            updated_at: new Date().toISOString()
          }
        });
        if (insertError) throw insertError;
        if (!saveResult || saveResult.saved !== true) throw new Error('Initial account cloud save was not confirmed.');
      }
      cloudSaveReady = true;
      cloudSaveLoadingUserId = '';
      // Reconcile the local lifetime best with the authoritative leaderboard record.
      // The leaderboard may be ahead of an older player/cloud snapshot.
      try {
        const { data: lifetimeRecord, error: lifetimeRecordError } = await leaderboardClient
          .from('leaderboard_entries')
          .select('best_wave')
          .eq('player_id', userId)
          .maybeSingle();
        if (lifetimeRecordError) throw lifetimeRecordError;
        const leaderboardBestWave = Math.max(1, Math.floor(Number(lifetimeRecord?.best_wave) || 1));
        if (leaderboardBestWave > (Number(player.highestWave) || 1)) {
          player.highestWave = leaderboardBestWave;
          saveGame(true);
        }
      } catch (recordSyncError) {
        console.warn('Could not reconcile lifetime best wave from leaderboard:', recordSyncError);
      }
      subscribeToNeonCloudSave(userId);
      cloudSavePendingOffline = false;
      setCloudSyncStatus('saved', 'CLOUD SYNCED — ALL PROGRESS SAVED');
      setAuthStatus('CLOUD SAVE SYNCED. YOUR PROGRESS IS LINKED TO THIS ACCOUNT.');
      claimWeeklyRewards();
      await syncPublicPlayerProfile();
      if (document.getElementById('tab-profile')?.style.display !== 'none') await loadOwnPublicProfile();
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
        const savedName = window.neonStorage.getItem(LEADERBOARD_NAME_KEY);
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
    const completed=Array.isArray(player.levelMode?.completed)?new Set(player.levelMode.completed).size:0;
    return Math.max(1,Math.min(30,completed));
  }
  let lastPublicProfileSignature = '';
  function getPlayerName() {
    return String(leaderboardSession?.user?.user_metadata?.display_name || window.neonStorage.getItem(LEADERBOARD_NAME_KEY) || ('Pilot-' + String(leaderboardPlayerId || '0000').slice(0,4).toUpperCase())).trim();
  }
  function renderProfileCard(profile, isOwn = false) {
    const host = document.getElementById('public-player-profile');
    if (!host) return;
    if (!profile) { host.innerHTML = '<div class="leaderboard-empty">PLAYER PROFILE NOT FOUND. THIS PLAYER MAY NOT HAVE CREATED A PROFILE YET.</div>'; return; }
    const banner = PROFILE_BANNERS.find(item => item.id === profile.banner_id) || PROFILE_BANNERS[0];
    const title = PROFILE_TITLES.find(item => item.id === profile.title_id) || PROFILE_TITLES[0];
    const esc = escapeLeaderboardText;
    const started = profile.started_at ? new Date(profile.started_at).toLocaleDateString('en-GB') : '—';
    const number = value => Math.max(0,Math.floor(Number(value)||0)).toLocaleString('en-US');
    const completedLevels = Math.min(30,Math.max(0,Number(profile.levels_completed)||0));
    const levelProgress = completedLevels / 30 * 100;
    host.innerHTML = '<article class="public-profile-card">' +
      '<div class="public-profile-banner" style="background:'+banner.style+'"><span>'+esc(banner.name)+' BANNER</span></div>' +
      '<div class="public-profile-identity"><strong>'+esc(profile.player_name)+'</strong><span>'+esc(title.name)+'</span></div>' +
      '<div class="public-profile-level"><div class="public-profile-level-copy"><span>PLAYER LEVEL <b>'+Number(profile.player_level || 1)+'</b></span><small>'+completedLevels+'/30 LEVELS COMPLETED</small></div><div class="public-profile-level-progress"><span style="width:'+levelProgress+'%"></span></div></div>' +
      '<div class="public-profile-section-label">CAREER RECORDS</div>' +
      '<div class="public-profile-stats">' +
      '<div><small>BEST INFINITE WAVE</small><b>'+number(profile.best_infinite_wave || 1)+'</b></div>' +
      '<div><small>TOTAL ENEMIES KILLED</small><b>'+number(profile.total_kills)+'</b></div>' +
      '<div><small>TOTAL RUNS</small><b>'+(profile.total_runs == null ? '—' : number(profile.total_runs))+'</b></div>' +
      '<div><small>BOSSES DEFEATED</small><b>'+number(profile.bosses_defeated)+'</b></div>' +
      '<div><small>TOTAL PLAYTIME</small><b>'+formatPlayerStatTime(profile.total_playtime_seconds)+'</b></div>' +
      '<div><small>BEST RUN KILLS</small><b>'+number(profile.best_run_kills)+'</b></div>' +
      '<div><small>LONGEST RUN</small><b>'+formatPlayerStatTime(profile.longest_run_seconds)+'</b></div>' +
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
  async function openPlayerProfile(userId) {
    userId=String(userId||'').trim();
    if(!/^[0-9a-f-]{36}$/i.test(userId) || !leaderboardClient) return;
    switchTab('profile', true);
    const host=document.getElementById('public-player-profile');
    if(host) host.innerHTML='<div class="leaderboard-empty">LOADING PLAYER PROFILE...</div>';
    try {
      const {data:profile,error}=await leaderboardClient.from('player_profiles').select('*').eq('user_id',userId).maybeSingle();
      if(error) throw error;
      if(profile) { renderProfileCard(profile,userId===leaderboardPlayerId); return; }
      const {data:entry,error:entryError}=await leaderboardClient.from('leaderboard_entries').select('player_id,player_name,best_wave,best_kills,updated_at').eq('player_id',userId).eq('is_verified',true).maybeSingle();
      if(entryError) throw entryError;
      if(!entry) { renderProfileCard(null,false); return; }
      renderProfileCard({player_name:entry.player_name,banner_id:'default',title_id:'none',player_level:1,levels_completed:0,best_infinite_wave:entry.best_wave,total_kills:entry.best_kills,total_runs:null,started_at:null},false);
      const note=document.createElement('p');
      note.className='profile-data-note';
      note.textContent='This player has not created a full public profile yet. Showing leaderboard statistics.';
      host?.querySelector('.public-profile-card')?.appendChild(note);
    } catch(error) {
      console.error('Player profile load failed:',error);
      if(host) host.innerHTML='<div class="leaderboard-empty">PROFILE COULD NOT BE LOADED. PLEASE TRY AGAIN.</div>';
    }
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
      total_playtime_seconds:Math.max(0,Number(player.playTime)||0),
      bosses_defeated:Math.min(1000000000,Math.max(0,Math.floor(Number(player.bossKills)||0))),
      best_run_kills:Math.min(1000000000,Math.max(0,Math.floor(Number(player.bestKills)||0))),
      longest_run_seconds:Math.max(0,Number(player.bestDuration)||0),
      started_at:leaderboardSession.user.created_at || new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const signature=JSON.stringify({...payload,updated_at:undefined});
    if(signature===lastPublicProfileSignature) return;
    const {error}=await leaderboardClient.from('player_profiles').upsert(payload,{onConflict:'user_id'});
    if(error) console.error('Public profile sync failed:',error);
    else lastPublicProfileSignature=signature;
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
  window.openPlayerProfile=openPlayerProfile;
  window.syncPublicPlayerProfile = syncPublicPlayerProfile;
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

  function switchTab(t, skipProfileLoad = false) {
    ['workshop', 'skills', 'achievements', 'player-stats', 'profile', 'customization', 'leaderboard', 'levels'].forEach(x => {
      const tab = document.getElementById('tab-'+x);
      if (!tab) return; // Some tabs (account/profile/leaderboard) are intentionally absent in the CrazyGames Basic build.
      tab.style.display = (x===t?'flex':'none');
      if (x===t) tab.scrollTop = 0;
    });
    if (t==='skills') buildSkillTree();
    if (t==='leaderboard') showLeaderboardView();
    if (t==='profile' && !skipProfileLoad) loadOwnPublicProfile();
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
    setAuthStatus(accountBanNotice || (recovery ? 'CHOOSE A NEW PASSWORD FOR YOUR ACCOUNT.' : (authMode === 'signup' ? 'CREATE AN ACCOUNT TO ENTER THE GLOBAL LEADERBOARD.' : 'LOG IN TO ACCESS YOUR GLOBAL RANKING.')));
  }

  async function submitLeaderboardAuth() {
    if (!leaderboardClient) return setAuthStatus('ACCOUNT SERVICE UNAVAILABLE.');
    const email = (document.getElementById('auth-email')?.value || '').trim();
    const password = document.getElementById('auth-password')?.value || '';
    if (authMode === 'recovery') return saveRecoveredPassword();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAuthStatus('ENTER A VALID EMAIL ADDRESS.');
    if (password.length < 8) return setAuthStatus('PASSWORD MUST HAVE AT LEAST 8 CHARACTERS.');
    try {
      saveGuestNeonCloudSnapshot(window.getNeonTowerCloudSave?.(), true);
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
          const allowed = await verifyAccountIsNotBanned(data.session);
          if (!allowed) return;
          guestModeConfirmed = false;
          clearAccountBanNotice();
          setAuthStatus('ACCOUNT CREATED. OPENING YOUR ACCOUNT...');
          setLeaderboardSession(data.session);
        }
      } else {
        const { data, error } = await leaderboardClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const allowed = await verifyAccountIsNotBanned(data.session);
        if (!allowed) return;
        guestModeConfirmed = false;
        clearAccountBanNotice();
        setAuthStatus('LOGGED IN. OPENING YOUR ACCOUNT...');
        setLeaderboardSession(data.session);
      }
    } catch (error) {
      console.error('Leaderboard authentication failed:', error);
      const authMessage = authErrorMessage(error);
      if (authMessage.includes('YOUR ACCOUNT IS BANNED')) {
        accountBanNotice = 'YOUR ACCOUNT IS BANNED. ACCESS TO THIS ACCOUNT IS BLOCKED.';
        window.neonStorage.setItem(ACCOUNT_BAN_NOTICE_KEY, JSON.stringify({ banned_until: null, message: accountBanNotice }));
        setAuthStatus(accountBanNotice);
      } else setAuthStatus(authMessage);
    }
  }

  function authErrorMessage(error) {
    const message = String(error && error.message || '').toLowerCase();
    if (message.includes('already registered') || message.includes('already been registered')) return 'THIS EMAIL ALREADY HAS AN ACCOUNT. TRY LOGGING IN.';
    if (message.includes('invalid login credentials')) return 'EMAIL OR PASSWORD IS INCORRECT.';
    if (message.includes('email not confirmed')) return 'CHECK YOUR EMAIL AND CONFIRM YOUR ACCOUNT FIRST.';
    if (message.includes('ban') || String(error?.code || '').toLowerCase().includes('ban')) return 'YOUR ACCOUNT IS BANNED. ACCESS TO THIS ACCOUNT IS BLOCKED.';
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
    const { error } = await leaderboardClient.auth.signOut({ scope: 'local' });
    if (error) {
      setAuthStatus(authErrorMessage(error));
      return;
    }
    setLeaderboardSession(null);
    guestModeConfirmed = true;
    if (!restoreGuestNeonCloudSnapshot()) {
      const blank = createBlankGuestSnapshot();
      window.neonStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(blank));
      window.applyNeonTowerCloudSave({ ...blank, replacePlayer: true });
    }
    clearAccountBanNotice();
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
      window.neonStorage.setItem(LEADERBOARD_NAME_KEY, name);
      const { data: nameResult, error: nameError } = await leaderboardClient.functions.invoke('update-player-name', {
        body: { run_session_key: accountRunSessionKey, player_name: name }
      });
      if (nameError) throw nameError;
      if (!nameResult || nameResult.saved !== true) throw new Error('Name update was not confirmed.');
      setLeaderboardStatus('PLAYER NAME SAVED TO YOUR ACCOUNT');
      lastPublicProfileSignature = '';
      await syncPublicPlayerProfile();
      await Promise.all([loadLeaderboard(), loadWeeklyLeaderboard()]);
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

  async function renderLeaderboardRows(data, list, isWeekly = false) {
    if (!list) return;
    if (!data || !data.length) {
      list.innerHTML = '<div class="leaderboard-empty">NO SCORES YET — BE THE FIRST!</div>';
      return;
    }
    const ids=data.map(entry=>entry.player_id);
    let profileMap={};
    try {
      const {data:profiles}=await leaderboardClient.from('player_profiles').select('user_id,banner_id,title_id').in('user_id',ids);
      (profiles||[]).forEach(profile=>profileMap[profile.user_id]=profile);
    } catch(error) { console.warn('Leaderboard cosmetics unavailable:',error); }
    list.innerHTML = data.map((entry, index) => {
      const own = entry.player_id === leaderboardPlayerId;
      const profile=profileMap[entry.player_id];
      const title=PROFILE_TITLES.find(item=>item.id===profile?.title_id);
      const banner=PROFILE_BANNERS.find(item=>item.id===profile?.banner_id);
      return '<article class="leaderboard-row ' + (own ? 'is-you' : '') + '">' +
        '<span class="leaderboard-rank">' + (isWeekly && index === 0 ? '🥇' : isWeekly && index === 1 ? '🥈' : isWeekly && index === 2 ? '🥉' : '#' + (index + 1)) + '</span>' +
        '<span class="leaderboard-player"><span class="leaderboard-player-heading">' +
        (banner ? '<span class="leaderboard-mini-banner" style="background:' + banner.style + '" aria-label="' + escapeLeaderboardText(banner.name) + ' banner"></span>' : '') +
        '<button class="leaderboard-profile-link" onclick="openPlayerProfile(\'' + entry.player_id + '\')">' + escapeLeaderboardText(entry.player_name) + (own ? ' <small>YOU</small>' : '') + '</button></span>' +
        '<small>WAVE ' + entry.best_wave + ' · ' + Number(entry.best_kills || 0).toLocaleString('en-US') + ' KILLS' + (title && title.id!=='none'?' · '+escapeLeaderboardText(title.name):'') + '</small></span>' +
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

  async function submitLeaderboardResult(result) {
    if (!leaderboardClient || !leaderboardSession || !result) return;
    const completedWave = Math.floor(Number(result.wave) || 0);
    if (completedWave <= 15) {
      setLeaderboardStatus('REACH WAVE 16 TO ENTER THE LEADERBOARD');
      return;
    }
    const userId = leaderboardPlayerId;
    try {
      const runToken = await leaderboardRunTokenPromise;
      if (!runToken || leaderboardRunTokenUserId !== userId || leaderboardPlayerId !== userId) {
        setLeaderboardStatus('THIS RUN HAS NO SERVER VALIDATION TOKEN — START A NEW RUN AFTER CLOUD SYNC COMPLETES');
        return;
      }
      const { data, error } = await leaderboardClient.functions.invoke('submit-leaderboard-score', {
        body: {
          run_token: runToken,
          wave: completedWave,
          kills: Math.max(0, Math.floor(Number(result.kills) || 0)),
          bosses: Math.max(0, Math.floor(Number(result.bossKills) || 0)),
          duration: Math.min(604800, Math.max(0, Math.floor(Number(result.elapsed) || 0)))
        }
      });
      if (error) throw error;
      if (!data || data.accepted !== true) throw new Error('Server did not accept this score.');
      leaderboardRunToken = '';
      leaderboardRunTokenUserId = '';
      leaderboardRunTokenPromise = Promise.resolve('');
      setLeaderboardStatus('YOUR SCORE PASSED SERVER VALIDATION');
      await Promise.all([loadLeaderboard(), loadWeeklyLeaderboard()]);
    } catch (error) {
      console.error('Leaderboard submit failed:', error);
      setLeaderboardStatus('SCORE FAILED SERVER CHECKS — START A NEW RUN WHILE ONLINE');
    }
  }

  loadGame();
  if (typeof window.refreshResumeUI === 'function') window.refreshResumeUI();
  initializeDeviceMode();
  initializeLeaderboard();
