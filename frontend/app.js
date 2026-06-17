// app.js - TokenBridge Main Chat Logic

const API = 'http://localhost:8000';

// -------------------------------------------------------
// State
// -------------------------------------------------------

let sessionId    = generateId();
let messages     = [];
let isLoading    = false;
let vaultData    = { claude: 0, openai: 0, gemini: 0 };
let sessions     = [];

// -------------------------------------------------------
// Init
// -------------------------------------------------------

window.onload = function() {
  loadTheme();
  checkAuth();
  loadUserInfo();
  loadSessions();
  updateVault();
};

function checkAuth() {
  const token = localStorage.getItem('tb_token');
}

function loadUserInfo() {
  const name  = localStorage.getItem('tb_name')  || 'User';
  const email = localStorage.getItem('tb_email') || '';

  document.getElementById('user-name').textContent  = name;
  document.getElementById('user-email').textContent = email;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
}

// -------------------------------------------------------
// Theme
// -------------------------------------------------------

function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

// -------------------------------------------------------
// Sidebar (mobile)
// -------------------------------------------------------

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// -------------------------------------------------------
// API Key
// -------------------------------------------------------

function toggleApiKey() {
  const input = document.getElementById('api-key-input');
  input.type  = input.type === 'password' ? 'text' : 'password';
}

function onProviderChange() {
  const provider = document.getElementById('provider-select').value;
  const savedKey = localStorage.getItem('tb_key_' + provider) || '';
  document.getElementById('api-key-input').value = savedKey;
}

function getApiKey() {
  const key      = document.getElementById('api-key-input').value.trim();
  const provider = document.getElementById('provider-select').value;
  if (key) localStorage.setItem('tb_key_' + provider, key);
  return key;
}

// -------------------------------------------------------
// Sessions
// -------------------------------------------------------

function generateId() {
  return 'tb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function loadSessions() {
  const saved = JSON.parse(localStorage.getItem('tb_sessions') || '[]');
  sessions    = saved;
  renderSessions();
}

function saveSessionToList() {
  const existing = sessions.find(s => s.id === sessionId);
    sessions.unshift({
      id:    sessionId,
      title: messages.length > 0 ? messages[0].content.substring(0, 30) + '...' : 'New Chat',
      time:  new Date().toISOString()
    });
    if (sessions.length > 20) sessions.pop();
    localStorage.setItem('tb_sessions', JSON.stringify(sessions));
    renderSessions();
  }
}

function renderSessions() {
  const list = document.getElementById('session-list');
  list.innerHTML = '';
  sessions.slice(0, 10).forEach(s => {
    const div = document.createElement('div');
    div.className = 'session-item' + (s.id === sessionId ? ' active' : '');
    div.innerHTML = '<span class="session-dot"></span>' + (s.title || 'Chat');
    div.onclick   = () => loadSession(s.id);
    list.appendChild(div);
  });
}

async function loadSession(id) {
  sessionId = id;
  document.getElementById('session-id-display').textContent = id;

  try {
    const res  = await authFetch('/session/' + id);
    const data = await res.json();

    if (res.ok) {
      messages = data.messages;
      renderAllMessages();
      document.getElementById('chat-title').textContent = 'Resumed Session';
    }
  } catch (e) {
    console.log('Could not load session:', e);
  }

  renderSessions();
  closeSidebar();
}

function newChat() {
  sessionId = generateId();
  messages  = [];
  document.getElementById('messages-area').innerHTML =
    '<div class="empty-state" id="empty-state">' +
    '<div class="empty-icon">⚡</div>' +
    '<h3>Start a conversation</h3>' +
    '<p>Select a provider, paste your API key, and start chatting.</p>' +
    '</div>';
  document.getElementById('chat-title').textContent = 'New Chat';
  document.getElementById('session-id-display').textContent = sessionId;
  renderSessions();
  closeSidebar();
}

// -------------------------------------------------------
// Messages
// -------------------------------------------------------

function renderAllMessages() {
  const area = document.getElementById('messages-area');
  area.innerHTML = '';
  messages.forEach(m => appendMessage(m.role, m.content, false));
  area.scrollTop = area.scrollHeight;
}

function appendMessage(role, content, scroll = true) {
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  const area = document.getElementById('messages-area');
  const wrap = document.createElement('div');
  wrap.className = 'message-wrap ' + (role === 'user' ? 'user' : 'ai');

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = content;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  area.appendChild(wrap);

  if (scroll) area.scrollTop = area.scrollHeight;
  return wrap;
}

