/**
 * OTTHI World V701 — módulo-fonte
 * Arquivo: 39-gm-admin-panel.js
 * Escopo: acesso oculto, painel GM seguro e aplicação idempotente de concessões positivas
 *
 * Este arquivo é compilado em app.js por tools/build_project.py.
 * Não deve ser carregado diretamente por index.html.
 */
// @otthi-module-body
  const GM_ITEM_CATALOG=Object.freeze({
    wood:{label:'Madeira',icon:'🪵'},stone:{label:'Pedra',icon:'🪨'},goldOre:{label:'Minério de ouro',icon:'🟨'},goldBar:{label:'Barra de ouro',icon:'🏅'},food:{label:'Comida',icon:'🍎'},water:{label:'Água',icon:'💧'},crystals:{label:'Cristais',icon:'💎'},blocks:{label:'Blocos',icon:'🧱'},fences:{label:'Cercas',icon:'🪵'},keys:{label:'Chaves',icon:'🗝️'},fishingRod:{label:'Vara de pesca',icon:'🎣'},bait:{label:'Iscas',icon:'🪱'},rawFish:{label:'Peixe cru',icon:'🐟'},cookedFish:{label:'Peixe assado',icon:'🍽️'},forestResources:{label:'Recursos da floresta',icon:'🌿'},package:{label:'Pacotes',icon:'📦'},seeds:{label:'Sementes',icon:'🌱'},wheat:{label:'Trigo',icon:'🌾'},carrots:{label:'Cenouras',icon:'🥕'},clay:{label:'Argila',icon:'🟫'}
  });
  const GM_MAX_ADD=1000000,GM_TAP_WINDOW_MS=2600,GM_APPLIED_HISTORY_LIMIT=500;
  let gmTapTimes=[],gmTapLockedUntil=0,gmFailedAttempts=0,gmAttemptBlockedUntil=0,gmPanel=null,gmUsers=[],gmAudit=[],gmSelectedUid='',gmSelectedDetail=null,gmGrantQueue=Promise.resolve(),gmRefreshSequence=0;
  const gmAccessCode=()=>String.fromCharCode(42,49,55,55);
  const gmEscape=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const gmPositiveInt=(value,max=GM_MAX_ADD)=>{const number=Math.floor(Number(value)||0);return number>0?Math.min(number,max):0;};
  const gmItemKey=value=>String(value||'').trim().replace(/[^A-Za-z0-9_-]/g,'').slice(0,48);
  function ensureGMState(){
    if(!state.gm||typeof state.gm!=='object')state.gm={};
    if(!Array.isArray(state.gm.appliedGrantIds))state.gm.appliedGrantIds=[];
    state.gm.appliedGrantIds=[...new Set(state.gm.appliedGrantIds.map(String).filter(Boolean))].slice(-GM_APPLIED_HISTORY_LIMIT);
    state.gm.lastGrantAt=Math.max(0,Number(state.gm.lastGrantAt||0));
    return state.gm;
  }
  function gmDeviceId(){
    const key='otthi_gm_device_v1';let value=safeLocalGet(key);
    if(!value){value=`device-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`}`;safeLocalSet(key,value);}
    return String(value).slice(0,96);
  }
  function gmGrantSummary(grant={}){
    const catalog=gmCatalog(),parts=[];if(gmPositiveInt(grant.coins))parts.push(`🪙 +${gmPositiveInt(grant.coins)}`);
    for(const[key,value]of Object.entries(grant.items||{})){const amount=gmPositiveInt(value);if(!amount)continue;const meta=catalog[key]||{icon:'🎁',label:key};parts.push(`${meta.icon} ${meta.label} +${amount}`);}
    return parts.join(' • ');
  }
  function gmNormalizeIncomingGrant(detail={}){
    const grantId=String(detail.grantId||detail.id||'').slice(0,128),targetUid=String(detail.targetUid||'').slice(0,128),coins=gmPositiveInt(detail.coins),items={};
    for(const[key,value]of Object.entries(detail.items||{})){const cleanKey=gmItemKey(key),amount=gmPositiveInt(value);if(cleanKey&&amount)items[cleanKey]=amount;}
    if(!grantId||!targetUid||(!coins&&!Object.keys(items).length))return null;
    return{...detail,grantId,targetUid,coins,items};
  }
  function gmWaitForStableAccountState(){
    if(!window.__OTTHI_ACCOUNT_RECOVERING)return Promise.resolve(true);
    return new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('otthi:account-state-ready',finish);resolve(true);};const timer=setTimeout(finish,120000);window.addEventListener('otthi:account-state-ready',finish,{once:true});});
  }
  async function applyGMGrant(detail={}){
    const grant=gmNormalizeIncomingGrant(detail);if(!grant)return false;
    await gmWaitForStableAccountState();
    await dbReady.catch(()=>state);
    const backend=window.OTTHOS_RTDB,current=backend?.accountStatus?.()||{},ownUid=String(current.uid||backend?.uid||'');
    if(!ownUid||grant.targetUid!==ownUid)return false;
    const gmState=ensureGMState(),deviceId=gmDeviceId();
    const claim=await backend?.claimGMGrant?.(grant.grantId,deviceId);
    if(!claim?.ok){if(claim?.applied)return true;return false;}
    const alreadyAppliedLocally=gmState.appliedGrantIds.includes(grant.grantId);
    let added=0;
    if(!alreadyAppliedLocally){
      if(grant.coins){state.profile.coins=Math.max(0,Number(state.profile.coins||0))+grant.coins;added+=grant.coins;}
      state.inventory=state.inventory&&typeof state.inventory==='object'?state.inventory:{};
      const catalog=gmCatalog();for(const[key,amount]of Object.entries(grant.items))added+=gmApplyItem(key,amount,catalog);
      gmState.appliedGrantIds.push(grant.grantId);gmState.appliedGrantIds=[...new Set(gmState.appliedGrantIds)].slice(-GM_APPLIED_HISTORY_LIMIT);gmState.lastGrantAt=Date.now();
    }
    const localSaved=await commitState().catch(()=>false);
    const progressSaved=await backend?.syncProgress?.(cloudProgressPayload(),true).catch(()=>false);
    const accountSaved=accountLinked()?await syncGameAccount(true).catch(()=>false):true;
    const persisted=localSaved!==false&&progressSaved!==false&&accountSaved!==false;
    const completed=persisted?await backend?.completeGMGrant?.(grant.grantId,deviceId).catch(()=>false):false;
    updateHUD();updateLobbyStats();if(typeof evaluateMissions==='function')evaluateMissions();
    const summary=gmGrantSummary(grant);
    if(persisted&&completed)toast(`${alreadyAppliedLocally?'Concessão do GM sincronizada':'Presente do GM recebido'}: ${summary}`,'good',4200);
    else toast('A recompensa do GM foi preservada neste aparelho, mas a confirmação online será repetida automaticamente.','warn',4800);
    window.dispatchEvent(new CustomEvent('otthi:gm-grant-applied',{detail:{grantId:grant.grantId,summary,added,alreadyAppliedLocally,localSaved:localSaved!==false,progressSaved:progressSaved!==false,accountSaved:accountSaved!==false,receiptSaved:completed!==false}}));
    return persisted&&completed;
  }
  function queueGMGrant(detail={}){gmGrantQueue=gmGrantQueue.catch(()=>false).then(()=>applyGMGrant(detail)).catch(error=>{console.warn('[OTTHI GM] Falha ao aplicar concessão:',error);return false;});return gmGrantQueue;}
  window.addEventListener('otthi:gm-grant',event=>queueGMGrant(event.detail||{}));

  function gmStatus(message='',kind=''){
    const node=gmPanel?.querySelector('[data-gm-status]');if(!node)return;node.textContent=message;node.dataset.kind=kind||'';node.hidden=!message;
  }
  function gmSetBusy(busy){gmPanel?.classList.toggle('is-busy',!!busy);gmPanel?.querySelectorAll('button,input').forEach(node=>{if(node.matches('[data-gm-close]'))return;node.disabled=!!busy;});}
  function gmUserName(userRecord={}){return String(userRecord.name||userRecord.profile?.name||userRecord.username||'Jogador').slice(0,40);}
  function gmCatalog(){
    const entries=Object.create(null);
    const put=(key,label,icon,group,unique=false)=>{if(gmItemKey(key)===key&&!['__proto__','constructor','prototype'].includes(key))entries[key]={label,icon,group,max:unique?1:GM_MAX_ADD};};
    for(const [key,meta]of Object.entries(GM_ITEM_CATALOG))put(key,meta.label,meta.icon,'Inventário',key==='fishingRod');
    for(const item of worldShopItems()){
      if(item.tool)put('tool-'+item.tool,item.name,item.icon,'Ferramentas pessoais',true);
      else put(item.key,item.name,item.icon,item.group,!!item.unique);
    }
    for(const [key,value]of Object.entries(state.inventory||{}))if(typeof value==='number'&&!entries[key]&&!/^(tool|construction|wardrobe|furniture|vehicle)-/.test(key))put(key,key,'🎁','Outros itens existentes');
    for(const group of Object.values(RIO_CONSTRUCTION_CATALOG))for(const item of group)put('construction-'+item.id,item.label,'🧱','Estoque geral de construção');
    for(const choices of Object.values(RIO_WARDROBE_CATALOG))for(const item of choices)if(RIO_WARDROBE_STORE[item[0]])put('wardrobe-'+item[0],item[1],'👕','Roupas e acessórios',true);
    for(const item of rioFurnitureCatalog({w:10,d:8}))put('furniture-'+item.id,item.name,'🛋️','Móveis para a casa principal',true);
    for(const item of OTTHI_PLAYER_VEHICLE_CATALOG)put('vehicle-'+item.id,item.label,item.icon||'🚗','Modelos para a garagem',true);
    return entries;
  }
  function gmItemMeta(key){return gmCatalog()[key]||{label:key.replace(/([a-z])([A-Z])/g,'$1 $2'),icon:'🎁',group:'Outros itens existentes',max:GM_MAX_ADD};}
  function gmInventoryKeys(inventory={},catalog=gmCatalog()){
    return [...new Set([...Object.keys(catalog),...Object.keys(inventory||{}).filter(key=>typeof inventory[key]==='number'&&gmItemKey(key)===key&&!['__proto__','constructor','prototype'].includes(key)&&!/^(tool|construction|wardrobe|furniture|vehicle)-/.test(key))])].sort((a,b)=>(catalog[a]?.group||'Outros').localeCompare(catalog[b]?.group||'Outros','pt-BR')||(catalog[a]?.label||a).localeCompare(catalog[b]?.label||b,'pt-BR'));
  }
  function gmCurrentItem(progress,key){
    const rio=progress.cityServices?.rioMap||{};
    if(key.startsWith('tool-'))return Number((progress.tools?.owned||[]).includes(key.slice(5)));
    if(key.startsWith('construction-'))return Number(rio.constructionInventory?.[key.slice(13)]||0);
    if(key.startsWith('wardrobe-'))return Number(!!rio.wardrobePurchases?.[key.slice(9)]);
    if(key.startsWith('furniture-'))return Number((rio.properties?.home?.furniture||[]).includes(key.slice(10)));
    if(key.startsWith('vehicle-'))return Number((progress.vehicles?.owned||[]).some(id=>(progress.vehicles?.instances?.[id]?.catalogId||id)===key.slice(8)));
    return Number(progress.inventory?.[key]||0);
  }
  function gmApplyItem(key,amount,catalog){
    const meta=catalog[key],qty=gmPositiveInt(amount,meta?.max||GM_MAX_ADD);
    if(!qty||['__proto__','constructor','prototype'].includes(key))return 0;
    if(key.startsWith('tool-')&&meta){
      state.tools.owned=[...new Set([...(state.tools.owned||[]),key.slice(5)])];return qty;
    }
    if(key.startsWith('construction-')&&meta){
      const save=rioConstructionSave(),id=key.slice(13);
      save.constructionInventory[id]=Number(save.constructionInventory[id]||0)+qty;
      save.constructionLegacyStock[id]=Number(save.constructionLegacyStock[id]||0)+qty;return qty;
    }
    if(key.startsWith('wardrobe-')&&meta){(rioMapSave().wardrobePurchases??={})[key.slice(9)]=true;return qty;}
    if(key.startsWith('furniture-')&&meta){
      const title=rioPropertyTitle('home'),id=key.slice(10);title.furniture=[...new Set([...(title.furniture||[]),id])];(title.decorLayout??={})[id]??={stored:true};return qty;
    }
    if(key.startsWith('vehicle-')&&meta){
      const id=key.slice(8),garage=ensurePlayerGarageState();
      if(!(state.vehicles.owned||[]).some(owned=>(state.vehicles.instances?.[owned]?.catalogId||owned)===id)){
        state.vehicles.owned.push(id);garage.stored[id]=true;garage.purchasedAt[id]=Date.now();
      }
      return qty;
    }
    // Preserve compatibility with historical custom numeric inventory rewards.
    if(/^(tool|construction|wardrobe|furniture|vehicle)-/.test(key))return 0;
    state.inventory[key]=Math.max(0,Number(state.inventory[key]||0))+qty;return qty;
  }
  // A player using the immediately preceding client can receive an audited
  // typed reward as a numeric inventory key. Upgrade those known keys once
  // in their own account, using the native save paths, without a second grant.
  function gmRecoverLegacyTypedItems(catalog=gmCatalog()){
    let count=0;for(const [key,value]of Object.entries(state.inventory||{})){
      if(!catalog[key]||!/^(tool|construction|wardrobe|furniture|vehicle)-/.test(key)||gmPositiveInt(value)===0)continue;
      if(gmApplyItem(key,value,catalog)>0){state.inventory[key]=0;count++;}
    }
    return count;
  }
  function gmScheduleLegacyRecovery(){
    gmGrantQueue=gmGrantQueue.catch(()=>false).then(async()=>{
      await dbReady.catch(()=>state);if(window.__OTTHI_ACCOUNT_RECOVERING)return false;
      if(!Object.keys(state.inventory||{}).some(k=>/^(tool|construction|wardrobe|furniture|vehicle)-/.test(k)&&Number(state.inventory[k])>0))return false;
      if(!gmRecoverLegacyTypedItems())return false;
      await commitState();await syncCloudProgress(true);if(accountLinked())await syncGameAccount(true);updateHUD();updateLobbyStats();return true;
    }).catch(error=>{console.warn('[OTTHI GM] Recuperação de itens pendentes:',error);return false;});
  }
  function gmFillItems(form,mode){
    const amount=gmPositiveInt(form.querySelector('[data-gm-bulk-amount]')?.value);
    const selected=[...form.querySelectorAll('[data-gm-item]')].filter(input=>form.querySelector('[data-gm-pick="'+input.dataset.gmItem+'"]')?.checked);
    for(const input of selected)input.value=mode==='max'?Number(input.max):mode==='clear'?0:Math.min(Number(input.max),amount);
    if(form.querySelector('[data-gm-pick-coins]')?.checked)form.querySelector('[data-gm-coins]').value=mode==='max'?GM_MAX_ADD:mode==='clear'?0:amount;
  }
  function gmFormatDate(value){const number=Number(value||0);return number?new Date(number).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Aguardando';}
  function gmRenderUserList(){
    if(!gmPanel)return;const query=String(gmPanel.querySelector('[data-gm-search]')?.value||'').trim().toLocaleLowerCase('pt-BR'),list=gmPanel.querySelector('[data-gm-users]');
    const filtered=gmUsers.filter(userRecord=>`${gmUserName(userRecord)} ${userRecord.username||''} ${userRecord.uid}`.toLocaleLowerCase('pt-BR').includes(query));
    list.innerHTML=filtered.length?filtered.map(userRecord=>{const blocked=userRecord.moderation?.state==='blocked';return`<button class="gm-user-row ${userRecord.uid===gmSelectedUid?'active':''} ${blocked?'blocked':''}" type="button" data-gm-user="${gmEscape(userRecord.uid)}"><span class="gm-online-dot ${userRecord.online?'online':''}" aria-label="${userRecord.online?'Online':'Offline'}"></span><span><b>${gmEscape(gmUserName(userRecord))}${blocked?' <mark class="gm-blocked-badge">BLOQUEADO</mark>':''}</b><small>${userRecord.username?`@${gmEscape(userRecord.username)}`:'Conta sem usuário'} • nível ${Number(userRecord.level||1)}</small><em>${gmEscape(userRecord.uid.slice(0,10))}…</em></span><strong>🪙 ${Number(userRecord.coins||0)}</strong></button>`;}).join(''):'<p class="gm-empty">Nenhum jogador encontrado.</p>';
    list.querySelectorAll('[data-gm-user]').forEach(button=>button.addEventListener('click',()=>gmSelectUser(button.dataset.gmUser)));
    const count=gmPanel.querySelector('[data-gm-user-count]');if(count)count.textContent=`${filtered.length} de ${gmUsers.length}`;
  }
  function gmGrantHistoryMarkup(detail){
    const grants=Object.entries(detail?.grants||{}).map(([id,value])=>({id,...(value||{})})).sort((a,b)=>Number(b.createdAtClient||0)-Number(a.createdAtClient||0));const receipts=detail?.receipts||{};
    if(!grants.length)return'<p class="gm-empty">Nenhuma concessão enviada para este jogador.</p>';
    return grants.slice(0,30).map(grant=>{const receipt=receipts[grant.id]||{},status=receipt.state==='applied'?'Aplicado':receipt.state==='processing'?'Processando':'Pendente';return`<article class="gm-history-row"><div><b>${gmEscape(gmGrantSummary(grant)||'Concessão')}</b><small>${gmEscape(grant.reason||'Sem observação')} • ${gmFormatDate(grant.createdAtClient)}</small></div><span data-status="${gmEscape(receipt.state||'pending')}">${status}</span></article>`;}).join('');
  }
  function gmRenderSelected(){
    if(!gmPanel)return;const root=gmPanel.querySelector('[data-gm-detail]'),userRecord=gmUsers.find(item=>item.uid===gmSelectedUid),detail=gmSelectedDetail;
    if(!userRecord){root.innerHTML='<div class="gm-placeholder"><span>🎮</span><b>Escolha um jogador</b><p>Selecione um usuário para consultar o progresso e adicionar recompensas.</p></div>';return;}
    const progress=detail?.user?.progress||userRecord.progress||{},profile={...(progress.profile||{}),...(detail?.user?.profile||userRecord.profile||{})},inventory=progress.inventory||userRecord.inventory||{},catalog=gmCatalog(),keys=gmInventoryKeys(inventory,catalog),moderation=detail?.moderation||userRecord.moderation||null,isBlocked=moderation?.state==='blocked';
    root.innerHTML=`<section class="gm-player-header"><div><small>JOGADOR SELECIONADO</small><h3>${gmEscape(gmUserName({...userRecord,...profile}))}</h3><p>${userRecord.username?`@${gmEscape(userRecord.username)} • `:''}<code>${gmEscape(userRecord.uid)}</code></p></div><span class="gm-player-status ${userRecord.online?'online':''}">${userRecord.online?`● Online em ${gmEscape(userRecord.room||'um bairro')}`:'○ Offline'}</span></section><div class="gm-metrics"><div><small>Nível</small><b>${Number(profile.level||1)}</b></div><div><small>XP</small><b>${Number(profile.xp||0)}</b></div><div><small>Moedas atuais</small><b>${Number(profile.coins||0)}</b></div><div><small>Reputação</small><b>${Number(profile.reputation||0)}</b></div></div><section class="gm-moderation-card ${isBlocked?'is-blocked':''}"><header><div><h3>Administração do usuário</h3><p>${isBlocked?`Conta bloqueada${moderation?.reason?` • ${gmEscape(moderation.reason)}`:''}`:'Bloqueie o acesso ou exclua os dados deste usuário quando necessário.'}</p></div><span>${isBlocked?'🔒 Bloqueado':'🛡️ Ativo'}</span></header><label class="gm-reason"><span>Motivo administrativo</span><input maxlength="160" value="${gmEscape(moderation?.reason||'Ação administrativa do GM')}" data-gm-moderation-reason></label><div class="gm-moderation-actions">${isBlocked?'<button class="btn good" type="button" data-gm-unblock>🔓 Desbloquear usuário</button>':'<button class="btn warning" type="button" data-gm-block>🔒 Bloquear usuário</button>'}<button class="btn danger" type="button" data-gm-delete-user>🗑️ Excluir usuário e dados</button></div><small>Excluir remove o cadastro e progresso do Realtime Database e mantém um bloqueio administrativo mínimo para impedir recriação pela mesma conta. O registro do Firebase Authentication só pode ser apagado por backend com Admin SDK.</small></section><form class="gm-grant-form" data-gm-grant-form><header><div><h3>Adicionar recompensas</h3><p>Os valores abaixo são somados. O painel nunca diminui nem substitui o saldo atual.</p></div><span class="gm-positive-only">Somente +</span></header><section class="gm-bulk"><b>Recompensas em massa</b><label><span>Pesquisar no catálogo por nome, código ou grupo</span><input type="search" data-gm-item-search placeholder="Ex.: madeira, paint, veículo"></label><label><input type="checkbox" data-gm-all-items> Selecionar todos os itens e moedas</label><label><span>Quantidade para os selecionados</span><input type="number" data-gm-bulk-amount min="0" max="${GM_MAX_ADD}" value="1000"></label><div class="gm-form-actions"><button type="button" class="btn" data-gm-fill>Aplicar quantidade</button><button type="button" class="btn good" data-gm-max>Máximo permitido</button><button type="button" class="btn" data-gm-clear>Zerar selecionados</button><button type="button" class="btn" data-gm-copy>Copiar códigos</button></div><label><input type="checkbox" data-gm-all-users> Enviar a TODOS os usuários ativos (${gmUsers.filter(u=>!u.blocked&&u.moderation?.state!=='blocked').length}) em vez de apenas ao jogador selecionado</label><small>Máximo: 1.000.000 por item de quantidade; roupas, ferramentas pessoais, móveis e modelos de veículos são desbloqueios únicos. Enviar exige confirmação.</small></section><label class="gm-coin-field"><span><input type="checkbox" data-gm-pick-coins> 🪙 Adicionar moedas</span><input type="number" min="0" max="${GM_MAX_ADD}" step="1" inputmode="numeric" value="0" data-gm-coins></label><div class="gm-item-grid">${keys.map(key=>{const meta=catalog[key]||gmItemMeta(key);return`<div class="gm-item-field"><span><label><input type="checkbox" data-gm-pick="${gmEscape(key)}"> <i>${meta.icon}</i><b>${gmEscape(meta.label)}</b></label><small>${gmEscape(meta.group)} · Atual: ${gmCurrentItem({...progress,inventory},key)}</small><code>${gmEscape(key)}</code></span><input type="number" min="0" max="${meta.max}" step="1" inputmode="numeric" value="0" data-gm-item="${gmEscape(key)}" aria-label="Adicionar ${gmEscape(meta.label)}"></div>`;}).join('')}</div><details class="gm-custom-item"><summary>Adicionar outro item existente no jogo</summary><div><label><span>Chave técnica do item</span><input maxlength="48" placeholder="Ex.: ticket" data-gm-custom-key></label><label><span>Quantidade</span><input type="number" min="0" max="${GM_MAX_ADD}" step="1" inputmode="numeric" value="0" data-gm-custom-amount></label></div><small>Use o código exibido no catálogo. O painel recusa códigos que não reconhece.</small></details><label class="gm-reason"><span>Motivo ou observação</span><input maxlength="160" value="Recompensa do GM" data-gm-reason></label><div class="gm-form-actions"><button class="btn primary" type="submit">Adicionar ao jogador</button><button class="btn" type="button" data-gm-refresh-user>Atualizar dados</button></div></form><section class="gm-history"><header><h3>Histórico deste jogador</h3><small>Entrega imediata quando online; na próxima entrada quando offline.</small></header>${gmGrantHistoryMarkup(detail)}</section>`;
    const form=root.querySelector('[data-gm-grant-form]');
    form.querySelector('[data-gm-item-search]').oninput=e=>{const q=e.target.value.trim().toLocaleLowerCase('pt-BR');for(const row of form.querySelectorAll('.gm-item-field'))row.hidden=!!q&&!row.textContent.toLocaleLowerCase('pt-BR').includes(q);};
    form.querySelector('[data-gm-all-items]').onchange=e=>form.querySelectorAll('[data-gm-pick],[data-gm-pick-coins]').forEach(input=>input.checked=e.target.checked);
    for(const mode of ['fill','max','clear'])form.querySelector('[data-gm-'+mode+']').onclick=()=>gmFillItems(form,mode);
    form.querySelector('[data-gm-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(keys.map(key=>key+' — '+(catalog[key]?.label||key)).join('\n'));gmStatus('Códigos copiados.','success');}catch{gmStatus('Não foi possível copiar. Os códigos continuam visíveis no catálogo.','error');}};
    root.querySelector('[data-gm-grant-form]')?.addEventListener('submit',event=>gmSubmitGrant(event,userRecord));root.querySelector('[data-gm-refresh-user]')?.addEventListener('click',()=>gmSelectUser(userRecord.uid,true));
    root.querySelector('[data-gm-block]')?.addEventListener('click',()=>gmModerateSelected(userRecord,true));root.querySelector('[data-gm-unblock]')?.addEventListener('click',()=>gmModerateSelected(userRecord,false));root.querySelector('[data-gm-delete-user]')?.addEventListener('click',()=>gmDeleteSelectedUser(userRecord));
  }
  function gmModerationReason(){return String(gmPanel?.querySelector('[data-gm-moderation-reason]')?.value||'Ação administrativa do GM').trim().slice(0,160);}
  async function gmModerateSelected(userRecord,blocked){const action=blocked?'BLOQUEAR':'DESBLOQUEAR',name=gmUserName(userRecord),reason=gmModerationReason();if(!window.confirm(`${action} ${name}?\n\n${blocked?'A conta será retirada do modo online e não poderá sincronizar enquanto estiver bloqueada.':'A conta poderá entrar e sincronizar novamente.'}\n\nMotivo: ${reason}`))return;gmSetBusy(true);gmStatus(`${blocked?'Bloqueando':'Desbloqueando'} usuário…`);try{const result=await window.OTTHOS_RTDB?.gmSetUserBlocked?.(userRecord.uid,blocked,reason);if(!result?.ok)throw new Error(result?.error||'Ação recusada pelo Firebase.');gmStatus(blocked?'Usuário bloqueado.':'Usuário desbloqueado.','success');await gmRefreshPanel();}catch(error){gmStatus(error?.message||'Não foi possível alterar o bloqueio.','error');}finally{gmSetBusy(false);}}
  async function gmDeleteSelectedUser(userRecord){const name=gmUserName(userRecord),reason=gmModerationReason();if(!window.confirm(`EXCLUIR ${name}?\n\nEsta ação apaga cadastro, progresso e dados de jogo do Realtime Database e bloqueia a mesma conta para impedir recriação automática.\n\nHistórico administrativo é preservado.\n\nConfirmar exclusão?`))return;const typed=window.prompt('Para confirmar, digite EXCLUIR','');if(String(typed||'').trim().toUpperCase()!=='EXCLUIR'){gmStatus('Exclusão cancelada.','');return;}gmSetBusy(true);gmStatus('Excluindo usuário e dados do banco…');try{const result=await window.OTTHOS_RTDB?.gmDeleteUserData?.(userRecord.uid,reason);if(!result?.ok)throw new Error(result?.error||'Exclusão recusada pelo Firebase.');gmSelectedUid='';gmSelectedDetail=null;gmStatus('Usuário removido do Realtime Database e bloqueado contra recriação.','success');await gmRefreshPanel();}catch(error){gmStatus(error?.message||'Não foi possível excluir o usuário.','error');}finally{gmSetBusy(false);}}
  async function gmSelectUser(uid,force=false){
    gmSelectedUid=String(uid||'');gmRenderUserList();gmSelectedDetail=null;gmRenderSelected();if(!gmSelectedUid)return;
    const token=++gmRefreshSequence;gmStatus('Carregando progresso do jogador…');
    try{const detail=await window.OTTHOS_RTDB?.gmReadUser?.(gmSelectedUid,force);if(token!==gmRefreshSequence)return;gmSelectedDetail=detail?.ok?detail:null;gmStatus(detail?.ok?'':'Não foi possível carregar os dados.',detail?.ok?'':'error');gmRenderSelected();}
    catch(error){if(token!==gmRefreshSequence)return;gmStatus(error?.message||'Falha ao carregar jogador.','error');}
  }
  async function gmRefreshPanel(){
    if(!gmPanel)return;gmSetBusy(true);gmStatus('Consultando usuários e histórico…');
    try{const backend=window.OTTHOS_RTDB,[usersResult,auditResult]=await Promise.all([backend?.gmListUsers?.(),backend?.gmListAudit?.(100)]);if(!usersResult?.ok)throw new Error(usersResult?.error||'Não foi possível listar usuários.');gmUsers=usersResult.users||[];gmAudit=auditResult?.ok?(auditResult.entries||[]):[];if(gmSelectedUid&&!gmUsers.some(item=>item.uid===gmSelectedUid))gmSelectedUid='';if(!gmSelectedUid&&gmUsers.length)gmSelectedUid=gmUsers[0].uid;gmRenderUserList();gmStatus(`Painel atualizado: ${gmUsers.length} usuário(s).`,'success');if(gmSelectedUid)await gmSelectUser(gmSelectedUid,true);else gmRenderSelected();}
    catch(error){gmStatus(error?.message||'Não foi possível atualizar o painel.','error');}
    finally{gmSetBusy(false);}
  }
  async function gmSubmitGrant(event,userRecord){
    event.preventDefault();const form=event.currentTarget,coins=gmPositiveInt(form.querySelector('[data-gm-coins]')?.value),items={};
    form.querySelectorAll('[data-gm-item]').forEach(input=>{const amount=gmPositiveInt(input.value,Number(input.max)||GM_MAX_ADD),key=gmItemKey(input.dataset.gmItem);if(key&&amount)items[key]=amount;});
    const customKey=gmItemKey(form.querySelector('[data-gm-custom-key]')?.value),customAmount=gmPositiveInt(form.querySelector('[data-gm-custom-amount]')?.value);if(customKey&&customAmount){const meta=gmCatalog()[customKey];if(!meta&&!Object.hasOwn(state.inventory||{},customKey)){gmStatus('Código não reconhecido no catálogo do jogo.','error');return;}items[customKey]=gmPositiveInt((items[customKey]||0)+customAmount,meta?.max||GM_MAX_ADD);}
    if(!coins&&!Object.keys(items).length){gmStatus('Informe pelo menos uma quantidade positiva.','error');return;}
    const reason=String(form.querySelector('[data-gm-reason]')?.value||'Recompensa do GM').trim().slice(0,160),preview=gmGrantSummary({coins,items});
    const all=form.querySelector('[data-gm-all-users]')?.checked,targets=all?gmUsers.filter(u=>!u.blocked&&u.moderation?.state!=='blocked'):[userRecord];
    if(!targets.length)return;
    if(!window.confirm(`Confirmar para ${all?targets.length+' usuários ativos':gmUserName(userRecord)}?\n\n${preview}\n\nOs valores serão somente adicionados. Móveis: casa principal; veículos: coleção da garagem.`))return;
    if(all&&String(window.prompt('Para confirmar a concessão coletiva, digite TODOS','')||'').trim()!=='TODOS')return;
    gmSetBusy(true);gmStatus('Registrando concessão segura no Firebase…');
    try{const result=await window.OTTHOS_RTDB?.gmCreateGrantBatch?.(targets.map(u=>({uid:u.uid,name:gmUserName(u)})),{coins,items,reason});if(!result?.ok)throw new Error(result?.error||'Concessão recusada pelo Firebase.');gmStatus(`Concessão registrada para ${targets.length} jogador(es): ${preview}`,'success');await gmRefreshPanel();}
    catch(error){gmStatus(error?.message||'Não foi possível registrar a concessão.','error');}
    finally{gmSetBusy(false);}
  }
  function ensureGMPanel(){
    if(gmPanel)return gmPanel;gmPanel=document.createElement('div');gmPanel.id='gmAdminPanel';gmPanel.className='gm-admin-panel';gmPanel.hidden=true;gmPanel.innerHTML=`<section class="gm-admin-shell" role="dialog" aria-modal="true" aria-label="Painel administrativo GM"><header class="gm-admin-header"><div><span>🛡️</span><div><small>OTTHI WORLD</small><h2>Painel administrativo GM</h2><p>Concessões positivas com histórico no Firebase</p></div></div><button type="button" data-gm-close aria-label="Fechar painel">✕</button></header><div class="gm-admin-toolbar"><label><span>Pesquisar jogador</span><input type="search" placeholder="Nome, usuário ou UID" data-gm-search></label><button class="btn" type="button" data-gm-refresh>↻ Atualizar</button><span data-gm-user-count>0 de 0</span></div><p class="gm-panel-status" data-gm-status role="status" aria-live="polite" hidden></p><div class="gm-admin-layout"><aside><header><b>Usuários cadastrados</b><small>Conta e progresso do Realtime Database</small></header><div class="gm-user-list" data-gm-users></div></aside><main data-gm-detail></main></div></section>`;document.body.appendChild(gmPanel);
    gmPanel.querySelector('[data-gm-close]').addEventListener('click',closeGMPanel);gmPanel.querySelector('[data-gm-refresh]').addEventListener('click',gmRefreshPanel);gmPanel.querySelector('[data-gm-search]').addEventListener('input',gmRenderUserList);return gmPanel;
  }
  function closeGMPanel(){if(!gmPanel)return;gmPanel.hidden=true;document.body.classList.remove('gm-panel-open');}
  async function openGMPanel(){ensureGMPanel();gmPanel.hidden=false;document.body.classList.add('gm-panel-open');gmRenderSelected();await gmRefreshPanel();}
  function openGMAccessGate(){
    const wait=Math.max(0,gmAttemptBlockedUntil-Date.now());
    openModal('Acesso administrativo',`<div class="gm-access-gate"><div class="gm-access-shield">🛡️</div><p>Área exclusiva do GM do OTTHI World.</p><label class="field"><span>Código de acesso</span><input data-gm-access-code type="password" maxlength="16" autocomplete="off" inputmode="text" ${wait?'disabled':''}></label><p class="account-error" data-gm-access-error ${wait?'':'hidden'}>${wait?`Aguarde ${Math.ceil(wait/1000)} segundos antes de tentar novamente.`:''}</p><button class="btn primary xl" data-gm-access-submit ${wait?'disabled':''}>Verificar acesso</button><button class="btn" data-gm-access-cancel>Cancelar</button></div>`,root=>{
      const input=root.querySelector('[data-gm-access-code]'),error=root.querySelector('[data-gm-access-error]'),submit=root.querySelector('[data-gm-access-submit]');
      const showError=message=>{error.textContent=message;error.hidden=false;submit.disabled=false;submit.textContent='Verificar acesso';input.disabled=false;input.select();};
      const verify=async()=>{if(Date.now()<gmAttemptBlockedUntil){showError('Acesso temporariamente bloqueado por tentativas incorretas.');return;}if(String(input.value||'')!==gmAccessCode()){gmFailedAttempts++;if(gmFailedAttempts>=5){gmAttemptBlockedUntil=Date.now()+60000;gmFailedAttempts=0;}showError('Código administrativo incorreto.');return;}submit.disabled=true;input.disabled=true;submit.textContent='Confirmando conta GM…';try{const connection=await ensureAccountConnection();if(!connection.ok)throw new Error(connection.error);const account=connection.backend.accountStatus?.()||{};if(account.anonymous)throw new Error('Entre primeiro em “Minha conta”. O painel GM precisa de uma conta vinculada.');const authorization=await connection.backend.isCurrentUserGM?.(true);if(!authorization?.ok)throw new Error(authorization?.error||'Não foi possível verificar a permissão GM.');if(!authorization.allowed)throw new Error(`Esta conta ainda não está autorizada como GM. UID: ${authorization.uid}. No Firebase, defina otthosWorld/admins/${authorization.uid} como true.`);gmFailedAttempts=0;closeModal();await openGMPanel();}catch(accessError){showError(accessError?.message||'Acesso GM não autorizado.');}};
      submit.addEventListener('click',verify);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();verify();}});root.querySelector('[data-gm-access-cancel]').addEventListener('click',closeModal);setTimeout(()=>input?.focus(),80);
    });
  }
  function registerGMHiddenTrigger(){
    const signature=document.getElementById('gmSignature');if(!signature)return;
    const recordTap=()=>{const now=Date.now();if(now<gmTapLockedUntil)return;gmTapTimes=gmTapTimes.filter(time=>now-time<=GM_TAP_WINDOW_MS);gmTapTimes.push(now);if(gmTapTimes.length>=5){gmTapTimes=[];gmTapLockedUntil=now+1200;openGMAccessGate();}};
    signature.addEventListener('click',recordTap);signature.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();recordTap();}});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&gmPanel&&!gmPanel.hidden)closeGMPanel();});
  }
  ensureGMState();registerGMHiddenTrigger();dbReady.then(()=>{ensureGMState();gmScheduleLegacyRecovery();}).catch(()=>{});window.addEventListener('otthi:account-state-ready',gmScheduleLegacyRecovery);
  window.OTTHI_GM_PANEL=Object.freeze({openAccess:openGMAccessGate,close:closeGMPanel,refresh:gmRefreshPanel,queueGrant:queueGMGrant,state:()=>({users:gmUsers.length,selectedUid:gmSelectedUid,open:!!gmPanel&&!gmPanel.hidden})});
