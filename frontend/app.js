// app.js - TokenBridge Main Chat Logic
// Dynamic API URL: Empty string when on port 8000, localhost:8000 when served on other ports (e.g. 5500)
var API = (window.location.port === "8000") ? "" : "http://localhost:8000";
var sessionId = generateId();
var messages  = [];
var isLoading = false;
var sessions  = [];
var currentUploadedFile = null;
var currentEfficiency   = localStorage.getItem('tb_efficiency') || 'medium';
var currentAbortController = null;

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
  onProviderChange();
  loadSessions();
  updateVault();
  loadConfigSectionState();
  initEfficiency();
  setupDragAndDrop();
  setupPromptEngineerListeners();

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
    authFetch('/auth/me')
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
// Sidebar (Gemini-style open/close/toggle)
// -------------------------------------------------------
function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  } else {
    if (sidebar.classList.contains('closed')) {
      openSidebar();
    } else {
      closeSidebar();
    }
  }
}

function openSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    sidebar.classList.add('open');
    sidebar.classList.remove('closed');
  }
  if (overlay && window.innerWidth <= 768) {
    overlay.classList.add('open');
  }
}

function closeSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    sidebar.classList.remove('open');
    if (window.innerWidth > 768) {
      sidebar.classList.add('closed');
    }
  }
  if (overlay) {
    overlay.classList.remove('open');
  }
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

// -------------------------------------------------------
// Efficiency Mode (Low, Medium, Hard)
// -------------------------------------------------------
function initEfficiency() {
  setEfficiency(currentEfficiency, false);

  // Close efficiency menu when clicking outside
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('efficiency-dropdown-wrap');
    var menu = document.getElementById('efficiency-menu');
    if (wrap && menu && !wrap.contains(e.target)) {
      menu.style.display = 'none';
      wrap.classList.remove('open');
    }
  });
}

function toggleEfficiencyMenu(e) {
  if (e && e.stopPropagation) { e.stopPropagation(); }
  var wrap = document.getElementById('efficiency-dropdown-wrap');
  var menu = document.getElementById('efficiency-menu');
  if (!menu || !wrap) return;

  var isVisible = menu.style.display === 'flex' || menu.style.display === 'block';
  if (isVisible) {
    menu.style.display = 'none';
    wrap.classList.remove('open');
  } else {
    menu.style.display = 'flex';
    wrap.classList.add('open');
  }
}

function setEfficiency(level, shouldPersist) {
  if (shouldPersist === undefined) { shouldPersist = true; }
  level = (level || 'medium').toLowerCase();
  if (level === 'hard') { level = 'high'; }
  if (['low', 'medium', 'high'].indexOf(level) === -1) {
    level = 'medium';
  }

  currentEfficiency = level;
  if (shouldPersist) {
    localStorage.setItem('tb_efficiency', level);
  }

  var btn   = document.getElementById('efficiency-btn');
  var label = document.getElementById('efficiency-label');
  var menu  = document.getElementById('efficiency-menu');
  var wrap  = document.getElementById('efficiency-dropdown-wrap');

  if (label) {
    label.textContent = level.charAt(0).toUpperCase() + level.slice(1);
  }

  if (btn) {
    btn.className = 'efficiency-pill-btn level-' + level;
  }

  // Update active state in menu items
  var options = document.querySelectorAll('.efficiency-option');
  for (var i = 0; i < options.length; i++) {
    var optLevel = options[i].getAttribute('data-level');
    if (optLevel === level || (level === 'high' && optLevel === 'hard')) {
      options[i].classList.add('active');
    } else {
      options[i].classList.remove('active');
    }
  }

  if (menu) {
    menu.style.display = 'none';
  }
  if (wrap) {
    wrap.classList.remove('open');
  }
}

// -------------------------------------------------------
// Collapsible Config Section
// -------------------------------------------------------
function toggleConfigSection() {
  var sec = document.getElementById('sidebar-config-section');
  if (!sec) return;
  sec.classList.toggle('collapsed');
  var isCollapsed = sec.classList.contains('collapsed');
  localStorage.setItem('tb_config_collapsed', isCollapsed ? 'true' : 'false');
}

function loadConfigSectionState() {
  var isCollapsed = localStorage.getItem('tb_config_collapsed') === 'true';
  var sec = document.getElementById('sidebar-config-section');
  if (sec && isCollapsed) {
    sec.classList.add('collapsed');
  }
}

