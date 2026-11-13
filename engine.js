
  /** CORE ENGINE & DATA **/
  const SAVE_KEY = "NeonTowerApexSave_FinalVersion";
  const RUN_CHECKPOINT_KEY = "NeonTowerApexRunCheckpoint";
  const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
  
  let tower = null; 
  let isUpgOpen = false;
  let activePanelView = 'upgrades';

  function toggleUpgPanel(view = 'upgrades') {
    const panel = document.getElementById('upg-panel');
    const app = document.getElementById('app');
    const hud = document.getElementById('hud');
    const upgBtn = document.getElementById('upg-toggle');
    const perkBtn = document.getElementById('perk-toggle');

    if (isUpgOpen && activePanelView === view) {
      isUpgOpen = false;
      panel.classList.remove('open');
      app.classList.remove('panel-open');
      hud.classList.remove('upgrades-open');
      upgBtn.classList.remove('selected');
      perkBtn.classList.remove('selected');
      return;
    }

    isUpgOpen = true;
    activePanelView = view;
    panel.classList.add('open');
    app.classList.add('panel-open');
    hud.classList.add('upgrades-open');
    document.getElementById('upgrades-view').style.display = view === 'upgrades' ? 'flex' : 'none';
    document.getElementById('perks-view').style.display = view === 'perks' ? 'flex' : 'none';
    upgBtn.classList.toggle('selected', view === 'upgrades');
    perkBtn.classList.toggle('selected', view === 'perks');
    if (view === 'perks') renderRunPerks();
  }

  function resize() { 
    canvas.width = canvas.parentElement.clientWidth; 
    canvas.height = canvas.parentElement.clientHeight; 
  }
  window.addEventListener('resize', resize); resize();
  
  const MathUtils = { dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1), angle:(x1,y1,x2,y2)=>Math.atan2(y2-y1,x2-x1) };
  function segmentHitsCircle(x1,y1,x2,y2,cx,cy,r){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((cx-x1)*dx+(cy-y1)*dy)/l)):0;return MathUtils.dist(x1+t*dx,y1+t*dy,cx,cy)<=r;}
  class EnemyBullet{constructor(){this.active=false;}activate(x,y,a,s,d,k){this.x=x;this.y=y;this.vx=Math.cos(a)*s;this.vy=Math.sin(a)*s;this.damage=d;this.kind=k;this.r=5;this.grazed=false;this.active=true;return this;}update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;}draw(){ctx.save();ctx.shadowBlur=12;ctx.shadowColor='#ffb000';ctx.fillStyle='#ffb000';ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fill();ctx.restore();}}
  const bulletPool={free:Array.from({length:500},()=>new EnemyBullet()),acquire(x,y,a,s,d,k){let b=this.free.pop();return b?b.activate(x,y,a,s,d,k):null;},release(b){if(b&&b.active){b.active=false;if(this.free.length<500)this.free.push(b);}}};
  function spawnBullet(x,y,a,s,d,k){let b=bulletPool.acquire(x,y,a,s,d,k);if(b&&game.ents.b)game.ents.b.push(b);}

  /** AUDIO SYSTEM **/
  const AudioSys = {
    ctx: null, master: null,
    init() {
      if(this.ctx) return; 
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.3; this.master.connect(this.ctx.destination);
    },
    play(type, freqStart, freqEnd, typeW, duration, vol) {
      if(!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = typeW; osc.frequency.setValueAtTime(freqStart, t);
      if(freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
      gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
      osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration);
    },
    shoot() { this.play('shoot', 600, 100, 'square', 0.1, 0.2); },
    laser() { this.play('laser', 1200, 400, 'sawtooth', 0.3, 0.1); },
    missile() { this.play('missile', 200, 50, 'sine', 0.4, 0.3); },
    hit() { this.play('hit', 150, 40, 'triangle', 0.2, 0.4); },
    explosion() { this.play('exp', 100, 20, 'sawtooth', 0.5, 0.5); },
    coin() { this.play('coin', 1000, 1500, 'sine', 0.1, 0.1); }
  };

  /** DATABASE EN **/
  const statDefs = {
    damage: { n: "DAMAGE", d: "Increases every projectile's base damage.", category:"ATTACK", b:15, i:5, c:10, cm:1.15, isD:false, col:"#0ff", unlockWave:1 },
    speed: { n:"ATTACK SPEED", d:"More shots fired every second.", category:"ATTACK", b:1.5, i:.2, c:15, cm:1.25, isD:true, col:"#0ff", unlockWave:1 },
    critC: { n:"CRITICAL CHANCE", d:"Chance for a critical hit.", category:"ATTACK", b:0, i:5, c:50, cm:1.4, isD:false, col:"#ff3366", unlockWave:3, max:15 },
    critD: { n:"CRITICAL DAMAGE", d:"Multiplier applied to critical hits.", category:"ATTACK", b:1.5, i:.2, c:50, cm:1.4, isD:true, col:"#ff3366", unlockWave:5 },
    multishot: { n:"MULTI-SHOT", d:"Fire up to four homing projectiles at one target.", category:"ATTACK", b:0, i:1, c:100, cm:1.42, isD:false, col:"#ff9b42", max:3, unlockWave:5 },
    hp: { n:"MAX HEALTH", d:"Increases the tower's maximum health.", category:"DEFENSE", b:200, i:30, c:10, cm:1.15, isD:false, col:"#0f0", unlockWave:1 },
    regen: { n:"HEALTH REGEN", d:"Restores health every second.", category:"DEFENSE", b:0, i:0.2, c:25, cm:1.3, isD:true, col:"#0f0", unlockWave:4 },
    armor: { n:"DAMAGE REDUCTION", d:"Reduces damage from every hit.", category:"DEFENSE", b:0, i:2, c:35, cm:1.28, isD:false, col:"#53d6ff", unlockWave:7, max:20 },
    dodge: { n:"DODGE CHANCE", d:"Chance to completely avoid a hit.", category:"DEFENSE", b:0, i:2, c:80, cm:1.38, isD:false, col:"#9b8cff", unlockWave:12, max:20 },
    shieldRecharge: { n:"SHIELD RECHARGE", d:"Shortens the shield's cooldown.", category:"DEFENSE", b:0, i:1, c:90, cm:1.4, isD:false, col:"#55f5dc", unlockWave:15, max:8 },
    range: { n:"TARGETING RANGE", d:"Detects enemies from farther away.", category:"UTILITY", b:300, i:50, c:30, cm:1.2, isD:false, col:"#ffd700", unlockWave:1, max:10 },
    cashBonus: { n:"CASH BONUS", d:"Earn more cash for every enemy defeated.", category:"UTILITY", b:0, i:10, c:45, cm:1.25, isD:false, col:"#ffd700", unlockWave:5, max:10 },
    waveBonus: { n:"WAVE INCOME", d:"Earn extra cash when a wave is cleared.", category:"UTILITY", b:0, i:5, c:55, cm:1.3, isD:false, col:"#ffd700", unlockWave:8, max:10 },
    projectileSpeed: { n:"PROJECTILE VELOCITY", d:"Your shots travel faster and reach enemies sooner.", category:"ATTACK", b:900, i:90, c:70, cm:1.45, isD:false, col:"#39d5ff", unlockWave:6, max:8 },
    bossDamage: { n:"BOSS HUNTER", d:"Deal bonus damage to Boss enemies.", category:"ATTACK", b:0, i:8, c:120, cm:1.5, isD:false, col:"#ff5b5b", unlockWave:12, max:10 },
    bulletGuard: { n:"ENERGY PLATING", d:"Reduce damage received from enemy attacks.", category:"DEFENSE", b:0, i:3, c:100, cm:1.45, isD:false, col:"#75e0ff", unlockWave:10, max:10 },
    waveRepair: { n:"WAVE REPAIR", d:"Restore a percentage of maximum health after each wave.", category:"DEFENSE", b:0, i:4, c:110, cm:1.45, isD:false, col:"#75ff9b", unlockWave:10, max:10 },
    bossBounty: { n:"BOSS BOUNTY", d:"Earn extra cash when defeating a Boss.", category:"UTILITY", b:0, i:15, c:130, cm:1.5, isD:false, col:"#ffd166", unlockWave:15, max:10 },
    salvage: { n:"SALVAGE PROTOCOL", d:"Gain extra cash from every defeated enemy.", category:"UTILITY", b:0, i:3, c:150, cm:1.48, isD:false, col:"#ffe66d", unlockWave:20, max:10 },
    plasmaCore: { n:"PLASMA CORE", d:"Increase damage dealt by all tower weapons.", category:"ATTACK", b:0, i:5, c:500, cm:1.55, isD:false, col:"#ff7bff", unlockWave:30, max:12 },
    precisionArray: { n:"PRECISION ARRAY", d:"Increase the chance of landing critical hits.", category:"ATTACK", b:0, i:2, c:650, cm:1.58, isD:false, col:"#ff6688", unlockWave:40, max:10 },
    executionProtocol: { n:"EXECUTION PROTOCOL", d:"Deal bonus damage to enemies below 30% health.", category:"ATTACK", b:0, i:8, c:900, cm:1.62, isD:false, col:"#ff5252", unlockWave:50, max:10 },
    overclockDrive: { n:"OVERCLOCK DRIVE", d:"Increase the tower's firing rate.", category:"ATTACK", b:0, i:4, c:1200, cm:1.65, isD:false, col:"#ffb347", unlockWave:60, max:10 },
    nanoMatrix: { n:"NANO MATRIX", d:"Continuously restore additional tower health.", category:"DEFENSE", b:0, i:2, c:550, cm:1.55, isD:false, col:"#62ffc4", unlockWave:70, max:10 },
    adaptiveArmor: { n:"ADAPTIVE ARMOR", d:"Further reduce damage from all incoming attacks.", category:"DEFENSE", b:0, i:2, c:800, cm:1.6, isD:false, col:"#64c8ff", unlockWave:80, max:10 },
    bossWard: { n:"BOSS WARD", d:"Reduce damage from Boss attacks.", category:"DEFENSE", b:0, i:4, c:1000, cm:1.62, isD:false, col:"#a88bff", unlockWave:90, max:10 },
    repairBurst: { n:"REPAIR BURST", d:"Restore more health whenever a wave is cleared.", category:"DEFENSE", b:0, i:3, c:1300, cm:1.65, isD:false, col:"#7dff8b", unlockWave:100, max:10 },
    waveDividend: { n:"WAVE DIVIDEND", d:"Earn extra cash every time a wave is cleared.", category:"UTILITY", b:0, i:8, c:600, cm:1.55, isD:false, col:"#ffe36e", unlockWave:110, max:10 },
    killContract: { n:"KILL CONTRACT", d:"Earn extra cash for every enemy defeated.", category:"UTILITY", b:0, i:5, c:850, cm:1.6, isD:false, col:"#ffd166", unlockWave:120, max:10 },
    bossContract: { n:"BOSS CONTRACT", d:"Earn bonus cash for defeating Boss enemies.", category:"UTILITY", b:0, i:20, c:1100, cm:1.65, isD:false, col:"#ffbf69", unlockWave:135, max:10 },
    coinCache: { n:"COIN CACHE", d:"Gain extra permanent coins when clearing waves.", category:"UTILITY", b:0, i:1, c:1500, cm:1.7, isD:false, col:"#ffe66d", unlockWave:150, max:10 }
  };

  const skillDefs = {
    start:{id:'start',req:null,cost:0,n:'Core Systems',d:'Unlocks the tower progression network.'},
    multishot:{id:'multishot',req:'start',cost:100,n:'Multi-Shot Core',d:'Adds a bonus shot to each firing burst.'},
    missiles:{id:'missiles',req:'multishot',cost:500,n:'Missile System',d:'Launches a homing blast every 2 seconds.'},
    lasers:{id:'lasers',req:'multishot',cost:650,n:'Laser Array',d:'Fires a piercing beam every 4 seconds.'},
    shield:{id:'shield',req:'start',cost:200,n:'Energy Shield',d:'Blocks one hit, then recharges.'},
    thorn:{id:'thorn',req:'shield',cost:400,n:'Reactive Plating',d:'Reflects 50% of collision damage.'},
    drone:{id:'drone',req:'missiles',cost:900,n:'Support Drone',d:'Fires an extra homing projectile every 3 seconds.'},
    overdrive:{id:'overdrive',req:'lasers',cost:900,n:'Overdrive',d:'Permanently increases attack speed by 25%.'},
    vampire:{id:'vampire',req:'shield',cost:750,n:'Nano-Repair',d:'Restores 2% of maximum health after each kill.'},
    fortify:{id:'fortify',req:'thorn',cost:1000,n:'Fortified Core',d:'Reduces all incoming damage by 10%.'}
  };

  const perkRarities = {
    common: {label:'COMMON', weight:62},
    rare: {label:'RARE', weight:25},
    epic: {label:'EPIC', weight:10},
    legendary: {label:'LEGENDARY', weight:3}
  };
  const perkDefs = [
    {id:'power',name:'Overcharged Core',icon:'✦',desc:'Increases tower damage.',values:{common:3,rare:5,epic:7,legendary:10},unit:'% DAMAGE',maxStacks:3},
    {id:'rapid',name:'Rapid Calibration',icon:'⚡',desc:'Increases attack speed.',values:{common:2,rare:4,epic:6,legendary:9},unit:'% FIRE RATE',maxStacks:3},
    {id:'fortune',name:'Golden Core',icon:'◈',desc:'Increases cash earned from enemy kills.',values:{common:5,rare:8,epic:12,legendary:18},unit:'% CASH',maxStacks:3},
    {id:'radar',name:'Extended Radar',icon:'◎',desc:'Increases tower targeting range.',values:{common:4,rare:7,epic:10,legendary:15},unit:'% RANGE',maxStacks:3},
    {id:'repair',name:'Nanite Repair',icon:'✚',desc:'Regenerates tower health every second.',values:{common:0.5,rare:1,epic:1.5,legendary:2.5},unit:'HP / SEC',maxStacks:3},
    {id:'overload',name:'Overload Protocol',icon:'✧',desc:'Boosts both damage and attack speed.',values:{common:3,rare:5,epic:7,legendary:10},speedValues:{common:2,rare:4,epic:6,legendary:8},unit:'% DAMAGE · FIRE RATE',maxStacks:3}
  ];
  function getPerkValue(id) {
    const owned=run.perks?.[id];
    if (typeof owned === 'number') return owned * (perkDefs.find(p=>p.id===id)?.values?.common || 0);
    if (!owned || typeof owned !== 'object') return 0;
    const perk=perkDefs.find(p=>p.id===id);
    return perk ? Object.entries(owned).reduce((sum,[rarity,count])=>sum+(perk.values[rarity]||0)*count,0) : 0;
  }
  function getPerkStacks(id) {
    const owned=run.perks?.[id];
    if (typeof owned === 'number') return owned;
    return owned && typeof owned === 'object' ? Object.values(owned).reduce((sum,count)=>sum+count,0) : 0;
  }
  function rollPerkOptions(available, count=3) {
    const pool=[...available], picks=[];
    const rarityKeys=Object.keys(perkRarities);
    while(pool.length && picks.length<count) {
      const total=rarityKeys.reduce((sum,key)=>sum+perkRarities[key].weight,0);
      let roll=Math.random()*total, rarity=rarityKeys[0];
      for(const key of rarityKeys){roll-=perkRarities[key].weight;if(roll<0){rarity=key;break;}}
      const index=Math.floor(Math.random()*pool.length);
      const perk=pool.splice(index,1)[0];
      picks.push({...perk,rarity});
    }
    return picks;
  }

  const achvDefs = [
    { id:'waves', n:'Wave Breaker', d:'Reach higher and higher waves.', metric:()=>player.highestWave, tiers:[5,10,20,35,50].map((v,i)=>({value:v,reward:[30,60,120,250,500][i]})) },
    { id:'bosses', n:'Boss Hunter', d:'Defeat bosses across all runs.', metric:()=>player.bossKills, tiers:[1,3,5,10,20].map((v,i)=>({value:v,reward:[50,100,200,400,800][i]})) },
    { id:'kills', n:'Enemy Eliminator', d:'Defeat enemies across all runs.', metric:()=>player.totalKills, tiers:[50,100,250,500,1000].map((v,i)=>({value:v,reward:[25,50,100,250,500][i]})) },
    { id:'time', n:'Dedicated Defender', d:'Total time spent playing.', metric:()=>Math.floor(player.playTime||0), tiers:[300,900,1800,3600,7200].map((v,i)=>({value:v,reward:[25,50,100,250,500][i]})), format:v=>v<3600?Math.floor(v/60)+' min':Math.floor(v/3600)+' h '+Math.floor((v%3600)/60)+' min' }
  ];

  /** SAVE SYSTEM **/
  let player = { coins: 0, highestWave: 1, totalKills: 0, bossKills: 0, playTime: 0, runsPlayed: 0, bestKills: 0, bestBosses: 0, bestDuration: 0, ws: {}, skills: ['start'], achievements: [], tutorialSeen: false };
  let run = {stats:{},cash:0,coins:0,wave:1,kills:0,combo:0,comboTimer:0,graze:0};
  let targetEnemy = null;
  let gameSessionStartedAt = 0;
  let gameDurationTracked = false;
  let gameSessionSource = 'site';

  function trackGameDuration(reason) {
    if (gameDurationTracked || !gameSessionStartedAt) return;
    gameDurationTracked = true;
    const durationSeconds = Math.max(0, Math.round((Date.now() - gameSessionStartedAt) / 1000));
    const roundedDuration = Math.round(durationSeconds / 10) * 10;
    const send = typeof window.neonTrack === 'function'
      ? window.neonTrack
      : (data) => {
          if (window.goatcounter && typeof window.goatcounter.count === 'function') window.goatcounter.count(data);
        };
    send({
      path: 'game-duration-' + roundedDuration + '-seconds',
      title: 'Game duration: about ' + roundedDuration + ' seconds',
      event: true,
      no_session: true
    });
    if (reason === 'exit') {
      send({ path: 'game-exit', title: 'Game closed before game over', event: true, no_session: true });
    }
  }

  window.addEventListener('pagehide', function() {
    if (gameSessionStartedAt && !gameDurationTracked) trackGameDuration('exit');
  });

  function saveGame() { localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(player))); updateMenuUI(); }
  function refreshResumeUI() {
    const panel = document.getElementById('resume-run-panel');
    const startButton = document.getElementById('start-new-run-button');
    let checkpoint = null;
    try { checkpoint = JSON.parse(localStorage.getItem(RUN_CHECKPOINT_KEY) || 'null'); } catch (err) {}
    const exists = !!(checkpoint && checkpoint.version === 1 && checkpoint.run);
    if (panel) {
      panel.style.display = exists ? 'block' : 'none';
      const waveLabel = document.getElementById('resume-run-wave');
      if (waveLabel) waveLabel.textContent = exists ? 'WAVE ' + checkpoint.run.wave : '';
    }
    if (startButton) startButton.textContent = exists ? 'NEW RUN' : 'START GAME';
  }
  function saveRunCheckpoint(pendingPerk = false) {
    if (!game || !game.running || !tower) return;
    try {
      const previous = JSON.parse(localStorage.getItem(RUN_CHECKPOINT_KEY) || 'null');
      const savedRun = JSON.parse(JSON.stringify(run));
      if (previous && previous.run && Number(previous.run.wave) === Number(run.wave)) {
        ['kills','bossKills','elapsed','mission','graze','combo','comboTimer'].forEach(key => {
          if (previous.run[key] !== undefined) savedRun[key] = previous.run[key];
        });
      }
      localStorage.setItem(RUN_CHECKPOINT_KEY, JSON.stringify({
        version: 1,
        run: savedRun,
        tower: { hp: tower.hp, shield: tower.shield },
        pendingPerk: !!pendingPerk
      }));
    } catch (err) { console.warn('Could not save run checkpoint', err); }
    refreshResumeUI();
  }
  function clearRunCheckpoint() {
    localStorage.removeItem(RUN_CHECKPOINT_KEY);
    refreshResumeUI();
  }
  window.refreshResumeUI = refreshResumeUI;
  window.saveRunCheckpoint = saveRunCheckpoint;
  function loadGame() { 
    const s = localStorage.getItem(SAVE_KEY); 
    if(s) { try { let p=JSON.parse(atob(s)); player={...player,...p}; player.ws={...player.ws,...(p.ws||{})}; } catch(err) { console.warn("Invalid save data",err); localStorage.removeItem(SAVE_KEY); } }
    Object.keys(statDefs).forEach(k => { if(player.ws[k]===undefined) player.ws[k]=0; });
    updateMenuUI(); buildSkillTree();
  }
  function resetSave() { if(confirm("Delete all progress?")) { localStorage.removeItem(SAVE_KEY); location.reload(); } }

  function checkAchievements() {
    let changed = false;
    achvDefs.forEach(a => {
      const metric = a.metric();
      a.tiers.forEach((tier, index) => {
        const key = a.id + '_' + (index + 1);
        // Preserve the three legacy achievements as their first star.
        const legacy = (a.id === 'waves' && index === 1 && player.achievements.includes('w10')) ||
          (a.id === 'waves' && index === 2 && player.achievements.includes('w30')) ||
          (a.id === 'kills' && index === 1 && player.achievements.includes('k100'));
        if(metric >= tier.value && !player.achievements.includes(key)) {
          player.achievements.push(key); player.coins += tier.reward; changed = true;
          if(!legacy) notify('🏆 ACHIEVEMENT · ' + a.n, '★ ' + (index+1) + ' · +' + tier.reward + ' Coins');
        }
      });
    });
    if(changed) saveGame();
  }

  function showPerkChoice() {
    if(!game || !game.running) return;
    const available = perkDefs.filter(p => getPerkStacks(p.id) < p.maxStacks);
    if (!available.length) { notify('PERKS MAXED', 'All run perks have reached their limits.'); return; }
    game.paused = true;
    const panel = document.getElementById('perk-choice');
    const picks = rollPerkOptions(available,3);
    panel.innerHTML = '<div class="perk-dialog"><span class="perk-eyebrow">MILESTONE REACHED</span><h2>CHOOSE A PERK</h2><p>Each perk can appear in four rarities. Higher rarities have stronger effects.</p><div class="perk-options">'+picks.map(p=>{
      const amount=p.values[p.rarity], speed=p.speedValues?.[p.rarity];
      const effect=p.id==='overload' ? '+'+amount+'% DAMAGE · +'+speed+'% FIRE RATE' : '+'+amount+(Number.isInteger(amount)?'': '')+p.unit;
      return '<button class="perk-option rarity-'+p.rarity+'" onclick="choosePerk(\''+p.id+'\',\''+p.rarity+'\')"><span>'+p.icon+'</span><strong>'+p.name+'</strong><small class="perk-rarity-label">'+perkRarities[p.rarity].label+'</small><small>'+p.desc+'</small><small class="perk-stack-limit">'+effect+'</small><span class="perk-stars" aria-label="'+getPerkStacks(p.id)+' of '+p.maxStacks+' perk stars">'+'★'.repeat(getPerkStacks(p.id))+'<span class="perk-star-empty">'+'☆'.repeat(p.maxStacks-getPerkStacks(p.id))+'</span></span></button>';
    }).join('')+'</div></div>';
    panel.classList.add('visible');
  }

  function renderRunPerks() {
    const container = document.getElementById('run-perks-content');
    if (!container) return;
    const owned = perkDefs.filter(perk => getPerkStacks(perk.id) > 0);
    if (!owned.length) {
      container.innerHTML = '<div class="perks-empty"><span>◇</span><strong>NO PERKS YET</strong><small>Reach milestone waves and choose perks to build your run.</small></div>';
      return;
    }
    container.innerHTML = owned.map(perk => {
      const stacks=run.perks[perk.id];
      const total=getPerkStacks(perk.id);
      const rarityLines=typeof stacks==='number' ? '<small class="perk-rarity-label rarity-common">COMMON ×'+stacks+'</small>' : Object.entries(stacks).filter(([,count])=>count>0).map(([rarity,count])=>'<small class="perk-rarity-label rarity-'+rarity+'">'+perkRarities[rarity].label+' ×'+count+'</small>').join('');
      const effect=perk.id==='overload'
        ? '+'+getPerkValue('overload')+'% DAMAGE · +'+Object.entries(stacks||{}).reduce((sum,[rarity,count])=>sum+(perk.speedValues[rarity]||0)*count,0)+'% FIRE RATE'
        : '+'+getPerkValue(perk.id)+perk.unit;
      const stars='<span class="perk-stars" aria-label="'+total+' of '+perk.maxStacks+' perk stars">'+'★'.repeat(total)+'<span class="perk-star-empty">'+'☆'.repeat(perk.maxStacks-total)+'</span></span>';
      return '<div class="run-perk-card"><span class="run-perk-icon">' + perk.icon + '</span><div class="run-perk-info"><strong>' + perk.name + '</strong>' + stars + rarityLines + '<small>' + effect + '</small></div></div>';
    }).join('');
  }

  function choosePerk(id, rarity='common') {
    const selectedPerk = perkDefs.find(p=>p.id===id);
    if(!selectedPerk || !perkRarities[rarity]) return;
    run.perks=run.perks||{};
    if(getPerkStacks(id) >= selectedPerk.maxStacks) return;
    if(typeof run.perks[id] !== 'object') run.perks[id] = {};
    run.perks[id][rarity]=(run.perks[id][rarity]||0)+1;
    renderRunPerks();
    const panel=document.getElementById('perk-choice');
    panel.classList.remove('visible'); panel.innerHTML='';
    if(id==='repair' && tower) tower.hp=Math.min(tower.maxHp,tower.hp+selectedPerk.values[rarity]*4);
    game.paused=false; game.last=performance.now(); updateHUD();
    saveRunCheckpoint(false);
    notify('PERK UNLOCKED',selectedPerk.name+' · '+perkRarities[rarity].label);
  }

  // Notifications are disabled globally; keep this function as a no-op
  // so existing game events continue working without showing pop-ups.
  function notify(title, msg) { return; }

  function getVal(k, wsO=false) { const d=statDefs[k]; let l=(player.ws[k]||0)+(wsO?0:(run.stats[k]||0)); let v=k==='regen'?(l>0?0.2*Math.pow(1.075,l-1):0):(d.b+(l*d.i)); return d.isD?v.toFixed(2):Math.floor(v); }
  function getCost(k, isW) { const d=statDefs[k]; let l=isW?player.ws[k]:(run.stats[k]||0); return Math.floor(d.c*Math.pow(d.cm, l)); }
  function hasSkill(id) { return player.skills.includes(id); }

  function getWaveEnemyCount(wave) {
    const w = Math.max(1, Math.floor(Number(wave) || 1));
    if (w <= 20) return 9 + Math.floor(w * 1.25);
    if (w <= 50) return 34 + Math.floor((w - 20) * 0.7);
    if (w <= 100) return 55 + Math.floor((w - 50) * 0.3);
    return 70 + Math.floor((w - 100) * 0.35);
  }

  /** MAIN LOOP & RENDERING **/
  function startGame() {
    clearRunCheckpoint();
    if (!player.tutorialSeen) {
      document.getElementById('tutorial').classList.add('visible');
      return;
    }
    AudioSys.init();
    gameSessionStartedAt = Date.now();
    gameDurationTracked = false;
    gameSessionSource = 'site';
    document.getElementById('menu').classList.remove('active-layer'); document.getElementById('hud').classList.add('active-hud');
    run = { stats: {}, cash: 0, coins: 0, wave: 1, kills: 0, bossKills: 0, elapsed: 0, perks: {} };
    const missionOptions = [
      {id:'waves', title:'REACH WAVE 5', description:'Clear waves until you reach wave 5.', target:5, reward:25},
      {id:'kills', title:'ELIMINATE 30 ENEMIES', description:'Defeat 30 enemies during this run.', target:30, reward:25},
      {id:'survive', title:'SURVIVE 2 MINUTES', description:'Stay alive for 120 seconds.', target:120, reward:25}
    ];
    document.getElementById('mission-ui')?.classList.remove('mission-complete');
    run.mission = {...missionOptions[Math.floor(Math.random()*missionOptions.length)], progress:0, complete:false};
    document.getElementById('mission-title').textContent = run.mission.title;
    document.getElementById('mission-desc').textContent = run.mission.description;
    document.getElementById('mission-reward').textContent = '+' + run.mission.reward + ' COINS';
    document.getElementById('mission-progress').textContent = '0 / ' + run.mission.target;
    document.getElementById('mission-fill').style.width = '0%';
    Object.keys(statDefs).forEach(k => run.stats[k]=0);
    
    game = { running: true, paused:false, dt: 0, last: performance.now(), shake: 0, playSaveT: 0, achievementCheckT: 0, spawnT: 0.25, toSpawn: 10, ents: { e:[], p:[], b:[], part:[], txt:[] }, cx: canvas.width/2, cy: canvas.height/2 };
    
    tower = new Tower(); 
    initUpgBar();
    saveRunCheckpoint(false);
    updateHUD();
    requestAnimationFrame(loop);
    if (typeof window.neonTrack === 'function') {
      window.neonTrack({ path: 'game-start', title: 'Game started', event: true, no_session: true });
    } else if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: 'game-start', title: 'Game started', event: true, no_session: true });
    }
  }

  function processGameOver(reason = 'defeat') {
    if(!game || !game.running) return;
    game.running = false;
    clearRunCheckpoint();
    trackGameDuration('completed');
    if (typeof window.neonTrack === 'function') {
      window.neonTrack({ path: 'game-end', title: reason === 'voluntary' ? 'Game ended voluntarily' : 'Game ended normally', event: true, no_session: true });
    } else if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: 'game-end', title: reason === 'voluntary' ? 'Game ended voluntarily' : 'Game ended normally', event: true, no_session: true });
    } document.getElementById('hud').classList.remove('active-hud'); document.getElementById('gameover').classList.add('active-layer');
    document.getElementById('go-wave').innerText = run.wave;
    document.getElementById('go-kills').innerText = run.kills;
    document.getElementById('go-bosses').innerText = run.bossKills || 0;
    document.getElementById('go-time').innerText = formatRunTime(run.elapsed || 0);
    player.coins += run.coins;
    if(run.wave > player.highestWave) player.highestWave = run.wave;
    player.runsPlayed = (player.runsPlayed || 0) + 1;
    player.bestKills = Math.max(player.bestKills || 0, run.kills);
    player.bestBosses = Math.max(player.bestBosses || 0, run.bossKills || 0);
    player.bestDuration = Math.max(player.bestDuration || 0, run.elapsed || 0);
    document.getElementById('go-best').innerText = player.highestWave;
    document.getElementById('go-record-kills').innerText = player.bestKills;
    document.getElementById('go-record-time').innerText = formatRunTime(player.bestDuration);
    document.getElementById('go-runs').innerText = player.runsPlayed;
    document.getElementById('go-coins').innerText = "+"+run.coins+" COINS";
    checkAchievements(); saveGame();
    if (typeof submitLeaderboardResult === 'function') submitLeaderboardResult(run);
  }
  function resumeRun() {
    let checkpoint = null;
    try { checkpoint = JSON.parse(localStorage.getItem(RUN_CHECKPOINT_KEY) || 'null'); } catch (err) {}
    if (!checkpoint || checkpoint.version !== 1 || !checkpoint.run || !Number.isFinite(Number(checkpoint.run.wave))) {
      clearRunCheckpoint();
      return;
    }
    if (!player.tutorialSeen) {
      document.getElementById('tutorial').classList.add('visible');
      return;
    }
    AudioSys.init();
    gameSessionStartedAt = Date.now();
    gameDurationTracked = false;
    gameSessionSource = 'resume';
    document.getElementById('menu').classList.remove('active-layer');
    document.getElementById('gameover').classList.remove('active-layer');
    document.getElementById('hud').classList.add('active-hud');
    run = checkpoint.run;
    game = {
      running:true, paused:!!checkpoint.pendingPerk, dt:0, last:performance.now(),
      shake:0, playSaveT:0, achievementCheckT:0, spawnT:0.25,
      toSpawn:getWaveEnemyCount(run.wave),
      ents:{e:[],p:[],b:[],part:[],txt:[]},
      cx:canvas.width/2, cy:canvas.height/2
    };
    tower = new Tower();
    if (checkpoint.tower) {
      tower.hp = Math.max(0, Math.min(tower.maxHp, Number(checkpoint.tower.hp) || tower.maxHp));
      tower.shield = !!checkpoint.tower.shield && hasSkill('shield');
    }
    initUpgBar();
    updateHUD();
    refreshResumeUI();
    if (checkpoint.pendingPerk) showPerkChoice();
    requestAnimationFrame(loop);
  }
  window.resumeRun = resumeRun;

  function requestEndRun() {
    if (!game || !game.running) return;
    const confirmed = window.confirm('END THIS RUN? Your current score will be saved and submitted if it qualifies for the leaderboard.');
    if (confirmed) processGameOver('voluntary');
  }
  window.requestEndRun = requestEndRun;

  function updateMissionProgress() {
    if (!run.mission || run.mission.complete) return;
    const mission = run.mission;
    mission.progress = mission.id === 'waves' ? run.wave : mission.id === 'kills' ? run.kills : Math.floor(run.elapsed);
    const current = Math.min(mission.target, mission.progress);
    const value = mission.id === 'survive' ? current + ' / ' + mission.target + 's' : current + ' / ' + mission.target;
    const label = document.getElementById('mission-progress');
    if (label) label.textContent = value;
    const fill = document.getElementById('mission-fill');
    if (fill) fill.style.width = (current / mission.target * 100) + '%';
    if (mission.progress >= mission.target) {
      mission.complete = true;
      document.getElementById('mission-ui')?.classList.add('mission-complete');
      run.coins += mission.reward;
      notify('MISSION COMPLETE', '+' + mission.reward + ' COINS');
      const title = document.getElementById('mission-title');
      if (title) title.textContent = 'MISSION COMPLETE';
      const reward = document.getElementById('mission-reward');
      if (reward) reward.textContent = '+' + mission.reward + ' COINS';
    }
  }

  function confirmTutorialStart() {
    const tutorial = document.getElementById('tutorial');
    tutorial.classList.remove('visible');
    player.tutorialSeen = true;
    saveGame();
    startGame();
  }

  function formatRunTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    return minutes + ':' + String(total % 60).padStart(2, '0');
  }
  function returnToMenu() { document.getElementById('gameover').classList.remove('active-layer'); document.getElementById('menu').classList.add('active-layer'); updateMenuUI(); }

  let bgOffset = 0;
  function drawGrid(dt) {
    bgOffset = (bgOffset + 20 * dt) % 40;
    ctx.lineWidth = 1;
    let camOffsetX = (canvas.width/2 - game.cx) % 40;

    for(let y = 0; y < canvas.height; y+=40) {
      let alpha = y/canvas.height; ctx.strokeStyle = `rgba(0, 255, 255, ${0.1 * alpha})`;
      ctx.beginPath(); ctx.moveTo(0, (y + bgOffset)); ctx.lineTo(canvas.width, (y + bgOffset)); ctx.stroke();
    }
    for(let x = -40; x < canvas.width + 40; x+=40) {
      ctx.strokeStyle = `rgba(0, 255, 255, 0.05)`;
      ctx.beginPath(); ctx.moveTo(x + camOffsetX, 0); ctx.lineTo(x + camOffsetX, canvas.height); ctx.stroke();
    }
  }

  function loop(ts) {
    if(!game.running) return; requestAnimationFrame(loop);
    if(game.paused) { game.last = ts; return; }
    game.dt = (ts - game.last)/1000; if(game.dt > 0.1) game.dt = 0.1; game.last = ts;
    player.playTime = (player.playTime || 0) + game.dt;
    game.achievementCheckT += game.dt; game.playSaveT += game.dt;
    run.elapsed = (run.elapsed || 0) + game.dt;
    updateMissionProgress();
    if(game.achievementCheckT >= 1) { game.achievementCheckT = 0; checkAchievements(); }
    if(game.playSaveT >= 15) { game.playSaveT = 0; saveGame(); }

    // Keep the tower and the action centered. Opening a UI panel must not move gameplay sideways.
    game.cx = canvas.width / 2;
    game.cy = canvas.height / 2;
    tower.x = game.cx;
    tower.y = game.cy;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrid(game.dt);
    
    if(game.shake > 0) {
      game.shake -= game.dt;
      canvas.style.setProperty('--shake-x', `${(Math.random()-0.5)*4}px`);
      canvas.style.setProperty('--shake-y', `${(Math.random()-0.5)*4}px`);
    } else {
      canvas.style.setProperty('--shake-x', '0px');
      canvas.style.setProperty('--shake-y', '0px');
    }

    if(game.toSpawn <= 0 && game.ents.e.length === 0) {
      run.wave++;
      if(tower) { const repairPct=parseFloat(getVal('waveRepair'))+parseFloat(getVal('repairBurst')); if(repairPct>0) tower.hp=Math.min(tower.maxHp,tower.hp+tower.maxHp*repairPct/100); }
      game.toSpawn = getWaveEnemyCount(run.wave);
      run.coins += Math.max(1, Math.floor((Math.floor(run.wave/2) + 2 + Math.floor(parseFloat(getVal('coinCache'))) ) * 0.4)); run.cash += Math.floor(parseFloat(getVal('waveBonus')) + Math.floor(run.wave*parseFloat(getVal('waveDividend'))/100));
      updateHUD(); AudioSys.coin(); checkAchievements();
      const milestonePerk = (run.wave-1)%5===0;
      if(milestonePerk) showPerkChoice();
      saveRunCheckpoint(milestonePerk); 
    }
    game.spawnT -= game.dt;
    if(game.spawnT <= 0 && game.toSpawn > 0) { game.ents.e.push(new Enemy(run.wave)); game.toSpawn--; game.spawnT = Math.max(0.48, 0.82 - (run.wave*0.006)); updateHUD(); }

    tower.update(game.dt); tower.draw();run.comboTimer=Math.max(0,run.comboTimer-game.dt);if(!run.comboTimer)run.combo=0;

    for(let i = game.ents.p.length - 1; i >= 0; i--) {
      let p = game.ents.p[i]; p.update(game.dt); p.draw();
      if(p.x<0||p.x>canvas.width||p.y<0||p.y>canvas.height || p.dead) { game.ents.p.splice(i,1); continue; }
      
      let hitSomething = false;
      for(let j = game.ents.e.length - 1; j >= 0; j--) {
        let e = game.ents.e[j];
        if(p instanceof Missile) {
            if(p.collide(e, game.ents.e)) { hitSomething = true; break; }
        } 
        else if(p.collide(e)) {
          let dmg = p instanceof Laser ? p.d * game.dt : p.d;
          if(e.type === 'Boss') dmg *= 1 + parseFloat(getVal('bossDamage'))/100;
          if(e.hp <= e.maxHp*0.3) dmg *= 1 + parseFloat(getVal('executionProtocol'))/100;
          if(!(p instanceof Laser)) {
             game.ents.txt.push(new FText(e.x, e.y-e.r, Math.floor(dmg), p.crit ? "#ff3366" : "#fff", p.crit ? 24 : 14));
             createParts(p.x, p.y, p.crit ? "#ff3366" : "#0ff", p.crit?10:3, 3);
          }
          if(e.hit(dmg)) { game.ents.e.splice(j,1); updateHUD(); }
          
          if(p instanceof Laser) { /* Pierce */ } 
          else { hitSomething = true; break; }
        }
      }
      if(hitSomething) game.ents.p.splice(i,1);
    }

    for(let i=game.ents.b.length-1;i>=0;i--){let b=game.ents.b[i];b.update(game.dt);b.draw();let d=MathUtils.dist(b.x,b.y,tower.x,tower.y);if(d<tower.r+b.r){if(tower.invuln<=0)tower.hit(b.damage,b.kind==='boss'?{type:'Boss'}:null);bulletPool.release(b);game.ents.b.splice(i,1);continue;}if(!b.grazed&&d<tower.r+b.r+18){b.grazed=true;run.graze++;AudioSys.play('graze',1500,900,'sine',.08,.08);}if(b.x<-30||b.x>canvas.width+30||b.y<-30||b.y>canvas.height+30){bulletPool.release(b);game.ents.b.splice(i,1);}}
    for(let i = game.ents.e.length - 1; i >= 0; i--) {
      let e = game.ents.e[i];
      if(e.hp <= 0) { game.ents.e.splice(i,1); continue; } 
      e.update(game.dt); e.draw();
      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      const distance = Math.hypot(dx, dy) || 1;
      const contactDistance = tower.r + e.r + 2;
      if(e.isAttackingTower) {
        // Hold each attacker in its own evenly distributed position around the tower.
        e.x = tower.x + Math.cos(e.contactAngle) * contactDistance;
        e.y = tower.y + Math.sin(e.contactAngle) * contactDistance;
        e.contactDamageTimer -= game.dt;
        if(e.contactDamageTimer <= 0) {
          tower.hit(e.dmg, e);
          e.contactDamageTimer = 1;
        }
      } else if(distance < contactDistance) {
        // Assign a stable, spread-out position as soon as this enemy reaches the tower.
        e.isAttackingTower = true;
        e.contactAngle = Math.atan2(dy, dx) + (i * 2.399963229728653);
        e.contactDamageTimer = 0.35 + (Math.abs(Math.sin(e.phase)) * 0.65);
        e.x = tower.x + Math.cos(e.contactAngle) * contactDistance;
        e.y = tower.y + Math.sin(e.contactAngle) * contactDistance;
      }
    }
    
    for(let i = game.ents.part.length - 1; i >= 0; i--) { let p = game.ents.part[i]; p.update(game.dt); p.draw(); if(p.l<=0) game.ents.part.splice(i,1); }
    for(let i = game.ents.txt.length - 1; i >= 0; i--) { let t = game.ents.txt[i]; t.update(game.dt); t.draw(); if(t.l<=0) game.ents.txt.splice(i,1); }
    
    updateHUD(); 
  }