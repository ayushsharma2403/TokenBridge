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
var speechRecognition = null;
var isVoiceRecording = false;

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
  loadProvider();
  loadSessions();
  updateVault();
  loadConfigSectionState();
  loadSidebarState();
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
  var initial = name.charAt(0).toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  var railAvatar = document.getElementById('rail-user-avatar');
  if (railAvatar) { railAvatar.textContent = initial; }

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
        var newInitial = data.name.charAt(0).toUpperCase();
        document.getElementById('user-avatar').textContent = newInitial;
        if (railAvatar) { railAvatar.textContent = newInitial; }
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
// Sidebar (Gemini-style open/close/toggle with Rail strip)
// -------------------------------------------------------
function updateRailVisibility(isSidebarOpen) {
  var rail = document.getElementById('sidebar-rail');
  if (!rail) return;
  if (isSidebarOpen) {
    rail.style.display = 'none';
  } else {
    rail.style.display = 'flex';
  }
}

function loadSidebarState() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  var isCollapsed = localStorage.getItem('tb_sidebar_collapsed') === 'true';
  if (window.innerWidth > 768) {
    if (isCollapsed) {
      sidebar.classList.add('closed');
      sidebar.classList.remove('open');
      updateRailVisibility(false);
    } else {
      sidebar.classList.remove('closed');
      sidebar.classList.add('open');
      updateRailVisibility(true);
    }
  } else {
    // Mobile mode: keep rail hidden
    var rail = document.getElementById('sidebar-rail');
    if (rail) { rail.style.display = 'none'; }
  }
}

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
  updateRailVisibility(true);
  localStorage.setItem('tb_sidebar_collapsed', 'false');
}

function closeSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    sidebar.classList.remove('open');
    if (window.innerWidth > 768) {
      sidebar.classList.add('closed');
      updateRailVisibility(false);
    }
  }
  if (overlay) {
    overlay.classList.remove('open');
  }
  localStorage.setItem('tb_sidebar_collapsed', 'true');
}

function openSidebarAndConfig() {
  openSidebar();
  var section = document.getElementById('sidebar-config-section');
  if (section && section.classList.contains('collapsed')) {
    toggleConfigSection();
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

// Provider default max token limits (official model context limits)
var MODEL_DEFAULT_LIMITS = {
  claude: { max_tokens: 200000, model_name: 'claude-3-5-haiku-20241022' },
  openai: { max_tokens: 128000, model_name: 'gpt-4o-mini' },
  gemini: { max_tokens: 1000000, model_name: 'gemini-3.6-flash' }
};

function fetchModelLimits() {
  authFetch('/models/limits')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function(p) {
          if (data[p] && data[p].max_tokens) {
            MODEL_DEFAULT_LIMITS[p] = data[p];
          }
        });
        updateModelLimitsUI();
      }
    })
    .catch(function() {});
}

function loadProvider() {
  var savedProvider = localStorage.getItem('tb_provider') || 'claude';
  var select = document.getElementById('provider-select');
  if (select) {
    select.value = savedProvider;
  }
  fetchModelLimits();
  onProviderChange(false);
}

function updateModelLimitsUI() {
  var select = document.getElementById('provider-select');
  var provider = (select ? select.value : 'claude').toLowerCase();
  var limitInfo = MODEL_DEFAULT_LIMITS[provider] || { max_tokens: 200000 };
  var maxTokens = limitInfo.max_tokens;

  var badge = document.getElementById('model-max-badge');
  if (badge) {
    badge.textContent = 'Max: ' + maxTokens.toLocaleString();
  }

  var budgetInput = document.getElementById('token-budget');
  if (budgetInput) {
    budgetInput.max = maxTokens * 2;
    var savedBudget = localStorage.getItem('tb_budget_' + provider);
    if (savedBudget) {
      budgetInput.value = savedBudget;
    } else {
      budgetInput.value = maxTokens;
    }
  }

  fetchLiveUsage(provider);
}

function onProviderChange(shouldSave) {
  if (shouldSave === undefined) { shouldSave = true; }
  var select = document.getElementById('provider-select');
  var provider = (select ? select.value : 'claude').toLowerCase();
  if (shouldSave) {
    localStorage.setItem('tb_provider', provider);
  }
  var savedKey = localStorage.getItem('tb_key_' + provider) || '';
  document.getElementById('api-key-input').value = savedKey;

  updateModelLimitsUI();
}

