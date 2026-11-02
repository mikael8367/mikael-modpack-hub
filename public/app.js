const $=s=>document.querySelector(s);let selected=[],results=[],currentPage=0,searchRequest=0;const PAGE_SIZE=20;let searchTotal=0;
function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
let popularLoaded=false;function go(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='search'&&!popularLoaded){popularLoaded=true;search(true)}}
document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>go(x.dataset.tab));document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function status(){try{const d=await(await fetch('/health')).json();$('#status').textContent=d.ok?'API online':'Indisponível';$('#mr-state').textContent='API pública disponível';$('#cf-state').textContent=d.providers.curseforge?'Chave configurada':'Chave não configurada';$('#settings-cf').textContent=d.providers.curseforge?'Configurado no servidor':'Adicione CURSEFORGE_API_KEY no Render';}catch{$('#status').textContent='Sem conexão'}}
async function search(popular=false,page=0){
 const requestId=++searchRequest,previousPage=currentPage;currentPage=Math.max(0,page);
 const q=$('#query').value.trim(),provider=$('#provider').value,sort=$('#sort-order').value,p=new URLSearchParams({limit:String(PAGE_SIZE),page:String(currentPage),sort});
 if(q)p.set('query',q);else popular=true;
 if($('#game-version').value.trim())p.set('game_version',$('#game-version').value.trim());
 if($('#loader').value)p.set('loader',$('#loader').value);
 $('#results').innerHTML='<div class="empty">'+(popular?'Carregando mods populares…':'Pesquisando…')+'</div>';
 try{
  const r=await fetch('/api/'+provider+'/search?'+p),d=await r.json();
  if(requestId!==searchRequest)return;if(!r.ok)throw Error(d.error||'Falha na busca');
  results=d.results||[];searchTotal=Number(d.total)||0;if(sort==='downloads_asc'||sort==='date_asc')results.reverse();
  if(!results.length){currentPage=previousPage;$('#results').innerHTML='<div class="empty">Não há mais resultados. Você chegou ao fim dos resultados disponíveis deste catálogo.</div>';renderPagination();return}
  $('#results').innerHTML=results.map((m,i)=>'<article class="result" data-open="'+i+'" role="button" tabindex="0"><img src="'+esc(m.icon_url||m.logo||'')+'" alt=""><div><h4>'+esc(m.title||m.name)+'</h4><p>'+esc(m.description||m.summary||'')+'</p></div><div class="result-foot"><span>'+Number(m.downloads||0).toLocaleString('pt-BR')+' downloads</span><button data-open="'+i+'" type="button">Escolher versão</button></div></article>').join('');
  document.querySelectorAll('[data-open]').forEach(b=>{const open=()=>openVersionPicker(results[Number(b.dataset.open)],provider,'download');b.onclick=e=>{e.stopPropagation();open()};if(b.tagName==='ARTICLE')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  renderPagination();
 }catch(e){if(requestId!==searchRequest)return;currentPage=previousPage;$('#results').innerHTML='<div class="empty">'+esc(e.message)+'</div>';renderPagination()}
}
function renderPagination(){const el=$('#pagination');if(!el)return;el.innerHTML='<button id="page-prev" '+(currentPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(currentPage+1)+'</span><button id="page-next" '+((currentPage+1)*PAGE_SIZE>=searchTotal?'disabled':'')+'>Próxima ›</button>';$('#page-prev').onclick=()=>search(false,currentPage-1);$('#page-next').onclick=()=>search(false,currentPage+1)}
let modalProject=null,modalProvider=null,modalMode='pack',availableFiles=[];
function fillOptions(select,values,firstLabel){select.innerHTML='<option value="">'+firstLabel+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')}
function refreshFileOptions(){
 const gv=$('#modal-game-version').value,loader=$('#modal-loader').value;
 const list=availableFiles.filter(v=>(!gv||(v.game_versions||v.gameVersions||[]).includes(gv))&&(!loader||(v.loaders||v.gameVersions||[]).some(x=>String(x).toLowerCase()===loader.toLowerCase())));
 $('#modal-file').innerHTML='<option value="">Selecione uma versão</option>'+list.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name||v.version_number||v.displayName||v.fileName||v.id)+'</option>').join('');
 $('#modal-add').disabled=true;
 $('#modal-hint').textContent=list.length?list.length+' versão(ões) compatível(is) encontrada(s).': 'Nenhuma versão encontrada com esses filtros.';
}
async function openVersionPicker(project,provider,mode='pack'){
 modalProject=project;modalProvider=provider;modalMode=mode;availableFiles=[];
 $('#version-project').textContent=project.title||project.name;
 $('#version-modal').hidden=false;$('#modal-add').disabled=true;$('#modal-add').textContent=mode==='download'?'Baixar mod':'Adicionar ao modpack';$('#modal-hint').textContent='Carregando versões disponíveis…';
 fillOptions($('#modal-game-version'),[],'Todas as versões');fillOptions($('#modal-loader'),[],'Todos os loaders');fillOptions($('#modal-file'),[],'Carregando…');
 try{
  let r,d;
  if(provider==='modrinth'){
   r=await fetch('/api/modrinth/project/'+encodeURIComponent(project.id)+'/versions');d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar versões');
   availableFiles=(d.versions||[]).map(v=>({id:v.id,name:(v.name||v.version_number)+' · '+(v.version_type||'release'),version_number:v.version_number,game_versions:v.game_versions||[],loaders:v.loaders||[],raw:v}));
  }else{
   const params=new URLSearchParams({limit:'50'});if($('#pack-step-mods')&&!$('#pack-step-mods').hidden&&packConfig){params.set('game_version',packConfig.minecraft_version);if(packConfig.loader!=='vanilla')params.set('loader',packConfig.loader)}else{if($('#game-version').value.trim())params.set('game_version',$('#game-version').value.trim());if($('#loader').value)params.set('loader',$('#loader').value)}
   r=await fetch('/api/curseforge/mod/'+encodeURIComponent(project.id)+'/files?'+params);d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar versões');
   availableFiles=(d.files||[]).map(v=>({id:String(v.id),displayName:v.displayName,fileName:v.fileName,gameVersions:v.gameVersions||[],raw:v}));
  }
  const versions=[...new Set(availableFiles.flatMap(v=>v.game_versions||v.gameVersions||[]).filter(x=>/^\d+\.\d+(\.\d+)?$/.test(x)))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  const loaders=[...new Set(availableFiles.flatMap(v=>v.loaders||[]).filter(x=>['fabric','forge','neoforge','quilt','liteloader','rift'].includes(String(x).toLowerCase())).map(x=>String(x).toLowerCase()))].sort();
  fillOptions($('#modal-game-version'),versions,'Todas as versões');fillOptions($('#modal-loader'),loaders,'Todos os loaders');refreshFileOptions();
  if(!availableFiles.length)$('#modal-hint').textContent='Nenhuma versão foi encontrada para este projeto.';
 }catch(e){$('#modal-hint').textContent=e.message;$('#modal-file').innerHTML='<option value="">Indisponível</option>'}
}
$('#modal-game-version').onchange=refreshFileOptions;$('#modal-loader').onchange=refreshFileOptions;$('#modal-file').onchange=()=>$('#modal-add').disabled=!$('#modal-file').value;
$('#modal-close').onclick=()=>$('#version-modal').hidden=true;
$('#version-modal').onclick=e=>{if(e.target===$('#version-modal'))$('#version-modal').hidden=true};
$('#modal-add').onclick=async()=>{const file=availableFiles.find(v=>String(v.id)===$('#modal-file').value);if(!file)return;if(modalMode==='download'){const button=$('#modal-add');button.disabled=true;button.textContent='Preparando download…';try{let url=modalProvider==='modrinth'?(file.raw?.files||[]).find(x=>x.primary)?.url||(file.raw?.files||[])[0]?.url:file.raw?.downloadUrl;if(!url&&modalProvider==='curseforge'){const r=await fetch('/api/curseforge/mod/'+encodeURIComponent(modalProject.id)+'/files/'+encodeURIComponent(file.id)+'/download-url');const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível obter o link de download.');url=d.url;}const parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('Link de download inseguro ou inválido.');const a=document.createElement('a');a.href=parsed.href;a.target='_blank';a.rel='noopener';a.download=file.raw?.filename||file.raw?.fileName||'';document.body.appendChild(a);a.click();a.remove();$('#version-modal').hidden=true;toast('Download iniciado. Confira os downloads do navegador.');}catch(e){toast(e.message||'Falha ao iniciar download.');button.disabled=false;button.textContent='Baixar mod';}return;}const item={provider:modalProvider,id:String(modalProject.id),name:modalProject.title||modalProject.name,version_id:String(file.id),version_name:file.name||file.version_number||file.displayName||file.fileName,game_version:$('#modal-game-version').value||((file.game_versions||file.gameVersions||[]).find(x=>/^\d+\.\d+(\.\d+)?$/.test(x))||''),loader:$('#modal-loader').value||((file.loaders||file.gameVersions||[]).find(x=>['fabric','forge','neoforge','quilt'].includes(String(x).toLowerCase()))||'')};if(selected.some(x=>x.provider===item.provider&&x.id===item.id&&x.version_id===item.version_id))return toast('Essa versão já foi adicionada.');selected.push(item);draw();$('#version-modal').hidden=true;drawPackSelection();toast('Versão adicionada ao modpack.')};

function add(m,provider){openVersionPicker(m,provider)}
function draw(){const el=$('#selected');if(!el)return;if(!selected.length){el.className='selected empty';el.textContent='Nenhum mod selecionado.';drawPackSelection();return}el.className='selected';el.innerHTML=selected.map((p,i)=>'<div class="selected-item"><span>'+esc(p.name)+' <small>('+p.provider+' · '+esc(p.version_name||'versão não definida')+')</small></span><button data-remove="'+i+'">Remover</button></div>').join('');document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.remove),1);draw()});drawPackSelection()}
let packConfig=null,packProvider='modrinth',packRequest=0,packCatalog=[],packPage=0,packTotal=0;
function drawPackSelection(){const b=$('#create-pack'),listButton=$('#show-pack-mods');if(b)b.disabled=!packConfig||!selected.length;if(listButton){listButton.disabled=!packConfig;listButton.textContent='Mods no modpack ('+selected.length+')';}}
$('#show-pack-mods').onclick=()=>{const panel=$('#pack-selected-panel');if(!panel)return;panel.hidden=!panel.hidden;$('#show-pack-mods').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)panel.scrollIntoView({behavior:'smooth',block:'nearest'});};
function confirmPackConfig(){const name=$('#pack-name').value.trim(),version=$('#pack-version').value.trim(),loader=$('#pack-loader').value;if(!name||!/^\d+\.\d+(\.\d+)?$/.test(version)){toast('Informe nome e versão Minecraft válidos.');return}packConfig={name,minecraft_version:version,loader};$('#pack-step-config').hidden=true;$('#pack-step-mods').hidden=false;$('#pack-summary-name').textContent=name;$('#pack-summary-game').textContent='Minecraft '+version;$('#pack-summary-loader').textContent=loader;selected=[];draw();searchPackMods('',0)}
function goBackToConfig(){$('#pack-step-config').hidden=false;$('#pack-step-mods').hidden=true}
async function searchPackMods(q='',page=0){const req=++packRequest;packPage=Math.max(0,page);const sort=$('#pack-sort').value;const p=new URLSearchParams({limit:'20',page:String(packPage),game_version:packConfig.minecraft_version,sort});if(q)p.set('query',q);if(packConfig.loader!=='vanilla')p.set('loader',packConfig.loader);$('#pack-results').innerHTML='<div class="empty">Carregando mods compatíveis…</div>';try{const r=await fetch('/api/'+packProvider+'/search?'+p),d=await r.json();if(req!==packRequest)return;if(!r.ok)throw Error(d.error||'Falha na busca');packCatalog=d.results||[];packTotal=Number(d.total)||0;if(sort==='downloads_asc'||sort==='date_asc')packCatalog.reverse();if(!packCatalog.length){$('#pack-results').innerHTML='<div class="empty">Nenhum mod encontrado.</div>';$('#pack-pagination').innerHTML='';return}$('#pack-results').innerHTML=packCatalog.map((m,i)=>'<article class="result '+(selected.some(x=>x.provider===packProvider&&x.id===String(m.id))?'selected-mod':'')+'" data-pack-open="'+i+'"><img src="'+esc(m.icon_url||m.logo||'')+'" alt=""><div><h4>'+esc(m.title||m.name)+'</h4><p>'+esc(m.description||m.summary||'')+'</p></div><div class="result-foot"><span>'+Number(m.downloads||0).toLocaleString('pt-BR')+' downloads</span><button type="button" data-pack-open="'+i+'">Escolher versão</button></div></article>').join('');document.querySelectorAll('[data-pack-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();openVersionPicker(packCatalog[Number(b.dataset.packOpen)],packProvider)});$('#pack-pagination').innerHTML='<button id="pack-prev" '+(packPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(packPage+1)+'</span><button id="pack-next" '+((packPage+1)*20>=packTotal?'disabled':'')+'>Próxima ›</button>';$('#pack-prev').onclick=()=>searchPackMods($('#pack-query').value.trim(),packPage-1);$('#pack-next').onclick=()=>searchPackMods($('#pack-query').value.trim(),packPage+1)}catch(e){if(req!==packRequest)return;$('#pack-results').innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
$('#confirm-pack').onclick=confirmPackConfig;$('#edit-pack-config').onclick=goBackToConfig;$('#pack-search-btn').onclick=()=>searchPackMods($('#pack-query').value.trim(),0);$('#pack-sort').onchange=()=>searchPackMods($('#pack-query').value.trim(),0);$('#pack-query').onkeydown=e=>{if(e.key==='Enter')searchPackMods(e.target.value.trim(),0)};document.querySelectorAll('[data-pack-provider]').forEach(b=>b.onclick=()=>{packProvider=b.dataset.packProvider;document.querySelectorAll('[data-pack-provider]').forEach(x=>{const active=x.dataset.packProvider===packProvider;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))});searchPackMods($('#pack-query').value.trim(),0)});
$('#create-pack').onclick=async()=>{if(!packConfig||!selected.length)return;const b=$('#create-pack');b.disabled=true;$('#create-status').textContent='Resolvendo dependências e preparando o arquivo…';$('#download-pack').hidden=true;try{const r=await fetch('/api/packs/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...packConfig,projects:selected})});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Não foi possível criar o modpack')}const blob=await r.blob();const url=URL.createObjectURL(blob),link=$('#download-pack');link.href=url;link.download=packConfig.name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)+'.mrpack';link.textContent='Baixar '+link.download;link.hidden=false;$('#create-status').textContent='Arquivo .mrpack pronto para baixar.';toast('Modpack criado!')}catch(e){$('#create-status').textContent=e.message;toast('Falha ao criar modpack')}finally{b.disabled=false}};

document.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{const provider=b.dataset.provider;if($('#provider').value===provider)return;$('#provider').value=provider;document.querySelectorAll('[data-provider]').forEach(x=>{const active=x.dataset.provider===provider;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))});search(!$('#query').value.trim(),0)});$('#search-btn').onclick=()=>search(false,0);$('#query').onkeydown=e=>{if(e.key==='Enter')search(false,0)};$('#game-version').onchange=()=>search(!$('#query').value.trim(),0);$('#loader').onchange=()=>search(!$('#query').value.trim(),0);$('#sort-order').onchange=()=>search(!$('#query').value.trim(),0);
const validateButton=$('#validate');if(validateButton)validateButton.onclick=async()=>{const body={name:$('#pack-name').value.trim(),minecraft_version:$('#pack-version').value.trim(),loader:$('#pack-loader').value.toLowerCase(),projects:selected};try{const r=await fetch('/api/packs/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();$('#manifest').hidden=false;$('#manifest').textContent=JSON.stringify(d,null,2);toast(d.valid?'Manifesto válido.':'Revise os dados.')}catch{toast('Falha ao validar.')}};
status();

// v1.1.0 — biblioteca local, análise, atualizações e exportação.
const HUB_STORAGE_KEY='modpack-hub-library-v1';
function readLibrary(){try{const value=JSON.parse(localStorage.getItem(HUB_STORAGE_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function writeLibrary(items){try{localStorage.setItem(HUB_STORAGE_KEY,JSON.stringify(items));return true}catch{return false}}
function safeFileName(value){return String(value||'modpack').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'modpack'}
function downloadText(filename,text,mime='text/plain;charset=utf-8'){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function renderLibrary(){const host=$('#saved-packs');if(!host)return;const items=readLibrary();if(!items.length){host.innerHTML='<div class="empty">Nenhum modpack salvo ainda. Configure um modpack e toque em “Salvar na biblioteca”.</div>';return}host.innerHTML=items.map((p,i)=>'<article class="saved-pack"><div><h4>'+esc(p.name)+'</h4><p>Minecraft '+esc(p.minecraft_version)+' · '+esc(p.loader)+' · '+(p.projects||[]).length+' mods</p><small>Salvo em '+esc(new Date(p.saved_at).toLocaleString('pt-BR'))+'</small></div><div class="saved-actions"><button data-load-saved="'+i+'">Abrir</button><button data-export-saved="'+i+'">Exportar JSON</button><button data-delete-saved="'+i+'">Excluir</button></div></article>').join('');host.querySelectorAll('[data-load-saved]').forEach(b=>b.onclick=()=>{const p=readLibrary()[Number(b.dataset.loadSaved)];if(!p)return;packConfig={name:p.name,minecraft_version:p.minecraft_version,loader:p.loader};selected=Array.isArray(p.projects)?p.projects:[];$('#pack-name').value=p.name;$('#pack-version').value=p.minecraft_version;$('#pack-loader').value=p.loader;$('#pack-step-config').hidden=true;$('#pack-step-mods').hidden=false;$('#pack-summary-name').textContent=p.name;$('#pack-summary-game').textContent='Minecraft '+p.minecraft_version;$('#pack-summary-loader').textContent=p.loader;draw();drawPackSelection();go('packs');searchPackMods('',0)});host.querySelectorAll('[data-delete-saved]').forEach(b=>b.onclick=()=>{const items=readLibrary();items.splice(Number(b.dataset.deleteSaved),1);writeLibrary(items);renderLibrary();toast('Modpack removido da biblioteca.')});host.querySelectorAll('[data-export-saved]').forEach(b=>b.onclick=()=>{const p=readLibrary()[Number(b.dataset.exportSaved)];if(p)downloadText(safeFileName(p.name)+'.json',JSON.stringify(p,null,2),'application/json')})}
$('#save-pack').onclick=()=>{if(!packConfig||!selected.length)return;const items=readLibrary();items.unshift({...packConfig,projects:selected.map(p=>({...p})),saved_at:new Date().toISOString()});if(!writeLibrary(items.slice(0,100))){toast('Não foi possível salvar. O armazenamento do navegador pode estar cheio.');return}renderLibrary();toast('Modpack salvo na biblioteca.')};
$('#export-library').onclick=()=>{const items=readLibrary();if(!items.length)return toast('Biblioteca vazia.');downloadText('modpack-hub-biblioteca.json',JSON.stringify(items,null,2),'application/json')};
$('#clear-library').onclick=()=>{if(!readLibrary().length)return toast('Biblioteca já está vazia.');if(confirm('Excluir todos os modpacks salvos neste aparelho?')){writeLibrary([]);renderLibrary();toast('Biblioteca limpa.')}};
$('#export-mod-list').onclick=()=>{if(!packConfig||!selected.length)return;const lines=['Modpack: '+packConfig.name,'Minecraft: '+packConfig.minecraft_version,'Loader: '+packConfig.loader,'','Mods:'];for(const p of selected)lines.push('- '+p.name+' | '+p.provider+' | '+p.version_name+' | ID '+p.id+' | versão '+p.version_id);downloadText(safeFileName(packConfig.name)+'-mods.txt',lines.join('\n'))};
function showAnalysis(title,items){const panel=$('#pack-analysis');panel.hidden=false;panel.innerHTML='<h3>'+esc(title)+'</h3>'+(items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>Nenhum problema óbvio encontrado nos dados selecionados. Isso não garante funcionamento dentro do jogo.</p>');panel.scrollIntoView({behavior:'smooth',block:'nearest'})}
$('#analyze-pack').onclick=()=>{if(!packConfig)return;const notes=[],seen=new Set();for(const p of selected){const key=p.provider+':'+p.id;if(seen.has(key))notes.push('Projeto repetido: '+p.name);seen.add(key);if(p.game_version&&p.game_version!==packConfig.minecraft_version)notes.push(p.name+': selecionado para Minecraft '+p.game_version+', mas o modpack usa '+packConfig.minecraft_version+'.');if(p.loader&&p.loader!==packConfig.loader)notes.push(p.name+': loader '+p.loader+' diferente do loader '+packConfig.loader+'.');if(packConfig.loader==='vanilla')notes.push('O modpack está configurado como Vanilla; mods que exigem Forge/Fabric/NeoForge não funcionarão sem o loader correspondente.')}if(!selected.length)notes.push('Adicione pelo menos um mod para analisar o modpack.');notes.push('A análise usa os metadados escolhidos; não executa os mods nem prevê crashes ou consumo exato de RAM.');showAnalysis('Relatório de compatibilidade',notes)};
$('#check-updates').onclick=async()=>{if(!packConfig||!selected.length)return;const button=$('#check-updates');button.disabled=true;button.textContent='Verificando…';const notes=[];try{for(const p of selected){if(p.provider!=='modrinth'){notes.push(p.name+': verificação automática disponível apenas para versões Modrinth.');continue}try{const r=await fetch('/api/modrinth/project/'+encodeURIComponent(p.id)+'/versions?game_version='+encodeURIComponent(packConfig.minecraft_version)+'&loader='+encodeURIComponent(packConfig.loader==='vanilla'?'':packConfig.loader));const d=await r.json();if(!r.ok)throw Error(d.error||'API indisponível');const latest=(d.versions||[]).find(v=>(v.game_versions||[]).includes(packConfig.minecraft_version)&&(packConfig.loader==='vanilla'||(v.loaders||[]).includes(packConfig.loader)));if(!latest){notes.push(p.name+': nenhuma versão compatível encontrada.');continue}if(latest.id!==p.version_id)notes.push(p.name+': há outra versão compatível ('+(latest.name||latest.version_number)+'). Confira antes de atualizar.');else notes.push(p.name+': parece estar na versão compatível mais recente listada.')}catch(e){notes.push(p.name+': não foi possível verificar ('+e.message+').')}}showAnalysis('Verificação de atualizações',notes)}finally{button.disabled=!packConfig;button.textContent='Verificar atualizações'}};
function syncExtraButtons(){const ready=Boolean(packConfig);for(const id of ['save-pack','analyze-pack','check-updates']){const el=$('#'+id);if(el)el.disabled=!ready}const exp=$('#export-mod-list');if(exp)exp.disabled=!ready||!selected.length}
const oldDraw=draw;draw=function(){oldDraw();syncExtraButtons()};
const oldDrawPackSelection=drawPackSelection;drawPackSelection=function(){oldDrawPackSelection();syncExtraButtons()};
const oldGo=go;go=function(id){oldGo(id);if(id==='library')renderLibrary()};
renderLibrary();syncExtraButtons();


// Bedrock: seleção local sem enviar arquivos ao servidor.
const bedrockInput=$('#bedrock-file');
if(bedrockInput)bedrockInput.addEventListener('change',()=>{const host=$('#bedrock-files'),files=Array.from(bedrockInput.files||[]);if(!files.length){host.innerHTML='<div class="empty">Nenhum arquivo selecionado.</div>';return}const invalid=files.filter(f=>!f.name.toLowerCase().endsWith('.mcpack')&&!f.name.toLowerCase().endsWith('.mcaddon'));if(invalid.length)toast('Alguns arquivos não parecem ser add-ons Bedrock.');const valid=files.filter(f=>f.name.toLowerCase().endsWith('.mcpack')||f.name.toLowerCase().endsWith('.mcaddon'));host.innerHTML=valid.length?valid.map(f=>'<div class="bedrock-file"><span>'+esc(f.name)+'<small>'+(f.size/1048576).toFixed(2)+' MB · arquivo local</small></span><span>✓</span></div>').join(''):'<div class="empty">Selecione arquivos .mcpack ou .mcaddon válidos.</div>';});


// v1.3.0 — catálogo Bedrock separado do catálogo Java.
let bedrockPage=0,bedrockRequest=0,bedrockResults=[];
async function searchBedrock(page=0){
 const req=++bedrockRequest,query=$('#bedrock-query').value.trim();bedrockPage=Math.max(0,page);
 $('#bedrock-results').innerHTML='<div class="empty">Pesquisando add-ons Bedrock…</div>';
 try{
  const sort=$('#bedrock-sort').value,params=new URLSearchParams({limit:'20',page:String(bedrockPage),sort});if(query)params.set('query',query);
  const response=await fetch('/api/bedrock/search?'+params),data=await response.json();
  if(req!==bedrockRequest)return;if(!response.ok)throw Error(data.error||'Falha na pesquisa Bedrock.');
  bedrockResults=data.results||[];if(sort==='downloads_asc'||sort==='date_asc')bedrockResults.reverse();
  if(!bedrockResults.length){$('#bedrock-results').innerHTML='<div class="empty">Nenhum add-on encontrado nesta página.</div>';$('#bedrock-pagination').innerHTML='';return}
  $('#bedrock-results').innerHTML=bedrockResults.map(item=>'<article class="result"><img src="'+esc(item.icon_url||'')+'" alt=""><div><h4>'+esc(item.title)+'</h4><p>'+esc(item.description||'Sem descrição.')+'</p></div><div class="result-foot"><span>'+Number(item.downloads||0).toLocaleString('pt-BR')+' downloads</span><a class="bedrock-open" href="'+esc(item.url||'https://www.curseforge.com/minecraft-bedrock/addons')+'" target="_blank" rel="noopener">Ver add-on ↗</a></div></article>').join('');
  $('#bedrock-pagination').innerHTML='<button id="bedrock-prev" '+(bedrockPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(bedrockPage+1)+'</span><button id="bedrock-next" '+(bedrockResults.length<20?'disabled':'')+'>Próxima ›</button>';
  $('#bedrock-prev').onclick=()=>searchBedrock(bedrockPage-1);$('#bedrock-next').onclick=()=>searchBedrock(bedrockPage+1);
 }catch(error){if(req!==bedrockRequest)return;$('#bedrock-results').innerHTML='<div class="empty">'+esc(error.message)+'</div>';$('#bedrock-pagination').innerHTML=''}
}
$('#bedrock-search-btn').onclick=()=>searchBedrock(0);$('#bedrock-sort').onchange=()=>searchBedrock(0);
$('#bedrock-query').onkeydown=e=>{if(e.key==='Enter')searchBedrock(0)};

let bedrockLoaded=false;const previousGoForBedrock=go;go=function(id){previousGoForBedrock(id);if(id==='bedrock'&&!bedrockLoaded){bedrockLoaded=true;searchBedrock(0)}};


// Conta própria do site e sincronização explícita da biblioteca.
let hubAccount=null;
async function accountRequest(path,options={}) {
 const response=await fetch('/api/auth'+path,{credentials:'same-origin',...options,headers:{...(options.headers||{}),'content-type':'application/json'}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Falha na conta.');
 return data;
}
function renderAccount(){
 const state=$('#account-state'),forms=$('#account-forms'),logout=$('#account-logout'),pull=$('#account-sync-pull'),push=$('#account-sync-push');
 if(hubAccount){state.textContent='Conectado como '+hubAccount.name+' ('+hubAccount.email+').'; forms.hidden=true;logout.hidden=false;pull.disabled=false;push.disabled=false}
 else{state.textContent='Você está usando a biblioteca local. Entre para ativar a nuvem.';forms.hidden=false;logout.hidden=true;pull.disabled=true;push.disabled=true}
}
async function refreshAccount(){
 try{const data=await accountRequest('/me');hubAccount=data.user;renderAccount()}
 catch(error){hubAccount=null;renderAccount();$('#account-state').textContent=error.message}
}
async function submitAccount(mode){
 const name=$('#account-name').value.trim(),email=$('#account-email').value.trim(),password=$('#account-password').value;
 try{
  const data=await accountRequest(mode,{method:'POST',body:JSON.stringify({name,email,password})});
  hubAccount=data.user;$('#account-password').value='';renderAccount();toast(mode==='/register'?'Conta criada com sucesso.':'Login realizado.');
 }catch(error){toast(error.message)}
}
$('#account-register').onclick=()=>submitAccount('/register');
$('#account-login').onclick=()=>submitAccount('/login');
$('#account-logout').onclick=async()=>{try{await accountRequest('/logout',{method:'POST',body:'{}'});hubAccount=null;renderAccount();toast('Sessão encerrada.')}catch(error){toast(error.message)}};
$('#account-sync-pull').onclick=async()=>{
 if(!hubAccount)return;
 if(!confirm('Substituir a biblioteca deste aparelho pelos dados da nuvem? Exporte uma cópia antes se precisar.'))return;
 try{const data=await accountRequest('/library');if(!Array.isArray(data.packs))throw Error('Formato recebido inválido.');if(!writeLibrary(data.packs))throw Error('Não foi possível gravar no aparelho.');renderLibrary();toast('Biblioteca baixada da nuvem.')}
 catch(error){toast(error.message)}
};
$('#account-sync-push').onclick=async()=>{
 if(!hubAccount)return;
 try{const packs=readLibrary();await accountRequest('/library',{method:'PUT',body:JSON.stringify({packs})});toast('Biblioteca enviada para a nuvem ('+packs.length+' modpacks).')}
 catch(error){toast(error.message)}
};
refreshAccount();

// Importação de biblioteca exportada em JSON ou lista TXT do próprio Hub.
const importInput=$('#library-import');
if(importInput)importInput.addEventListener('change',async()=>{
 const file=importInput.files?.[0];if(!file)return;
 try{
  const raw=await file.text();let incoming;
  if(file.name.toLowerCase().endsWith('.json')){const parsed=JSON.parse(raw);incoming=Array.isArray(parsed)?parsed:[parsed]}
  else{
   const lines=raw.split(/\r?\n/),name=(lines.find(x=>x.startsWith('Modpack: '))||'Modpack: Importado').slice(9).trim(),version=(lines.find(x=>x.startsWith('Minecraft: '))||'Minecraft: ').slice(11).trim(),loader=(lines.find(x=>x.startsWith('Loader: '))||'Loader: forge').slice(8).trim();
   const projects=lines.filter(x=>x.startsWith('- ')).map(line=>{const parts=line.slice(2).split(' | ');const id=(parts[3]||'').replace(/^ID\s*/,'').trim(),versionId=(parts[4]||'').replace(/^versão\s*/,'').trim();return {name:parts[0]||'Mod importado',provider:parts[1],version_name:parts[2],id,version_id:versionId,game_version:version,loader}});
   incoming=[{name,minecraft_version:version,loader,projects,saved_at:new Date().toISOString()}];
  }
  const valid=incoming.filter(p=>p&&typeof p.name==='string'&&typeof p.minecraft_version==='string'&&Array.isArray(p.projects)&&p.projects.length<=100&&p.projects.every(x=>['modrinth','curseforge'].includes(x.provider)&&x.id&&x.version_id));
  if(!valid.length)throw Error('O arquivo não contém modpacks válidos do Hub.');
  const merged=[...valid,...readLibrary()].slice(0,100);if(!writeLibrary(merged))throw Error('Armazenamento local cheio.');
  renderLibrary();toast(valid.length+' modpack(s) importado(s).');
 }catch(error){toast(error.message||'Falha ao importar arquivo.')}
 finally{importInput.value=''}
});

// Tema claro opcional, sem alterar o tema padrão.
const themeKey='modpack-hub-theme';
function applyTheme(theme){document.documentElement.dataset.theme=theme;const button=$('#theme-toggle');if(button)button.textContent=theme==='light'?'Ativar tema escuro':'Ativar tema claro'}
applyTheme(localStorage.getItem(themeKey)==='light'?'light':'dark');
$('#theme-toggle').onclick=()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';localStorage.setItem(themeKey,next);applyTheme(next)};


// Comunidade: leitura pública, publicação e envio de capa apenas com sessão autenticada.
let communityLoaded=false,communityBusy=false;
function renderCommunityAccess(){
 const logged=Boolean(hubAccount);
 $('#community-account-required').hidden=logged;
 $('#community-publish-card').hidden=!logged;
}
async function loadCommunity(){
 const host=$('#community-list');if(!host)return;
 host.innerHTML='<div class="empty">Carregando publicações…</div>';
 try{
  const response=await fetch('/api/auth/community/packs',{credentials:'same-origin'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Falha ao carregar comunidade.');
  const packs=Array.isArray(data.packs)?data.packs:[];
  if(!packs.length){host.innerHTML='<div class="empty">Ainda não há modpacks publicados. Seja o primeiro a compartilhar!</div>';return}
  host.innerHTML=packs.map(p=>'<article class="community-pack"><img src="'+esc(p.image)+'" alt="Capa do modpack '+esc(p.name)+'" loading="lazy"><div class="community-pack-info"><h3>'+esc(p.name)+'</h3><p>Minecraft '+esc(p.minecraft_version)+'</p><p>'+esc(p.description||'Sem descrição.')+'</p><small>Publicado por '+esc(p.author)+' · '+esc(new Date(p.created_at).toLocaleDateString('pt-BR'))+'</small></div></article>').join('');
 }catch(error){host.innerHTML='<div class="empty">'+esc(error.message)+'</div>'}
}
function readAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Não foi possível ler a foto.'));reader.readAsDataURL(file)})}
async function compressCommunityImage(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Escolha uma foto PNG, JPG ou WebP.');
 if(file.size>12*1024*1024)throw Error('A foto original deve ter no máximo 12 MB.');
 const source=await readAsDataUrl(file);
 const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Imagem inválida ou não suportada.'));image.src=source});
 const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível processar a foto.');
 context.drawImage(image,0,0,canvas.width,canvas.height);
 let quality=.86,blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
 while(blob&&blob.size>1024*1024&&quality>.45){quality-=.1;blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))}
 if(!blob||blob.size>1024*1024)throw Error('Não foi possível reduzir a foto para menos de 1 MB. Escolha outra imagem.');
 return await readAsDataUrl(blob);
}
const communityImage=$('#community-image');
if(communityImage)communityImage.addEventListener('change',async()=>{
 const preview=$('#community-preview'),file=communityImage.files?.[0];preview.innerHTML='';
 if(!file)return;
 try{const data=await compressCommunityImage(file);preview.innerHTML='<img src="'+data+'" alt="Prévia da capa selecionada">';preview.dataset.image=data}
 catch(error){delete preview.dataset.image;communityImage.value='';toast(error.message)}
});
$('#community-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!hubAccount)return toast('Entre na sua conta antes de publicar.');
 if(communityBusy)return;
 const button=$('#community-submit'),preview=$('#community-preview');
 const name=$('#community-name').value.trim(),version=$('#community-version').value.trim(),description=$('#community-description').value.trim();
 if(name.length<3||!/^\d+\.\d+(\.\d+)?$/.test(version))return toast('Confira o nome e a versão do Minecraft.');
 let image=preview.dataset.image;
 if(!image&&communityImage.files?.[0]){try{image=await compressCommunityImage(communityImage.files[0]);preview.dataset.image=image;preview.innerHTML='<img src="'+image+'" alt="Prévia da capa selecionada">'}catch(error){return toast(error.message)}}
 if(!image)return toast('Selecione uma foto de capa.');
 communityBusy=true;button.disabled=true;button.textContent='Publicando…';
 try{
  const response=await fetch('/api/auth/community/packs',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({name,minecraft_version:version,description,image})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Falha ao publicar.');
  $('#community-form').reset();preview.innerHTML='';delete preview.dataset.image;
  toast('Modpack publicado na comunidade!');await loadCommunity();
 }catch(error){toast(error.message)}
 finally{communityBusy=false;button.disabled=false;button.textContent='Publicar na comunidade'}
});
$('#community-refresh').onclick=loadCommunity;
const previousGoForCommunity=go;
go=function(id){previousGoForCommunity(id);if(id==='community'){renderCommunityAccess();if(!communityLoaded){communityLoaded=true;loadCommunity()}}};
const previousRenderAccount=renderAccount;
renderAccount=function(){previousRenderAccount();renderCommunityAccess()};
