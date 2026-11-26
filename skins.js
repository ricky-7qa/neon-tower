
/* NEON TOWER — account-backed Skin Vault. All transactions are validated by the neon-skins Edge Function. */
(function () {
  'use strict';
  const CATEGORIES = [
    { id: 'tower', label: 'TOWER', stat: 'fire_rate' },
    { id: 'enemy_minion', label: 'MINIONS', stat: 'enemy_cash' },
    { id: 'enemy_boss', label: 'BOSSES', stat: 'boss_coins' },
    { id: 'background', label: 'BACKGROUNDS', stat: 'wave_coins' }
  ];
  const BONUS = { common:[0.5,0.75], rare:[1,1.5], epic:[2,3], legendary:[4,5] };
  const PRICES = { basic:500, premium:2000, legendary:7500 };
  const ODDS = {
    basic:'70% COMMON · 23% RARE · 6% EPIC · 1% LEGENDARY',
    premium:'35% COMMON · 40% RARE · 20% EPIC · 5% LEGENDARY',
    legendary:'10% COMMON · 25% RARE · 40% EPIC · 25% LEGENDARY'
  };
  const DAILY = ['+250 COINS','+400 COINS','+600 COINS','+800 COINS','BASIC BOX','+1,200 COINS','PREMIUM BOX'];
  let state=null, loadedUserId='', loading=null, activeTab='shop', activeCategory='tower';
  let mergeSelection=new Set(), selectedTradeTarget=null, searchResults=[], tradeSelections={};
  let heartbeatTimer=null, runActive=false, lastMessage='';
  const emptySnapshot=()=>({equipped:{},bonuses:{fire_rate:0,enemy_cash:0,boss_coins:0,wave_coins:0}});
  function ctx(){return typeof window.getNeonSkinAccountContext==='function'?window.getNeonSkinAccountContext():null;}
  function safeText(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function categoryLabel(id){const f=CATEGORIES.find(x=>x.id===id);return f?f.label:'SKIN';}
  function rarityPlus(rarity,level){return String(rarity||'common').toUpperCase()+(Number(level)>0?'+':'');}
  function bonusPercent(rarity,level){const values=BONUS[String(rarity||'').toLowerCase()];return values?values[Number(level)>0?1:0]:0;}
  function bonusLabel(stat){return({fire_rate:'ATTACK SPEED',enemy_cash:'MINION CASH',boss_coins:'BOSS REWARDS',wave_coins:'WAVE REWARDS'})[stat]||String(stat||'BONUS').replace(/_/g,' ').toUpperCase();}
  function getDefinition(id){return(state&&state.definitions||[]).find(x=>x.skin_id===id)||null;}
  function getItem(id){return(state&&state.inventory||[]).find(x=>x.item_id===id)||null;}
  function definitionOf(item){return item&&(item.skin||getDefinition(item.skin_id));}
  function descriptionOf(def){
    const map={
      tower_foundry_mk1:'Industrial armour plates, reinforced barrel housing and exposed cooling vents.',
      tower_arc_warden:'Twin arc fins, insulated side coils and a charged targeting crown.',
      tower_void_architect:'Floating prism plates, a split halo and dimensional energy conduits.',
      tower_solar_crown:'A sculpted solar crest, radiant fins and orbiting golden power nodes.',
      minion_pulse_drone:'A compact scout drone with twin stabilisers and a raised signal antenna.',
      minion_rift_stalker:'Armoured side blades, a dorsal fin and a split-phase sensor.',
      minion_prism_wraith:'Floating prism shards and a spectral triangular crown.',
      minion_nova_herald:'A radiant crest, layered fins and orbiting energy nodes.',
      boss_void_regent:'Heavy crown plating and a reinforced outer shell.',
      boss_dread_crown:'A jagged crown, expanded armour shoulders and twin energy pylons.',
      boss_abyss_sovereign:'A floating crown array, orbiting shards and a segmented halo.',
      boss_eclipse_titan:'A monumental crest, layered eclipse rings and six orbiting nodes.',
      background_circuit_floor:'Circuit traces, illuminated junctions and industrial floor markings.',
      background_neon_nexus:'A network of linked neon terminals and geometric side panels.',
      background_stellar_grid:'A starfield, constellation links and distant orbital markers.',
      background_eclipse_arena:'Monumental corner pylons, eclipse motifs and angular arena markings.',
      exclusive_apex_founder:'A prestige tower chassis with a unique founder crest.',
      exclusive_endless_conqueror:'An endless arena backdrop traced with a champion constellation.',
      exclusive_boss_warden:'A unique boss crown with layered guardian armour.'
    };
    return map[def&&def.skin_id]||'A custom Neon Tower design with rarity-specific detailing.';
  }
  function art(category,rarity,level,skinId){
    const id=String(skinId||'').replace(/[^a-z0-9_-]/gi,'');
    return '<div class="skin-art skin-art-'+category+' rarity-'+rarity+(Number(level)>0?' is-plus':'')+'" data-skin="'+id+'"><span class="skin-art-core"></span><span class="skin-art-detail"></span><span class="skin-art-spark"></span></div>';
  }
  function bonusText(def,level){return'+'+bonusPercent(def.rarity,level)+'% '+bonusLabel(def.bonus_stat);}
  function milestoneNote(def) {
    if (!def || !def.is_exclusive) return '';
    const labels = {
      wave_50:'UNLOCK: REACH WAVE 50',
      kills_5000:'UNLOCK: ELIMINATE 5,000 ENEMIES',
      bosses_100:'UNLOCK: DEFEAT 100 BOSSES'
    };
    return labels[def.unlock_milestone] || 'EXCLUSIVE MILESTONE SKIN';
  }
  function buildLoadout(data){
    const result=emptySnapshot(), equipped=data&&data.equipped&&typeof data.equipped==='object'?data.equipped:{};
    Object.entries(equipped).forEach(([category,itemId])=>{
      const owned=(data.inventory||[]).find(item=>item.item_id===itemId);
      if(!owned||owned.locked_trade_id)return;
      const def=owned.skin||(data.definitions||[]).find(item=>item.skin_id===owned.skin_id);
      if(!def||def.category!==category)return;
      const percent=bonusPercent(def.rarity,owned.plus_level);
      result.equipped[category]={item_id:owned.item_id,skin_id:def.skin_id,name:def.name,category:def.category,rarity:def.rarity,plus_level:Number(owned.plus_level)||0,bonus_stat:def.bonus_stat};
      result.bonuses[def.bonus_stat]=(Number(result.bonuses[def.bonus_stat])||0)+percent;
    });
    return result;
  }
  async function invoke(action,payload){
    const c=ctx();
    if(!c||!c.client||!c.session)throw new Error('LOG IN TO USE THE SKIN VAULT.');
    const res=await c.client.functions.invoke('neon-skins',{body:Object.assign({action:action},payload||{})});
    if(res.error)throw res.error;
    if(!res.data||res.data.ok!==true)throw new Error((res.data&&res.data.error)||'SKIN REQUEST FAILED.');
    return res.data;
  }
  function isOpen(){const el=document.getElementById('tab-skins');return!!el&&el.style.display!=='none';}
  function setMessage(message){lastMessage=String(message||'');const el=document.getElementById('skins-account-status');if(el)el.textContent=lastMessage;}
  async function load(force){
    const c=ctx();
    if(!c||!c.client||!c.session||!c.userId||!c.cloudSaveReady)return null;
    if(loading)return loading;
    if(!force&&state&&loadedUserId===c.userId)return state;
    const userId=c.userId;
    loading=(async()=>{
      const data=await invoke('bootstrap'), current=ctx();
      if(!current||current.userId!==userId)return null;
      state=data;loadedUserId=userId;
      if(isOpen())render();
      return data;
    })().catch(error=>{
      console.error('Skin Vault sync failed:',error);
      setMessage('SKIN VAULT COULD NOT SYNC. CHECK YOUR CONNECTION AND REOPEN THIS TAB.');
      throw error;
    }).finally(()=>{loading=null;});
    return loading;
  }
  async function refresh(){
    const c=ctx();
    if(c&&typeof c.refreshCloudSave==='function'){try{await c.refreshCloudSave();}catch(error){console.warn('Wallet refresh failed:',error);}}
    return load(true);
  }
  function todayLisbon(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  }
  function claimedToday(daily){return!!(daily&&daily.last_claim&&daily.last_claim===todayLisbon());}
  function runLockText(){
    if(state&&state.run&&state.run.active)return'RUN ACTIVE · BOXES CAN STILL BE OPENED · MERGE, EQUIP AND TRADING ARE LOCKED.';
    if(state&&state.run&&state.run.saved)return'SAVED RUN DETECTED · BOXES CAN STILL BE OPENED · MERGE AND EQUIPPING ARE LOCKED · TRADING IS AVAILABLE.';
    return'ARMORY ONLINE · ALL SKIN FEATURES AVAILABLE.';
  }
  function render(){
    const host=document.getElementById('skins-panel'),status=document.getElementById('skins-account-status');
    if(!host)return;
    const c=ctx();
    if(!c||!c.session){
      if(status)status.textContent='ACCOUNT REQUIRED · YOUR SKINS ARE SAVED TO YOUR ACCOUNT.';
      host.innerHTML='<div class="skins-login-card"><div class="skins-login-icon">✦</div><h3>YOUR SKIN VAULT AWAITS</h3><p>Create a free account or log in to save skins, open boxes, claim rewards and trade with other pilots.</p><button class="btn btn-gold" onclick="switchTab(\'leaderboard\')">LOG IN / CREATE ACCOUNT</button></div>';
      updateSubnav();return;
    }
    if(!c.cloudSaveReady||!state||loadedUserId!==c.userId){
      if(status)status.textContent='SYNCING ACCOUNT INVENTORY...';
      host.innerHTML='<div class="skins-loading"><span class="skins-spinner"></span> CONNECTING TO THE SKIN VAULT...</div>';
      load(true).catch(()=>{});updateSubnav();return;
    }
    if(status)status.textContent=lastMessage||runLockText();
    const wallet=Number(state.wallet_coins)||0;
    const title={shop:'BOXES',collection:'COLLECTION',merge:'MERGE',trading:'TRADING'}[activeTab];
    const canShop=!!(state.run&&state.run.can_shop),canTrade=!!(state.run&&state.run.can_trade),canOpenBoxes=!!state.cloud_save_ready;
    host.innerHTML='<div class="skins-wallet-row"><span>GLOBAL COINS</span><strong>$'+wallet.toLocaleString('en-US')+'</strong><span class="skins-vault-status">'+(canShop?'VAULT UNLOCKED':state.run&&state.run.active?'RUN ACTIVE':'SAVED RUN')+'</span></div>'+
      '<div class="skins-content-heading"><h3>'+title+'</h3><span>FOUR CATEGORIES · FOUR RARITIES</span></div>'+
      (activeTab==='shop'?renderShop(canShop,canOpenBoxes):activeTab==='collection'?renderCollection(canShop):activeTab==='merge'?renderMerge(canShop):renderTrading(canTrade));
    updateSubnav();
  }
  function updateSubnav(){
    document.querySelectorAll('#tab-skins [data-skin-tab]').forEach(button=>{
      button.classList.toggle('btn-gold',button.dataset.skinTab===activeTab);
      button.classList.toggle('selected',button.dataset.skinTab===activeTab);
    });
  }
  function setTab(tab){activeTab=['shop','collection','merge','trading'].includes(tab)?tab:'shop';render();}
  window.setNeonSkinTab=setTab;
  window.renderNeonSkinsTab=function(force){if(force)load(true).catch(()=>{});render();};

  function renderShop(canShop,canOpenBoxes){
    const boxes=[
      {id:'basic',name:'BASIC BOX',price:500,desc:'A reliable start to your collection.'},
      {id:'premium',name:'PREMIUM BOX',price:2000,desc:'A stronger chance at high-rarity designs.'},
      {id:'legendary',name:'LEGENDARY BOX',price:7500,desc:'A premium crate with a 25% Legendary chance.'}
    ];
    const tickets=Object.fromEntries((state.boxes||[]).map(box=>[box.box_type,Number(box.quantity)||0]));
    let html='<div class="skins-box-grid">';
    boxes.forEach(box=>{
      const count=tickets[box.id]||0;
      html+='<article class="skins-box-card box-'+box.id+'"><div class="skins-box-illustration"><span class="box-cube"></span><span class="box-glow"></span></div>'+
        '<div class="skins-box-copy"><span class="skins-box-kicker">'+box.id.toUpperCase()+' CRATE</span><h4>'+box.name+'</h4><p>'+box.desc+'</p><small>'+ODDS[box.id]+'</small></div>'+
        '<div class="skins-box-buy"><strong>'+(count?'FREE BOX × '+count:'
    });
    html+='</div>';
    const daily=state.daily||{},claimed=claimedToday(daily);
    const today=todayLisbon().split('-').map(Number),previousDate=new Date(Date.UTC(today[0],today[1]-1,today[2]-1));
    const yesterday=previousDate.getUTCFullYear()+'-'+String(previousDate.getUTCMonth()+1).padStart(2,'0')+'-'+String(previousDate.getUTCDate()).padStart(2,'0');
    const nextStreak=daily.last_claim===yesterday?(Number(daily.streak)%7)+1:1;
    const day=claimed?Math.max(1,Number(daily.streak)||1):nextStreak;
    html+='<section class="skins-daily-card"><div class="skins-daily-top"><div><span class="skins-box-kicker">PILOT LOGIN BONUS</span><h4>DAILY REWARDS</h4><p>Return each day to build your streak and collect coins or boxes.</p></div><span class="skins-streak">DAY '+day+' / 7</span></div>'+
      '<div class="skins-daily-track">'+DAILY.map((reward,index)=>'<div class="skins-daily-day '+(Number(daily.streak)>=index+1&&claimed?'is-done':'')+'"><span>DAY '+(index+1)+'</span><strong>'+reward+'</strong></div>').join('')+'</div>'+
      '<button class="btn btn-gold" '+(!canShop||claimed?'disabled':'')+' onclick="claimNeonSkinDaily()">'+(claimed?'CLAIMED TODAY':'CLAIM DAILY REWARD')+'</button></section>';
    return html;
  }
  function renderCollection(canShop){
    let html='<div class="skins-category-tabs">'+CATEGORIES.map(category=>'<button class="btn '+(category.id===activeCategory?'btn-gold':'')+'" onclick="setNeonSkinCategory(\''+category.id+'\')">'+category.label+'</button>').join('')+'</div>';
    const defs=(state.definitions||[]).filter(def=>def.category===activeCategory),inventory=state.inventory||[],equipped=state.equipped||{};
    html+='<div class="skins-collection-grid">';
    defs.forEach(def=>{
      const items=inventory.filter(item=>item.skin_id===def.skin_id),equippedItem=items.find(item=>item.item_id===equipped[activeCategory]);
      const best=items.slice().sort((a,b)=>Number(b.plus_level)-Number(a.plus_level))[0],level=best?Number(best.plus_level)||0:0;
      html+='<article class="skins-collection-card rarity-card-'+def.rarity+(items.length?' is-owned':' is-locked')+'"><div class="skins-card-top"><span class="skin-rarity rarity-'+def.rarity+'">'+rarityPlus(def.rarity,level)+'</span><span class="skins-owned-count">'+(items.length?'OWNED × '+items.length:'UNDISCOVERED')+'</span></div>'+
        (def.is_exclusive?'<span class="skins-exclusive-label">EXCLUSIVE</span>':'')+art(def.category,def.rarity,level,def.skin_id)+'<h4>'+safeText(def.name)+'</h4><p class="skins-card-description">'+safeText(descriptionOf(def))+'</p>'+
        (def.is_exclusive&&!items.length?'<p class="skins-exclusive-note">'+safeText(milestoneNote(def))+'</p>':'')+'<div class="skins-card-bonus">'+bonusText(def,level)+'</div><div class="skins-card-actions"><button class="btn" onclick="previewNeonSkin(\''+def.skin_id+'\')">PREVIEW</button>';
      if(items.length)html+='<button class="btn '+(equippedItem?'btn-equipped':'btn-gold')+'" '+(canShop?'':'disabled')+' onclick="'+(equippedItem?'unequipNeonSkin(\''+activeCategory+'\')':'equipNeonSkin(\''+items[0].item_id+'\',\''+activeCategory+'\')')+'">'+(equippedItem?'EQUIPPED':'EQUIP')+'</button>';
      else html+='<button class="btn" disabled>NOT OWNED</button>';
      html+='</div>';
      if(items.length)html+='<div class="skins-instance-list">'+items.map(item=>'<span class="skins-instance '+(item.item_id===equipped[activeCategory]?'is-equipped':'')+'">'+rarityPlus(def.rarity,item.plus_level)+(item.locked_trade_id?' · IN TRADE':'')+'</span>').join('')+'</div>';
      html+='</article>';
    });
    html+='</div>';return html;
  }
  function setCategory(category){if(CATEGORIES.some(x=>x.id===category)){activeCategory=category;render();}}
  window.setNeonSkinCategory=setCategory;

  function renderMerge(canShop){
    const groups={};
    (state.inventory||[]).forEach(item=>{
      if(Number(item.plus_level)!==0||item.locked_trade_id||Object.values(state.equipped||{}).includes(item.item_id))return;
      const def=definitionOf(item);if(!def)return;
      if(!groups[item.skin_id])groups[item.skin_id]={def:def,items:[]};
      groups[item.skin_id].items.push(item);
    });
    let html='<p class="skins-section-note">Combine identical, unequipped skins to create a stronger version. Both the design and its bonus improve.</p><div class="skins-merge-grid">';
    Object.values(groups).forEach(group=>{
      const needed=({common:5,rare:5,epic:4,legendary:3})[group.def.rarity]||0,chosen=group.items.filter(item=>mergeSelection.has(item.item_id));
      html+='<article class="skins-merge-card"><div class="skins-merge-main">'+art(group.def.category,group.def.rarity,0,group.def.skin_id)+'<div><span class="skin-rarity rarity-'+group.def.rarity+'">'+group.def.rarity.toUpperCase()+'</span><h4>'+safeText(group.def.name)+'</h4><small>'+group.items.length+' AVAILABLE · '+needed+' REQUIRED</small><p>'+bonusPercent(group.def.rarity,0)+'% → '+bonusPercent(group.def.rarity,1)+'% '+bonusLabel(group.def.bonus_stat)+'</p></div></div>'+
        '<div class="skins-merge-items">'+group.items.map(item=>'<label class="skins-merge-item"><input type="checkbox" '+(mergeSelection.has(item.item_id)?'checked':'')+(canShop?'':' disabled')+' onchange="toggleNeonSkinMerge(\''+item.item_id+'\',this.checked)"><span>SELECT SKIN</span></label>').join('')+'</div>'+
        '<div class="skins-merge-footer"><span>'+chosen.length+' / '+needed+' SELECTED</span><button class="btn '+(canShop&&chosen.length===needed?'btn-gold':'')+'" '+(canShop&&chosen.length===needed?'':'disabled')+' onclick="mergeNeonSkins(\''+group.def.skin_id+'\')">MERGE</button><button class="btn" '+(canShop&&group.items.length>=needed?'':'disabled')+' onclick="autoSelectNeonSkinMerge(\''+group.def.skin_id+'\','+needed+')">AUTO SELECT</button></div></article>';
    });
    if(!Object.keys(groups).length)html+='<div class="skins-empty">NO UNMERGED DUPLICATES AVAILABLE YET. OPEN MORE BOXES TO COLLECT MATCHING SKINS.</div>';
    return html+'</div>';
  }
  function toggleMerge(itemId,checked){if(checked)mergeSelection.add(itemId);else mergeSelection.delete(itemId);render();}
  window.toggleNeonSkinMerge=toggleMerge;
  function autoSelectMerge(skinId,needed){
    const items=(state.inventory||[]).filter(item=>item.skin_id===skinId&&Number(item.plus_level)===0&&!item.locked_trade_id&&!Object.values(state.equipped||{}).includes(item.item_id));
    if(items.length<needed)return;items.slice(0,needed).forEach(item=>mergeSelection.add(item.item_id));render();
  }
  window.autoSelectNeonSkinMerge=autoSelectMerge;
  async function mergeSkins(skinId){
    const def=getDefinition(skinId),needed=def?({common:5,rare:5,epic:4,legendary:3})[def.rarity]:0;
    const ids=Array.from(mergeSelection).filter(id=>{const item=getItem(id);return item&&item.skin_id===skinId;});
    if(!needed||ids.length!==needed)return;
    try{await invoke('merge',{item_ids:ids});mergeSelection.clear();await refresh();setMessage('MERGE COMPLETE · '+(def.name||'SKIN').toUpperCase()+'+ UNLOCKED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.mergeNeonSkins=mergeSkins;

  function renderTrading(canTrade){
    if(!canTrade)return'<div class="skins-lock-notice">TRADING IS LOCKED WHILE YOU ARE ACTIVELY PLAYING. IT BECOMES AVAILABLE WHEN THE RUN IS INTERRUPTED OR FINISHED.</div>';
    let html='<section class="skins-trade-search"><span class="skins-box-kicker">DIRECT PILOT EXCHANGE</span><h4>FIND A PLAYER</h4><p>Search by public player name. Only skins can be exchanged; coins and account progress cannot be traded.</p>'+
      '<div class="skins-search-row"><input id="skin-trade-search" type="search" maxlength="24" placeholder="Enter at least 3 characters"><button class="btn btn-gold" onclick="searchNeonSkinPlayers()">SEARCH</button></div><div id="skin-trade-search-results" class="skins-trade-results">'+renderSearchResults()+'</div></section>';
    if(selectedTradeTarget){const target=searchResults.find(x=>x.user_id===selectedTradeTarget);
      html+='<section class="skins-trade-create"><h4>NEW TRADE · '+safeText(target?target.player_name:'SELECTED PILOT')+'</h4><p>Select 1–10 unequipped skins for your opening offer. You can revise your offer before confirming.</p>'+renderTradeInventory('new')+'<button class="btn btn-gold" onclick="createNeonSkinTrade()">SEND TRADE REQUEST</button></section>';
    }
    html+='<section class="skins-trade-list"><div class="skins-trade-list-heading"><h4>YOUR TRADES</h4><span>OFFERS EXPIRE AFTER 48 HOURS</span></div>';
    const trades=state.trades||[];
    if(!trades.length)html+='<div class="skins-empty">NO TRADES YET. SEARCH FOR A PILOT TO START AN EXCHANGE.</div>';
    trades.forEach(trade=>{
      const side=trade.my_side,myConfirmed=side==='initiator'?trade.initiator_confirmed:trade.recipient_confirmed;
      const otherConfirmed=side==='initiator'?trade.recipient_confirmed:trade.initiator_confirmed;
      const own=side==='initiator'?trade.initiator_offer:trade.recipient_offer,theirs=side==='initiator'?trade.recipient_offer:trade.initiator_offer,pending=trade.status==='pending';
      html+='<article class="skins-trade-card"><div class="skins-trade-head"><div><span class="skins-box-kicker">TRADE WITH</span><h5>'+safeText(trade.opponent_name)+'</h5></div><span class="skins-trade-status '+(pending?'is-pending':'')+'">'+safeText(String(trade.status).toUpperCase())+'</span></div>'+
        '<div class="skins-trade-offers"><div><strong>YOUR OFFER</strong>'+renderTradeOffer(own)+'</div><div><strong>THEIR OFFER</strong>'+renderTradeOffer(theirs)+'</div></div>';
      if(pending)html+='<div class="skins-trade-confirmations"><span class="'+(myConfirmed?'confirmed':'')+'">YOU '+(myConfirmed?'CONFIRMED':'NOT CONFIRMED')+'</span><span class="'+(otherConfirmed?'confirmed':'')+'">THEM '+(otherConfirmed?'CONFIRMED':'NOT CONFIRMED')+'</span></div><details class="skins-trade-edit"><summary>EDIT YOUR OFFER</summary>'+renderTradeInventory(trade.trade_id)+'<button class="btn" onclick="saveNeonSkinTradeOffer(\''+trade.trade_id+'\')">UPDATE OFFER</button></details><div class="skins-trade-actions"><button class="btn btn-gold" '+(!own.length||!theirs.length?'disabled':'')+' onclick="confirmNeonSkinTrade(\''+trade.trade_id+'\')">'+(myConfirmed?'CONFIRMED':'CONFIRM TRADE')+'</button><button class="btn" onclick="cancelNeonSkinTrade(\''+trade.trade_id+'\')">CANCEL</button></div>';
      html+='</article>';
    });
    return html+'</section>';
  }
  function renderSearchResults(){
    if(!searchResults.length)return'<span class="skins-muted">Search for a public player name to begin.</span>';
    return searchResults.map(player=>'<div class="skins-player-result"><span>'+safeText(player.player_name)+'</span><button class="btn" onclick="selectNeonSkinTradeTarget(\''+player.user_id+'\')">SELECT</button></div>').join('');
  }
  function renderTradeInventory(key){
    const selected=new Set(tradeSelections[key]||[]),available=(state.inventory||[]).filter(item=>!item.locked_trade_id&&!Object.values(state.equipped||{}).includes(item.item_id));
    if(!available.length)return'<div class="skins-muted">NO AVAILABLE UNEQUIPPED SKINS TO OFFER.</div>';
    return'<div class="skins-trade-inventory">'+available.map(item=>{
      const def=definitionOf(item);
      return'<label class="skins-trade-item"><input type="checkbox" '+(selected.has(item.item_id)?'checked':'')+' onchange="toggleNeonSkinTradeItem(\''+key+'\',\''+item.item_id+'\',this.checked)"><span>'+safeText(def?def.name:item.skin_id)+' <small>'+rarityPlus(def&&def.rarity,item.plus_level)+'</small></span></label>';
    }).join('')+'</div>';
  }
  function renderTradeOffer(items){
    if(!items||!items.length)return'<span class="skins-muted">WAITING FOR OFFER</span>';
    return'<div class="skins-offer-items">'+items.map(item=>'<span class="skins-offer-chip">'+safeText(item.skin&&item.skin.name||item.skin_id)+' <small>'+rarityPlus(item.skin&&item.skin.rarity,item.plus_level)+'</small></span>').join('')+'</div>';
  }
  function toggleTradeItem(key,itemId,checked){
    const selected=new Set(tradeSelections[key]||[]);
    if(checked){if(selected.size>=10){setMessage('A TRADE CAN INCLUDE UP TO 10 SKINS PER PLAYER.');render();return;}selected.add(itemId);}
    else selected.delete(itemId);
    tradeSelections[key]=Array.from(selected);
  }
  window.toggleNeonSkinTradeItem=toggleTradeItem;
  function selectTradeTarget(userId){if(!searchResults.some(x=>x.user_id===userId))return;selectedTradeTarget=userId;tradeSelections.new=[];render();}
  window.selectNeonSkinTradeTarget=selectTradeTarget;
  async function searchPlayers(){
    const input=document.getElementById('skin-trade-search'),query=(input&&input.value||'').trim();
    if(query.length<3){setMessage('ENTER AT LEAST 3 CHARACTERS TO SEARCH.');return;}
    try{const data=await invoke('search_players',{query:query});searchResults=data.players||[];const list=document.getElementById('skin-trade-search-results');if(list)list.innerHTML=renderSearchResults();}
    catch(error){setMessage(errorMessage(error));}
  }
  window.searchNeonSkinPlayers=searchPlayers;
  async function createTrade(){
    const ids=tradeSelections.new||[];
    if(!selectedTradeTarget||ids.length<1||ids.length>10){setMessage('SELECT A PLAYER AND 1–10 SKINS FIRST.');return;}
    try{await invoke('trade_create',{recipient_id:selectedTradeTarget,item_ids:ids});selectedTradeTarget=null;tradeSelections.new=[];await load(true);setMessage('TRADE REQUEST SENT. YOUR OFFERED SKINS ARE NOW LOCKED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.createNeonSkinTrade=createTrade;
  async function saveTradeOffer(tradeId){
    try{await invoke('trade_set_offer',{trade_id:tradeId,item_ids:tradeSelections[tradeId]||[]});delete tradeSelections[tradeId];await load(true);setMessage('OFFER UPDATED. BOTH PLAYERS MUST CONFIRM AGAIN.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.saveNeonSkinTradeOffer=saveTradeOffer;
  async function confirmTrade(tradeId){
    try{await invoke('trade_confirm',{trade_id:tradeId});await load(true);setMessage('TRADE CONFIRMATION SAVED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.confirmNeonSkinTrade=confirmTrade;
  async function cancelTrade(tradeId){
    try{await invoke('trade_cancel',{trade_id:tradeId});await load(true);setMessage('TRADE CANCELLED. OFFERED SKINS HAVE BEEN RETURNED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.cancelNeonSkinTrade=cancelTrade;

  async function openBox(boxType){
    try{const result=await invoke('open_box',{box_type:boxType});await refresh();reveal(result.item);}
    catch(error){setMessage(errorMessage(error));}
  }
  window.openNeonSkinBox=openBox;
  async function claimDaily(){
    try{
      const result=await invoke('daily_claim');await refresh();const reward=result.reward||{};
      setMessage('DAILY REWARD CLAIMED · '+(reward.box_type?reward.box_type.toUpperCase()+' BOX ADDED.':'+'+Number(reward.coins||0).toLocaleString('en-US')+' COINS.'));
    }catch(error){setMessage(errorMessage(error));}
  }
  window.claimNeonSkinDaily=claimDaily;
  async function equip(itemId,category){
    try{await invoke('equip',{item_id:itemId,category:category});await load(true);setMessage('SKIN EQUIPPED · IT WILL APPLY TO YOUR NEXT RUN.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.equipNeonSkin=equip;
  async function unequip(category){
    try{await invoke('equip',{item_id:null,category:category});await load(true);setMessage('SKIN UNEQUIPPED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.unequipNeonSkin=unequip;
  function showModal(contents,extraClass){
    const overlay=document.createElement('div');overlay.className='skins-reveal-overlay '+(extraClass||'');overlay.innerHTML=contents;
    overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
    document.body.appendChild(overlay);
  }
  function preview(skinId){
    const def=getDefinition(skinId);if(!def)return;
    const owned=(state.inventory||[]).filter(item=>item.skin_id===skinId).sort((a,b)=>Number(b.plus_level)-Number(a.plus_level))[0],level=Number(owned&&owned.plus_level)||0;
    showModal('<div class="skins-reveal-card rarity-card-'+def.rarity+'"><button class="skins-reveal-close" onclick="this.closest(\'.skins-reveal-overlay\').remove()" aria-label="Close preview">×</button><span class="skin-rarity rarity-'+def.rarity+'">'+rarityPlus(def.rarity,level)+'</span>'+
      art(def.category,def.rarity,level,def.skin_id)+'<span class="skins-box-kicker">'+categoryLabel(def.category)+'</span><h3>'+safeText(def.name)+'</h3><p>'+safeText(descriptionOf(def))+'</p><strong class="skins-reveal-bonus">'+bonusText(def,level)+'</strong><button class="btn btn-gold" onclick="this.closest(\'.skins-reveal-overlay\').remove()">CLOSE PREVIEW</button></div>','skins-preview-overlay');
  }
  window.previewNeonSkin=preview;
  function reveal(item){
    if(!item)return;const def=getDefinition(item.skin_id)||item;
    showModal('<div class="skins-reveal-card rarity-card-'+def.rarity+' reveal-'+def.rarity+'"><span class="skins-box-kicker">BOX OPENED</span><div class="skins-reveal-rays"></div>'+
      art(def.category,def.rarity,item.plus_level,def.skin_id)+'<span class="skin-rarity rarity-'+def.rarity+'">'+String(def.rarity||'common').toUpperCase()+'</span><h3>'+safeText(def.name)+'</h3>'+
      '<p>'+safeText(descriptionOf(def))+'</p><strong class="skins-reveal-bonus">'+bonusText(def,item.plus_level)+'</strong><button class="btn btn-gold" onclick="this.closest(\'.skins-reveal-overlay\').remove()">ADD TO COLLECTION</button></div>','');
  }
  function errorMessage(error){
    const raw=String(error&&error.message||error||'REQUEST FAILED').toUpperCase(),known={
      RUN_ACTIVE:'THIS ACTION IS LOCKED WHILE A RUN IS ACTIVE.',
      RUN_SAVED:'BOXES, MERGE AND EQUIPPING ARE LOCKED WHILE A RUN IS SAVED. TRADING REMAINS AVAILABLE.',
      NOT_ENOUGH_COINS:'NOT ENOUGH COINS FOR THIS BOX.',
      SKIN_CATALOG_EMPTY:'NO SKINS ARE AVAILABLE FOR THIS RARITY YET.',
      SKIN_IS_EQUIPPED:'UNEQUIP THIS SKIN BEFORE USING IT IN A MERGE OR TRADE.',
      SKIN_NOT_OWNED:'YOU DO NOT OWN THAT SKIN.',
      ITEMS_NOT_AVAILABLE:'ONE OR MORE SELECTED SKINS ARE NO LONGER AVAILABLE.',
      WRONG_MERGE_COUNT:'THE SELECTED SKINS DO NOT MATCH THE REQUIRED MERGE COUNT.',
      ALREADY_CLAIMED:'YOU HAVE ALREADY CLAIMED TODAY’S REWARD.',
      PLAYER_NOT_FOUND:'PLAYER NOT FOUND. CHECK THE PUBLIC PLAYER NAME.',
      TRADE_NOT_AVAILABLE:'THIS TRADE IS NO LONGER AVAILABLE.',
      BOTH_OFFERS_REQUIRED:'BOTH PLAYERS MUST ADD AN OFFER BEFORE CONFIRMING.',
      TRADE_ITEMS_CHANGED:'THE TRADE ITEMS CHANGED. REFRESH AND TRY AGAIN.',
      ACCOUNT_RESTRICTED:'THIS ACCOUNT CANNOT USE THE SKIN VAULT.'
    };
    const key=Object.keys(known).find(code=>raw.includes(code));return known[key]||'SKIN VAULT ERROR · '+raw.replace(/_/g,' ');
  }

  async function prepareRunSnapshot(){
    const c=ctx();if(!c||!c.session)return emptySnapshot();
    if(!c.cloudSaveReady){setMessage('ACCOUNT SAVE IS STILL SYNCING. SKIN BONUSES MAY NOT BE READY FOR THIS RUN.');return emptySnapshot();}
    return buildLoadout(await load(true));
  }
  window.prepareNeonRunSkinSnapshot=prepareRunSnapshot;

  async function setRunState(active, interrupted){
    const c=ctx();if(!c||!c.client||!c.session)return false;
    const runAccountId=c.userId;
    runActive=!!active;if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
    const send=async value=>{
      const current=ctx();if(!current||!current.client||!current.session||current.userId!==runAccountId)return;
      const body={action:'set_run_state',active:!!value};
      if(!value&&interrupted)body.interrupted=true;
      const response=await current.client.functions.invoke('neon-skins',{body:body});
      if(response.error)throw response.error;
    };
    if(active)heartbeatTimer=window.setInterval(()=>{if(runActive)send(true).catch(error=>console.warn('Skin run heartbeat retry failed:',error));},25000);
    try{await send(active);if(!active&&isOpen())load(true).catch(()=>{});return true;}
    catch(error){
      console.warn('Could not update the skin run state:',error);
      if(!active&&interrupted){
        let attempts=0;
        const retry=async()=>{
          if(runActive||attempts>=6)return;
          attempts++;
          try{await send(false);if(isOpen())load(true).catch(()=>{});}catch(retryError){window.setTimeout(retry,1200);}
        };
        window.setTimeout(retry,800);
      }
      return false;
    }
  }
  window.setNeonSkinRunState=setRunState;
  window.addEventListener('pagehide',function(){
    const c=ctx();if(!runActive||!c||!c.session||!c.session.access_token)return;
    try{
      fetch('https://iioagfxyzfxyoifjclgw.supabase.co/functions/v1/neon-skins',{
        method:'POST',keepalive:true,
        headers:{'Content-Type':'application/json','apikey':'sb_publishable_Xop-cOuasc5PmiD3e4ed5A_hWr-mclf','Authorization':'Bearer '+c.session.access_token},
        body:JSON.stringify({action:'set_run_state',active:false,interrupted:true})
      }).catch(()=>{});
    }catch(_){}
  });

  window.addEventListener('neon-skin-account-change',function(){
    state=null;loadedUserId='';lastMessage='';mergeSelection.clear();selectedTradeTarget=null;searchResults=[];tradeSelections={};runActive=false;
    if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
    if(isOpen())render();
  });
  window.addEventListener('neon-skin-cloud-ready',function(){load(true).catch(()=>{});});
  window.addEventListener('focus',function(){if(isOpen()&&ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});});
  window.addEventListener('online',function(){if(runActive)setRunState(true).catch(()=>{});if(ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});});
  window.addEventListener('DOMContentLoaded',function(){if(ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});});
  if(ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});
})();
+box.price.toLocaleString('en-US'))+'</strong><button class="btn '+(canOpenBoxes?'btn-gold':'')+'" '+(canOpenBoxes?'':'disabled')+' onclick="openNeonSkinBox(\''+box.id+'\')">OPEN BOX</button></div></article>';
    });
    html+='</div>';
    const daily=state.daily||{},claimed=claimedToday(daily);
    const today=todayLisbon().split('-').map(Number),previousDate=new Date(Date.UTC(today[0],today[1]-1,today[2]-1));
    const yesterday=previousDate.getUTCFullYear()+'-'+String(previousDate.getUTCMonth()+1).padStart(2,'0')+'-'+String(previousDate.getUTCDate()).padStart(2,'0');
    const nextStreak=daily.last_claim===yesterday?(Number(daily.streak)%7)+1:1;
    const day=claimed?Math.max(1,Number(daily.streak)||1):nextStreak;
    html+='<section class="skins-daily-card"><div class="skins-daily-top"><div><span class="skins-box-kicker">PILOT LOGIN BONUS</span><h4>DAILY REWARDS</h4><p>Return each day to build your streak and collect coins or boxes.</p></div><span class="skins-streak">DAY '+day+' / 7</span></div>'+
      '<div class="skins-daily-track">'+DAILY.map((reward,index)=>'<div class="skins-daily-day '+(Number(daily.streak)>=index+1&&claimed?'is-done':'')+'"><span>DAY '+(index+1)+'</span><strong>'+reward+'</strong></div>').join('')+'</div>'+
      '<button class="btn btn-gold" '+(!canShop||claimed?'disabled':'')+' onclick="claimNeonSkinDaily()">'+(claimed?'CLAIMED TODAY':'CLAIM DAILY REWARD')+'</button></section>';
    return html;
  }
  function renderCollection(canShop){
    let html='<div class="skins-category-tabs">'+CATEGORIES.map(category=>'<button class="btn '+(category.id===activeCategory?'btn-gold':'')+'" onclick="setNeonSkinCategory(\''+category.id+'\')">'+category.label+'</button>').join('')+'</div>';
    const defs=(state.definitions||[]).filter(def=>def.category===activeCategory),inventory=state.inventory||[],equipped=state.equipped||{};
    html+='<div class="skins-collection-grid">';
    defs.forEach(def=>{
      const items=inventory.filter(item=>item.skin_id===def.skin_id),equippedItem=items.find(item=>item.item_id===equipped[activeCategory]);
      const best=items.slice().sort((a,b)=>Number(b.plus_level)-Number(a.plus_level))[0],level=best?Number(best.plus_level)||0:0;
      html+='<article class="skins-collection-card rarity-card-'+def.rarity+(items.length?' is-owned':' is-locked')+'"><div class="skins-card-top"><span class="skin-rarity rarity-'+def.rarity+'">'+rarityPlus(def.rarity,level)+'</span><span class="skins-owned-count">'+(items.length?'OWNED × '+items.length:'UNDISCOVERED')+'</span></div>'+
        (def.is_exclusive?'<span class="skins-exclusive-label">EXCLUSIVE</span>':'')+art(def.category,def.rarity,level,def.skin_id)+'<h4>'+safeText(def.name)+'</h4><p class="skins-card-description">'+safeText(descriptionOf(def))+'</p>'+
        (def.is_exclusive&&!items.length?'<p class="skins-exclusive-note">'+safeText(milestoneNote(def))+'</p>':'')+'<div class="skins-card-bonus">'+bonusText(def,level)+'</div><div class="skins-card-actions"><button class="btn" onclick="previewNeonSkin(\''+def.skin_id+'\')">PREVIEW</button>';
      if(items.length)html+='<button class="btn '+(equippedItem?'btn-equipped':'btn-gold')+'" '+(canShop?'':'disabled')+' onclick="'+(equippedItem?'unequipNeonSkin(\''+activeCategory+'\')':'equipNeonSkin(\''+items[0].item_id+'\',\''+activeCategory+'\')')+'">'+(equippedItem?'EQUIPPED':'EQUIP')+'</button>';
      else html+='<button class="btn" disabled>NOT OWNED</button>';
      html+='</div>';
      if(items.length)html+='<div class="skins-instance-list">'+items.map(item=>'<span class="skins-instance '+(item.item_id===equipped[activeCategory]?'is-equipped':'')+'">'+rarityPlus(def.rarity,item.plus_level)+(item.locked_trade_id?' · IN TRADE':'')+'</span>').join('')+'</div>';
      html+='</article>';
    });
    html+='</div>';return html;
  }
  function setCategory(category){if(CATEGORIES.some(x=>x.id===category)){activeCategory=category;render();}}
  window.setNeonSkinCategory=setCategory;

  function renderMerge(canShop){
    const groups={};
    (state.inventory||[]).forEach(item=>{
      if(Number(item.plus_level)!==0||item.locked_trade_id||Object.values(state.equipped||{}).includes(item.item_id))return;
      const def=definitionOf(item);if(!def)return;
      if(!groups[item.skin_id])groups[item.skin_id]={def:def,items:[]};
      groups[item.skin_id].items.push(item);
    });
    let html='<p class="skins-section-note">Combine identical, unequipped skins to create a stronger version. Both the design and its bonus improve.</p><div class="skins-merge-grid">';
    Object.values(groups).forEach(group=>{
      const needed=({common:5,rare:5,epic:4,legendary:3})[group.def.rarity]||0,chosen=group.items.filter(item=>mergeSelection.has(item.item_id));
      html+='<article class="skins-merge-card"><div class="skins-merge-main">'+art(group.def.category,group.def.rarity,0,group.def.skin_id)+'<div><span class="skin-rarity rarity-'+group.def.rarity+'">'+group.def.rarity.toUpperCase()+'</span><h4>'+safeText(group.def.name)+'</h4><small>'+group.items.length+' AVAILABLE · '+needed+' REQUIRED</small><p>'+bonusPercent(group.def.rarity,0)+'% → '+bonusPercent(group.def.rarity,1)+'% '+bonusLabel(group.def.bonus_stat)+'</p></div></div>'+
        '<div class="skins-merge-items">'+group.items.map(item=>'<label class="skins-merge-item"><input type="checkbox" '+(mergeSelection.has(item.item_id)?'checked':'')+(canShop?'':' disabled')+' onchange="toggleNeonSkinMerge(\''+item.item_id+'\',this.checked)"><span>SELECT SKIN</span></label>').join('')+'</div>'+
        '<div class="skins-merge-footer"><span>'+chosen.length+' / '+needed+' SELECTED</span><button class="btn '+(canShop&&chosen.length===needed?'btn-gold':'')+'" '+(canShop&&chosen.length===needed?'':'disabled')+' onclick="mergeNeonSkins(\''+group.def.skin_id+'\')">MERGE</button><button class="btn" '+(canShop&&group.items.length>=needed?'':'disabled')+' onclick="autoSelectNeonSkinMerge(\''+group.def.skin_id+'\','+needed+')">AUTO SELECT</button></div></article>';
    });
    if(!Object.keys(groups).length)html+='<div class="skins-empty">NO UNMERGED DUPLICATES AVAILABLE YET. OPEN MORE BOXES TO COLLECT MATCHING SKINS.</div>';
    return html+'</div>';
  }
  function toggleMerge(itemId,checked){if(checked)mergeSelection.add(itemId);else mergeSelection.delete(itemId);render();}
  window.toggleNeonSkinMerge=toggleMerge;
  function autoSelectMerge(skinId,needed){
    const items=(state.inventory||[]).filter(item=>item.skin_id===skinId&&Number(item.plus_level)===0&&!item.locked_trade_id&&!Object.values(state.equipped||{}).includes(item.item_id));
    if(items.length<needed)return;items.slice(0,needed).forEach(item=>mergeSelection.add(item.item_id));render();
  }
  window.autoSelectNeonSkinMerge=autoSelectMerge;
  async function mergeSkins(skinId){
    const def=getDefinition(skinId),needed=def?({common:5,rare:5,epic:4,legendary:3})[def.rarity]:0;
    const ids=Array.from(mergeSelection).filter(id=>{const item=getItem(id);return item&&item.skin_id===skinId;});
    if(!needed||ids.length!==needed)return;
    try{await invoke('merge',{item_ids:ids});mergeSelection.clear();await refresh();setMessage('MERGE COMPLETE · '+(def.name||'SKIN').toUpperCase()+'+ UNLOCKED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.mergeNeonSkins=mergeSkins;

  function renderTrading(canTrade){
    if(!canTrade)return'<div class="skins-lock-notice">TRADING IS LOCKED WHILE YOU ARE ACTIVELY PLAYING. IT BECOMES AVAILABLE WHEN THE RUN IS INTERRUPTED OR FINISHED.</div>';
    let html='<section class="skins-trade-search"><span class="skins-box-kicker">DIRECT PILOT EXCHANGE</span><h4>FIND A PLAYER</h4><p>Search by public player name. Only skins can be exchanged; coins and account progress cannot be traded.</p>'+
      '<div class="skins-search-row"><input id="skin-trade-search" type="search" maxlength="24" placeholder="Enter at least 3 characters"><button class="btn btn-gold" onclick="searchNeonSkinPlayers()">SEARCH</button></div><div id="skin-trade-search-results" class="skins-trade-results">'+renderSearchResults()+'</div></section>';
    if(selectedTradeTarget){const target=searchResults.find(x=>x.user_id===selectedTradeTarget);
      html+='<section class="skins-trade-create"><h4>NEW TRADE · '+safeText(target?target.player_name:'SELECTED PILOT')+'</h4><p>Select 1–10 unequipped skins for your opening offer. You can revise your offer before confirming.</p>'+renderTradeInventory('new')+'<button class="btn btn-gold" onclick="createNeonSkinTrade()">SEND TRADE REQUEST</button></section>';
    }
    html+='<section class="skins-trade-list"><div class="skins-trade-list-heading"><h4>YOUR TRADES</h4><span>OFFERS EXPIRE AFTER 48 HOURS</span></div>';
    const trades=state.trades||[];
    if(!trades.length)html+='<div class="skins-empty">NO TRADES YET. SEARCH FOR A PILOT TO START AN EXCHANGE.</div>';
    trades.forEach(trade=>{
      const side=trade.my_side,myConfirmed=side==='initiator'?trade.initiator_confirmed:trade.recipient_confirmed;
      const otherConfirmed=side==='initiator'?trade.recipient_confirmed:trade.initiator_confirmed;
      const own=side==='initiator'?trade.initiator_offer:trade.recipient_offer,theirs=side==='initiator'?trade.recipient_offer:trade.initiator_offer,pending=trade.status==='pending';
      html+='<article class="skins-trade-card"><div class="skins-trade-head"><div><span class="skins-box-kicker">TRADE WITH</span><h5>'+safeText(trade.opponent_name)+'</h5></div><span class="skins-trade-status '+(pending?'is-pending':'')+'">'+safeText(String(trade.status).toUpperCase())+'</span></div>'+
        '<div class="skins-trade-offers"><div><strong>YOUR OFFER</strong>'+renderTradeOffer(own)+'</div><div><strong>THEIR OFFER</strong>'+renderTradeOffer(theirs)+'</div></div>';
      if(pending)html+='<div class="skins-trade-confirmations"><span class="'+(myConfirmed?'confirmed':'')+'">YOU '+(myConfirmed?'CONFIRMED':'NOT CONFIRMED')+'</span><span class="'+(otherConfirmed?'confirmed':'')+'">THEM '+(otherConfirmed?'CONFIRMED':'NOT CONFIRMED')+'</span></div><details class="skins-trade-edit"><summary>EDIT YOUR OFFER</summary>'+renderTradeInventory(trade.trade_id)+'<button class="btn" onclick="saveNeonSkinTradeOffer(\''+trade.trade_id+'\')">UPDATE OFFER</button></details><div class="skins-trade-actions"><button class="btn btn-gold" '+(!own.length||!theirs.length?'disabled':'')+' onclick="confirmNeonSkinTrade(\''+trade.trade_id+'\')">'+(myConfirmed?'CONFIRMED':'CONFIRM TRADE')+'</button><button class="btn" onclick="cancelNeonSkinTrade(\''+trade.trade_id+'\')">CANCEL</button></div>';
      html+='</article>';
    });
    return html+'</section>';
  }
  function renderSearchResults(){
    if(!searchResults.length)return'<span class="skins-muted">Search for a public player name to begin.</span>';
    return searchResults.map(player=>'<div class="skins-player-result"><span>'+safeText(player.player_name)+'</span><button class="btn" onclick="selectNeonSkinTradeTarget(\''+player.user_id+'\')">SELECT</button></div>').join('');
  }
  function renderTradeInventory(key){
    const selected=new Set(tradeSelections[key]||[]),available=(state.inventory||[]).filter(item=>!item.locked_trade_id&&!Object.values(state.equipped||{}).includes(item.item_id));
    if(!available.length)return'<div class="skins-muted">NO AVAILABLE UNEQUIPPED SKINS TO OFFER.</div>';
    return'<div class="skins-trade-inventory">'+available.map(item=>{
      const def=definitionOf(item);
      return'<label class="skins-trade-item"><input type="checkbox" '+(selected.has(item.item_id)?'checked':'')+' onchange="toggleNeonSkinTradeItem(\''+key+'\',\''+item.item_id+'\',this.checked)"><span>'+safeText(def?def.name:item.skin_id)+' <small>'+rarityPlus(def&&def.rarity,item.plus_level)+'</small></span></label>';
    }).join('')+'</div>';
  }
  function renderTradeOffer(items){
    if(!items||!items.length)return'<span class="skins-muted">WAITING FOR OFFER</span>';
    return'<div class="skins-offer-items">'+items.map(item=>'<span class="skins-offer-chip">'+safeText(item.skin&&item.skin.name||item.skin_id)+' <small>'+rarityPlus(item.skin&&item.skin.rarity,item.plus_level)+'</small></span>').join('')+'</div>';
  }
  function toggleTradeItem(key,itemId,checked){
    const selected=new Set(tradeSelections[key]||[]);
    if(checked){if(selected.size>=10){setMessage('A TRADE CAN INCLUDE UP TO 10 SKINS PER PLAYER.');render();return;}selected.add(itemId);}
    else selected.delete(itemId);
    tradeSelections[key]=Array.from(selected);
  }
  window.toggleNeonSkinTradeItem=toggleTradeItem;
  function selectTradeTarget(userId){if(!searchResults.some(x=>x.user_id===userId))return;selectedTradeTarget=userId;tradeSelections.new=[];render();}
  window.selectNeonSkinTradeTarget=selectTradeTarget;
  async function searchPlayers(){
    const input=document.getElementById('skin-trade-search'),query=(input&&input.value||'').trim();
    if(query.length<3){setMessage('ENTER AT LEAST 3 CHARACTERS TO SEARCH.');return;}
    try{const data=await invoke('search_players',{query:query});searchResults=data.players||[];const list=document.getElementById('skin-trade-search-results');if(list)list.innerHTML=renderSearchResults();}
    catch(error){setMessage(errorMessage(error));}
  }
  window.searchNeonSkinPlayers=searchPlayers;
  async function createTrade(){
    const ids=tradeSelections.new||[];
    if(!selectedTradeTarget||ids.length<1||ids.length>10){setMessage('SELECT A PLAYER AND 1–10 SKINS FIRST.');return;}
    try{await invoke('trade_create',{recipient_id:selectedTradeTarget,item_ids:ids});selectedTradeTarget=null;tradeSelections.new=[];await load(true);setMessage('TRADE REQUEST SENT. YOUR OFFERED SKINS ARE NOW LOCKED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.createNeonSkinTrade=createTrade;
  async function saveTradeOffer(tradeId){
    try{await invoke('trade_set_offer',{trade_id:tradeId,item_ids:tradeSelections[tradeId]||[]});delete tradeSelections[tradeId];await load(true);setMessage('OFFER UPDATED. BOTH PLAYERS MUST CONFIRM AGAIN.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.saveNeonSkinTradeOffer=saveTradeOffer;
  async function confirmTrade(tradeId){
    try{await invoke('trade_confirm',{trade_id:tradeId});await load(true);setMessage('TRADE CONFIRMATION SAVED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.confirmNeonSkinTrade=confirmTrade;
  async function cancelTrade(tradeId){
    try{await invoke('trade_cancel',{trade_id:tradeId});await load(true);setMessage('TRADE CANCELLED. OFFERED SKINS HAVE BEEN RETURNED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.cancelNeonSkinTrade=cancelTrade;

  async function openBox(boxType){
    try{const result=await invoke('open_box',{box_type:boxType});await refresh();reveal(result.item);}
    catch(error){setMessage(errorMessage(error));}
  }
  window.openNeonSkinBox=openBox;
  async function claimDaily(){
    try{
      const result=await invoke('daily_claim');await refresh();const reward=result.reward||{};
      setMessage('DAILY REWARD CLAIMED · '+(reward.box_type?reward.box_type.toUpperCase()+' BOX ADDED.':'+'+Number(reward.coins||0).toLocaleString('en-US')+' COINS.'));
    }catch(error){setMessage(errorMessage(error));}
  }
  window.claimNeonSkinDaily=claimDaily;
  async function equip(itemId,category){
    try{await invoke('equip',{item_id:itemId,category:category});await load(true);setMessage('SKIN EQUIPPED · IT WILL APPLY TO YOUR NEXT RUN.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.equipNeonSkin=equip;
  async function unequip(category){
    try{await invoke('equip',{item_id:null,category:category});await load(true);setMessage('SKIN UNEQUIPPED.');}
    catch(error){setMessage(errorMessage(error));}
  }
  window.unequipNeonSkin=unequip;
  function showModal(contents,extraClass){
    const overlay=document.createElement('div');overlay.className='skins-reveal-overlay '+(extraClass||'');overlay.innerHTML=contents;
    overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
    document.body.appendChild(overlay);
  }
  function preview(skinId){
    const def=getDefinition(skinId);if(!def)return;
    const owned=(state.inventory||[]).filter(item=>item.skin_id===skinId).sort((a,b)=>Number(b.plus_level)-Number(a.plus_level))[0],level=Number(owned&&owned.plus_level)||0;
    showModal('<div class="skins-reveal-card rarity-card-'+def.rarity+'"><button class="skins-reveal-close" onclick="this.closest(\'.skins-reveal-overlay\').remove()" aria-label="Close preview">×</button><span class="skin-rarity rarity-'+def.rarity+'">'+rarityPlus(def.rarity,level)+'</span>'+
      art(def.category,def.rarity,level,def.skin_id)+'<span class="skins-box-kicker">'+categoryLabel(def.category)+'</span><h3>'+safeText(def.name)+'</h3><p>'+safeText(descriptionOf(def))+'</p><strong class="skins-reveal-bonus">'+bonusText(def,level)+'</strong><button class="btn btn-gold" onclick="this.closest(\'.skins-reveal-overlay\').remove()">CLOSE PREVIEW</button></div>','skins-preview-overlay');
  }
  window.previewNeonSkin=preview;
  function reveal(item){
    if(!item)return;const def=getDefinition(item.skin_id)||item;
    showModal('<div class="skins-reveal-card rarity-card-'+def.rarity+' reveal-'+def.rarity+'"><span class="skins-box-kicker">BOX OPENED</span><div class="skins-reveal-rays"></div>'+
      art(def.category,def.rarity,item.plus_level,def.skin_id)+'<span class="skin-rarity rarity-'+def.rarity+'">'+String(def.rarity||'common').toUpperCase()+'</span><h3>'+safeText(def.name)+'</h3>'+
      '<p>'+safeText(descriptionOf(def))+'</p><strong class="skins-reveal-bonus">'+bonusText(def,item.plus_level)+'</strong><button class="btn btn-gold" onclick="this.closest(\'.skins-reveal-overlay\').remove()">ADD TO COLLECTION</button></div>','');
  }
  function errorMessage(error){
    const raw=String(error&&error.message||error||'REQUEST FAILED').toUpperCase(),known={
      RUN_ACTIVE:'THIS ACTION IS LOCKED WHILE A RUN IS ACTIVE.',
      RUN_SAVED:'BOXES, MERGE AND EQUIPPING ARE LOCKED WHILE A RUN IS SAVED. TRADING REMAINS AVAILABLE.',
      NOT_ENOUGH_COINS:'NOT ENOUGH COINS FOR THIS BOX.',
      SKIN_CATALOG_EMPTY:'NO SKINS ARE AVAILABLE FOR THIS RARITY YET.',
      SKIN_IS_EQUIPPED:'UNEQUIP THIS SKIN BEFORE USING IT IN A MERGE OR TRADE.',
      SKIN_NOT_OWNED:'YOU DO NOT OWN THAT SKIN.',
      ITEMS_NOT_AVAILABLE:'ONE OR MORE SELECTED SKINS ARE NO LONGER AVAILABLE.',
      WRONG_MERGE_COUNT:'THE SELECTED SKINS DO NOT MATCH THE REQUIRED MERGE COUNT.',
      ALREADY_CLAIMED:'YOU HAVE ALREADY CLAIMED TODAY’S REWARD.',
      PLAYER_NOT_FOUND:'PLAYER NOT FOUND. CHECK THE PUBLIC PLAYER NAME.',
      TRADE_NOT_AVAILABLE:'THIS TRADE IS NO LONGER AVAILABLE.',
      BOTH_OFFERS_REQUIRED:'BOTH PLAYERS MUST ADD AN OFFER BEFORE CONFIRMING.',
      TRADE_ITEMS_CHANGED:'THE TRADE ITEMS CHANGED. REFRESH AND TRY AGAIN.',
      ACCOUNT_RESTRICTED:'THIS ACCOUNT CANNOT USE THE SKIN VAULT.'
    };
    const key=Object.keys(known).find(code=>raw.includes(code));return known[key]||'SKIN VAULT ERROR · '+raw.replace(/_/g,' ');
  }

  async function prepareRunSnapshot(){
    const c=ctx();if(!c||!c.session)return emptySnapshot();
    if(!c.cloudSaveReady){setMessage('ACCOUNT SAVE IS STILL SYNCING. SKIN BONUSES MAY NOT BE READY FOR THIS RUN.');return emptySnapshot();}
    return buildLoadout(await load(true));
  }
  window.prepareNeonRunSkinSnapshot=prepareRunSnapshot;

  async function setRunState(active, interrupted){
    const c=ctx();if(!c||!c.client||!c.session)return false;
    const runAccountId=c.userId;
    runActive=!!active;if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
    const send=async value=>{
      const current=ctx();if(!current||!current.client||!current.session||current.userId!==runAccountId)return;
      const body={action:'set_run_state',active:!!value};
      if(!value&&interrupted)body.interrupted=true;
      const response=await current.client.functions.invoke('neon-skins',{body:body});
      if(response.error)throw response.error;
    };
    if(active)heartbeatTimer=window.setInterval(()=>{if(runActive)send(true).catch(error=>console.warn('Skin run heartbeat retry failed:',error));},25000);
    try{await send(active);if(!active&&isOpen())load(true).catch(()=>{});return true;}
    catch(error){
      console.warn('Could not update the skin run state:',error);
      if(!active&&interrupted){
        let attempts=0;
        const retry=async()=>{
          if(runActive||attempts>=6)return;
          attempts++;
          try{await send(false);if(isOpen())load(true).catch(()=>{});}catch(retryError){window.setTimeout(retry,1200);}
        };
        window.setTimeout(retry,800);
      }
      return false;
    }
  }
  window.setNeonSkinRunState=setRunState;
  window.addEventListener('pagehide',function(){
    const c=ctx();if(!runActive||!c||!c.session||!c.session.access_token)return;
    try{
      fetch('https://iioagfxyzfxyoifjclgw.supabase.co/functions/v1/neon-skins',{
        method:'POST',keepalive:true,
        headers:{'Content-Type':'application/json','apikey':'sb_publishable_Xop-cOuasc5PmiD3e4ed5A_hWr-mclf','Authorization':'Bearer '+c.session.access_token},
        body:JSON.stringify({action:'set_run_state',active:false,interrupted:true})
      }).catch(()=>{});
    }catch(_){}
  });

  window.addEventListener('neon-skin-account-change',function(){
    state=null;loadedUserId='';lastMessage='';mergeSelection.clear();selectedTradeTarget=null;searchResults=[];tradeSelections={};runActive=false;
    if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
    if(isOpen())render();
  });
  window.addEventListener('neon-skin-cloud-ready',function(){load(true).catch(()=>{});});
  window.addEventListener('focus',function(){if(isOpen()&&ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});});
  window.addEventListener('online',function(){if(runActive)setRunState(true).catch(()=>{});if(ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});});
  window.addEventListener('DOMContentLoaded',function(){if(ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});});
  if(ctx()&&ctx().cloudSaveReady)load(true).catch(()=>{});
})();
