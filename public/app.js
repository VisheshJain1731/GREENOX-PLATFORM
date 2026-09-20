/**
 * GREENOX — Next-Generation Eco-Clean & Municipal Management
 * Complete Frontend Application Logic with Multi-Role Portals,
 * Government vs Private Employee Separation, 2-Choice Organization View,
 * Citizen History & Emergency Tracking, False Emergency Reporting, and Dark Theme.
 */

// Global State
let currentRole = 'citizen';
let currentAuthMode = 'login';
let currentUser = null;
let currentTheme = 'light';
let currentCitizenPoints = 0;
let citizenVouchers = [];
let citizenPointsHistory = [];
let selectedWastePhotoBase64 = '';
let selectedFalsePhotoBase64 = '';
let selectedEmgResolvePhotoBase64 = '';
let selectedTaskResolvePhotoBase64 = '';
let loginLockoutInterval = null;
let sessionCheckInterval = null;
let reportMap = null, reportMarker = null;
let bookingMap = null, bookingMarker = null;
let emgMap = null, emgMarker = null;
let currentEmergencyType = 'same_location';
let employeePollingInterval = null;
let lastKnownEmergencyId = null;
let isTreeAddonSelected = false;
let lastSeenNotifIds = new Set();

let currentBookingPkg = {
  name: 'Home Deep Cleaning',
  price: 1499,
  baseFee: 1050,
  workerFee: 250,
  ecoFee: 120,
  platformFee: 79
};

// Pricing Packages Configuration
const CLEANING_PACKAGES = {
  'Home Deep Cleaning': { price: 1499, baseFee: 1050, workerFee: 250, ecoFee: 120, platformFee: 79 },
  'Kitchen and Washroom': { price: 999, baseFee: 680, workerFee: 180, ecoFee: 90, platformFee: 49 },
  'Corporate Office': { price: 1999, baseFee: 1400, workerFee: 350, ecoFee: 150, platformFee: 99 },
  'Post Construction': { price: 2999, baseFee: 2100, workerFee: 500, ecoFee: 250, platformFee: 149 },
  'Event and Banquet': { price: 4999, baseFee: 3500, workerFee: 850, ecoFee: 450, platformFee: 199 },
  'Hospital Sanitization': { price: 3999, baseFee: 2800, workerFee: 700, ecoFee: 350, platformFee: 149 },
  'Custom Cleaning': { price: 5499, baseFee: 3900, workerFee: 950, ecoFee: 450, platformFee: 199 },
  'Plant a Tree (Eco Initiative)': { price: 599, baseFee: 420, workerFee: 100, ecoFee: 50, platformFee: 29 }
};

// Default Geolocation Coordinates (Green City Center)
const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRoleTabs();
  checkExistingSession();
  loadSolvedShowcaseFeed();
});

// ==========================================================================
// 1. THEME SWITCHER LOGIC (LIGHT / DARK THEME)
// ==========================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('greenox_theme') || 'light';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('greenox_theme', theme);

  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    updateThemeIcons('fa-sun', 'Light Mode');
  } else {
    document.body.classList.remove('dark-theme');
    updateThemeIcons('fa-moon', 'Dark Mode');
  }
}

function updateThemeIcons(iconClass, text) {
  const buttons = document.querySelectorAll('.theme-toggle-btn');
  buttons.forEach(btn => {
    btn.setAttribute('title', `Switch to ${text}`);
    btn.setAttribute('aria-label', `Switch to ${text}`);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = `fa-solid ${iconClass}`;
    }
  });
  const textAuth = document.getElementById('themeTextAuth');
  if (textAuth) textAuth.textContent = text;
}

// ==========================================================================
// 2. PASSWORD SECURITY POLICY VALIDATOR (0-20 chars, digit, special char)
// ==========================================================================

function checkPasswordRequirements(val) {
  const ruleLength = document.getElementById('ruleLength');
  const ruleDigit = document.getElementById('ruleDigit');
  const ruleSpecial = document.getElementById('ruleSpecial');

  if (!ruleLength || !ruleDigit || !ruleSpecial) return;

  const hasLength = val.length > 0 && val.length <= 20;
  const hasDigit = /[0-9]/.test(val);
  const hasSpecial = /[^A-Za-z0-9]/.test(val);

  updateRuleUI(ruleLength, hasLength);
  updateRuleUI(ruleDigit, hasDigit);
  updateRuleUI(ruleSpecial, hasSpecial);
}

function updateRuleUI(el, isValid) {
  if (isValid) {
    el.classList.add('valid');
    el.querySelector('i').className = 'fa-solid fa-circle-check';
  } else {
    el.classList.remove('valid');
    el.querySelector('i').className = 'fa-regular fa-circle';
  }
}

// ==========================================================================
// 3. ROLE & AUTH TABS SWITCHING (EMPLOYEE, ORG, CITIZEN, ADMIN)
// ==========================================================================

function setPortalRole(role) {
  currentRole = role;

  // 1. Sync Top Navbar Role Tabs
  const roleButtons = document.querySelectorAll('#roleTabs .role-tab');
  roleButtons.forEach(b => {
    if (b.getAttribute('data-role') === role) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // 2. Sync Card Role Tiles & Modal Pills
  const cardRoleTiles = document.querySelectorAll('#cardRoleTabs .portal-role-tile, #modalRoleTabs .modal-role-pill');
  cardRoleTiles.forEach(b => {
    if (b.getAttribute('data-role') === role) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // 3. Update Text Display
  const roleText = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
  const currentRoleEl = document.getElementById('currentRoleText');
  if (currentRoleEl) currentRoleEl.textContent = roleText;

  // 4. Update Role-specific form fields
  updateRoleSpecificFormFields();
  hideAuthAlert();
}

function updateRoleSpecificFormFields() {
  const adminKeyGroup = document.getElementById('adminKeyGroup');
  const empExtra = document.getElementById('employeeExtraFields');
  const orgExtra = document.getElementById('orgExtraFields');
  const googleSection = document.getElementById('googleAuthSection');

  if (currentRole === 'admin') {
    if (currentAuthMode === 'register' && adminKeyGroup) adminKeyGroup.classList.remove('hidden');
    if (googleSection) googleSection.classList.add('hidden'); // Admin cannot use Google
    if (empExtra) empExtra.classList.add('hidden');
    if (orgExtra) orgExtra.classList.add('hidden');
  } else {
    if (adminKeyGroup) adminKeyGroup.classList.add('hidden');
    if (googleSection) googleSection.classList.remove('hidden');

    if (currentRole === 'employee') {
      if (empExtra && currentAuthMode === 'register') empExtra.classList.remove('hidden');
      if (orgExtra) orgExtra.classList.add('hidden');
    } else if (currentRole === 'organization') {
      if (orgExtra && currentAuthMode === 'register') orgExtra.classList.remove('hidden');
      if (empExtra) empExtra.classList.add('hidden');
    } else {
      if (empExtra) empExtra.classList.add('hidden');
      if (orgExtra) orgExtra.classList.add('hidden');
    }
  }
}

function initRoleTabs() {
  // Top Navbar Role Tabs
  const roleButtons = document.querySelectorAll('#roleTabs .role-tab');
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-role');
      setPortalRole(role);
      const card = document.getElementById('authMainCard');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // Card Role Tiles (Matching Reference Image)
  const cardRoleTiles = document.querySelectorAll('#cardRoleTabs .portal-role-tile, #modalRoleTabs .modal-role-pill');
  cardRoleTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      const role = tile.getAttribute('data-role');
      setPortalRole(role);
    });
  });

  // Global escape key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
    }
  });

  // Navbar scroll detection for frosted glass effect
  window.addEventListener('scroll', () => {
    const isScrolled = window.scrollY > 20;
    const landingNav = document.querySelector('.landing-navbar');
    const mainNav = document.querySelector('.main-navbar');
    const empNav = document.querySelector('.employee-navbar');
    const orgNav = document.querySelector('.org-navbar');
    const adminNav = document.querySelector('.admin-topbar');
    if (landingNav) landingNav.classList.toggle('scrolled', isScrolled);
    if (mainNav) mainNav.classList.toggle('scrolled', isScrolled);
    if (empNav) empNav.classList.toggle('scrolled', isScrolled);
    if (orgNav) orgNav.classList.toggle('scrolled', isScrolled);
    if (adminNav) adminNav.classList.toggle('scrolled', isScrolled);
  });
}

function openAuthModal(mode = 'register', role = null) {
  if (role) {
    setPortalRole(role);
  }
  if (mode) {
    switchAuthMode(mode);
  }
  const card = document.getElementById('authMainCard');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const targetInput = mode === 'login' ? document.getElementById('loginPhone') : document.getElementById('regFirstName');
      if (targetInput) targetInput.focus();
    }, 120);
  }
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  hideAuthAlert();
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const loginBtn = document.getElementById('tabLoginBtn');
  const registerBtn = document.getElementById('tabRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (!loginBtn || !registerBtn || !loginForm || !registerForm) return;

  if (mode === 'login') {
    loginBtn.classList.add('active');
    registerBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    registerBtn.classList.add('active');
    loginBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
  updateRoleSpecificFormFields();
  hideAuthAlert();
}

function scrollToAuth(mode) {
  openAuthModal(mode || 'register');
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function showAuthAlert(message, type = 'error') {
  const alertBox = document.getElementById('authAlert');
  alertBox.className = `alert-box ${type}`;
  alertBox.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${message}</span>`;
  alertBox.classList.remove('hidden');
}

function hideAuthAlert() {
  const alertBox = document.getElementById('authAlert');
  alertBox.classList.add('hidden');
}

// ==========================================================================
// 4. GOOGLE AUTH QUICK REGISTRATION
// ==========================================================================

function triggerGoogleRegistration() {
  document.getElementById('googleAuthModal').classList.remove('hidden');
}

function selectGoogleAccount(firstName, surname, email, phone) {
  closeModal('googleAuthModal');
  document.getElementById('regFirstName').value = firstName;
  document.getElementById('regSurname').value = surname;
  document.getElementById('regEmail').value = email;
  document.getElementById('regPhone').value = phone;
  document.getElementById('regPassword').value = 'Google@2026';
  document.getElementById('regConfirmPassword').value = 'Google@2026';
  checkPasswordRequirements('Google@2026');

  if (currentRole === 'employee') {
    document.getElementById('regAadhaar').value = '9876543210';
  }
  if (currentRole === 'organization') {
    document.getElementById('regOrgId').value = 'ORG-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('regOrgName').value = firstName + ' Enterprise Solutions';
  }

  showToast(`Google Profile Connected: ${firstName} ${surname} (${email})`, 'success');
}

// ==========================================================================
// 5. REGISTRATION & LOGIN API CALLS
// ==========================================================================

async function handleRegister(event) {
  event.preventDefault();
  hideAuthAlert();

  const firstName = document.getElementById('regFirstName').value.trim();
  const surname = document.getElementById('regSurname').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const address = document.getElementById('regAddress').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const adminKey = document.getElementById('regAdminKey')?.value.trim() || '';
  const aadhaar = document.getElementById('regAadhaar')?.value.trim() || '';
  const employeeType = document.getElementById('regEmployeeType')?.value || 'govt';
  const orgId = document.getElementById('regOrgId')?.value.trim() || '';
  const orgName = document.getElementById('regOrgName')?.value.trim() || '';

  // Phone Number validation (must be exactly 10 digits)
  if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) {
    showAuthAlert('Registration failed: Phone number must be exactly 10 digits.', 'error');
    return;
  }

  // Password Policy check
  if (password.length === 0 || password.length > 20) {
    showAuthAlert('Password must be between 1 and 20 characters in length.', 'error');
    return;
  }
  if (!/[0-9]/.test(password)) {
    showAuthAlert('Password must contain at least one number (0-9).', 'error');
    return;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    showAuthAlert('Password must contain at least one special character (!@#$%^&*...).', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showAuthAlert('Confirm password does not match! Please check and try again.', 'error');
    return;
  }

  // Employee validation
  if (currentRole === 'employee') {
    if (!aadhaar || aadhaar.length !== 10 || !/^\d+$/.test(aadhaar)) {
      showAuthAlert('Employee Aadhaar Number must be exactly 10 digits.', 'error');
      return;
    }
  }

  // Organization validation
  if (currentRole === 'organization') {
    if (!orgId || !orgName) {
      showAuthAlert('Organization ID and Organization Name are required.', 'error');
      return;
    }
  }

  // Admin Key validation
  if (currentRole === 'admin' && !adminKey) {
    showAuthAlert('Admin registration key is required.', 'error');
    return;
  }

  const submitBtn = document.getElementById('registerSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Sending Verification Code...';

  // Store registration data for OTP verification step
  pendingRegistrationData = {
    first_name: firstName,
    surname: surname,
    phone: phone,
    email: email,
    address: address,
    password: password,
    confirm_password: confirmPassword,
    role: currentRole,
    admin_key: adminKey,
    aadhaar: aadhaar,
    employee_type: employeeType,
    org_id: orgId,
    org_name: orgName
  };

  try {
    const response = await fetch('/api/auth/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        first_name: firstName,
        role: currentRole
      })
    });

    const result = await response.json();

    if (result.success) {
      document.getElementById('otpTargetEmail').textContent = email;
      document.getElementById('otpCodeInput').value = '';
      hideOtpAlert();
      document.getElementById('emailOtpModal').classList.remove('hidden');
      startOtpTimer(30);

      if (result.dev_mode && result.dev_otp) {
        showOtpAlert(`ℹ️ Simulation Mode: Your verification code is <strong>${result.dev_otp}</strong>`, 'success');
      }

      showToast('Verification code sent to your email!', 'success');
      setTimeout(() => document.getElementById('otpCodeInput')?.focus(), 200);
    } else {
      showAuthAlert(result.message || 'Failed to send verification code. Please check your email.', 'error');
    }
  } catch (err) {
    showAuthAlert('Network error while requesting verification code. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Complete Registration';
  }
}

// ==========================================================================
// 5.1 RESEND.COM OTP VERIFICATION HANDLERS
// ==========================================================================

let pendingRegistrationData = null;
let otpCountdownTimer = null;

function showOtpAlert(message, type = 'error') {
  const alertBox = document.getElementById('otpAlertBox');
  if (!alertBox) return;
  alertBox.className = `alert-box ${type}`;
  alertBox.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${message}</span>`;
  alertBox.classList.remove('hidden');
}

function hideOtpAlert() {
  const alertBox = document.getElementById('otpAlertBox');
  if (alertBox) alertBox.classList.add('hidden');
}

function startOtpTimer(seconds = 30) {
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  
  let remaining = seconds;
  const timerText = document.getElementById('otpTimerText');
  const countdownEl = document.getElementById('otpCountdown');
  const resendBtn = document.getElementById('resendOtpBtn');

  if (timerText) timerText.classList.remove('hidden');
  if (resendBtn) resendBtn.classList.add('hidden');
  if (countdownEl) countdownEl.textContent = remaining;

  otpCountdownTimer = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = remaining;

    if (remaining <= 0) {
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
      if (timerText) timerText.classList.add('hidden');
      if (resendBtn) resendBtn.classList.remove('hidden');
    }
  }, 1000);
}

