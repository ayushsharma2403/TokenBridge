// app.js - TokenBridge Main Chat Logic
// API is empty string because frontend and backend run on same port (8000)

var API = '';
var sessionId = generateId();
var messages  = [];
var isLoading = false;
var sessions  = [];

// -------------------------------------------------------
// Init
// -------------------------------------------------------
window.onload = function() {
  var params   = new URLSearchParams(window.location.search);
  var urlToken = params.get('token');
  if (urlToken) {
    localStorage.setItem('tb_token',   urlToken);
    localStorage.setItem('tb_user_id', params.get('user_id') || '');
    localStorage.setItem('tb_name',    decodeURIComponent(params.get('name')  || 'User'));
    localStorage.setItem('tb_email',   decodeURIComponent(params.get('email') || ''));
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  checkAuth();
  loadTheme();
  loadUserInfo();
  loadSessions();
  updateVault();

  document.getElementById('session-id-display').textContent = sessionId;
};

function checkAuth() {
  var token = localStorage.getItem('tb_token');
  if (!token) { window.location.href = 'login.html'; }
}

function loadUserInfo() {
  var name  = localStorage.getItem('tb_name')  || 'User';
  var email = localStorage.getItem('tb_email') || '';
  document.getElementById('user-name').textContent   = name;
  document.getElementById('user-email').textContent  = email;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();

  var token = localStorage.getItem('tb_token');
  if (token) {
    fetch('/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.user_id) {
        localStorage.setItem('tb_name',  data.name);
        localStorage.setItem('tb_email', data.email);
        document.getElementById('user-name').textContent   = data.name;
        document.getElementById('user-email').textContent  = data.email;
        document.getElementById('user-avatar').textContent = data.name.charAt(0).toUpperCase();
      }
    })
    .catch(function() {});
  }
}

// -------------------------------------------------------
// Theme
// -------------------------------------------------------
function toggleTheme() {
  var html     = document.documentElement;
  var isDark   = html.getAttribute('data-theme') === 'dark';
  var newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcons(newTheme);
}

function updateThemeIcons(theme) {
  var isDark = theme === 'dark';
  var icon   = isDark ? 'Light Mode' : 'Dark Mode';
  var btns   = document.querySelectorAll('.icon-btn[onclick*="toggleTheme"]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].title = icon;
    btns[i].innerHTML = isDark ? '&#9728;' : '&#127769;';
  }
  var sbtn = document.getElementById('theme-btn-sidebar');
  if (sbtn) { sbtn.innerHTML = (isDark ? '&#9728;' : '&#127769;') + ' Toggle Theme'; }
}

function loadTheme() {
  var saved = localStorage.getItem('theme');
  if (!saved) {
    saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', saved);
  setTimeout(function() { updateThemeIcons(saved); }, 100);
}

// -------------------------------------------------------
// Sidebar
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
  var input = document.getElementById('api-key-input');
  var btn   = document.querySelector('.eye-btn');
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) { btn.innerHTML = '&#128064;'; }
  } else {
    input.type = 'password';
    if (btn) { btn.innerHTML = '&#128065;'; }
  }
}

function onProviderChange() {
  var provider = document.getElementById('provider-select').value;
  var savedKey = localStorage.getItem('tb_key_' + provider) || '';
  document.getElementById('api-key-input').value = savedKey;
}

function getApiKey() {
  var key      = document.getElementById('api-key-input').value.trim();
  var provider = document.getElementById('provider-select').value;
  if (key) { localStorage.setItem('tb_key_' + provider, key); }
  return key;
}

// -------------------------------------------------------
// Sessions
// -------------------------------------------------------
function generateId() {
  return 'tb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function loadSessions() {
  var saved = localStorage.getItem('tb_sessions');
  sessions  = saved ? JSON.parse(saved) : [];
  renderSessions();
}

function saveSessionToList() {
  var existing = null;
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].id === sessionId) { existing = sessions[i]; break; }
  }
  if (!existing) {
    var title = messages.length > 0 ? messages[0].content.substring(0, 30) + '...' : 'New Chat';
    sessions.unshift({ id: sessionId, title: title, time: new Date().toISOString() });
    if (sessions.length > 20) { sessions.pop(); }
    localStorage.setItem('tb_sessions', JSON.stringify(sessions));
    renderSessions();
  }
}

function renderSessions() {
  var list = document.getElementById('session-list');
  if (!list) { return; }
  list.innerHTML = '';
  var max = Math.min(sessions.length, 10);
  for (var i = 0; i < max; i++) {
    var s   = sessions[i];
    var div = document.createElement('div');
    div.className = 'session-item' + (s.id === sessionId ? ' active' : '');
    div.innerHTML = '<span class="session-dot"></span>' + (s.title || 'Chat');
    div.onclick   = (function(id) { return function() { loadSession(id); }; })(s.id);
    list.appendChild(div);
  }
}

