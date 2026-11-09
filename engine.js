
  /** CORE ENGINE & DATA **/
  const SAVE_KEY = "NeonTowerApexSave_FinalVersion";
  const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
  
  let tower = null; 
  let isUpgOpen = false;

  function toggleUpgPanel() {
    isUpgOpen = !isUpgOpen;
    const panel = document.getElementById('upg-panel');
    const toggleBtn = document.getElementById('upg-toggle');
    if(isUpgOpen) {
      panel.classList.add('open');
      toggleBtn.innerHTML = 'CLOSE &#9650;';
    } else {
      panel.classList.remove('open');
      toggleBtn.innerHTML = 'UPGRADES &#9660;';
    }
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
    damage: { n: "DAMAGE", d: "Base firepower.", b: 15, i: 5, c: 10, cm: 1.15, isD: false, col: "#0ff" },
    speed:  { n: "FIRE RATE", d: "Shots per second.", b: 1.5, i: 0.2, c: 15, cm: 1.25, isD: true, col: "#0ff" },
    hp:     { n: "ARMOR", d: "Max tower health.", b: 200, i: 30, c: 10, cm: 1.15, isD: false, col: "#0f0" },
    regen:  { n: "REGEN", d: "Health recovery/sec.", b: 0, i: 1, c: 25, cm: 1.3, isD: true, col: "#0f0" },
    critC:  { n: "CRIT CHANCE", d: "% to deal critical hit.", b: 0, i: 5, c: 50, cm: 1.4, isD: false, col: "#ff3366", max: 10 },
    critD:  { n: "CRIT DMG", d: "Critical multiplier.", b: 1.5, i: 0.2, c: 50, cm: 1.4, isD: true, col: "#ff3366" },
    range:  { n: "RADAR", d: "Detection range.", b: 300, i: 50, c: 30, cm: 1.2, isD: false, col: "#ffd700", max: 10 }
  };

  const skillDefs = {
    'start':     { id: 'start', x: 500, y: 400, req: null, cost: 0, n: 'Core', d: 'Base system.' },
    'multishot': { id: 'multishot', x: 500, y: 300, req: 'start', cost: 100, n: 'Multi-Shot', d: '+1 Projectile.' },
    'missiles':  { id: 'missiles', x: 350, y: 300, req: 'multishot', cost: 500, n: 'Missiles', d: 'Guided AoE damage.' },
    'lasers':    { id: 'lasers', x: 650, y: 300, req: 'multishot', cost: 500, n: 'Lasers', d: 'Piercing beam.' },
    'shield':    { id: 'shield', x: 500, y: 500, req: 'start', cost: 200, n: 'Shield', d: 'Absorbs 1 hit/10s.' },
    'thorn':     { id: 'thorn', x: 350, y: 500, req: 'shield', cost: 400, n: 'Thorns', d: 'Reflects 50% dmg.' }
  };

  const achvDefs = [
    { id: 'w10', n: 'Survivor', d: 'Reach Wave 10.', req: () => player.highestWave >= 10, r: 100 },
    { id: 'w30', n: 'Veteran', d: 'Reach Wave 30.', req: () => player.highestWave >= 30, r: 500 },
    { id: 'k100', n: 'Hunter', d: 'Kill 100 Enemies.', req: () => player.totalKills >= 100, r: 50 }
  ];

  /** SAVE SYSTEM **/
  let player = { coins: 0, highestWave: 1, totalKills: 0, bossKills: 0, ws: {}, skills: ['start'], achievements: [] };
  let run = {stats:{},cash:0,coins:0,wave:1,kills:0,combo:0,comboTimer:0,graze:0};
  let targetEnemy = null; 

  function saveGame() { localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(player))); checkAchievements(); updateMenuUI(); }
  function loadGame() { 
    const s = localStorage.getItem(SAVE_KEY); 
    if(s) { try { let p=JSON.parse(atob(s)); player={...player,...p}; player.ws={...player.ws,...(p.ws||{})}; } catch(err) { console.warn("Save inválida",err); localStorage.removeItem(SAVE_KEY); } }
    Object.keys(statDefs).forEach(k => { if(player.ws[k]===undefined) player.ws[k]=0; });
    updateMenuUI(); buildSkillTree();
  }
  function resetSave() { if(confirm("Delete all progress?")) { localStorage.removeItem(SAVE_KEY); location.reload(); } }

  function checkAchievements() {
    achvDefs.forEach(a => {
      if(!player.achievements.includes(a.id) && a.req()) {
        player.achievements.push(a.id); player.coins += a.r;
        notify("🏆 ACHIEVEMENT!", `${a.n} (+${a.r} Coins)`); saveGame();
      }
    });
  }

  function notify(title, msg) {
    const box = document.getElementById('notif-box');
    const el = document.createElement('div'); el.className = 'notif'; el.innerHTML = `<h4>${title}</h4><p>${msg}</p>`;
    box.appendChild(el); setTimeout(() => { el.style.opacity = 0; setTimeout(()=>el.remove(), 300); }, 3000);
  }

  function getVal(k, wsO=false) { const d=statDefs[k]; let l=player.ws[k]+(wsO?0:(run.stats[k]||0)); let v=d.b+(l*d.i); return d.isD?v.toFixed(2):Math.floor(v); }
  function getCost(k, isW) { const d=statDefs[k]; let l=isW?player.ws[k]:(run.stats[k]||0); return Math.floor(d.c*Math.pow(d.cm, l)); }
  function hasSkill(id) { return player.skills.includes(id); }

  /** MAIN LOOP & RENDERING **/
  function startGame() {
    AudioSys.init();
    document.getElementById('menu').classList.remove('active-layer'); document.getElementById('hud').classList.add('active-hud');
    run = { stats: {}, cash: 0, coins: 0, wave: 1, kills: 0 };
    Object.keys(statDefs).forEach(k => run.stats[k]=0);
    
    game = { running: true, dt: 0, last: performance.now(), shake: 0, spawnT: 0, toSpawn: 10, ents: { e:[], p:[], part:[], txt:[] }, cx: canvas.width/2, cy: canvas.height/2 };
    
    tower = new Tower(); 
    initUpgBar();
    updateHUD();
    requestAnimationFrame(loop);
  }

  function processGameOver() {
    if(!game || !game.running) return;
    game.running = false; document.getElementById('hud').classList.remove('active-hud'); document.getElementById('gameover').classList.add('active-layer');
    document.getElementById('go-wave').innerText = run.wave; document.getElementById('go-kills').innerText = run.kills; document.getElementById('go-coins').innerText = "+"+run.coins+" COINS";
    player.coins += run.coins; if(run.wave > player.highestWave) player.highestWave = run.wave; saveGame();
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
    game.dt = (ts - game.last)/1000; if(game.dt > 0.1) game.dt = 0.1; game.last = ts;

    let panelWidth = 300;
    let targetCx = isUpgOpen ? (canvas.width - panelWidth) / 2 : canvas.width / 2;
    
    // Deslize da câmara
    let prevCx = game.cx;
    game.cx += (targetCx - game.cx) * 6 * game.dt;
    let shiftX = game.cx - prevCx;

    // Deslize das entidades
    if (Math.abs(shiftX) > 0.01) {
      game.ents.e.forEach(ent => ent.x += shiftX);
      game.ents.p.forEach(ent => ent.x += shiftX);
      game.ents.part.forEach(ent => ent.x += shiftX);
      game.ents.txt.forEach(ent => ent.x += shiftX);
    }

    game.cy = canvas.height / 2;
    tower.x = game.cx;
    tower.y = game.cy;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrid(game.dt);
    
    if(game.shake > 0) { game.shake -= game.dt; let mx = (Math.random()-0.5)*20; let my = (Math.random()-0.5)*20; canvas.style.transform = `translate(${mx}px, ${my}px)`; } 
    else { canvas.style.transform = "translate(0,0)"; }

    if(game.toSpawn <= 0 && game.ents.e.length === 0) {
      run.wave++; game.toSpawn = 10 + Math.floor(run.wave * 2);
      run.coins += Math.floor(run.wave/2) + 2; updateHUD(); AudioSys.coin(); checkAchievements(); 
    }
    game.spawnT -= game.dt;
    if(game.spawnT <= 0 && game.toSpawn > 0) { game.ents.e.push(new Enemy(run.wave)); game.toSpawn--; game.spawnT = Math.max(0.1, 1.2 - (run.wave*0.05)); updateHUD(); }

    tower.update(game.dt); tower.draw();run.comboTimer=Math.max(0,run.comboTimer-game.dt);if(!run.comboTimer)run.combo=0;game.bombCd=Math.max(0,game.bombCd-game.dt);

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