// auth.js - TokenBridge Login Logic

const API = 'http://localhost:8000';
let currentEmail = '';

// -------------------------------------------------------
// Theme
// -------------------------------------------------------

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = saved === 'dark' ? '☀️' : '🌙';
}

loadTheme();

// -------------------------------------------------------
// Show / Hide steps
// -------------------------------------------------------

function showStep(stepId) {
  ['step-email', 'step-login', 'step-signup', 'step-forgot'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(stepId).classList.remove('hidden');
}

function backToEmail() {
  showStep('step-email');
  hideMessage();
}

function showForgot() {
  showStep('step-forgot');
  const forgotInput = document.getElementById('input-forgot-email');
  if (forgotInput) forgotInput.value = currentEmail;
  hideMessage();
}

// -------------------------------------------------------
// Messages
// -------------------------------------------------------

function showMessage(text, type = 'error') {
  const el = document.getElementById('auth-message');
  el.textContent = text;
  el.className = 'auth-message ' + type;
}

function hideMessage() {
  const el = document.getElementById('auth-message');
  el.className = 'auth-message hidden';
}

// -------------------------------------------------------
// Step 1: Check email
// -------------------------------------------------------

async function checkEmail() {
  const email = document.getElementById('input-email').value.trim();
    showMessage('Please enter a valid email address.');
    return;
  }

  currentEmail = email;

  try {
    const res  = await fetch(API + '/auth/check-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.exists) {
      // Existing user - show login
      document.getElementById('login-email-display').textContent = email;
      showStep('step-login');
      document.getElementById('input-password').focus();
    } else {
      // New user - show signup
      document.getElementById('signup-email-display').textContent = email;
      showStep('step-signup');
      document.getElementById('input-name').focus();
    }
    hideMessage();

  } catch (err) {
    // If endpoint not found, just show login form
    document.getElementById('login-email-display').textContent = email;
    showStep('step-login');
  }
}

// -------------------------------------------------------
// Login
// -------------------------------------------------------

async function handleLogin() {
  const password    = document.getElementById('input-password').value;
  const rememberMe  = document.getElementById('remember-me').checked;


  try {
    const res  = await fetch(API + '/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: currentEmail, password, remember_me: rememberMe })
    });
    const data = await res.json();


    saveSession(data);
    window.location.href = 'index.html';

  } catch (err) {
    showMessage('Could not connect to server. Is it running?');
  }
}

// -------------------------------------------------------
// Signup
// -------------------------------------------------------

async function handleSignup() {
  const name     = document.getElementById('input-name').value.trim();
  const password = document.getElementById('input-signup-password').value;

  if (password.length < 8) { showMessage('Password must be at least 8 characters.'); return; }

  try {
    const res  = await fetch(API + '/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email: currentEmail, password })
    });
    const data = await res.json();


    saveSession(data);
    window.location.href = 'index.html';

  } catch (err) {
    showMessage('Could not connect to server. Is it running?');
  }
}

// -------------------------------------------------------
// Google login
// -------------------------------------------------------

async function handleGoogleLogin() {
  try {
    const res  = await fetch(API + '/auth/google');
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } catch (err) {
    showMessage('Could not connect to server.');
  }
}

// -------------------------------------------------------
// Forgot password
// -------------------------------------------------------

async function handleForgotPassword() {
  const email = document.getElementById('input-forgot-email').value.trim();

  try {
    const res  = await fetch(API + '/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email })
    });

    showMessage('If that email exists, a reset link has been sent.', 'success');

  } catch (err) {
    showMessage('Could not connect to server.');
  }
}

// -------------------------------------------------------
// Session helpers
// -------------------------------------------------------

function saveSession(data) {
  localStorage.setItem('tb_token',   data.token);
  localStorage.setItem('tb_user_id', data.user_id);
  localStorage.setItem('tb_name',    data.name);
  localStorage.setItem('tb_email',   data.email);
}

// Redirect if already logged in
if (localStorage.getItem('tb_token')) {
  window.location.href = 'index.html';
}
