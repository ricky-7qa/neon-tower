  /** ENTITIES & TOP-DOWN 3D GRAPHICS **/
  let game = { running: false, dt: 0, last: 0, shake: 0, spawnT: 0, toSpawn: 0, ents: { e:[], p:[], b:[], part:[], txt:[] }, bombCd:0, cx: 0, cy: 0 };

  function drawTopDown3D(ctx, x, y, r, color, type) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5;
    
    if(type === 'Tank') {
      let grad = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
      grad.addColorStop(0, '#fff'); grad.addColorStop(0.2, color); grad.addColorStop(1, '#222');
      ctx.fillStyle = grad;
      ctx.beginPath(); 
      if (ctx.roundRect) ctx.roundRect(x-r, y-r, r*2, r*2, 6); else ctx.rect(x-r, y-r, r*2, r*2);
      ctx.fill();
    } else {
      let grad = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.1, x, y, r);
      grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, color); grad.addColorStop(1, '#111');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  class Tower {
    constructor() {
      this.x = game.cx || canvas.width/2; this.y = game.cy || canvas.height/2; this.r = 35;
      this.maxHp = parseFloat(getVal('hp')); this.hp = this.maxHp; 
      this.cdBase = 0; this.cdMissile = 0; this.cdLaser = 0; this.angle = 0; this.multiQueue=null; this.invuln=0; this.dashCd=0;
      this.shield = hasSkill('shield'); this.shieldCd = 0;
    }
    update(dt) {
      let reg = parseFloat(getVal('regen')) + (run.perks?.repair||0)*3; if(reg>0 && this.hp<this.maxHp) this.hp = Math.min(this.maxHp, this.hp + reg*dt);
      if(this.shieldCd > 0) this.shieldCd -= dt; else if(hasSkill('shield')) this.shield = true;
      
      let range = parseFloat(getVal('range')) * (1+(run.perks?.radar||0)*.15);
      let targets = game.ents.e.filter(e => MathUtils.dist(this.x, this.y, e.x, e.y) < range);
      
      if(targets.length > 0) {
        // Prioritize the closest enemy.
        targets.sort((a, b) => {
           let distA = MathUtils.dist(this.x, this.y, a.x, a.y);
           let distB = MathUtils.dist(this.x, this.y, b.x, b.y);
           return distA - distB;
        });
        
        targetEnemy = targets[0]; 
        this.angle = MathUtils.angle(this.x, this.y, targetEnemy.x, targetEnemy.y); 
      } else { targetEnemy = null; }

      this.invuln=Math.max(0,this.invuln-dt); this.dashCd=Math.max(0,this.dashCd-dt);
      this.cdBase-=dt;
      
      if(this.cdBase<=0&&targetEnemy){
        AudioSys.shoot();
        let dmg=parseFloat(getVal('damage'))*(1+(run.perks?.power||0)*.2);
        let crit=(Math.random()*100)<parseFloat(getVal('critC'));
        let finalD=crit?dmg*parseFloat(getVal('critD')):dmg;
        const level=Math.min(3,Math.max(0,parseInt(getVal('multishot'))||0));
        const totalShots=level+1;
        // Multi-shot projectiles all home onto the selected target. Their
        // tiny muzzle offsets keep the burst readable while guidance makes
        // every projectile converge instead of missing with a fixed spread.
        const sideX=-Math.sin(this.angle), sideY=Math.cos(this.angle);
        for(let shot=0;shot<totalShots;shot++){
          const lane=shot-(totalShots-1)/2;
          const offset=lane*5;
          game.ents.p.push(new Projectile(this.x+sideX*offset,this.y+sideY*offset,this.angle,finalD,crit,'base',targetEnemy));
        }
        this.cdBase=1/(parseFloat(getVal('speed'))*(1+(run.perks?.rapid||0)*.15)*(hasSkill('overdrive')?1.25:1));
      }

      if(hasSkill('drone') && targetEnemy) {
        this.cdDrone=(this.cdDrone||0)-dt;
        if(this.cdDrone<=0){game.ents.p.push(new Missile(this.x,this.y,this.angle,parseFloat(getVal('damage'))*1.5,targetEnemy));this.cdDrone=3;}
      }

      if(hasSkill('missiles') && targetEnemy) {
        this.cdMissile -= dt;
        if(this.cdMissile <= 0) {
          AudioSys.missile();
          game.ents.p.push(new Missile(this.x, this.y, this.angle + (Math.random()-0.5), parseFloat(getVal('damage'))*2, targetEnemy));
          this.cdMissile = 2.0;
        }
      }

      if(hasSkill('lasers') && targetEnemy) {
        this.cdLaser -= dt;
        if(this.cdLaser <= 0) {
          AudioSys.laser();
          game.ents.p.push(new Laser(this.x, this.y, this.angle, parseFloat(getVal('damage'))*0.5, 0.5));
          this.cdLaser = 4.0;
        }
      }
    }
    draw() {
      ctx.save(); ctx.translate(this.x, this.y); 
      
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(0, 0, this.r+10, 0, Math.PI*2);
      ctx.fillStyle = '#112'; ctx.fill();
      ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2; ctx.stroke();
      
      if(this.shield) { 
        ctx.beginPath(); ctx.arc(0,0, this.r+25, 0, Math.PI*2); 
        ctx.strokeStyle="rgba(0,255,255,0.6)"; ctx.lineWidth=3; ctx.stroke(); 
      }
      ctx.rotate(this.angle);
      
      ctx.shadowBlur = 10; ctx.shadowColor = '#000'; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
      ctx.fillStyle = '#334'; ctx.fillRect(0, -8, this.r+15, 16);
      ctx.fillStyle = '#0ff'; ctx.fillRect(this.r, -4, 15, 8);
      
      let grad = ctx.createRadialGradient(-this.r*0.2, -this.r*0.2, this.r*0.1, 0, 0, this.r);
      grad.addColorStop(0, '#556'); grad.addColorStop(1, '#112');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI*2); ctx.fill();
      
      ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.arc(0, 0, this.r*0.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      
      const bw = 80; ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(this.x-bw/2, this.y-this.r-25, bw, 8);
      ctx.fillStyle = "#0f0"; ctx.fillRect(this.x-bw/2, this.y-this.r-25, bw*(this.hp/this.maxHp), 8);
    }
    hit(dmg, attacker) {
      if(this.invuln>0)return;
      run.combo=0;run.comboTimer=0;
      if(this.shield) { this.shield = false; this.shieldCd = Math.max(2,10-parseFloat(getVal('shieldRecharge'))); game.shake = 0.10; createParts(this.x, this.y, "#0096ff", 20, 5); return; }
      if(Math.random()*100<parseFloat(getVal('dodge'))) { createParts(this.x,this.y,"#9b8cff",12,4); return; }
      let reduced=dmg*(hasSkill('fortify')?0.9:1);
      reduced=Math.max(1,reduced-parseFloat(getVal('armor')));
      this.hp -= reduced; game.shake = 0.14; AudioSys.hit();
      game.ents.txt.push(new FText(this.x, this.y-40, `-${Math.floor(reduced)}`, "#f00", 24));
      
      if(hasSkill('thorn') && attacker) { attacker.hit(reduced * 0.5); createParts(this.x, this.y, "#fff", 10, 3); }
      if(this.hp <= 0) processGameOver();
    }
  }

  class Enemy {
    constructor(w) {
      // Spawn immediately outside a real canvas edge, not hundreds of pixels away.
      const a = Math.random() * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const halfW = Math.max(1, canvas.width / 2);
      const halfH = Math.max(1, canvas.height / 2);
      const margin = 24;
      const tx = Math.abs(dx) > 0.001 ? (halfW + margin) / Math.abs(dx) : Infinity;
      const ty = Math.abs(dy) > 0.001 ? (halfH + margin) / Math.abs(dy) : Infinity;
      const d = Math.min(tx, ty);
      this.x = game.cx + dx * d;
      this.y = game.cy + dy * d;
      
      let rand = Math.random(); this.type = "Minion"; this.c = "#ff0055"; this.r = 15;
      let hm = 1, sm = 1, cm = 1;
      
      if(game.toSpawn===1&&w%5===0){this.type='Boss';this.c='#9900ff';this.r=35;hm=25;sm=.4;cm=30;notify('WARNING','BOSS!');}else if(w>2&&rand<.15){this.type='Kamikaze';this.c='#ff3355';this.r=13;hm=.8;sm=2;cm=1.5;}else if(w>2&&rand<.3){this.type='Tank';this.c='#ffaa00';this.r=22;hm=4;sm=.5;cm=3;}else if(w>3&&rand<.45){this.type='Sniper';this.c='#b45cff';this.r=12;hm=.8;sm=.65;cm=2;}else if(w>4&&rand<.55){this.type='Scout';this.c='#0088ff';this.r=10;hm=.5;sm=2;cm=1.5;}this.fireCd=.8;this.phase=Math.random()*6.28;

      this.maxHp = (20 * Math.pow(1.2, w)) * hm; this.hp = this.maxHp;
      this.dmg = (5 * Math.pow(1.15, w)) * hm; this.spd = (75 + (w*2)) * sm;
      this.val = Math.floor(4 * Math.pow(1.1, w) * cm);
    }
    update(dt){const a=MathUtils.angle(this.x,this.y,tower.x,tower.y),d=MathUtils.dist(this.x,this.y,tower.x,tower.y);if(this.type==='Sniper'){if(d>300){this.x+=Math.cos(a)*this.spd*dt;this.y+=Math.sin(a)*this.spd*dt;}else if(d<210){this.x-=Math.cos(a)*this.spd*dt;this.y-=Math.sin(a)*this.spd*dt;}}else{let v=this.type==='Kamikaze'?this.spd*1.35:this.spd;this.x+=Math.cos(a)*v*dt;this.y+=Math.sin(a)*v*dt;}this.fireCd-=dt;this.phase+=dt;if(this.fireCd<=0){let aim=MathUtils.angle(this.x,this.y,tower.x,tower.y),bd=Math.max(3,this.dmg*.18);if(this.type==='Boss'){for(let k=0;k<12;k++)spawnBullet(this.x,this.y,this.phase+k*Math.PI/6,155,bd,'boss');this.fireCd=1;}else if(this.type==='Sniper'){spawnBullet(this.x,this.y,aim,520,bd,'sniper');this.fireCd=2;}else if(this.type==='Tank'){for(let k=0;k<8;k++)spawnBullet(this.x,this.y,aim+k*Math.PI/4,125,bd,'ring');this.fireCd=2.6;}else{spawnBullet(this.x,this.y,aim,180,bd,'normal');this.fireCd=1.8;}}}
    draw() {
      drawTopDown3D(ctx, this.x, this.y, this.r, this.c, this.type);
      
      if(targetEnemy !== this) {
         ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(this.x-15, this.y-this.r-15, 30, 5);
         ctx.fillStyle = "#f00"; ctx.fillRect(this.x-15, this.y-this.r-15, 30*(this.hp/this.maxHp), 5);
      } else {
         ctx.strokeStyle = "#ff3366"; ctx.lineWidth = 2;
         ctx.beginPath(); ctx.arc(this.x, this.y, this.r+8, 0, Math.PI*2); ctx.stroke();
      }
    }
    hit(dmg) {
      this.hp -= dmg;
      if(this.hp <= 0) {
        AudioSys.explosion(); run.kills++; player.totalKills++; run.combo++; run.comboTimer=3; run.cash += Math.floor(this.val*(1+Math.min(run.combo,10)*.1)*(1+parseFloat(getVal('cashBonus'))/100)*(1+(run.perks?.fortune||0)*.25)); 
        if(hasSkill('vampire') && tower) tower.hp=Math.min(tower.maxHp,tower.hp+tower.maxHp*.02);
        if(this.type === 'Boss') { player.bossKills++; run.coins += 15; game.shake = 1.0; createParts(this.x,this.y,this.c, 60, 8, 2); }
        else { createParts(this.x,this.y,this.c, 15, 4); if(Math.random() < 0.05) run.coins++; }
        checkAchievements(); return true; 
      }
      return false;
    }
  }

  class Projectile {
    constructor(x,y,a,d,c,t,target=null){this.x=x;this.y=y;this.prevX=x;this.prevY=y;this.a=a; this.d=d; this.c=c; this.type=t; this.target=target; this.turnRate=hasSkill('multishot')?18:12; this.spd=900; this.r=4; this.dead=false; }
    update(dt){if(!this.target || this.target.hp<=0){this.target=game.ents.e.filter(e=>e.hp>0).sort((a,b)=>MathUtils.dist(this.x,this.y,a.x,a.y)-MathUtils.dist(this.x,this.y,b.x,b.y))[0]||null;}if(this.target && this.target.hp>0){const desired=MathUtils.angle(this.x,this.y,this.target.x,this.target.y);let delta=desired-this.a;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;this.a+=Math.max(-this.turnRate*dt,Math.min(this.turnRate*dt,delta));}this.prevX=this.x;this.prevY=this.y;this.x+=Math.cos(this.a)*this.spd*dt;this.y+=Math.sin(this.a)*this.spd*dt;createParts(this.x,this.y,'#0ff',1,0,.1);}
    draw() { 
      ctx.shadowBlur=10; ctx.shadowColor="#0ff"; ctx.fillStyle = this.c ? "#fff" : "#0ff"; 
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
    collide(e){if(segmentHitsCircle(this.prevX,this.prevY,this.x,this.y,e.x,e.y,this.r+e.r)){this.dead=true;return true;}return false;}
  }

  class Missile {
    constructor(x,y,a,d,target){this.x=x;this.y=y;this.prevX=x;this.prevY=y;this.a=a; this.d=d; this.target=target; this.spd=400; this.r=6; this.dead=false; this.life=5; }
    update(dt) {
      this.life -= dt; if(this.life <= 0) this.dead = true;
      if(this.target && this.target.hp > 0) {
        let ta = MathUtils.angle(this.x, this.y, this.target.x, this.target.y);
        let da = ta - this.a; while(da > Math.PI) da -= Math.PI*2; while(da < -Math.PI) da += Math.PI*2;
        this.a += da * 5 * dt;
      }
      this.prevX=this.x;this.prevY=this.y;this.x+=Math.cos(this.a)*this.spd*dt;this.y+=Math.sin(this.a)*this.spd*dt;
      createParts(this.x,this.y,'#ffaa00',3,2,.4);
    }
    draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.a); ctx.shadowBlur=5; ctx.shadowColor="#ffaa00"; ctx.fillStyle="#fff"; ctx.fillRect(-5,-3,10,6); ctx.restore(); }
    
    collide(e, entsList) { 
      if(segmentHitsCircle(this.prevX,this.prevY,this.x,this.y,e.x,e.y,this.r+e.r)){
        this.dead=true;game.shake=.3; createParts(this.x, this.y, "#ffaa00", 40, 8, 0.5); AudioSys.explosion(); 
        entsList.forEach(en => {
           if(MathUtils.dist(this.x, this.y, en.x, en.y) < 100) { en.hit(this.d); game.ents.txt.push(new FText(en.x, en.y, Math.floor(this.d), "#ffaa00", 18)); }
        });
        return true;
      } 
      return false; 
    }
  }

  class Laser {
    constructor(x, y, a, d, dur) { this.x=x; this.y=y; this.a=a; this.d=d; this.dur=dur; this.maxDur=dur; this.dead=false; this.hitList=new Set(); }
    update(dt) { this.x = tower.x; this.y = tower.y; this.dur -= dt; if(this.dur <= 0) this.dead = true; this.hitList.clear(); }
    draw() { 
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.a); ctx.shadowBlur = 10; ctx.shadowColor = "#f00";
      ctx.fillStyle = `rgba(255, 0, 0, ${this.dur/this.maxDur})`; ctx.fillRect(0, -10, 2000, 20); 
      ctx.fillStyle = `rgba(255, 255, 255, ${this.dur/this.maxDur})`; ctx.fillRect(0, -3, 2000, 6); 
      ctx.restore();
    }
    collide(e) {
      if(this.hitList.has(e)) return false; 
      let dx = Math.cos(this.a), dy = Math.sin(this.a); let v = (e.x - this.x)*dx + (e.y - this.y)*dy;
      if(v > 0) {
        let px = this.x + dx*v, py = this.y + dy*v;
        if(MathUtils.dist(e.x, e.y, px, py) < e.r + 15) { this.hitList.add(e); return true; }
      }
      return false;
    }
  }

  class Part {
    constructor(x,y,c,s,l) { this.x=x; this.y=y; this.c=c; this.a=Math.random()*Math.PI*2; this.s=Math.random()*s; this.l=l; this.ml=l; }
    update(dt) { this.x+=Math.cos(this.a)*this.s*dt; this.y+=Math.sin(this.a)*this.s*dt; this.l-=dt; this.s*=0.95; }
    draw() { ctx.globalAlpha=Math.max(0,this.l/this.ml); ctx.fillStyle=this.c; ctx.fillRect(this.x,this.y,4,4); ctx.globalAlpha=1; }
  }
  class FText {
    constructor(x,y,t,c,s=14) { this.x=x+(Math.random()*20-10); this.y=y; this.t=t; this.c=c; this.s=s; this.l=1; }
    update(dt) { this.y-=50*dt; this.l-=dt; }
    draw() { ctx.globalAlpha=Math.max(0,this.l); ctx.fillStyle=this.c; ctx.font=`bold ${this.s}px Orbitron`; ctx.fillText(this.t,this.x,this.y); ctx.globalAlpha=1; }
  }
  function createParts(x,y,c,n,s,l=0.5) { for(let i=0;i<n;i++) game.ents.part.push(new Part(x,y,c,s*60,l)); }

