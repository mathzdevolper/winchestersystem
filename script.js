// ============================================================
// Wichester Verify — cliente OAuth2 (Authorization Code + PKCE)
// ============================================================

const $ = (id) => document.getElementById(id);

const els = {
  login: $('loginView'),
  loading: $('loadingView'),
  result: $('resultView'),
  error: $('errorView'),
  loadingText: $('loadingText'),
  errorText: $('errorText'),
  stepLabel: $('stepLabel'),
  configHint: $('configHint'),
  oauthBtn: $('oauthBtn'),
  tokenBtn: $('tokenBtn'),
  tokenInput: $('tokenInput'),
  resetBtn: $('resetBtn'),
  backBtn: $('backBtn'),
  avatar: $('avatar'),
  resultName: $('resultName'),
  resultTag: $('resultTag'),
  resultId: $('resultId'),
  resultEmail: $('resultEmail'),
  resultCreated: $('resultCreated'),
  resultMfa: $('resultMfa'),
};

let config = null;

function show(view) {
  for (const v of [els.login, els.loading, els.result, els.error]) v.hidden = true;
  view.hidden = false;
  els.stepLabel.textContent = view === els.result ? 'Etapa 2 de 2 · Concluído' : 'Etapa 1 de 2';
}

function fail(message) {
  els.errorText.textContent = message;
  show(els.error);
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = b64url(arr);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Falha ao carregar configuração.');
    config = data;
    if (!config.clientId) {
      els.configHint.textContent = 'Configure DISCORD_CLIENT_ID nas variáveis de ambiente do Vercel.';
      els.configHint.classList.add('error');
      els.oauthBtn.disabled = true;
    } else {
      els.configHint.textContent = `App: ${config.clientId} · Redirect: ${config.redirectUri}`;
    }
  } catch (e) {
    els.configHint.textContent = 'Não foi possível carregar a configuração: ' + e.message;
    els.configHint.classList.add('error');
  }

  // Callback do OAuth volta para esta mesma página com ?code=...&state=...
  const params = new URLSearchParams(location.search);
  if (params.has('code')) handleCallback(params);
  else if (params.has('error')) fail('Autorização negada: ' + (params.get('error_description') || params.get('error')));
}

async function startOAuth() {
  if (!config || !config.clientId) return fail('Configuração OAuth indisponível.');
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));

  sessionStorage.setItem('wv_state', state);
  sessionStorage.setItem('wv_verifier', verifier);

  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'consent');

  els.loadingText.textContent = 'Abrindo o Discord...';
  show(els.loading);
  location.href = url.toString();
}

async function handleCallback(params) {
  const state = params.get('state');
  const savedState = sessionStorage.getItem('wv_state');
  const verifier = sessionStorage.getItem('wv_verifier');

  // Limpa a URL para não reprocessar ao recarregar.
  history.replaceState({}, document.title, location.pathname);

  if (!savedState || state !== savedState) return fail('State inválido. A autorização pode ter expirado.');
  if (!verifier) return fail('Verificador PKCE perdido. Tente novamente.');

  sessionStorage.removeItem('wv_state');
  sessionStorage.removeItem('wv_verifier');

  els.loadingText.textContent = 'Validando autorização...';
  show(els.loading);

  await postVerify({
    action: 'code',
    code: params.get('code'),
    code_verifier: verifier,
    redirect_uri: config ? config.redirectUri : location.origin + '/',
  });
}

async function postVerify(payload) {
  try {
    const r = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha na verificação.');
    renderUser(data.user);
  } catch (e) {
    fail(e.message);
  }
}

function renderUser(u) {
  els.avatar.src = u.avatar;
  els.resultName.textContent = u.global_name || u.username;
  els.resultTag.textContent = u.global_name ? `@${u.username}` : `#${u.discriminator}`;
  els.resultId.textContent = u.id;
  els.resultEmail.textContent = u.email || '(escopo email não autorizado)';
  els.resultCreated.textContent = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—';
  els.resultMfa.textContent = u.mfa_enabled ? 'Ativado' : 'Desativado';
  show(els.result);
}

function reset() {
  els.tokenInput.value = '';
  show(els.login);
}

els.oauthBtn.addEventListener('click', startOAuth);
els.tokenBtn.addEventListener('click', () => {
  const token = els.tokenInput.value.trim();
  if (!token) return fail('Informe um token.');
  els.loadingText.textContent = 'Consultando o Discord...';
  show(els.loading);
  postVerify({ action: 'token', token });
});
els.resetBtn.addEventListener('click', reset);
els.backBtn.addEventListener('click', reset);

loadConfig();
