// ============================================================
// api/verify.js — função serverless (Vercel)
//_action=code : troca authorization code + PKCE por access token
//_action=token: valida um user token diretamente
// ============================================================

const API = 'https://discord.com/api/v10';

function snowflakeToDate(id) {
  try {
    const ms = (BigInt(id) >> 22n) + 1420070400000n;
    return new Date(Number(ms)).toISOString();
  } catch (_) {
    return null;
  }
}

function avatarUrl(user) {
  if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=160`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
    return;
  }

  const body = req.body || {};
  const { action, code, code_verifier, redirect_uri, token } = body;

  try {
    let accessToken;

    if (action === 'code') {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
      const redirect = redirect_uri || process.env.DISCORD_REDIRECT_URI;

      if (!clientId) throw new Error('DISCORD_CLIENT_ID não configurado no Vercel.');
      if (!code) throw new Error('Código de autorização ausente.');
      if (!code_verifier) throw new Error('Verificador PKCE ausente.');
      if (!redirect) throw new Error('Redirect URI não configurada.');

      const form = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
        code_verifier,
      });
      if (clientSecret) form.set('client_secret', clientSecret);

      const r = await fetch(`${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.error_description || data.error || `Falha ao trocar código (${r.status}).`);
      }
      accessToken = data.access_token;
    } else if (action === 'token') {
      if (!token) throw new Error('Token vazio.');
      accessToken = token.replace(/^\s*(Bearer|Bot)\s+/i, '').trim();
    } else {
      throw new Error('Ação inválida.');
    }

    const userRes = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = await userRes.json().catch(() => ({}));
    if (!userRes.ok) {
      throw new Error(u.message || `Falha ao consultar o usuário (${userRes.status}).`);
    }

    res.status(200).json({
      ok: true,
      user: {
        id: u.id,
        username: u.username,
        global_name: u.global_name || null,
        discriminator: u.discriminator || '0',
        avatar: avatarUrl(u),
        email: u.email || null,
        created_at: snowflakeToDate(u.id),
        verified: u.verified === true,
        mfa_enabled: u.mfa_enabled === true,
      },
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
};
