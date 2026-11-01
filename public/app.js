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
  if(requestId!==searchRequest)return;
  if(!r.ok)throw Error(d.error||'Falha na busca');
  results=d.results||[];
  if(!results.length){
   currentPage=previousPage;
   $('#results').innerHTML='<div class="empty">Não há mais resultados. Você chegou ao fim dos resultados disponíveis deste catálogo.</div>';
   renderPagination();return;
  }
  $('#results').innerHTML=results.map((m,i)=>'<article class="result"><img src="'+esc(m.icon_url||m.logo||'')+'" alt=""><div><h4>'+esc(m.title||m.name)+'</h4><p>'+esc(m.description||m.summary||'')+'</p></div><div class="result-foot"><span>'+Number(m.downloads||0).toLocaleString('pt-BR')+' downloads</span><button data-add="'+i+'">Adicionar +</button></div></article>').join('');
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>add(results[Number(b.dataset.add)],provider));
  renderPagination();
 }catch(e){
  if(requestId!==searchRequest)return;
  currentPage=previousPage;
  $('#results').innerHTML='<div class="empty">'+esc(e.message)+'</div>';
  renderPagination();
 }
}
function renderPagination(){
 const el=$('#pagination');if(!el)return;
 el.innerHTML='<button id="page-prev" '+(currentPage===0?'disabled':'')+'>‹ Anterior</button><span>Página '+(currentPage+1)+'</span><button id="page-next">Próxima ›</button>';
 $('#page-prev').onclick=()=>search(false,currentPage-1);
 $('#page-next').onclick=()=>search(false,currentPage+1);
}
function add(m,provider){const p={provider,id:String(m.id),name:m.title||m.name};if(selected.some(x=>x.provider===p.provider&&x.id===p.id))return toast('Já está na lista.');selected.push(p);draw();toast('Projeto adicionado.')}
function draw(){const el=$('#selected');if(!selected.length){el.className='selected empty';el.textContent='Nenhum projeto selecionado.';return}el.className='selected';el.innerHTML=selected.map((p,i)=>'<div class="selected-item"><span>'+esc(p.name)+' <small>('+p.provider+')</small></span><button data-remove="'+i+'">Remover</button></div>').join('');document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.remove),1);draw()})}
document.querySelectorAll('[data-provider]').forEach(b=>b.onclick=()=>{const provider=b.dataset.provider;if($('#provider').value===provider)return;$('#provider').value=provider;document.querySelectorAll('[data-provider]').forEach(x=>{const active=x.dataset.provider===provider;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active))});search(!$('#query').value.trim(),0)});$('#search-btn').onclick=()=>search(false,0);$('#query').onkeydown=e=>{if(e.key==='Enter')search(false,0)};$('#game-version').onchange=()=>search(!$('#query').value.trim(),0);$('#loader').onchange=()=>search(!$('#query').value.trim(),0);
$('#validate').onclick=async()=>{const body={name:$('#pack-name').value.trim(),minecraft_version:$('#pack-version').value.trim(),loader:$('#pack-loader').value.toLowerCase(),projects:selected};try{const r=await fetch('/api/packs/validate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();$('#manifest').hidden=false;$('#manifest').textContent=JSON.stringify(d,null,2);toast(d.valid?'Manifesto válido.':'Revise os dados.')}catch{toast('Falha ao validar.')}};
status();