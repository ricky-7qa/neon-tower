  /** MENUS & HUD **/
  const DEVICE_MODE_KEY = 'neonTowerDeviceMode';

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

  function switchTab(t) { ['workshop', 'skills', 'achievements', 'leaderboard'].forEach(x => { const tab = document.getElementById('tab-'+x); tab.style.display = (x===t?'flex':'none'); if (x===t) tab.scrollTop = 0; }); if (t==='skills') buildSkillTree(); if (t==='leaderboard') loadLeaderboard(); }
  
  function updateMenuUI() {
    document.getElementById('menu-coins').innerText = '$' + player.coins.toLocaleString('en-US');
    document.getElementById('menu-wave').innerText = player.highestWave;
    
    let ws = document.getElementById('ws-grid'); ws.innerHTML = "";
    ['ATTACK','DEFENSE','UTILITY'].forEach(category=>{
      const section=document.createElement('section'); section.className='workshop-section';
      section.innerHTML='<h2 class="workshop-heading">'+category+'</h2><div class="grid workshop-grid"></div>';
      const grid=section.querySelector('.grid');
      Object.keys(statDefs).filter(k=>statDefs[k].category===category).forEach(k=>{
        let d=statDefs[k],lvl=player.ws[k]||0,cost=getCost(k,true),val=getVal(k,true),isMax=d.max&&lvl>=d.max;
        grid.insertAdjacentHTML('beforeend',`<div class="card">
          <div><h3><span style="color:${d.col}">${d.n}</span><span>LVL ${lvl}${d.max?' / '+d.max:''}</span></h3><p>${d.d}<br><br><span style="color:#fff;">Current: ${val}</span></p></div>
          <button class="btn btn-gold" ${player.coins<cost||isMax?'disabled':''} onclick="buyWs('${k}')">${isMax?'MAX LEVEL':`UPGRADE · $${cost.toLocaleString('en-US')}`}</button>
        </div>`);
      });
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
    container.innerHTML = '<div class="skill-intro"><span class="eyebrow">PERMANENT UPGRADES</span><h2>Skill Tree</h2><p>Choose upgrades for your tower. Check each effect, cost and requirement before buying. Purchases are permanent.</p><div class="skill-wallet">YOUR COINS: <strong>' + player.coins.toLocaleString('en-US') + '</strong></div></div><div class="skill-grid" id="skill-grid"></div>';
    const grid = document.getElementById('skill-grid');
    Object.values(skillDefs).forEach(s => {
      const unlocked = hasSkill(s.id);
      const available = !unlocked && (s.req === null || hasSkill(s.req));
      const locked = !unlocked && !available;
      const requirement = s.req ? 'Requires: ' + skillDefs[s.req].n : (s.id === 'start' ? 'Starting skill' : 'No requirement');
      const effect = {
        start: 'Unlocks the tower core systems.',
        multishot: 'Improves Multi-Shot projectile guidance and homing speed.',
        missiles: 'Launches a homing missile about every 2 seconds. It deals area damage.',
        lasers: 'Fires a piercing laser for 0.5 seconds every 4 seconds.',
        shield: 'Blocks one hit and recharges after a cooldown.',
        thorn: 'Reflects 50% of collision damage back to the attacker.',
        drone: 'Fires an extra homing projectile every 3 seconds.',
        overdrive: 'Increases attack speed by 25%.',
        vampire: 'Restores 2% of maximum health after every kill.',
        fortify: 'Reduces incoming damage by 10%.',
      }[s.id] || s.d;
      const status = unlocked ? 'UNLOCKED' : locked ? 'LOCKED' : 'AVAILABLE';
      const action = unlocked ? '<span class="skill-status done">✓ ' + status + '</span>' :
        locked ? '<button class="btn skill-buy" disabled>' + status + '</button>' :
        '<button class="btn btn-gold skill-buy" ' + (player.coins < s.cost ? 'disabled' : '') + ' onclick="buySkill(\'' + s.id + '\')">' + (s.cost === 0 ? 'FREE' : (player.coins < s.cost ? 'NEED ' + (s.cost-player.coins) + ' COINS' : 'BUY · ' + s.cost + ' COINS')) + '</button>';
      grid.insertAdjacentHTML('beforeend', `<article class="skill-card ${unlocked?'is-unlocked':''} ${locked?'is-locked':''}">
        <div class="skill-card-top"><span class="skill-icon">${s.id==='start'?'◆':s.id==='multishot'?'⟡':s.id==='missiles'?'➤':s.id==='lasers'?'ϟ':s.id==='shield'?'⬡':s.id==='drone'?'◉':s.id==='overdrive'?'⚡':s.id==='vampire'?'✚':'✧'}</span><span class="skill-status ${unlocked?'done':locked?'locked':'ready'}">${status}</span></div>
        <h3>${s.n}</h3><p class="skill-description">${effect}</p>
        <div class="skill-meta"><span>${requirement}</span><strong>${s.cost === 0 ? 'FREE' : s.cost.toLocaleString('en-US') + ' COINS'}</strong></div>
        ${action}
      </article>`);
    });
  }

  function buyWs(k) { let c=getCost(k,true); if(player.coins>=c && (!statDefs[k].max || (player.ws[k]||0)<statDefs[k].max)){player.coins-=c;player.ws[k]=(player.ws[k]||0)+1;saveGame();} }
  function buySkill(id) {
    let s = skillDefs[id]; if(hasSkill(id)) return;
    if(player.coins >= s.cost) { player.coins -= s.cost; player.skills.push(id); saveGame(); buildSkillTree(); AudioSys.coin(); }
  }

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
      btn.style.display = statDefs[btn.dataset.stat].category === category ? 'flex' : 'none';
    });
  }

  function initUpgBar() {
    let ub = document.getElementById('upg-content'); ub.innerHTML = "";
    Object.keys(statDefs).forEach(k => {
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
    document.getElementById('hud-cash').innerText = '$'+run.cash;
    document.getElementById('hud-coins').innerText = '$' + run.coins.toLocaleString('en-US');

    if (tower) {
      const perkDamage = 1 + (getPerkValue('power') + getPerkValue('overload')) / 100;
      const overloadSpeed = Object.entries(run.perks?.overload || {}).reduce((sum,[rarity,count])=>sum+(perkDefs.find(p=>p.id==='overload').speedValues[rarity]||0)*count,0);
      const perkFireRate = 1 + (getPerkValue('rapid') + overloadSpeed) / 100;
      const perkRange = 1 + getPerkValue('radar') / 100;
      const totalRegen = parseFloat(getVal('regen')) + parseFloat(getVal('nanoMatrix')) + getPerkValue('repair');
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

    Object.keys(statDefs).forEach(k => {
      const d=statDefs[k], l=run.stats[k]||0, c=getCost(k, false), m=!!(d.max && (player.ws[k]||0)+l>=d.max);
      const btn=document.getElementById('btn-upg-'+k);
      if(btn) {
        const unlockWave=d.unlockWave||1;
        const waveLocked=run.wave<unlockWave;
        btn.disabled=waveLocked || (run.cash<c) || m;
        const label=waveLocked ? 'LOCKED · WAVE '+unlockWave : m ? 'MAX' : '$'+c.toLocaleString('en-US');
        btn.innerHTML=`<span style="color:${d.col}">${d.n} · LVL ${Math.min(d.max||999,(player.ws[k]||0)+l)}</span><span style="color:${waveLocked?'#ffb45c':'#0f0'}">${label}</span>`;
      }
    });
  }

  function buyRunUpg(k) {
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
  const LEADERBOARD_ID_KEY = 'neonTowerLeaderboardId';
  const LEADERBOARD_NAME_KEY = 'neonTowerLeaderboardName';
  let leaderboardClient = null;
  let leaderboardPlayerId = '';

  function getLeaderboardPlayerId() {
    let id = localStorage.getItem(LEADERBOARD_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LEADERBOARD_ID_KEY, id);
    }
    return id;
  }

  function escapeLeaderboardText(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function initializeLeaderboard() {
    leaderboardPlayerId = getLeaderboardPlayerId();
    const savedName = localStorage.getItem(LEADERBOARD_NAME_KEY);
    const nameInput = document.getElementById('leaderboard-name');
    if (nameInput) nameInput.value = savedName || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase());
    if (!window.supabase || !window.supabase.createClient) {
      setLeaderboardStatus('ONLINE SERVICE UNAVAILABLE');
      return;
    }
    leaderboardClient = window.supabase.createClient(LEADERBOARD_URL, LEADERBOARD_KEY, {
      global: { headers: { 'x-player-id': leaderboardPlayerId } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    loadLeaderboard();
  }

  function setLeaderboardStatus(message) {
    const status = document.getElementById('leaderboard-status');
    if (status) status.textContent = message;
  }

  function saveLeaderboardName() {
    const input = document.getElementById('leaderboard-name');
    const name = (input?.value || '').trim();
    if (!/^[a-zA-Z0-9 _-]{3,16}$/.test(name)) {
      setLeaderboardStatus('USE 3–16 LETTERS, NUMBERS, SPACES, _ OR -');
      return;
    }
    localStorage.setItem(LEADERBOARD_NAME_KEY, name);
    setLeaderboardStatus('PLAYER NAME SAVED');
    loadLeaderboard();
  }

  async function loadLeaderboard() {
    if (!leaderboardClient) {
      setLeaderboardStatus('CONNECTING TO GLOBAL RANKINGS...');
      return;
    }
    setLeaderboardStatus('UPDATING GLOBAL RANKINGS...');
    const list = document.getElementById('leaderboard-list');
    try {
      const { data, error } = await leaderboardClient
        .from('leaderboard_entries')
        .select('player_id, player_name, best_wave, best_kills, best_bosses, best_duration, updated_at')
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
          const duration = Math.floor(entry.best_duration / 60) + ':' + String(entry.best_duration % 60).padStart(2, '0');
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
    if (!leaderboardClient || !result) return;
    const name = (localStorage.getItem(LEADERBOARD_NAME_KEY) || ('Pilot-' + leaderboardPlayerId.slice(0,4).toUpperCase())).trim();
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
  initializeDeviceMode();
  initializeLeaderboard();
