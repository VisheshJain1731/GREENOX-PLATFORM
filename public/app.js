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
let selectedWastePhotoBase64 = '';
let selectedFalsePhotoBase64 = '';
let selectedEmgResolvePhotoBase64 = '';
let reportMap = null, reportMarker = null;
let bookingMap = null, bookingMarker = null;
let emgMap = null, emgMarker = null;
let currentEmergencyType = 'same_location';
let employeePollingInterval = null;
let lastKnownEmergencyId = null;

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
  'Custom Cleaning': { price: 5499, baseFee: 3900, workerFee: 950, ecoFee: 450, platformFee: 199 }
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
  const icons = document.querySelectorAll('.theme-toggle-btn i');
  icons.forEach(i => {
    i.className = `fa-solid ${iconClass}`;
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

function initRoleTabs() {
  const roleButtons = document.querySelectorAll('#roleTabs .role-tab');
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.getAttribute('data-role');
      
      const roleText = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
      document.getElementById('currentRoleText').textContent = roleText;

      const adminKeyGroup = document.getElementById('adminKeyGroup');
      const empExtra = document.getElementById('employeeExtraFields');
      const orgExtra = document.getElementById('orgExtraFields');
      const googleSection = document.getElementById('googleAuthSection');

      // Admin role configuration
      if (currentRole === 'admin') {
        if (currentAuthMode === 'register') adminKeyGroup.classList.remove('hidden');
        googleSection.classList.add('hidden'); // Admin cannot use Google
        empExtra.classList.add('hidden');
        orgExtra.classList.add('hidden');
      } else {
        adminKeyGroup.classList.add('hidden');
        googleSection.classList.remove('hidden'); // Google sign in available for Citizen, Employee, Organization

        // Employee specific fields (Aadhaar & Type)
        if (currentRole === 'employee') {
          empExtra.classList.remove('hidden');
          orgExtra.classList.add('hidden');
        } 
        // Organization specific fields (Org ID & Org Name)
        else if (currentRole === 'organization') {
          orgExtra.classList.remove('hidden');
          empExtra.classList.add('hidden');
        } else {
          empExtra.classList.add('hidden');
          orgExtra.classList.add('hidden');
        }
      }

      hideAuthAlert();
    });
  });
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const loginBtn = document.getElementById('tabLoginBtn');
  const registerBtn = document.getElementById('tabRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const adminKeyGroup = document.getElementById('adminKeyGroup');
  const empExtra = document.getElementById('employeeExtraFields');
  const orgExtra = document.getElementById('orgExtraFields');

  if (mode === 'login') {
    loginBtn.classList.add('active');
    registerBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    adminKeyGroup.classList.add('hidden');
  } else {
    registerBtn.classList.add('active');
    loginBtn.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    if (currentRole === 'admin') {
      adminKeyGroup.classList.remove('hidden');
    }
    if (currentRole === 'employee') {
      empExtra.classList.remove('hidden');
    }
    if (currentRole === 'organization') {
      orgExtra.classList.remove('hidden');
    }
  }
  hideAuthAlert();
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
  submitBtn.querySelector('.btn-text').textContent = 'Processing Registration...';

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('Registration completed successfully!', 'success');
      showAuthAlert('Registration completed! You can now log in.', 'success');
      document.getElementById('loginPhone').value = phone;
      document.getElementById('loginEmail').value = email;
      setTimeout(() => switchAuthMode('login'), 1200);
    } else {
      showAuthAlert(result.message || 'Registration failed.', 'error');
    }
  } catch (err) {
    showAuthAlert('Server connection error. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Complete Registration';
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
      currentUser = result.user;
      localStorage.setItem('greenox_user', JSON.stringify(currentUser));
      showToast(`Welcome to GREENOX, ${currentUser.first_name}!`, 'success');
      transitionToDashboard(currentUser);
    } else {
      showAuthAlert('Wrong details entered! Phone number, email, and password must match registered records.', 'error');
    }
  } catch (err) {
    showAuthAlert('Network error occurred during login.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Access Portal';
  }
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

function transitionToDashboard(user) {
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
    return;
  }

  // 2. EMPLOYEE DASHBOARD (GOVT vs PRIVATE)
  if (user.role === 'employee') {
    document.getElementById('employeeDashboardPage').classList.add('active');
    document.getElementById('employeeTopName').textContent = `${user.first_name} ${user.surname}`;

    const empType = (user.employee_type || 'govt').toLowerCase();
    const isGovt = empType === 'govt';

    document.getElementById('employeeTypeBadge').textContent = isGovt ? 'Govt Municipal Employee' : 'Private Eco-Clean Squad';
    document.getElementById('empNavbarBadge').textContent = isGovt ? 'Municipal Task Portal' : 'Private Operations Portal';

    if (isGovt) {
      document.getElementById('govtEmployeeView').classList.remove('hidden');
      document.getElementById('privateEmployeeView').classList.add('hidden');
    } else {
      document.getElementById('govtEmployeeView').classList.add('hidden');
      document.getElementById('privateEmployeeView').classList.remove('hidden');
      switchPrivateEmpTab('bookings');
      startPrivateEmployeePolling();
    }

    loadEmployeeData();
    return;
  }

  // 3. ORGANIZATION DASHBOARD (2 CHOICES ONLY)
  if (user.role === 'organization') {
    document.getElementById('organizationDashboardPage').classList.add('active');
    document.getElementById('orgTopName').textContent = user.org_name || `${user.first_name} ${user.surname}`;
    document.getElementById('orgIdBadge').textContent = user.org_id || 'ORG-ENTERPRISE';
    return;
  }

  // 4. CITIZEN DASHBOARD
  document.getElementById('mainDashboardPage').classList.add('active');
  const fullName = `${user.first_name} ${user.surname}`;
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
}

