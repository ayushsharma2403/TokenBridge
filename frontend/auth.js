// auth.js - TokenBridge Login Logic

const API = 'http://localhost:8000';
let currentEmail = '';

// -------------------------------------------------------
// Theme
// -------------------------------------------------------
function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-btn').textContent = isDark ? 'moon' : 'sun';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

(function loadTheme() {
  const t   = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'dark' ? 'sun' : 'moon';
  if (localStorage.getItem('tb_token')) window.location.href = 'index.html';
})();

// -------------------------------------------------------
// Step navigation
// -------------------------------------------------------
function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + id).classList.add('active');
  hideMsg();
}

// -------------------------------------------------------
// Messages
// -------------------------------------------------------
function showMsg(text, type) {
  const el      = document.getElementById('auth-msg');
  el.textContent = text;
  el.className   = 'msg ' + type;
}

function hideMsg() {
  document.getElementById('auth-msg').className = 'msg';
}

// -------------------------------------------------------
// Check email (step 1)
// -------------------------------------------------------
async function checkEmail() {
  const email = document.getElementById('email-input').value.trim();
  currentEmail = email;

  try {
    const res  = await fetch(API + '/auth/check-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.exists) {
      document.getElementById('pwd-email').textContent = email;
      showStep('password');
      document.getElementById('pwd-input').focus();
    } else {
      document.getElementById('signup-email').textContent = email;
      showStep('signup');
      document.getElementById('name-input').focus();
    }
  } catch(e) {
    showMsg('Cannot connect to server. Is it running?', 'error');
  }
}

// -------------------------------------------------------
// Login
// -------------------------------------------------------
async function submitPassword() {
  const password = document.getElementById('pwd-input').value;
  const remember = document.getElementById('remember-me').checked;

  try {
    const res  = await fetch(API + '/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: currentEmail, password, remember_me: remember })
    });
    const data = await res.json();
    saveAndRedirect(data);
  } catch(e) {
    showMsg('Cannot connect to server.', 'error');
  }
}

// -------------------------------------------------------
// Signup
// -------------------------------------------------------
async function submitSignup() {
  const name = document.getElementById('name-input').value.trim();
  const pwd  = document.getElementById('signup-pwd').value;
  if (pwd.length < 8) { showMsg('Password must be at least 8 characters.', 'error'); return; }

  try {
    const res  = await fetch(API + '/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email: currentEmail, password: pwd })
    });
    const data = await res.json();
    saveAndRedirect(data);
  } catch(e) {
    showMsg('Cannot connect to server.', 'error');
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
  } catch(e) {
    showMsg('Cannot connect to server.', 'error');
  }
}

// -------------------------------------------------------
// Phone OTP - Firebase
// -------------------------------------------------------
function sendPhoneOTP() {
  const phone = document.getElementById('phone-input').value.trim();
    showMsg('Please enter a valid phone number with country code. Example: +91 98765 43210', 'error');
    return;
  }

  const btn     = document.getElementById('send-otp-btn');
  btn.disabled  = true;
  btn.textContent = 'Sending...';

  // Setup reCAPTCHA
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'normal',
      callback: function() { console.log('reCAPTCHA solved'); }
    });
  }

  fbAuth.signInWithPhoneNumber(phone, window.recaptchaVerifier)
    .then(function(result) {
      window.confirmationResult = result;
      document.getElementById('otp-sent-to').textContent = 'OTP sent to ' + phone;
      showStep('otp');
      document.getElementById('otp-1').focus();
      showMsg('OTP sent successfully!', 'success');
    })
    .catch(function(error) {
      showMsg('Failed to send OTP: ' + error.message, 'error');
      btn.disabled    = false;
      btn.textContent = 'Send OTP';
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    });
}

function otpNext(current, nextId) {
  if (current.value.length === 1 && nextId) {
    document.getElementById(nextId).focus();
  }
}

async function verifyOTP() {
  const otp = ['otp-1','otp-2','otp-3','otp-4','otp-5','otp-6']
    .map(id => document.getElementById(id).value)
    .join('');

  if (otp.length < 6) { showMsg('Please enter all 6 digits.', 'error'); return; }

  const btn       = document.querySelector('#step-otp .continue-btn');
  btn.disabled    = true;
  btn.textContent = 'Verifying...';

  try {
    const result   = await window.confirmationResult.confirm(otp);
    const idToken  = await result.user.getIdToken();

    const res  = await fetch(API + '/auth/phone', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ firebase_token: idToken })
    });
    const data = await res.json();

    saveAndRedirect(data);

  } catch(e) {
    showMsg('Invalid OTP. Please try again.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Verify OTP';
  }
}

// -------------------------------------------------------
// Forgot password
// -------------------------------------------------------
async function submitForgot() {
  const email = document.getElementById('forgot-email').value.trim();

  try {
    await fetch(API + '/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email })
    });
    showMsg('Reset link sent! Check your email.', 'success');
  } catch(e) {
    showMsg('Cannot connect to server.', 'error');
  }
}

// -------------------------------------------------------
// Save session and redirect
// -------------------------------------------------------
function saveAndRedirect(data) {
  localStorage.setItem('tb_token',   data.token);
  localStorage.setItem('tb_user_id', data.user_id);
  localStorage.setItem('tb_name',    data.name);
  localStorage.setItem('tb_email',   data.email || '');
  window.location.href = 'index.html';
}