function closeEmailOtpModal() {
  closeModal('emailOtpModal');
  if (otpCountdownTimer) {
    clearInterval(otpCountdownTimer);
    otpCountdownTimer = null;
  }
}

async function handleResendOtp() {
  if (!pendingRegistrationData || !pendingRegistrationData.email) {
    showOtpAlert('No active registration session found. Please fill out the registration form again.', 'error');
    return;
  }

  const resendBtn = document.getElementById('resendOtpBtn');
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resending...';
  }

  try {
    const response = await fetch('/api/auth/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingRegistrationData.email,
        first_name: pendingRegistrationData.first_name,
        role: pendingRegistrationData.role
      })
    });

    const result = await response.json();

    if (result.success) {
      startOtpTimer(30);
      if (result.dev_mode && result.dev_otp) {
        showOtpAlert(`ℹ️ Simulation Mode: New verification code is <strong>${result.dev_otp}</strong>`, 'success');
      } else {
        showOtpAlert('A new verification code has been sent to your email.', 'success');
      }
      showToast('New verification code sent!', 'success');
    } else {
      showOtpAlert(result.message || 'Failed to resend verification code.', 'error');
    }
  } catch (err) {
    showOtpAlert('Network error while resending verification code.', 'error');
  } finally {
    if (resendBtn) {
      resendBtn.disabled = false;
      resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Resend Code';
    }
  }
}

async function handleVerifyAndRegister() {
  hideOtpAlert();

  const otpInput = document.getElementById('otpCodeInput');
  const otp = otpInput ? otpInput.value.trim() : '';

  if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    showOtpAlert('Please enter the complete 6-digit numeric verification code.', 'error');
    otpInput?.focus();
    return;
  }

  if (!pendingRegistrationData) {
    showOtpAlert('Registration session expired. Please fill out the registration form again.', 'error');
    return;
  }

  const verifyBtn = document.getElementById('verifyOtpSubmitBtn');
  verifyBtn.disabled = true;
  verifyBtn.querySelector('.btn-text').textContent = 'Verifying & Creating Account...';

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pendingRegistrationData,
        otp: otp
      })
    });

    const result = await response.json();

    if (result.success) {
      closeEmailOtpModal();
      showToast('Registration completed successfully!', 'success');
      showAuthAlert('Registration completed! You can now log in.', 'success');
      document.getElementById('loginPhone').value = pendingRegistrationData.phone;
      document.getElementById('loginEmail').value = pendingRegistrationData.email;
      pendingRegistrationData = null;
      setTimeout(() => switchAuthMode('login'), 1200);
    } else {
      showOtpAlert(result.message || 'Registration failed. Invalid or expired code.', 'error');
    }
  } catch (err) {
    showOtpAlert('Server error occurred during verification. Please try again.', 'error');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.querySelector('.btn-text').textContent = 'Verify & Create Account';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  hideAuthAlert();

  const phone = document.getElementById('loginPhone').value.trim();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const submitBtn = document.getElementById('loginSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Verifying...';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,
        email: email,
        password: password,
        role: currentRole
      })
    });

    const result = await response.json();

    if (result.success) {
      if (loginLockoutInterval) {
        clearInterval(loginLockoutInterval);
        loginLockoutInterval = null;
      }
      currentUser = result.user;
      localStorage.setItem('greenox_user', JSON.stringify(currentUser));
      showToast(`Welcome to GREENOX, ${currentUser.first_name}!`, 'success');
      transitionToDashboard(currentUser);
    } else if (result.locked) {
      startLoginLockoutTimer(result.remaining_seconds || 180, result.message);
    } else if (result.attempts_left !== undefined) {
      showAuthAlert(result.message || `Wrong details entered! Attempts remaining: ${result.attempts_left}/7.`, 'error');
    } else {
      showAuthAlert(result.message || 'Wrong details entered! Phone number, email, and password must match registered records.', 'error');
    }
  } catch (err) {
    showAuthAlert('Network error occurred during login.', 'error');
  } finally {
    if (!loginLockoutInterval) {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = 'Access Portal';
    }
  }
}

function startLoginLockoutTimer(seconds, message) {
  const submitBtn = document.getElementById('loginSubmitBtn');
  submitBtn.disabled = true;

  if (loginLockoutInterval) clearInterval(loginLockoutInterval);

  let remaining = seconds;
  const updateLockoutDisplay = () => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    submitBtn.querySelector('.btn-text').textContent = `Locked (${timeFormatted})`;
    showAuthAlert(`⚠️ 7 Failed Attempts! Login refused for 3 minutes. Please wait: <strong>${timeFormatted}</strong> remaining.`, 'error');

    if (remaining <= 0) {
      clearInterval(loginLockoutInterval);
      loginLockoutInterval = null;
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = 'Access Portal';
      showAuthAlert('Lockout expired! You may now try logging in again.', 'success');
    }
    remaining--;
  };

  updateLockoutDisplay();
  loginLockoutInterval = setInterval(updateLockoutDisplay, 1000);
}

function checkExistingSession() {
  const saved = localStorage.getItem('greenox_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      transitionToDashboard(currentUser);
    } catch (e) {
      localStorage.removeItem('greenox_user');
    }
  }
}

// ==========================================================================
// 6. DEDICATED PORTAL ROUTING (ADMIN, EMPLOYEE, ORG, CITIZEN)
// ==========================================================================

let currentGovtEmpTab = 'available';
let selectedCompletePhotoBase64 = '';

function transitionToDashboard(user) {
  closeAuthModal();
  // Hide all view pages first
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));

  if (employeePollingInterval) {
    clearInterval(employeePollingInterval);
    employeePollingInterval = null;
  }

  // 1. ADMIN DASHBOARD
  if (user.role === 'admin') {
    document.getElementById('adminDashboardPage').classList.add('active');
    document.getElementById('adminTopbarName').textContent = `${user.first_name} ${user.surname} (Admin)`;
    loadAdminData();
    startSessionStatusPolling();
    return;
  }

  // 2. EMPLOYEE DASHBOARD (GOVT vs PRIVATE)
  if (user.role === 'employee') {
    document.getElementById('employeeDashboardPage').classList.add('active');
    const fullName = `${user.first_name} ${user.surname}`.trim();
    document.getElementById('employeeTopName').textContent = fullName;
    
    // Set Profile popover details
    const empFullNameEl = document.getElementById('empProfileFullName');
    if (empFullNameEl) empFullNameEl.textContent = fullName;

    const empType = (user.employee_type || 'govt').toLowerCase();
    const isGovt = empType === 'govt';
    const roleText = isGovt ? 'Govt Municipal Employee' : 'Private Eco-Clean Squad';

    document.getElementById('employeeTypeBadge').textContent = isGovt ? 'Govt Employee' : 'Private Squad';
    document.getElementById('empNavbarBadge').textContent = isGovt ? 'Municipal Task Portal' : 'Private Operations Portal';
    
    const empRoleTag = document.getElementById('empProfileRoleTag');
    if (empRoleTag) empRoleTag.textContent = roleText;

    const empPhoneTag = document.getElementById('empProfilePhoneTag');
    if (empPhoneTag) empPhoneTag.innerHTML = `<i class="fa-solid fa-phone"></i> ${user.phone}`;

    const empEmailTag = document.getElementById('empProfileEmailTag');
    if (empEmailTag) empEmailTag.innerHTML = `<i class="fa-solid fa-envelope"></i> ${user.email}`;

    const empAadhaarTag = document.getElementById('empProfileAadhaarTag');
    if (empAadhaarTag) empAadhaarTag.textContent = user.aadhaar ? `Aadhaar: ${user.aadhaar}` : (user.org_id ? `Org ID: ${user.org_id}` : 'Official Identity Verified');

    const avatarSeed = encodeURIComponent(user.first_name + (user.surname || ''));
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=d1fae5`;
    const empAvatarImg = document.getElementById('empAvatarImg');
    const empPopoverAvatarImg = document.getElementById('empPopoverAvatarImg');
    if (empAvatarImg) empAvatarImg.src = avatarUrl;
    if (empPopoverAvatarImg) empPopoverAvatarImg.src = avatarUrl;

    if (isGovt) {
      document.getElementById('govtEmployeeView').classList.remove('hidden');
      document.getElementById('privateEmployeeView').classList.add('hidden');
      switchGovtEmpTab('available');
    } else {
      document.getElementById('govtEmployeeView').classList.add('hidden');
      document.getElementById('privateEmployeeView').classList.remove('hidden');
      switchPrivateEmpTab('bookings');
      startPrivateEmployeePolling();
    }

    loadEmployeeData();
    startSessionStatusPolling();
    return;
  }

  // 3. ORGANIZATION DASHBOARD (2 CHOICES ONLY)
  if (user.role === 'organization') {
    document.getElementById('organizationDashboardPage').classList.add('active');
    document.getElementById('orgTopName').textContent = user.org_name || `${user.first_name} ${user.surname}`;
    document.getElementById('orgIdBadge').textContent = user.org_id || 'ORG-ENTERPRISE';
    startSessionStatusPolling();
    return;
  }

  // 4. CITIZEN DASHBOARD
  document.getElementById('mainDashboardPage').classList.add('active');
  const fullName = `${user.first_name} ${user.surname}`.trim();
  document.getElementById('profileFullName').textContent = fullName;
  document.getElementById('profileRoleTag').textContent = user.role.toUpperCase();
  document.getElementById('profilePhoneTag').innerHTML = `<i class="fa-solid fa-phone"></i> ${user.phone}`;
  document.getElementById('profileEmailTag').innerHTML = `<i class="fa-solid fa-envelope"></i> ${user.email}`;
  document.getElementById('profileAddressText').textContent = user.address || 'Green City Central';

  const avatarSeed = encodeURIComponent(user.first_name + user.surname);
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=d1fae5`;
  document.getElementById('userAvatarImg').src = avatarUrl;
  document.getElementById('popoverAvatarImg').src = avatarUrl;

  document.getElementById('emgCallerName').value = fullName;
  document.getElementById('emgCallerPhone').value = user.phone;
  document.getElementById('emgAddressInput').value = user.address || '';

  loadSolvedShowcaseFeed();
  loadCitizenPoints();
  fetchUserNotifications();
  startSessionStatusPolling();
}

