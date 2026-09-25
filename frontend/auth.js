// auth.js - TokenBridge Login Logic

var API = (window.location.port === "8000") ? "" : "http://localhost:8000";
var currentEmail = "";

function toggleTheme() {
  var html = document.documentElement;
  var isDark = html.getAttribute("data-theme") === "dark";
  var newTheme = isDark ? "light" : "dark";
  html.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateAuthThemeIcon(newTheme);
}

function updateAuthThemeIcon(theme) {
  var btn = document.getElementById("theme-btn");
  if (btn) btn.textContent = theme === "dark" ? "🌙" : "☀️";
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

var COUNTRIES = [
  { name: "India", code: "IN", dial: "+91", flag: "🇮🇳", placeholder: "98765 43210" },
  { name: "United States", code: "US", dial: "+1", flag: "🇺🇸", placeholder: "202 555 0123" },
  { name: "United Kingdom", code: "GB", dial: "+44", flag: "🇬🇧", placeholder: "7911 123456" },
  { name: "Canada", code: "CA", dial: "+1", flag: "🇨🇦", placeholder: "416 555 0199" },
  { name: "Australia", code: "AU", dial: "+61", flag: "🇦🇺", placeholder: "412 345 678" },
  { name: "Germany", code: "DE", dial: "+49", flag: "🇩🇪", placeholder: "1512 3456789" },
  { name: "France", code: "FR", dial: "+33", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { name: "United Arab Emirates", code: "AE", dial: "+971", flag: "🇦🇪", placeholder: "50 123 4567" },
  { name: "Singapore", code: "SG", dial: "+65", flag: "🇸🇬", placeholder: "8123 4567" },
  { name: "Japan", code: "JP", dial: "+81", flag: "🇯🇵", placeholder: "90 1234 5678" },
  { name: "Brazil", code: "BR", dial: "+55", flag: "🇧🇷", placeholder: "11 91234 5678" },
  { name: "Russia", code: "RU", dial: "+7", flag: "🇷🇺", placeholder: "912 345 67 89" },
  { name: "China", code: "CN", dial: "+86", flag: "🇨🇳", placeholder: "138 0013 8000" },
  { name: "Saudi Arabia", code: "SA", dial: "+966", flag: "🇸🇦", placeholder: "50 123 4567" },
  { name: "Spain", code: "ES", dial: "+34", flag: "🇪🇸", placeholder: "612 34 56 78" },
  { name: "Italy", code: "IT", dial: "+39", flag: "🇮🇹", placeholder: "312 345 6789" },
  { name: "Netherlands", code: "NL", dial: "+31", flag: "🇳🇱", placeholder: "6 12345678" },
  { name: "South Africa", code: "ZA", dial: "+27", flag: "🇿🇦", placeholder: "71 123 4567" },
  { name: "Nigeria", code: "NG", dial: "+234", flag: "🇳🇬", placeholder: "802 123 4567" },
  { name: "Indonesia", code: "ID", dial: "+62", flag: "🇮🇩", placeholder: "812 3456 7890" }
];

var selectedCountry = COUNTRIES[0];

function initCountrySelector() {
  renderCountryList(COUNTRIES);

  document.addEventListener("click", function(e) {
    var wrap = document.getElementById("country-code-wrap");
    var menu = document.getElementById("country-dropdown-menu");
    if (wrap && menu && !wrap.contains(e.target)) {
      menu.style.display = "none";
      wrap.classList.remove("open");
    }
  });
}

function renderCountryList(list) {
  var container = document.getElementById("country-list");
  if (!container) return;
  container.innerHTML = "";

  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "country-item" + (c.code === selectedCountry.code ? " active" : "");
    btn.innerHTML =
      '<div class="country-item-left">' +
        '<span>' + c.flag + '</span>' +
        '<span>' + c.name + '</span>' +
      '</div>' +
      '<span class="country-item-dial">' + c.dial + '</span>';
    btn.onclick = (function(country) {
      return function() { selectCountry(country); };
    })(c);
    container.appendChild(btn);
  }
}

function toggleCountryDropdown(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  var wrap = document.getElementById("country-code-wrap");
  var menu = document.getElementById("country-dropdown-menu");
  if (!menu || !wrap) return;

  var isVisible = menu.style.display === "block";
  if (isVisible) {
    menu.style.display = "none";
    wrap.classList.remove("open");
  } else {
    menu.style.display = "block";
    wrap.classList.add("open");
    var search = document.getElementById("country-search-input");
    if (search) {
      search.value = "";
      renderCountryList(COUNTRIES);
      search.focus();
    }
  }
}

function selectCountry(country) {
  selectedCountry = country;
  var flag = document.getElementById("selected-flag");
  var dial = document.getElementById("selected-dial");
  var input = document.getElementById("phone-input");
  var wrap = document.getElementById("country-code-wrap");
  var menu = document.getElementById("country-dropdown-menu");

  if (flag) flag.textContent = country.flag;
  if (dial) dial.textContent = country.dial;
  if (input) {
    input.placeholder = country.placeholder;
    input.focus();
  }
  if (menu) menu.style.display = "none";
  if (wrap) wrap.classList.remove("open");
}

function filterCountryList(query) {
  var q = (query || "").trim().toLowerCase();
  var filtered = COUNTRIES.filter(function(c) {
    return c.name.toLowerCase().indexOf(q) !== -1 ||
           c.dial.indexOf(q) !== -1 ||
           c.code.toLowerCase().indexOf(q) !== -1;
  });
  renderCountryList(filtered);
}

function formatPhoneNumberInput(input) {
  var val = input.value.replace(/\D/g, "");
  if (val.length > 13) {
    val = val.substring(0, 13);
  }
  var formatted = val;
  if (val.length > 5) {
    formatted = val.substring(0, 5) + " " + val.substring(5);
  }
  input.value = formatted;
}

function sendPhoneOTP() {
  var input = document.getElementById("phone-input");
  var digits = input.value.replace(/\D/g, "");

  if (!digits || digits.length < 7) {
    showMsg("Please enter a valid phone number for " + selectedCountry.name + ".", "error");
    input.focus();
    return;
  }

  var fullPhone = selectedCountry.dial + digits;
  var btn = document.getElementById("send-otp-btn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  // Quick invisible reCAPTCHA (zero clicks/puzzle needed, runs instantly in background)
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
      size: "invisible",
      callback: function() {}
    });
  }

  fbAuth.signInWithPhoneNumber(fullPhone, window.recaptchaVerifier)
  .then(function(result) {
    window.confirmationResult = result;
    document.getElementById("otp-sent-to").textContent = "OTP sent to " + selectedCountry.flag + " " + fullPhone;
    showStep("otp");
    document.getElementById("otp-1").focus();
    btn.disabled = false;
    btn.textContent = "Send OTP";
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
  if (current.value.length >= 1 && nextId) {
    document.getElementById(nextId).focus();
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var inputs = document.querySelectorAll(".otp-input");
  inputs.forEach(function(input, idx) {
    input.addEventListener("keydown", function(e) {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
    });
  });
});

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
  var t = localStorage.getItem("theme");
  if (!t) {
    t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-theme", t);
  updateAuthThemeIcon(t);
  initCountrySelector();
  if (localStorage.getItem("tb_token")) window.location.href = "index.html";
})();