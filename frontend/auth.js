// auth.js - TokenBridge Login Logic

var API = "http://localhost:8000";
var currentEmail = "";

function toggleTheme() {
  var html = document.documentElement;
  var isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  document.getElementById("theme-btn").textContent = isDark ? "sun" : "moon";
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

function showStep(id) {
  var steps = document.querySelectorAll(".step");
  for (var i = 0; i < steps.length; i++) {
    steps[i].classList.remove("active");
  }
  var el = document.getElementById("step-" + id);
  if (el) el.classList.add("active");
  hideMsg();
}

function showMsg(text, type) {
  var el = document.getElementById("auth-msg");
  el.textContent = text;
  el.className = "msg " + type;
}

function hideMsg() {
  var el = document.getElementById("auth-msg");
  if (el) el.className = "msg";
}

function saveAndRedirect(data) {
  localStorage.setItem("tb_token",   data.token);
  localStorage.setItem("tb_user_id", String(data.user_id));
  localStorage.setItem("tb_name",    data.name);
  localStorage.setItem("tb_email",   data.email || "");
  window.location.href = "index.html";
}

function checkEmail() {
  var email = document.getElementById("email-input").value.trim();
  if (!email || !email.includes("@")) {
    showMsg("Please enter a valid email.", "error");
    return;
  }
  currentEmail = email;
  fetch(API + "/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.exists) {
      document.getElementById("pwd-email").textContent = email;
      showStep("password");
      document.getElementById("pwd-input").focus();
    } else {
      document.getElementById("signup-email").textContent = email;
      showStep("signup");
      document.getElementById("name-input").focus();
    }
  })
  .catch(function() {
    showMsg("Cannot connect to server. Is it running?", "error");
  });
}

function submitPassword() {
  var password = document.getElementById("pwd-input").value;
  var remember = document.getElementById("remember-me").checked;
  if (!password) { showMsg("Please enter your password.", "error"); return; }
  fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: currentEmail, password: password, remember_me: remember })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) { showMsg(data.detail || "Login failed.", "error"); return; }
      saveAndRedirect(data);
    });
  })
  .catch(function() { showMsg("Cannot connect to server.", "error"); });
}

function submitSignup() {
  var name = document.getElementById("name-input").value.trim();
  var pwd  = document.getElementById("signup-pwd").value;
  if (!name) { showMsg("Please enter your name.", "error"); return; }
  if (pwd.length < 8) { showMsg("Password must be at least 8 characters.", "error"); return; }
  fetch(API + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, email: currentEmail, password: pwd })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) { showMsg(data.detail || "Signup failed.", "error"); return; }
      saveAndRedirect(data);
    });
  })
  .catch(function() { showMsg("Cannot connect to server.", "error"); });
}

function handleGoogleLogin() {
  fetch(API + "/auth/google")
  .then(function(res) { return res.json(); })
  .then(function(data) { if (data.url) window.location.href = data.url; })
  .catch(function() { showMsg("Cannot connect to server.", "error"); });
}

function sendPhoneOTP() {
  var raw = document.getElementById("phone-input").value.trim();
  var phone = raw.replace(/\s/g, '');
  if (phone.charAt(0) !== '+') { phone = '+' + phone; }
  if (!phone || phone.length < 10) {
    showMsg("Enter phone with country code. Example: +91 98765 43210", "error");
    return;
  }
  var btn = document.getElementById("send-otp-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
      size: "normal",
      callback: function() {}
    });
  }
  fbAuth.signInWithPhoneNumber(phone, window.recaptchaVerifier)
  .then(function(result) {
    window.confirmationResult = result;
    document.getElementById("otp-sent-to").textContent = "OTP sent to " + phone;
    showStep("otp");
    document.getElementById("otp-1").focus();
  })
  .catch(function(error) {
    showMsg("Failed to send OTP: " + error.message, "error");
    btn.disabled = false;
    btn.textContent = "Send OTP";
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

function verifyOTP() {
  var ids = ["otp-1","otp-2","otp-3","otp-4","otp-5","otp-6"];
  var otp = "";
  for (var i = 0; i < ids.length; i++) {
    otp += document.getElementById(ids[i]).value;
  }
  if (otp.length < 6) { showMsg("Please enter all 6 digits.", "error"); return; }
  var btn = document.querySelector("#step-otp .continue-btn");
  btn.disabled = true;
  btn.textContent = "Verifying...";
  window.confirmationResult.confirm(otp)
  .then(function(result) {
    return result.user.getIdToken().then(function(idToken) {
      return fetch(API + "/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebase_token: idToken })
      });
    });
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) { showMsg(data.detail || "Verification failed.", "error"); return; }
      saveAndRedirect(data);
    });
  })
  .catch(function() {
    showMsg("Invalid OTP. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Verify OTP";
  });
}

function submitForgot() {
  var email = document.getElementById("forgot-email").value.trim();
  if (!email) { showMsg("Please enter your email.", "error"); return; }
  fetch(API + "/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email })
  })
  .then(function() { showMsg("Reset link sent! Check your email.", "success"); })
  .catch(function() { showMsg("Cannot connect to server.", "error"); });
}

// Init on page load
(function() {
  var t = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
  var btn = document.getElementById("theme-btn");
  if (btn) btn.textContent = t === "dark" ? "sun" : "moon";
  if (localStorage.getItem("tb_token")) window.location.href = "index.html";
})();