function renderSessions() {
  var list = document.getElementById('session-list');
  if (!list) { return; }
  list.innerHTML = '';

  var badge = document.getElementById('session-count-badge');
  if (badge) {
    badge.textContent = sessions.length > 0 ? ('(' + sessions.length + ')') : '';
  }

  if (sessions.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:8px 4px;">No chats yet</div>';
    return;
  }

  for (var i = 0; i < sessions.length; i++) {
    var s   = sessions[i];
    var div = document.createElement('div');
    div.className = 'session-item' + (s.id === sessionId ? ' active' : '');
    div.innerHTML =
      '<span class="session-dot"></span>' +
      '<span class="session-title-text">' + (s.title || 'Chat') + '</span>' +
      '<button type="button" class="session-del-btn" title="Delete chat" onclick="deleteSessionHandler(event, \'' + s.id + '\')">&#128465;</button>';
    div.onclick   = (function(id) { return function() { loadSession(id); }; })(s.id);
    list.appendChild(div);
  }
}

function deleteSessionHandler(event, id) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  if (!confirm('Are you sure you want to delete this chat?')) {
    return;
  }

  // Remove from localStorage
  sessions = sessions.filter(function(s) { return s.id !== id; });
  localStorage.setItem('tb_sessions', JSON.stringify(sessions));

  // Request backend deletion
  authFetch('/session/' + id, { method: 'DELETE' })
    .catch(function() {});

  // If deleted current active session, reset to new chat
  if (id === sessionId) {
    newChat();
  } else {
    renderSessions();
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
    appendMessage(messages[i].role, messages[i].content, false, i);
  }
  area.scrollTop = area.scrollHeight;
}

function formatContent(text) {
  if (!text) return '';

  // If marked.js is loaded, use full markdown rendering
  if (typeof marked !== 'undefined') {
    try {
      marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false
      });
      var rawHtml = marked.parse(text);
      if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml);
      }
      return rawHtml;
    } catch (e) {
      console.warn('marked parse error:', e);
    }
  }

  // Fallback markdown parser if CDN is unreachable
  var escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Headings
  escaped = escaped.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Horizontal Rule
  escaped = escaped.replace(/^---$/gim, '<hr>');

  // Code blocks
  escaped = escaped.replace(/```([a-zA-Z0-9_\-+#]*)\n?([\s\S]*?)```/g, function(match, lang, code) {
    var langTag = lang ? '<div class="code-header"><span class="code-lang">' + lang + '</span></div>' : '';
    return '<div class="code-block-wrapper">' + langTag + '<pre><code>' + code.trim() + '</code></pre></div>';
  });

  // Inline code & bold & lists
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
  escaped = escaped.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  escaped = escaped.replace(/\n/g, '<br>');
  return escaped;
}