function startSessionStatusPolling() {
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);
  sessionCheckInterval = setInterval(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/session-status?email=${encodeURIComponent(currentUser.email)}&phone=${encodeURIComponent(currentUser.phone)}&role=${encodeURIComponent(currentUser.role)}`);
      const data = await res.json();
      if (!data.valid) {
        clearInterval(sessionCheckInterval);
        handleLogout(data.message || 'Session invalidated by Administrator.');
      } else if (currentUser.role === 'citizen') {
        if (data.greenox_points !== undefined && data.greenox_points !== currentCitizenPoints) {
          loadCitizenPoints();
        }
        fetchUserNotifications();
      }
    } catch (e) { }
  }, 8000);
}

function handleLogout(customMessage) {
  localStorage.removeItem('greenox_user');
  currentUser = null;
  if (employeePollingInterval) clearInterval(employeePollingInterval);
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);

  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.getElementById('authPage').classList.add('active');
  closeProfileMenu();
  closeEmployeeProfileMenu();
  showToast(customMessage || 'Logged out successfully.', 'info');
  if (customMessage) {
    showAuthAlert(customMessage, 'error');
  }
}

// Employee Profile Dropdown Controllers
function toggleEmployeeProfileMenu() {
  const popover = document.getElementById('employeeProfilePopover');
  if (popover) popover.classList.toggle('hidden');
}

function closeEmployeeProfileMenu() {
  const popover = document.getElementById('employeeProfilePopover');
  if (popover) popover.classList.add('hidden');
}

// Permanent Account Deletion Modal Handlers
function openEmployeeDeleteModal() {
  closeEmployeeProfileMenu();
  const alertBox = document.getElementById('empDeleteAlert');
  if (alertBox) alertBox.classList.add('hidden');
  const pwdInput = document.getElementById('empDeletePassword');
  if (pwdInput) pwdInput.value = '';
  document.getElementById('employeeDeleteModal').classList.remove('hidden');
}

async function submitEmployeePermanentDelete(event) {
  event.preventDefault();
  if (!currentUser) return;

  const password = document.getElementById('empDeletePassword').value;
  const alertBox = document.getElementById('empDeleteAlert');
  alertBox.classList.add('hidden');

  const submitBtn = document.getElementById('empConfirmDeleteBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying & Archiving...';

  try {
    const res = await fetch('/api/employee/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        phone: currentUser.phone,
        password: password,
        role: currentUser.role
      })
    });

    const data = await res.json();
    if (data.success) {
      closeModal('employeeDeleteModal');
      handleLogout('Your employee account has been permanently deleted. Performance record & statistics archived into Admin panel.');
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${data.message || 'Deletion failed. Incorrect password.'}</span>`;
      alertBox.classList.remove('hidden');
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Network error. Please try again.</span>`;
    alertBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Permanently Delete My Account';
  }
}

// ==========================================================================
// 7. EMPLOYEE PORTAL DATA & LOGIC (GOVT & PRIVATE SEPARATION)
// ==========================================================================

function switchGovtEmpTab(tab) {
  currentGovtEmpTab = tab;
  document.querySelectorAll('.g-emp-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.g-emp-sub-section').forEach(s => s.classList.add('hidden'));

  if (tab === 'available') {
    document.getElementById('gTabAvailableBtn')?.classList.add('active');
    document.getElementById('govtAvailableSection')?.classList.remove('hidden');
  } else if (tab === 'accepted') {
    document.getElementById('gTabAcceptedBtn')?.classList.add('active');
    document.getElementById('govtAcceptedSection')?.classList.remove('hidden');
  } else {
    document.getElementById('gTabSolvedBtn')?.classList.add('active');
    document.getElementById('govtSolvedSection')?.classList.remove('hidden');
  }
}

async function loadEmployeeData() {
  if (!currentUser || currentUser.role !== 'employee') return;
  const empType = (currentUser.employee_type || 'govt').toLowerCase();
  const empName = `${currentUser.first_name} ${currentUser.surname}`.trim();

  try {
    const res = await fetch(`/api/employee/data?type=${empType}&email=${encodeURIComponent(currentUser.email)}&phone=${encodeURIComponent(currentUser.phone)}&name=${encodeURIComponent(empName)}`);
    const data = await res.json();

    if (data.success) {
      if (empType === 'govt') {
        renderGovtAvailableTasks(data.available_tasks || []);
        renderGovtAcceptedTasks(data.my_accepted_tasks || []);
        renderGovtSolvedTasks(data.my_solved_tasks || []);

        const availCount = (data.available_tasks || []).length;
        const acceptCount = (data.my_accepted_tasks || []).length;
        const solvedCount = (data.my_solved_tasks || []).length;

        document.getElementById('govtPendingCount').textContent = `${availCount} Available`;
        document.getElementById('govtAvailableCount').textContent = availCount;
        document.getElementById('govtAcceptedCount').textContent = acceptCount;
        document.getElementById('govtSolvedCount').textContent = solvedCount;

        const statSolvedEl = document.getElementById('empProfileSolvedCount');
        if (statSolvedEl) statSolvedEl.textContent = solvedCount;
      } else {
        renderPrivateBookings(data.available_bookings || data.pending_tasks || []);
        renderPrivateEmergencies(data.emergencies || []);
        document.getElementById('privateBookingsBadge').textContent = (data.available_bookings || data.pending_tasks || []).length;
        document.getElementById('privateEmergenciesBadge').textContent = (data.emergencies || []).length;
        
        const statSolvedEl = document.getElementById('empProfileSolvedCount');
        if (statSolvedEl) statSolvedEl.textContent = data.solved_count || 0;
      }
    }
  } catch (err) {
    console.error('Failed to load employee data:', err);
  }
}

// 1. Available Pending Tasks (Has "Accept the Task" button)
function renderGovtAvailableTasks(tasks) {
  const tbody = document.getElementById('govtAvailableTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="fa-solid fa-circle-check text-green"></i> No pending unassigned municipal tasks at the moment. All caught up!</td></tr>`;
    return;
  }

  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td><strong>${t.headline}</strong><br><small class="text-muted">${t.address}</small></td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td><img src="${t.photo}" alt="Proof" class="table-photo-thumb" /></td>
      <td>${t.reporter_name}<br><small>${t.reporter_phone}</small></td>
      <td><span class="status-tag status-pending">${t.status}</span></td>
      <td>
        <button class="tbl-btn tbl-btn-accept" onclick="acceptEmployeeTask('${t.id}')">
          <i class="fa-solid fa-hand-holding-hand"></i> Accept the Task
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 2. My Accepted Tasks (Has "Task Completion" button)
function renderGovtAcceptedTasks(tasks) {
  const tbody = document.getElementById('govtAcceptedTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="fa-solid fa-list-check text-muted"></i> You have not accepted any active tasks. Click "Accept the Task" in the Available tab to start work.</td></tr>`;
    return;
  }

  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td><strong>${t.headline}</strong><br><small class="text-muted">${t.address}</small></td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td><img src="${t.photo}" alt="Proof" class="table-photo-thumb" /></td>
      <td>${t.reporter_name}<br><small><i class="fa-solid fa-phone"></i> ${t.reporter_phone}</small></td>
      <td><small class="text-gold"><i class="fa-regular fa-clock"></i> ${t.accepted_at || t.assigned_at || 'Recently'}</small></td>
      <td>
        <button class="tbl-btn tbl-btn-resolve" onclick="openCompleteTaskModal('${t.id}', '${encodeURIComponent(t.headline || t.address)}', '${t.waste_type}')">
          <i class="fa-solid fa-circle-check"></i> Task Completion
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. My Solved Tasks History
function renderGovtSolvedTasks(tasks) {
  const tbody = document.getElementById('govtSolvedTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="fa-solid fa-clock-rotate-left text-muted"></i> No completed task records yet. Complete accepted tasks to build your verified resolution record!</td></tr>`;
    return;
  }

  tasks.forEach(t => {
    const afterPhotoSrc = t.resolved_after_photo || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=400&q=80';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${t.id}</strong><br>
        <small class="text-muted"><i class="fa-regular fa-clock"></i> ${t.resolved_at || 'Recently'}</small>
      </td>
      <td><strong>${t.headline}</strong><br><small class="text-muted">${t.address}</small></td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td>
        <div class="solved-photos-pair">
          <div class="photo-thumb-wrap" title="Before Cleaning">
            <span class="photo-badge before">Before</span>
            <img src="${t.photo}" alt="Before" class="table-photo-thumb" />
          </div>
          <div class="photo-thumb-wrap" title="After Cleaning">
            <span class="photo-badge after">After</span>
            <img src="${afterPhotoSrc}" alt="After" class="table-photo-thumb" />
          </div>
        </div>
      </td>
      <td><strong class="text-main">${t.resolved_time_consumed || '30 mins'}</strong></td>
      <td>${t.reporter_name}<br><small>${t.reporter_phone}</small></td>
      <td><span class="status-tag status-resolved"><i class="fa-solid fa-check-double"></i> Cleaned</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Accept Task API Trigger
async function acceptEmployeeTask(taskId) {
  if (!currentUser) return;
  const fullName = `${currentUser.first_name} ${currentUser.surname}`.trim();

  try {
    const res = await fetch('/api/employee/accept-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        employee_name: fullName,
        employee_email: currentUser.email,
        employee_phone: currentUser.phone
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`✅ Task #${taskId} accepted! Moved to "My Accepted Tasks" tab.`, 'success');
      loadEmployeeData();
      switchGovtEmpTab('accepted');
    } else {
      showToast(data.message || 'Failed to accept task', 'error');
    }
  } catch (e) {
    showToast('Network error accepting task', 'error');
  }
}

// Task Completion Modal Controllers
function openCompleteTaskModal(taskId, encodedHeadline = '', wasteCategory = '') {
  document.getElementById('completeTaskId').value = taskId;
  const headline = encodedHeadline ? decodeURIComponent(encodedHeadline) : `Task #${taskId}`;
  document.getElementById('completeTaskHeadline').textContent = headline;
  document.getElementById('completeTaskCategory').textContent = wasteCategory || 'Municipal Waste';
  document.getElementById('completeTimeConsumed').value = '30 mins';
  document.getElementById('completeNotes').value = '';
  
  // Set default active pill
  setQuickDuration('30 mins');
  removeCompletePhoto();

  document.getElementById('completeTaskModal').classList.remove('hidden');
}

function setQuickDuration(durationStr) {
  document.getElementById('completeTimeConsumed').value = durationStr;
  document.querySelectorAll('.quick-duration-pills .duration-pill').forEach(btn => {
    if (btn.textContent.trim() === durationStr) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function handleCompletePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    selectedCompletePhotoBase64 = e.target.result;
    document.getElementById('completePhotoPreview').src = selectedCompletePhotoBase64;
    document.getElementById('completePhotoPreviewWrap').classList.remove('hidden');
    showToast('After-cleaning proof photo attached!', 'success');
  };
  reader.readAsDataURL(file);
}

function removeCompletePhoto() {
  selectedCompletePhotoBase64 = '';
  const wrap = document.getElementById('completePhotoPreviewWrap');
  if (wrap) wrap.classList.add('hidden');
  const gInput = document.getElementById('completeTaskGalleryInput');
  const cInput = document.getElementById('completeTaskCameraInput');
  if (gInput) gInput.value = '';
  if (cInput) cInput.value = '';
}

async function submitEmployeeTaskCompletion(event) {
  event.preventDefault();
  if (!currentUser) return;

  const taskId = document.getElementById('completeTaskId').value;
  const timeConsumed = document.getElementById('completeTimeConsumed').value.trim() || '30 mins';
  const notes = document.getElementById('completeNotes').value.trim();

  if (!selectedCompletePhotoBase64) {
    showToast('Please upload an after-cleaning proof photo to complete the task.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitCompleteTaskBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Completion...';

  const fullName = `${currentUser.first_name} ${currentUser.surname}`.trim();

  try {
    const res = await fetch('/api/employee/complete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        after_photo: selectedCompletePhotoBase64,
        time_consumed: timeConsumed,
        notes: notes,
        employee_name: fullName,
        employee_email: currentUser.email,
        employee_phone: currentUser.phone
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🎉 Task #${taskId} solved! +${data.awarded_points} Greenox Points awarded to citizen reporter.`, 'success');
      closeModal('completeTaskModal');
      removeCompletePhoto();
      loadEmployeeData();
      loadSolvedShowcaseFeed();
      switchGovtEmpTab('solved');
    } else {
      showToast(data.message || 'Failed to complete task', 'error');
    }
  } catch (e) {
    showToast('Network error completing task', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Submit Task Completion';
  }
}

function renderPrivateBookings(bookings) {
  const tbody = document.getElementById('privateBookingsTableBody');
  tbody.innerHTML = '';

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No pending private cleaning bookings.</td></tr>`;
    return;
  }

  bookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.id}</strong></td>
      <td><strong>${b.service_name}</strong><br><small class="text-green">Plan: ₹${b.service_price}</small></td>
      <td>${b.customer_name}<br><small>${b.customer_phone}</small></td>
      <td>${b.address}</td>
      <td>${b.timing_slot}</td>
      <td><strong>₹${b.service_price}</strong></td>
      <td>
        <button class="table-action-btn btn-resolve-spot" onclick="completePrivateBooking('${b.id}')">
          <i class="fa-solid fa-circle-check"></i> Complete Service
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function completePrivateBooking(bookingId) {
  try {
    const res = await fetch('/api/admin/update-booking-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, status: 'Completed' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Booking ${bookingId} marked completed!`, 'success');
      loadEmployeeData();
    }
  } catch (e) {
    showToast('Failed to complete booking', 'error');
  }
}

function renderPrivateEmergencies(emergencies) {
  const tbody = document.getElementById('privateEmergenciesTableBody');
  tbody.innerHTML = '';

  if (!emergencies || emergencies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-shield-halved text-green" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i><strong>All Clear!</strong><br><small>No active emergency SOS hazard calls nearby.</small></td></tr>`;
    return;
  }

  emergencies.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="emg-id-tag">${e.id}</span></td>
      <td>
        <strong style="color: var(--text-main); font-size: 0.94rem;">${e.headline}</strong>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">${e.emergency_details}</div>
      </td>
      <td>
        <div style="display: flex; align-items: flex-start; gap: 6px;">
          <i class="fa-solid fa-location-dot text-red" style="margin-top: 3px; font-size: 0.85rem;"></i>
          <span>${e.address}</span>
        </div>
      </td>
      <td>
        <strong>${e.caller_name}</strong>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
          <i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${e.caller_phone}
        </div>
      </td>
      <td><span class="status-tag status-emergency">${e.severity}</span></td>
      <td>
        <button class="table-action-btn btn-resolve-spot" onclick="openResolveEmergencyModal('${e.id}')">
          <i class="fa-solid fa-camera"></i> Reach Spot & Resolve
        </button>
        <button class="table-action-btn btn-false-report" onclick="openFalseEmergencyModal('${e.id}', '${e.lat}', '${e.lng}', '${e.address}')">
          <i class="fa-solid fa-triangle-exclamation"></i> Report False Emergency
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function switchPrivateEmpTab(tab) {
  document.querySelectorAll('.p-emp-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.p-emp-sub-section').forEach(s => s.classList.add('hidden'));

  if (tab === 'bookings') {
    document.getElementById('pTabBookingsBtn').classList.add('active');
    document.getElementById('privateBookingsSection').classList.remove('hidden');
  } else {
    document.getElementById('pTabEmergenciesBtn').classList.add('active');
    document.getElementById('privateEmergenciesSection').classList.remove('hidden');
  }
}

function startPrivateEmployeePolling() {
  if (employeePollingInterval) clearInterval(employeePollingInterval);
  employeePollingInterval = setInterval(async () => {
    if (!currentUser || currentUser.role !== 'employee' || currentUser.employee_type !== 'private') return;
    try {
      const res = await fetch('/api/employee/data?type=private');
      const data = await res.json();
      if (data.success && data.emergencies && data.emergencies.length > 0) {
        const latest = data.emergencies[0];
        if (latest.id !== lastKnownEmergencyId) {
          lastKnownEmergencyId = latest.id;
          triggerEmergencyPopup(latest);
        }
      }
    } catch (e) { }
  }, 6000);
}

function triggerEmergencyPopup(emergency) {
  const popup = document.getElementById('privateEmergencyPopup');
  document.getElementById('emgPopupDescription').textContent = `${emergency.headline} at ${emergency.address}`;
  popup.classList.remove('hidden');
}

function closeEmergencyPopup() {
  document.getElementById('privateEmergencyPopup').classList.add('hidden');
}

function focusNearbyEmergencies() {
  closeEmergencyPopup();
  switchPrivateEmpTab('emergencies');
}

// ==========================================================================
// 8. FALSE EMERGENCY REPORTING (GPS LOCATION MATCH & PROOF SNAP)
// ==========================================================================

let currentEmpGps = { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
let currentGpsMatchStatus = 'LOCATION NOT MATCHED';

function openFalseEmergencyModal(emgId, emgLat, emgLng, emgAddress) {
  document.getElementById('falseEmgId').value = emgId;
  document.getElementById('falseEmgLat').value = emgLat || DEFAULT_LAT;
  document.getElementById('falseEmgLng').value = emgLng || DEFAULT_LNG;
  document.getElementById('falseEmgAddress').value = emgAddress || 'Incident Location';
  document.getElementById('falseReasonInput').value = '';
  document.getElementById('falsePhotoPreviewWrap').classList.add('hidden');
  selectedFalsePhotoBase64 = '';

  document.getElementById('falseEmergencyModal').classList.remove('hidden');
  verifyEmployeeGPSMatch();
}

function verifyEmployeeGPSMatch() {
  const matchBadge = document.getElementById('gpsMatchBadge');
  const details = document.getElementById('gpsMatchDetails');
  const targetLat = parseFloat(document.getElementById('falseEmgLat').value) || DEFAULT_LAT;
  const targetLng = parseFloat(document.getElementById('falseEmgLng').value) || DEFAULT_LNG;

  matchBadge.className = 'status-tag';
  matchBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking GPS Coordinates...';

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        currentEmpGps = { lat, lng };

        // Calculate distance using Haversine Formula (in meters)
        const distMeters = calculateDistance(lat, lng, targetLat, targetLng);

        if (distMeters <= 300) {
          currentGpsMatchStatus = `GPS MATCHED ON SITE (${Math.round(distMeters)}m away)`;
          matchBadge.className = 'status-tag gps-matched';
          matchBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> GPS Verified On Site';
          details.innerHTML = `Employee GPS: (${lat.toFixed(4)}, ${lng.toFixed(4)}) aligns with Emergency Spot (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}). Distance: <strong>${Math.round(distMeters)}m</strong>.`;
        } else {
          currentGpsMatchStatus = `LOCATION NOT MATCHED (${(distMeters / 1000).toFixed(1)}km mismatch)`;
          matchBadge.className = 'status-tag gps-mismatch';
          matchBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> LOCATION NOT MATCHED';
          details.innerHTML = `Warning: Employee device is <strong>${(distMeters / 1000).toFixed(2)} km</strong> away from reported emergency spot. Location mismatch recorded in report file.`;
        }
      },
      err => {
        currentGpsMatchStatus = 'LOCATION NOT MATCHED (GPS Permission Denied)';
        matchBadge.className = 'status-tag gps-mismatch';
        matchBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> GPS LOCATION NOT MATCHED';
        details.innerHTML = 'Unable to verify device coordinates directly. Flagged as Location Not Matched.';
      }
    );
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function handleFalsePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    selectedFalsePhotoBase64 = e.target.result;
    document.getElementById('falsePhotoPreview').src = selectedFalsePhotoBase64;
    document.getElementById('falsePhotoPreviewWrap').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function submitFalseEmergencyReport(event) {
  event.preventDefault();

  const emgId = document.getElementById('falseEmgId').value;
  const reason = document.getElementById('falseReasonInput').value.trim();
  const address = document.getElementById('falseEmgAddress').value;

  if (!selectedFalsePhotoBase64) {
    showToast('Please upload a photo of the spot showing there is no emergency.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitFalseEmgBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Report...';

  try {
    const res = await fetch('/api/emergency/false-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emergency_id: emgId,
        employee_name: currentUser ? `${currentUser.first_name} ${currentUser.surname}` : 'Private Employee',
        employee_phone: currentUser ? currentUser.phone : '',
        employee_gps: `${currentEmpGps.lat.toFixed(4)}, ${currentEmpGps.lng.toFixed(4)}`,
        emergency_location: address,
        location_match_status: currentGpsMatchStatus,
        photo: selectedFalsePhotoBase64,
        reason: reason
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('False emergency report submitted to Admin Reports!', 'success');
      closeModal('falseEmergencyModal');
      loadEmployeeData();
    } else {
      showToast(data.message || 'Report failed', 'error');
    }
  } catch (e) {
    showToast('Network error filing report', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report to Admin';
  }
}

// ==========================================================================
// 9. EMERGENCY RESOLVE MODAL
// ==========================================================================

function openResolveEmergencyModal(emgId) {
  document.getElementById('resolveEmgId').value = emgId;
  document.getElementById('resolveEmergencyModal').classList.remove('hidden');
}

function handleEmgResolvePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    selectedEmgResolvePhotoBase64 = e.target.result;
    document.getElementById('emgResolvePreview').src = selectedEmgResolvePhotoBase64;
    document.getElementById('emgResolvePreviewWrap').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function submitEmergencyResolution(event) {
  event.preventDefault();
  const emgId = document.getElementById('resolveEmgId').value;
  const notes = document.getElementById('resolveEmgNotes').value;

  try {
    const res = await fetch('/api/emergency/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emergency_id: emgId,
        photo: selectedEmgResolvePhotoBase64,
        notes: notes,
        employee_name: currentUser ? `${currentUser.first_name} ${currentUser.surname}` : 'Private Responder'
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Emergency ${emgId} marked as Resolved!`, 'success');
      closeModal('resolveEmergencyModal');
      loadEmployeeData();
    }
  } catch (e) {
    showToast('Failed to resolve emergency', 'error');
  }
}

// ==========================================================================
// 10. ORGANIZATION PORTAL (2 CHOICES)
// ==========================================================================

function openOrgBookingModal() {
  openBookCleaningModal();
}

function openOrgRecycleNotice() {
  document.getElementById('orgRecycleNoticeModal').classList.remove('hidden');
}

// ==========================================================================
// 11. CITIZEN SERVICE HISTORY & EMERGENCY TRACKING
// ==========================================================================

async function openCitizenHistoryModal() {
  if (!currentUser) return;
  document.getElementById('citizenHistoryModal').classList.remove('hidden');
  switchCitizenHistTab('bookings');

  try {
    const res = await fetch(`/api/citizen/history?email=${encodeURIComponent(currentUser.email)}&phone=${encodeURIComponent(currentUser.phone)}`);
    const data = await res.json();

    if (data.success) {
      document.getElementById('citizenBookingCount').textContent = (data.bookings || []).length;
      document.getElementById('citizenReportCount').textContent = (data.tasks || []).length;
      document.getElementById('citizenEmgCount').textContent = (data.emergencies || []).length;

      renderCitizenBookings(data.bookings || []);
      renderCitizenReports(data.tasks || []);
      renderCitizenEmergencies(data.emergencies || []);
    }
  } catch (e) {
    showToast('Failed to load history', 'error');
  }
}

function switchCitizenHistTab(tab) {
  document.querySelectorAll('.hist-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.hist-tab-content').forEach(s => s.classList.add('hidden'));

  if (tab === 'bookings') {
    document.querySelector('.hist-tab:nth-child(1)').classList.add('active');
    document.getElementById('histBookingsSection').classList.remove('hidden');
  } else if (tab === 'reports') {
    document.querySelector('.hist-tab:nth-child(2)').classList.add('active');
    document.getElementById('histReportsSection').classList.remove('hidden');
  } else {
    document.querySelector('.hist-tab:nth-child(3)').classList.add('active');
    document.getElementById('histEmergenciesSection').classList.remove('hidden');
  }
}

function renderCitizenBookings(bookings) {
  const tbody = document.getElementById('citizenBookingsTableBody');
  tbody.innerHTML = '';
  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No cleaning bookings made yet.</td></tr>';
    return;
  }
  bookings.forEach(b => {
    const isTree = b.tree_planting_included || b.has_tree_planting || b.service_name.includes('Plant a Tree');
    const treeBadge = isTree ? `<br><span class="badge-pill badge-tree"><i class="fa-solid fa-seedling"></i> Tree Planting Included</span>` : '';
    let statusClass = 'status-confirmed';
    if (b.status === 'Closed (Heavy Load)') statusClass = 'status-closed';
    if (b.status === 'Completed') statusClass = 'status-resolved';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.id}</strong></td>
      <td><strong>${b.service_name}</strong>${treeBadge}</td>
      <td>${b.timing_slot}</td>
      <td>${b.address}</td>
      <td><strong class="text-green">₹${b.service_price}</strong></td>
      <td><span class="status-tag ${statusClass}">${b.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCitizenReports(tasks) {
  const tbody = document.getElementById('citizenReportsTableBody');
  tbody.innerHTML = '';
  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No waste reports submitted yet.</td></tr>';
    return;
  }
  tasks.forEach(t => {
    let statusClass = 'status-pending';
    if (t.status === 'Resolved') statusClass = 'status-resolved';
    if (t.status === 'Closed (Heavy Load)') statusClass = 'status-closed';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td>${t.address}</td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td><img src="${t.photo}" alt="Proof" class="table-photo-thumb" /></td>
      <td>${t.created_at || 'Recently'}</td>
      <td><span class="status-tag ${statusClass}">${t.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCitizenEmergencies(emergencies) {
  const container = document.getElementById('citizenEmergencyTimelineList');
  container.innerHTML = '';

  if (!emergencies || emergencies.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4"><i class="fa-solid fa-circle-check text-green"></i> No active or past emergency SOS requests.</div>';
    return;
  }

  emergencies.forEach(e => {
    const isResolved = e.status === 'RESOLVED';
    const isDispatched = e.status === 'DISPATCHED';
    const isFalseAlarm = e.status === 'FALSE_ALARM_REPORTED';

    const card = document.createElement('div');
    card.className = 'timeline-card';
    card.innerHTML = `
      <div class="timeline-header">
        <div>
          <strong class="text-red"><i class="fa-solid fa-triangle-exclamation"></i> ${e.id}</strong>
          <h4>${e.emergency_details}</h4>
          <span class="text-muted"><i class="fa-solid fa-location-dot"></i> ${e.address}</span>
        </div>
        <span class="status-tag ${isResolved ? 'status-resolved' : 'status-emergency'}">${e.status}</span>
      </div>

      <div class="timeline-steps-track">
        <div class="timeline-step completed"><i class="fa-solid fa-check"></i> 1. SOS Sent</div>
        <div class="timeline-step ${!isFalseAlarm ? 'completed' : ''}"><i class="fa-solid fa-check"></i> 2. Squad Dispatched</div>
        <div class="timeline-step ${isResolved ? 'completed' : (isDispatched ? 'active-step' : '')}">3. Team on Site</div>
        <div class="timeline-step ${isResolved ? 'completed' : ''}">${isResolved ? '4. Cleaned & Resolved' : (isFalseAlarm ? '4. False Alarm Closed' : '4. Resolution')}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================================================
// 12. ADMIN PORTAL DATA (WITH SOLVED COMPLAINTS & CLOSURE OPTIONS)
// ==========================================================================

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

  const targetTab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  } else if (typeof event !== 'undefined' && event && event.currentTarget && event.currentTarget.classList.contains('admin-tab')) {
    event.currentTarget.classList.add('active');
  }

  if (tabName === 'tasks') document.getElementById('adminTasksSection')?.classList.remove('hidden');
  if (tabName === 'solved') document.getElementById('adminSolvedSection')?.classList.remove('hidden');
  if (tabName === 'bookings') document.getElementById('adminBookingsSection')?.classList.remove('hidden');
  if (tabName === 'emergencies') document.getElementById('adminEmgSection')?.classList.remove('hidden');
  if (tabName === 'reports') document.getElementById('adminReportsSection')?.classList.remove('hidden');
  if (tabName === 'users') document.getElementById('adminUsersSection')?.classList.remove('hidden');
  if (tabName === 'deleted') document.getElementById('adminDeletedSection')?.classList.remove('hidden');
}

async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/data');
    const data = await res.json();

    if (data.success) {
      const solvedList = data.solved_tasks || (data.tasks || []).filter(t => t.status === 'Resolved');
      const pendingTasksCount = (data.tasks || []).filter(t => t.status === 'Pending').length;

      document.getElementById('adminStatTasks').textContent = data.tasks.length;
      const statSolved = document.getElementById('adminStatSolved');
      if (statSolved) statSolved.textContent = solvedList.length;
      document.getElementById('adminStatBookings').textContent = data.bookings.length;
      document.getElementById('adminStatEmergencies').textContent = data.emergencies.length;
      document.getElementById('adminStatFalseReports').textContent = (data.reports || []).length;
      const statDeleted = document.getElementById('adminStatDeleted');
      if (statDeleted) statDeleted.textContent = (data.deleted_accounts || []).length;

      document.getElementById('adminTasksBadge').textContent = data.tasks.length;
      const solvedBadge = document.getElementById('adminSolvedBadge');
      if (solvedBadge) solvedBadge.textContent = solvedList.length;
      document.getElementById('adminBookingsBadge').textContent = data.bookings.length;
      document.getElementById('adminEmgBadge').textContent = data.emergencies.length;
      document.getElementById('adminReportsBadge').textContent = (data.reports || []).length;
      document.getElementById('adminUsersBadge').textContent = data.users.length;
      const deletedBadge = document.getElementById('adminDeletedBadge');
      if (deletedBadge) deletedBadge.textContent = (data.deleted_accounts || []).length;

      renderAdminTasks(data.tasks);
      renderAdminSolvedHistory(solvedList);
      renderAdminBookings(data.bookings);
      renderAdminEmergencies(data.emergencies);
      renderAdminReports(data.reports || []);
      renderAdminUsers(data.users);
      renderAdminDeletedAccounts(data.deleted_accounts || []);

      // Populate employee list for task assignment
      populateAdminEmployeeAssignSelect(data.employees || []);
    }
  } catch (err) {
    showToast('Failed to fetch admin data', 'error');
  }
}

function renderAdminTasks(tasks) {
  const tbody = document.getElementById('adminTasksTableBody');
  tbody.innerHTML = '';
  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No waste reports recorded yet.</td></tr>`;
    return;
  }
  tasks.forEach(t => {
    let statusClass = 'status-pending';
    if (t.status === 'Resolved') statusClass = 'status-resolved';
    if (t.status === 'Closed (Heavy Load)') statusClass = 'status-closed';
    if (t.status === 'Assigned') statusClass = 'status-progress';
    if (t.status === 'Accepted') statusClass = 'status-confirmed';

    let actionHtml = '';
    if (t.status === 'Pending') {
      actionHtml = `
        <div class="admin-task-actions-row">
          <button type="button" class="tbl-btn tbl-btn-assign" onclick="openAdminAssignModal('${t.id}', '${encodeURIComponent(t.headline || t.address)}', '${t.waste_type}')" title="Assign task to an employee">
            <i class="fa-solid fa-user-plus"></i> Assign
          </button>
          <button type="button" class="tbl-btn tbl-btn-resolve" onclick="openResolveTaskModal('${t.id}')">
            <i class="fa-solid fa-check"></i> Resolve
          </button>
          <button type="button" class="tbl-btn tbl-btn-close-service" onclick="adminCloseTask('${t.id}')" title="Close complaint due to heavy load">
            <i class="fa-solid fa-ban"></i> Close (Heavy Load)
          </button>
        </div>
      `;
    } else if (t.status === 'Assigned') {
      actionHtml = `
        <div class="admin-task-actions-row">
          <span class="badge-pill mb-1" style="background:#fef3c7; color:#92400e; font-size:0.75rem;"><i class="fa-solid fa-user-clock"></i> Assigned: ${t.assigned_to_name || 'Staff'}</span>
          <button type="button" class="tbl-btn tbl-btn-assign" onclick="openAdminAssignModal('${t.id}', '${encodeURIComponent(t.headline || t.address)}', '${t.waste_type}')" title="Reassign task to another employee">
            <i class="fa-solid fa-arrows-rotate"></i> Reassign
          </button>
          <button type="button" class="tbl-btn tbl-btn-resolve" onclick="openResolveTaskModal('${t.id}')">
            <i class="fa-solid fa-check"></i> Resolve
          </button>
        </div>
      `;
    } else if (t.status === 'Accepted') {
      actionHtml = `
        <div class="admin-task-actions-row">
          <span class="badge-pill mb-1" style="background:#dcfce7; color:#166534; font-size:0.75rem;"><i class="fa-solid fa-user-check"></i> Accepted: ${t.accepted_by_name || 'Staff'}</span>
          <button type="button" class="tbl-btn tbl-btn-resolve" onclick="openResolveTaskModal('${t.id}')">
            <i class="fa-solid fa-check"></i> Resolve
          </button>
        </div>
      `;
    } else if (t.status === 'Resolved') {
      actionHtml = `<span class="text-green font-bold"><i class="fa-solid fa-circle-check"></i> Resolved</span>`;
    } else if (t.status === 'Closed (Heavy Load)') {
      actionHtml = `<span class="text-muted"><i class="fa-solid fa-lock"></i> Closed (Heavy Load)</span>`;
    } else {
      actionHtml = `<span class="text-muted">${t.status}</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td><strong>${t.headline}</strong><br><small class="text-muted">${t.address}</small></td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td><img src="${t.photo}" alt="Proof" class="table-photo-thumb" /></td>
      <td><strong>${t.reporter_name}</strong><br><small><i class="fa-solid fa-phone"></i> ${t.reporter_phone}</small><br><small><i class="fa-solid fa-envelope"></i> ${t.reporter_email || '-'}</small></td>
      <td><span class="status-tag ${statusClass}">${t.status}</span></td>
      <td>${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminSolvedHistory(solvedTasks) {
  const tbody = document.getElementById('adminSolvedTasksTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!solvedTasks || solvedTasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4"><i class="fa-solid fa-circle-check text-green"></i> No solved complaint records in archive yet.</td></tr>`;
    return;
  }

  solvedTasks.forEach(t => {
    const afterPhotoSrc = t.resolved_after_photo || t.after_photo || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=400&q=80';
    const durationStr = t.resolved_time_consumed || t.time_consumed || '30 mins';
    const solvedTime = t.resolved_at || t.points_awarded_at || t.created_at || 'Recently';
    const pts = t.awarded_points ? `+${t.awarded_points} pts` : '+50 pts';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${t.id}</strong><br>
        <small class="text-muted"><i class="fa-regular fa-clock"></i> ${solvedTime}</small>
      </td>
      <td>
        <strong>${t.headline}</strong><br>
        <small class="text-muted">${t.address}</small><br>
        <small class="text-green"><i class="fa-solid fa-location-crosshairs"></i> Lat: ${parseFloat(t.lat || DEFAULT_LAT).toFixed(4)}, Lng: ${parseFloat(t.lng || DEFAULT_LNG).toFixed(4)}</small>
      </td>
      <td>
        <strong class="text-main">${t.reporter_name || 'Citizen Reporter'}</strong>
      </td>
      <td>
        <div><i class="fa-solid fa-envelope text-blue"></i> ${t.reporter_email || 'N/A'}</div>
        <div><i class="fa-solid fa-phone text-green"></i> ${t.reporter_phone || 'N/A'}</div>
      </td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td>
        <div class="solved-photos-pair">
          <div class="photo-thumb-wrap" title="Before Cleaning">
            <span class="photo-badge before">Before</span>
            <img src="${t.photo}" alt="Before" class="table-photo-thumb" />
          </div>
          <div class="photo-thumb-wrap" title="After Cleaning">
            <span class="photo-badge after">After</span>
            <img src="${afterPhotoSrc}" alt="After" class="table-photo-thumb" />
          </div>
        </div>
      </td>
      <td>
        <strong>${durationStr}</strong><br>
        <small class="text-muted">${t.assigned_team || 'Municipal Squad'}</small>
      </td>
      <td><strong class="text-green">${pts}</strong></td>
      <td>
        <button type="button" class="tbl-btn tbl-btn-delete" onclick="adminDeleteSolvedTask('${t.id}')" title="Delete record from solved archive">
          <i class="fa-solid fa-trash-can"></i> Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminBookings(bookings) {
  const tbody = document.getElementById('adminBookingsTableBody');
  tbody.innerHTML = '';
  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No private cleaning bookings yet.</td></tr>`;
    return;
  }
  bookings.forEach(b => {
    const isTree = b.tree_planting_included || b.has_tree_planting || b.service_name.includes('Plant a Tree');
    const treeBadge = isTree ? `<br><span class="badge-pill badge-tree"><i class="fa-solid fa-seedling"></i> +Tree Planting (${b.service_name.includes('Plant a Tree') ? '₹599' : '50% OFF'})</span>` : '';

    let statusClass = 'status-confirmed';
    if (b.status === 'Closed (Heavy Load)') statusClass = 'status-closed';
    if (b.status === 'Completed') statusClass = 'status-resolved';

    let actionHtml = '';
    if (b.status === 'Pending' || b.status === 'Confirmed') {
      actionHtml = `
        <div class="admin-task-actions-row">
          <button type="button" class="table-action-btn btn-resolve-spot" onclick="completePrivateBooking('${b.id}')">
            <i class="fa-solid fa-circle-check"></i> Complete
          </button>
          <button type="button" class="tbl-btn tbl-btn-close-service" onclick="adminCloseBooking('${b.id}')" title="Close booking due to heavy load">
            <i class="fa-solid fa-ban"></i> Close (Heavy Load)
          </button>
        </div>
      `;
    } else if (b.status === 'Completed') {
      actionHtml = `<span class="text-green font-bold"><i class="fa-solid fa-check-double"></i> Completed</span>`;
    } else if (b.status === 'Closed (Heavy Load)') {
      actionHtml = `<span class="text-muted"><i class="fa-solid fa-lock"></i> Closed (Heavy Load)</span>`;
    } else {
      actionHtml = `<span class="text-muted">${b.status}</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.id}</strong></td>
      <td><strong>${b.customer_name}</strong><br><small><i class="fa-solid fa-phone"></i> ${b.customer_phone}</small><br><small><i class="fa-solid fa-envelope"></i> ${b.customer_email || '-'}</small></td>
      <td><span class="badge-pill">${b.service_name}</span>${treeBadge}</td>
      <td>${b.timing_slot}</td>
      <td>${b.address}</td>
      <td><strong class="text-green">₹${b.service_price}</strong></td>
      <td><span class="status-tag ${statusClass}">${b.status}</span></td>
      <td>${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function adminCloseTask(taskId) {
  if (!confirm(`Are you sure you want to CLOSE complaint #${taskId} due to heavy load?\n\nA notification will be sent to the citizen: "The service / complaint you raised has been temporarily closed due to heavy load. Please try again later."`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/close-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        reason: 'The service / complaint you raised has been temporarily closed due to heavy load. Please try again later.'
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Complaint #${taskId} closed due to heavy load and notification sent!`, 'success');
      loadAdminData();
    } else {
      showToast(data.message || 'Failed to close complaint', 'error');
    }
  } catch (e) {
    showToast('Network error closing complaint', 'error');
  }
}

async function adminCloseBooking(bookingId) {
  if (!confirm(`Are you sure you want to CLOSE private booking #${bookingId} due to heavy load?\n\nA notification will be sent to the citizen: "The service / private booking you raised has been temporarily closed due to heavy load. Please try again later."`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/close-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: bookingId,
        reason: 'The service / private booking you raised has been temporarily closed due to heavy load. Please try again later.'
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Booking #${bookingId} closed due to heavy load and notification sent!`, 'success');
      loadAdminData();
    } else {
      showToast(data.message || 'Failed to close booking', 'error');
    }
  } catch (e) {
    showToast('Network error closing booking', 'error');
  }
}

async function adminClearSolvedHistory() {
  if (!confirm('⚠️ DANGER: Are you sure you want to CLEAR ALL solved complaints history records?\n\nThis will remove all resolved complaints from the archive and showcase.')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/clear-solved-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Cleared ${data.cleared_count} solved complaints history records!`, 'success');
      loadAdminData();
      loadSolvedShowcaseFeed();
    } else {
      showToast(data.message || 'Failed to clear solved history', 'error');
    }
  } catch (e) {
    showToast('Network error clearing solved history', 'error');
  }
}

async function adminDeleteSolvedTask(taskId) {
  if (!confirm(`Are you sure you want to delete solved complaint record #${taskId}?`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/delete-solved-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Solved complaint #${taskId} deleted.`, 'success');
      loadAdminData();
      loadSolvedShowcaseFeed();
    } else {
      showToast(data.message || 'Failed to delete record', 'error');
    }
  } catch (e) {
    showToast('Network error deleting record', 'error');
  }
}

function renderAdminEmergencies(emergencies) {
  const tbody = document.getElementById('adminEmgTableBody');
  tbody.innerHTML = '';
  if (!emergencies || emergencies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No emergency calls active.</td></tr>`;
    return;
  }
  emergencies.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="text-red">${e.id}</strong></td>
      <td><span class="status-tag status-emergency">${e.type.toUpperCase()}</span></td>
      <td><strong>${e.caller_name}</strong><br><small>${e.caller_phone}</small></td>
      <td>${e.address}</td>
      <td>${e.emergency_details}</td>
      <td><span class="status-tag status-emergency">${e.severity}</span></td>
      <td><span class="status-tag status-progress">${e.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminReports(reports) {
  const tbody = document.getElementById('adminReportsTableBody');
  tbody.innerHTML = '';
  if (!reports || reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No employee investigation reports filed yet.</td></tr>`;
    return;
  }
  reports.forEach(r => {
    const isMismatch = r.location_match_status.includes('NOT MATCHED');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.id}</strong></td>
      <td><strong>${r.emergency_id}</strong><br><small>${r.emergency_location}</small></td>
      <td><strong>${r.employee_name}</strong><br><small>${r.employee_phone}</small></td>
      <td><span class="status-tag ${isMismatch ? 'gps-mismatch' : 'gps-matched'}">${r.location_match_status}</span></td>
      <td><img src="${r.photo_proof}" alt="Proof" class="table-photo-thumb" /></td>
      <td>${r.reason}</td>
      <td>${r.filed_at}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  tbody.innerHTML = '';
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No registered users in database.</td></tr>`;
    return;
  }
  users.forEach(u => {
    const fullName = `${u.first_name} ${u.surname}`.trim();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.phone}</td>
      <td>${u.email}</td>
      <td><strong>${fullName}</strong></td>
      <td>${u.address}</td>
      <td><span class="status-tag status-progress">${u.role.toUpperCase()}</span></td>
      <td>${u.aadhaar || u.org_id || '-'}</td>
      <td>${u.employee_type || u.org_name || '-'}</td>
      <td>${u.created_at || 'Recently'}</td>
      <td>
        <div class="admin-user-actions-row">
          <button type="button" class="tbl-btn tbl-btn-logout" onclick="adminLogoutUser('${u.email}', '${u.phone}', '${u.role}', '${fullName}')" title="Force Logout User">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Logout
          </button>
          <button type="button" class="tbl-btn tbl-btn-delete" onclick="adminDeleteUser('${u.email}', '${u.phone}', '${u.role}', '${fullName}')" title="Remove User Permanently">
            <i class="fa-solid fa-trash-can"></i> Remove
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function adminLogoutUser(email, phone, role, name) {
  if (!confirm(`Are you sure you want to FORCE LOGOUT "${name}" (${role}) from GREENOX? Their active session will be terminated immediately.`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/logout-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, role })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`User "${name}" has been force logged out!`, 'success');
      loadAdminData();
    } else {
      showToast(data.message || 'Logout action failed', 'error');
    }
  } catch (e) {
    showToast('Network error performing force logout', 'error');
  }
}

async function adminDeleteUser(email, phone, role, name) {
  if (!confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY REMOVE & DELETE "${name}" (${role}) from the GREENOX database and registered_user.csv? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, role })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`User "${name}" removed and deleted permanently!`, 'success');
      loadAdminData();
    } else {
      showToast(data.message || 'Delete action failed', 'error');
    }
  } catch (e) {
    showToast('Network error deleting user', 'error');
  }
}

// --------------------------------------------------------------------------
// ADMIN: DELETED ACCOUNTS ARCHIVE TAB
// --------------------------------------------------------------------------

function renderAdminDeletedAccounts(deletedAccounts) {
  const tbody = document.getElementById('adminDeletedAccountsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!deletedAccounts || deletedAccounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4"><i class="fa-solid fa-folder-open"></i> No deleted employee accounts in record.</td></tr>`;
    return;
  }

  deletedAccounts.forEach(acc => {
    const fullName = acc.name || `${acc.first_name || ''} ${acc.surname || ''}`.trim() || 'Employee';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${fullName}</strong></td>
      <td><i class="fa-solid fa-phone text-green"></i> ${acc.phone}</td>
      <td><i class="fa-solid fa-envelope text-blue"></i> ${acc.email}</td>
      <td><span class="badge-pill">${acc.employee_type ? acc.employee_type.toUpperCase() : 'EMPLOYEE'}</span></td>
      <td><code>${acc.aadhaar || '-'}</code></td>
      <td><strong class="text-green">${acc.problems_solved_count || 0} Solved</strong></td>
      <td><span class="text-muted"><i class="fa-regular fa-clock"></i> ${acc.deleted_at || 'Recently'}</span></td>
      <td><span class="status-tag status-closed"><i class="fa-solid fa-user-slash"></i> Permanently Deleted</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// --------------------------------------------------------------------------
// ADMIN: ASSIGN TASK TO EMPLOYEE MODAL & DISPATCH
// --------------------------------------------------------------------------

let currentAssignTaskId = null;
let currentAdminEmployeesList = [];

function populateAdminEmployeeAssignSelect(employees) {
  currentAdminEmployeesList = employees || [];
  const select = document.getElementById('adminAssignEmployeeSelect');
  if (!select) return;

  const prevSelected = select.value;
  select.innerHTML = '<option value="" disabled selected>-- Select an Active Employee --</option>';

  currentAdminEmployeesList.forEach(emp => {
    const fullName = `${emp.first_name || ''} ${emp.surname || ''}`.trim() || emp.name || 'Employee';
    const opt = document.createElement('option');
    opt.value = emp.email || emp.phone;
    opt.setAttribute('data-name', fullName);
    opt.setAttribute('data-phone', emp.phone || '');
    opt.setAttribute('data-email', emp.email || '');
    opt.setAttribute('data-type', emp.employee_type || 'govt');
    opt.textContent = `${fullName} (${emp.phone} - ${emp.employee_type ? emp.employee_type.toUpperCase() : 'GOVT'})`;
    select.appendChild(opt);
  });

  if (prevSelected) select.value = prevSelected;
}

function openAdminAssignModal(taskId, encodedHeadline, wasteType) {
  currentAssignTaskId = taskId;
  document.getElementById('adminAssignTaskId').value = taskId;
  const headline = decodeURIComponent(encodedHeadline || 'Reported Spot');
  document.getElementById('adminAssignTaskHeadline').textContent = `Task #${taskId}: ${headline}`;
  document.getElementById('adminAssignTaskCategory').textContent = wasteType || 'Municipal Waste';

  const select = document.getElementById('adminAssignEmployeeSelect');
  if (select) select.selectedIndex = 0;

  document.getElementById('adminAssignTaskModal').classList.remove('hidden');
}

async function submitAdminTaskAssignment(event) {
  event.preventDefault();
  const taskId = document.getElementById('adminAssignTaskId').value || currentAssignTaskId;
  const select = document.getElementById('adminAssignEmployeeSelect');
  const selectedOpt = select.options[select.selectedIndex];

  if (!selectedOpt || !selectedOpt.value) {
    showToast('Please select an active employee from the list to assign this task.', 'error');
    return;
  }

  const empEmail = selectedOpt.getAttribute('data-email') || '';
  const empPhone = selectedOpt.getAttribute('data-phone') || '';
  const empName = selectedOpt.getAttribute('data-name') || '';
  const empType = selectedOpt.getAttribute('data-type') || 'govt';

  const submitBtn = document.getElementById('submitAdminAssignBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Assigning Task...';

  try {
    const res = await fetch('/api/admin/assign-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        employee_email: empEmail,
        employee_phone: empPhone,
        employee_name: empName,
        employee_type: empType
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Task #${taskId} assigned to ${empName}!`, 'success');
      closeModal('adminAssignTaskModal');
      loadAdminData();
    } else {
      showToast(data.message || 'Failed to assign task', 'error');
    }
  } catch (e) {
    showToast('Network error assigning task', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Confirm & Assign Task';
  }
}

// ==========================================================================
// 13. CORE MODALS, MAPS, & GENERAL FUNCTIONS
// ==========================================================================

function openReportWasteModal() {
  document.getElementById('reportWasteModal').classList.remove('hidden');
  initReportMap();
}

function openBookCleaningModal() {
  document.getElementById('bookCleaningModal').classList.remove('hidden');
  initBookingMap();
  recalculateReceipt();
}

function openEmergencyModal() {
  document.getElementById('emergencyModal').classList.remove('hidden');
  resetQuickEmergency();
  if (currentUser) {
    const fullName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.name || 'Citizen';
    const nameInput = document.getElementById('emgCallerName');
    const phoneInput = document.getElementById('emgCallerPhone');
    if (nameInput) nameInput.value = fullName;
    if (phoneInput) phoneInput.value = currentUser.phone || '';
  }
  switchEmergencyType('same_location');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  if (modalId === 'emergencyModal') {
    resetQuickEmergency();
  }
}

function handleBackdropClick(event, modalId) {
  if (event.target.id === modalId) {
    closeModal(modalId);
  }
}

function toggleProfileMenu() {
  const popover = document.getElementById('profilePopover');
  if (popover) popover.classList.toggle('hidden');
}

function closeProfileMenu() {
  const popover = document.getElementById('profilePopover');
  if (popover) popover.classList.add('hidden');
}

function toggleNotifications() {
  const notif = document.getElementById('notifDropdown');
  if (!notif) return;
  notif.classList.toggle('hidden');

  if (!notif.classList.contains('hidden') && currentUser) {
    // Mark notifications as read
    fetch('/api/user/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, phone: currentUser.phone })
    }).then(() => {
      const badge = document.getElementById('notifBadgeCount');
      if (badge) badge.textContent = '0';
      document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    }).catch(() => { });
  }
}

// Close profile popover when clicking outside
document.addEventListener('click', (e) => {
  const popover = document.getElementById('profilePopover');
  const avatarBtn = document.getElementById('userAvatarBtn');
  if (popover && !popover.classList.contains('hidden')) {
    if (!popover.contains(e.target) && avatarBtn && !avatarBtn.contains(e.target)) {
      popover.classList.add('hidden');
    }
  }
});

function enableAddressEditing() {
  const currentAddress = document.getElementById('profileAddressText').textContent;
  document.getElementById('editAddressInput').value = currentAddress;
  document.getElementById('addressDisplayBox').classList.add('hidden');
  document.getElementById('addressEditBox').classList.remove('hidden');
  document.getElementById('editAddrBtn').classList.add('hidden');
}

function cancelAddressEditing() {
  document.getElementById('addressDisplayBox').classList.remove('hidden');
  document.getElementById('addressEditBox').classList.add('hidden');
  document.getElementById('editAddrBtn').classList.remove('hidden');
}

async function saveUpdatedAddress() {
  const newAddr = document.getElementById('editAddressInput').value.trim();
  if (!newAddr) {
    showToast('Address cannot be empty', 'error');
    return;
  }

  try {
    const res = await fetch('/api/user/update-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        phone: currentUser.phone,
        address: newAddr
      })
    });

    const data = await res.json();
    if (data.success) {
      currentUser.address = newAddr;
      localStorage.setItem('greenox_user', JSON.stringify(currentUser));
      document.getElementById('profileAddressText').textContent = newAddr;
      document.getElementById('emgAddressInput').value = newAddr;
      cancelAddressEditing();
      showToast('Address updated & synced to registered_user.csv', 'success');
    } else {
      showToast(data.message || 'Failed to update address', 'error');
    }
  } catch (e) {
    showToast('Network error updating address', 'error');
  }
}

function initReportMap() {
  setTimeout(() => {
    if (!reportMap) {
      reportMap = L.map('reportMap').setView([DEFAULT_LAT, DEFAULT_LNG], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© Greenox Maps'
      }).addTo(reportMap);

      reportMarker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true }).addTo(reportMap);
      reportMarker.on('dragend', function (e) {
        const coord = e.target.getLatLng();
        reverseGeocode(coord.lat, coord.lng, 'reportAddressInput');
      });

      reportMap.on('click', function (e) {
        reportMarker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'reportAddressInput');
      });
    } else {
      reportMap.invalidateSize();
    }
  }, 200);
}

function initBookingMap() {
  setTimeout(() => {
    if (!bookingMap) {
      bookingMap = L.map('bookingMap').setView([DEFAULT_LAT, DEFAULT_LNG], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© Greenox Maps'
      }).addTo(bookingMap);

      bookingMarker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true }).addTo(bookingMap);
      const userAddr = currentUser ? currentUser.address : 'Green City Residency';
      document.getElementById('bookingAddressInput').value = userAddr;

      bookingMarker.on('dragend', function (e) {
        const coord = e.target.getLatLng();
        reverseGeocode(coord.lat, coord.lng, 'bookingAddressInput');
      });

      bookingMap.on('click', function (e) {
        bookingMarker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'bookingAddressInput');
      });
    } else {
      bookingMap.invalidateSize();
    }
  }, 200);
}

function initEmgMap() {
  setTimeout(() => {
    if (!emgMap) {
      emgMap = L.map('emgMap').setView([DEFAULT_LAT, DEFAULT_LNG], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© Greenox Maps'
      }).addTo(emgMap);

      emgMarker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true }).addTo(emgMap);
      emgMarker.on('dragend', function (e) {
        const coord = e.target.getLatLng();
        reverseGeocode(coord.lat, coord.lng, 'emgAddressInput');
      });

      emgMap.on('click', function (e) {
        emgMarker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'emgAddressInput');
      });
    } else {
      emgMap.invalidateSize();
    }
  }, 200);
}

function locateUserGPS(mapId) {
  if (navigator.geolocation) {
    showToast('Locating GPS coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapId === 'reportMap' && reportMap && reportMarker) {
          reportMap.setView([lat, lng], 16);
          reportMarker.setLatLng([lat, lng]);
          reverseGeocode(lat, lng, 'reportAddressInput');
        } else if (mapId === 'bookingMap' && bookingMap && bookingMarker) {
          bookingMap.setView([lat, lng], 16);
          bookingMarker.setLatLng([lat, lng]);
          reverseGeocode(lat, lng, 'bookingAddressInput');
        } else if (mapId === 'emgMap' && emgMap && emgMarker) {
          emgMap.setView([lat, lng], 16);
          emgMarker.setLatLng([lat, lng]);
          reverseGeocode(lat, lng, 'emgAddressInput');
        }
        showToast('Location pinned on map', 'success');
      },
      (err) => {
        showToast('Using default coordinates.', 'info');
      }
    );
  }
}

