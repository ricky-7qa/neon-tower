  /** MENUS & HUD **/
  function switchTab(t) { ['workshop', 'skills', 'achievements'].forEach(x => { const tab = document.getElementById('tab-'+x); tab.style.display = (x===t?'flex':'none'); if (x===t) tab.scrollTop = 0; }); if (t==='skills') buildSkillTree(); }
  
  function updateMenuUI() {
    document.getElementById('menu-coins').innerText = player.coins;
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
          <button class="btn btn-gold" ${player.coins<cost||isMax?'disabled':''} onclick="buyWs('${k}')">${isMax?'MAX LEVEL':`UPGRADE · ${cost} COINS`}</button>
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
      const targetText = next ? (a.format ? a.format(next.value) : next.value.toLocaleString('pt-PT')) : 'MAX';
      const stars = '★'.repeat(earned) + '☆'.repeat(5-earned);
      const progress = next ? Math.min(100, metric / next.value * 100) : 100;
      ach.insertAdjacentHTML('beforeend', `<article class="card achievement-card ${earned===5?'achievement-max':''}">
        <div class="achievement-head"><div><span class="achievement-kicker">PROGRESSO ${earned}/5</span><h3>${a.n}</h3></div><span class="achievement-stars" aria-label="${earned} de 5 estrelas">${stars}</span></div>
        <p>${a.d}</p>
        <div class="achievement-progress"><span style="width:${progress}%"></span></div>
        <div class="achievement-foot"><span>${currentText} / ${targetText}</span><strong>${next ? '+'+next.reward+' COINS' : 'COMPLETED'}</strong></div>
      </article>`);
    });
  }

  function buildSkillTree() {
    const container = document.getElementById('skill-tree-container');
    container.innerHTML = '<div class="skill-intro"><span class="eyebrow">MELHORIAS PERMANENTES</span><h2>Árvore de competências</h2><p>Escolhe melhorias para a torre. Vê o efeito, o preço e os requisitos antes de comprar. As compras são permanentes.</p><div class="skill-wallet">AS TUAS COINS: <strong>' + player.coins.toLocaleString('pt-PT') + '</strong></div></div><div class="skill-grid" id="skill-grid"></div>';
    const grid = document.getElementById('skill-grid');
    Object.values(skillDefs).forEach(s => {
      const unlocked = hasSkill(s.id);
      const available = !unlocked && (s.req === null || hasSkill(s.req));
      const locked = !unlocked && !available;
      const requirement = s.req ? 'Requires: ' + skillDefs[s.req].n : (s.id === 'start' ? 'Starting skill' : 'No requirement');
      const effect = {
        start: 'Unlocks the tower core systems.',
        multishot: 'Adds one extra projectile to each firing burst.',
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
        '<button class="btn btn-gold skill-buy" ' + (player.coins < s.cost ? 'disabled' : '') + ' onclick="buySkill(\'' + s.id + '\')">' + (s.cost === 0 ? 'FREE' : (player.coins < s.cost ? 'NEED ' + (s.cost-player.coins) + ' COINS' : 'COMPRAR · ' + s.cost + ' COINS')) + '</button>';
      grid.insertAdjacentHTML('beforeend', `<article class="skill-card ${unlocked?'is-unlocked':''} ${locked?'is-locked':''}">
        <div class="skill-card-top"><span class="skill-icon">${s.id==='start'?'◆':s.id==='multishot'?'⟡':s.id==='missiles'?'➤':s.id==='lasers'?'ϟ':s.id==='shield'?'⬡':'✦'}</span><span class="skill-status ${unlocked?'done':locked?'locked':'ready'}">${status}</span></div>
        <h3>${s.n}</h3><p class="skill-description">${effect}</p>
        <div class="skill-meta"><span>${requirement}</span><strong>${s.cost === 0 ? 'GRÁTIS' : s.cost.toLocaleString('pt-PT') + ' COINS'}</strong></div>
        ${action}
      </article>`);
    });
  }

  function buyWs(k) { let c=getCost(k,true); if(player.coins>=c && (!statDefs[k].max || (player.ws[k]||0)<statDefs[k].max)){player.coins-=c;player.ws[k]=(player.ws[k]||0)+1;saveGame();} }
  function buySkill(id) {
    let s = skillDefs[id]; if(hasSkill(id)) return;
    if(player.coins >= s.cost) { player.coins -= s.cost; player.skills.push(id); saveGame(); buildSkillTree(); AudioSys.coin(); }
  }

  function initUpgBar() {
    let ub = document.getElementById('upg-content'); ub.innerHTML = "";
    Object.keys(statDefs).forEach(k => {
      let btn = document.createElement("button");
      btn.className = "btn upg-btn";
      btn.id = "btn-upg-" + k;
      btn.onclick = () => buyRunUpg(k);
      ub.appendChild(btn);
    });
  }

  function updateHUD() {
    document.getElementById('hud-wave').innerText = run.wave;
    document.getElementById('hud-timer').innerText = game.toSpawn + game.ents.e.length;
    document.getElementById('hud-cash').innerText = '$'+run.cash;
    document.getElementById('hud-coins').innerText = run.coins;
    
    if (tower) {
      document.getElementById('st-dmg').innerText = getVal('damage');
      document.getElementById('st-spd').innerText = getVal('speed') + '/s';
      document.getElementById('st-hp').innerText = `${Math.ceil(Math.max(0, tower.hp))} / ${getVal('hp')}`;
      document.getElementById('st-reg').innerText = getVal('regen') + '/s';
    }

    const tui = document.getElementById('target-ui');
    if(targetEnemy) {
       tui.classList.add('visible');
       document.getElementById('t-name').innerText = `TARGET: ${targetEnemy.type.toUpperCase()}`;
       let hpPct = Math.max(0, (targetEnemy.hp / targetEnemy.maxHp) * 100);
       document.getElementById('t-hp-fill').style.width = hpPct + '%';
       document.getElementById('t-hp-text').innerText = `${Math.ceil(Math.max(0, targetEnemy.hp))} / ${Math.ceil(targetEnemy.maxHp)} HP`;
    } else {
       tui.classList.remove('visible');
    }
    
    Object.keys(statDefs).forEach(k => {
      let d=statDefs[k], l=run.stats[k]||0, c=getCost(k, false), m=d.max&&l>=d.max;
      let btn = document.getElementById('btn-upg-' + k);
      if(btn) {
         btn.disabled = (run.cash < c) || m;
         btn.innerHTML = `<span style="color:${d.col}">${d.n} · LVL ${(player.ws[k]||0)+l}</span><span style="color:#0f0;">${m?'MAX':c}</span>`;
      }
    });
  }
  
  function buyRunUpg(k) {
    let c = getCost(k, false); if(run.cash >= c) { run.cash -= c; run.stats[k] = (run.stats[k]||0)+1; 
    if(k==='hp'){ let o=tower.maxHp; tower.maxHp=parseFloat(getVal('hp')); tower.hp+=(tower.maxHp-o); } updateHUD(); AudioSys.coin(); }
  }

  window.addEventListener('keydown',ev=>{if(!game||!game.running||!tower)return;if(ev.code==='Space'&&!ev.repeat&&tower.dashCd<=0){tower.invuln=.5;tower.dashCd=3;notify('DASH','0,5 s invulnerável');}if(ev.key.toLowerCase()==='b'&&!ev.repeat&&game.bombCd<=0){game.ents.b.forEach(b=>bulletPool.release(b));game.ents.b.length=0;game.bombCd=12;AudioSys.explosion();notify('SMART BOMB','Balas removidas');}});

  loadGame();