function loadSession(id) {
  sessionId = id;
  document.getElementById('session-id-display').textContent = id;
  authFetch('/session/' + id)
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.messages) {
      messages = data.messages;
      renderAllMessages();
      document.getElementById('chat-title').textContent = 'Resumed Session';
    }
  })
  .catch(function() {});
  renderSessions();
  closeSidebar();
}

function newChat() {
  sessionId = generateId();
  messages  = [];
  var area  = document.getElementById('messages-area');
  area.innerHTML = '<div class="empty-state" id="empty-state"><div class="empty-icon">&#9889;</div><h3>Start a conversation</h3><p>Select a provider, paste your API key, and start chatting.</p></div>';
  document.getElementById('chat-title').textContent          = 'New Chat';
  document.getElementById('session-id-display').textContent = sessionId;
  renderSessions();
  closeSidebar();
}

// -------------------------------------------------------
// Messages
// -------------------------------------------------------
function renderAllMessages() {
  var area = document.getElementById('messages-area');
  area.innerHTML = '';
  for (var i = 0; i < messages.length; i++) {
    appendMessage(messages[i].role, messages[i].content, false);
  }
  area.scrollTop = area.scrollHeight;
}

function appendMessage(role, content, scroll) {
  if (scroll === undefined) { scroll = true; }
  var empty = document.getElementById('empty-state');
  if (empty) { empty.remove(); }

  var area   = document.getElementById('messages-area');
  var wrap   = document.createElement('div');
  wrap.className = 'message-wrap ' + (role === 'user' ? 'user' : 'ai');

  var avatar = document.createElement('div');
  avatar.className   = 'message-avatar';
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  var bubble = document.createElement('div');
  bubble.className   = 'message-bubble';
  bubble.textContent = content;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  area.appendChild(wrap);

  if (scroll) { area.scrollTop = area.scrollHeight; }
  return wrap;
}

function showTyping() {
  var area = document.getElementById('messages-area');
  var wrap = document.createElement('div');
  wrap.className = 'message-wrap ai';
  wrap.id        = 'typing-indicator';

  var avatar = document.createElement('div');
  avatar.className   = 'message-avatar';
  avatar.textContent = 'AI';

  var bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  area.appendChild(wrap);
  area.scrollTop = area.scrollHeight;
}

function removeTyping() {
  var el = document.getElementById('typing-indicator');
  if (el) { el.remove(); }
}

// -------------------------------------------------------
// Send message
// -------------------------------------------------------
function sendMessage() {
  var input   = document.getElementById('message-input');
  var text    = input.value.trim();
  var apiKey  = getApiKey();

  if (!text)     { alert('Please type a message.'); return; }
  if (!apiKey)   { alert('Please paste your API key in the sidebar.'); return; }
  if (isLoading) { return; }

  var provider = document.getElementById('provider-select').value;
  var budget   = parseInt(document.getElementById('token-budget').value) || 50000;

  messages.push({ role: 'user', content: text });
  appendMessage('user', text);
  input.value        = '';
  input.style.height = 'auto';

  var preview = document.getElementById('file-preview');
  if (preview) { preview.style.display = 'none'; }

  isLoading = true;
  document.getElementById('send-btn').disabled = true;
  showTyping();

  authFetch('/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id:   sessionId,
      message:      text,
      api_key:      apiKey,
      provider:     provider,
      token_budget: budget
    })
  })
  .then(function(res) {
    removeTyping();
    return res.json().then(function(data) {
      if (res.status === 429) {
        appendMessage('ai', 'Token budget reached. Progress saved. Session: ' + sessionId);
      } else if (!res.ok) {
        appendMessage('ai', 'Error: ' + (data.detail || 'Something went wrong.'));
      } else {
        messages.push({ role: 'assistant', content: data.reply });
        appendMessage('ai', data.reply);
        updateTokenMeter(data.tokens_remaining, budget);
        updateVaultRow(provider, data.tokens_this_call);
        saveSessionToList();
        document.getElementById('session-id-display').textContent = sessionId;
      }
    });
  })
  .catch(function() {
    removeTyping();
    appendMessage('ai', 'Could not reach the server. Make sure backend is running.');
  })
  .finally(function() {
    isLoading = false;
    document.getElementById('send-btn').disabled = false;
  });
}