function reverseGeocode(lat, lng, targetInputId) {
  const input = document.getElementById(targetInputId);
  if (input) {
    input.value = `Sector ${(Math.abs(Math.floor(lat * 100)) % 40) + 1}, Green Avenue (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    selectedWastePhotoBase64 = e.target.result;
    document.getElementById('reportPhotoPreview').src = selectedWastePhotoBase64;
    document.getElementById('photoPreviewWrap').classList.remove('hidden');
    showToast('Photo attached', 'success');
  };
  reader.readAsDataURL(file);
}

function removeSelectedPhoto() {
  selectedWastePhotoBase64 = '';
  document.getElementById('photoPreviewWrap').classList.add('hidden');
  document.getElementById('cameraFileInput').value = '';
  document.getElementById('galleryFileInput').value = '';
}

async function submitWasteReport(event) {
  event.preventDefault();
  const wasteType = document.getElementById('reportWasteType').value;
  const address = document.getElementById('reportAddressInput').value.trim();

  if (!wasteType) {
    showToast('Please choose a waste category', 'error');
    return;
  }
  if (!address) {
    showToast('Please enter landmark or address', 'error');
    return;
  }

  const coords = reportMarker ? reportMarker.getLatLng() : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  const reporterName = currentUser ? `${currentUser.first_name} ${currentUser.surname}` : 'Citizen Reporter';
  const reporterPhone = currentUser ? currentUser.phone : '';
  const reporterEmail = currentUser ? currentUser.email : '';

  const submitBtn = document.getElementById('submitReportBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching Task...';

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        waste_type: wasteType,
        photo: selectedWastePhotoBase64,
        lat: coords.lat,
        lng: coords.lng,
        reporter_name: reporterName,
        reporter_phone: reporterPhone,
        reporter_email: reporterEmail
      })
    });

    const result = await res.json();
    if (result.success) {
      showToast('Waste reported! Dispatched to Government Employee team.', 'success');
      closeModal('reportWasteModal');
      document.getElementById('reportWasteForm').reset();
      removeSelectedPhoto();
      addNotification(`New Task Dispatched: ${address}`, 'just now');
    } else {
      showToast(result.message || 'Submission failed', 'error');
    }
  } catch (err) {
    showToast('Network error during report submission', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Waste Task';
  }
}

function selectCleaningPackage(element) {
  document.querySelectorAll('#packagesList .package-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  const pkgName = element.getAttribute('data-name');
  const pkgData = CLEANING_PACKAGES[pkgName];
  if (pkgData) {
    currentBookingPkg = { name: pkgName, ...pkgData };
    document.getElementById('receiptServiceName').textContent = pkgName;

    const addonCard = document.getElementById('treeAddonCard');
    if (pkgName === 'Plant a Tree (Eco Initiative)') {
      if (addonCard) addonCard.classList.add('hidden');
      toggleTreePlantingAddon(false);
    } else {
      if (addonCard) addonCard.classList.remove('hidden');
    }

    recalculateReceipt();
  }
}

function toggleTreePlantingAddon(isYes) {
  isTreeAddonSelected = isYes;
  const radioYes = document.getElementById('treeRadioYes');
  const radioNo = document.getElementById('treeRadioNo');

  if (isYes) {
    if (radioYes) radioYes.classList.add('active');
    if (radioNo) radioNo.classList.remove('active');
    const inputYes = radioYes?.querySelector('input');
    if (inputYes) inputYes.checked = true;
  } else {
    if (radioNo) radioNo.classList.add('active');
    if (radioYes) radioYes.classList.remove('active');
    const inputNo = radioNo?.querySelector('input');
    if (inputNo) inputNo.checked = true;
  }

  recalculateReceipt();
}

function recalculateReceipt() {
  const isGst = document.getElementById('gstCheckbox').checked;
  const pkg = currentBookingPkg;
  const isTreeService = pkg.name === 'Plant a Tree (Eco Initiative)';
  const addTree = isTreeAddonSelected && !isTreeService;
  const treePrice = addTree ? 299 : 0;
  const totalAmount = pkg.price + treePrice;

  document.getElementById('rcptServiceFee').textContent = `₹${pkg.baseFee}`;
  document.getElementById('rcptWorkerFee').textContent = `₹${pkg.workerFee}`;
  document.getElementById('rcptEcoFee').textContent = `₹${pkg.ecoFee}`;
  document.getElementById('rcptPlatformFee').textContent = `₹${pkg.platformFee}`;

  const treeRow = document.getElementById('rcptTreeAddonRow');
  if (treeRow) {
    if (addTree) {
      treeRow.classList.remove('hidden');
    } else {
      treeRow.classList.add('hidden');
    }
  }

  if (isGst) {
    document.getElementById('rcptGstAmount').textContent = '18% Included (₹' + Math.round(totalAmount * 0.18) + ')';
  } else {
    document.getElementById('rcptGstAmount').textContent = 'Exempted';
  }

  document.getElementById('rcptFinalTotal').textContent = `₹${totalAmount}`;
}

async function confirmCleaningBooking() {
  const timing = document.getElementById('bookingTimingSlot').value;
  const address = document.getElementById('bookingAddressInput').value.trim();

  if (!address) {
    showToast('Please specify service address.', 'error');
    return;
  }

  const isTreeService = currentBookingPkg.name === 'Plant a Tree (Eco Initiative)';
  const addTree = isTreeAddonSelected && !isTreeService;
  const treePrice = addTree ? 299 : 0;
  const finalPrice = currentBookingPkg.price + treePrice;

  const customerName = currentUser ? (currentUser.org_name || `${currentUser.first_name} ${currentUser.surname}`) : 'Customer';
  const customerPhone = currentUser ? currentUser.phone : '';
  const customerEmail = currentUser ? currentUser.email : '';
  const isGst = document.getElementById('gstCheckbox').checked;

  const receiptData = {
    service_fee: currentBookingPkg.baseFee,
    worker_fee: currentBookingPkg.workerFee,
    consumables_fee: currentBookingPkg.ecoFee,
    platform_fee: currentBookingPkg.platformFee,
    tree_planting_addon: addTree,
    tree_addon_price: treePrice,
    gst_applied: isGst,
    gst_amount: isGst ? Math.round(finalPrice * 0.18) : 0,
    total_amount: finalPrice
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_name: currentBookingPkg.name,
        service_price: finalPrice,
        receipt: receiptData,
        timing_slot: timing,
        address: address,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        user_type: currentUser ? currentUser.role : 'citizen',
        org_name: currentUser ? (currentUser.org_name || '') : '',
        tree_planting_included: addTree || isTreeService,
        tree_addon_price: treePrice,
        has_tree_planting: addTree || isTreeService
      })
    });

    const result = await res.json();
    if (result.success) {
      const treeNote = (addTree || isTreeService) ? ' (+🌱 Tree Planting Included)' : '';
      showToast(`Booking Confirmed (#${result.booking.id})!${treeNote} Dispatched to Private Cleaning Team.`, 'success');
      closeModal('bookCleaningModal');
      addNotification(`Booking Confirmed: ${currentBookingPkg.name}${treeNote} at ${address}`, 'just now');
    } else {
      showToast('Booking failed', 'error');
    }
  } catch (err) {
    showToast('Network error during booking confirmation', 'error');
  }
}