function enhanceCodeBlocks(container) {
  if (!container) return;
  var preElements = container.querySelectorAll('pre');
  preElements.forEach(function(pre) {
    if (pre.closest('.code-block-wrapper')) return;

    var codeEl = pre.querySelector('code');
    var codeText = codeEl ? codeEl.innerText : pre.innerText;

    // Detect language from class (e.g. language-python)
    var lang = 'Code';
    if (codeEl && codeEl.className) {
      var match = codeEl.className.match(/language-([a-zA-Z0-9_\-+]+)/);
      if (match) { lang = match[1]; }
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    var header = document.createElement('div');
    header.className = 'code-header';

    var langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = lang;

    var copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.type = 'button';
    copyBtn.innerHTML = '&#128203; Copy';
    copyBtn.onclick = function() {
      navigator.clipboard.writeText(codeText).then(function() {
        copyBtn.innerHTML = '&#10003; Copied!';
        setTimeout(function() { copyBtn.innerHTML = '&#128203; Copy'; }, 2000);
      });
    };

    header.appendChild(langSpan);
    header.appendChild(copyBtn);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

function appendMessage(role, content, scroll, msgIndex) {
  if (scroll === undefined) { scroll = true; }
  if (msgIndex === undefined) { msgIndex = messages.length - 1; }

  var empty = document.getElementById('empty-state');
  if (empty) { empty.remove(); }

  var area   = document.getElementById('messages-area');
  var wrap   = document.createElement('div');
  wrap.className = 'message-wrap ' + (role === 'user' ? 'user' : 'ai');
  wrap.setAttribute('data-index', msgIndex);

  var avatar = document.createElement('div');
  avatar.className   = 'message-avatar';
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  var contentCol = document.createElement('div');
  contentCol.className = 'message-content-col';

  var bubble = document.createElement('div');
  bubble.className   = 'message-bubble markdown-body';
  bubble.id          = 'msg-bubble-' + msgIndex;
  if (role === 'ai') {
    bubble.innerHTML = formatContent(content);
    enhanceCodeBlocks(bubble);
  } else {
    bubble.textContent = content;
  }

  // Action toolbar on hover (Edit, Copy, Delete, Regenerate)
  var actionsBar = document.createElement('div');
  actionsBar.className = 'message-actions-bar';

  // Copy Action
  var copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'msg-act-btn';
  copyBtn.title = 'Copy message';
  copyBtn.innerHTML = '&#128203; Copy';
  copyBtn.onclick = function() {
    navigator.clipboard.writeText(content).then(function() {
      copyBtn.innerHTML = '&#10003; Copied!';
      setTimeout(function() { copyBtn.innerHTML = '&#128203; Copy'; }, 1800);
    });
  };
  actionsBar.appendChild(copyBtn);

  if (role === 'user') {
    // Edit Message Action for User
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-act-btn';
    editBtn.title = 'Edit & resend message';
    editBtn.innerHTML = '&#9998; Edit';
    editBtn.onclick = function() {
      startEditMessage(msgIndex);
    };
    actionsBar.appendChild(editBtn);
  } else if (role === 'ai') {
    // Retry/Regenerate Action for AI
    var retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'msg-act-btn';
    retryBtn.title = 'Regenerate response';
    retryBtn.innerHTML = '&#8635; Retry';
    retryBtn.onclick = function() {
      regenerateFromIndex(msgIndex);
    };
    actionsBar.appendChild(retryBtn);
  }

  // Delete message
  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'msg-act-btn delete';
  delBtn.title = 'Delete message';
  delBtn.innerHTML = '&#128465;';
  delBtn.onclick = function() {
    deleteMessageAtIndex(msgIndex);
  };
  actionsBar.appendChild(delBtn);

  contentCol.appendChild(bubble);
  contentCol.appendChild(actionsBar);

  wrap.appendChild(avatar);
  wrap.appendChild(contentCol);
  area.appendChild(wrap);

  if (scroll) { area.scrollTop = area.scrollHeight; }
  return wrap;
}

function startEditMessage(index) {
  if (isLoading) {
    alert('Please wait or stop the current response before editing.');
    return;
  }
  var msg = messages[index];
  if (!msg) return;

  var bubble = document.getElementById('msg-bubble-' + index);
  if (!bubble) return;

  var currentText = msg.content;
  bubble.innerHTML = '';

  var editBox = document.createElement('div');
  editBox.className = 'edit-message-box';

  var textarea = document.createElement('textarea');
  textarea.value = currentText;
  textarea.rows = Math.min(6, Math.max(2, currentText.split('\n').length));

  var actionRow = document.createElement('div');
  actionRow.className = 'edit-box-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-edit-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() {
    renderAllMessages();
  };

  var saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-edit-save';
  saveBtn.textContent = 'Save & Resend';
  saveBtn.onclick = function() {
    var updatedText = textarea.value.trim();
    if (!updatedText) {
      alert('Message cannot be empty.');
      return;
    }
    submitEditedMessage(index, updatedText);
  };

  actionRow.appendChild(cancelBtn);
  actionRow.appendChild(saveBtn);

  editBox.appendChild(textarea);
  editBox.appendChild(actionRow);
  bubble.appendChild(editBox);
  textarea.focus();
}

function submitEditedMessage(index, newContent) {
  // Truncate messages up to this user message and re-send
  messages = messages.slice(0, index);
  renderAllMessages();

  // Send the edited message
  sendSpecificMessage(newContent);
}

function regenerateFromIndex(aiIndex) {
  if (isLoading) return;
  // Look for the user message that prompted this AI response
  var userPrompt = '';
  if (aiIndex > 0 && messages[aiIndex - 1].role === 'user') {
    userPrompt = messages[aiIndex - 1].content;
    messages = messages.slice(0, aiIndex - 1);
  } else {
    messages = messages.slice(0, aiIndex);
  }

  renderAllMessages();
  if (userPrompt) {
    sendSpecificMessage(userPrompt);
  }
}

function deleteMessageAtIndex(index) {
  if (isLoading) return;
  if (!confirm('Delete this message?')) return;

  messages.splice(index, 1);
  renderAllMessages();

  // Sync with backend
  authFetch('/session/' + sessionId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages })
  }).catch(function() {});
}

