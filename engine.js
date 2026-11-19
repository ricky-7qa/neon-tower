
  /** CORE ENGINE & DATA **/
  const SAVE_KEY = "NeonTowerApexSave_FinalVersion";
  const RUN_CHECKPOINT_KEY = "NeonTowerApexRunCheckpoint";
  const LEVEL_RUN_CHECKPOINT_KEY = "NeonTowerApexLevelRunCheckpoint";
  function getRunCheckpointKey(mode = null) { const selectedMode = mode || (pendingLevelModeId ? "level" : (run.mode || "infinite")); return selectedMode === "level" ? LEVEL_RUN_CHECKPOINT_KEY : RUN_CHECKPOINT_KEY; }
  function readRunCheckpoint(mode) { try { return JSON.parse(localStorage.getItem(getRunCheckpointKey(mode)) || "null"); } catch (err) { return null; } }
  function getLatestRunCheckpoint() {
    const infinite = readRunCheckpoint("infinite"), level = readRunCheckpoint("level");
    if (infinite && infinite.version === 1 && infinite.run && level && level.version === 1 && level.run) return (Number(level.savedAt) || 0) > (Number(infinite.savedAt) || 0) ? level : infinite;
    return level && level.version === 1 && level.run ? level : infinite;
  }
  function formatMoney(value) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount < 1000000) return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const suffix = amount >= 1e9 ? 'B' : 'M';
    const scaled = amount / (suffix === 'B' ? 1e9 : 1e6);
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return scaled.toFixed(digits) + suffix;
  }

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
    enabled: localStorage.getItem('neonTowerSoundEnabled') !== 'false',
    init() {
      if(this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 0.3 : 0; this.master.connect(this.ctx.destination);
    },
    setEnabled(enabled) {
      this.enabled = !!enabled;
      localStorage.setItem('neonTowerSoundEnabled', this.enabled ? 'true' : 'false');
      if(this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.3 : 0, this.ctx.currentTime, 0.02);
      return this.enabled;
    },
    play(type, freqStart, freqEnd, typeW, duration, vol) {
      if(!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
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
    damage: { n: "DAMAGE", d: "Each level adds damage using a growing increment: the added amount compounds by +7% (levels 2–30), +5% (31–60), +3% (61–100), +2% (101–200), then progressively smaller rates.", category:"ATTACK", b:15, i:5, c:10, cm:1.15, isD:false, col:"#0ff", unlockWave:1 },
    speed: { n:"ATTACK SPEED", d:"Each level adds shots per second using a growing increment. Maximum level: 20 until Wave 100, then 35.", category:"ATTACK", b:1.5, i:.2, c:15, cm:1.25, isD:true, col:"#0ff", unlockWave:1, max:20 },
    critC: { n:"CRITICAL CHANCE", d:"Chance for a critical hit.", category:"ATTACK", b:0, i:5, c:50, cm:1.4, isD:false, col:"#ff3366", unlockWave:3, max:15 },
    critD: { n:"CRITICAL DAMAGE", d:"Multiplier applied to critical hits.", category:"ATTACK", b:1.5, i:.2, c:50, cm:1.4, isD:true, col:"#ff3366", unlockWave:5 },
    multishot: { n:"MULTI-SHOT", d:"Fire up to four homing projectiles at one target.", category:"ATTACK", b:0, i:1, c:100, cm:1.42, isD:false, col:"#ff9b42", max:3, unlockWave:5 },
    hp: { n:"MAX HEALTH", d:"Each level adds maximum health using a growing increment: +4% (levels 2–30), +3% (31–60), +2% (61–100), +1.5% (101–200), then progressively smaller rates.", category:"DEFENSE", b:200, i:30, c:10, cm:1.15, isD:false, col:"#0f0", unlockWave:1 },
    regen: { n:"HEALTH REGEN", d:"Starts at 0.5 HP per second. Each level adds a larger regeneration increase than the previous level; that increase grows by +15% per level (levels 2–10), then +10%, +7%, +4%, +2%, +1%, +0.5%, and +0.25% from level 501 onward.", category:"DEFENSE", b:0, i:0.5, c:25, cm:1.3, isD:true, col:"#0f0", unlockWave:4 },
    armor: { n:"DAMAGE REDUCTION", d:"Reduces damage from every hit.", category:"DEFENSE", b:0, i:2, c:35, cm:1.28, isD:false, col:"#53d6ff", unlockWave:7, max:20 },
    defensePercent: { n:"DEFENSE BOOST", d:"Reduce all incoming damage by 0.5% per level. Maximum damage reduction: 49.5%.", category:"DEFENSE", b:0, i:0.5, c:45, cm:1.12587, isD:true, col:"#70e6ff", unlockWave:10, max:99, workshopMax:50 },
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
    multishot:{id:'multishot',req:'start',cost:70,n:'Multi-Shot Core',d:'Improves Multi-Shot projectile guidance and homing speed.'},
    missiles:{id:'missiles',req:'multishot',cost:325,n:'Missile System',d:'Launches a homing blast every 2 seconds.'},
    lasers:{id:'lasers',req:'multishot',cost:400,n:'Laser Array',d:'Fires a piercing beam every 4 seconds.'},
    shield:{id:'shield',req:'start',cost:140,n:'Energy Shield',d:'Blocks one hit, then recharges.'},
    thorn:{id:'thorn',req:'shield',cost:260,n:'Reactive Plating',d:'Reflects 50% of collision damage.'},
    drone:{id:'drone',req:'missiles',cost:575,n:'Support Drone',d:'Fires an extra homing projectile every 3 seconds.'},
    overdrive:{id:'overdrive',req:'lasers',cost:575,n:'Overdrive',d:'Permanently increases attack speed by 25%.'},
    vampire:{id:'vampire',req:'shield',cost:475,n:'Nano-Repair',d:'Restores 2% of maximum health after each kill.'},
    fortify:{id:'fortify',req:'thorn',cost:650,n:'Fortified Core',d:'Reduces all incoming damage by 10%.'}
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
    {id:'repair',name:'Nanite Repair',icon:'✚',desc:'Regenerates a percentage of maximum tower health every second.',values:{common:2,rare:5,epic:10,legendary:15},unit:'% MAX HP / SEC',maxStacks:3},
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
  let player = { coins: 0, highestWave: 1, totalKills: 0, bossKills: 0, playTime: 0, runsPlayed: 0, bestKills: 0, bestBosses: 0, bestDuration: 0, ws: {}, freeUpgradeChances: {ATTACK:0,DEFENSE:0,UTILITY:0}, speedControlLevel: 0, skills: ['start'], achievements: [], tutorialSeen: false, bannerId: 'default', titleId: 'none', startedAt: Date.now(), levelMode: { highestUnlocked: 1, completed: [], claimedRewards: [] } };
  let run = {stats:{},cash:0,coins:0,wave:1,kills:0,combo:0,comboTimer:0,graze:0};
  let targetEnemy = null;
  let gameSessionStartedAt = 0;
  let gameDurationTracked = false;
  let gameSessionSource = 'site';

  let selectedGameSpeed = 1;
  const SPEED3_CRAFT_DURATION = 24 * 60 * 60 * 1000;
  function completeSpeed3Fabrication() {
    if (Number(player.speedControlLevel) >= 3) return true;
    const startedAt = Number(player.speed3CraftStartedAt) || 0;
    if (startedAt && Date.now() - startedAt >= SPEED3_CRAFT_DURATION) {
      player.speedControlLevel = 3;
      player.speed3CraftStartedAt = 0;
      saveGame();
      return true;
    }
    return false;
  }
  function getUnlockedGameSpeeds() {
    if (run.mode === 'level') return [1];
    completeSpeed3Fabrication();
    const level = Math.max(0, Math.min(3, Number(player.speedControlLevel) || 0));
    return [1, ...(level >= 1 ? [1.5] : []), ...(level >= 2 ? [2] : []), ...(level >= 3 ? [3] : [])];
  }
  function isBossSpeedLockActive() {
    return !!(game && game.ents && game.ents.e && game.ents.e.some(enemy => enemy.type === 'Boss' && enemy.hp > 0));
  }
  function getEffectiveGameSpeed() {
    return run.mode === 'level' || isBossSpeedLockActive() ? 1 : selectedGameSpeed;
  }
  function updateGameSpeedButton() {
    const button = document.getElementById('game-speed-btn');
    if (!button) return;
    const unlocked = getUnlockedGameSpeeds();
    const hasSpeedUpgrade = unlocked.length > 1;
    button.style.display = hasSpeedUpgrade ? 'inline-flex' : 'none';
    button.disabled = !hasSpeedUpgrade || !game || !game.running;
    button.textContent = isBossSpeedLockActive() ? 'BOSS · 1X' : 'SPEED · ' + getEffectiveGameSpeed() + 'X';
    button.classList.toggle('speed-boost-active', !isBossSpeedLockActive() && selectedGameSpeed > 1);
  }
  function cycleGameSpeed() {
    if (!game || !game.running) return;
    const speeds = getUnlockedGameSpeeds();
    if (speeds.length < 2) return;
    const current = speeds.indexOf(selectedGameSpeed);
    selectedGameSpeed = speeds[(current + 1) % speeds.length];
    updateGameSpeedButton();
  }
  window.cycleGameSpeed = cycleGameSpeed;

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

  function saveGame(immediateCloud = false, markProgress = true) {
    if (markProgress) player.localSaveAt = Date.now();
    localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(player)));
    updateMenuUI();
    if (typeof window.scheduleNeonCloudSave === 'function') window.scheduleNeonCloudSave(immediateCloud);
  }
  function refreshResumeUI() {
    const infiniteCheckpoint = readRunCheckpoint('infinite');
    const levelCheckpoint = readRunCheckpoint('level');
    const infiniteExists = !!(infiniteCheckpoint && infiniteCheckpoint.version === 1 && infiniteCheckpoint.run && Number.isFinite(Number(infiniteCheckpoint.run.wave)));
    // Only show Resume Level when there is a genuine, resumable Level Mode checkpoint.
    const levelExists = !!(
      levelCheckpoint &&
      levelCheckpoint.version === 1 &&
      levelCheckpoint.run &&
      levelCheckpoint.run.mode === 'level' &&
      Number.isFinite(Number(levelCheckpoint.run.levelId)) &&
      Number.isFinite(Number(levelCheckpoint.run.wave))
    );
    const panel = document.getElementById('resume-run-panel');
    const levelPanel = document.getElementById('resume-level-panel');
    const startButton = document.getElementById('start-new-run-button');
    const primaryAction = document.querySelector('#menu .menu-primary-action');
    if (panel) {
      panel.style.display = infiniteExists ? 'flex' : 'none';
      const waveLabel = document.getElementById('resume-run-wave');
      if (waveLabel) waveLabel.textContent = infiniteExists ? 'WAVE ' + infiniteCheckpoint.run.wave : '';
    }
    const levelEntry = levelPanel?.parentElement;
    if (levelEntry) levelEntry.classList.toggle('has-resume-level', levelExists);
    if (levelPanel) {
      levelPanel.style.display = levelExists ? 'flex' : 'none';
      const levelDetails = document.getElementById('resume-level-details');
      if (levelDetails) {
        const savedLevel = Math.max(1, Number(levelCheckpoint?.run?.levelId) || 1);
        const savedWave = Math.max(1, Number(levelCheckpoint?.run?.wave) || 1);
        levelDetails.textContent = 'LEVEL ' + savedLevel + ' · WAVE ' + savedWave;
      }
    }
    if (primaryAction) primaryAction.classList.toggle('has-resume', infiniteExists);
    if (startButton) startButton.textContent = infiniteExists ? 'NEW RUN' : 'START INFINITE MODE';
  }
  function saveRunCheckpoint(pendingPerk = false, pendingDecision = false, pendingFreeUpgrades = null) {
    if (!game || !game.running || !tower) return;
    try {
      const checkpointKey = getRunCheckpointKey();
      const previous = readRunCheckpoint(run.mode);
      const savedRun = JSON.parse(JSON.stringify(run));
      if (previous && previous.run && Number(previous.run.wave) === Number(run.wave)) {
        ['kills','bossKills','elapsed','mission','graze','combo','comboTimer'].forEach(key => {
          if (previous.run[key] !== undefined) savedRun[key] = previous.run[key];
        });
      }
      localStorage.setItem(checkpointKey, JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        run: savedRun,
        tower: { hp: tower.hp, shield: tower.shield, tempShieldCharges: tower.tempShieldCharges || 0 },
        pendingPerk: !!pendingPerk,
        pendingDecision: !!pendingDecision,
        pendingFreeUpgrades: Array.isArray(pendingFreeUpgrades) ? pendingFreeUpgrades : (Array.isArray(previous?.pendingFreeUpgrades) ? previous.pendingFreeUpgrades : [])
      }));
    } catch (err) { console.warn('Could not save run checkpoint', err); }
    refreshResumeUI();
    if (typeof window.scheduleNeonCloudSave === 'function') window.scheduleNeonCloudSave(true);
  }
  function clearRunCheckpoint(mode = null) {
    localStorage.removeItem(getRunCheckpointKey(mode));
    refreshResumeUI();
    if (typeof window.scheduleNeonCloudSave === 'function') window.scheduleNeonCloudSave();
  }
  window.refreshResumeUI = refreshResumeUI;
  window.saveRunCheckpoint = saveRunCheckpoint;
  window.isNeonTowerRunActive = function() { return typeof game !== 'undefined' && !!(game && game.running); };
  window.getNeonTowerCloudSave = function() {
    const checkpoints = { infinite: readRunCheckpoint('infinite'), level: readRunCheckpoint('level') };
    const checkpoint = getLatestRunCheckpoint();
    return { player: JSON.parse(JSON.stringify(player)), checkpoint, checkpoints };
  };
  window.applyNeonTowerCloudSave = function(snapshot) {
    if (!snapshot || !snapshot.player || typeof snapshot.player !== 'object') throw new Error('Invalid cloud save data.');
    const incoming = snapshot.player;
    player = snapshot.replacePlayer ? { ...incoming } : { ...player, ...incoming };
    player.ws = { ...player.ws, ...(incoming.ws || {}) };
    player.freeUpgradeChances = {ATTACK:0,DEFENSE:0,UTILITY:0,...(incoming.freeUpgradeChances || {})};
    player.freeUpgradeChanceRefundV2 = !!(player.freeUpgradeChanceRefundV2 || incoming.freeUpgradeChanceRefundV2);
    migrateFreeUpgradeChanceProgress();
    player.skills = Array.isArray(incoming.skills) ? incoming.skills : ['start'];
    player.achievements = Array.isArray(incoming.achievements) ? incoming.achievements : [];
    Object.keys(statDefs).forEach(k => { if (player.ws[k] === undefined) player.ws[k] = 0; });
    localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(player)));
    if (snapshot.checkpoints && typeof snapshot.checkpoints === 'object') {
      const infinite = snapshot.checkpoints.infinite;
      const level = snapshot.checkpoints.level;
      if (infinite && infinite.version === 1 && infinite.run) localStorage.setItem(RUN_CHECKPOINT_KEY, JSON.stringify(infinite)); else localStorage.removeItem(RUN_CHECKPOINT_KEY);
      if (level && level.version === 1 && level.run) localStorage.setItem(LEVEL_RUN_CHECKPOINT_KEY, JSON.stringify(level)); else localStorage.removeItem(LEVEL_RUN_CHECKPOINT_KEY);
    } else if (snapshot.checkpoint && snapshot.checkpoint.version === 1 && snapshot.checkpoint.run) {
      const key = snapshot.checkpoint.run.mode === 'level' ? LEVEL_RUN_CHECKPOINT_KEY : RUN_CHECKPOINT_KEY;
      localStorage.setItem(key, JSON.stringify(snapshot.checkpoint));
    } else {
      localStorage.removeItem(RUN_CHECKPOINT_KEY);
      localStorage.removeItem(LEVEL_RUN_CHECKPOINT_KEY);
    }
    updateMenuUI();
    buildSkillTree();
    refreshResumeUI();
  };
  function loadGame() { 
    const s = localStorage.getItem(SAVE_KEY); 
    if(s) { try { let p=JSON.parse(atob(s)); player={...player,...p}; player.ws={...player.ws,...(p.ws||{})}; player.freeUpgradeChances={ATTACK:0,DEFENSE:0,UTILITY:0,...(p.freeUpgradeChances||{})}; } catch(err) { console.warn("Invalid save data",err); localStorage.removeItem(SAVE_KEY); } }
    player.freeUpgradeChances = {ATTACK:0,DEFENSE:0,UTILITY:0,...(player.freeUpgradeChances||{})};
    migrateFreeUpgradeChanceProgress();
    Object.keys(statDefs).forEach(k => { if(player.ws[k]===undefined) player.ws[k]=0; });
    saveGame(false, false);
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
    if (!available.length) { showWaveDecisionChoice(); return; }
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

  const waveDecisionRarities={common:{label:'COMMON',weight:62,multiplier:1},rare:{label:'RARE',weight:25,multiplier:1.25},epic:{label:'EPIC',weight:10,multiplier:1.55},legendary:{label:'LEGENDARY',weight:3,multiplier:2}};
  const waveDecisionDefs=[
    {id:'overdrive',name:'OVERDRIVE',category:'COMBAT',icon:'⚡',desc:'+25% attack speed for 3 waves.',duration:3},
    {id:'heavy_impact',name:'HEAVY IMPACT',category:'COMBAT',icon:'✹',desc:'+35% damage for 2 waves.',duration:2},
    {id:'critical_focus',name:'CRITICAL FOCUS',category:'COMBAT',icon:'◎',desc:'+15% critical chance for 3 waves.',duration:3},
    {id:'double_trouble',name:'DOUBLE TROUBLE',category:'COMBAT',icon:'✦',desc:'20% chance to fire an extra projectile for 3 waves.',duration:3},
    {id:'executioner',name:'EXECUTIONER',category:'COMBAT',icon:'☠',desc:'+30% damage against enemies below 30% health for 3 waves.',duration:3},
    {id:'piercing_shots',name:'PIERCING SHOTS',category:'COMBAT',icon:'➤',desc:'Projectiles pierce one additional enemy for 3 waves.',duration:3},
    {id:'rapid_fire',name:'RAPID FIRE',category:'COMBAT',icon:'»',desc:'+20% attack speed for 2 waves.',duration:2},
    {id:'boss_hunter',name:'BOSS HUNTER',category:'COMBAT',icon:'♛',desc:'+30% damage against the next Boss.',duration:5},
    {id:'emergency_repair',name:'EMERGENCY REPAIR',category:'DEFENSE',icon:'✚',desc:'Restore 15% of maximum health immediately.',duration:0},
    {id:'energy_shield',name:'ENERGY SHIELD',category:'DEFENSE',icon:'⬡',desc:'Gain a temporary shield that blocks one hit.',duration:0},
    {id:'reinforced_core',name:'REINFORCED CORE',category:'DEFENSE',icon:'▣',desc:'Reduce all incoming damage by 20% for 3 waves.',duration:3},
    {id:'nano_repair',name:'NANO REPAIR',category:'DEFENSE',icon:'✧',desc:'Restore an extra 1.5% of maximum health per second for 3 waves.',duration:3},
    {id:'second_chance',name:'SECOND CHANCE',category:'DEFENSE',icon:'♡',desc:'Survive one otherwise fatal hit.',duration:0},
    {id:'defensive_matrix',name:'DEFENSIVE MATRIX',category:'DEFENSE',icon:'◈',desc:'Reduce enemy projectile damage by 25% for 3 waves.',duration:3},
    {id:'gold_rush',name:'GOLD RUSH',category:'ECONOMY',icon:'◆',desc:'Receive 75 bonus run coins immediately.',duration:0},
    {id:'double_reward',name:'DOUBLE REWARD',category:'ECONOMY',icon:'＄',desc:'Double the next wave-clear cash reward.',duration:1},
    {id:'bounty_hunter',name:'BOUNTY HUNTER',category:'ECONOMY',icon:'◇',desc:'Special enemies give 50% more cash for 3 waves.',duration:3},
    {id:'investment',name:'INVESTMENT',category:'ECONOMY',icon:'▤',desc:'Invest 15% of your run coins and receive 30% extra after 3 waves.',duration:0},
    {id:'treasure_hunt',name:'TREASURE HUNT',category:'ECONOMY',icon:'✧',desc:'Enemies have a 15% chance to drop an extra run coin for 3 waves.',duration:3},
    {id:'boss_contract',name:'BOSS CONTRACT',category:'ECONOMY',icon:'♛',desc:'Defeating the next Boss grants 50% more Boss coins.',duration:5},
    {id:'blood_money',name:'BLOOD MONEY',category:'RISK & REWARD',icon:'♦',desc:'Enemies deal 25% more damage, but give 50% more cash for 1 wave.',duration:1},
    {id:'chaos_mode',name:'CHAOS MODE',category:'RISK & REWARD',icon:'※',desc:'Enemies move 20% faster, but wave rewards are 50% higher.',duration:1},
    {id:'elite_invasion',name:'ELITE INVASION',category:'RISK & REWARD',icon:'◆',desc:'More special enemies appear and their rewards are 50% higher in the next wave.',duration:1},
    {id:'glass_cannon',name:'GLASS CANNON',category:'RISK & REWARD',icon:'◇',desc:'+50% damage dealt, but you also take 35% more damage for 2 waves.',duration:2},
    {id:'boss_gamble',name:'BOSS GAMBLE',category:'RISK & REWARD',icon:'☠',desc:'The next Boss has 30% more health, but its reward is doubled.',duration:5},
    {id:'last_stand',name:'LAST STAND',category:'RISK & REWARD',icon:'⚔',desc:'Start the next wave at 50% health, but deal 50% more damage.',duration:1}
  ];
  function getWaveDecisionValue(id){return(run.decisionEffects||[]).filter(e=>e.id===id).reduce((s,e)=>s+(Number(e.value)||0),0);}
  function hasWaveDecision(id){return(run.decisionEffects||[]).some(e=>e.id===id);}
  function tickWaveDecisionEffects(){run.decisionEffects=(run.decisionEffects||[]).filter(e=>{e.remaining=Math.max(0,(Number(e.remaining)||0)-1);if(e.id==='investment'&&e.remaining===0&&!e.paid){run.coins=(run.coins||0)+(e.payout||0);e.paid=true;}if(e.id==='energy_shield'&&e.remaining===0&&tower)tower.tempShieldCharges=0;return e.remaining>0||(e.id==='investment'&&!e.paid);});}
  function rollWaveDecisionOptions(){
    const previous=new Set(run.lastDecisionOptions||[]);let pool=waveDecisionDefs.filter(d=>!previous.has(d.id));if(pool.length<3)pool=[...waveDecisionDefs];
    const low=!!(tower&&tower.maxHp>0&&tower.hp/tower.maxHp<.4),picks=[];
    while(pool.length&&picks.length<3){const weights=pool.map(d=>low&&d.category==='DEFENSE'?3.2:1),total=weights.reduce((a,b)=>a+b,0);let roll=Math.random()*total,i=0;for(;i<weights.length-1;i++){roll-=weights[i];if(roll<0)break;}picks.push(pool.splice(i,1)[0]);}
    return picks.map(d=>{const keys=Object.keys(waveDecisionRarities),total=keys.reduce((s,k)=>s+waveDecisionRarities[k].weight,0);let roll=Math.random()*total,rarity='common';for(const k of keys){roll-=waveDecisionRarities[k].weight;if(roll<0){rarity=k;break;}}return{...d,rarity,multiplier:waveDecisionRarities[rarity].multiplier};});
  }
  function getWaveDecisionDescription(d){
    if(d.id==='gold_rush')return 'Receive '+Math.floor(75*d.multiplier)+' bonus run coins immediately.';
    if(d.id==='energy_shield')return 'Gain a temporary shield that blocks '+Math.max(1,Math.round(d.multiplier))+' hit'+(d.multiplier>=1.5?'s':'')+'.';
    if(d.id==='piercing_shots')return 'Projectiles pierce '+Math.max(1,Math.round(d.multiplier))+' additional enemies for 3 waves.';
    if(d.id==='investment')return 'Invest 15% of your run coins and receive '+Math.round(30*d.multiplier)+'% extra after 3 waves.';
    return d.desc.replace(/\d+(?:\.\d+)?%/g,v=>Math.round(parseFloat(v)*d.multiplier*10)/10+'%');
  }
  function showWaveDecisionChoice(){
    if(!game||!game.running)return;game.paused=true;const panel=document.getElementById('perk-choice'),picks=rollWaveDecisionOptions();run.lastDecisionOptions=picks.map(d=>d.id);
    panel.innerHTML='<div class="perk-dialog decision-dialog"><span class="perk-eyebrow">WAVE '+(run.wave-1)+' COMPLETED</span><h2>SELECT YOUR ADVANTAGE</h2><p>Choose one upgrade for your next wave. Higher rarities have stronger effects.</p><div class="decision-wallet"><span>CASH <strong>$'+formatMoney(run.cash||0)+'</strong></span><span>COINS <strong>'+formatMoney(run.coins||0)+'</strong></span></div><div class="perk-options decision-options">'+picks.map(d=>'<button class="perk-option decision-option rarity-'+d.rarity+'" onclick="chooseWaveDecision(\''+d.id+'\',\''+d.rarity+'\')"><span>'+d.icon+'</span><strong>'+d.name+'</strong><small class="decision-category">'+d.category+'</small><small class="perk-rarity-label">'+waveDecisionRarities[d.rarity].label+'</small><small>'+getWaveDecisionDescription(d)+'</small></button>').join('')+'</div></div>';
    panel.classList.add('visible');
  }
  function chooseWaveDecision(id,rarity='common'){
    const d=waveDecisionDefs.find(v=>v.id===id),r=waveDecisionRarities[rarity];if(!d||!r||!game||!game.running)return;
    const scale=r.multiplier,pct=n=>n*scale;run.decisionEffects=run.decisionEffects||[];
    const effect=(key,value,duration=d.duration)=>run.decisionEffects.push({id:key,value,remaining:Math.max(1,duration),rarity});
    switch(id){
      case'overdrive':effect(id,pct(.25),3);break;case'heavy_impact':effect(id,pct(.35),2);break;case'critical_focus':effect(id,pct(15),3);break;
      case'double_trouble':effect(id,pct(.2),3);break;case'executioner':effect(id,pct(.3),3);break;case'piercing_shots':effect(id,Math.max(1,Math.round(scale)),3);break;
      case'rapid_fire':effect(id,pct(.2),2);break;case'boss_hunter':effect(id,pct(.3),5);break;
      case'emergency_repair':if(tower)tower.hp=Math.min(tower.maxHp,tower.hp+tower.maxHp*pct(.15));break;
      case'energy_shield':if(tower)tower.tempShieldCharges=(tower.tempShieldCharges||0)+Math.max(1,Math.round(scale));effect(id,Math.max(1,Math.round(scale)),1);break;
      case'reinforced_core':effect(id,pct(.2),3);break;case'nano_repair':effect(id,pct(.015),3);break;
      case'second_chance':run.secondChanceCharges=(run.secondChanceCharges||0)+1;run.secondChanceHeal=Math.max(Number(run.secondChanceHeal)||0,pct(.01));break;case'defensive_matrix':effect(id,pct(.25),3);break;
      case'gold_rush':run.coins=(run.coins||0)+Math.floor(75*scale);break;case'double_reward':effect(id,scale,1);break;
      case'bounty_hunter':effect(id,pct(.5),3);break;
      case'investment':{const invested=Math.floor((run.coins||0)*.15);if(invested>0){run.coins-=invested;run.decisionEffects.push({id,value:invested*(1+.3*scale),remaining:3,payout:Math.floor(invested*(1+.3*scale)),paid:false,rarity});}break;}
      case'treasure_hunt':effect(id,pct(.15),3);break;case'boss_contract':effect(id,pct(.5),5);break;
      case'blood_money':effect(id,pct(.25),1);effect('blood_money_cash',pct(.5),1);break;
      case'chaos_mode':effect(id,pct(.2),1);effect('chaos_cash',pct(.5),1);break;
      case'elite_invasion':effect(id,pct(.25),1);effect('elite_cash',pct(.5),1);break;
      case'glass_cannon':effect(id,pct(.5),2);effect('glass_cannon_damage_taken',pct(.35),2);break;
      case'boss_gamble':effect(id,pct(.3),5);effect('boss_gamble_reward',pct(1),5);break;
      case'last_stand':if(tower)tower.hp=Math.max(1,tower.hp*.5);effect(id,pct(.5),1);break;
    }
    const panel=document.getElementById('perk-choice');panel.classList.remove('visible');panel.innerHTML='';game.paused=false;game.last=performance.now();updateHUD();saveRunCheckpoint(false,false);
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
    if(id==='repair' && tower) { const baseRegen=parseFloat(getVal('regen'))+parseFloat(getVal('nanoMatrix')); tower.hp=Math.min(tower.maxHp,tower.hp+baseRegen*selectedPerk.values[rarity]*4/100); }
    game.paused=false; game.last=performance.now(); updateHUD();
    saveRunCheckpoint(false);
    notify('PERK UNLOCKED',selectedPerk.name+' · '+perkRarities[rarity].label);
  }

  // Notifications are disabled globally; keep this function as a no-op
  // so existing game events continue working without showing pop-ups.
  function notify(title, msg) { return; }

  function getTieredMultiplier(level, rates) {
    let remaining = Math.max(0, Math.floor(Number(level) || 0));
    let multiplier = 1;
    const tierSizes = [30, 30, 40, 100, 100, 100, 100, 100, 100, 100, Infinity];
    for (let i = 0; i < tierSizes.length && remaining > 0; i++) {
      const count = Math.min(remaining, tierSizes[i]);
      multiplier *= Math.pow(1 + rates[i], count);
      remaining -= count;
    }
    return multiplier;
  }

  function getVal(k, wsO=false) {
    const d=statDefs[k];
    const l=(run.mode === 'level' ? 0 : (player.ws[k]||0))+(wsO?0:(run.stats[k]||0));
    let v;
    if(k==='regen'){
      if (l > 0) {
        v = 0.5;
        let increase = 0.5;
        const tiers = [
          { end: 10, rate: 0.15 },
          { end: 25, rate: 0.10 },
          { end: 50, rate: 0.07 },
          { end: 100, rate: 0.04 },
          { end: 200, rate: 0.02 },
          { end: 300, rate: 0.01 },
          { end: 500, rate: 0.005 },
          { end: Infinity, rate: 0.0025 }
        ];
        for (let level = 2; level <= l; level++) {
          const tier = tiers.find(t => level <= t.end);
          increase *= 1 + tier.rate;
          v += increase;
        }
      } else {
        v = 0;
      }
    } else if(k==='damage') {
      v=getCumulativeTieredValue(d.b,d.i,l,[0.07,0.05,0.03,0.02,0.015,0.011,0.008,0.006,0.0045,0.003,0.002]);
    } else if(k==='speed') {
      v=getCumulativeTieredValue(d.b,d.i,l,[0.03,0.025,0.015,0.0125,0.009,0.007,0.005,0.0035,0.0025,0.002,0.001],run.wave>100?35:20);
    } else if(k==='hp') {
      v=getCumulativeTieredValue(d.b,d.i,l,[0.04,0.03,0.02,0.015,0.011,0.0085,0.0065,0.0045,0.003,0.002,0.0015]);
    } else {
      v=d.b+(l*d.i);
    }
    return (d.isD||k==='damage')?v.toFixed(2):Math.floor(v);
  }
  function getCumulativeTieredValue(base, initialIncrease, level, rates, maxLevel = Infinity) {
    const effectiveLevel = Math.min(Math.max(0, Math.floor(Number(level) || 0)), maxLevel);
    let total = base;
    let increase = initialIncrease;
    const tierSizes = [30, 30, 40, 100, 100, 100, 100, 100, 100, 100, Infinity];
    for (let currentLevel = 1; currentLevel <= effectiveLevel; currentLevel++) {
      if (currentLevel > 1) {
        let remaining = currentLevel - 1;
        let tierIndex = 0;
        while (tierIndex < tierSizes.length - 1 && remaining > tierSizes[tierIndex]) {
          remaining -= tierSizes[tierIndex];
          tierIndex++;
        }
        increase *= 1 + rates[tierIndex];
      }
      total += increase;
    }
    return total;
  }

  function getCost(k, isW) { const d=statDefs[k]; let l=isW?player.ws[k]:(run.stats[k]||0); return Math.floor(d.c*Math.pow(d.cm, l)); }
  const FREE_UPGRADE_CATEGORIES = ['ATTACK','DEFENSE','UTILITY'];
  function migrateFreeUpgradeChanceProgress() {
    if (player.freeUpgradeChanceRefundV2) return false;
    const previousLevels = player.freeUpgradeChances || {};
    let refund = 0;
    FREE_UPGRADE_CATEGORIES.forEach(category => {
      const level = Math.max(0, Math.min(50, Number(previousLevels[category]) || 0));
      for (let boughtLevel = 0; boughtLevel < level; boughtLevel++) {
        refund += Math.round(100 * Math.pow(20000, boughtLevel / 49));
      }
    });
    player.coins = Math.max(0, Number(player.coins) || 0) + refund;
    player.freeUpgradeChances = {ATTACK:0,DEFENSE:0,UTILITY:0};
    player.freeUpgradeChanceRefundV2 = true;
    return refund > 0;
  }
  function getFreeUpgradeChanceCost(category) {
    const level = Math.max(0, Math.min(50, Number(player.freeUpgradeChances?.[category]) || 0));
    return Math.round(100 * Math.pow(500, level / 49));
  }
  function buyFreeUpgradeChance(category) {
    if (!FREE_UPGRADE_CATEGORIES.includes(category)) return;
    player.freeUpgradeChances = {ATTACK:0,DEFENSE:0,UTILITY:0,...(player.freeUpgradeChances||{})};
    const level = Math.max(0, Math.min(50, Number(player.freeUpgradeChances[category]) || 0));
    if (level >= 50) return;
    const cost = getFreeUpgradeChanceCost(category);
    if (player.coins < cost) return;
    player.coins -= cost;
    player.freeUpgradeChances[category] = level + 1;
    saveGame();
    AudioSys.coin();
  }
  function applyFreeUpgradeChance(category) {
    if (run.mode === 'level') return null;
    const chance = Math.max(0, Math.min(50, Number(player.freeUpgradeChances?.[category]) || 0));
    if (!chance || Math.random() * 100 >= chance) return null;
    const eligible = Object.keys(statDefs).filter(key => {
      const def = statDefs[key];
      const totalLevel = (player.ws[key] || 0) + (run.stats[key] || 0);
      return def.category === category && run.wave >= (def.unlockWave || 1) && (!def.max || totalLevel < def.max) && isVisibleUpgrade(key);
    });
    if (!eligible.length) return null;
    const key = eligible[Math.floor(Math.random() * eligible.length)];
    run.stats[key] = (run.stats[key] || 0) + 1;
    if (key === 'hp' && tower) {
      const oldMax = tower.maxHp;
      tower.maxHp = parseFloat(getVal('hp'));
      tower.hp += tower.maxHp - oldMax;
    }
    updateHUD();
    return key;
  }
  function showFreeUpgradeNotice(upgrades) {
    if (!Array.isArray(upgrades) || !upgrades.length) return;
    const app = document.getElementById('app');
    if (!app) return;
    let notice = document.getElementById('free-upgrade-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'free-upgrade-notice';
      notice.className = 'free-upgrade-notice';
      notice.setAttribute('aria-live', 'polite');
      app.appendChild(notice);
    }
    const categoryNames = {ATTACK:'ATTACK',DEFENSE:'DEFENSE',UTILITY:'UTILITY'};
    notice.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'free-upgrade-notice-title';
    title.textContent = 'FREE UPGRADES';
    notice.appendChild(title);
    upgrades.forEach(item => {
      const row = document.createElement('div');
      row.className = 'free-upgrade-notice-row';
      const category = document.createElement('span');
      category.className = 'free-upgrade-notice-category';
      category.textContent = categoryNames[item.category] || item.category;
      const divider = document.createElement('span');
      divider.className = 'free-upgrade-notice-divider';
      const name = document.createElement('strong');
      name.textContent = (statDefs[item.key]?.n || item.key) + ' +1';
      row.append(category, divider, name);
      notice.appendChild(row);
    });
    notice.classList.remove('show');
    void notice.offsetWidth;
    notice.classList.add('show');
    clearTimeout(notice.hideTimer);
    const hideFreeUpgradeNotice = () => {
      if (game && game.paused) {
        notice.hideTimer = setTimeout(hideFreeUpgradeNotice, 500);
        return;
      }
      notice.hideTimer = setTimeout(() => notice.classList.remove('show'), 5000);
    };
    hideFreeUpgradeNotice();
  }
  window.buyFreeUpgradeChance = buyFreeUpgradeChance;
  function hasSkill(id) { return run.mode === 'level' ? false : player.skills.includes(id); }

  function getWaveEnemyCount(wave) {
    const w = Math.max(1, Math.floor(Number(wave) || 1));
    if (run.mode === 'level') {
      const cfg = window.NEON_LEVEL_MODE_CONFIG?.difficulty?.enemyCount || {};
      if (w <= 20) return Math.max(6, Math.round((cfg.earlyBase || 8) + w * (cfg.earlyPerWave || 0.9)));
      if (w <= 50) return Math.max(8, Math.round((cfg.middleBase || 26) + (w - 20) * (cfg.middlePerWave || 0.5)));
      return Math.max(10, Math.round((cfg.lateBase || 41) + (w - 50) * (cfg.latePerWave || 0.25)));
    }
    if (w <= 20) return 9 + Math.floor(w * 1.25);
    if (w <= 50) return 34 + Math.floor((w - 20) * 0.6);
    if (w <= 100) return 52 + Math.floor((w - 50) * 0.36);
    if (w <= 150) return 70 + Math.floor((w - 100) * 0.46);
    if (w <= 200) return 93 + Math.floor((w - 150) * 0.54);
    return 120 + Math.floor((w - 200) * 0.56);
  }

  function getWaveActiveEnemyCap(wave) {
    if (run.mode === 'level') return Infinity;
    const w = Math.max(1, Math.floor(Number(wave) || 1));
    if (w <= 30) return 12;
    if (w <= 80) return 15;
    if (w < 120) return 18;
    return 20;
  }

  function getWaveSpawnInterval(wave) {
    const w = Math.max(1, Math.floor(Number(wave) || 1));
    if (run.mode === 'level') {
      return Math.max(0.85, 1.0 - (Math.min(w, 100) * 0.003));
    }
    const anchors = [
      [1, 1.67],
      [10, 1.88],
      [20, 2.03],
      [30, 2.17],
      [50, 2.39],
      [100, 2.61]
    ];
    let rate = anchors[anchors.length - 1][1];
    if (w < anchors[anchors.length - 1][0]) {
      for (let i = 0; i < anchors.length - 1; i++) {
        const [startWave, startRate] = anchors[i];
        const [endWave, endRate] = anchors[i + 1];
        if (w <= endWave) {
          const progress = (w - startWave) / (endWave - startWave);
          rate = startRate + (endRate - startRate) * progress;
          break;
        }
      }
    }
    return 1 / rate;
  }

  /** MAIN LOOP & RENDERING **/
  let pendingLevelModeId = null;
  function startGame(levelId = null) {
    if (Number.isInteger(Number(levelId)) && Number(levelId) > 0) pendingLevelModeId = Number(levelId);
    const selectedLevelId = pendingLevelModeId;
    clearRunCheckpoint();
    if (!player.tutorialSeen) {
      document.getElementById('tutorial').classList.add('visible');
      return;
    }
    pendingLevelModeId = null;
    AudioSys.init();
    resize(); // Recalculate the canvas after the device/layout selection and before starting the run.
    gameSessionStartedAt = Date.now();
    gameDurationTracked = false;
    gameSessionSource = 'site';
    document.getElementById('menu').classList.remove('active-layer'); document.getElementById('hud').classList.add('active-hud');
    const levelConfig = selectedLevelId && window.NEON_LEVEL_MODE_CONFIG?.levels?.find(level => level.id === selectedLevelId);
    run = { stats: {}, cash: 0, coins: 0, wave: 1, kills: 0, bossKills: 0, elapsed: 0, perks: {}, mode: levelConfig ? 'level' : 'infinite', levelId: levelConfig ? levelConfig.id : null };
    if (levelConfig) run.levelObjectives = levelConfig.objectives.map(objective => ({ ...objective, progress: 0, complete: false }));
    selectedGameSpeed = 1;
    const missionOptions = [
      {id:'waves', title:'REACH WAVE 5', description:'Clear waves until you reach wave 5.', target:5, reward:25},
      {id:'kills', title:'ELIMINATE 30 ENEMIES', description:'Defeat 30 enemies during this run.', target:30, reward:25},
      {id:'survive', title:'SURVIVE 2 MINUTES', description:'Stay alive for 120 seconds.', target:120, reward:25}
    ];
    const missionUI = document.getElementById('mission-ui');
    missionUI?.classList.remove('mission-complete', 'mission-hidden-on-resume');
    if (levelConfig && missionUI) {
      // Level objectives must always be visible during active Level Mode gameplay.
      missionUI.style.display = 'block';
      missionUI.style.visibility = 'visible';
      missionUI.style.opacity = '1';
    }
    if (levelConfig) {
      run.mission = null;
      document.getElementById('mission-title').textContent = 'LEVEL ' + levelConfig.id + ' OBJECTIVES';
      document.getElementById('mission-desc').textContent = 'Complete every objective to finish this level.';
      document.getElementById('mission-reward').textContent = '+' + formatMoney(levelConfig.reward) + ' COINS';
      document.getElementById('mission-progress').textContent = '0 / ' + run.levelObjectives.length + ' OBJECTIVES';
      document.getElementById('mission-fill').style.width = '0%';
    } else {
      run.mission = {...missionOptions[Math.floor(Math.random()*missionOptions.length)], progress:0, complete:false};
      document.getElementById('mission-title').textContent = run.mission.title;
      document.getElementById('mission-desc').textContent = run.mission.description;
      document.getElementById('mission-reward').textContent = '+' + formatMoney(run.mission.reward) + ' COINS';
      document.getElementById('mission-progress').textContent = '0 / ' + run.mission.target;
      document.getElementById('mission-fill').style.width = '0%';
    }
    Object.keys(statDefs).forEach(k => run.stats[k]=0);
    
    game = { running: true, paused:false, dt: 0, last: performance.now(), shake: 0, playSaveT: 0, achievementCheckT: 0, spawnT: 0.25, toSpawn: 10, ents: { e:[], p:[], b:[], part:[], txt:[] }, cx: canvas.width/2, cy: canvas.height/2 };
    
    tower = new Tower(); 
    initUpgBar();
    updateGameSpeedButton();
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
    if (run.mode === 'level') { finishLevelMode(false); return; }
    game.running = false;
    clearRunCheckpoint();
    trackGameDuration('completed');
    if (typeof window.neonTrack === 'function') {
      window.neonTrack({ path: 'game-end', title: reason === 'voluntary' ? 'Game ended voluntarily' : 'Game ended normally', event: true, no_session: true });
    } else if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: 'game-end', title: reason === 'voluntary' ? 'Game ended voluntarily' : 'Game ended normally', event: true, no_session: true });
    } document.getElementById('hud').classList.remove('active-hud'); document.getElementById('gameover').classList.remove('level-mode-success');
    document.getElementById('gameover').classList.add('active-layer');
    document.getElementById('go-wave').innerText = run.wave;
    document.getElementById('go-kills').innerText = run.kills;
    document.getElementById('go-bosses').innerText = run.bossKills || 0;
    document.getElementById('go-time').innerText = formatRunTime(run.elapsed || 0);
    player.coins += run.coins;
    if(run.mode !== 'level' && run.wave > player.highestWave) player.highestWave = run.wave;
    player.runsPlayed = (player.runsPlayed || 0) + 1;
    player.bestKills = Math.max(player.bestKills || 0, run.kills);
    player.bestBosses = Math.max(player.bestBosses || 0, run.bossKills || 0);
    player.bestDuration = Math.max(player.bestDuration || 0, run.elapsed || 0);
    document.getElementById('go-best').innerText = player.highestWave;
    document.getElementById('go-record-kills').innerText = player.bestKills;
    document.getElementById('go-record-time').innerText = formatRunTime(player.bestDuration);
    document.getElementById('go-runs').innerText = player.runsPlayed;
    document.getElementById('go-coins').innerText = '+' + formatMoney(run.coins) + ' COINS';
    checkAchievements(); saveGame();
    if (typeof window.scheduleNeonCloudSave === 'function') window.scheduleNeonCloudSave();
    if (typeof window.syncPublicPlayerProfile === 'function') window.syncPublicPlayerProfile();
    const returnButton = document.getElementById('gameover-return-button');
    if (returnButton) returnButton.setAttribute('onclick', 'returnToMenu()');
    if (run.mode !== 'level' && typeof submitLeaderboardResult === 'function') submitLeaderboardResult(run);
  }
  function resumeRun(mode = null) {
    const checkpoint = readRunCheckpoint(mode || (getLatestRunCheckpoint()?.run?.mode || 'infinite'));
    if (!checkpoint || checkpoint.version !== 1 || !checkpoint.run || !Number.isFinite(Number(checkpoint.run.wave))) {
      // A missing Level Mode checkpoint must never clear the separate Infinite Mode run.
      refreshResumeUI();
      return;
    }
    if (!player.tutorialSeen) {
      document.getElementById('tutorial').classList.add('visible');
      return;
    }
    AudioSys.init();
    resize(); // Recalculate the canvas after the device/layout selection and before restoring the run.
    gameSessionStartedAt = Date.now();
    gameDurationTracked = false;
    gameSessionSource = 'resume';
    document.getElementById('menu').classList.remove('active-layer');
    document.getElementById('gameover').classList.remove('active-layer');
    document.getElementById('hud').classList.add('active-hud');
    run = checkpoint.run;
    const pendingFreeUpgrades = Array.isArray(checkpoint.pendingFreeUpgrades) ? checkpoint.pendingFreeUpgrades : [];
    selectedGameSpeed = 1;
    // Infinite Mode hides its optional mission tracker on resume; Level Mode must keep its objectives visible.
    const missionUI = document.getElementById('mission-ui');
    if (run.mode === 'level' && Array.isArray(run.levelObjectives)) {
      missionUI?.classList.remove('mission-hidden-on-resume', 'mission-complete');
      if (missionUI) {
        missionUI.style.display = 'block';
        missionUI.style.visibility = 'visible';
        missionUI.style.opacity = '1';
      }
      const levelConfig = window.NEON_LEVEL_MODE_CONFIG?.levels?.find(level => level.id === Number(run.levelId));
      const title = document.getElementById('mission-title');
      const reward = document.getElementById('mission-reward');
      if (title) title.textContent = 'LEVEL ' + run.levelId + ' OBJECTIVES';
      if (reward && levelConfig) reward.textContent = '+' + formatMoney(levelConfig.reward) + ' COINS';
      updateLevelModeProgress();
    } else {
      missionUI?.classList.add('mission-hidden-on-resume');
    }
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
      tower.tempShieldCharges = Math.max(0, Number(checkpoint.tower.tempShieldCharges) || 0);
    }
    initUpgBar();
    updateGameSpeedButton();
    updateHUD();
    refreshResumeUI();
    if (pendingFreeUpgrades.length) {
      showFreeUpgradeNotice(pendingFreeUpgrades);
      saveRunCheckpoint(!!checkpoint.pendingPerk, !!checkpoint.pendingDecision, []);
    }
    if (checkpoint.pendingPerk) showPerkChoice();
    else if (checkpoint.pendingDecision) showWaveDecisionChoice();
    requestAnimationFrame(loop);
  }
  window.resumeRun = resumeRun;

  function finishLevelMode(completed) {
    if (!game || !game.running || run.mode !== 'level') return;
    game.running = false;
    clearRunCheckpoint();
    trackGameDuration('completed');
    const level = window.NEON_LEVEL_MODE_CONFIG?.levels?.find(item => item.id === run.levelId);
    const progress = player.levelMode || (player.levelMode = { highestUnlocked: 1, completed: [], claimedRewards: [] });
    progress.completed = Array.isArray(progress.completed) ? progress.completed : [];
    progress.claimedRewards = Array.isArray(progress.claimedRewards) ? progress.claimedRewards : [];
    let reward = 0;
    if (completed && level) {
      if (!progress.completed.includes(level.id)) progress.completed.push(level.id);
      progress.highestUnlocked = Math.max(Number(progress.highestUnlocked) || 1, Math.min(30, level.id + 1));
      if (!progress.claimedRewards.includes(level.id)) { reward = Math.max(0, Number(level.reward) || 0); progress.claimedRewards.push(level.id); }
      player.coins += Math.max(0, Number(run.coins) || 0) + reward;
    }
    player.runsPlayed = (player.runsPlayed || 0) + 1;
    player.bestKills = Math.max(player.bestKills || 0, run.kills || 0);
    player.bestBosses = Math.max(player.bestBosses || 0, run.bossKills || 0);
    player.bestDuration = Math.max(player.bestDuration || 0, run.elapsed || 0);
    document.getElementById('hud').classList.remove('active-hud');
    const gameover = document.getElementById('gameover');
    gameover.classList.toggle('level-mode-success', !!completed);
    gameover.classList.add('active-layer');
    const title = document.getElementById('gameover-title');
    if (title) { title.textContent = completed ? 'LEVEL ' + run.levelId + ' COMPLETE!' : 'LEVEL ' + run.levelId + ' FAILED'; title.style.color = completed ? '#55ffb0' : '#ff3366'; title.style.textShadow = completed ? '0 0 40px rgba(85,255,176,.75)' : '0 0 40px #ff3366'; }
    const reportTitle = document.getElementById('gameover-report-title');
    if (reportTitle) reportTitle.textContent = completed ? 'REWARDS' : 'LEVEL ' + run.levelId + ' REPORT';
    document.getElementById('go-wave').innerText = run.wave;
    document.getElementById('go-kills').innerText = run.kills;
    document.getElementById('go-bosses').innerText = run.bossKills || 0;
    document.getElementById('go-time').innerText = formatRunTime(run.elapsed || 0);
    document.getElementById('go-best').innerText = player.highestWave;
    document.getElementById('go-record-kills').innerText = player.bestKills;
    document.getElementById('go-record-time').innerText = formatRunTime(player.bestDuration);
    document.getElementById('go-runs').innerText = player.runsPlayed;
    document.getElementById('go-coins').innerText = completed ? '+' + formatMoney(reward + (Number(run.coins) || 0)) + ' COINS' : '+0 COINS';
    const profitLabel = document.querySelector('#gameover .mission-profit');
    if (profitLabel) profitLabel.firstChild.textContent = completed ? 'REWARDS: ' : 'PROFIT: ';
    const returnButton = document.getElementById('gameover-return-button');
    if (returnButton) { returnButton.textContent = 'MENU'; returnButton.setAttribute('onclick', 'returnToMenu()'); }
    const nextButton = document.getElementById('gameover-next-level-button');
    if (nextButton) {
      const hasNext = !!completed && Number(run.levelId) < 30;
      nextButton.style.display = hasNext ? '' : 'none';
      nextButton.onclick = hasNext ? function(){ document.getElementById('gameover').classList.remove('active-layer','level-mode-success'); startLevelMode(Number(run.levelId) + 1); } : null;
    }
    run.mode = 'infinite';
    saveGame();
    if (typeof window.scheduleNeonCloudSave === 'function') window.scheduleNeonCloudSave();
    if (typeof window.syncPublicPlayerProfile === 'function') window.syncPublicPlayerProfile();
  }

  function updateLevelModeProgress() {
    if (run.mode !== 'level' || !Array.isArray(run.levelObjectives)) return;
    const objectives = run.levelObjectives;
    objectives.forEach(objective => {
      const value = objective.type === 'wave' ? run.wave : objective.type === 'kills' ? run.kills : objective.type === 'bosses' ? (run.bossKills || 0) : Math.floor(run.elapsed || 0);
      objective.progress = Math.min(objective.target, Math.max(0, value));
      objective.complete = objective.progress >= objective.target;
    });
    const completed = objectives.filter(objective => objective.complete).length;
    const total = objectives.length;
    const label = document.getElementById('mission-progress');
    if (label) label.textContent = completed + ' / ' + total + ' OBJECTIVES';
    const fill = document.getElementById('mission-fill');
    if (fill) fill.style.width = (total ? completed / total * 100 : 0) + '%';
    const description = document.getElementById('mission-desc');
    if (description) description.textContent = objectives.map(objective => {
      const prefix = objective.type === 'wave' ? 'REACH WAVE ' : objective.type === 'kills' ? 'ELIMINATE ' : objective.type === 'bosses' ? 'DEFEAT ' : 'SURVIVE ';
      const suffix = objective.type === 'survive' ? 's' : objective.type === 'kills' ? ' ENEMIES' : objective.type === 'bosses' ? ' BOSSES' : '';
      return (objective.complete ? '✓ ' : '○ ') + prefix + objective.target + suffix + ' (' + Math.floor(objective.progress) + '/' + objective.target + ')';
    }).join(' · ');
    if (completed === total && total > 0) finishLevelMode(true);
  }

  window.startLevelMode = function(levelId) {
    const level = window.NEON_LEVEL_MODE_CONFIG?.levels?.find(item => item.id === Number(levelId));
    const progress = player.levelMode || { highestUnlocked: 1 };
    if (!level || level.id > (Number(progress.highestUnlocked) || 1)) return;
    if (!player.tutorialSeen) { pendingLevelModeId = level.id; document.getElementById('tutorial').classList.add('visible'); return; }
    startGame(level.id);
  };

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
      notify('MISSION COMPLETE', '+' + formatMoney(mission.reward) + ' COINS');
      const title = document.getElementById('mission-title');
      if (title) title.textContent = 'MISSION COMPLETE';
      const reward = document.getElementById('mission-reward');
      if (reward) reward.textContent = '+' + formatMoney(mission.reward) + ' COINS';
    }
  }

  function confirmTutorialStart() {
    const tutorial = document.getElementById('tutorial');
    tutorial.classList.remove('visible');
    player.tutorialSeen = true;
    saveGame();
    startGame(pendingLevelModeId);
  }

  function formatRunTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    return minutes + ':' + String(total % 60).padStart(2, '0');
  }
  function returnToMenu(tab = 'workshop') { document.getElementById('gameover').classList.remove('active-layer','level-mode-success'); document.getElementById('menu').classList.add('active-layer'); if (typeof switchTab === 'function') switchTab(tab); updateMenuUI(); }

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
    const realDt = Math.min(0.075, Math.max(0, (ts - game.last) / 1000));
    game.last = ts;
    game.dt = realDt * getEffectiveGameSpeed();
    player.playTime = (player.playTime || 0) + realDt;
    game.achievementCheckT += game.dt; game.playSaveT += game.dt;
    run.elapsed = (run.elapsed || 0) + realDt;
    if (run.mode === 'level') updateLevelModeProgress(); else updateMissionProgress();
    if (!game.running) return;
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
      run.coins += Math.max(1,Math.floor((Math.floor(run.wave/2)+2+Math.floor(parseFloat(getVal('coinCache'))))*0.4));
      const waveCashReward=Math.floor(parseFloat(getVal('waveBonus'))+Math.floor(run.wave*parseFloat(getVal('waveDividend'))/100));
      run.cash+=Math.floor(waveCashReward*(1+getWaveDecisionValue('double_reward'))*(1+getWaveDecisionValue('chaos_cash')));
      updateHUD(); AudioSys.coin(); checkAchievements();
      const completedWave = run.wave - 1;
      const freeUpgrades = FREE_UPGRADE_CATEGORIES.map(category => ({category,key:applyFreeUpgradeChance(category)})).filter(item => item.key);
      if (freeUpgrades.length) showFreeUpgradeNotice(freeUpgrades);
      tickWaveDecisionEffects();
      const perkMilestone = completedWave % 10 === 5;
      const decisionMilestone = completedWave % 10 === 0;
      const perksAvailable = perkDefs.some(p => getPerkStacks(p.id) < p.maxStacks);
      const showPerk = perkMilestone && perksAvailable;
      const showDecision = decisionMilestone || (perkMilestone && !perksAvailable);
      if (showPerk) showPerkChoice();
      else if (showDecision) showWaveDecisionChoice();
      saveRunCheckpoint(showPerk, showDecision, freeUpgrades); 
    }
    game.spawnT -= game.dt;
    if(game.spawnT <= 0 && game.toSpawn > 0 && game.ents.e.length < getWaveActiveEnemyCap(run.wave)) { game.ents.e.push(new Enemy(run.wave)); game.toSpawn--; game.spawnT = getWaveSpawnInterval(run.wave); updateHUD(); }

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
          if(e.type === 'Boss') dmg *= 1 + parseFloat(getVal('bossDamage'))/100 + getWaveDecisionValue('boss_hunter');
          if(e.hp <= e.maxHp*0.3) dmg *= 1 + parseFloat(getVal('executionProtocol'))/100 + getWaveDecisionValue('executioner');
          if(!(p instanceof Laser)) {
             game.ents.txt.push(new FText(e.x, e.y-e.r, Math.floor(dmg), p.crit ? "#ff3366" : "#fff", p.crit ? 24 : 14));
             createParts(p.x, p.y, p.crit ? "#ff3366" : "#0ff", p.crit?10:3, 3);
          }
          if(e.hit(dmg)) {
            const defeatedBoss = e.type === 'Boss';
            game.ents.e.splice(j,1);
            updateHUD();
            // Keep a recovery checkpoint on the Boss wave immediately after its defeat.
            if(defeatedBoss && run.mode !== 'level') saveRunCheckpoint(false, false);
          }
          
          if(p instanceof Laser) { /* Laser pierces all targets. */ }
          else if((p.pierceRemaining||0)>0){p.pierceRemaining--;p.dead=false;}
          else {hitSomething=true;break;}
        }
      }
      if(hitSomething) game.ents.p.splice(i,1);
    }

    // Remove any Boss volleys left on screen as soon as the Boss is defeated.
    // These bullets belong to the Boss and must not keep damaging the tower after its defeat.
    if(!game.ents.e.some(enemy => enemy.type === 'Boss' && enemy.hp > 0)) {
      for(let i=game.ents.b.length-1;i>=0;i--) {
        const bullet=game.ents.b[i];
        if(bullet.kind==='boss') { bulletPool.release(bullet); game.ents.b.splice(i,1); }
      }
    }
    for(let i=game.ents.b.length-1;i>=0;i--){let b=game.ents.b[i];b.update(game.dt);b.draw();let d=MathUtils.dist(b.x,b.y,tower.x,tower.y);if(d<tower.r+b.r){if(tower.invuln<=0)tower.hit(b.damage,{type:b.kind==='boss'?'Boss':'Projectile',isProjectile:true});if(!game.running)return;bulletPool.release(b);game.ents.b.splice(i,1);continue;}if(!b.grazed&&d<tower.r+b.r+18){b.grazed=true;run.graze++;AudioSys.play('graze',1500,900,'sine',.08,.08);}if(b.x<-30||b.x>canvas.width+30||b.y<-30||b.y>canvas.height+30){bulletPool.release(b);game.ents.b.splice(i,1);}}
    for(let i = game.ents.e.length - 1; i >= 0; i--) {
      let e = game.ents.e[i];
      if(e.hp <= 0) { game.ents.e.splice(i,1); continue; } 
      e.update(game.dt);
      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      const distance = Math.hypot(dx, dy) || 1;
      const contactDistance = tower.r + e.r + 2;
      if(e.isAttackingTower) {
        // Keep the enemy at its arrival position; only gently separate overlapping attackers.
        let pushX = 0, pushY = 0;
        for(let j = 0; j < game.ents.e.length; j++) {
          const other = game.ents.e[j];
          if(other === e || !other.isAttackingTower || other.hp <= 0) continue;
          let sx = e.x - other.x, sy = e.y - other.y;
          let spacing = Math.hypot(sx, sy);
          const minSpacing = e.r + other.r + 5;
          if(spacing < minSpacing) {
            if(spacing < 0.001) {
              const angle = (i + 1) * 2.399963229728653;
              sx = Math.cos(angle);
              sy = Math.sin(angle);
              spacing = 1;
            }
            const force = (minSpacing - spacing) * 0.45;
            pushX += (sx / spacing) * force;
            pushY += (sy / spacing) * force;
          }
        }
        // Only separate along the tower's circumference, never toward its center.
        const radialX = e.x - tower.x;
        const radialY = e.y - tower.y;
        const radialLength = Math.hypot(radialX, radialY) || 1;
        const radialUnitX = radialX / radialLength;
        const radialUnitY = radialY / radialLength;
        const inwardOutwardPush = pushX * radialUnitX + pushY * radialUnitY;
        pushX -= inwardOutwardPush * radialUnitX;
        pushY -= inwardOutwardPush * radialUnitY;
        const separationStep = Math.min(1, game.dt * 6);
        e.x += pushX * separationStep;
        e.y += pushY * separationStep;
        const safeDx = e.x - tower.x;
        const safeDy = e.y - tower.y;
        const safeDistance = Math.hypot(safeDx, safeDy) || 1;
        const minTowerDistance = tower.r + e.r + 2;
        if(safeDistance < minTowerDistance) {
          e.x = tower.x + (safeDx / safeDistance) * minTowerDistance;
          e.y = tower.y + (safeDy / safeDistance) * minTowerDistance;
        }
        e.contactDamageTimer -= game.dt;
        if(e.contactDamageTimer <= 0) {
          tower.hit(e.dmg, e);
          if(!game.running)return;
          e.contactDamageTimer = 1;
        }
      } else if(distance < contactDistance) {
        // Lock the enemy exactly where it reached the tower; do not reposition it.
        e.isAttackingTower = true;
        e.contactDamageTimer = 0.35 + (Math.abs(Math.sin(e.phase)) * 0.65);
      }
      e.draw();
    }
    
    for(let i = game.ents.part.length - 1; i >= 0; i--) { let p = game.ents.part[i]; p.update(game.dt); p.draw(); if(p.l<=0) game.ents.part.splice(i,1); }
    for(let i = game.ents.txt.length - 1; i >= 0; i--) { let t = game.ents.txt[i]; t.update(game.dt); t.draw(); if(t.l<=0) game.ents.txt.splice(i,1); }
    
    updateHUD();
    updateGameSpeedButton();
  }