function switchEmergencyType(type) {
  currentEmergencyType = type;
  const sameBtn = document.getElementById('emgSameLocBtn');
  const randomBtn = document.getElementById('emgRandomLocBtn');
  const emgAddressInput = document.getElementById('emgAddressInput');
  const mapContainer = document.getElementById('emgMapContainer');

  if (type === 'same_location') {
    sameBtn.classList.add('active');
    randomBtn.classList.remove('active');
    mapContainer.classList.add('hidden');
    emgAddressInput.value = currentUser ? currentUser.address : 'Current Location';
    emgAddressInput.readOnly = true;
  } else {
    randomBtn.classList.add('active');
    sameBtn.classList.remove('active');
    mapContainer.classList.remove('hidden');
    emgAddressInput.value = '';
    emgAddressInput.readOnly = false;
    emgAddressInput.placeholder = 'Pinpoint custom emergency address...';
    initEmgMap();
  }
}

let selectedEmergencyNeeds = [];

function toggleQuickEmergency(btn, needName) {
  const isSelected = btn.classList.toggle('selected');
  if (isSelected) {
    if (!selectedEmergencyNeeds.includes(needName)) {
      selectedEmergencyNeeds.push(needName);
    }
  } else {
    selectedEmergencyNeeds = selectedEmergencyNeeds.filter(item => item !== needName);
  }
  updateEmergencyDetailsFromQuick();
}

