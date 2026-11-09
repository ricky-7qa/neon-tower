
  /** CORE ENGINE & DATA **/
  const SAVE_KEY = "NeonTowerApexSave_FinalVersion";
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
    damage: { n: "DAMAGE", d: "Increases every projectile's base damage.", category:"ATTACK", b:15, i:5, c:10, cm:1.15, isD:false, col:"#0ff" },
    speed: { n:"ATTACK SPEED", d:"More shots fired every second.", category:"ATTACK", b:1.5, i:.2, c:15, cm:1.25, isD:true, col:"#0ff" },
    critC: { n:"CRITICAL CHANCE", d:"Chance for a critical hit.", category:"ATTACK", b:0, i:5, c:50, cm:1.4, isD:false, col:"#ff3366", max:15 },
    critD: { n:"CRITICAL DAMAGE", d:"Multiplier applied to critical hits.", category:"ATTACK", b:1.5, i:.2, c:50, cm:1.4, isD:true, col:"#ff3366" },
    multishot: { n:"MULTI-SHOT", d:"Fire additional projectiles in a spread.", category:"ATTACK", b:0, i:1, c:100, cm:1.42, isD:false, col:"#ff9b42", max:5 },
    hp: { n:"MAX HEALTH", d:"Increases the tower's maximum health.", category:"DEFENSE", b:200, i:30, c:10, cm:1.15, isD:false, col:"#0f0" },
    regen: { n:"HEALTH REGEN", d:"Restores health every second.", category:"DEFENSE", b:0, i:1, c:25, cm:1.3, isD:true, col:"#0f0" },
    armor: { n:"DAMAGE REDUCTION", d:"Reduces damage from every hit.", category:"DEFENSE", b:0, i:2, c:35, cm:1.28, isD:false, col:"#53d6ff", max:20 },
    dodge: { n:"DODGE CHANCE", d:"Chance to completely avoid a hit.", category:"DEFENSE", b:0, i:2, c:80, cm:1.38, isD:false, col:"#9b8cff", max:20 },
    shieldRecharge: { n:"SHIELD RECHARGE", d:"Shortens the shield's cooldown.", category:"DEFENSE", b:0, i:1, c:90, cm:1.4, isD:false, col:"#55f5dc", max:8 },
    range: { n:"TARGETING RANGE", d:"Detects enemies from farther away.", category:"UTILITY", b:300, i:50, c:30, cm:1.2, isD:false, col:"#ffd700", max:10 },
    cashBonus: { n:"CASH BONUS", d:"Earn more cash for every enemy defeated.", category:"UTILITY", b:0, i:10, c:45, cm:1.25, isD:false, col:"#ffd700", max:10 },
    waveBonus: { n:"WAVE INCOME", d:"Earn extra cash when a wave is cleared.", category:"UTILITY", b:0, i:5, c:55, cm:1.3, isD:false, col:"#ffd700", max:10 }
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

  const perkDefs = [
    {id:'power',name:'Overcharged Core',desc:'+20% tower damage.',icon:'✦'},
    {id:'rapid',name:'Rapid Calibration',desc:'+15% attack speed.',icon:'⚡'},
    {id:'fortune',name:'Golden Core',desc:'+25% cash from enemy kills.',icon:'◈'},
    {id:'repair',name:'Nanite Repair',desc:'+3 health regenerated per second.',icon:'✚'},
    {id:'radar',name:'Extended Radar',desc:'+15% targeting range.',icon:'◎'}
  ];

  const achvDefs = [
    { id:'waves', n:'Wave Breaker', d:'Reach higher and higher waves.', metric:()=>player.highestWave, tiers:[5,10,20,35,50].map((v,i)=>({value:v,reward:[30,60,120,250,500][i]})) },
    { id:'bosses', n:'Boss Hunter', d:'Defeat bosses across all runs.', metric:()=>player.bossKills, tiers:[1,3,5,10,20].map((v,i)=>({value:v,reward:[50,100,200,400,800][i]})) },
    { id:'kills', n:'Enemy Eliminator', d:'Defeat enemies across all runs.', metric:()=>player.totalKills, tiers:[50,100,250,500,1000].map((v,i)=>({value:v,reward:[25,50,100,250,500][i]})) },
    { id:'time', n:'Dedicated Defender', d:'Total time spent playing.', metric:()=>Math.floor(player.playTime||0), tiers:[300,900,1800,3600,7200].map((v,i)=>({value:v,reward:[25,50,100,250,500][i]})), format:v=>v<3600?Math.floor(v/60)+' min':Math.floor(v/3600)+' h '+Math.floor((v%3600)/60)+' min' }
  ];

  /** SAVE SYSTEM **/
  let player = { coins: 0, highestWave: 1, totalKills: 0, bossKills: 0, playTime: 0, ws: {}, skills: ['start'], achievements: [] };
  let run = {stats:{},cash:0,coins:0,wave:1,kills:0,combo:0,comboTimer:0,graze:0};
  let targetEnemy = null; 

  function saveGame() { localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(player))); updateMenuUI(); }
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
    game.paused = true;
    const panel = document.getElementById('perk-choice');
    const picks = [...perkDefs].sort(()=>Math.random()-.5).slice(0,3);
    panel.innerHTML = '<div class="perk-dialog"><span class="perk-eyebrow">MILESTONE REACHED</span><h2>CHOOSE A PERK</h2><p>Select one permanent bonus for this run.</p><div class="perk-options">'+picks.map(p=>'<button class="perk-option" onclick="choosePerk(\''+p.id+'\')"><span>'+p.icon+'</span><strong>'+p.name+'</strong><small>'+p.desc+'</small></button>').join('')+'</div></div>';
    panel.classList.add('visible');
  }

  function renderRunPerks() {
    const container = document.getElementById('run-perks-content');
    if (!container) return;
    const owned = perkDefs.filter(perk => (run.perks && run.perks[perk.id]) > 0);
    if (!owned.length) {
      container.innerHTML = '<div class="perks-empty"><span>◇</span><strong>NO PERKS YET</strong><small>Reach milestone waves and choose perks to build your run.</small></div>';
      return;
    }
    container.innerHTML = owned.map(perk => {
      const count = run.perks[perk.id];
      return '<div class="run-perk-card"><span class="run-perk-icon">' + perk.icon + '</span><div class="run-perk-info"><strong>' + perk.name + '</strong><small>' + perk.desc + '</small></div><span class="run-perk-count">×' + count + '</span></div>';
    }).join('');
  }

  function choosePerk(id) {
    if(!perkDefs.some(p=>p.id===id)) return;
    run.perks=run.perks||{};
    run.perks[id]=(run.perks[id]||0)+1;
    renderRunPerks();
    const panel=document.getElementById('perk-choice');
    panel.classList.remove('visible'); panel.innerHTML='';
    if(id==='repair' && tower) tower.hp=Math.min(tower.maxHp,tower.hp+20);
    game.paused=false; game.last=performance.now(); updateHUD();
    const perk=perkDefs.find(p=>p.id===id); notify('PERK UNLOCKED',perk.name);
  }

  function notify(title, msg) {
    const box = document.getElementById('notif-box');
    const el = document.createElement('div'); el.className = 'notif'; el.innerHTML = `<h4>${title}</h4><p>${msg}</p>`;
    box.appendChild(el); setTimeout(() => { el.style.opacity = 0; setTimeout(()=>el.remove(), 300); }, 3000);
  }

  function getVal(k, wsO=false) { const d=statDefs[k]; let l=(player.ws[k]||0)+(wsO?0:(run.stats[k]||0)); let v=d.b+(l*d.i); return d.isD?v.toFixed(2):Math.floor(v); }
  function getCost(k, isW) { const d=statDefs[k]; let l=isW?player.ws[k]:(run.stats[k]||0); return Math.floor(d.c*Math.pow(d.cm, l)); }
  function hasSkill(id) { return player.skills.includes(id); }

  /** MAIN LOOP & RENDERING **/
  function startGame() {
    AudioSys.init();
    document.getElementById('menu').classList.remove('active-layer'); document.getElementById('hud').classList.add('active-hud');
    run = { stats: {}, cash: 0, coins: 0, wave: 1, kills: 0, perks: {} };
    Object.keys(statDefs).forEach(k => run.stats[k]=0);
    
    game = { running: true, paused:false, dt: 0, last: performance.now(), shake: 0, playSaveT: 0, achievementCheckT: 0, spawnT: 0.25, toSpawn: 10, ents: { e:[], p:[], b:[], part:[], txt:[] }, cx: canvas.width/2, cy: canvas.height/2 };
    
    tower = new Tower(); 
    initUpgBar();
    updateHUD();
    requestAnimationFrame(loop);
  }

  function processGameOver() {
    if(!game || !game.running) return;
    game.running = false; document.getElementById('hud').classList.remove('active-hud'); document.getElementById('gameover').classList.add('active-layer');
    document.getElementById('go-wave').innerText = run.wave; document.getElementById('go-kills').innerText = run.kills; document.getElementById('go-coins').innerText = "+"+run.coins+" COINS";
    player.coins += run.coins; if(run.wave > player.highestWave) player.highestWave = run.wave; checkAchievements(); saveGame();
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
      run.wave++; game.toSpawn = 10 + Math.floor(run.wave * 2);
      run.coins += Math.floor(run.wave/2) + 2; run.cash += Math.floor(parseFloat(getVal('waveBonus')));
      updateHUD(); AudioSys.coin(); checkAchievements();
      if((run.wave-1)%5===0) showPerkChoice(); 
    }
    game.spawnT -= game.dt;
    if(game.spawnT <= 0 && game.toSpawn > 0) { game.ents.e.push(new Enemy(run.wave)); game.toSpawn--; game.spawnT = Math.max(0.35, 0.7 - (run.wave*0.025)); updateHUD(); }

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

    for(let i=game.ents.b.length-1;i>=0;i--){let b=game.ents.b[i];b.update(game.dt);b.draw();let d=MathUtils.dist(b.x,b.y,tower.x,tower.y);if(d<tower.r+b.r){if(tower.invuln<=0)tower.hit(b.damage,null);bulletPool.release(b);game.ents.b.splice(i,1);continue;}if(!b.grazed&&d<tower.r+b.r+18){b.grazed=true;run.graze++;run.coins++;AudioSys.play('graze',1500,900,'sine',.08,.08);}if(b.x<-30||b.x>canvas.width+30||b.y<-30||b.y>canvas.height+30){bulletPool.release(b);game.ents.b.splice(i,1);}}
    for(let i = game.ents.e.length - 1; i >= 0; i--) {
      let e = game.ents.e[i];
      if(e.hp <= 0) { game.ents.e.splice(i,1); continue; } 
      e.update(game.dt); e.draw();
      if(MathUtils.dist(e.x, e.y, tower.x, tower.y) < tower.r + e.r) { tower.hit(e.dmg, e); game.ents.e.splice(i,1); updateHUD(); }
    }
    
    for(let i = game.ents.part.length - 1; i >= 0; i--) { let p = game.ents.part[i]; p.update(game.dt); p.draw(); if(p.l<=0) game.ents.part.splice(i,1); }
    for(let i = game.ents.txt.length - 1; i >= 0; i--) { let t = game.ents.txt[i]; t.update(game.dt); t.draw(); if(t.l<=0) game.ents.txt.splice(i,1); }
    
    updateHUD(); 
  }