function showTyping() {
  const area = document.getElementById('messages-area');
  const wrap = document.createElement('div');
  wrap.className = 'message-wrap ai';
  wrap.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  area.appendChild(wrap);
  area.scrollTop = area.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

// -------------------------------------------------------
// Send message
// -------------------------------------------------------

async function sendMessage() {
  const input  = document.getElementById('message-input');
  const text   = input.value.trim();
  const apiKey = getApiKey();

  if (isLoading) return;

  const provider = document.getElementById('provider-select').value;
  const budget   = parseInt(document.getElementById('token-budget').value) || 50000;

  // Add user message
  messages.push({ role: 'user', content: text });
  appendMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  // Show typing
  isLoading = true;
  document.getElementById('send-btn').disabled = true;
  showTyping();

  try {
    const res  = await authFetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        session_id:   sessionId,
        message:      text,
        api_key:      apiKey,
        provider:     provider,
        token_budget: budget
      })
    });

    removeTyping();
    const data = await res.json();

    if (res.status === 429) {
      appendMessage('ai', 'Token budget reached. Your conversation is saved. Resume anytime with session ID: ' + sessionId);
      appendMessage('ai', 'Error: ' + (data.detail || 'Something went wrong.'));
    } else {
      messages.push({ role: 'assistant', content: data.reply });
      appendMessage('ai', data.reply);
      updateTokenMeter(data.tokens_remaining, budget);
      updateVaultRow(provider, data.tokens_this_call);
      saveSessionToList();
      document.getElementById('session-id-display').textContent = sessionId;
    }

  } catch (err) {
    removeTyping();
    appendMessage('ai', 'Could not reach the server. Make sure it is running.');
  }

  isLoading = false;
  document.getElementById('send-btn').disabled = false;
}

// -------------------------------------------------------
// Token meter
// -------------------------------------------------------

function updateTokenMeter(remaining, budget) {
  const used    = budget - remaining;
  const pct     = (remaining / budget) * 100;
  const fill    = document.getElementById('token-fill');

  fill.style.width = pct + '%';
  fill.className   = 'token-meter-fill' + (pct < 20 ? ' danger' : pct < 50 ? ' warn' : '');

  document.getElementById('tokens-used').textContent = used.toLocaleString() + ' used';
  document.getElementById('tokens-left').textContent = remaining.toLocaleString() + ' left';
}

// -------------------------------------------------------
// TokenVault
// -------------------------------------------------------

function updateVaultRow(provider, tokensUsed) {
  vaultData[provider] = (vaultData[provider] || 0) + tokensUsed;
  const el = document.getElementById('vault-' + provider);
  if (el) el.textContent = vaultData[provider].toLocaleString();
}

async function updateVault() {
  try {
    const res  = await authFetch('/tokenvault');
    const data = await res.json();

    if (data.all_time) {
      Object.entries(data.all_time).forEach(([provider, stats]) => {
        const tokEl  = document.getElementById('vault-' + provider);
        const costEl = document.getElementById('cost-' + provider);
        if (tokEl)  tokEl.textContent  = (stats.total_tokens || 0).toLocaleString();
        if (costEl) costEl.textContent = '$' + (stats.cost_usd || 0).toFixed(4);
      });
    }
  } catch (e) {
    console.log('Vault update skipped:', e);
  }
}

// -------------------------------------------------------
// Prompt Engineer
// -------------------------------------------------------

function togglePromptPanel() {
  const panel = document.getElementById('prompt-panel');
  panel.classList.toggle('hidden');
}

async function optimizePrompt() {
  const raw    = document.getElementById('raw-prompt').value.trim();
  const apiKey = getApiKey();


  const btn = document.querySelector('.btn-optimize');
  btn.textContent = 'Optimizing...';
  btn.disabled    = true;

  try {
    const res  = await authFetch('/prompt/engineer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ raw_prompt: raw, api_key: apiKey })
    });
    const data = await res.json();

    if (res.ok) {
      const resultEl = document.getElementById('optimized-result');
      resultEl.textContent = data.optimized;
      resultEl.classList.remove('hidden');
      document.getElementById('btn-use-prompt').classList.remove('hidden');
    } else {
      alert('Optimization failed: ' + (data.detail || 'Unknown error'));
    }
  } catch (e) {
    alert('Could not reach server.');
  }

  btn.textContent = 'Optimize';
  btn.disabled    = false;
}

function useOptimizedPrompt() {
  const optimized = document.getElementById('optimized-result').textContent;
  document.getElementById('message-input').value = optimized;
  togglePromptPanel();
  document.getElementById('message-input').focus();
}

// -------------------------------------------------------
// Input helpers
// -------------------------------------------------------

function handleKey(e) {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// -------------------------------------------------------
// Logout
// -------------------------------------------------------

function handleLogout() {
  localStorage.removeItem('tb_token');
  localStorage.removeItem('tb_user_id');
  localStorage.removeItem('tb_name');
  localStorage.removeItem('tb_email');
  window.location.href = 'login.html';
}

function clearChat() {
  newChat();
}

// -------------------------------------------------------
// Auth fetch helper (adds JWT token to every request)
// -------------------------------------------------------

async function authFetch(path, options = {}) {
  const token = localStorage.getItem('tb_token');
  options.headers = options.headers || {};
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(API + path, options);
}
