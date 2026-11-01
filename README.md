# Mikael Modpack Hub

Central mobile-first para pesquisar mods e validar manifestos de modpacks usando APIs oficiais.

## Rodar
Node.js 20+: `npm install` e `npm start`.

## Variáveis
`CURSEFORGE_API_KEY` (opcional para Modrinth; necessária para CurseForge), `HUB_API_TOKEN` (opcional, protege `/api`), `CORS_ORIGIN` e `PORT`.

## Endpoints
- GET `/health`
- GET `/api/providers`
- GET `/api/modrinth/search?query=...`
- GET `/api/modrinth/project/:id`
- GET `/api/modrinth/project/:id/versions`
- GET `/api/curseforge/search?query=...`
- GET `/api/curseforge/mod/:id`
- GET `/api/curseforge/mod/:id/files`
- POST `/api/packs/validate`
- GET `/docs`

## Render
Runtime Node, build `npm install`, start `npm start`, health check `/health`. Configure provider credentials only in Render Environment.

## Segurança e limites
Credenciais ficam no servidor. Há rate limit, validação de parâmetros, timeout e redirects desabilitados nas chamadas aos provedores. A validação de manifesto não garante compatibilidade. Não contorna autenticação, paywalls, licenças ou restrições dos provedores. Downloads e criação de ZIP ainda não estão implementados nesta primeira versão.