function updateEmergencyDetailsFromQuick() {
  const detailsInput = document.getElementById('emgDetailsInput');
  if (!detailsInput) return;

  // Extract any user custom notes (strip previous [Need] tags)
  const val = detailsInput.value;
  const customNotes = val.replace(/\[[^\]]+\]/g, '').replace(/^[\s,;:-]+|[\s,;:-]+$/g, '').trim();

  const tags = selectedEmergencyNeeds.map(need => `[${need}]`).join(' ');

  if (tags && customNotes) {
    detailsInput.value = `${tags} - ${customNotes}`;
  } else if (tags) {
    detailsInput.value = tags;
  } else {
    detailsInput.value = customNotes;
  }

  // Remove HTML5 required attribute if quick needs selected
  if (selectedEmergencyNeeds.length > 0) {
    detailsInput.removeAttribute('required');
  }
}

function resetQuickEmergency() {
  selectedEmergencyNeeds = [];
  document.querySelectorAll('.quick-emg-card').forEach(btn => btn.classList.remove('selected'));
  const detailsInput = document.getElementById('emgDetailsInput');
  if (detailsInput) {
    detailsInput.value = '';
    detailsInput.removeAttribute('required');
  }
  const grid = document.getElementById('quickEmgGrid');
  if (grid) grid.classList.remove('shake-highlight');
}

