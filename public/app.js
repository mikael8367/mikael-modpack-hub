const $=s=>document.querySelector(s);let selected=[],results=[],currentPage=0,searchRequest=0;const PAGE_SIZE=20;let searchTotal=0;
function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}

// Tutorial de primeira visita: fica salvo apenas neste navegador/aparelho.
const tutorialSteps=[
 {icon:'⌕',title:'Pesquisar mods',description:'Nesta aba você procura mods para Minecraft Java. Digite o nome do mod e toque em Buscar. Escolha o mod para ver as versões e baixar.',tip:'Confira se a versão do Minecraft e o Forge ou Fabric são compatíveis.'},
 {icon:'＋',title:'Montar um modpack',description:'Toque em Criar. Escolha o nome, a versão do Minecraft e o Forge, Fabric ou outro loader. Depois adicione os mods e toque em Baixar modpack.',tip:'Escolha mods feitos para a mesma versão do Minecraft e do loader.'},
 {icon:'◇',title:'Add-ons Bedrock',description:'Aqui ficam os conteúdos do Minecraft Bedrock. Pesquise add-ons ou importe arquivos .mcpack e .mcaddon do seu celular.',tip:'Mods .jar de Java não funcionam no Bedrock.'},
 {icon:'♧',title:'Comunidade',description:'Aqui você vê os modpacks de outras pessoas. Entre na sua conta para publicar o seu.',tip:'Use uma imagem que você pode compartilhar.'},
 {icon:'⌕',title:'Resolver erros',description:'O Minecraft deu erro? Abra Crash e escolha um arquivo .txt, .log ou PDF. O Hub vai procurar pistas para ajudar.',tip:'O resultado é uma ajuda, não uma garantia de encontrar o erro.'},
 {icon:'▤',title:'Biblioteca e Ajustes',description:'Na Biblioteca ficam seus modpacks salvos. Em Ajustes você pode criar uma conta, entrar ou mudar seu nome.',tip:'Sem conta, seus dados ficam apenas neste celular.'}
];
let tutorialIndex=0;
function renderTutorial(){
 const step=tutorialSteps[tutorialIndex];if(!step)return;
 $('#tutorial-icon').textContent=step.icon;$('#tutorial-title').textContent=step.title;
 $('#tutorial-description').textContent=step.description;$('#tutorial-tip').textContent=step.tip;
 $('#tutorial-step-count').textContent='Etapa '+(tutorialIndex+1)+' de '+tutorialSteps.length;
 $('#tutorial-progress-fill').style.width=((tutorialIndex+1)/tutorialSteps.length*100)+'%';
 $('#tutorial-next').textContent=tutorialIndex===tutorialSteps.length-1?'Concluir':'Próximo';
}
function openTutorial(){tutorialIndex=0;renderTutorial();$('#welcome-tutorial').hidden=false;document.body.classList.add('tutorial-open')}
function closeTutorial(){localStorage.setItem('modpack-hub-tutorial-v1','done');$('#welcome-tutorial').hidden=true;document.body.classList.remove('tutorial-open')}
$('#tutorial-next').onclick=()=>{if(tutorialIndex<tutorialSteps.length-1){tutorialIndex++;renderTutorial()}else closeTutorial()};
$('#tutorial-skip').onclick=closeTutorial;
$('#tutorial-replay').onclick=openTutorial;
if(!localStorage.getItem('modpack-hub-tutorial-v1'))openTutorial();
let popularLoaded=false;function go(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='search'&&!popularLoaded)search(true)}
document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>go(x.dataset.tab));document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function status(){try{const d=await(await fetch('/health')).json();$('#status').textContent=d.ok?'API online':'Indisponível';$('#mr-state').textContent='API pública disponível';$('#cf-state').textContent=d.providers.curseforge?'Chave configurada':'Chave não configurada';$('#settings-cf').textContent=d.providers.curseforge?'Configurado no servidor':'Adicione CURSEFORGE_API_KEY no Render';}catch{$('#status').textContent='Sem conexão'}}
let catalogType='mods';
async function search(popular=false,page=0){
 const requestId=++searchRequest,previousPage=currentPage;currentPage=Math.max(0,page);
 const q=$('#query').value.trim(),provider=$('#provider').value,sort=$('#sort-order').value,p=new URLSearchParams({limit:String(PAGE_SIZE),page:String(currentPage),sort,type:catalogType});
 if(q)p.set('query',q);else popular=true;
 if($('#game-version').value.trim())p.set('game_version',$('#game-version').value.trim());
 if($('#loader').value)p.set('loader',$('#loader').value);
 $('#results').innerHTML='<div class="empty">'+(popular?'Carregando mods populares…':'Pesquisando…')+'</div>';
 try{
  const r=await fetch('/api/'+provider+'/search?'+p),d=await r.json();
  if(requestId!==searchRequest)return false;if(!r.ok)throw Error(d.error||'Falha na busca');
  if(!q)popularLoaded=true;results=d.results||[];searchTotal=Number(d.total)||0;if(sort==='downloads_asc'||sort==='date_asc')results.reverse();
  if(!results.length){currentPage=previousPage;$('#results').innerHTML='<div class="empty">Não há mais resultados. Você chegou ao fim dos resultados disponíveis deste catálogo.</div>';renderPagination();return}
  $('#results').innerHTML=results.map((m,i)=>'<article class="result" data-open="'+i+'" role="button" tabindex="0"><img src="'+esc(m.icon_url||m.logo||'')+'" alt=""><div><h4>'+esc(m.title||m.name)+'</h4><p>'+esc(m.description||m.summary||'')+'</p></div><div class="result-foot"><span>'+Number(m.downloads||0).toLocaleString('pt-BR')+' downloads</span><button data-open="'+i+'" type="button">Escolher versão</button></div></article>').join('');
  document.querySelectorAll('[data-open]').forEach(b=>{const open=()=>openVersionPicker(results[Number(b.dataset.open)],provider,'download');b.onclick=e=>{e.stopPropagation();open()};if(b.tagName==='ARTICLE')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  renderPagination();
 }catch(e){if(requestId!==searchRequest)return false;if(!q)popularLoaded=false;currentPage=previousPage;$('#results').innerHTML='<div class="empty">'+esc(e.message)+'<br><button id="retry-popular" class="secondary" type="button">Tentar novamente</button></div>';const retry=$('#retry-popular');if(retry)retry.onclick=()=>search(true,0);renderPagination();return false}
 return true;
}
function renderPagination(){const el=$('#pagination');if(!el)return;el.innerHTML='<button id="page-prev" '+(currentPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(currentPage+1)+'</span><button id="page-next" '+((currentPage+1)*PAGE_SIZE>=searchTotal?'disabled':'')+'>Próxima ›</button>';$('#page-prev').onclick=()=>search(false,currentPage-1);$('#page-next').onclick=()=>search(false,currentPage+1)}
let modalProject=null,modalProvider=null,modalMode='pack',modalPackConfig=null,availableFiles=[];
function fillOptions(select,values,firstLabel){select.innerHTML='<option value="">'+firstLabel+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')}
function refreshFileOptions(){
 const gv=$('#modal-game-version').value,loader=$('#modal-loader').value;
 const list=availableFiles.filter(v=>(!gv||(v.game_versions||v.gameVersions||[]).includes(gv))&&(!loader||(v.loaders||[]).some(x=>String(x).toLowerCase()===loader.toLowerCase())));
 $('#modal-file').innerHTML='<option value="">Selecione uma versão</option>'+list.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name||v.version_number||v.displayName||v.fileName||v.id)+'</option>').join('');
 $('#modal-add').disabled=true;
 $('#modal-hint').textContent=list.length?list.length+' versão(ões) compatível(is) encontrada(s).': 'Nenhuma versão encontrada com esses filtros.';
}
async function openVersionPicker(project,provider,mode='pack'){
 modalProject=project;modalProvider=provider;modalMode=mode;modalPackConfig=($('#pack-step-mods')&&!$('#pack-step-mods').hidden)?packConfig:null;availableFiles=[];
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
   availableFiles=(d.files||[]).map(v=>({id:String(v.id),displayName:v.displayName,fileName:v.fileName,gameVersions:Array.isArray(v.gameVersions)?v.gameVersions:[],loaders:Array.isArray(v.loaders)?v.loaders:[],raw:v}));
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
$('#modal-add').onclick=async()=>{const file=availableFiles.find(v=>String(v.id)===$('#modal-file').value);if(!file)return;if(modalMode==='download'){const button=$('#modal-add');button.disabled=true;button.textContent='Preparando download…';try{let url=modalProvider==='modrinth'?(file.raw?.files||[]).find(x=>x.primary)?.url||(file.raw?.files||[])[0]?.url:file.raw?.downloadUrl;if(!url&&modalProvider==='curseforge'){const r=await fetch('/api/curseforge/mod/'+encodeURIComponent(modalProject.id)+'/files/'+encodeURIComponent(file.id)+'/download-url');const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível obter o link de download.');url=d.url;}const parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('Link de download inseguro ou inválido.');const a=document.createElement('a');a.href=parsed.href;a.target='_blank';a.rel='noopener';a.download=file.raw?.filename||file.raw?.fileName||'';document.body.appendChild(a);a.click();a.remove();$('#version-modal').hidden=true;toast('Download iniciado. Confira os downloads do navegador.');}catch(e){toast(e.message||'Falha ao iniciar download.');button.disabled=false;button.textContent='Baixar mod';}return;}const chosenGameVersion=$('#modal-game-version').value||((file.game_versions||file.gameVersions||[]).find(x=>/^\d+\.\d+(\.\d+)?$/.test(x))||'');const chosenLoader=$('#modal-loader').value||((file.loaders||[]).find(x=>['fabric','forge','neoforge','quilt'].includes(String(x).toLowerCase()))||'');if(modalPackConfig&&(!chosenGameVersion||chosenGameVersion!==modalPackConfig.minecraft_version)){toast('Este arquivo não corresponde à versão Minecraft do modpack.');return}if(modalPackConfig&&modalPackConfig.loader!=='vanilla'&&chosenLoader!==modalPackConfig.loader){toast('Este arquivo não corresponde ao modloader do modpack.');return}const item={provider:modalProvider,id:String(modalProject.id),name:modalProject.title||modalProject.name,version_id:String(file.id),version_name:file.name||file.version_number||file.displayName||file.fileName,game_version:chosenGameVersion,loader:chosenLoader};if(selected.some(x=>x.provider===item.provider&&x.id===item.id&&x.version_id===item.version_id))return toast('Essa versão já foi adicionada.');selected.push(item);draw();$('#version-modal').hidden=true;drawPackSelection();toast('Versão adicionada ao modpack.')};

function add(m,provider){openVersionPicker(m,provider)}
function draw(){const el=$('#selected');if(!el)return;if(!selected.length){el.className='selected empty';el.textContent='Nenhum mod selecionado.';drawPackSelection();return}el.className='selected';el.innerHTML=selected.map((p,i)=>'<div class="selected-item"><span>'+esc(p.name)+' <small>('+p.provider+' · '+esc(p.version_name||'versão não definida')+')</small></span><button data-remove="'+i+'">Remover</button></div>').join('');document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.remove),1);draw()});drawPackSelection()}
let packConfig=null,packProvider='modrinth',packRequest=0,packCatalog=[],packPage=0,packTotal=0;
function drawPackSelection(){const b=$('#create-pack'),listButton=$('#show-pack-mods');if(b)b.disabled=!packConfig||!selected.length;if(listButton){listButton.disabled=!packConfig;listButton.textContent='Mods no modpack ('+selected.length+')';}}
$('#show-pack-mods').onclick=()=>{const panel=$('#pack-selected-panel');if(!panel)return;panel.hidden=!panel.hidden;$('#show-pack-mods').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)panel.scrollIntoView({behavior:'smooth',block:'nearest'});};
function confirmPackConfig(){const name=$('#pack-name').value.trim(),version=$('#pack-version').value.trim(),loader=$('#pack-loader').value;if(!name||!/^\d+\.\d+(\.\d+)?$/.test(version)){toast('Informe nome e versão Minecraft válidos.');return}packConfig={name,minecraft_version:version,loader};$('#pack-step-config').hidden=true;$('#pack-step-mods').hidden=false;$('#pack-summary-name').textContent=name;$('#pack-summary-game').textContent='Minecraft '+version;$('#pack-summary-loader').textContent=loader;selected=[];draw();searchPackMods('',0)}
function goBackToConfig(){$('#pack-step-config').hidden=false;$('#pack-step-mods').hidden=true}
async function searchPackMods(q='',page=0){const req=++packRequest;packPage=Math.max(0,page);const sort=$('#pack-sort').value;const p=new URLSearchParams({limit:'20',page:String(packPage),game_version:packConfig.minecraft_version,sort});if(q)p.set('query',q);if(packConfig.loader!=='vanilla')p.set('loader',packConfig.loader);$('#pack-results').innerHTML='<div class="empty">Carregando mods compatíveis…</div>';try{const r=await fetch('/api/'+packProvider+'/search?'+p),d=await r.json();if(req!==packRequest)return;if(!r.ok)throw Error(d.error||'Falha na busca');packCatalog=d.results||[];packTotal=Number(d.total)||0;if(sort==='downloads_asc'||sort==='date_asc')packCatalog.reverse();if(!packCatalog.length){$('#pack-results').innerHTML='<div class="empty">Nenhum mod encontrado.</div>';$('#pack-pagination').innerHTML='';return}$('#pack-results').innerHTML=packCatalog.map((m,i)=>'<article class="result '+(selected.some(x=>x.provider===packProvider&&x.id===String(m.id))?'selected-mod':'')+'" data-pack-open="'+i+'"><img src="'+esc(m.icon_url||m.logo||'')+'" alt=""><div><h4>'+esc(m.title||m.name)+'</h4><p>'+esc(m.description||m.summary||'')+'</p></div><div class="result-foot"><span>'+Number(m.downloads||0).toLocaleString('pt-BR')+' downloads</span><button type="button" data-pack-open="'+i+'">Escolher versão</button></div></article>').join('');document.querySelectorAll('[data-pack-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();openVersionPicker(packCatalog[Number(b.dataset.packOpen)],packProvider)});$('#pack-pagination').innerHTML='<button id="pack-prev" '+(packPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(packPage+1)+'</span><button id="pack-next" '+((packPage+1)*20>=packTotal?'disabled':'')+'>Próxima ›</button>';$('#pack-prev').onclick=()=>searchPackMods($('#pack-query').value.trim(),packPage-1);$('#pack-next').onclick=()=>searchPackMods($('#pack-query').value.trim(),packPage+1)}catch(e){if(req!==packRequest)return;$('#pack-results').innerHTML='<div class="empty">'+esc(e.message)+'</div>'}}
$('#confirm-pack').onclick=confirmPackConfig;$('#edit-pack-config').onclick=goBackToConfig;$('#pack-search-btn').onclick=()=>searchPackMods($('#pack-query').value.trim(),0);$('#pack-sort').onchange=()=>searchPackMods($('#pack-query').value.trim(),0);$('#pack-query').onkeydown=e=>{if(e.key==='Enter')searchPackMods(e.target.value.trim(),0)};document.querySelectorAll('[data-pack-provider]').forEach(b=>b.onclick=()=>{packProvider=b.dataset.packProvider;document.querySelectorAll('[data-pack-provider]').forEach(x=>{const active=x.dataset.packProvider===packProvider;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))});searchPackMods($('#pack-query').value.trim(),0)});
let createdPackForCommunity=null;
$('#publish-created-pack').onclick=()=>{
 if(!createdPackForCommunity)return toast('Crie um modpack primeiro.');
 if(!hubAccount)return toast('Entre ou crie uma conta online/offline para publicar.');
 const pack=createdPackForCommunity;
 $('#community-name').value=pack.name;
 $('#community-version').value=pack.minecraft_version;
 $('#community-description').value=pack.description||'';
 resetCommunityEditor();
 $('#community-name').value=pack.name;
 $('#community-version').value=pack.minecraft_version;
 $('#community-description').value=pack.description||'';
 $('#community-publish-card').hidden=false;
 go('community');
 $('#community-name').scrollIntoView({behavior:'smooth',block:'center'});
 toast('Modpack selecionado. Escolha uma capa e publique.');
};
$('#create-pack').onclick=async()=>{if(!packConfig||!selected.length)return;const b=$('#create-pack');b.disabled=true;$('#create-status').textContent='Resolvendo dependências e preparando o arquivo…';$('#download-pack').hidden=true;try{const r=await fetch('/api/packs/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...packConfig,projects:selected})});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Não foi possível criar o modpack')}const blob=await r.blob();const url=URL.createObjectURL(blob),link=$('#download-pack');link.href=url;link.download=packConfig.name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)+'.mrpack';link.textContent='Baixar '+link.download;link.hidden=false;createdPackForCommunity={name:packConfig.name,minecraft_version:packConfig.minecraft_version,loader:packConfig.loader,projects:selected.map(p=>({...p})),description:'Modpack '+packConfig.name+' para Minecraft '+packConfig.minecraft_version+' com '+packConfig.loader+'.'};$('#publish-created-pack').hidden=false;$('#create-status').textContent='Arquivo .mrpack pronto. Você também pode publicar os dados deste modpack na comunidade.';toast('Modpack criado!')}catch(e){$('#create-status').textContent=e.message;toast('Falha ao criar modpack')}finally{b.disabled=false}};

document.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{const provider=b.dataset.provider;if($('#provider').value===provider)return;$('#provider').value=provider;document.querySelectorAll('[data-provider]').forEach(x=>{const active=x.dataset.provider===provider;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))});search(!$('#query').value.trim(),0)});$('#search-btn').onclick=()=>search(false,0);$('#query').onkeydown=e=>{if(e.key==='Enter')search(false,0)};
document.querySelectorAll('[data-catalog-type]').forEach(button=>button.addEventListener('click',()=>{
 const type=button.dataset.catalogType;if(!['mods','resourcepacks','shaders','modpacks'].includes(type)||catalogType===type)return;
 catalogType=type;document.querySelectorAll('[data-catalog-type]').forEach(item=>{const active=item.dataset.catalogType===type;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});
 const labels={mods:'Ex.: JEI, Create, Sodium',resourcepacks:'Ex.: Faithful, Patrix',shaders:'Ex.: Complementary, BSL',modpacks:'Ex.: Create: Above and Beyond, FTB'};
 $('#query').placeholder=labels[type];const loader=$('#loader');loader.disabled=type!=='mods';$('#game-version').disabled=type==='modpacks';search(false,0);
}));$('#game-version').onchange=()=>search(!$('#query').value.trim(),0);$('#loader').onchange=()=>search(!$('#query').value.trim(),0);$('#sort-order').onchange=()=>search(!$('#query').value.trim(),0);
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
 const state=$('#account-state'),forms=$('#account-forms'),profile=$('#account-profile'),logout=$('#account-logout');
 if(hubAccount){
  state.textContent=(hubAccount.offline?'Conta offline: ':'Conectado como ')+(hubAccount.username||hubAccount.name)+(hubAccount.offline?' · salva somente neste aparelho.':'');
  forms.hidden=true;profile.hidden=false;logout.hidden=false;
  $('#account-new-name').value=hubAccount.username||hubAccount.name||'';
 }else{
  state.textContent='Você está usando a biblioteca local. Crie uma conta online ou offline.';
  forms.hidden=false;profile.hidden=true;logout.hidden=true;
 }
}
const offlineAccountKey='mikael-hub-offline-account';
async function refreshAccount(){
 try{const data=await accountRequest('/me');hubAccount=data.user;if(hubAccount)localStorage.removeItem(offlineAccountKey);else{try{hubAccount=JSON.parse(localStorage.getItem(offlineAccountKey)||'null')}catch{hubAccount=null}}renderAccount()}
 catch(error){try{hubAccount=JSON.parse(localStorage.getItem(offlineAccountKey)||'null')}catch{hubAccount=null}renderAccount();if(!hubAccount)$('#account-state').textContent=error.message}
}
async function submitAccount(mode){
 const name=$('#account-name').value.trim().toLowerCase(),password=$('#account-password').value;
 if(mode==='/register'&&!/^[a-z0-9_]{3,20}$/.test(name))return toast('Use 3 a 20 caracteres: letras sem acento, números e _. Sem espaços.');
 try{
  const data=await accountRequest(mode,{method:'POST',body:JSON.stringify({name,username:name,password})});
  hubAccount=data.user;$('#account-password').value='';renderAccount();toast(mode==='/register'?'Conta criada com sucesso.':'Login realizado.');
 }catch(error){toast(error.message)}
}
$('#account-offline').onclick=()=>{const name=$('#offline-account-name').value.trim().toLowerCase();if(name==='mikael_oficial')return toast('O nome mikael_oficial é reservado ao criador oficial.');if(!/^[a-z0-9_]{3,20}$/.test(name))return toast('Use de 3 a 20 caracteres: letras, números e _.');hubAccount={name,username:name,offline:true};localStorage.setItem(offlineAccountKey,JSON.stringify(hubAccount));renderAccount();renderCommunityAccess();toast('Conta offline criada neste aparelho.')};
$('#account-change-name').onclick=async()=>{
 const name=$('#account-new-name').value.trim().toLowerCase();
 if(!/^[a-z0-9_]{3,20}$/.test(name))return toast('Use 3 a 20 caracteres: letras, números e _.');
 if(!hubAccount)return toast('Entre na sua conta primeiro.');
 if(name===(hubAccount.username||hubAccount.name))return toast('Esse já é seu nome.');
 const button=$('#account-change-name');button.disabled=true;
 try{
  if(name==='mikael_oficial'&&(!hubAccount.offline?hubAccount.username!=='mikael_oficial':true))throw Error('Esse nome é reservado ao criador oficial.');
  if(hubAccount.offline){
   hubAccount={...hubAccount,name,username:name};
   localStorage.setItem(offlineAccountKey,JSON.stringify(hubAccount));
  }else{
   const data=await accountRequest('/profile/username',{method:'PATCH',body:JSON.stringify({username:name})});
   hubAccount=data.user;
  }
  renderAccount();renderCommunityAccess();await loadCommunity();toast('Nome alterado com sucesso.');
 }catch(error){toast(error.message)}
 finally{button.disabled=false}
};
$('#account-register').onclick=()=>submitAccount('/register');
$('#account-login').onclick=()=>submitAccount('/login');
$('#account-logout').onclick=async()=>{try{if(hubAccount?.offline)localStorage.removeItem(offlineAccountKey);else await accountRequest('/logout',{method:'POST',body:'{}'});hubAccount=null;renderAccount();renderCommunityAccess();toast('Sessão encerrada.')}catch(error){toast(error.message)}};
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
 const creator=Boolean(logged&&!hubAccount.offline&&String(hubAccount.username||'').toLowerCase()==='mikael_oficial');
 $('#community-account-required').hidden=logged;
 $('#community-publish-card').hidden=!logged;
 const hint=$('#community-publish-card')?.querySelector('b');
 if(hint)hint.textContent='Publicar na comunidade pública';
 const officialHint=$('#community-publish-card')?.querySelector('.official-publish-note');
 if(officialHint)officialHint.hidden=!creator;
}
let communityEditingId=null,communityEditingToken=null;
const communityOfflineTokensKey='mikael-community-edit-tokens';
function communityOfflineTokens(){try{return JSON.parse(localStorage.getItem(communityOfflineTokensKey)||'{}')}catch{return {}}}
function newCommunityToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function resetCommunityEditor(){communityEditingId=null;communityEditingToken=null;$('#community-form').reset();if($('#community-is-official'))$('#community-is-official').checked=false;const preview=$('#community-preview');preview.innerHTML='';delete preview.dataset.image;$('#community-submit').textContent='Publicar na comunidade';const cancel=$('#community-cancel-edit');if(cancel)cancel.hidden=true}
async function loadCommunity(){
 const host=$('#community-list'),officialHost=$('#official-community-list');if(!host||!officialHost)return;
 host.innerHTML='<div class="empty">Carregando publicações…</div>';officialHost.innerHTML='<div class="empty">Carregando modpacks oficiais…</div>';
 try{
  const response=await fetch('/api/auth/community/packs',{credentials:'same-origin'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Falha ao carregar comunidade.');
  const packs=Array.isArray(data.packs)?data.packs:[],official=packs.filter(p=>p.is_official),publicPacks=packs.filter(p=>!p.is_official);
  const tokens=communityOfflineTokens(),isCreator=Boolean(hubAccount&&!hubAccount.offline&&String(hubAccount.username||'').toLowerCase()==='mikael_oficial');
  const card=p=>{const canEdit=p.is_official?isCreator:Boolean((hubAccount&&!hubAccount.offline&&String(hubAccount.id)===String(p.user_id))||(p.offline&&tokens[p.id]));const canDelete=canEdit||isCreator;return '<article class="community-pack"><img src="'+esc(p.image)+'" alt="Capa do modpack '+esc(p.name)+'" loading="lazy"><div class="community-pack-info"><h3>'+esc(p.name)+(p.is_official?' <span class="creator-mark">✦ OFICIAL</span>':'')+'</h3><p>Minecraft '+esc(p.minecraft_version)+'</p><p>'+esc(p.description||'Sem descrição.')+'</p><small>Publicado por '+esc(p.author)+(p.offline?' <span class="offline-mark">◌ OFFLINE</span>':'')+' · '+esc(new Date(p.created_at).toLocaleDateString('pt-BR'))+'</small>'+(canEdit?'<button type="button" class="secondary community-edit" data-id="'+esc(p.id)+'">Editar modpack</button>':'')+(canDelete?'<button type="button" class="secondary community-delete" data-id="'+esc(p.id)+'">Excluir modpack</button>':'')+'</div></article>'};
  officialHost.innerHTML=official.length?official.map(card).join(''):'<div class="empty">Ainda não há modpacks oficiais publicados.</div>';
  host.innerHTML=publicPacks.length?publicPacks.map(card).join(''):'<div class="empty">Ainda não há publicações públicas. Seja o primeiro a compartilhar!</div>';
 }catch(error){host.innerHTML='<div class="empty">'+esc(error.message)+'</div>';officialHost.innerHTML='<div class="empty">'+esc(error.message)+'</div>'}
}
$('#community-list').addEventListener('click',async event=>{
 const button=event.target.closest('.community-delete');if(!button)return;
 const id=button.dataset.id;
 if(!hubAccount||!confirm('Tem certeza que deseja excluir este modpack da comunidade? Esta ação não pode ser desfeita.'))return;
 button.disabled=true;
 try{
  const response=await fetch('/api/auth/community/packs/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Não foi possível excluir o modpack.');
  await loadCommunity();toast('Modpack excluído da comunidade.');
 }catch(error){button.disabled=false;toast(error.message)}
});
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
 event.preventDefault();if(!hubAccount)return toast('Crie uma conta online ou offline antes de publicar.');
 if(communityBusy)return;
 const button=$('#community-submit'),preview=$('#community-preview');
 const name=$('#community-name').value.trim(),version=$('#community-version').value.trim(),description=$('#community-description').value.trim();
 if(name.length<3||!/^\d+\.\d+(\.\d+)?$/.test(version))return toast('Confira o nome e a versão do Minecraft.');
 let image=preview.dataset.image;
 if(!image&&communityImage.files?.[0]){try{image=await compressCommunityImage(communityImage.files[0]);preview.dataset.image=image;preview.innerHTML='<img src="'+image+'" alt="Prévia da capa selecionada">'}catch(error){return toast(error.message)}}
 if(!image)return toast('Selecione uma foto de capa.');
 const wasEditing=Boolean(communityEditingId);
 const offlineToken=(!wasEditing&&hubAccount?.offline)?newCommunityToken():null;
 communityBusy=true;button.disabled=true;button.textContent=wasEditing?'Salvando…':'Publicando…';
 try{
  const body={name,minecraft_version:version,description,image,is_official:Boolean(!wasEditing&&$('#community-is-official')?.checked),...(wasEditing?(communityEditingToken?{offline_edit_token:communityEditingToken}:{}):hubAccount?.offline?{offline:true,offline_username:hubAccount.username||hubAccount.name,offline_edit_token:offlineToken}:{})};
  const endpoint='/api/auth/community/packs'+(wasEditing?'/'+encodeURIComponent(communityEditingId):'');
  const response=await fetch(endpoint,{method:wasEditing?'PATCH':'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||(wasEditing?'Falha ao atualizar.':'Falha ao publicar.'));
  if(!wasEditing&&offlineToken){const tokens=communityOfflineTokens();tokens[data.pack.id]=offlineToken;localStorage.setItem(communityOfflineTokensKey,JSON.stringify(tokens))}
  resetCommunityEditor();toast(wasEditing?'Modpack atualizado!':'Modpack publicado na comunidade!');await loadCommunity();
 }catch(error){toast(error.message)}
 finally{communityBusy=false;button.disabled=false;button.textContent=communityEditingId?'Salvar alterações':'Publicar na comunidade'}
});
$('#community-list').addEventListener('click',event=>{const button=event.target.closest('.community-edit');if(!button)return;const id=button.dataset.id;fetch('/api/auth/community/packs',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{const pack=(data.packs||[]).find(x=>String(x.id)===String(id));if(!pack)return toast('Publicação não encontrada.');communityEditingId=String(id);communityEditingToken=communityOfflineTokens()[id]||null;$('#community-name').value=pack.name;$('#community-version').value=pack.minecraft_version;$('#community-description').value=pack.description||'';const preview=$('#community-preview');preview.dataset.image=pack.image;preview.innerHTML='<img src="'+esc(pack.image)+'" alt="Capa atual">';$('#community-submit').textContent='Salvar alterações';const cancel=$('#community-cancel-edit');if(cancel)cancel.hidden=false;$('#community-publish-card').hidden=false;$('#community-name').scrollIntoView({behavior:'smooth',block:'center'})}).catch(()=>toast('Não foi possível abrir a publicação.'))});
$('#community-cancel-edit')?.addEventListener('click',resetCommunityEditor);
$('#community-refresh').onclick=loadCommunity;
const previousGoForCommunity=go;
go=function(id){previousGoForCommunity(id);if(id==='community'){renderCommunityAccess();if(!communityLoaded){communityLoaded=true;loadCommunity()}}};
const previousRenderAccount=renderAccount;
renderAccount=function(){previousRenderAccount();renderCommunityAccess()};

 
// Análise de crash: processamento local de TXT, LOG e PDF.
let crashPdfPromise=null,crashReportText='';
const crashFiles=$('#crash-files');
if(crashFiles)crashFiles.addEventListener('change',()=>{
 const files=[...(crashFiles.files||[])];
 $('#crash-file-list').textContent=files.length?files.map(f=>f.name+' ('+(f.size/1024/1024).toFixed(2)+' MB)').join(' · '):'Nenhum arquivo selecionado.';
});
function loadPdfEngine(){
 if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
 if(crashPdfPromise)return crashPdfPromise;
 crashPdfPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload=()=>{if(!window.pdfjsLib)return reject(Error('Biblioteca de leitura de PDF indisponível.'));window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';resolve(window.pdfjsLib)};
  script.onerror=()=>reject(Error('Não foi possível carregar o leitor de PDF. Confira sua conexão e tente novamente.'));
  document.head.appendChild(script);
 });
 return crashPdfPromise;
}
async function extractCrashFile(file){
 const ext=file.name.toLowerCase().split('.').pop();
 if(!['txt','log','pdf'].includes(ext))throw Error(file.name+': formato não aceito.');
 if(file.size>20*1024*1024)throw Error(file.name+': arquivo maior que 20 MB.');
 if(ext!=='pdf'){
  const text=await file.text();
  if(text.length>2*1024*1024)throw Error(file.name+': texto excede 2 MB.');
  return text;
 }
 const pdfjs=await loadPdfEngine(),buffer=await file.arrayBuffer(),pdf=await pdfjs.getDocument({data:buffer}).promise;
 if(pdf.numPages>100)throw Error(file.name+': PDF com mais de 100 páginas.');
 let out='';
 for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const page=await pdf.getPage(pageNo),content=await page.getTextContent();
  out+='\n--- Página '+pageNo+' ---\n'+content.items.map(item=>item.str||'').join(' ')+'\n';
  if(out.length>2*1024*1024)throw Error(file.name+': texto extraído excede 2 MB.');
 }
 if(!out.trim())throw Error(file.name+': não foi possível extrair texto. O PDF pode ser digitalizado como imagem.');
 return out;
}
function diagnoseCrash(text){
 const source=String(text||'').replace(/\u0000/g,'').replace(/\r/g,'');
 const lines=source.split('\n');
 const rules=[
  {id:'oom',name:'Memória insuficiente (RAM/Heap)',level:'critical',re:/OutOfMemoryError|Java heap space|GC overhead limit exceeded|Could not reserve enough space|Failed to allocate memory|unable to create native thread/i,why:'A JVM ou o processo nativo ficou sem memória disponível.',fix:'Reduza a quantidade de mods e a distância de renderização. Feche apps em segundo plano e confira se a RAM reservada não excede a memória disponível. Se for erro de memória nativa, reduzir a RAM do jogo pode ajudar.',relevance:10},
  {id:'missing-class',name:'Classe ou dependência ausente',level:'critical',re:/NoClassDefFoundError|ClassNotFoundException|NoSuchMethodError|NoSuchFieldError/i,why:'Um mod tentou usar uma classe, método ou campo que não existe na instalação atual.',fix:'Leia a primeira linha “Caused by” e identifique o mod que chamou a classe. Instale a dependência correta ou alinhe as versões dos mods.',relevance:10},
  {id:'mod-loading',name:'Falha durante carregamento de mod',level:'critical',re:/ModLoadingException|Failed to load mod|Errors during loading|Failed to construct mod|Mod .* encountered an error/i,why:'O loader não conseguiu inicializar um ou mais mods.',fix:'Abra o bloco “Failure message” ou “Mod File” no relatório e verifique o mod indicado. Confira a versão do Minecraft, loader e dependências.',relevance:9},
  {id:'mixin',name:'Falha de Mixin / incompatibilidade de mod',level:'critical',re:/Mixin apply failed|MixinTransformerError|InvalidMixinException|MixinApplyError|Critical injection failure|InjectionError/i,why:'Um Mixin não conseguiu modificar uma classe, frequentemente por incompatibilidade entre mods ou versões.',fix:'Procure no trecho o nome do mixin e o mod de origem. Atualize ou remova temporariamente o mod conflitante e confira dependências.',relevance:10},
  {id:'duplicate',name:'Mods duplicados',level:'error',re:/DuplicateModsFoundException|duplicate mods found|Mod ID .* is duplicated|Duplicate mod/i,why:'Existem dois arquivos de mod registrando o mesmo identificador.',fix:'Remova a cópia duplicada da pasta mods e mantenha apenas uma versão compatível.',relevance:9},
  {id:'version',name:'Versão incompatível de Minecraft, loader ou Java',level:'error',re:/UnsupportedClassVersionError|Unsupported Java|requires Minecraft|incompatible.*version|wrong version|only supports.*Minecraft|Java Runtime Environment.*class file version/i,why:'Um componente foi compilado para outra versão de Java, Minecraft ou modloader.',fix:'Confira a versão exigida pelo mod. Minecraft 1.12.2 normalmente usa Java 8; versões mais novas podem exigir Java 17 ou 21, conforme a versão do jogo.',relevance:9},
  {id:'java-crash',name:'Exceção interna do Java',level:'error',re:/VerifyError|ExceptionInInitializerError|LinkageError|IllegalAccessError|IncompatibleClassChangeError/i,why:'A JVM encontrou incompatibilidade binária ou falha durante a inicialização de uma classe.',fix:'Verifique a causa mais profunda em “Caused by”. Pode indicar mod incompatível, biblioteca incorreta ou Java inadequado.',relevance:8},
  {id:'graphics',name:'Falha gráfica / OpenGL / renderizador',level:'error',re:/OpenGL error|GL_INVALID_|GL_OUT_OF_MEMORY|Failed to create.*context|Could not create.*(context|window)|Pixel format not accelerated|No OpenGL context|Renderer .*failed|shader.*compile|GLFW error/i,why:'A inicialização gráfica falhou ou o driver/renderizador não oferece o recurso solicitado.',fix:'Desative shaders e pacotes gráficos. No Android, teste um renderizador compatível com o aparelho e reduza resolução e efeitos.',relevance:9},
  {id:'native',name:'Falha de biblioteca nativa',level:'critical',re:/UnsatisfiedLinkError|SIGSEGV|SIGABRT|EXCEPTION_ACCESS_VIOLATION|A fatal error has been detected by the Java Runtime Environment/i,why:'Uma biblioteca nativa ou componente de baixo nível falhou.',fix:'Confira arquitetura (ARM/ARM64/x86), bibliotecas nativas, Java e renderizador. Se houver “Problematic frame”, ele pode indicar o componente envolvido.',relevance:9},
  {id:'file',name:'Arquivo ausente, bloqueado ou corrompido',level:'warning',re:/AccessDeniedException|Permission denied|FileNotFoundException|NoSuchFileException|ZipException|zip END header not found|Invalid or corrupt jarfile/i,why:'O jogo não conseguiu ler um arquivo, ou um JAR/ZIP pode estar incompleto ou corrompido.',fix:'Verifique o caminho e as permissões. Baixe novamente o arquivo afetado e confira se o mod corresponde ao loader e à versão do jogo.',relevance:8},
  {id:'stack',name:'Estouro de pilha (StackOverflow)',level:'error',re:/StackOverflowError/i,why:'Uma chamada recursiva ou ciclo de chamadas excedeu o limite da pilha.',fix:'Procure o primeiro mod repetido no stack trace. Pode ser conflito ou bug em mod; teste versões compatíveis e isole o mod suspeito.',relevance:8},
  {id:'fabric',name:'Falha de carregamento Fabric',level:'error',re:/net\.fabricmc\.loader|FabricLoader|EntrypointException|ModResolutionException/i,why:'O Fabric Loader encontrou falha ao resolver dependências ou iniciar um entrypoint.',fix:'Confira a mensagem de resolução, a versão do Fabric Loader e dependências como Fabric API. Não misture mods de Forge com Fabric.',relevance:8},
  {id:'forge',name:'Falha do Forge / FML',level:'error',re:/net\.minecraftforge\.fml|FMLCommonHandler|LoadingFailedException|Forge Mod Loader has found a problem|The following mods.*failed/i,why:'O Forge/FML registrou um problema no carregamento ou na inicialização.',fix:'Use o bloco de erro do Forge para localizar o mod e a dependência. Confirme que todos os arquivos são para a mesma versão do Forge.',relevance:8},
  {id:'connection',name:'Falha de rede ou download',level:'warning',re:/UnknownHostException|Connection timed out|ConnectException|Failed to download|SSLHandshakeException/i,why:'O launcher ou jogo não conseguiu obter um recurso remoto.',fix:'Confira a conexão, data/hora do aparelho e disponibilidade do servidor de download. Tente novamente mais tarde.',relevance:5}
 ];
 const findings=[];
 for(const rule of rules){
  const matches=[];
  for(let i=0;i<lines.length;i++)if(rule.re.test(lines[i]))matches.push(i);
  if(matches.length){
   const idx=matches[0],from=Math.max(0,idx-2),to=Math.min(lines.length,idx+3);
   findings.push({...rule,count:matches.length,firstLine:idx+1,snippet:lines.slice(from,to).join('\n').slice(0,900)});
  }
 }
 const causeLines=[];
 for(let i=0;i<lines.length;i++)if(/^\s*(Caused by:|Suppressed:|Failure message:|Description:|Exception in thread|---- Minecraft Crash Report)/i.test(lines[i]))causeLines.push({line:i+1,text:lines.slice(i,Math.min(lines.length,i+5)).join('\n').slice(0,900)});
 const metadata={};
 const patterns=[
  ['Minecraft',/(?:Minecraft Version|minecraft_version|game version)[:=]\s*([^\s,]+)/i],
  ['Forge',/(?:Forge Version|forge version|MinecraftForge)[^\n:]*[:=]\s*([0-9][^\s,]+)/i],
  ['Fabric',/(?:Fabric Loader|fabric-loader)[^\n:]*[:= ]\s*([0-9][^\s,]+)/i],
  ['Java',/(?:Java Version|java version|java\.version)[:= ]\s*([^\n,]+)/i],
  ['Sistema',/(?:Operating System|os\.name)[:= ]\s*([^\n,]+)/i],
  ['Memória',/(?:Memory|Mem:)[^\n]*?([0-9.]+\s*(?:MB|MiB|GB|GiB))/i]
 ];
 for(const [label,re] of patterns){const m=source.match(re);if(m)metadata[label]=m[1].trim().slice(0,100)}
 const modCandidates=new Map();
 const modPatterns=[
  /Mod File:\s*([^,\n]+)/ig,
  /Failure message:\s*([^:\n]+):/ig,
  /Suspected Mods?:\s*([^\n]+)/ig,
  /(?:^|\n)\s*-\s*([A-Za-z0-9_.-]+)\s*\[[^\]\n]*\]/g
 ];
 for(const re of modPatterns){let m;while((m=re.exec(source))!==null){const value=(m[1]||'').trim().replace(/^.*[\\/]/,'').replace(/\.(jar|zip)$/i,'');if(value&&value.length<100&&!/^(unknown|minecraft|java)$/i.test(value))modCandidates.set(value,(modCandidates.get(value)||0)+1)}}
 const mods=[...modCandidates.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,count])=>({name,count}));
 const fatal=lines.findIndex(line=>/---- Minecraft Crash Report|A detailed walkthrough|Description:.*(crash|exception)|The game crashed/i.test(line));
 const relevantLines=lines.map((line,i)=>({line,i})).filter(x=>/^\s*(at |Caused by:|Suppressed:)|Exception|Error|FATAL|CRITICAL|Failure message:|Mod File:|Suspected Mods?/i.test(x.line)).slice(0,35);
 findings.sort((a,b)=>b.relevance-a.relevance);
 const rootCause=causeLines.length?causeLines[causeLines.length-1]:null;
 return {findings,causeLines,rootCause,metadata,mods,important:relevantLines.map(x=>x.line),fatalLine:fatal>=0?fatal+1:null,lineCount:lines.length,characterCount:source.length};
}
$('#crash-analyze').onclick=async()=>{
 const files=[...(crashFiles.files||[])],button=$('#crash-analyze'),report=$('#crash-report'),content=$('#crash-report-content');
 if(!files.length)return toast('Selecione pelo menos um arquivo TXT, LOG ou PDF.');
 if(files.length>3)return toast('Selecione no máximo 3 arquivos por análise.');
 if(files.some(f=>f.size===0))return toast('Um dos arquivos está vazio.');
 button.disabled=true;button.textContent='Lendo e analisando…';report.hidden=false;content.innerHTML='<p class="hint">Analisando a sequência dos erros…</p>';
 try{
  const results=[];
  for(const file of files){const text=await extractCrashFile(file);results.push({name:file.name,...diagnoseCrash(text)})}
  const total=results.reduce((n,r)=>n+r.findings.length,0);
  let output='ANÁLISE AVANÇADA DE CRASH — MODPACK HUB\nArquivos: '+results.length+'\n\n';
  for(const r of results){
   output+='ARQUIVO: '+r.name+'\nLinhas: '+r.lineCount+'\n';
   if(Object.keys(r.metadata).length)output+='AMBIENTE: '+Object.entries(r.metadata).map(([k,v])=>k+': '+v).join(' | ')+'\n';
   if(r.rootCause)output+='CAUSA MAIS PROFUNDA ENCONTRADA (verifique o contexto):\n'+r.rootCause.text+'\n';
   if(r.findings.length){
    output+='POSSÍVEIS PROBLEMAS:\n';
    for(const item of r.findings)output+='['+item.level.toUpperCase()+'] '+item.name+' ('+item.count+' ocorrência(s), linha '+item.firstLine+')\n'+item.why+'\nAção sugerida: '+item.fix+'\nTrecho: '+item.snippet+'\n\n';
   }else output+='Nenhum padrão conhecido foi identificado. Isso não significa que o log esteja livre de erros.\n';
   if(r.mods.length)output+='MODS/ARQUIVOS CITADOS: '+r.mods.map(m=>m.name+(m.count>1?' ('+m.count+'x)':'')).join(', ')+'\n';
   if(r.important.length)output+='LINHAS IMPORTANTES:\n'+r.important.map(x=>'• '+x.slice(0,450)).join('\n')+'\n';
   output+='\n';
  }
  output+='LIMITAÇÃO: diagnóstico heurístico. A causa mais profunda nem sempre é a causa original; compare os arquivos e o stack trace completo antes de alterar o modpack.';
  crashReportText=output;
  content.innerHTML=results.map(r=>{
   const meta=Object.entries(r.metadata).map(([k,v])=>'<span class="crash-chip">'+esc(k)+': '+esc(v)+'</span>').join('');
   const cause=r.rootCause?'<div class="crash-root"><b>Possível causa raiz</b><pre>'+esc(r.rootCause.text)+'</pre></div>':'';
   const findings=r.findings.length?r.findings.map(x=>'<div class="crash-finding"><div class="crash-finding-head"><b>'+esc(x.name)+'</b><span class="crash-severity '+esc(x.level)+'">'+esc(x.level==='critical'?'Crítico':x.level==='error'?'Erro':x.level==='warning'?'Atenção':'Info')+'</span></div><p>'+esc(x.why)+'</p><small>'+esc(x.fix)+'</small><details><summary>Ver evidência · linha '+x.firstLine+' · '+x.count+' ocorrência(s)</summary><pre>'+esc(x.snippet)+'</pre></details></div>').join(''):'<p class="hint">Nenhum padrão conhecido identificado. Confira manualmente as últimas linhas do log.</p>';
   const mods=r.mods.length?'<div class="crash-mods"><b>Mods/arquivos citados</b><p>'+r.mods.map(m=>esc(m.name)).join(' · ')+'</p><small>São referências encontradas no texto, não uma confirmação de culpa.</small></div>':'';
   const important=r.important.length?'<details><summary>Ver stack trace e mensagens importantes</summary><pre>'+esc(r.important.join('\n'))+'</pre></details>':'';
   return '<article class="crash-result"><h3>'+esc(r.name)+'</h3><p>'+r.lineCount+' linhas · '+r.characterCount.toLocaleString('pt-BR')+' caracteres</p>'+(meta?'<div class="crash-meta">'+meta+'</div>':'')+cause+findings+mods+important+'</article>';
  }).join('')+'<p class="hint">A análise identifica padrões e evidências. Ela não executa os mods nem garante determinar sozinha o culpado.</p>';
  toast(total?total+' categoria(s) de problema encontradas.':'Análise concluída.');
 }catch(error){content.innerHTML='<p class="hint">'+esc(error.message)+'</p>';crashReportText='Falha na análise: '+error.message;toast(error.message)}
 finally{button.disabled=false;button.textContent='Analisar arquivos'}
};
$('#crash-copy').onclick=async()=>{if(!crashReportText)return toast('Nenhum relatório disponível.');try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(crashReportText);else{const area=document.createElement('textarea');area.value=crashReportText;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}toast('Relatório copiado.')}catch{toast('Não foi possível copiar automaticamente.')}};