// -------------------------------------------------------
// Token meter
// -------------------------------------------------------
function updateTokenMeter(remaining, budget) {
  var used = budget - remaining;
  var pct  = (remaining / budget) * 100;
  var fill = document.getElementById('token-fill');
  if (!fill) { return; }
  fill.style.width = pct + '%';
  fill.className   = 'token-meter-fill' + (pct < 20 ? ' danger' : pct < 50 ? ' warn' : '');
  document.getElementById('tokens-used').textContent = used.toLocaleString() + ' used';
  document.getElementById('tokens-left').textContent = remaining.toLocaleString() + ' left';
}

// -------------------------------------------------------
// TokenVault
// -------------------------------------------------------
function updateVaultRow(provider, tokensUsed) {
  var el = document.getElementById('vault-' + provider);
  if (el) {
    var current = parseInt(el.textContent.replace(/,/g, '')) || 0;
    el.textContent = (current + tokensUsed).toLocaleString();
  }
}

function updateVault() {
  authFetch('/tokenvault')
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.all_time) {
      var providers = Object.keys(data.all_time);
      for (var i = 0; i < providers.length; i++) {
        var p      = providers[i];
        var stats  = data.all_time[p];
        var tokEl  = document.getElementById('vault-' + p);
        var costEl = document.getElementById('cost-' + p);
        if (tokEl)  { tokEl.textContent  = (stats.total_tokens || 0).toLocaleString(); }
        if (costEl) { costEl.textContent = 'USD ' + (stats.cost_usd || 0).toFixed(4); }
      }
    }
  })
  .catch(function() {});
}

// -------------------------------------------------------
// Prompt Engineer
// -------------------------------------------------------
function togglePromptPanel() {
  var panel = document.getElementById('prompt-panel');
  if (panel) { panel.classList.toggle('hidden'); }
}

function optimizePrompt() {
  var raw    = document.getElementById('raw-prompt').value.trim();
  var apiKey = getApiKey();
  if (!raw)    { alert('Please type a prompt first.'); return; }
  if (!apiKey) { alert('Please paste your API key first.'); return; }

  var btn         = document.querySelector('.btn-optimize');
  btn.textContent = 'Optimizing...';
  btn.disabled    = true;

  authFetch('/prompt/engineer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ raw_prompt: raw, api_key: apiKey })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.optimized) {
      var resultEl = document.getElementById('optimized-result');
      resultEl.textContent = data.optimized;
      resultEl.classList.remove('hidden');
      document.getElementById('btn-use-prompt').classList.remove('hidden');
    } else {
      alert('Optimization failed: ' + (data.detail || 'Unknown error'));
    }
  })
  .catch(function() { alert('Could not reach server.'); })
  .finally(function() {
    btn.textContent = 'Optimize';
    btn.disabled    = false;
  });
}

function useOptimizedPrompt() {
  var optimized = document.getElementById('optimized-result').textContent;
  document.getElementById('message-input').value = optimized;
  togglePromptPanel();
  document.getElementById('message-input').focus();
}

// -------------------------------------------------------
// File Upload
// -------------------------------------------------------
function handleFileUpload(event) {
  var file    = event.target.files[0];
  if (!file) { return; }

  var apiKey  = getApiKey();
  var preview = document.getElementById('file-preview');
  preview.style.display = 'block';
  preview.textContent   = 'Converting ' + file.name + ' to markdown...';

  var formData = new FormData();
  formData.append('file',    file);
  formData.append('api_key', apiKey || '');

  var token = localStorage.getItem('tb_token');

  fetch('/upload', {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body:    formData
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.error || data.detail) {
      preview.textContent = 'Error: ' + (data.error || data.detail);
      return;
    }
    var summary = '[File: ' + data.filename + ' | ' + data.reduction + ']\n\n' + data.markdown;
    document.getElementById('message-input').value = summary;
    autoResize(document.getElementById('message-input'));
    preview.textContent = 'Ready: ' + data.filename + ' (' + data.reduction + ')';
    event.target.value  = '';
  })
  .catch(function() {
    preview.textContent = 'Failed to convert file.';
  });
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
// Logout / Clear
// -------------------------------------------------------
function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) { return; }
  localStorage.removeItem('tb_token');
  localStorage.removeItem('tb_user_id');
  localStorage.removeItem('tb_name');
  localStorage.removeItem('tb_email');
  window.location.href = 'login.html';
}

function clearChat() {
  if (!confirm('Clear this chat?')) { return; }
  newChat();
}

// -------------------------------------------------------
// Auth fetch helper
// -------------------------------------------------------
function authFetch(path, options) {
  options = options || {};
  var token = localStorage.getItem('tb_token');
  options.headers = options.headers || {};
  if (token) { options.headers['Authorization'] = 'Bearer ' + token; }
  return fetch(path, options);
}
