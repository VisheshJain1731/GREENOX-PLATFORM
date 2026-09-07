/**
 * GREENOX — Next-Generation Eco-Clean & Municipal Management
 * Complete Frontend Application Logic
 */

// Global State
let currentRole = 'citizen';
let currentAuthMode = 'login';
let currentUser = null;
let selectedWastePhotoBase64 = '';
let reportMap = null, reportMarker = null;
let bookingMap = null, bookingMarker = null;
let emgMap = null, emgMarker = null;
let currentEmergencyType = 'same_location';
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
  initRoleTabs();
  checkExistingSession();
  loadSolvedShowcaseFeed();
});

// ----------------- ROLE & AUTH TAB HANDLING -----------------

function initRoleTabs() {
  const roleButtons = document.querySelectorAll('#roleTabs .role-tab');
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.getAttribute('data-role');
      
      const roleText = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
      document.getElementById('currentRoleText').textContent = roleText;

      // Show admin key field only for admin registration (secret key is not shown on UI)
      const adminKeyGroup = document.getElementById('adminKeyGroup');
      if (currentRole === 'admin' && currentAuthMode === 'register') {
        adminKeyGroup.classList.remove('hidden');
        document.getElementById('regAdminKey').setAttribute('required', 'true');
      } else {
        adminKeyGroup.classList.add('hidden');
        document.getElementById('regAdminKey').removeAttribute('required');
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

// ----------------- AUTHENTICATION API CALLS -----------------

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

  // 1. Password Match Validation
  if (password !== confirmPassword) {
    showAuthAlert('Confirm password does not match! Please check and try again.', 'error');
    return;
  }

  // 2. Admin Key Validation for Admin role (Backend validation)
  if (currentRole === 'admin' && !adminKey) {
    showAuthAlert('Admin registration key is required.', 'error');
    return;
  }

  const submitBtn = document.getElementById('registerSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Saving to CSV...';

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
        admin_key: adminKey
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('Registration complete! Record saved to registered_user.csv', 'success');
      showAuthAlert('Registration completed successfully! You can now log in.', 'success');
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
    submitBtn.querySelector('.btn-text').textContent = 'Complete Registration & Save to CSV';
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

// ----------------- ROUTING TO DEDICATED DASHBOARDS -----------------

function transitionToDashboard(user) {
  document.getElementById('authPage').classList.remove('active');

  // Requirement: Admin portal is ONLY for Admin Control Panel (strictly separate view)
  if (user.role === 'admin') {
    document.getElementById('mainDashboardPage').classList.remove('active');
    document.getElementById('adminDashboardPage').classList.add('active');
    document.getElementById('adminTopbarName').textContent = `${user.first_name} ${user.surname} (Admin)`;
    loadAdminData();
    return;
  }

  // Regular Users (Citizen, Employee, Organization) get the standard Dashboard
  document.getElementById('adminDashboardPage').classList.remove('active');
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
  document.getElementById('mainDashboardPage').classList.remove('active');
  document.getElementById('adminDashboardPage').classList.remove('active');
  document.getElementById('authPage').classList.add('active');
  closeProfileMenu();
  showToast('Logged out successfully.', 'info');
}

// ----------------- PROFILE MENU & EDIT ADDRESS -----------------

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

// ----------------- MODAL CONTROLS -----------------

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

// ----------------- MAPS INTEGRATION -----------------

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

// ----------------- PHOTO UPLOAD / CAMERA PREVIEW -----------------

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

// ----------------- 1. SUBMIT WASTE REPORT (TASKS) -----------------

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
        address: address, // Headline is address
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
      showToast('Waste reported! Dispatched to Admin as Task.', 'success');
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

// ----------------- 2. BOOK CLEANING (RECEIPT) -----------------

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

  const customerName = currentUser ? `${currentUser.first_name} ${currentUser.surname}` : 'Customer';
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
        customer_email: customerEmail
      })
    });

    const result = await res.json();
    if (result.success) {
      showToast(`Booking Confivered to Admin under Private Booking (#${result.booking.id})`, 'success');
      closeModal('bookCleaningModal');
      addNotification(`Booking Confirmed: ${currentBookingPkg.name} at ${address}`, 'just now');
    } else {
      showToast('Booking failed', 'error');
    }
  } catch (err) {
    showToast('Network error during booking confirmation', 'error');
  }
}

// ----------------- 3. EMERGENCY HELP DISPATCH -----------------

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
  submitBtn.innerHTML = '<i class="fa-solid fa-siren fa-spin"></i> Dispatched to Admin...';

  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentEmergencyType,
        caller_name: callerName,
        caller_phone: callerPhone,
        address: address,
        emergency_details: details,
        lat: coords.lat,
        lng: coords.lng,
        severity: 'CRITICAL'
      })
    });

    const result = await res.json();
    if (result.success) {
      showToast('EMERGENCY SOS DISPATCHED TO ADMIN COMMAND CENTER!', 'error');
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

// ----------------- SOLVED COMPLAINTS SHOWCASE FEED -----------------

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

// ----------------- ADMIN PORTAL DATA & ACTIONS -----------------

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

  event.currentTarget.classList.add('active');

  if (tabName === 'tasks') document.getElementById('adminTasksSection').classList.remove('hidden');
  if (tabName === 'bookings') document.getElementById('adminBookingsSection').classList.remove('hidden');
  if (tabName === 'emergencies') document.getElementById('adminEmgSection').classList.remove('hidden');
  if (tabName === 'users') document.getElementById('adminUsersSection').classList.remove('hidden');
}

async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/data');
    const data = await res.json();

    if (data.success) {
      // Summary Metrics
      document.getElementById('adminStatTasks').textContent = data.tasks.length;
      document.getElementById('adminStatBookings').textContent = data.bookings.length;
      document.getElementById('adminStatEmergencies').textContent = data.emergencies.length;
      document.getElementById('adminStatUsers').textContent = data.users.length;

      // Badges
      document.getElementById('adminTasksBadge').textContent = data.tasks.length;
      document.getElementById('adminBookingsBadge').textContent = data.bookings.length;
      document.getElementById('adminEmgBadge').textContent = data.emergencies.length;
      document.getElementById('adminUsersBadge').textContent = data.users.length;

      renderAdminTasks(data.tasks);
      renderAdminBookings(data.bookings);
      renderAdminEmergencies(data.emergencies);
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
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No waste reports recorded yet. Newly reported tasks will appear here.</td></tr>`;
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

function renderAdminUsers(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No registered users in database.</td></tr>`;
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.phone}</td>
      <td>${u.email}</td>
      <td><strong>${u.first_name}</strong></td>
      <td>${u.surname}</td>
      <td>${u.address}</td>
      <td><span class="status-tag status-progress">${u.role.toUpperCase()}</span></td>
      <td>${u.created_at || 'Recently'}</td>
    `;
    tbody.appendChild(tr);
  });
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
      loadAdminData();
    }
  } catch (err) {
    showToast('Failed to update task', 'error');
  }
}

// ----------------- UTILITY & TOAST NOTIFICATIONS -----------------

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
  badge.textContent = parseInt(badge.textContent || 0) + 1;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