function handleLogout() {
  localStorage.removeItem('greenox_user');
  currentUser = null;
  if (employeePollingInterval) clearInterval(employeePollingInterval);

  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.getElementById('authPage').classList.add('active');
  closeProfileMenu();
  showToast('Logged out successfully.', 'info');
}

// ==========================================================================
// 7. EMPLOYEE PORTAL DATA & LOGIC (GOVT & PRIVATE SEPARATION)
// ==========================================================================

async function loadEmployeeData() {
  if (!currentUser || currentUser.role !== 'employee') return;
  const empType = (currentUser.employee_type || 'govt').toLowerCase();

  try {
    const res = await fetch(`/api/employee/data?type=${empType}`);
    const data = await res.json();

    if (data.success) {
      if (empType === 'govt') {
        renderGovtTasks(data.pending_tasks || []);
        document.getElementById('govtPendingCount').textContent = `${(data.pending_tasks || []).length} Pending`;
      } else {
        renderPrivateBookings(data.pending_tasks || []);
        renderPrivateEmergencies(data.emergencies || []);
        document.getElementById('privateBookingsBadge').textContent = (data.pending_tasks || []).length;
        document.getElementById('privateEmergenciesBadge').textContent = (data.emergencies || []).length;
      }
    }
  } catch (err) {
    console.error('Failed to load employee data:', err);
  }
}

function renderGovtTasks(tasks) {
  const tbody = document.getElementById('govtTasksTableBody');
  tbody.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="fa-solid fa-circle-check text-green"></i> All municipal waste tasks are currently cleared!</td></tr>`;
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
        <button class="tbl-btn tbl-btn-resolve" onclick="openResolveTaskModal('${t.id}')">
          <i class="fa-solid fa-check"></i> Mark Cleaned & Resolve
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4"><i class="fa-solid fa-shield text-green"></i> No active hazard emergency calls nearby.</td></tr>`;
    return;
  }

  emergencies.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="text-red">${e.id}</strong></td>
      <td><strong>${e.headline}</strong><br><small>${e.emergency_details}</small></td>
      <td>${e.address}</td>
      <td>${e.caller_name}<br><small>${e.caller_phone}</small></td>
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
    } catch (e) {}
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.id}</strong></td>
      <td><strong>${b.service_name}</strong></td>
      <td>${b.timing_slot}</td>
      <td>${b.address}</td>
      <td><strong class="text-green">₹${b.service_price}</strong></td>
      <td><span class="status-tag status-confirmed">${b.status}</span></td>
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td>${t.address}</td>
      <td><span class="badge-pill">${t.waste_type}</span></td>
      <td><img src="${t.photo}" alt="Proof" class="table-photo-thumb" /></td>
      <td>${t.created_at || 'Recently'}</td>
      <td><span class="status-tag ${t.status === 'Resolved' ? 'status-resolved' : 'status-pending'}">${t.status}</span></td>
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
// 12. ADMIN PORTAL DATA (WITH NEW INCIDENT REPORTS TAB)
// ==========================================================================

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

  event.currentTarget.classList.add('active');

  if (tabName === 'tasks') document.getElementById('adminTasksSection').classList.remove('hidden');
  if (tabName === 'bookings') document.getElementById('adminBookingsSection').classList.remove('hidden');
  if (tabName === 'emergencies') document.getElementById('adminEmgSection').classList.remove('hidden');
  if (tabName === 'reports') document.getElementById('adminReportsSection').classList.remove('hidden');
  if (tabName === 'users') document.getElementById('adminUsersSection').classList.remove('hidden');
}