async function submitEmergencyHelp(event) {
  event.preventDefault();
  let details = document.getElementById('emgDetailsInput').value.trim();
  const address = document.getElementById('emgAddressInput').value.trim();
  const callerName = document.getElementById('emgCallerName').value.trim() || 'Citizen';
  const callerPhone = document.getElementById('emgCallerPhone').value.trim();
  const callerEmail = currentUser ? currentUser.email : '';

  // Fallback: If user clicked quick options but details input is somehow blank
  if (!details && selectedEmergencyNeeds.length > 0) {
    details = selectedEmergencyNeeds.map(need => `[${need}]`).join(', ');
  }

  if (!details) {
    const grid = document.getElementById('quickEmgGrid');
    if (grid) {
      grid.classList.add('shake-highlight');
      setTimeout(() => grid.classList.remove('shake-highlight'), 1200);
    }
    showToast('Please tap what you need (Ambulance, Medicine, Fire...) or describe the emergency', 'error');
    return;
  }
  if (!address) {
    showToast('Address is required for emergency dispatch', 'error');
    return;
  }

  const coords = emgMarker ? emgMarker.getLatLng() : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  const submitBtn = document.getElementById('submitEmgBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-siren fa-spin"></i> Dispatched to Emergency Teams...';

  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentEmergencyType,
        caller_name: callerName,
        caller_phone: callerPhone,
        caller_email: callerEmail,
        address: address,
        emergency_details: details,
        lat: coords.lat,
        lng: coords.lng,
        severity: 'CRITICAL'
      })
    });

    const result = await res.json();
    if (result.success) {
      showToast('EMERGENCY SOS DISPATCHED TO PRIVATE SQUAD & ADMIN!', 'error');
      closeModal('emergencyModal');
      document.getElementById('emergencyForm').reset();
      resetQuickEmergency();
      addNotification(`🚨 Emergency SOS Sent: ${details.slice(0, 30)}...`, 'just now');
    } else {
      showToast('Emergency alert dispatch failed', 'error');
    }
  } catch (err) {
    showToast('Network error dispatching emergency', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-truck-medical"></i> Dispatch Emergency Response';
  }
}

async function loadSolvedShowcaseFeed() {
  try {
    const res = await fetch('/api/showcase');
    const data = await res.json();

    if (data.success) {
      renderShowcaseCards(data.showcase || []);
      const count = (data.showcase || []).length;
      document.getElementById('liveSolvedCount').textContent = `${count} Resolved Records`;
      document.getElementById('statComplaintsSolved').textContent = count;
    }
  } catch (e) {
    console.error('Error fetching showcase:', e);
  }
}

function renderShowcaseCards(items) {
  const container = document.getElementById('showcaseFeedGrid');
  container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-showcase-box">
        <i class="fa-solid fa-seedling"></i>
        <p>No complaints resolved yet. When the administration resolves reported incident tasks, verified before/after records will appear here live.</p>
      </div>
    `;
    return;
  }

  items.forEach((item, index) => {
    const sliderId = `baSlider_${index}`;
    const afterWrapId = `baAfterWrap_${index}`;
    const handleId = `baHandle_${index}`;

    const card = document.createElement('div');
    card.className = 'showcase-card';
    card.innerHTML = `
      <div class="ba-container" id="baCont_${index}">
        <img src="${item.before_photo}" alt="Before Cleaning" class="ba-image" />
        <span class="ba-label before">BEFORE</span>

        <div class="ba-after-wrap" id="${afterWrapId}">
          <img src="${item.after_photo}" alt="After Cleaning" class="ba-image" />
          <span class="ba-label after">AFTER</span>
        </div>

        <div class="ba-handle-divider" id="${handleId}">
          <i class="fa-solid fa-arrows-left-right"></i>
        </div>

        <input type="range" min="0" max="100" value="50" class="ba-slider" id="${sliderId}"
          oninput="updateBeforeAfterSlider('${sliderId}', '${afterWrapId}', '${handleId}')" />
      </div>

      <div class="showcase-body">
        <div class="showcase-header-row">
          <span class="showcase-badge"><i class="fa-solid fa-circle-check"></i> ${item.status || 'Resolved'}</span>
          <span class="showcase-time-tag"><i class="fa-solid fa-stopwatch"></i> ${item.time_consumed}</span>
        </div>
        <h4 class="showcase-address">${item.headline || item.address}</h4>
        <p class="showcase-waste-type"><i class="fa-solid fa-trash-can"></i> ${item.waste_type}</p>
        <div class="showcase-footer-row">
          <span><i class="fa-solid fa-users"></i> ${item.team}</span>
          <span><i class="fa-solid fa-star text-gold"></i> 5.0 Rating</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateBeforeAfterSlider(sliderId, afterWrapId, handleId) {
  const slider = document.getElementById(sliderId);
  const afterWrap = document.getElementById(afterWrapId);
  const handle = document.getElementById(handleId);
  const val = slider.value;
  afterWrap.style.width = `${val}%`;
  handle.style.left = `${val}%`;
}

function handleTaskResolvePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    selectedTaskResolvePhotoBase64 = e.target.result;
    document.getElementById('taskResolvePreview').src = selectedTaskResolvePhotoBase64;
    document.getElementById('taskResolvePreviewWrap').classList.remove('hidden');
    showToast('After-cleaning proof photo attached!', 'success');
  };
  reader.readAsDataURL(file);
}

function removeTaskResolvePhoto() {
  selectedTaskResolvePhotoBase64 = '';
  const wrap = document.getElementById('taskResolvePreviewWrap');
  if (wrap) wrap.classList.add('hidden');
  const gInput = document.getElementById('resolveTaskGalleryInput');
  const cInput = document.getElementById('resolveTaskCameraInput');
  if (gInput) gInput.value = '';
  if (cInput) cInput.value = '';
}

function openResolveTaskModal(taskId) {
  document.getElementById('resolveTaskId').value = taskId;
  document.getElementById('resolveTimeConsumed').value = '25 mins';
  removeTaskResolvePhoto();
  document.getElementById('resolveTaskModal').classList.remove('hidden');
}

async function submitTaskResolution(event) {
  event.preventDefault();
  const taskId = document.getElementById('resolveTaskId').value;
  const timeConsumed = document.getElementById('resolveTimeConsumed').value.trim() || '30 mins';

  if (!selectedTaskResolvePhotoBase64) {
    showToast('Please upload an after-cleaning proof photo from Gallery or Camera.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitResolveBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing Resolution...';
  }

  try {
    const res = await fetch('/api/admin/update-task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        status: 'Resolved',
        after_photo: selectedTaskResolvePhotoBase64,
        time_consumed: timeConsumed
      })
    });

    const result = await res.json();
    if (result.success) {
      const awarded = result.task?.awarded_points;
      const ptsMsg = awarded ? ` (+${awarded} Greenox Points awarded to citizen reporter)` : '';
      showToast(`Task ${taskId} resolved and published to showcase!${ptsMsg}`, 'success');
      closeModal('resolveTaskModal');
      removeTaskResolvePhoto();
      if (currentUser && currentUser.role === 'admin') loadAdminData();
      if (currentUser && currentUser.role === 'employee') loadEmployeeData();
      if (currentUser && currentUser.role === 'citizen') loadCitizenPoints();
      loadSolvedShowcaseFeed();
    } else {
      showToast(result.message || 'Failed to update task', 'error');
    }
  } catch (err) {
    showToast('Failed to update task', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark Cleaned & Publish';
    }
  }
}

