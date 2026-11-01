import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import archiver from 'archiver';

const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60000, limit: 90, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(root, 'public')));

const clean = (v,n=120) => typeof v === 'string' ? v.trim().slice(0,n) : '';
const limit = (v,d=20) => Math.max(1,Math.min(50,Number.parseInt(v,10)||d));
async function getJson(url, headers={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url,{headers,signal:controller.signal,redirect:'error'});
    if (!r.ok) throw Object.assign(new Error('Provider HTTP '+r.status),{status:r.status});
    return await r.json();
  } finally { clearTimeout(timer); }
}
const cfHeaders = () => process.env.CURSEFORGE_API_KEY ? {'x-api-key':process.env.CURSEFORGE_API_KEY,'Accept':'application/json'} : null;
const mrHeaders = {'User-Agent':'MikaelModpackHub/1.0 (modpack discovery)','Accept':'application/json'};

app.get('/health',(_req,res)=>res.json({ok:true,service:'mikael-modpack-hub',providers:{modrinth:true,curseforge:Boolean(process.env.CURSEFORGE_API_KEY)},auth:Boolean(process.env.HUB_API_TOKEN)}));
app.get('/api/providers',(_req,res)=>res.json({modrinth:{available:true,authentication:'public'},curseforge:{available:Boolean(process.env.CURSEFORGE_API_KEY),authentication:'server-side API key'}}));
app.use('/api',(req,res,next)=>{
  const expected=process.env.HUB_API_TOKEN;
  if(!expected)return next();
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const a=Buffer.from(token),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Token inválido ou ausente.'});
  next();
});
app.get('/api/modrinth/search',async(req,res)=>{
  try{
    const q=clean(req.query.query,100);
    const url=new URL('https://api.modrinth.com/v2/search');url.searchParams.set('query',q);url.searchParams.set('index','downloads');url.searchParams.set('limit',String(limit(req.query.limit)));url.searchParams.set('offset',String(Math.max(0,Math.min(100000,Number.parseInt(req.query.page,10)||0))*limit(req.query.limit)));
    const gv=clean(req.query.game_version,20),loader=clean(req.query.loader,20).toLowerCase(),facets=[];
    facets.push(['project_type:mod']);if(gv)facets.push(['versions:'+gv]);if(['fabric','forge','neoforge','quilt'].includes(loader))facets.push(['categories:'+loader]);
    if(facets.length)url.searchParams.set('facets',JSON.stringify(facets));
    const d=await getJson(url,mrHeaders);
    res.json({provider:'modrinth',total:d.total_hits,results:(d.hits||[]).map(p=>({id:p.project_id,slug:p.slug,title:p.title,description:p.description,author:p.author,downloads:p.downloads,icon_url:p.icon_url,versions:p.versions}))});
  }catch(e){res.status(e.status||502).json({error:'Falha ao consultar Modrinth.'});}
});
app.get('/api/modrinth/project/:id',async(req,res)=>{
  try{const id=clean(req.params.id,100);if(!/^[\w-]+$/.test(id))return res.status(400).json({error:'ID inválido.'});res.json({project:await getJson('https://api.modrinth.com/v2/project/'+encodeURIComponent(id),mrHeaders)});}
  catch(e){res.status(e.status||502).json({error:'Projeto Modrinth não encontrado.'});}
});
app.get('/api/modrinth/project/:id/versions',async(req,res)=>{
  try{const id=clean(req.params.id,100);if(!/^[\w-]+$/.test(id))return res.status(400).json({error:'ID inválido.'});
    const url=new URL('https://api.modrinth.com/v2/project/'+encodeURIComponent(id)+'/version');
    const gv=clean(req.query.game_version,20),loader=clean(req.query.loader,20);
    if(gv)url.searchParams.set('game_versions',JSON.stringify([gv]));if(loader)url.searchParams.set('loaders',JSON.stringify([loader]));
    res.json({versions:await getJson(url,mrHeaders)});
  }catch(e){res.status(e.status||502).json({error:'Falha ao consultar versões.'});}
});
app.get('/api/curseforge/search',async(req,res)=>{
  const headers=cfHeaders();if(!headers)return res.status(503).json({error:'Configure CURSEFORGE_API_KEY nos Secrets do Render.'});
  try{const q=clean(req.query.query,100);
    const url=new URL('https://api.curseforge.com/v1/mods/search');url.searchParams.set('gameId','432');if(q)url.searchParams.set('searchFilter',q);else{url.searchParams.set('sortField','6');url.searchParams.set('sortOrder','desc');}url.searchParams.set('pageSize',String(limit(req.query.limit,50)));url.searchParams.set('index',String(Math.max(0,Math.min(100000,Number.parseInt(req.query.page,10)||0))*limit(req.query.limit,50)));
    const gv=clean(req.query.game_version,20);if(gv)url.searchParams.set('gameVersion',gv);
    const loader=clean(req.query.loader,20).toLowerCase(),loaderType={forge:1,fabric:4,quilt:5,neoforge:6}[loader];if(loaderType)url.searchParams.set('modLoaderType',String(loaderType));
    const d=await getJson(url,headers);res.json({provider:'curseforge',total:d.pagination?.totalCount||0,results:(d.data||[]).map(m=>({id:m.id,name:m.name,slug:m.slug,summary:m.summary,downloads:m.downloadCount,logo:m.logo?.url,websiteUrl:m.links?.websiteUrl}))});
  }catch(e){res.status(e.status||502).json({error:'Falha ao consultar CurseForge.'});}
});
app.get('/api/curseforge/mod/:id',async(req,res)=>{
  const h=cfHeaders();if(!h)return res.status(503).json({error:'Configure CURSEFORGE_API_KEY.'});
  try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'ID inválido.'});const d=await getJson('https://api.curseforge.com/v1/mods/'+id,h);res.json({mod:d.data});}
  catch(e){res.status(e.status||502).json({error:'Falha ao consultar mod.'});}
});
app.get('/api/curseforge/mod/:id/files',async(req,res)=>{
  const h=cfHeaders();if(!h)return res.status(503).json({error:'Configure CURSEFORGE_API_KEY.'});
  try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'ID inválido.'});
    const url=new URL('https://api.curseforge.com/v1/mods/'+id+'/files');url.searchParams.set('pageSize',String(limit(req.query.limit,50)));url.searchParams.set('index',String(Math.max(0,Math.min(100000,Number.parseInt(req.query.page,10)||0))*limit(req.query.limit,50)));
    const gv=clean(req.query.game_version,20);if(gv)url.searchParams.set('gameVersion',gv);
    const loader=clean(req.query.loader,20).toLowerCase(),loaderType={forge:1,fabric:4,quilt:5,neoforge:6}[loader];if(loaderType)url.searchParams.set('modLoaderType',String(loaderType));
    const d=await getJson(url,h);res.json({total:d.pagination?.totalCount||0,files:(d.data||[]).map(f=>({id:f.id,displayName:f.displayName,fileName:f.fileName,gameVersions:f.gameVersions||[],downloadUrl:f.downloadUrl,fileLength:f.fileLength}))});
  }catch(e){res.status(e.status||502).json({error:'Falha ao consultar arquivos.'});}
});
app.post('/api/packs/validate',(req,res)=>{
  const b=req.body||{},name=clean(b.name,80),version=clean(b.minecraft_version,20),loader=clean(b.loader,20).toLowerCase();
  if(!name||!version||!['vanilla','fabric','forge','neoforge','quilt'].includes(loader))return res.status(400).json({valid:false,error:'Informe nome, versão Minecraft e loader válido.'});
  if(!Array.isArray(b.projects)||b.projects.length>100)return res.status(400).json({valid:false,error:'Até 100 projetos por modpack.'});
  const seen=new Set(),projects=[],errors=[];
  for(const p of b.projects){const provider=clean(p?.provider,20).toLowerCase(),id=clean(String(p?.id??''),100),key=provider+':'+id;
    if(!['modrinth','curseforge'].includes(provider)||!id||seen.has(key)){errors.push('Projeto inválido ou duplicado.');continue;}seen.add(key);projects.push({provider,id,name:clean(p?.name,120),version_id:clean(String(p?.version_id??''),100),version_name:clean(p?.version_name,160),game_version:clean(p?.game_version,20),loader:clean(p?.loader,20).toLowerCase()});}
  res.json({valid:errors.length===0,manifest:{format:'mikael-modpack-hub',version:1,name,minecraft_version:version,loader,projects},errors});
});