function onTokenBudgetChange() {
  var select = document.getElementById('provider-select');
  var provider = (select ? select.value : 'claude').toLowerCase();
  var budgetInput = document.getElementById('token-budget');
  if (!budgetInput) return;
  var val = parseInt(budgetInput.value);
  if (val && val > 0) {
    localStorage.setItem('tb_budget_' + provider, val);
  }
  fetchLiveUsage(provider);
}

function fetchLiveUsage(targetProvider) {
  var provider = targetProvider || (document.getElementById('provider-select') ? document.getElementById('provider-select').value : 'claude').toLowerCase();
  var budgetInput = document.getElementById('token-budget');
  var limitInfo = MODEL_DEFAULT_LIMITS[provider] || { max_tokens: 200000 };
  var budget = budgetInput && parseInt(budgetInput.value) > 0 ? parseInt(budgetInput.value) : limitInfo.max_tokens;

  if (!sessionId) return;

  authFetch('/usage/' + sessionId + '?token_budget=' + budget + '&provider=' + encodeURIComponent(provider))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && typeof data.used !== 'undefined') {
        var used = data.used;
        var remaining = Math.max(0, budget - used);
        updateTokenMeter(remaining, budget);
      }
    })
    .catch(function() {
      // Fallback
      updateTokenMeter(budget, budget);
    });
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
    var rawTitle = messages.length > 0 ? messages[0].content.trim() : 'New Chat';
    // Clean up markdown/newlines from the title
    var cleanTitle = rawTitle.split('\n')[0].replace(/^[#*`\-_\s]+/, '').trim();
    var displayTitle = cleanTitle.length > 35 ? (cleanTitle.substring(0, 35) + '...') : (cleanTitle || 'Chat');
    sessions.unshift({ id: sessionId, title: displayTitle, time: new Date().toISOString() });
    if (sessions.length > 20) { sessions.pop(); }
    localStorage.setItem('tb_sessions', JSON.stringify(sessions));
    renderSessions();
    document.getElementById('chat-title').textContent = displayTitle;
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

  // Set topic title immediately if saved in sessions list
  var savedTopic = '';
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].id === id && sessions[i].title) {
      savedTopic = sessions[i].title;
      break;
    }
  }
  if (savedTopic) {
    document.getElementById('chat-title').textContent = savedTopic;
  }

  authFetch('/session/' + id)
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.messages) {
      messages = data.messages;
      if (data.provider) {
        for (var k = 0; k < messages.length; k++) {
          if ((messages[k].role === 'assistant' || messages[k].role === 'ai') && !messages[k].provider) {
            messages[k].provider = data.provider;
          }
        }
      }
      renderAllMessages();

      // Determine topic title from messages or saved topic
      var topicTitle = savedTopic;
      if (!topicTitle && messages.length > 0) {
        var firstUserMsg = '';
        for (var m = 0; m < messages.length; m++) {
          if (messages[m].role === 'user' && messages[m].content) {
            firstUserMsg = messages[m].content.trim();
            break;
          }
        }
        if (firstUserMsg) {
          var clean = firstUserMsg.split('\n')[0].replace(/^[#*`\-_\s]+/, '').trim();
          topicTitle = clean.length > 35 ? (clean.substring(0, 35) + '...') : clean;
        }
      }
      document.getElementById('chat-title').textContent = topicTitle || 'Chat';
    }
    fetchLiveUsage();
  })
  .catch(function() {
    fetchLiveUsage();
  });
  renderSessions();
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

