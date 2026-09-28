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

var currentOtpMode = "phone"; // "phone" or "email"
var emailOtpVerified = false;

function checkEmail() {
  var email = document.getElementById("email-input").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showMsg("Please enter a valid email.", "error");
    return;
  }
  currentEmail = email;

  var continueBtn = document.querySelector("#step-main .continue-btn");
  if (continueBtn) {
    continueBtn.disabled = true;
    continueBtn.textContent = "Checking...";
  }

  fetch(API + "/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = "Continue";
    }
    if (data.exists) {
      // Existing verified account -> Ask password directly (no OTP needed)
      document.getElementById("pwd-email").textContent = email;
      showStep("password");
      document.getElementById("pwd-input").focus();
    } else {
      // New email -> Send 6-digit verification code to email, then ask password
      currentOtpMode = "email";
      emailOtpVerified = false;
      sendEmailVerificationOTP(email);
    }
  })
  .catch(function() {
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = "Continue";
    }
    showMsg("Cannot connect to server. Is it running?", "error");
  });
}

function sendEmailVerificationOTP(email) {
  showMsg("Sending verification code to " + email + "...", "info");
  fetch(API + "/auth/email/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) {
        showMsg(data.detail || "Failed to send verification email.", "error");
        return;
      }
      currentOtpMode = "email";
      document.getElementById("otp-modal-title").textContent = "Verify your email";
      document.getElementById("otp-sent-to").textContent = "Verification code sent to " + email;
      showStep("otp");
      clearOtpInputs();
      document.getElementById("otp-1").focus();
    });
  })
  .catch(function() {
    showMsg("Cannot connect to server. Is it running?", "error");
  });
}

function clearOtpInputs() {
  var ids = ["otp-1","otp-2","otp-3","otp-4","otp-5","otp-6"];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.readOnly = false;
      el.classList.remove("in-orbit");
      el.classList.remove("collapsed");
      el.style.transform = "";
      el.style.opacity = "";
    }
  });
  var stage = document.getElementById("otp-stage");
  if (stage) {
    stage.classList.remove("is-verifying");
    stage.classList.remove("is-success");
  }
  var radarRings = document.getElementById("otp-radar-rings");
  if (radarRings) {
    radarRings.classList.remove("active");
    radarRings.classList.remove("success");
  }
  var orbitCont = document.getElementById("otp-orbit-container");
  if (orbitCont) {
    orbitCont.classList.remove("orbiting");
    orbitCont.classList.remove("spinning");
  }
  var badge = document.getElementById("otp-success-badge");
  if (badge) badge.classList.remove("show");
  var btn = document.getElementById("verify-otp-btn");
  if (btn) {
    btn.style.display = "";
    btn.disabled = false;
    btn.textContent = "Verify OTP";
  }
  var footerWrap = document.getElementById("otp-footer-wrap");
  if (footerWrap) {
    footerWrap.className = "";
    footerWrap.innerHTML = 'Did not receive? <a href="#" style="color:var(--accent)" id="otp-resend-link" onclick="handleOtpResend(event)">Resend</a>';
  }
}

function handleOtpBack() {
  if (currentOtpMode === "email") {
    showStep("main");
    var emailInput = document.getElementById("email-input");
    if (emailInput) emailInput.focus();
  } else {
    showStep("phone");
    var phoneInput = document.getElementById("phone-input");
    if (phoneInput) phoneInput.focus();
  }
}

