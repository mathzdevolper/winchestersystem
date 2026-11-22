// Configuração pública necessária para o cliente montar a URL de autorização.
// O Client Secret NUNCA é exposto aqui — fica apenas em api/verify.js.

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  res.status(200).json({
    clientId: process.env.DISCORD_CLIENT_ID || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || `${proto}://${host}/`,
  });
};