function newChat() {
  sessionId = generateId();
  messages  = [];
  var area  = document.getElementById('messages-area');
  area.innerHTML = '<div class="empty-state" id="empty-state"><div class="empty-icon">&#9889;</div><h3>Start a conversation</h3><p>Select a provider, paste your API key, and start chatting.</p></div>';
  document.getElementById('chat-title').textContent          = 'New Chat';
  document.getElementById('session-id-display').textContent = sessionId;
  fetchLiveUsage();
  renderSessions();
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

// -------------------------------------------------------
// Messages
// -------------------------------------------------------
function renderAllMessages() {
  var area = document.getElementById('messages-area');
  area.innerHTML = '';
  for (var i = 0; i < messages.length; i++) {
    appendMessage(messages[i].role, messages[i].content, false, i, messages[i].provider);
  }
  area.scrollTop = area.scrollHeight;
}

function normalizeMarkdown(str) {
  if (!str) return '';
  var s = String(str);
  // Unescape any escaped newlines
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  // Separate headings stuck to text without preceding newline: (e.g. 'standards). #### 3. Title')
  s = s.replace(/([^\n])\s+(#{1,6}\s+)/g, function(match, p1, p2) {
    return p1 + '\n\n' + p2;
  });

  // Separate horizontal rules stuck to text: (e.g. 'text. --- ### Title')
  s = s.replace(/([^\n])\s+---\s+/g, function(match, p1) {
    return p1 + '\n\n---\n\n';
  });

  // Separate numbered lists stuck to text: (e.g. 'critical: 1. **Game Engines:**')
  s = s.replace(/([^\n])\s+(\b\d+\.\s+\*\*)/g, function(match, p1, p2) {
    return p1 + '\n\n' + p2;
  });

  // Separate bullet points stuck to text or another bullet: (e.g. 'includes: * **Containers:**')
  s = s.replace(/([^\n])\s+(\*\s+\*\*)/g, function(match, p1, p2) {
    return p1 + '\n* **';
  });

  // Separate sub-bullet items: (e.g. '* Powers engines... * Dominates AAA...')
  s = s.replace(/([^\n])\s+(\*\s+[A-Z])/g, function(match, p1, p2) {
    return p1 + '\n  * ' + p2.replace(/^\*\s+/, '');
  });

  return s;
}

function formatContent(text) {
  if (!text) return '';

  var preparedText = normalizeMarkdown(text);

  // If marked.js is loaded, use full markdown rendering
  if (typeof marked !== 'undefined') {
    try {
      if (typeof marked.setOptions === 'function') {
        marked.setOptions({
          gfm: true,
          breaks: true
        });
      }
      var parseFn = (typeof marked.parse === 'function') ? marked.parse : (typeof marked === 'function' ? marked : null);
      if (parseFn) {
        var rawHtml = parseFn(preparedText);
        if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
          return DOMPurify.sanitize(rawHtml);
        }
        return rawHtml;
      }
    } catch (e) {
      console.warn('marked parse error, falling back:', e);
    }
  }

  // Fallback markdown parser if CDN is unreachable
  var escaped = preparedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Code blocks first
  escaped = escaped.replace(/```([a-zA-Z0-9_\-+#]*)\n?([\s\S]*?)```/g, function(match, lang, code) {
    var langTag = lang ? '<div class="code-header"><span class="code-lang">' + lang + '</span></div>' : '';
    return '<div class="code-block-wrapper">' + langTag + '<pre><code>' + code.trim() + '</code></pre></div>';
  });

  // Headings
  escaped = escaped.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
  escaped = escaped.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  escaped = escaped.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  escaped = escaped.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Horizontal Rule
  escaped = escaped.replace(/^---$/gim, '<hr>');

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

function getModelLogoSvg(provider) {
  var p = (provider || '').toLowerCase();
  if (p === 'openai' || p.includes('gpt') || p.includes('chatgpt')) {
    // Official OpenAI / ChatGPT glyph
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: #ffffff;"><path d="M20.5 10.19a4.84 4.84 0 0 0-.41-3.92 4.9 4.9 0 0 0-3.32-2.43 4.88 4.88 0 0 0-4.04.83 4.87 4.87 0 0 0-3.8-1.7 4.93 4.93 0 0 0-4.66 3.39 4.84 4.84 0 0 0-1.89 3.48 4.9 4.9 0 0 0 1.05 4.09 4.84 4.84 0 0 0 .41 3.92 4.9 4.9 0 0 0 3.32 2.43 4.88 4.88 0 0 0 4.04-.83 4.87 4.87 0 0 0 3.8 1.7 4.93 4.93 0 0 0 4.66-3.39 4.84 4.84 0 0 0 1.89-3.48 4.9 4.9 0 0 0-1.05-4.09z"></path><path d="M12 7.7a4.3 4.3 0 0 1 2.22.62l3.47-2a8.87 8.87 0 0 0-4.24-1.63L12 7.7z"></path><path d="M7.8 8.64a4.3 4.3 0 0 1 1.76-1.42L9.56 3.22a8.87 8.87 0 0 0-4.5.73l2.74 4.69z"></path><path d="M6.02 12.06a4.3 4.3 0 0 1-.46-2.22l-3.99-.02a8.87 8.87 0 0 0-.26 4.56l4.71-2.32z"></path><path d="M8.44 14.54a4.3 4.3 0 0 1-2.22-.62l-3.47 2a8.87 8.87 0 0 0 4.24 1.63L8.44 14.54z"></path><path d="M12.64 13.6a4.3 4.3 0 0 1-1.76 1.42l-.02 4.01a8.87 8.87 0 0 0 4.52-.73l-2.74-4.7z"></path><path d="M14.42 10.18a4.3 4.3 0 0 1 .46 2.22l3.99.02a8.87 8.87 0 0 0 .26-4.56l-4.71 2.32z"></path></svg>';
  } else if (p === 'claude' || p.includes('anthropic')) {
    // Anthropic / Claude warm asterisk spark
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color: #ffffff;"><path d="M13.8 2.5a1.2 1.2 0 0 0-2.3 0l-.8 4.2a1.2 1.2 0 0 1-.9.9L5.6 8.4a1.2 1.2 0 0 0 0 2.3l4.2.8a1.2 1.2 0 0 1 .9.9l.8 4.2a1.2 1.2 0 0 0 2.3 0l.8-4.2a1.2 1.2 0 0 1 .9-.9l4.2-.8a1.2 1.2 0 0 0 0-2.3l-4.2-.8a1.2 1.2 0 0 1-.9-.9l-.8-4.2z" opacity="0.95"></path><path d="M4.2 16.2a.9.9 0 0 0-1.7 0l-.5 2.5a.9.9 0 0 1-.7.7l-2.5.5a.9.9 0 0 0 0 1.7l2.5.5a.9.9 0 0 1 .7.7l.5 2.5a.9.9 0 0 0 1.7 0l.5-2.5a.9.9 0 0 1 .7-.7l2.5-.5a.9.9 0 0 0 0-1.7l-2.5-.5a.9.9 0 0 1-.7-.7l-.5-2.5z" opacity="0.85" transform="translate(14, -2) scale(0.6)"></path></svg>';
  } else if (p === 'gemini' || p.includes('google')) {
    // Google Gemini Sparkle 4-point star with smooth gradient
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff6b6b"/><stop offset="35%" stop-color="#f59e0b"/><stop offset="70%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs><path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" fill="url(#geminiGrad)"/></svg>';
  } else {
    // Default AI Sparkle
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>';
  }
}

function appendMessage(role, content, scroll, msgIndex, provider) {
  if (scroll === undefined) { scroll = true; }
  if (msgIndex === undefined) { msgIndex = messages.length - 1; }

  var isAi = (role === 'ai' || role === 'assistant');

  var empty = document.getElementById('empty-state');
  if (empty) { empty.remove(); }

  var area   = document.getElementById('messages-area');
  var wrap   = document.createElement('div');
  wrap.className = 'message-wrap ' + (isAi ? 'ai' : 'user');
  wrap.setAttribute('data-index', msgIndex);

  var avatar = document.createElement('div');
  avatar.className = 'message-avatar';

  if (isAi) {
    var p = (provider || (messages[msgIndex] && messages[msgIndex].provider) || document.getElementById('provider-select').value || 'claude').toLowerCase();
    if (p.includes('openai') || p.includes('gpt')) {
      avatar.classList.add('avatar-openai');
      avatar.title = 'OpenAI (ChatGPT)';
    } else if (p.includes('gemini')) {
      avatar.classList.add('avatar-gemini');
      avatar.title = 'Google Gemini';
    } else if (p.includes('claude')) {
      avatar.classList.add('avatar-claude');
      avatar.title = 'Anthropic Claude';
    }
    avatar.innerHTML = getModelLogoSvg(p);
  } else {
    avatar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    avatar.title = 'You';
  }

  var contentCol = document.createElement('div');
  contentCol.className = 'message-content-col';

  var bubble = document.createElement('div');
  bubble.className   = 'message-bubble markdown-body';
  bubble.id          = 'msg-bubble-' + msgIndex;
  if (isAi) {
    bubble.innerHTML = formatContent(content);
    enhanceCodeBlocks(bubble);
  } else {
    bubble.textContent = content;
  }

  // Action toolbar on hover (Copy, Edit / Redo, Delete)
  var actionsBar = document.createElement('div');
  actionsBar.className = 'message-actions-bar';

  // Copy Action (Icon-only)
  var copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'msg-act-btn';
  copyBtn.title = 'Copy';
  copyBtn.setAttribute('aria-label', 'Copy message');
  var copyIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  var checkIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  copyBtn.innerHTML = copyIconSvg;
  copyBtn.onclick = function() {
    navigator.clipboard.writeText(content).then(function() {
      copyBtn.innerHTML = checkIconSvg;
      copyBtn.classList.add('copied');
      setTimeout(function() {
        copyBtn.innerHTML = copyIconSvg;
        copyBtn.classList.remove('copied');
      }, 1800);
    });
  };
  actionsBar.appendChild(copyBtn);

  if (!isAi) {
    // Edit Message Action for User (Icon-only)
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-act-btn';
    editBtn.title = 'Edit & resend';
    editBtn.setAttribute('aria-label', 'Edit message');
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
    editBtn.onclick = function() {
      startEditMessage(msgIndex);
    };
    actionsBar.appendChild(editBtn);
  }

  // Redo / Regenerate Action (Available for redo/retry, icon-only)
  var redoBtn = document.createElement('button');
  redoBtn.type = 'button';
  redoBtn.className = 'msg-act-btn';
  redoBtn.title = isAi ? 'Regenerate response' : 'Redo / Retry from here';
  redoBtn.setAttribute('aria-label', redoBtn.title);
  redoBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>';
  redoBtn.onclick = function() {
    if (isAi) {
      regenerateFromIndex(msgIndex);
    } else {
      // For user message, re-trigger generation using this message
      submitEditedMessage(msgIndex, content);
    }
  };
  actionsBar.appendChild(redoBtn);

  // Delete message (Icon-only)
  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'msg-act-btn delete';
  delBtn.title = 'Delete message';
  delBtn.setAttribute('aria-label', 'Delete message');
  delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
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

  textarea.onkeydown = function(e) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();
      saveBtn.click();
    } else if (e.key === 'Escape') {
      cancelBtn.click();
    }
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

  var provider = (document.getElementById('provider-select').value || 'claude').toLowerCase();
  var avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  if (provider.includes('openai') || provider.includes('gpt')) {
    avatar.classList.add('avatar-openai');
    avatar.title = 'OpenAI (ChatGPT)';
  } else if (provider.includes('gemini')) {
    avatar.classList.add('avatar-gemini');
    avatar.title = 'Google Gemini';
  } else if (provider.includes('claude')) {
    avatar.classList.add('avatar-claude');
    avatar.title = 'Anthropic Claude';
  }
  avatar.innerHTML = getModelLogoSvg(provider);

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
  if (isVoiceRecording) {
    stopVoiceInput();
  }
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
        var replyProvider = data.provider || provider;
        messages.push({ role: 'assistant', content: data.reply, provider: replyProvider });
        appendMessage('ai', data.reply, true, messages.length - 1, replyProvider);
        updateTokenMeter(data.tokens_remaining, budget);
        updateVaultRow(replyProvider, data.tokens_this_call);
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
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      // Allow default behavior: inserts a new line
      return;
    }
    // Enter without Shift sends the message
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