function handleOtpResend(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (currentOtpMode === "email") {
    if (currentEmail) {
      sendEmailVerificationOTP(currentEmail);
    } else {
      showStep("main");
    }
  } else {
    showStep("phone");
  }
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
    currentOtpMode = "phone";
    document.getElementById("otp-modal-title").textContent = "Enter OTP";
    document.getElementById("otp-sent-to").textContent = "OTP sent to " + selectedCountry.flag + " " + fullPhone;
    showStep("otp");
    clearOtpInputs();
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
  if (current.value.length >= 1) {
    if (nextId) {
      var nextEl = document.getElementById(nextId);
      if (nextEl) nextEl.focus();
    } else {
      // All 6 digits entered -> auto-verify like in the video
      var ids = ["otp-1","otp-2","otp-3","otp-4","otp-5","otp-6"];
      var isFull = ids.every(function(id) {
        var el = document.getElementById(id);
        return el && el.value.length >= 1;
      });
      if (isFull) {
        verifyOTP();
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var inputs = document.querySelectorAll(".otp-input");
  inputs.forEach(function(input, idx) {
    input.addEventListener("focus", function() {
      inputs.forEach(function(i) { i.classList.remove("active-glow"); });
      input.classList.add("active-glow");
    });
    input.addEventListener("blur", function() {
      input.classList.remove("active-glow");
    });
    input.addEventListener("keydown", function(e) {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
    });
  });
});

var origOtpSubtitle = "";
var otpOrbitTimer = null;

// Orbit offsets for 6 items in a circle (Radius = 56px)
var sixPositions = [
  { x: 0, y: -56 },
  { x: 48, y: -28 },
  { x: 48, y: 28 },
  { x: 0, y: 56 },
  { x: -48, y: 28 },
  { x: -48, y: -28 }
];

function startOtpAnimation() {
  var stage = document.getElementById("otp-stage");
  var title = document.getElementById("otp-modal-title");
  var sub = document.getElementById("otp-sent-to");
  var btn = document.getElementById("verify-otp-btn");
  var orbitCont = document.getElementById("otp-orbit-container");
  var radarRings = document.getElementById("otp-radar-rings");
  var inputs = document.querySelectorAll(".otp-input");

  if (!origOtpSubtitle && sub) {
    origOtpSubtitle = sub.textContent;
  }

  if (stage) stage.classList.add("is-verifying");
  if (title) title.textContent = "Verifying...";
  if (sub) sub.textContent = "Processing security authentication";
  if (btn) btn.style.display = "none";

  if (orbitCont) orbitCont.classList.add("orbiting");
  if (radarRings) radarRings.classList.add("active");

  inputs.forEach(function(inp, idx) {
    inp.classList.add("in-orbit");
    inp.readOnly = true;
    inp.style.transform = "translate(" + sixPositions[idx].x + "px, " + sixPositions[idx].y + "px)";
  });

  otpOrbitTimer = setTimeout(function() {
    if (orbitCont) orbitCont.classList.add("spinning");
  }, 420);
}

function stopOtpAnimation(errorMsg) {
  clearTimeout(otpOrbitTimer);
  var stage = document.getElementById("otp-stage");
  var title = document.getElementById("otp-modal-title");
  var sub = document.getElementById("otp-sent-to");
  var btn = document.getElementById("verify-otp-btn");
  var orbitCont = document.getElementById("otp-orbit-container");
  var radarRings = document.getElementById("otp-radar-rings");
  var inputs = document.querySelectorAll(".otp-input");
  var inputsRow = document.getElementById("otp-inputs-row");

  if (orbitCont) {
    orbitCont.classList.remove("spinning");
    orbitCont.classList.remove("orbiting");
  }
  if (radarRings) radarRings.classList.remove("active");
  if (stage) stage.classList.remove("is-verifying");

  inputs.forEach(function(inp) {
    inp.classList.remove("in-orbit");
    inp.readOnly = false;
    inp.style.transform = "";
  });

  if (title) title.textContent = "Enter OTP";
  if (sub && origOtpSubtitle) sub.textContent = origOtpSubtitle;
  if (btn) {
    btn.style.display = "";
    btn.disabled = false;
    btn.textContent = "Verify OTP";
  }

  if (inputsRow) {
    inputsRow.classList.remove("otp-stage-shake");
    void inputsRow.offsetWidth;
    inputsRow.classList.add("otp-stage-shake");
  }

  if (errorMsg) {
    showMsg(errorMsg, "error");
  }

  var firstInput = document.getElementById("otp-1");
  if (firstInput) firstInput.focus();
}

function playOtpSuccessAnimation(onComplete) {
  clearTimeout(otpOrbitTimer);
  var stage = document.getElementById("otp-stage");
  var title = document.getElementById("otp-modal-title");
  var sub = document.getElementById("otp-sent-to");
  var orbitCont = document.getElementById("otp-orbit-container");
  var radarRings = document.getElementById("otp-radar-rings");
  var successBadge = document.getElementById("otp-success-badge");
  var footerWrap = document.getElementById("otp-footer-wrap");
  var inputs = document.querySelectorAll(".otp-input");

  if (orbitCont) orbitCont.classList.remove("spinning");
  if (stage) {
    stage.classList.remove("is-verifying");
    stage.classList.add("is-success");
  }

  if (title) {
    title.textContent = "Verified Successfully";
    title.classList.add("otp-success-title");
  }
  if (sub) {
    sub.textContent = "Your number has been verified.";
  }

  if (radarRings) radarRings.classList.add("success");

  inputs.forEach(function(inp) {
    inp.classList.add("collapsed");
    inp.style.transform = "translate(0, 0) scale(0)";
    inp.style.opacity = "0";
  });

  setTimeout(function() {
    if (successBadge) {
      successBadge.classList.add("show");
      launchStageConfetti();
    }
  }, 180);

  if (footerWrap) {
    footerWrap.className = "otp-footer-verified";
    footerWrap.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Verified and Secure</span>';
  }

  setTimeout(function() {
    if (typeof onComplete === "function") onComplete();
  }, 1600);
}

function launchStageConfetti() {
  var canvas = document.getElementById("otp-confetti-canvas");
  if (!canvas) return;
  var stage = document.getElementById("otp-stage");
  var rect = stage.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  var ctx = canvas.getContext("2d");
  var particles = [];
  var colors = ["#22c55e", "#86efac", "#fef08a", "#ffffff", "#fb7185", "#34d399"];
  var cx = canvas.width / 2;
  var cy = canvas.height / 2;

  for (var i = 0; i < 44; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 2.0 + Math.random() * 4.4;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3.5 + 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.014 + Math.random() * 0.015,
      isRect: Math.random() > 0.55
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = 0;
    particles.forEach(function(p) {
      if (p.alpha > 0.01) {
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.vy += 0.04;
        p.alpha -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.isRect) {
          ctx.fillRect(p.x - p.size, p.y - p.size / 2, p.size * 1.5, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
    if (alive > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(frame);
}

var pendingPhoneAuthData = null;
var pendingFirebaseIdToken = null;

function verifyOTP() {
  var ids = ["otp-1","otp-2","otp-3","otp-4","otp-5","otp-6"];
  var otp = "";
  for (var i = 0; i < ids.length; i++) {
    var val = document.getElementById(ids[i]).value;
    if (val) otp += val;
  }
  if (otp.length < 6) {
    showMsg("Please enter all 6 digits.", "error");
    return;
  }

  startOtpAnimation();

  // If verifying email OTP
  if (currentOtpMode === "email") {
    fetch(API + "/auth/email/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentEmail, otp: otp })
    })
    .then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) {
          stopOtpAnimation(data.detail || "Invalid verification code.");
          return;
        }
        emailOtpVerified = true;
        playOtpSuccessAnimation(function() {
          // Email verified! Now prompt user to set their password (and name) to complete signup
          document.getElementById("signup-email").textContent = currentEmail;
          showStep("signup");
          var nameInput = document.getElementById("name-input");
          if (nameInput) nameInput.focus();
        });
      });
    })
    .catch(function() {
      stopOtpAnimation("Cannot connect to server. Please try again.");
    });
    return;
  }

  // Otherwise, verifying phone OTP with Firebase
  window.confirmationResult.confirm(otp)
  .then(function(result) {
    return result.user.getIdToken().then(function(idToken) {
      pendingFirebaseIdToken = idToken;
      return fetch(API + "/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebase_token: idToken })
      });
    });
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) {
        stopOtpAnimation(data.detail || "Verification failed.");
        return;
      }
      pendingPhoneAuthData = data;
      playOtpSuccessAnimation(function() {
        // If the user's name is not yet set (or is just their phone number), ask for their name
        var isPhoneName = !data.name || data.name === data.phone || data.name.startsWith("+");
        if (isPhoneName) {
          showStep("name");
          var nameInput = document.getElementById("phone-user-name");
          if (nameInput) {
            nameInput.value = "";
            nameInput.focus();
          }
        } else {
          saveAndRedirect(data);
        }
      });
    });
  })
  .catch(function(err) {
    stopOtpAnimation("Invalid OTP. Please try again.");
  });
}


function submitPhoneUserName() {
  var input = document.getElementById("phone-user-name");
  var name = (input ? input.value : "").trim();
  if (!name) {
    showMsg("Please enter your name.", "error");
    if (input) input.focus();
    return;
  }

  var btn = document.getElementById("phone-name-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }

  if (pendingFirebaseIdToken) {
    fetch(API + "/auth/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firebase_token: pendingFirebaseIdToken,
        name: name
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Continue";
      }
      saveAndRedirect(data);
    })
    .catch(function(err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Continue";
      }
      // Fallback with pendingPhoneAuthData updated with the chosen name
      if (pendingPhoneAuthData) {
        pendingPhoneAuthData.name = name;
        saveAndRedirect(pendingPhoneAuthData);
      } else {
        showMsg("Failed to save name. Please try again.", "error");
      }
    });
  } else if (pendingPhoneAuthData) {
    pendingPhoneAuthData.name = name;
    saveAndRedirect(pendingPhoneAuthData);
  }
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
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("step") === "otp") {
    showStep("otp");
  }
})();