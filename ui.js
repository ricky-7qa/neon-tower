  /** MENUS & HUD **/
  function switchTab(t) { ['workshop', 'skills', 'achievements'].forEach(x => document.getElementById('tab-'+x).style.display = (x===t?'flex':'none')); }
  
  function updateMenuUI() {
    document.getElementById('menu-coins').innerText = player.coins;
    document.getElementById('menu-wave').innerText = player.highestWave;
    
    let ws = document.getElementById('ws-grid'); ws.innerHTML = "";
    Object.keys(statDefs).forEach(k => {
      let d = statDefs[k], lvl = player.ws[k]||0, cost = getCost(k, true), val = getVal(k, true), isMax = d.max && lvl >= d.max;
      ws.innerHTML += `<div class="card">
        <div><h3><span style="color:${d.col}">${d.n}</span> <span>Lvl.${lvl}</span></h3><p>${d.d}<br><br><span style="color:#fff;">Current: ${val}</span></p></div>
        <button class="btn btn-gold" ${player.coins<cost||isMax?'disabled':''} onclick="buyWs('${k}')">${isMax?'MAX':`UPGRADE - ${cost} C`}</button>
      </div>`;
    });

    let ach = document.getElementById('achv-grid'); ach.innerHTML = "";
    achvDefs.forEach(a => {
      let done = player.achievements.includes(a.id);
      ach.innerHTML += `<div class="card" style="border-color:${done?'#0f0':'#333'}">
        <h3 style="color:${done?'#0f0':'#fff'}">${a.n} ${done?'(DONE)':''}</h3>
        <p>${a.d}</p><p class="c-gold">+${a.r} COINS</p>
      </div>`;
    });
  }

  function buildSkillTree() {
    const container = document.getElementById('skill-tree-container');
    container.innerHTML = '<div class="skill-intro"><span class="eyebrow">PERMANENT UPGRADES</span><h2>Choose your technology</h2><p>Compra melhorias permanentes com Global Coins. Cada cartão mostra o efeito, custo e requisito.</p></div><div class="skill-grid" id="skill-grid"></div>';
    const grid = document.getElementById('skill-grid');
    Object.values(skillDefs).forEach(s => {
      const unlocked = hasSkill(s.id);
      const available = !unlocked && (s.req === null || hasSkill(s.req));
      const locked = !unlocked && !available;
      const requirement = s.req ? 'Requer: ' + skillDefs[s.req].n : (s.id === 'start' ? 'Núcleo inicial' : 'Sem requisito');
      const effect = {
        start: 'Desbloqueia o sistema base da torre.',
        multishot: 'Dispara um segundo projétil logo após o primeiro, na mesma direção.',
        missiles: 'Lança um míssil teleguiado a cada 2 segundos. Causa dano em área.',
        lasers: 'Dispara um laser perfurante durante 0,5 s a cada 4 segundos.',
        shield: 'Absorve um impacto. Recarrega após 10 segundos.',
        thorn: 'Devolve 50% do dano quando um inimigo colide diretamente com a torre.'
      }[s.id] || s.d;
      const status = unlocked ? 'DESBLOQUEADA' : locked ? 'BLOQUEADA' : 'DISPONÍVEL';
      const action = unlocked ? '<span class="skill-status done">✓ ' + status + '</span>' :
        locked ? '<button class="btn skill-buy" disabled>' + status + '</button>' :
        '<button class="btn btn-gold skill-buy" ' + (player.coins < s.cost ? 'disabled' : '') + ' onclick="buySkill(\'' + s.id + '\')">' + (s.cost === 0 ? 'GRÁTIS' : 'DESBLOQUEAR · ' + s.cost + ' COINS') + '</button>';
      grid.insertAdjacentHTML('beforeend', `<article class="skill-card ${unlocked?'is-unlocked':''} ${locked?'is-locked':''}">
        <div class="skill-card-top"><span class="skill-icon">${s.id==='start'?'◆':s.id==='multishot'?'⟡':s.id==='missiles'?'➤':s.id==='lasers'?'ϟ':s.id==='shield'?'⬡':'✦'}</span><span class="skill-status ${unlocked?'done':locked?'locked':'ready'}">${status}</span></div>
        <h3>${s.n}</h3><p class="skill-description">${effect}</p>
        <div class="skill-meta"><span>${requirement}</span><strong>${s.cost === 0 ? 'GRÁTIS' : s.cost.toLocaleString('pt-PT') + ' COINS'}</strong></div>
        ${action}
      </article>`);
    });
  }

  function buyWs(k) { let c = getCost(k, true); if(player.coins >= c) { player.coins -= c; player.ws[k]=(player.ws[k]||0)+1; saveGame(); } }
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
       document.getElementById('t-name').innerText = `TARGET: ${targetEnemy.type}`;
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
         btn.innerHTML = `<span style="color:${d.col}">${d.n} (Lvl ${l})</span> <span style="color:#0f0;">$${m?'MAX':c}</span>`;
      }
    });
  }
  
  function buyRunUpg(k) {
    let c = getCost(k, false); if(run.cash >= c) { run.cash -= c; run.stats[k] = (run.stats[k]||0)+1; 
    if(k==='hp'){ let o=tower.maxHp; tower.maxHp=parseFloat(getVal('hp')); tower.hp+=(tower.maxHp-o); } updateHUD(); AudioSys.coin(); }
  }

  window.addEventListener('keydown',ev=>{if(!game||!game.running||!tower)return;if(ev.code==='Space'&&!ev.repeat&&tower.dashCd<=0){tower.invuln=.5;tower.dashCd=3;notify('DASH','0,5 s invulnerável');}if(ev.key.toLowerCase()==='b'&&!ev.repeat&&game.bombCd<=0){game.ents.b.forEach(b=>bulletPool.release(b));game.ents.b.length=0;game.bombCd=12;AudioSys.explosion();notify('SMART BOMB','Balas removidas');}});

  loadGame();