function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  removeTyping();
  isLoading = false;
  toggleStopButton(false);
  appendMessage('ai', '*[Generation stopped by user]*');
}

function toggleStopButton(showStop) {
  var sendBtn = document.getElementById('send-btn');
  var stopBtn = document.getElementById('stop-btn');
  if (sendBtn && stopBtn) {
    if (showStop) {
      sendBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    } else {
      sendBtn.style.display = 'flex';
      sendBtn.disabled = false;
      stopBtn.style.display = 'none';
    }
  }
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
  if (!text) { alert('Please type a message.'); return; }
  input.value        = '';
  input.style.height = 'auto';
  sendSpecificMessage(text);
}

function sendSpecificMessage(text) {
  var apiKey  = getApiKey();

  if (!apiKey)   { alert('Please paste your API key in the sidebar.'); return; }
  if (isLoading) { return; }

  var provider = document.getElementById('provider-select').value;
  var budget   = parseInt(document.getElementById('token-budget').value) || 50000;

  messages.push({ role: 'user', content: text });
  appendMessage('user', text, true, messages.length - 1);

  var preview = document.getElementById('file-preview');
  if (preview) { preview.style.display = 'none'; }

  isLoading = true;
  toggleStopButton(true);
  showTyping();

  currentAbortController = new AbortController();

  authFetch('/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    signal:  currentAbortController.signal,
    body: JSON.stringify({
      session_id:   sessionId,
      message:      text,
      api_key:      apiKey,
      provider:     provider,
      token_budget: budget,
      efficiency:   currentEfficiency
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
        appendMessage('ai', data.reply, true, messages.length - 1);
        updateTokenMeter(data.tokens_remaining, budget);
        updateVaultRow(provider, data.tokens_this_call);
        saveSessionToList();
        document.getElementById('session-id-display').textContent = sessionId;
      }
    });
  })
  .catch(function(err) {
    removeTyping();
    if (err && err.name === 'AbortError') {
      // User aborted explicitly via Stop button, already handled
      return;
    }
    appendMessage('ai', 'Could not reach the server. Make sure backend is running.');
  })
  .finally(function() {
    isLoading = false;
    currentAbortController = null;
    toggleStopButton(false);
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
  var p = (provider || '').toLowerCase();
  var el = document.getElementById('vault-' + p);
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
        var pLower = p.toLowerCase();
        var tokEl  = document.getElementById('vault-' + pLower);
        var costEl = document.getElementById('cost-' + pLower);
        if (tokEl)  { tokEl.textContent  = (stats.total_tokens || 0).toLocaleString(); }
        if (costEl) { costEl.textContent = 'USD ' + (stats.cost_usd || 0).toFixed(4); }
      }
    }
  })
  .catch(function() {});
}

// -------------------------------------------------------
// -------------------------------------------------------
// Prompt Engineer Panel (Show / Hide / Optimize)
// -------------------------------------------------------
function setupPromptEngineerListeners() {
  // Handlers are wired directly via onclick in HTML
}

function togglePromptPanel(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  var panel = document.getElementById('prompt-panel');
  if (!panel) return;

  var isHidden = panel.classList.contains('hidden') || panel.style.display === 'none';

  if (isHidden) {
    openPromptPanel();
  } else {
    closePromptPanel(event);
  }
}

function openPromptPanel() {
  var panel    = document.getElementById('prompt-panel');
  var body     = document.getElementById('prompt-panel-body');
  var arrowBtn = document.getElementById('prompt-arrow-btn');
  if (!panel) return;

  panel.classList.remove('hidden');
  panel.classList.remove('minimized');
  panel.style.display = 'block';
  if (body) { body.style.display = 'flex'; }
  if (arrowBtn) {
    arrowBtn.innerHTML = '&#9660;';
    arrowBtn.title = 'Minimize Prompt Engineer';
  }

  var raw = document.getElementById('raw-prompt');
  if (raw) { raw.focus(); }
  updatePromptButtons(true);
}

