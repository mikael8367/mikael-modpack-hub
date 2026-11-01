const $=s=>document.querySelector(s);let selected=[],results=[],currentPage=0,searchRequest=0;const PAGE_SIZE=20;
function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
let popularLoaded=false;function go(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='search'&&!popularLoaded){popularLoaded=true;search(true)}}
document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>go(x.dataset.tab));document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function status(){try{const d=await(await fetch('/health')).json();$('#status').textContent=d.ok?'API online':'Indisponível';$('#mr-state').textContent='API pública disponível';$('#cf-state').textContent=d.providers.curseforge?'Chave configurada':'Chave não configurada';$('#settings-cf').textContent=d.providers.curseforge?'Configurado no servidor':'Adicione CURSEFORGE_API_KEY no Render';}catch{$('#status').textContent='Sem conexão'}}
async function search(popular=false,page=0){
 const requestId=++searchRequest,previousPage=currentPage;currentPage=Math.max(0,page);
 const q=$('#query').value.trim(),provider=$('#provider').value,p=new URLSearchParams({limit:String(PAGE_SIZE),page:String(currentPage)});
 if(q)p.set('query',q);else popular=true;
 if($('#game-version').value.trim())p.set('game_version',$('#game-version').value.trim());
 if($('#loader').value)p.set('loader',$('#loader').value);
 $('#results').innerHTML='<div class="empty">'+(popular?'Carregando mods populares…':'Pesquisando…')+'</div>';
 try{
  const r=await fetch('/api/'+provider+'/search?'+p),d=await r.json();
  if(requestId!==searchRequest)return;if(!r.ok)throw Error(d.error||'Falha na busca');
  results=d.results||[];
  if(!results.length){currentPage=previousPage;$('#results').innerHTML='<div class="empty">Não há mais resultados. Você chegou ao fim dos resultados disponíveis deste catálogo.</div>';renderPagination();return}
  $('#results').innerHTML=results.map((m,i)=>'<article class="result" data-open="'+i+'" role="button" tabindex="0"><img src="'+esc(m.icon_url||m.logo||'')+'" alt=""><div><h4>'+esc(m.title||m.name)+'</h4><p>'+esc(m.description||m.summary||'')+'</p></div><div class="result-foot"><span>'+Number(m.downloads||0).toLocaleString('pt-BR')+' downloads</span><button data-open="'+i+'" type="button">Escolher versão</button></div></article>').join('');
  document.querySelectorAll('[data-open]').forEach(b=>{const open=()=>openVersionPicker(results[Number(b.dataset.open)],provider);b.onclick=e=>{e.stopPropagation();open()};if(b.tagName==='ARTICLE')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  renderPagination();
 }catch(e){if(requestId!==searchRequest)return;currentPage=previousPage;$('#results').innerHTML='<div class="empty">'+esc(e.message)+'</div>';renderPagination()}
}
function renderPagination(){const el=$('#pagination');if(!el)return;el.innerHTML='<button id="page-prev" '+(currentPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(currentPage+1)+'</span><button id="page-next">Próxima ›</button>';$('#page-prev').onclick=()=>search(false,currentPage-1);$('#page-next').onclick=()=>search(false,currentPage+1)}
let modalProject=null,modalProvider=null,availableFiles=[];
function fillOptions(select,values,firstLabel){select.innerHTML='<option value="">'+firstLabel+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')}
function refreshFileOptions(){
 const gv=$('#modal-game-version').value,loader=$('#modal-loader').value;
 const list=availableFiles.filter(v=>(!gv||(v.game_versions||v.gameVersions||[]).includes(gv))&&(!loader||(v.loaders||v.gameVersions||[]).some(x=>String(x).toLowerCase()===loader.toLowerCase())));
 $('#modal-file').innerHTML='<option value="">Selecione uma versão</option>'+list.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name||v.version_number||v.displayName||v.fileName||v.id)+'</option>').join('');
 $('#modal-add').disabled=list.length===0;
 $('#modal-hint').textContent=list.length?list.length+' versão(ões) compatível(is) encontrada(s).': 'Nenhuma versão encontrada com esses filtros.';
}
async function openVersionPicker(project,provider){
 modalProject=project;modalProvider=provider;availableFiles=[];
 $('#version-project').textContent=project.title||project.name;
 $('#version-modal').hidden=false;$('#modal-add').disabled=true;$('#modal-hint').textContent='Carregando versões disponíveis…';
 fillOptions($('#modal-game-version'),[],'Todas as versões');fillOptions($('#modal-loader'),[],'Todos os loaders');fillOptions($('#modal-file'),[],'Carregando…');
 try{
  let r,d;
  if(provider==='modrinth'){
   r=await fetch('/api/modrinth/project/'+encodeURIComponent(project.id)+'/versions');d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar versões');
   availableFiles=(d.versions||[]).map(v=>({id:v.id,name:(v.name||v.version_number)+' · '+(v.version_type||'release'),version_number:v.version_number,game_versions:v.game_versions||[],loaders:v.loaders||[],raw:v}));
  }else{
   r=await fetch('/api/curseforge/mod/'+encodeURIComponent(project.id)+'/files?limit=50');d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao carregar versões');
   availableFiles=(d.files||[]).map(v=>({id:String(v.id),displayName:v.displayName,fileName:v.fileName,gameVersions:v.gameVersions||[],raw:v}));
  }
  const versions=[...new Set(availableFiles.flatMap(v=>v.game_versions||v.gameVersions||[]).filter(x=>/^\d+\.\d+(\.\d+)?$/.test(x)))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  const loaders=[...new Set(availableFiles.flatMap(v=>v.loaders||v.gameVersions||[]).filter(x=>['fabric','forge','neoforge','quilt','liteloader','rift'].includes(String(x).toLowerCase())).map(x=>String(x).toLowerCase()))].sort();
  fillOptions($('#modal-game-version'),versions,'Todas as versões');fillOptions($('#modal-loader'),loaders,'Todos os loaders');refreshFileOptions();
  if(!availableFiles.length)$('#modal-hint').textContent='Nenhuma versão foi encontrada para este projeto.';
 }catch(e){$('#modal-hint').textContent=e.message;$('#modal-file').innerHTML='<option value="">Indisponível</option>'}
}
$('#modal-game-version').onchange=refreshFileOptions;$('#modal-loader').onchange=refreshFileOptions;
$('#modal-close').onclick=()=>$('#version-modal').hidden=true;
$('#version-modal').onclick=e=>{if(e.target===$('#version-modal'))$('#version-modal').hidden=true};
$('#modal-add').onclick=()=>{const file=availableFiles.find(v=>String(v.id)===$('#modal-file').value);if(!file)return;const item={provider:modalProvider,id:String(modalProject.id),name:modalProject.title||modalProject.name,version_id:String(file.id),version_name:file.name||file.version_number||file.displayName||file.fileName,game_version:$('#modal-game-version').value||((file.game_versions||file.gameVersions||[]).find(x=>/^\d+\.\d+(\.\d+)?$/.test(x))||''),loader:$('#modal-loader').value||((file.loaders||file.gameVersions||[]).find(x=>['fabric','forge','neoforge','quilt'].includes(String(x).toLowerCase()))||'')};if(selected.some(x=>x.provider===item.provider&&x.id===item.id&&x.version_id===item.version_id))return toast('Essa versão já foi adicionada.');selected.push(item);draw();$('#version-modal').hidden=true;toast('Versão adicionada ao modpack.')};

function add(m,provider){openVersionPicker(m,provider)}
function draw(){const el=$('#selected');if(!selected.length){el.className='selected empty';el.textContent='Nenhum projeto selecionado.';return}el.className='selected';el.innerHTML=selected.map((p,i)=>'<div class="selected-item"><span>'+esc(p.name)+' <small>('+p.provider+' · '+esc(p.version_name||'versão não definida')+')</small></span><button data-remove="'+i+'">Remover</button></div>').join('');document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.remove),1);draw()})}
document.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{const provider=b.dataset.provider;if($('#provider').value===provider)return;$('#provider').value=provider;document.querySelectorAll('[data-provider]').forEach(x=>{const active=x.dataset.provider===provider;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))});search(!$('#query').value.trim(),0)});$('#search-btn').onclick=()=>search(false,0);$('#query').onkeydown=e=>{if(e.key==='Enter')search(false,0)};$('#game-version').onchange=()=>search(!$('#query').value.trim(),0);$('#loader').onchange=()=>search(!$('#query').value.trim(),0);
$('#validate').onclick=async()=>{const body={name:$('#pack-name').value.trim(),minecraft_version:$('#pack-version').value.trim(),loader:$('#pack-loader').value.toLowerCase(),projects:selected};try{const r=await fetch('/api/packs/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();$('#manifest').hidden=false;$('#manifest').textContent=JSON.stringify(d,null,2);toast(d.valid?'Manifesto válido.':'Revise os dados.')}catch{toast('Falha ao validar.')}};
status();