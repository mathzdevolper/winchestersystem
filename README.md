# Wichester Verify

Site de verificação de identidade Discord, isolado do painel C++ e pronto para deploy no **Vercel**.

## Estrutura

```
verification-site/
├── index.html      # interface
├── style.css       # tema dark/violeta
├── script.js       # OAuth2 Authorization Code + PKCE no navegador
├── api/
│   ├── config.js   # expõe apenas clientId e redirectUri
│   └── verify.js   # troca o código por token e consulta /users/@me
├── vercel.json
├── .env.example
└── package.json
```

## Deploy no Vercel

1. Crie um projeto novo no Vercel apontando **apenas** para esta pasta `verification-site`.
   - Se o repositório estiver na raiz, defina **Root Directory** = `verification-site`.
2. Em **Settings → Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `DISCORD_CLIENT_ID` | Client ID do app em discord.com/developers/applications |
| `DISCORD_CLIENT_SECRET` | Client Secret do mesmo app |
| `DISCORD_REDIRECT_URI` | `https://<seu-projeto>.vercel.app/` |

3. No Developer Portal, cadastre em **OAuth2 → Redirects** exatamente o mesmo
   `DISCORD_REDIRECT_URI` (com barra final).
4. Faça o deploy. O site estará em `https://<seu-projeto>.vercel.app`.

## Como funciona

- **Verificar com Discord**: o navegador gera `state` + `code_verifier`, calcula
  `code_challenge` com SHA-256 (S256) e redireciona para `/oauth2/authorize`.
  O retorno cai na raiz com `?code=...&state=...`; o `script.js` valida o `state`,
  envia o código e o `verifier` para `/api/verify`, que troca por token e consulta
  `/users/@me`. O Client Secret nunca chega ao navegador.
- **Verificar por token**: envia o token direto para `/api/verify`, que consulta
  `/users/@me` com `Authorization: Bearer`. Nada é persistido.

## Escopos usados

`identify email` — suficientes para exibir nome, avatar, ID, e-mail e data de criação.
Se o usuário negar `email`, o campo aparece como "escopo email não autorizado".

## Segurança

- `state` e PKCE protegem contra CSRF e interceptação de código.
- Funções serverless com `Cache-Control: no-store`.
- Headers de `nosniff`, `DENY` e `Referrer-Policy` no `vercel.json`.
- Nenhum dado é gravado em banco ou log.