function minimizePromptPanel(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  var panel    = document.getElementById('prompt-panel');
  var body     = document.getElementById('prompt-panel-body');
  var arrowBtn = document.getElementById('prompt-arrow-btn');
  if (!panel) return;

  // If panel is hidden altogether, open it
  if (panel.classList.contains('hidden') || panel.style.display === 'none') {
    openPromptPanel();
    return;
  }

  var isMinimized = panel.classList.contains('minimized') || (body && body.style.display === 'none');

  if (isMinimized) {
    // Expand
    panel.classList.remove('minimized');
    if (body) { body.style.display = 'flex'; }
    if (arrowBtn) {
      arrowBtn.innerHTML = '&#9660;';
      arrowBtn.title = 'Minimize Prompt Engineer';
    }
    var raw = document.getElementById('raw-prompt');
    if (raw) { raw.focus(); }
  } else {
    // Minimize (keep the header visible, hide the body)
    panel.classList.add('minimized');
    if (body) { body.style.display = 'none'; }
    if (arrowBtn) {
      arrowBtn.innerHTML = '&#9650;';
      arrowBtn.title = 'Expand Prompt Engineer';
    }
  }
}

function closePromptPanel(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  var panel    = document.getElementById('prompt-panel');
  var body     = document.getElementById('prompt-panel-body');
  var arrowBtn = document.getElementById('prompt-arrow-btn');
  if (!panel) return;

  panel.classList.add('hidden');
  panel.classList.remove('minimized');
  panel.style.display = 'none';
  if (body) { body.style.display = 'flex'; }
  if (arrowBtn) {
    arrowBtn.innerHTML = '&#9660;';
    arrowBtn.title = 'Minimize Prompt Engineer';
  }
  updatePromptButtons(false);
}

function updatePromptButtons(active) {
  var headerBtn = document.getElementById('btn-prompt-toggle');
  var inputBtn  = document.getElementById('btn-prompt-input');
  if (headerBtn) { headerBtn.style.color = active ? 'var(--accent)' : ''; }
  if (inputBtn)  { inputBtn.style.color  = active ? 'var(--accent)' : ''; }
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
      var btnUse   = document.getElementById('btn-use-prompt');
      if (resultEl) {
        resultEl.textContent   = data.optimized;
        resultEl.style.display = 'block';
        resultEl.classList.remove('hidden');
      }
      if (btnUse) {
        btnUse.style.display = 'block';
        btnUse.classList.remove('hidden');
      }
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
  var resultEl  = document.getElementById('optimized-result');
  var btnUse    = document.getElementById('btn-use-prompt');
  var optimized = resultEl ? resultEl.textContent : '';
  if (optimized) {
    var input = document.getElementById('message-input');
    input.value = optimized;
    autoResize(input);
    input.focus();
  }
  // Clear and hide result
  if (resultEl) {
    resultEl.textContent = '';
    resultEl.style.display = 'none';
  }
  if (btnUse) {
    btnUse.style.display = 'none';
  }
  // Close prompt panel
  closePromptPanel();
}

// -------------------------------------------------------
// File Upload & Markdown Conversion
// -------------------------------------------------------
function handleFileUpload(event) {
  var file = event.target.files[0];
  if (!file) { return; }
  processFileUpload(file);
  event.target.value = '';
}

function processFileUpload(file) {
  var token = localStorage.getItem('tb_token');
  if (!token) {
    showFilePreview('error', 'Please log in to upload and convert files.');
    return;
  }

  showFilePreview('converting', { filename: file.name });

  var apiKey = getApiKey();
  var formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey || '');

  authFetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(function(res) {
    return res.json().then(function(data) {
      return { ok: res.ok, status: res.status, data: data };
    });
  })
  .then(function(result) {
    if (!result.ok || result.data.error || result.data.detail) {
      var err = result.data.error || result.data.detail || 'Conversion failed';
      if (typeof err === 'object') { err = JSON.stringify(err); }
      showFilePreview('error', err);
      return;
    }

    currentUploadedFile = result.data;
    showFilePreview('ready', result.data);

    // Insert or prepend to message input
    var input = document.getElementById('message-input');
    var fileHeader = '[File: ' + result.data.filename + ' | ' + result.data.reduction + ']\n\n';
    if (input.value.trim()) {
      input.value = input.value + '\n\n' + fileHeader + result.data.markdown;
    } else {
      input.value = fileHeader + result.data.markdown;
    }
    autoResize(input);
  })
  .catch(function() {
    showFilePreview('error', 'Network error: Could not connect to backend.');
  });
}