async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/data');
    const data = await res.json();

    if (data.success) {
      document.getElementById('adminStatTasks').textContent = data.tasks.length;
      document.getElementById('adminStatBookings').textContent = data.bookings.length;
      document.getElementById('adminStatEmergencies').textContent = data.emergencies.length;
      document.getElementById('adminStatFalseReports').textContent = (data.reports || []).length;

      document.getElementById('adminTasksBadge').textContent = data.tasks.length;
      document.getElementById('adminBookingsBadge').textContent = data.bookings.length;
      document.getElementById('adminEmgBadge').textContent = data.emergencies.length;
      document.getElementById('adminReportsBadge').textContent = (data.reports || []).length;
      document.getElementById('adminUsersBadge').textContent = data.users.length;

      renderAdminTasks(data.tasks);
      renderAdminBookings(data.bookings);
      renderAdminEmergencies(data.emergencies);
      renderAdminReports(data.reports || []);
      renderAdminUsers(data.users);
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td><strong>${t.headline}</strong><br><small class="text-muted">${t.address}</small></td>
      <td>${t.waste_type}</td>
      <td><img src="${t.photo}" alt="Proof" class="table-photo-thumb" /></td>
      <td>${t.reporter_name}<br><small>${t.reporter_phone}</small></td>
      <td><span class="status-tag ${t.status === 'Resolved' ? 'status-resolved' : 'status-pending'}">${t.status}</span></td>
      <td>
        ${t.status !== 'Resolved' ? `
          <button class="tbl-btn tbl-btn-resolve" onclick="openResolveTaskModal('${t.id}')">
            <i class="fa-solid fa-check"></i> Resolve & Publish
          </button>
        ` : '<span class="text-green"><i class="fa-solid fa-check-double"></i> Published</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminBookings(bookings) {
  const tbody = document.getElementById('adminBookingsTableBody');
  tbody.innerHTML = '';
  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No private cleaning bookings yet.</td></tr>`;
    return;
  }
  bookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.id}</strong></td>
      <td><strong>${b.customer_name}</strong><br><small>${b.customer_phone}</small></td>
      <td><span class="badge-pill">${b.service_name}</span></td>
      <td>${b.timing_slot}</td>
      <td>${b.address}</td>
      <td><strong class="text-green">₹${b.service_price}</strong></td>
      <td><span class="status-tag status-confirmed">${b.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
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
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No registered users in database.</td></tr>`;
    return;
  }
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.phone}</td>
      <td>${u.email}</td>
      <td><strong>${u.first_name} ${u.surname}</strong></td>
      <td>${u.address}</td>
      <td><span class="status-tag status-progress">${u.role.toUpperCase()}</span></td>
      <td>${u.aadhaar || u.org_id || '-'}</td>
      <td>${u.employee_type || u.org_name || '-'}</td>
      <td>${u.created_at || 'Recently'}</td>
    `;
    tbody.appendChild(tr);
  });
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
  switchEmergencyType('same_location');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function handleBackdropClick(event, modalId) {
  if (event.target.id === modalId) {
    closeModal(modalId);
  }
}

function toggleProfileMenu() {
  const popover = document.getElementById('profilePopover');
  popover.classList.toggle('hidden');
  document.getElementById('notifDropdown').classList.add('hidden');
}

function closeProfileMenu() {
  document.getElementById('profilePopover').classList.add('hidden');
}

function toggleNotifications() {
  const notif = document.getElementById('notifDropdown');
  notif.classList.toggle('hidden');
  document.getElementById('profilePopover').classList.add('hidden');
}

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
    recalculateReceipt();
  }
}

function recalculateReceipt() {
  const isGst = document.getElementById('gstCheckbox').checked;
  const pkg = currentBookingPkg;

  document.getElementById('rcptServiceFee').textContent = `₹${pkg.baseFee}`;
  document.getElementById('rcptWorkerFee').textContent = `₹${pkg.workerFee}`;
  document.getElementById('rcptEcoFee').textContent = `₹${pkg.ecoFee}`;
  document.getElementById('rcptPlatformFee').textContent = `₹${pkg.platformFee}`;

  if (isGst) {
    document.getElementById('rcptGstAmount').textContent = '18% Included (₹' + Math.round(pkg.price * 0.18) + ')';
  } else {
    document.getElementById('rcptGstAmount').textContent = 'Exempted';
  }

  document.getElementById('rcptFinalTotal').textContent = `₹${pkg.price}`;
}

async function confirmCleaningBooking() {
  const timing = document.getElementById('bookingTimingSlot').value;
  const address = document.getElementById('bookingAddressInput').value.trim();

  if (!address) {
    showToast('Please specify service address.', 'error');
    return;
  }

  const customerName = currentUser ? (currentUser.org_name || `${currentUser.first_name} ${currentUser.surname}`) : 'Customer';
  const customerPhone = currentUser ? currentUser.phone : '';
  const customerEmail = currentUser ? currentUser.email : '';
  const isGst = document.getElementById('gstCheckbox').checked;

  const receiptData = {
    service_fee: currentBookingPkg.baseFee,
    worker_fee: currentBookingPkg.workerFee,
    consumables_fee: currentBookingPkg.ecoFee,
    platform_fee: currentBookingPkg.platformFee,
    gst_applied: isGst,
    gst_amount: isGst ? Math.round(currentBookingPkg.price * 0.18) : 0,
    total_amount: currentBookingPkg.price
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_name: currentBookingPkg.name,
        service_price: currentBookingPkg.price,
        receipt: receiptData,
        timing_slot: timing,
        address: address,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        user_type: currentUser ? currentUser.role : 'citizen',
        org_name: currentUser ? (currentUser.org_name || '') : ''
      })
    });

    const result = await res.json();
    if (result.success) {
      showToast(`Booking Confirmed (#${result.booking.id})! Dispatched to Private Cleaning Team.`, 'success');
      closeModal('bookCleaningModal');
      addNotification(`Booking Confirmed: ${currentBookingPkg.name} at ${address}`, 'just now');
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

async function submitEmergencyHelp(event) {
  event.preventDefault();
  const details = document.getElementById('emgDetailsInput').value.trim();
  const address = document.getElementById('emgAddressInput').value.trim();
  const callerName = document.getElementById('emgCallerName').value.trim() || 'Citizen';
  const callerPhone = document.getElementById('emgCallerPhone').value.trim();
  const callerEmail = currentUser ? currentUser.email : '';

  if (!details) {
    showToast('Please state what the emergency is', 'error');
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

function openResolveTaskModal(taskId) {
  document.getElementById('resolveTaskId').value = taskId;
  document.getElementById('resolveTaskModal').classList.remove('hidden');
}

async function submitTaskResolution(event) {
  event.preventDefault();
  const taskId = document.getElementById('resolveTaskId').value;
  const afterPhoto = document.getElementById('resolveAfterPhotoUrl').value;
  const timeConsumed = document.getElementById('resolveTimeConsumed').value;

  try {
    const res = await fetch('/api/admin/update-task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        status: 'Resolved',
        after_photo: afterPhoto,
        time_consumed: timeConsumed
      })
    });

    const result = await res.json();
    if (result.success) {
      showToast(`Task ${taskId} resolved and published to showcase!`, 'success');
      closeModal('resolveTaskModal');
      if (currentUser && currentUser.role === 'admin') loadAdminData();
      if (currentUser && currentUser.role === 'employee') loadEmployeeData();
      loadSolvedShowcaseFeed();
    }
  } catch (err) {
    showToast('Failed to update task', 'error');
  }
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