app.post('/api/packs/create',async(req,res)=>{
 const body=req.body||{},name=clean(body.name,80),gameVersion=clean(body.minecraft_version,20),loader=clean(body.loader,20).toLowerCase(),projects=body.projects;
 if(!name||!/^\d+\.\d+(\.\d+)?$/.test(gameVersion)||!['vanilla','fabric','forge','neoforge','quilt'].includes(loader))return res.status(400).json({error:'Nome, versão Minecraft ou modloader inválido.'});
 if(!Array.isArray(projects)||projects.length<1||projects.length>100)return res.status(400).json({error:'Selecione de 1 a 100 mods.'});
 if(projects.some(p=>!['modrinth','curseforge'].includes(p?.provider)||!clean(String(p?.id||''),100)||!clean(String(p?.version_id||''),100)))return res.status(400).json({error:'Cada mod precisa ter uma versão selecionada.'});
 const cf=cfHeaders(),seen=new Set(),files=[],warnings=[];let dependencyCount=0;
 const addFile=(file,provider,id)=>{
  const fileName=clean(file.filename||file.fileName||file.name||('mod-'+id+'.jar'),180).replace(/[\\/\\\\]/g,'_');
  const url=file.url||file.downloadUrl;let safeUrl;try{safeUrl=new URL(url)}catch{}if(!safeUrl||safeUrl.protocol!=='https:')throw new Error('O provedor não forneceu um link HTTPS de download para '+fileName);
  const hashes=file.hashes||{};const fileHashes={};if(hashes.sha1||hashes.SHA1)fileHashes.sha1=hashes.sha1||hashes.SHA1;if(hashes.sha512||hashes.SHA512)fileHashes.sha512=hashes.sha512||hashes.SHA512;
  const existing=files.find(x=>x.path==='mods/'+fileName);if(existing)return;
  files.push({path:'mods/'+fileName,hashes:fileHashes,downloads:[url],fileSize:Number(file.size||file.fileLength||0),env:{client:'required',server:'required'}});
 };
 const getMrVersion=async versionId=>getJson('https://api.modrinth.com/v2/version/'+encodeURIComponent(versionId),mrHeaders);
 const resolveMr=async(versionId,depth=0)=>{
  if(depth>8||seen.has('mr:'+versionId))return;seen.add('mr:'+versionId);
  const v=await getMrVersion(versionId);
  if(!(v.game_versions||[]).includes(gameVersion))throw new Error('Versão incompatível do mod '+(v.name||v.id));
  if(loader!=='vanilla'&&!(v.loaders||[]).includes(loader))throw new Error('Mod incompatível com '+loader+': '+(v.name||v.id));
  const f=(v.files||[]).find(x=>x.primary)||(v.files||[])[0];if(!f)throw new Error('Arquivo ausente em '+(v.name||v.id));
  addFile({filename:f.filename,url:f.url,hashes:f.hashes,size:f.size},'modrinth',v.project_id);
  for(const dep of v.dependencies||[]){if(dep.dependency_type!=='required')continue;let depVersion=dep.version_id;if(!depVersion&&dep.project_id){const versions=await getJson('https://api.modrinth.com/v2/project/'+encodeURIComponent(dep.project_id)+'/version?game_versions='+encodeURIComponent(JSON.stringify([gameVersion]))+'&loaders='+encodeURIComponent(JSON.stringify(loader==='vanilla'?[]:[loader])),mrHeaders);const candidate=(versions||[]).find(x=>(x.game_versions||[]).includes(gameVersion)&&(loader==='vanilla'||(x.loaders||[]).includes(loader)));depVersion=candidate?.id;}if(depVersion){dependencyCount++;await resolveMr(depVersion,depth+1)}else warnings.push('Dependência Modrinth não encontrada: '+(dep.project_id||'desconhecida'))}
 };
 const cfLoader={forge:1,fabric:4,quilt:5,neoforge:6}[loader];
 const resolveCf=async(modId,fileId,depth=0)=>{
  if(depth>8||seen.has('cf:'+modId+':'+fileId))return;if(!cf)throw new Error('CurseForge precisa da chave API configurada no Render.');seen.add('cf:'+modId+':'+fileId);
  const data=await getJson('https://api.curseforge.com/v1/mods/'+modId+'/files/'+fileId,cf);const f=data.data;
  if(!(f.gameVersions||[]).includes(gameVersion))throw new Error('Versão Minecraft incompatível: '+(f.displayName||f.fileName));

  let url=f.downloadUrl;if(!url){const d=await getJson('https://api.curseforge.com/v1/mods/'+modId+'/files/'+fileId+'/download-url',cf);url=d.data}
  addFile({fileName:f.fileName,downloadUrl:url,hashes:{sha1:(f.hashes||[]).find(x=>x.algo===1)?.value},fileLength:f.fileLength},'curseforge',modId);
  for(const dep of f.dependencies||[]){if(dep.relationType!==3)continue;const q=new URL('https://api.curseforge.com/v1/mods/'+dep.modId+'/files');q.searchParams.set('gameVersion',gameVersion);q.searchParams.set('pageSize','50');if(cfLoader)q.searchParams.set('modLoaderType',String(cfLoader));const list=await getJson(q,cf);const match=(list.data||[]).find(x=>(x.gameVersions||[]).includes(gameVersion));if(match){dependencyCount++;await resolveCf(dep.modId,match.id,depth+1)}else warnings.push('Dependência CurseForge não encontrada: '+dep.modId)}
 };
 try{
  for(const p of projects){if(p.provider==='modrinth')await resolveMr(clean(String(p.version_id),100));else await resolveCf(clean(String(p.id),30),clean(String(p.version_id),30))}
  if(!files.length)throw new Error('Nenhum arquivo compatível foi resolvido.');
  const loaderKey={fabric:'fabric-loader',quilt:'quilt-loader',forge:'forge',neoforge:'neoforge'}[loader];const index={formatVersion:1,game:'minecraft',versionId:crypto.randomUUID(),name,summary:'Criado com Mikael Modpack Hub',files,dependencies:{minecraft:gameVersion,...(loaderKey?{[loaderKey]:'*'}:{})}};
  res.setHeader('Content-Type','application/x-modrinth-modpack+zip');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)+'.mrpack'));
  const zip=archiver('zip',{zlib:{level:6}});zip.on('error',err=>{console.error('Pack archive:',err.message);if(!res.headersSent)res.status(500).end();else res.destroy(err)});zip.pipe(res);zip.append(JSON.stringify(index,null,2),{name:'modrinth.index.json'});zip.append('Este modpack contém links para os arquivos dos mods. Instale usando um launcher compatível com Modrinth (.mrpack).'+(warnings.length?'\\nAvisos de dependências:\\n'+warnings.join('\\n'):'') ,{name:'README.txt'});await zip.finalize();
 }catch(e){console.error('Pack create:',e.message);if(!res.headersSent)res.status(e.status||400).json({error:e.message||'Falha ao criar modpack.'});else res.destroy(e)}
});

app.get('/docs',(_req,res)=>res.sendFile(path.join(root,'public','docs.html')));
app.get('*',(_req,res)=>res.sendFile(path.join(root,'public','index.html')));
app.use((err,_req,res,_next)=>{console.error(err.message);res.status(500).json({error:'Erro interno.'});});
const port=Number(process.env.PORT||3000);app.listen(port,'0.0.0.0',()=>console.log('Mikael Modpack Hub listening on '+port));