function showFilePreview(state, data) {
  var preview = document.getElementById('file-preview');
  if (!preview) return;

  if (state === 'converting') {
    preview.style.display = 'flex';
    preview.className = 'file-preview-card';
    preview.innerHTML = 
      '<div class="file-info-group">' +
        '<span class="converting-spinner"></span>' +
        '<span class="file-title">Converting <strong>' + escapeHtml(data.filename) + '</strong> to Markdown (.md)...</span>' +
      '</div>';
  } else if (state === 'ready') {
    preview.style.display = 'flex';
    preview.className = 'file-preview-card';
    preview.innerHTML = 
      '<div class="file-info-group">' +
        '<span class="file-icon">&#128196;</span>' +
        '<div class="file-names">' +
          '<span class="file-title">' + escapeHtml(data.filename) + ' &#8594; <strong>' + escapeHtml(data.md_filename || (data.filename + '.md')) + '</strong></span>' +
          '<span class="file-badge">' + escapeHtml(data.reduction) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="file-actions-group">' +
        '<button class="btn-file-action btn-download" onclick="downloadCurrentMd()" title="Download converted Markdown file">&#11015; Download .md</button>' +
        '<button class="btn-file-action" id="btn-copy-md" onclick="copyCurrentMd()" title="Copy Markdown to clipboard">&#128203; Copy</button>' +
        '<button class="btn-file-action btn-remove" onclick="clearUploadedFile()" title="Dismiss">&#10005;</button>' +
      '</div>';
  } else if (state === 'error') {
    preview.style.display = 'flex';
    preview.className = 'file-preview-card error';
    preview.innerHTML = 
      '<div class="file-info-group">' +
        '<span class="file-icon">&#9888;</span>' +
        '<span class="file-title">Error: ' + escapeHtml(data) + '</span>' +
      '</div>' +
      '<div class="file-actions-group">' +
        '<button class="btn-file-action btn-remove" onclick="clearUploadedFile()" title="Dismiss">&#10005;</button>' +
      '</div>';
  }
}

function downloadCurrentMd() {
  if (!currentUploadedFile || !currentUploadedFile.markdown) return;
  var filename = currentUploadedFile.md_filename || 'converted.md';
  var blob = new Blob([currentUploadedFile.markdown], { type: 'text/markdown;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyCurrentMd() {
  if (!currentUploadedFile || !currentUploadedFile.markdown) return;
  navigator.clipboard.writeText(currentUploadedFile.markdown).then(function() {
    var btn = document.getElementById('btn-copy-md');
    if (btn) {
      var orig = btn.innerHTML;
      btn.innerHTML = '&#10003; Copied!';
      setTimeout(function() { btn.innerHTML = orig; }, 2000);
    }
  }).catch(function() {
    alert('Failed to copy to clipboard.');
  });
}

function clearUploadedFile() {
  currentUploadedFile = null;
  var preview = document.getElementById('file-preview');
  if (preview) {
    preview.style.display = 'none';
    preview.innerHTML = '';
  }
  var input = document.getElementById('file-upload');
  if (input) { input.value = ''; }
}

function setupDragAndDrop() {
  var inputWrap = document.querySelector('.input-wrap');
  if (!inputWrap) return;

  ['dragenter', 'dragover'].forEach(function(eventName) {
    window.addEventListener(eventName, function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, false);
    inputWrap.addEventListener(eventName, function(e) {
      e.preventDefault();
      e.stopPropagation();
      inputWrap.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'dragend'].forEach(function(eventName) {
    inputWrap.addEventListener(eventName, function(e) {
      e.preventDefault();
      e.stopPropagation();
      inputWrap.classList.remove('drag-over');
    }, false);
  });

  inputWrap.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    inputWrap.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  }, false);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  var url = path.startsWith('http') ? path : (API + path);
  return fetch(url, options);
}

