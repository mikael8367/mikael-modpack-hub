import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import rateLimit from 'express-rate-limit';

const { Pool } = pg;
let pool;
let schemaPromise;

async function dbQuery(...args) {
  const db = database();
  if (schemaPromise) await schemaPromise;
  return db.query(...args);
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada no servidor.');
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000
  });
  if (!schemaPromise) schemaPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS hub_users (
      id BIGSERIAL PRIMARY KEY,
      display_name VARCHAR(60) NOT NULL,
      username VARCHAR(20),
      email VARCHAR(254) UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS username VARCHAR(20);
    ALTER TABLE hub_users ALTER COLUMN email DROP NOT NULL;
    UPDATE hub_users
      SET username = COALESCE(NULLIF(LOWER(REGEXP_REPLACE(display_name, '[^a-zA-Z0-9_]', '', 'g')), ''), 'usuario') || id::text
      WHERE username IS NULL OR username = '';
    ALTER TABLE hub_users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS hub_users_username_unique ON hub_users (LOWER(username));
    CREATE TABLE IF NOT EXISTS hub_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS hub_sessions_user_idx ON hub_sessions(user_id);
    CREATE TABLE IF NOT EXISTS hub_libraries (
      user_id BIGINT PRIMARY KEY REFERENCES hub_users(id) ON DELETE CASCADE,
      packs JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hub_community_packs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES hub_users(id) ON DELETE CASCADE,
      author_name VARCHAR(20),
      is_offline BOOLEAN NOT NULL DEFAULT FALSE,
      is_official BOOLEAN NOT NULL DEFAULT FALSE,
      pack_name VARCHAR(80) NOT NULL,
      minecraft_version VARCHAR(20) NOT NULL,
      description VARCHAR(500) NOT NULL DEFAULT '',
      image_data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE hub_community_packs ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE hub_community_packs ADD COLUMN IF NOT EXISTS author_name VARCHAR(20);
    ALTER TABLE hub_community_packs ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE hub_community_packs ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE hub_community_packs ADD COLUMN IF NOT EXISTS offline_edit_hash TEXT;
    ALTER TABLE hub_community_packs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    UPDATE hub_community_packs p SET author_name=u.display_name FROM hub_users u WHERE p.user_id=u.id AND (p.author_name IS NULL OR p.author_name='');
    CREATE INDEX IF NOT EXISTS hub_community_created_idx ON hub_community_packs(created_at DESC);
  `).catch(error => { schemaPromise = null; throw error; });
  return pool;
}

const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
const cookieName = 'hub_session';
const production = process.env.NODE_ENV === 'production';
function readCookie(req) {
  const header = req.headers.cookie || '';
  const pair = header.split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='));
  if (!pair) return '';
  try { return decodeURIComponent(pair.slice(cookieName.length + 1)); } catch { return ''; }
}
function setSessionCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true, secure: production, sameSite: 'lax',
    path: '/api/auth', maxAge: 1000 * 60 * 60 * 24 * 30
  });
}
function clearSessionCookie(res) {
  res.clearCookie(cookieName, { httpOnly: true, secure: production, sameSite: 'lax', path: '/api/auth' });
}
function validOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      ? parsed.host === req.get('host') : false;
  } catch { return false; }
}
function publicUser(row) {
  return { id: String(row.id), name: row.display_name, username: row.username, createdAt: row.created_at };
}

export function createAuthRouter() {
  const router = express.Router();
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } });
  const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' } });

  router.use((req, res, next) => {
    if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'O banco de dados ainda não está configurado.' });
    if (!validOrigin(req)) return res.status(403).json({ error: 'Origem não autorizada.' });
    next();
  });

  async function currentUser(req) {
    const token = readCookie(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    if (schemaPromise) await schemaPromise;
    const result = await dbQuery(
      'SELECT u.id,u.display_name,u.username,u.email,u.created_at FROM hub_sessions s JOIN hub_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',
      [hashToken(token)]
    );
    return result.rows[0] || null;
  }
  router.use(async (req, res, next) => {
    try { req.hubUser = await currentUser(req); next(); }
    catch (error) { console.error('Auth session:', error.message); res.status(503).json({ error: 'Não foi possível consultar a sessão.' }); }
  });

  router.post('/register', registerLimit, async (req, res) => {
    try {
      const username = String(req.body?.username || req.body?.name || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (username === 'mikael_oficial') return res.status(409).json({ error: 'O nome mikael_oficial é reservado ao criador oficial.' });
      if (!/^[a-z0-9_]{3,20}$/.test(username))
        return res.status(400).json({ error: 'O nome de usuário deve ter de 3 a 20 caracteres: letras sem acento, números e _. Não use espaços.' });
      if (password.length < 10 || password.length > 72)
        return res.status(400).json({ error: 'A senha deve ter entre 10 e 72 caracteres.' });
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await dbQuery(
        'INSERT INTO hub_users(display_name,username,email,password_hash) VALUES($1,$2,NULL,$3) RETURNING id,display_name,username,email,created_at',
        [username, username, passwordHash]
      );
      const token = crypto.randomBytes(32).toString('hex');
      await dbQuery("INSERT INTO hub_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')", [hashToken(token), result.rows[0].id]);
      setSessionCookie(res, token);
      res.status(201).json({ user: publicUser(result.rows[0]) });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Esse nome de usuário já está em uso. Escolha outro.' });
      console.error('Auth register:', error.message);
      res.status(503).json({ error: 'Falha ao criar a conta. Verifique a conexão do banco.' });
    }
  });

  router.post('/login', loginLimit, async (req, res) => {
    try {
      const username = String(req.body?.username || req.body?.name || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!/^[a-z0-9_]{3,20}$/.test(username) || password.length < 1 || password.length > 72)
        return res.status(400).json({ error: 'Informe nome de usuário e senha válidos.' });
      const result = await dbQuery('SELECT * FROM hub_users WHERE LOWER(username)=$1', [username]);
      const row = result.rows[0];
      if (!row || !(await bcrypt.compare(password, row.password_hash)))
        return res.status(401).json({ error: 'Nome de usuário ou senha incorretos.' });
      const token = crypto.randomBytes(32).toString('hex');
      await dbQuery("INSERT INTO hub_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')", [hashToken(token), row.id]);
      setSessionCookie(res, token);
      res.json({ user: publicUser(row) });
    } catch (error) {
      console.error('Auth login:', error.message);
      res.status(503).json({ error: 'Não foi possível entrar agora.' });
    }
  });

  router.get('/me', (req, res) => res.json({ user: req.hubUser ? publicUser(req.hubUser) : null }));
  router.patch('/profile/username', async (req, res) => {
    if (!req.hubUser) return res.status(401).json({ error: 'Entre na sua conta para alterar o nome.' });
    const username = String(req.body?.username || '').trim().toLowerCase();
    if (username === 'mikael_oficial' && req.hubUser.username !== 'mikael_oficial')
      return res.status(403).json({ error: 'Esse nome é reservado ao criador oficial.' });
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Use 3 a 20 caracteres: letras, números e _.' });
    try {
      const result = await dbQuery(
        'UPDATE hub_users SET username=$1, display_name=$1 WHERE id=$2 RETURNING id,display_name,username,email,created_at',
        [username, req.hubUser.id]
      );
      await dbQuery('UPDATE hub_community_packs SET author_name=$1 WHERE user_id=$2', [username, req.hubUser.id]);
      res.json({ user: publicUser(result.rows[0]) });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Esse nome já está em uso. Escolha outro.' });
      console.error('Username update:', error.message);
      res.status(503).json({ error: 'Não foi possível alterar o nome agora.' });
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      const token = readCookie(req);
      if (/^[a-f0-9]{64}$/.test(token)) await dbQuery('DELETE FROM hub_sessions WHERE token_hash=$1', [hashToken(token)]);
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (error) {
      console.error('Auth logout:', error.message);
      res.status(503).json({ error: 'Não foi possível encerrar a sessão.' });
    }
  });

  // Public catalog; publishing is restricted to authenticated accounts.
  router.get('/community/packs', async (req, res) => {
    try {
      const result = await dbQuery(
        'SELECT p.id,p.pack_name,p.minecraft_version,p.description,p.image_data,p.created_at,p.user_id,COALESCE(p.author_name,u.display_name,\'Usuário\') AS author_name,p.is_offline,p.is_official FROM hub_community_packs p LEFT JOIN hub_users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 100'
      );
      res.json({ packs: result.rows.map(row => ({
        id: String(row.id), name: row.pack_name, minecraft_version: row.minecraft_version,
        description: row.description, image: row.image_data, author: row.author_name, offline: row.is_offline, is_official: Boolean(row.is_official), user_id: row.user_id ? String(row.user_id) : null, created_at: row.created_at
      })) });
    } catch (error) {
      console.error('Community list:', error.message);
      res.status(503).json({ error: 'Não foi possível carregar a comunidade.' });
    }
  });
  router.post('/community/packs', async (req, res) => {
    const wantsOfficial = req.body?.is_official === true;
    const isCreator = Boolean(req.hubUser && String(req.hubUser.username || '').toLowerCase() === 'mikael_oficial');
    if (wantsOfficial && !isCreator) return res.status(403).json({ error: 'Somente o criador oficial pode publicar na Comunidade Oficial.' });
    if (wantsOfficial && !req.hubUser) return res.status(401).json({ error: 'Entre na conta do criador oficial.' });
    const offline = !req.hubUser;
    const offlineName = String(req.body?.offline_username || '').trim().toLowerCase();
    if (offline && (!req.body?.offline || !/^[a-z0-9_]{3,20}$/.test(offlineName))) return res.status(401).json({ error: 'Entre em uma conta ou informe um nome offline válido.' });
    const authorName = offline ? offlineName : req.hubUser.username;
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const version = String(req.body?.minecraft_version || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 500);
    const image = String(req.body?.image || '');
    if (name.length < 3 || !/^[0-9]+[.][0-9]+([.][0-9]+)?$/.test(version))
      return res.status(400).json({ error: 'Informe nome e versão Minecraft válidos.' });
    const comma = image.indexOf(',');
    const header = comma >= 0 ? image.slice(0, comma) : '';
    const encoded = comma >= 0 ? image.slice(comma + 1) : '';
    if (!['data:image/png;base64', 'data:image/jpeg;base64', 'data:image/webp;base64'].includes(header) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
      return res.status(400).json({ error: 'Envie uma imagem PNG, JPG ou WebP.' });
    const imageBytes = Buffer.from(encoded, 'base64');
    if (!imageBytes.length || imageBytes.length > 1024 * 1024)
      return res.status(413).json({ error: 'A foto deve ter no máximo 1 MB.' });
    try {
      const result = await dbQuery(
        'INSERT INTO hub_community_packs(user_id,author_name,is_offline,is_official,offline_edit_hash,pack_name,minecraft_version,description,image_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,pack_name,minecraft_version,description,image_data,created_at,is_official',
        [offline ? null : req.hubUser.id, authorName, offline, wantsOfficial, offline ? (typeof req.body?.offline_edit_token === 'string' && req.body.offline_edit_token.length >= 32 ? crypto.createHash('sha256').update(req.body.offline_edit_token).digest('hex') : null) : null, name, version, description, image]
      );
      const row = result.rows[0];
      res.status(201).json({ pack: {
        id: String(row.id), name: row.pack_name, minecraft_version: row.minecraft_version,
        description: row.description, image: row.image_data, author: authorName, offline, is_official: Boolean(row.is_official), created_at: row.created_at
      } });
    } catch (error) {
      console.error('Community publish:', error.message);
      res.status(503).json({ error: 'Não foi possível publicar agora.' });
    }
  });
  router.patch('/community/packs/:id', async (req, res) => {
    if (!/^[0-9]+$/.test(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const version = String(req.body?.minecraft_version || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 500);
    const image = String(req.body?.image || '');
    if (name.length < 3 || !/^[0-9]+[.][0-9]+([.][0-9]+)?$/.test(version)) return res.status(400).json({ error: 'Informe nome e versão Minecraft válidos.' });
    let imageValue = null;
    if (image) {
      const comma = image.indexOf(',');
      const header = comma >= 0 ? image.slice(0, comma) : '';
      const encoded = comma >= 0 ? image.slice(comma + 1) : '';
      if (!['data:image/png;base64', 'data:image/jpeg;base64', 'data:image/webp;base64'].includes(header) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return res.status(400).json({ error: 'Imagem inválida.' });
      imageValue = Buffer.from(encoded, 'base64');
      if (!imageValue.length || imageValue.length > 1024 * 1024) return res.status(413).json({ error: 'A foto deve ter no máximo 1 MB.' });
    }
    const offlineToken = typeof req.body?.offline_edit_token === 'string' ? req.body.offline_edit_token : '';
    const tokenHash = offlineToken.length >= 32 ? crypto.createHash('sha256').update(offlineToken).digest('hex') : '';
    try {
      const result = await dbQuery(
        `UPDATE hub_community_packs SET pack_name=$1,minecraft_version=$2,description=$3,image_data=COALESCE($4,image_data),updated_at=NOW()
         WHERE id=$5 AND ((is_official=TRUE AND $8=TRUE) OR (is_official=FALSE AND ((user_id IS NOT NULL AND user_id=$6) OR (is_offline=TRUE AND offline_edit_hash IS NOT NULL AND offline_edit_hash=$7))))
         RETURNING id,pack_name,minecraft_version,description,image_data,author_name,is_offline,created_at,updated_at`,
        [name, version, description, imageValue ? image : null, req.params.id, req.hubUser?.id || null, tokenHash, Boolean(req.hubUser && String(req.hubUser.username || '').toLowerCase() === 'mikael_oficial')]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Publicação não encontrada ou você não tem permissão para editá-la.' });
      const row = result.rows[0];
      res.json({ pack: { id:String(row.id),name:row.pack_name,minecraft_version:row.minecraft_version,description:row.description,image:row.image_data,author:row.author_name,offline:row.is_offline,created_at:row.created_at,updated_at:row.updated_at } });
    } catch (error) {
      console.error('Community update:', error.message);
      res.status(503).json({ error: 'Não foi possível atualizar a publicação.' });
    }
  });
  router.delete('/community/packs/:id', async (req, res) => {
    if (!req.hubUser) return res.status(401).json({ error: 'Entre na sua conta.' });
    if (!/^[0-9]+$/.test(req.params.id)) return res.status(400).json({ error: 'ID inválido.' });
    try {
      const isCreator = String(req.hubUser.username || '').toLowerCase() === 'mikael_oficial';
      const result = isCreator
        ? await dbQuery('DELETE FROM hub_community_packs WHERE id=$1 RETURNING id', [req.params.id])
        : await dbQuery('DELETE FROM hub_community_packs WHERE id=$1 AND is_official=FALSE AND user_id=$2 RETURNING id', [req.params.id, req.hubUser.id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Publicação não encontrada ou não pertence à sua conta.' });
      res.json({ ok: true });
    } catch (error) {
      console.error('Community delete:', error.message);
      res.status(503).json({ error: 'Não foi possível excluir a publicação.' });
    }
  });

  router.get('/library', async (req, res) => {
    if (!req.hubUser) return res.status(401).json({ error: 'Entre na sua conta para acessar a biblioteca sincronizada.' });
    try {
      const result = await dbQuery('SELECT packs FROM hub_libraries WHERE user_id=$1', [req.hubUser.id]);
      res.json({ packs: result.rows[0]?.packs || [] });
    } catch (error) {
      console.error('Library read:', error.message);
      res.status(503).json({ error: 'Não foi possível carregar a biblioteca.' });
    }
  });
  router.put('/library', async (req, res) => {
    if (!req.hubUser) return res.status(401).json({ error: 'Entre na sua conta para sincronizar a biblioteca.' });
    const packs = req.body?.packs;
    if (!Array.isArray(packs) || packs.length > 100) return res.status(400).json({ error: 'A biblioteca aceita até 100 modpacks.' });
    let bytes;
    try { bytes = Buffer.byteLength(JSON.stringify(packs)); } catch { return res.status(400).json({ error: 'Formato da biblioteca inválido.' }); }
    if (bytes > 500000) return res.status(413).json({ error: 'A biblioteca ultrapassa o limite de 500 KB.' });
    try {
      await dbQuery(
        'INSERT INTO hub_libraries(user_id,packs,updated_at) VALUES($1,$2::jsonb,NOW()) ON CONFLICT(user_id) DO UPDATE SET packs=EXCLUDED.packs,updated_at=NOW()',
        [req.hubUser.id, JSON.stringify(packs)]
      );
      res.json({ ok: true, count: packs.length });
    } catch (error) {
      console.error('Library write:', error.message);
      res.status(503).json({ error: 'Não foi possível sincronizar a biblioteca.' });
    }
  });
  return router;
}