// -------------------------------------------------------
// Voice Input (ChatGPT-Style Speech-to-Text)
// -------------------------------------------------------
function toggleVoiceInput() {
  if (isVoiceRecording) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

function startVoiceInput() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.');
    return;
  }

  var input = document.getElementById('message-input');
  var voiceBtn = document.getElementById('voice-btn');

  try {
    if (speechRecognition) {
      speechRecognition.abort();
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = navigator.language || 'en-US';

    var startingText = input.value;
    // Add space if input already has content and does not end with space
    if (startingText && !/\s$/.test(startingText)) {
      startingText += ' ';
    }

    speechRecognition.onstart = function() {
      isVoiceRecording = true;
      if (voiceBtn) {
        voiceBtn.classList.add('listening');
        voiceBtn.title = 'Listening... Click to stop';
      }
      input.placeholder = 'Listening... Speak now';
    };

    speechRecognition.onresult = function(event) {
      var interimTranscript = '';
      var finalTranscript = '';

      for (var i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        startingText += finalTranscript + ' ';
      }

      input.value = startingText + interimTranscript;
      autoResize(input);
      input.scrollTop = input.scrollHeight;
    };

    speechRecognition.onerror = function(event) {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Voice input error:', event.error);
      }
      stopVoiceInput();
    };

    speechRecognition.onend = function() {
      stopVoiceInput();
    };

    speechRecognition.start();
  } catch (err) {
    console.error('Failed to start speech recognition:', err);
    stopVoiceInput();
  }
}

function stopVoiceInput() {
  isVoiceRecording = false;
  var voiceBtn = document.getElementById('voice-btn');
  var input = document.getElementById('message-input');

  if (voiceBtn) {
    voiceBtn.classList.remove('listening');
    voiceBtn.title = 'Voice input (Speech to text)';
  }

  if (input) {
    input.placeholder = 'Type a message or drop files here... (Enter to send, Shift+Enter for new line)';
    autoResize(input);
    input.focus();
  }

  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch (e) {}
    speechRecognition = null;
  }
}