// ==========================================================================
// 14. CITIZEN GREENOX POINTS & REWARDS REDEMPTION
// ==========================================================================

async function loadCitizenPoints() {
  if (!currentUser || currentUser.role !== 'citizen') return;
  try {
    const res = await fetch(`/api/citizen/points?email=${encodeURIComponent(currentUser.email)}&phone=${encodeURIComponent(currentUser.phone)}`);
    const data = await res.json();
    if (data.success) {
      currentCitizenPoints = data.points || 0;
      citizenVouchers = data.vouchers || [];
      citizenPointsHistory = data.history || [];

      // Update Nav and Dashboard Stat
      const navPts = document.getElementById('navPointsBalance');
      if (navPts) navPts.textContent = currentCitizenPoints;
      const statPts = document.getElementById('statGreenoxPoints');
      if (statPts) statPts.textContent = `${currentCitizenPoints} pts`;
      const modalPts = document.getElementById('modalPointsBalance');
      if (modalPts) modalPts.textContent = currentCitizenPoints;
      const vchCount = document.getElementById('myVouchersCount');
      if (vchCount) vchCount.textContent = citizenVouchers.length;

      updateRewardMeters();
      renderCitizenVouchers();
      renderCitizenPointsHistory();
    }
  } catch (e) {
    console.error('Error fetching citizen points:', e);
  }
}

function updateRewardMeters() {
  // Option 1: 30% Off Govt Travel (200 pts)
  const pct1 = Math.min(100, Math.round((currentCitizenPoints / 200) * 100));
  const fill1 = document.getElementById('meterFillGovtTravel');
  const text1 = document.getElementById('meterTextGovtTravel');
  const btn1 = document.getElementById('btnRedeemGovtTravel');
  if (fill1) fill1.style.width = `${pct1}%`;
  if (text1) text1.textContent = `${Math.min(currentCitizenPoints, 200)} / 200 pts (${pct1}%)`;
  if (btn1) {
    btn1.disabled = currentCitizenPoints < 200;
    btn1.innerHTML = currentCitizenPoints >= 200
      ? '<i class="fa-solid fa-gift"></i> Redeem for 200 Points'
      : `<i class="fa-solid fa-lock"></i> Need ${200 - currentCitizenPoints} More Pts`;
  }

  // Option 2: Rs 5 Cashback (100 pts)
  const pct2 = Math.min(100, Math.round((currentCitizenPoints / 100) * 100));
  const fill2 = document.getElementById('meterFillCashback');
  const text2 = document.getElementById('meterTextCashback');
  const btn2 = document.getElementById('btnRedeemCashback');
  if (fill2) fill2.style.width = `${pct2}%`;
  if (text2) text2.textContent = `${Math.min(currentCitizenPoints, 100)} / 100 pts (${pct2}%)`;
  if (btn2) {
    btn2.disabled = currentCitizenPoints < 100;
    btn2.innerHTML = currentCitizenPoints >= 100
      ? '<i class="fa-solid fa-gift"></i> Redeem for 100 Points'
      : `<i class="fa-solid fa-lock"></i> Need ${100 - currentCitizenPoints} More Pts`;
  }

  // Option 3: Free Govt Bus Service (1000 pts)
  const pct3 = Math.min(100, Math.round((currentCitizenPoints / 1000) * 100));
  const fill3 = document.getElementById('meterFillFreeBus');
  const text3 = document.getElementById('meterTextFreeBus');
  const btn3 = document.getElementById('btnRedeemFreeBus');
  if (fill3) fill3.style.width = `${pct3}%`;
  if (text3) text3.textContent = `${Math.min(currentCitizenPoints, 1000)} / 1000 pts (${pct3}%)`;
  if (btn3) {
    btn3.disabled = currentCitizenPoints < 1000;
    btn3.innerHTML = currentCitizenPoints >= 1000
      ? '<i class="fa-solid fa-gift"></i> Redeem for 1000 Points'
      : `<i class="fa-solid fa-lock"></i> Need ${1000 - currentCitizenPoints} More Pts`;
  }
}

function openRedeemPointsModal() {
  if (!currentUser) return;
  document.getElementById('redeemPointsModal').classList.remove('hidden');
  switchRewardsTab('rewards');
  loadCitizenPoints();
}

function switchRewardsTab(tab) {
  document.querySelectorAll('.rewards-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.rewards-tab-content').forEach(s => s.classList.add('hidden'));

  if (tab === 'rewards') {
    document.getElementById('tabRewardsListBtn').classList.add('active');
    document.getElementById('rewardsListSection').classList.remove('hidden');
  } else if (tab === 'vouchers') {
    document.getElementById('tabMyVouchersBtn').classList.add('active');
    document.getElementById('rewardsVouchersSection').classList.remove('hidden');
  } else {
    document.getElementById('tabPointsHistoryBtn').classList.add('active');
    document.getElementById('rewardsHistorySection').classList.remove('hidden');
  }
}

async function redeemRewardPlan(rewardId) {
  if (!currentUser) return;
  const rewardNames = {
    'govt_travel_30': '30% OFF on Government Travel (200 pts)',
    'cashback_5': '₹5 Instant Cashback (100 pts)',
    'free_bus_ride': 'Free 1-Time Government Bus Service (1000 pts)'
  };
  const name = rewardNames[rewardId] || 'Reward';
  if (!confirm(`Are you sure you want to redeem "${name}" using your Greenox Points?`)) {
    return;
  }

  try {
    const res = await fetch('/api/citizen/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        phone: currentUser.phone,
        reward_id: rewardId
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🎉 ${data.message}`, 'success');
      loadCitizenPoints();
      switchRewardsTab('vouchers');
      addNotification(`🎁 Reward Redeemed: ${data.voucher.reward_name} (Code: ${data.voucher.code})`, 'just now');
    } else {
      showToast(data.message || 'Redemption failed', 'error');
    }
  } catch (e) {
    showToast('Network error during reward redemption', 'error');
  }
}

function renderCitizenVouchers() {
  const container = document.getElementById('myVouchersList');
  if (!container) return;
  container.innerHTML = '';

  if (!citizenVouchers || citizenVouchers.length === 0) {
    container.innerHTML = `
      <div class="empty-vouchers-box">
        <i class="fa-solid fa-ticket-simple text-gold fa-3x"></i>
        <h4>No Active Vouchers Yet</h4>
        <p>Redeem your earned Greenox Points above to unlock government transit discounts, cashback, and free ride vouchers.</p>
        <button type="button" class="primary-btn mt-3" onclick="switchRewardsTab('rewards')">
          <i class="fa-solid fa-gift"></i> Browse Available Rewards
        </button>
      </div>
    `;
    return;
  }

  citizenVouchers.forEach(v => {
    const card = document.createElement('div');
    card.className = 'voucher-card';
    card.innerHTML = `
      <div class="voucher-top-bar">
        <span class="voucher-brand"><i class="fa-solid fa-shield-halved"></i> GREENOX OFFICIAL PASS</span>
        <span class="voucher-status-pill"><i class="fa-solid fa-circle-check"></i> ${v.status || 'ACTIVE'}</span>
      </div>
      <div class="voucher-main-body">
        <h4>${v.reward_name}</h4>
        <p class="voucher-desc">${v.description || 'Verified government eco-transit reward coupon.'}</p>
        
        <div class="voucher-code-strip">
          <span class="code-label">DIGITAL COUPON / PASS CODE:</span>
          <div class="code-box">
            <strong class="code-text" id="code_${v.id}">${v.code}</strong>
            <button type="button" class="btn-copy-code" onclick="copyVoucherCode('${v.code}')" title="Copy Code">
              <i class="fa-solid fa-copy"></i> Copy Code
            </button>
          </div>
        </div>

        <div class="voucher-footer-row">
          <span><i class="fa-regular fa-calendar"></i> Redeemed: ${v.redeemed_at}</span>
          <span class="text-gold"><i class="fa-solid fa-clock"></i> ${v.expires_at}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function copyVoucherCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Copied coupon code "${code}" to clipboard!`, 'success');
  }).catch(() => {
    showToast(`Coupon code: ${code}`, 'info');
  });
}

function renderCitizenPointsHistory() {
  const container = document.getElementById('pointsHistoryList');
  if (!container) return;
  container.innerHTML = '';

  if (!citizenPointsHistory || citizenPointsHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-vouchers-box">
        <i class="fa-solid fa-clock-rotate-left fa-3x text-green"></i>
        <h4>No Points History Yet</h4>
        <p>Report municipal waste in your neighborhood. When resolved by municipal teams, 35 to 70 Greenox Points will be credited automatically here!</p>
      </div>
    `;
    return;
  }

  citizenPointsHistory.forEach(item => {
    const isEarned = item.type === 'earned' || item.points > 0;
    const row = document.createElement('div');
    row.className = `pts-history-row ${isEarned ? 'earned' : 'redeemed'}`;
    row.innerHTML = `
      <div class="pts-icon-badge ${isEarned ? 'text-green' : 'text-gold'}">
        <i class="fa-solid ${isEarned ? 'fa-plus-circle' : 'fa-minus-circle'}"></i>
      </div>
      <div class="pts-info">
        <strong>${item.reason}</strong>
        <span class="text-muted"><i class="fa-regular fa-clock"></i> ${item.date}</span>
      </div>
      <div class="pts-amount ${isEarned ? 'text-green' : 'text-gold'}">
        <strong>${isEarned ? '+' + item.points : item.points} Greenox Pts</strong>
      </div>
    `;
    container.appendChild(row);
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function fetchUserNotifications() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/user/notifications?email=${encodeURIComponent(currentUser.email)}&phone=${encodeURIComponent(currentUser.phone)}`);
    const data = await res.json();
    if (data.success && data.notifications) {
      renderNotificationsList(data.notifications);

      // Check for unread citizen resolution celebration popups or heavy load alerts
      data.notifications.forEach(n => {
        if (n.unread && !lastSeenNotifIds.has(n.id)) {
          lastSeenNotifIds.add(n.id);
          if (n.type === 'heavy_load_closure') {
            showToast(`⚠️ ${n.message}`, 'error');
          } else if ((n.type === 'task_resolved' || n.type === 'task_completed' || n.type === 'complaint_resolved') && currentUser.role === 'citizen') {
            triggerCitizenResolutionPopup(n);
          }
        }
      });
    }
  } catch (e) { }
}

function triggerCitizenResolutionPopup(notif) {
  const modal = document.getElementById('citizenResolutionPopupModal');
  if (!modal) return;

  const ptsVal = notif.awarded_points ? `+${notif.awarded_points} Points` : '+50 Points';
  const ptsEl = document.getElementById('popupAwardedPoints');
  if (ptsEl) ptsEl.textContent = ptsVal;

  const headlineEl = document.getElementById('popupTaskHeadline');
  if (headlineEl) headlineEl.textContent = notif.headline || notif.address || 'Municipal Waste Cleanup';

  const empEl = document.getElementById('popupEmployeeName');
  if (empEl) empEl.textContent = notif.employee_name || 'Municipal Squad';

  const timeEl = document.getElementById('popupTimeConsumed');
  if (timeEl) timeEl.textContent = notif.time_consumed || '30 mins';

  const beforeBox = document.getElementById('popupBeforePhotoBox');
  const beforeImg = document.getElementById('popupBeforePhoto');
  if (beforeImg) {
    if (notif.before_photo) {
      beforeImg.src = notif.before_photo;
      if (beforeBox) beforeBox.classList.remove('hidden');
    } else {
      if (beforeBox) beforeBox.classList.add('hidden');
    }
  }

  const afterBox = document.getElementById('popupAfterPhotoBox');
  const afterImg = document.getElementById('popupAfterPhoto');
  if (afterImg) {
    if (notif.after_photo) {
      afterImg.src = notif.after_photo;
      if (afterBox) afterBox.classList.remove('hidden');
    } else {
      if (afterBox) afterBox.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  loadCitizenPoints();
}

function closeCitizenResolutionPopup() {
  const modal = document.getElementById('citizenResolutionPopupModal');
  if (modal) modal.classList.add('hidden');
}

function renderNotificationsList(notifs) {
  const list = document.getElementById('notifList');
  if (!list) return;

  if (!notifs || notifs.length === 0) {
    list.innerHTML = `
      <div class="notif-empty-state">
        <i class="fa-solid fa-bell-slash"></i>
        <p>No new notifications right now.</p>
      </div>
    `;
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.textContent = '0';
    return;
  }

  list.innerHTML = '';
  let unreadCount = 0;

  notifs.forEach(n => {
    if (n.unread) unreadCount++;
    const isClosure = n.type === 'heavy_load_closure';
    const isResolved = n.type === 'task_resolved' || n.type === 'task_completed';
    const item = document.createElement('div');
    item.className = `notif-item ${n.unread ? 'unread' : ''} ${isClosure ? 'notif-closure' : ''}`;
    item.innerHTML = `
      <i class="fa-solid ${isClosure ? 'fa-triangle-exclamation text-red' : (isResolved ? 'fa-circle-check text-green' : 'fa-bell text-green')}"></i>
      <div class="notif-info">
        <p class="notif-title"><strong>${n.title || 'Notice'}</strong></p>
        <p class="notif-msg">${n.message}</p>
        <span class="notif-time"><i class="fa-regular fa-clock"></i> ${n.timestamp || 'Recently'}</span>
      </div>
    `;
    list.appendChild(item);
  });

  const badge = document.getElementById('notifBadgeCount');
  if (badge) badge.textContent = unreadCount;
}

function addNotification(title, time) {
  const list = document.getElementById('notifList');
  if (!list) return;
  const empty = list.querySelector('.notif-empty-state');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'notif-item unread';
  item.innerHTML = `
    <i class="fa-solid fa-bell text-green"></i>
    <div class="notif-info">
      <p class="notif-title">${title}</p>
      <span class="notif-time">${time}</span>
    </div>
  `;
  list.insertBefore(item, list.firstChild);

  const badge = document.getElementById('notifBadgeCount');
  if (badge) badge.textContent = parseInt(badge.textContent || 0) + 1;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
