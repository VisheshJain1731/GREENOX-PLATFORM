import os
import sys
import csv
import json
import time
import math
import random
import re
import urllib.request
import urllib.error
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, send_file

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

app = Flask(__name__, static_folder='public', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load local .env file if present
ENV_FILE = os.path.join(BASE_DIR, '.env')
if os.path.exists(ENV_FILE):
    try:
        with open(ENV_FILE, 'r', encoding='utf-8') as ef:
            for line in ef:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k and not os.environ.get(k):
                        os.environ[k] = v
    except Exception:
        pass

DATA_DIR = os.path.join(BASE_DIR, 'data')
CSV_FILE = os.path.join(BASE_DIR, 'registered_user.csv')
USERS_JSON = os.path.join(DATA_DIR, 'users.json')
TASKS_JSON = os.path.join(DATA_DIR, 'tasks.json')
BOOKINGS_JSON = os.path.join(DATA_DIR, 'bookings.json')
EMERGENCIES_JSON = os.path.join(DATA_DIR, 'emergencies.json')
SHOWCASE_JSON = os.path.join(DATA_DIR, 'showcase.json')
REPORTS_JSON = os.path.join(DATA_DIR, 'reports.json')
NOTIFICATIONS_JSON = os.path.join(DATA_DIR, 'notifications.json')
DELETED_ACCOUNTS_JSON = os.path.join(DATA_DIR, 'deleted_accounts.json')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, 'public', 'uploads'), exist_ok=True)

# Helper functions for persistent JSON files
def load_json(filepath, default_data):
    if not os.path.exists(filepath):
        save_json(filepath, default_data)
        return default_data
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default_data

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Initialize CSV file with required headers
CSV_HEADERS = ['Phone Number', 'Email', 'First Name', 'Surname', 'Address', 'Role', 'Registered At', 'Aadhaar / Org ID', 'Employee Type / Org Name']

def init_csv():
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(CSV_HEADERS)

def append_user_to_csv(user):
    init_csv()
    with open(CSV_FILE, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            user.get('phone', ''),
            user.get('email', ''),
            user.get('first_name', ''),
            user.get('surname', ''),
            user.get('address', ''),
            user.get('role', ''),
            user.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            user.get('aadhaar') or user.get('org_id') or '',
            user.get('employee_type') or user.get('org_name') or ''
        ])

def rewrite_all_users_to_csv(users_list):
    with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(CSV_HEADERS)
        for u in users_list:
            writer.writerow([
                u.get('phone', ''),
                u.get('email', ''),
                u.get('first_name', ''),
                u.get('surname', ''),
                u.get('address', ''),
                u.get('role', ''),
                u.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                u.get('aadhaar') or u.get('org_id') or '',
                u.get('employee_type') or u.get('org_name') or ''
            ])

def validate_password_policy(password):
    if not password:
        return False, "Password cannot be empty."
    if len(password) > 20:
        return False, "Password must be maximum 20 characters in length."
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    if not has_digit:
        return False, "Password must contain at least one digit (0-9)."
    if not has_special:
        return False, "Password must contain at least one special character (!@#$%^&*...)."
    return True, ""

# Ensure clean databases exist without dummy data
def ensure_clean_storage():
    init_csv()
    if not os.path.exists(USERS_JSON):
        save_json(USERS_JSON, [])
    if not os.path.exists(TASKS_JSON):
        save_json(TASKS_JSON, [])
    if not os.path.exists(BOOKINGS_JSON):
        save_json(BOOKINGS_JSON, [])
    if not os.path.exists(EMERGENCIES_JSON):
        save_json(EMERGENCIES_JSON, [])
    if not os.path.exists(SHOWCASE_JSON):
        save_json(SHOWCASE_JSON, [])
    if not os.path.exists(REPORTS_JSON):
        save_json(REPORTS_JSON, [])
    if not os.path.exists(NOTIFICATIONS_JSON):
        save_json(NOTIFICATIONS_JSON, [])
    if not os.path.exists(DELETED_ACCOUNTS_JSON):
        save_json(DELETED_ACCOUNTS_JSON, [])

ensure_clean_storage()

# ----------------- AUTHENTICATION API -----------------

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    first_name = data.get('first_name', '').strip()
    surname = data.get('surname', '').strip()
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip().lower()
    address = data.get('address', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')
    role = data.get('role', 'citizen').strip().lower()
    admin_key = data.get('admin_key', '').strip()
    aadhaar = data.get('aadhaar', '').strip()
    employee_type = data.get('employee_type', 'govt').strip().lower()
    org_id = data.get('org_id', '').strip()
    org_name = data.get('org_name', '').strip()
    is_google = data.get('is_google', False)

    # Basic validations
    if not first_name or not phone or not email:
        return jsonify({"success": False, "message": "First name, phone number, and email must be filled."}), 400

    # Phone number validation (must be exactly 10 digits)
    if len(phone) != 10 or not phone.isdigit():
        return jsonify({"success": False, "message": "Registration failed: Phone number must be exactly 10 digits."}), 400

    # Email format validation
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({"success": False, "message": "Please enter a valid email address."}), 400

    # For standard registration (non-google), validate password
    if not is_google:
        if not password:
            return jsonify({"success": False, "message": "Password is required."}), 400
        if password != confirm_password:
            return jsonify({"success": False, "message": "Confirm password does not match!"}), 400
        
        # Strict Password Policy check (0 to 20 chars, digit, special char)
        is_valid_pwd, pwd_msg = validate_password_policy(password)
        if not is_valid_pwd:
            return jsonify({"success": False, "message": pwd_msg}), 400
    else:
        if not password:
            password = "GoogleAuth@2026"

    # Employee Specific Validation
    if role == 'employee':
        if not aadhaar or len(aadhaar) != 10 or not aadhaar.isdigit():
            return jsonify({"success": False, "message": "Aadhaar number must be exactly 10 numeric digits."}), 400
        if employee_type not in ['govt', 'private']:
            employee_type = 'govt'

    # Organization Specific Validation
    if role == 'organization':
        if not org_id:
            return jsonify({"success": False, "message": "Organization ID is required."}), 400
        if not org_name:
            return jsonify({"success": False, "message": "Organization Name is required."}), 400

    # Admin key validation
    if role == 'admin':
        if admin_key != 'GREEN@OX':
            return jsonify({"success": False, "message": "Failed to register: Invalid GREENOX Admin Key."}), 403

    users = load_json(USERS_JSON, [])
    
    # Check duplicate phone or email for the role
    for u in users:
        if u.get('email') == email and u.get('role') == role:
            return jsonify({"success": False, "message": f"An account with email {email} already exists for role {role.capitalize()}."}), 400
        if u.get('phone') == phone and u.get('role') == role:
            return jsonify({"success": False, "message": f"An account with phone number {phone} already exists for role {role.capitalize()}."}), 400

    new_user = {
        "first_name": first_name,
        "surname": surname,
        "phone": phone,
        "email": email,
        "address": address or "Green City Central",
        "password": password,
        "role": role,
        "aadhaar": aadhaar if role == 'employee' else '',
        "employee_type": employee_type if role == 'employee' else '',
        "org_id": org_id if role == 'organization' else '',
        "org_name": org_name if role == 'organization' else '',
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    users.append(new_user)
    save_json(USERS_JSON, users)
    append_user_to_csv(new_user)

    user_clean = {k: v for k, v in new_user.items() if k != 'password'}
    return jsonify({
        "success": True,
        "message": "Registration completed successfully!",
        "user": user_clean
    })

LOGIN_ATTEMPTS = {}  # key: ip_role_id -> {"attempts": int, "lockout_until": float}

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'citizen').strip().lower()

    if not phone or not email or not password:
        return jsonify({"success": False, "message": "Please enter Phone Number, Email, and Password."}), 400

    # Rate limiting key by client IP + role + user identifier
    ip = get_client_ip()
    user_id_key = f"{email}|{phone}" if (email or phone) else "unknown"
    lock_key = f"{ip}:{role}:{user_id_key}"

    now = time.time()
    attempt_info = LOGIN_ATTEMPTS.get(lock_key, {"attempts": 0, "lockout_until": 0})

    # Check if currently in 3-minute lockout
    if attempt_info.get("lockout_until", 0) > now:
        remaining = int(attempt_info["lockout_until"] - now)
        mins = remaining // 60
        secs = remaining % 60
        time_str = f"{mins} min {secs} sec" if mins > 0 else f"{secs} sec"
        return jsonify({
            "success": False,
            "locked": True,
            "remaining_seconds": remaining,
            "message": f"Too many failed login attempts! Login refused. Please wait {time_str} before trying again (3-minute lockout)."
        }), 429

    # If lockout expired, reset attempts
    if attempt_info.get("lockout_until", 0) > 0 and attempt_info.get("lockout_until", 0) <= now:
        attempt_info = {"attempts": 0, "lockout_until": 0}
        LOGIN_ATTEMPTS[lock_key] = attempt_info

    users = load_json(USERS_JSON, [])
    
    matched_user = None
    for u in users:
        if u.get('phone') == phone and u.get('email') == email and u.get('password') == password and u.get('role') == role:
            matched_user = u
            break

    if not matched_user:
        current_attempts = attempt_info.get("attempts", 0) + 1
        if current_attempts >= 7:
            # Trigger 3-minute lockout (180 seconds)
            attempt_info["attempts"] = current_attempts
            attempt_info["lockout_until"] = now + 180
            LOGIN_ATTEMPTS[lock_key] = attempt_info
            return jsonify({
                "success": False,
                "locked": True,
                "remaining_seconds": 180,
                "message": "Maximum 7 login attempts exceeded! Access is locked and login refused for 3 minutes."
            }), 429
        else:
            attempt_info["attempts"] = current_attempts
            LOGIN_ATTEMPTS[lock_key] = attempt_info
            attempts_left = 7 - current_attempts
            return jsonify({
                "success": False,
                "attempts_left": attempts_left,
                "message": f"Wrong details entered! Phone number, email, and password must match registered records. Attempts remaining: {attempts_left}/7."
            }), 401

    # Login successful: reset failed attempt counter and clear force_logout if set
    LOGIN_ATTEMPTS.pop(lock_key, None)
    if matched_user.get('force_logout'):
        matched_user['force_logout'] = False
        save_json(USERS_JSON, users)

    user_clean = {k: v for k, v in matched_user.items() if k != 'password'}
    return jsonify({
        "success": True,
        "message": f"Welcome, {matched_user.get('first_name')}!",
        "user": user_clean
    })

@app.route('/api/user/update-address', methods=['POST'])
def update_address():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    new_address = data.get('address', '').strip()

    if not new_address:
        return jsonify({"success": False, "message": "Address cannot be empty."}), 400

    users = load_json(USERS_JSON, [])
    updated = False
    for u in users:
        if u.get('email') == email or u.get('phone') == phone:
            u['address'] = new_address
            updated = True

    if updated:
        save_json(USERS_JSON, users)
        rewrite_all_users_to_csv(users)
        return jsonify({"success": True, "message": "Address updated successfully!", "address": new_address})
    
    return jsonify({"success": False, "message": "User not found."}), 404

# ----------------- REPORT WASTE API (TASKS) -----------------

@app.route('/api/reports', methods=['POST'])
def create_report():
    data = request.get_json() or {}
    headline = data.get('address', '').strip() or "Greenox Reported Location"
    photo = data.get('photo', '')
    waste_type = data.get('waste_type', 'General Waste')
    lat = data.get('lat', 28.6139)
    lng = data.get('lng', 77.2090)
    address = data.get('address', 'Green City Landmark').strip()
    reporter_name = data.get('reporter_name', 'Citizen Reporter')
    reporter_phone = data.get('reporter_phone', '')
    reporter_email = data.get('reporter_email', '')

    tasks = load_json(TASKS_JSON, [])
    task_id = f"TASK-{int(time.time() % 10000):04d}"

    new_task = {
        "id": task_id,
        "headline": headline,
        "address": address,
        "waste_type": waste_type,
        "photo": photo or "https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80",
        "lat": lat,
        "lng": lng,
        "reporter_name": reporter_name,
        "reporter_phone": reporter_phone,
        "reporter_email": reporter_email,
        "status": "Pending",
        "assigned_team": "Government Municipal Squad",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    tasks.insert(0, new_task)
    save_json(TASKS_JSON, tasks)

    return jsonify({
        "success": True,
        "message": "Waste report submitted successfully! Dispatched to Government Municipal team.",
        "task": new_task
    })

# ----------------- BOOK CLEANING API (PRIVATE BOOKINGS) -----------------

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.get_json() or {}
    service_name = data.get('service_name', 'Home Deep Cleaning')
    service_price = data.get('service_price', 1499)
    receipt = data.get('receipt', {})
    timing_slot = data.get('timing_slot', 'Immediate Express (within 2 hrs)')
    address = data.get('address', 'Green City Residence').strip()
    customer_name = data.get('customer_name', 'Registered User')
    customer_phone = data.get('customer_phone', '')
    customer_email = data.get('customer_email', '')
    user_type = data.get('user_type', 'citizen')
    org_name = data.get('org_name', '')
    tree_planting_included = bool(data.get('tree_planting_included', False))
    tree_addon_price = data.get('tree_addon_price', 299 if tree_planting_included else 0)
    has_tree_planting = bool(data.get('has_tree_planting', False) or tree_planting_included or ('Plant a Tree' in service_name))

    bookings = load_json(BOOKINGS_JSON, [])
    booking_id = f"PB-{int(time.time() % 10000):04d}"

    new_booking = {
        "id": booking_id,
        "service_name": service_name,
        "service_price": service_price,
        "receipt": receipt,
        "timing_slot": timing_slot,
        "address": address,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "user_type": user_type,
        "org_name": org_name,
        "tree_planting_included": tree_planting_included,
        "tree_addon_price": tree_addon_price,
        "has_tree_planting": has_tree_planting,
        "status": "Pending",
        "assigned_team": "Private Eco-Clean Team",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    bookings.insert(0, new_booking)
    save_json(BOOKINGS_JSON, bookings)

    return jsonify({
        "success": True,
        "message": "Cleaning service booked successfully! Assigned to Private Cleaning Team.",
        "booking": new_booking
    })

# ----------------- EMERGENCY HELP API -----------------

@app.route('/api/emergency', methods=['POST'])
def create_emergency():
    data = request.get_json() or {}
    emg_type = data.get('type', 'same_location')
    caller_name = data.get('caller_name', 'Registered Citizen')
    caller_phone = data.get('caller_phone', '')
    caller_email = data.get('caller_email', '')
    address = data.get('address', 'Current Location').strip()
    emergency_details = data.get('emergency_details', 'Critical Environmental Waste Emergency').strip()
    severity = data.get('severity', 'CRITICAL')
    lat = data.get('lat', 28.6139)
    lng = data.get('lng', 77.2090)

    emergencies = load_json(EMERGENCIES_JSON, [])
    emg_id = f"EMG-{int(time.time() % 10000):04d}"

    new_emergency = {
        "id": emg_id,
        "type": emg_type,
        "headline": f"EMERGENCY CALL: {emergency_details[:40]}...",
        "emergency_details": emergency_details,
        "address": address,
        "lat": lat,
        "lng": lng,
        "caller_name": caller_name,
        "caller_phone": caller_phone,
        "caller_email": caller_email,
        "severity": severity,
        "status": "DISPATCHED",
        "dispatched_team": "Private Emergency Hazmat Squad",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    emergencies.insert(0, new_emergency)
    save_json(EMERGENCIES_JSON, emergencies)

    return jsonify({
        "success": True,
        "message": "EMERGENCY DISPATCHED! Alert sent to Admin and Private Emergency Teams.",
        "emergency": new_emergency
    })

# ----------------- EMPLOYEE DATA ROUTING API -----------------

@app.route('/api/employee/data', methods=['GET'])
def get_employee_data():
    employee_type = request.args.get('type', 'govt').strip().lower()
    email = request.args.get('email', '').strip().lower()
    phone = request.args.get('phone', '').strip()
    name = request.args.get('name', '').strip()
    
    if employee_type == 'govt':
        tasks = load_json(TASKS_JSON, [])
        # Pending / Available tasks that have not been accepted or assigned
        available_tasks = [t for t in tasks if t.get('status') == 'Pending' and not t.get('assigned_to')]
        
        def matches_emp(t):
            t_email = (t.get('assigned_to_email') or '').strip().lower()
            t_phone = (t.get('assigned_to_phone') or '').strip()
            t_name = (t.get('assigned_to') or '').strip().lower()
            return (email and t_email == email) or (phone and t_phone == phone) or (name and t_name == name.lower())
        
        my_accepted_tasks = [t for t in tasks if t.get('status') in ['Accepted', 'Assigned', 'In Progress'] and matches_emp(t)]
        my_solved_tasks = [t for t in tasks if t.get('status') == 'Resolved' and (matches_emp(t) or ((t.get('resolved_by') or '').strip().lower() == name.lower() if name else False))]
        
        ratings = [t.get('citizen_rating') for t in my_solved_tasks if t.get('citizen_rating')]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 5.0

        return jsonify({
            "success": True,
            "type": "govt",
            "available_tasks": available_tasks,
            "my_accepted_tasks": my_accepted_tasks,
            "my_solved_tasks": my_solved_tasks,
            "pending_tasks": [t for t in tasks if t.get('status') != 'Resolved'],
            "all_tasks": tasks,
            "solved_count": len(my_solved_tasks),
            "avg_rating": avg_rating,
            "rating_count": len(ratings)
        })
    else:
        bookings = load_json(BOOKINGS_JSON, [])
        emergencies = load_json(EMERGENCIES_JSON, [])
        
        def matches_emp_b(b):
            b_email = (b.get('assigned_to_email') or '').strip().lower()
            b_phone = (b.get('assigned_to_phone') or '').strip()
            b_name = (b.get('assigned_to') or '').strip().lower()
            return (email and b_email == email) or (phone and b_phone == phone) or (name and b_name == name.lower())
        
        available_bookings = [b for b in bookings if b.get('status') == 'Pending' and not b.get('assigned_to')]
        my_accepted_bookings = [b for b in bookings if b.get('status') in ['Accepted', 'Assigned', 'In Progress'] and matches_emp_b(b)]
        my_completed_bookings = [b for b in bookings if b.get('status') == 'Completed' and (matches_emp_b(b) or ((b.get('resolved_by') or '').strip().lower() == name.lower() if name else False))]
        
        return jsonify({
            "success": True,
            "type": "private",
            "available_bookings": available_bookings,
            "my_accepted_bookings": my_accepted_bookings,
            "my_completed_bookings": my_completed_bookings,
            "pending_tasks": [b for b in bookings if b.get('status') != 'Completed'],
            "all_bookings": bookings,
            "emergencies": [e for e in emergencies if e.get('status') in ['DISPATCHED', 'EN_ROUTE']],
            "solved_count": len(my_completed_bookings)
        })

@app.route('/api/employee/accept-task', methods=['POST'])
def accept_employee_task():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    employee_name = data.get('employee_name', 'Government Municipal Employee').strip()
    employee_email = data.get('employee_email', '').strip().lower()
    employee_phone = data.get('employee_phone', '').strip()

    if not task_id:
        return jsonify({"success": False, "message": "Task ID is required."}), 400

    tasks = load_json(TASKS_JSON, [])
    target = None
    for t in tasks:
        if t.get('id') == task_id:
            t['status'] = 'Accepted'
            t['assigned_to'] = employee_name
            t['assigned_to_email'] = employee_email
            t['assigned_to_phone'] = employee_phone
            t['accepted_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            target = t
            break

    if not target:
        return jsonify({"success": False, "message": "Task not found."}), 404

    save_json(TASKS_JSON, tasks)
    return jsonify({
        "success": True,
        "message": f"Task {task_id} successfully accepted! It has been moved to your 'My Accepted Tasks' tab.",
        "task": target
    })

@app.route('/api/admin/assign-task', methods=['POST'])
def admin_assign_task():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    employee_name = data.get('employee_name', '').strip()
    employee_email = data.get('employee_email', '').strip().lower()
    employee_phone = data.get('employee_phone', '').strip()

    if not task_id or not employee_name:
        return jsonify({"success": False, "message": "Task ID and Employee selection are required."}), 400

    tasks = load_json(TASKS_JSON, [])
    target = None
    for t in tasks:
        if t.get('id') == task_id:
            t['status'] = 'Assigned'
            t['assigned_to'] = employee_name
            t['assigned_to_email'] = employee_email
            t['assigned_to_phone'] = employee_phone
            t['assigned_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            target = t
            break

    if not target:
        return jsonify({"success": False, "message": "Task not found."}), 404

    save_json(TASKS_JSON, tasks)
    return jsonify({
        "success": True,
        "message": f"Task {task_id} assigned to '{employee_name}' successfully!",
        "task": target
    })

@app.route('/api/employee/complete-task', methods=['POST'])
def employee_complete_task():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    after_photo = data.get('after_photo', '')
    time_consumed = data.get('time_consumed', '30 mins').strip()
    notes = data.get('notes', 'Cleaned & verified on site.').strip()
    employee_name = data.get('employee_name', 'Municipal Employee').strip()
    employee_email = data.get('employee_email', '').strip().lower()
    employee_phone = data.get('employee_phone', '').strip()

    if not task_id:
        return jsonify({"success": False, "message": "Task ID is required."}), 400

    tasks = load_json(TASKS_JSON, [])
    target = None
    for t in tasks:
        if t.get('id') == task_id:
            t['status'] = 'Resolved'
            t['resolved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            t['resolved_by'] = employee_name
            t['resolved_by_email'] = employee_email
            t['resolved_by_phone'] = employee_phone
            t['resolved_after_photo'] = after_photo
            t['resolved_time_consumed'] = time_consumed
            t['resolved_notes'] = notes
            target = t
            break

    if not target:
        return jsonify({"success": False, "message": "Task not found."}), 404

    # Award random 40 to 70 Greenox Points to citizen reporter
    awarded_pts = target.get('awarded_points')
    if not awarded_pts:
        awarded_pts = random.randint(40, 70)
        target['awarded_points'] = awarded_pts
        target['points_awarded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Find reporter user in users.json and credit points
        rep_email = target.get('reporter_email', '').strip().lower()
        rep_phone = target.get('reporter_phone', '').strip()
        all_users = load_json(USERS_JSON, [])
        for u in all_users:
            if (rep_email and u.get('email', '').strip().lower() == rep_email) or \
               (rep_phone and u.get('phone', '').strip() == rep_phone):
                u['greenox_points'] = u.get('greenox_points', 0) + awarded_pts
                if 'points_history' not in u:
                    u['points_history'] = []
                u['points_history'].insert(0, {
                    "id": f"PTS-{int(time.time() % 100000):05d}",
                    "type": "earned",
                    "points": awarded_pts,
                    "reason": f"Complaint #{target.get('id')} resolved by {employee_name} ({target.get('headline')})",
                    "date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
                break
        save_json(USERS_JSON, all_users)

    # Push persistent popup notification for citizen reporter
    rep_email = target.get('reporter_email', '').strip().lower()
    rep_phone = target.get('reporter_phone', '').strip()
    headline_info = target.get('headline') or target.get('address') or task_id
    
    notifications = load_json(NOTIFICATIONS_JSON, [])
    notif_id = f"NOTIF-{int(time.time() % 100000):05d}"
    new_notif = {
        "id": notif_id,
        "type": "complaint_resolved",
        "title": "🎉 Your Reported Issue Has Been Resolved!",
        "message": f"Your waste report #{task_id} at '{headline_info}' was successfully cleaned by {employee_name} in {time_consumed}. You have been awarded +{awarded_pts} GREENOX Points!",
        "recipient_email": rep_email,
        "recipient_phone": rep_phone,
        "ref_id": task_id,
        "ref_type": "complaint",
        "awarded_points": awarded_pts,
        "time_consumed": time_consumed,
        "employee_name": employee_name,
        "headline": headline_info,
        "before_photo": target.get('photo', ''),
        "after_photo": after_photo,
        "popup_alert": True,
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "unread": True
    }
    notifications.insert(0, new_notif)
    save_json(NOTIFICATIONS_JSON, notifications)
    save_json(TASKS_JSON, tasks)

    # Also add to public showcase feed
    showcase = load_json(SHOWCASE_JSON, [])
    new_showcase_item = {
        "id": f"CASE-{int(time.time() % 10000):04d}",
        "headline": target.get('headline'),
        "address": target.get('address'),
        "waste_type": target.get('waste_type'),
        "before_photo": target.get('photo'),
        "after_photo": after_photo or "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
        "time_consumed": time_consumed,
        "duration_minutes": int(time_consumed.split()[0]) if time_consumed.split()[0].isdigit() else 30,
        "team": employee_name or target.get('assigned_team', 'Government Municipal Squad'),
        "solved_at": "Just now",
        "rating": 5.0,
        "status": "Resolved & Verified"
    }
    showcase.insert(0, new_showcase_item)
    save_json(SHOWCASE_JSON, showcase)

    return jsonify({
        "success": True,
        "message": f"Task #{task_id} completed successfully! {awarded_pts} Greenox points credited to citizen.",
        "task": target,
        "awarded_points": awarded_pts,
        "notification": new_notif
    })

# ----------------- CITIZEN TASK RATING API -----------------

@app.route('/api/citizen/rate-task', methods=['POST'])
def rate_citizen_task():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    try:
        rating = float(data.get('rating', 5.0))
    except (ValueError, TypeError):
        rating = 5.0
    rating = max(1.0, min(5.0, round(rating, 1)))

    feedback = data.get('feedback', '').strip()
    tags = data.get('tags', [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(',') if t.strip()]

    citizen_email = data.get('citizen_email', '').strip().lower()
    citizen_phone = data.get('citizen_phone', '').strip()
    citizen_name = data.get('citizen_name', 'Citizen').strip()

    if not task_id:
        return jsonify({"success": False, "message": "Task ID is required."}), 400

    tasks = load_json(TASKS_JSON, [])
    target_task = None
    for t in tasks:
        if t.get('id') == task_id:
            t['citizen_rating'] = rating
            t['citizen_feedback'] = feedback
            t['citizen_rating_tags'] = tags
            t['citizen_rated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            t['citizen_rated_by'] = citizen_name
            target_task = t
            break

    if not target_task:
        return jsonify({"success": False, "message": "Task not found."}), 404

    save_json(TASKS_JSON, tasks)

    # Update showcase record if present
    showcase = load_json(SHOWCASE_JSON, [])
    for s in showcase:
        if s.get('id') == task_id or s.get('headline') == target_task.get('headline') or s.get('address') == target_task.get('address'):
            s['rating'] = rating
            if feedback:
                s['citizen_feedback'] = feedback
            if tags:
                s['rating_tags'] = tags
            break
    save_json(SHOWCASE_JSON, showcase)

    # Update notification record if present
    notifications = load_json(NOTIFICATIONS_JSON, [])
    for n in notifications:
        if n.get('ref_id') == task_id and n.get('type') == 'complaint_resolved':
            n['rated'] = True
            n['citizen_rating'] = rating
            n['citizen_feedback'] = feedback
            n['citizen_rating_tags'] = tags
    save_json(NOTIFICATIONS_JSON, notifications)

    return jsonify({
        "success": True,
        "message": f"Thank you! Your {int(rating) if rating.is_integer() else rating}-Star rating has been recorded successfully.",
        "task": target_task,
        "rating": rating
    })

@app.route('/api/employee/delete-account', methods=['POST'])
def employee_delete_account():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', 'employee').strip().lower()

    if (not email and not phone) or not password:
        return jsonify({"success": False, "message": "Login password is required to permanently delete account."}), 400

    users = load_json(USERS_JSON, [])
    target_idx = None
    target_user = None

    for i, u in enumerate(users):
        u_email = (u.get('email') or '').strip().lower()
        u_phone = (u.get('phone') or '').strip()
        u_role = (u.get('role') or '').strip().lower()
        
        if ((email and u_email == email) or (phone and u_phone == phone)) and (not role or u_role == role):
            if u.get('password') == password:
                target_idx = i
                target_user = u
                break
            else:
                return jsonify({"success": False, "message": "Incorrect password! Permanent account deletion cancelled."}), 401

    if target_user is None:
        return jsonify({"success": False, "message": "Account not found or password does not match registered credentials."}), 404

    # Calculate employee stats (total problems solved)
    full_name = f"{target_user.get('first_name', '')} {target_user.get('surname', '')}".strip()
    tasks = load_json(TASKS_JSON, [])
    bookings = load_json(BOOKINGS_JSON, [])
    emergencies = load_json(EMERGENCIES_JSON, [])

    emp_email = target_user.get('email', '').strip().lower()
    emp_phone = target_user.get('phone', '').strip()

    solved_tasks = [
        t for t in tasks
        if t.get('status') == 'Resolved' and (
            (emp_email and t.get('assigned_to_email') == emp_email) or
            (emp_phone and t.get('assigned_to_phone') == emp_phone) or
            (full_name and (t.get('resolved_by') == full_name or t.get('assigned_to') == full_name))
        )
    ]
    completed_bookings = [
        b for b in bookings
        if b.get('status') == 'Completed' and (
            (emp_email and b.get('assigned_to_email') == emp_email) or
            (emp_phone and b.get('assigned_to_phone') == emp_phone) or
            (full_name and (b.get('resolved_by') == full_name or b.get('assigned_to') == full_name))
        )
    ]
    resolved_emergencies = [
        e for e in emergencies
        if e.get('status') == 'RESOLVED' and (
            full_name and e.get('resolved_by') == full_name
        )
    ]

    total_solved = len(solved_tasks) + len(completed_bookings) + len(resolved_emergencies)

    # Archive to DELETED_ACCOUNTS_JSON
    deleted_accounts = load_json(DELETED_ACCOUNTS_JSON, [])
    deleted_record = {
        "id": f"DEL-{int(time.time() % 100000):05d}",
        "first_name": target_user.get('first_name', ''),
        "surname": target_user.get('surname', ''),
        "name": full_name,
        "full_name": full_name,
        "phone": target_user.get('phone', ''),
        "email": target_user.get('email', ''),
        "address": target_user.get('address', ''),
        "role": target_user.get('role', 'employee'),
        "employee_type": target_user.get('employee_type', 'govt'),
        "aadhaar": target_user.get('aadhaar', ''),
        "org_id": target_user.get('org_id', ''),
        "org_name": target_user.get('org_name', ''),
        "problems_solved_count": total_solved,
        "solved_tasks_count": len(solved_tasks),
        "completed_bookings_count": len(completed_bookings),
        "resolved_emergencies_count": len(resolved_emergencies),
        "registered_at": target_user.get('created_at', ''),
        "deleted_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "deletion_reason": "Employee self-initiated permanent deletion with password confirmation",
        "status": "Permanently Deleted & Archived"
    }

    deleted_accounts.insert(0, deleted_record)
    save_json(DELETED_ACCOUNTS_JSON, deleted_accounts)

    # Remove user from users.json and sync CSV
    users.pop(target_idx)
    save_json(USERS_JSON, users)
    rewrite_all_users_to_csv(users)

    return jsonify({
        "success": True,
        "message": f"Employee account for '{full_name}' has been permanently deleted! Performance profile ({total_solved} solved tasks) has been safely archived in the Admin Deleted Accounts panel.",
        "archived_record": deleted_record
    })

# ----------------- CITIZEN HISTORY & TRACKING API -----------------

@app.route('/api/citizen/history', methods=['GET'])
def get_citizen_history():
    email = request.args.get('email', '').strip().lower()
    phone = request.args.get('phone', '').strip()

    bookings = load_json(BOOKINGS_JSON, [])
    tasks = load_json(TASKS_JSON, [])
    emergencies = load_json(EMERGENCIES_JSON, [])

    user_bookings = [b for b in bookings if (email and b.get('customer_email') == email) or (phone and b.get('customer_phone') == phone)]
    user_tasks = [t for t in tasks if (email and t.get('reporter_email') == email) or (phone and t.get('reporter_phone') == phone)]
    user_emergencies = [e for e in emergencies if (email and e.get('caller_email') == email) or (phone and e.get('caller_phone') == phone)]

    return jsonify({
        "success": True,
        "bookings": user_bookings,
        "tasks": user_tasks,
        "emergencies": user_emergencies
    })

# ----------------- EMERGENCY RESOLVE & FALSE REPORT API -----------------

@app.route('/api/emergency/resolve', methods=['POST'])
def resolve_emergency():
    data = request.get_json() or {}
    emg_id = data.get('emergency_id')
    photo = data.get('photo', '')
    notes = data.get('notes', 'Emergency spot cleared and verified.')
    employee_name = data.get('employee_name', 'Private Responder')

    emergencies = load_json(EMERGENCIES_JSON, [])
    target = None
    for e in emergencies:
        if e.get('id') == emg_id:
            e['status'] = 'RESOLVED'
            e['resolved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            e['resolved_by'] = employee_name
            e['resolved_photo'] = photo
            e['resolved_notes'] = notes
            target = e
            break

    if not target:
        return jsonify({"success": False, "message": "Emergency request not found."}), 404

    save_json(EMERGENCIES_JSON, emergencies)
    return jsonify({"success": True, "message": f"Emergency {emg_id} resolved successfully!", "emergency": target})

@app.route('/api/emergency/false-report', methods=['POST'])
def report_false_emergency():
    data = request.get_json() or {}
    emg_id = data.get('emergency_id')
    employee_name = data.get('employee_name', 'Private Employee')
    employee_phone = data.get('employee_phone', '')
    employee_gps = data.get('employee_gps', '')
    emergency_location = data.get('emergency_location', '')
    location_match_status = data.get('location_match_status', 'LOCATION NOT MATCHED')
    photo = data.get('photo', '')
    reason = data.get('reason', 'No active emergency found at coordinates.')

    emergencies = load_json(EMERGENCIES_JSON, [])
    target_emg = None
    for e in emergencies:
        if e.get('id') == emg_id:
            e['status'] = 'FALSE_ALARM_REPORTED'
            target_emg = e
            break

    save_json(EMERGENCIES_JSON, emergencies)

    # Save to reports.json
    reports = load_json(REPORTS_JSON, [])
    report_id = f"RPT-{int(time.time() % 10000):04d}"
    new_report = {
        "id": report_id,
        "emergency_id": emg_id,
        "emergency_headline": target_emg.get('headline') if target_emg else 'Hazard SOS',
        "caller_name": target_emg.get('caller_name') if target_emg else 'Citizen',
        "caller_phone": target_emg.get('caller_phone') if target_emg else '',
        "emergency_location": emergency_location or (target_emg.get('address') if target_emg else ''),
        "employee_name": employee_name,
        "employee_phone": employee_phone,
        "employee_gps": employee_gps,
        "location_match_status": location_match_status,
        "photo_proof": photo,
        "reason": reason,
        "filed_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "status": "Under Review"
    }

    reports.insert(0, new_report)
    save_json(REPORTS_JSON, reports)

    return jsonify({
        "success": True,
        "message": "False emergency report submitted to Admin Investigation panel.",
        "report": new_report
    })

# ----------------- SHOWCASE / SOLVED COMPLAINTS API -----------------

@app.route('/api/showcase', methods=['GET'])
def get_showcase():
    showcase = load_json(SHOWCASE_JSON, [])
    return jsonify({
        "success": True,
        "count": len(showcase),
        "showcase": showcase
    })

# ----------------- ADMIN PORTAL API -----------------

@app.route('/api/admin/data', methods=['GET'])
def get_admin_data():
    tasks = load_json(TASKS_JSON, [])
    bookings = load_json(BOOKINGS_JSON, [])
    emergencies = load_json(EMERGENCIES_JSON, [])
    showcase = load_json(SHOWCASE_JSON, [])
    users = load_json(USERS_JSON, [])
    reports = load_json(REPORTS_JSON, [])
    notifications = load_json(NOTIFICATIONS_JSON, [])
    deleted_accounts = load_json(DELETED_ACCOUNTS_JSON, [])
    
    users_clean = [{k: v for k, v in u.items() if k != 'password'} for u in users]
    employees = [u for u in users_clean if u.get('role') == 'employee']
    solved_tasks = [t for t in tasks if t.get('status') == 'Resolved']

    return jsonify({
        "success": True,
        "tasks": tasks,
        "solved_tasks": solved_tasks,
        "bookings": bookings,
        "emergencies": emergencies,
        "showcase": showcase,
        "users": users_clean,
        "employees": employees,
        "reports": reports,
        "notifications": notifications,
        "deleted_accounts": deleted_accounts,
        "stats": {
            "total_tasks": len(tasks),
            "pending_tasks": len([t for t in tasks if t.get('status') == 'Pending']),
            "solved_tasks": len(solved_tasks),
            "private_bookings": len(bookings),
            "emergency_calls": len(emergencies),
            "solved_cases": len(showcase),
            "registered_users": len(users),
            "registered_employees": len(employees),
            "deleted_accounts": len(deleted_accounts),
            "false_reports": len(reports)
        }
    })

@app.route('/api/admin/update-task-status', methods=['POST'])
def update_task_status():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    new_status = data.get('status', 'Resolved')
    after_photo = data.get('after_photo', '')
    time_consumed = data.get('time_consumed', '30 mins')

    tasks = load_json(TASKS_JSON, [])
    target_task = None
    for t in tasks:
        if t.get('id') == task_id:
            t['status'] = new_status
            target_task = t
            break

    if not target_task:
        return jsonify({"success": False, "message": "Task not found"}), 404

    # If resolved, record resolved details, add to public showcase feed, and award Greenox points
    if new_status == 'Resolved':
        target_task['resolved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        target_task['resolved_after_photo'] = after_photo
        target_task['resolved_time_consumed'] = time_consumed

        # Award 40 to 70 Greenox Points to citizen reporter
        awarded_pts = target_task.get('awarded_points')
        if not awarded_pts:
            awarded_pts = random.randint(40, 70)
            target_task['awarded_points'] = awarded_pts
            target_task['points_awarded_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # Find reporter user in users.json and credit points
            rep_email = target_task.get('reporter_email', '').strip().lower()
            rep_phone = target_task.get('reporter_phone', '').strip()
            if rep_email or rep_phone:
                all_users = load_json(USERS_JSON, [])
                for u in all_users:
                    if (rep_email and u.get('email', '').strip().lower() == rep_email) or \
                       (rep_phone and u.get('phone', '').strip() == rep_phone):
                        u['greenox_points'] = u.get('greenox_points', 0) + awarded_pts
                        if 'points_history' not in u:
                            u['points_history'] = []
                        u['points_history'].insert(0, {
                            "id": f"PTS-{int(time.time() % 100000):05d}",
                            "type": "earned",
                            "points": awarded_pts,
                            "reason": f"Complaint #{target_task.get('id')} resolved by squad ({target_task.get('headline')})",
                            "date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        })
                        break
                save_json(USERS_JSON, all_users)

        save_json(TASKS_JSON, tasks)

        # Push persistent notification for citizen reporter
        rep_email = target_task.get('reporter_email', '').strip().lower()
        rep_phone = target_task.get('reporter_phone', '').strip()
        headline_info = target_task.get('headline') or target_task.get('address') or task_id
        
        notifications = load_json(NOTIFICATIONS_JSON, [])
        notif_id = f"NOTIF-{int(time.time() % 100000):05d}"
        new_notif = {
            "id": notif_id,
            "type": "complaint_resolved",
            "title": "🎉 Your Reported Issue Has Been Resolved!",
            "message": f"Your waste report #{task_id} at '{headline_info}' was successfully resolved. You have received +{awarded_pts} GREENOX Points!",
            "recipient_email": rep_email,
            "recipient_phone": rep_phone,
            "ref_id": task_id,
            "ref_type": "complaint",
            "awarded_points": awarded_pts,
            "time_consumed": time_consumed,
            "headline": headline_info,
            "before_photo": target_task.get('photo', ''),
            "after_photo": after_photo,
            "popup_alert": True,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "unread": True
        }
        notifications.insert(0, new_notif)
        save_json(NOTIFICATIONS_JSON, notifications)

        showcase = load_json(SHOWCASE_JSON, [])
        new_showcase_item = {
            "id": f"CASE-{int(time.time() % 10000):04d}",
            "headline": target_task.get('headline'),
            "address": target_task.get('address'),
            "waste_type": target_task.get('waste_type'),
            "before_photo": target_task.get('photo'),
            "after_photo": after_photo or "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
            "time_consumed": time_consumed,
            "duration_minutes": int(time_consumed.split()[0]) if time_consumed.split()[0].isdigit() else 30,
            "team": target_task.get('assigned_team', 'Government Municipal Squad'),
            "solved_at": "Just now",
            "rating": 5.0,
            "status": "Resolved & Verified"
        }
        showcase.insert(0, new_showcase_item)
        save_json(SHOWCASE_JSON, showcase)
    else:
        save_json(TASKS_JSON, tasks)

    return jsonify({"success": True, "message": f"Task {task_id} marked as {new_status}!", "task": target_task})

@app.route('/api/admin/close-task', methods=['POST'])
def admin_close_task():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    reason = data.get('reason', 'The service / complaint you raised has been temporarily closed due to heavy load. Please try again later.')

    tasks = load_json(TASKS_JSON, [])
    target_task = None
    for t in tasks:
        if t.get('id') == task_id:
            t['status'] = 'Closed (Heavy Load)'
            t['closed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            t['close_reason'] = reason
            target_task = t
            break

    if not target_task:
        return jsonify({"success": False, "message": "Complaint task not found."}), 404

    save_json(TASKS_JSON, tasks)

    # Push persistent notification for citizen reporter
    rep_email = target_task.get('reporter_email', '').strip().lower()
    rep_phone = target_task.get('reporter_phone', '').strip()
    
    notifications = load_json(NOTIFICATIONS_JSON, [])
    notif_id = f"NOTIF-{int(time.time() % 100000):05d}"
    headline_info = target_task.get('headline') or target_task.get('address') or task_id
    new_notif = {
        "id": notif_id,
        "type": "heavy_load_closure",
        "title": f"Complaint #{task_id} Temporarily Closed (Heavy Load)",
        "message": f"The service / complaint you raised for '{headline_info}' has been temporarily closed due to heavy load. Please try again later.",
        "recipient_email": rep_email,
        "recipient_phone": rep_phone,
        "ref_id": task_id,
        "ref_type": "complaint",
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "unread": True
    }
    notifications.insert(0, new_notif)
    save_json(NOTIFICATIONS_JSON, notifications)

    return jsonify({
        "success": True,
        "message": f"Complaint {task_id} closed due to heavy load and notification delivered to citizen.",
        "task": target_task,
        "notification": new_notif
    })

@app.route('/api/admin/close-booking', methods=['POST'])
def admin_close_booking():
    data = request.get_json() or {}
    booking_id = data.get('booking_id')
    reason = data.get('reason', 'The service / private booking you raised has been temporarily closed due to heavy load. Please try again later.')

    bookings = load_json(BOOKINGS_JSON, [])
    target_booking = None
    for b in bookings:
        if b.get('id') == booking_id:
            b['status'] = 'Closed (Heavy Load)'
            b['closed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            b['close_reason'] = reason
            target_booking = b
            break

    if not target_booking:
        return jsonify({"success": False, "message": "Private booking not found."}), 404

    save_json(BOOKINGS_JSON, bookings)

    # Push persistent notification for customer
    cust_email = target_booking.get('customer_email', '').strip().lower()
    cust_phone = target_booking.get('customer_phone', '').strip()

    notifications = load_json(NOTIFICATIONS_JSON, [])
    notif_id = f"NOTIF-{int(time.time() % 100000):05d}"
    service_info = target_booking.get('service_name', 'Eco-Clean')
    new_notif = {
        "id": notif_id,
        "type": "heavy_load_closure",
        "title": f"Booking #{booking_id} Temporarily Closed (Heavy Load)",
        "message": f"The private booking #{booking_id} ({service_info}) you raised has been temporarily closed due to heavy load. Please try again later.",
        "recipient_email": cust_email,
        "recipient_phone": cust_phone,
        "ref_id": booking_id,
        "ref_type": "booking",
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "unread": True
    }
    notifications.insert(0, new_notif)
    save_json(NOTIFICATIONS_JSON, notifications)

    return jsonify({
        "success": True,
        "message": f"Booking {booking_id} closed due to heavy load and notification delivered to customer.",
        "booking": target_booking,
        "notification": new_notif
    })

@app.route('/api/admin/clear-solved-history', methods=['POST'])
def clear_solved_history():
    tasks = load_json(TASKS_JSON, [])
    cleared_count = len([t for t in tasks if t.get('status') == 'Resolved'])
    remaining_tasks = [t for t in tasks if t.get('status') != 'Resolved']

    save_json(TASKS_JSON, remaining_tasks)
    save_json(SHOWCASE_JSON, [])

    return jsonify({
        "success": True,
        "cleared_count": cleared_count,
        "message": f"Successfully cleared all {cleared_count} solved complaints history and showcase records!"
    })

@app.route('/api/admin/delete-solved-task', methods=['POST'])
def delete_solved_task():
    data = request.get_json() or {}
    task_id = data.get('task_id')

    if not task_id:
        return jsonify({"success": False, "message": "Task ID is required."}), 400

    tasks = load_json(TASKS_JSON, [])
    initial_len = len(tasks)
    tasks = [t for t in tasks if not (t.get('id') == task_id and t.get('status') == 'Resolved')]

    if len(tasks) == initial_len:
        return jsonify({"success": False, "message": "Solved task not found."}), 404

    save_json(TASKS_JSON, tasks)

    # Also remove corresponding showcase item if present
    showcase = load_json(SHOWCASE_JSON, [])
    showcase = [s for s in showcase if s.get('id') != task_id and s.get('headline') != task_id]
    save_json(SHOWCASE_JSON, showcase)

    return jsonify({
        "success": True,
        "message": f"Solved complaint record #{task_id} deleted successfully."
    })

@app.route('/api/user/notifications', methods=['GET'])
def get_user_notifications():
    email = request.args.get('email', '').strip().lower()
    phone = request.args.get('phone', '').strip()

    notifications = load_json(NOTIFICATIONS_JSON, [])
    user_notifs = []
    for n in notifications:
        n_email = n.get('recipient_email', '').strip().lower()
        n_phone = n.get('recipient_phone', '').strip()
        if (email and n_email == email) or (phone and n_phone == phone) or (not n_email and not n_phone):
            user_notifs.append(n)

    unread_count = sum(1 for n in user_notifs if n.get('unread', True))
    return jsonify({
        "success": True,
        "notifications": user_notifs,
        "unread_count": unread_count
    })

@app.route('/api/user/notifications/mark-read', methods=['POST'])
def mark_user_notifications_read():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    notif_id = data.get('notification_id')

    notifications = load_json(NOTIFICATIONS_JSON, [])
    updated = False
    for n in notifications:
        n_email = n.get('recipient_email', '').strip().lower()
        n_phone = n.get('recipient_phone', '').strip()
        if (notif_id and n.get('id') == notif_id) or \
           (not notif_id and ((email and n_email == email) or (phone and n_phone == phone))):
            n['unread'] = False
            updated = True

    if updated:
        save_json(NOTIFICATIONS_JSON, notifications)

    return jsonify({"success": True, "message": "Notifications marked as read."})

# ----------------- CITIZEN GREENOX POINTS & REDEEM API -----------------

REWARD_PLANS = {
    "govt_travel_30": {
        "id": "govt_travel_30",
        "name": "30% OFF on Government Travel Vehicle (Train / Bus)",
        "cost": 200,
        "type": "discount",
        "description": "Valid across government regional trains, state buses & municipal metro passes."
    },
    "cashback_5": {
        "id": "cashback_5",
        "name": "₹5 Cashback Reward",
        "cost": 100,
        "type": "cashback",
        "description": "Instant Rs. 5 digital cashback voucher credited to your registered wallet / account."
    },
    "free_bus_ride": {
        "id": "free_bus_ride",
        "name": "Free 1-Time Government Bus Service",
        "cost": 1000,
        "type": "free_pass",
        "description": "100% Free single ride pass across all city municipal & state government buses."
    }
}

@app.route('/api/citizen/points', methods=['GET'])
def get_citizen_points():
    email = request.args.get('email', '').strip().lower()
    phone = request.args.get('phone', '').strip()

    users = load_json(USERS_JSON, [])
    matched = None
    for u in users:
        if (email and u.get('email', '').strip().lower() == email) or (phone and u.get('phone', '').strip() == phone):
            matched = u
            break

    if not matched:
        return jsonify({"success": True, "points": 0, "history": [], "vouchers": []})

    return jsonify({
        "success": True,
        "points": matched.get('greenox_points', 0),
        "history": matched.get('points_history', []),
        "vouchers": matched.get('redeemed_vouchers', [])
    })

@app.route('/api/citizen/redeem', methods=['POST'])
def redeem_points():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    reward_id = data.get('reward_id', '').strip()

    if reward_id not in REWARD_PLANS:
        return jsonify({"success": False, "message": "Invalid reward selection."}), 400

    plan = REWARD_PLANS[reward_id]
    cost = plan["cost"]

    users = load_json(USERS_JSON, [])
    matched_user = None
    for u in users:
        if (email and u.get('email', '').strip().lower() == email) or (phone and u.get('phone', '').strip() == phone):
            matched_user = u
            break

    if not matched_user:
        return jsonify({"success": False, "message": "Citizen account not found."}), 404

    current_points = matched_user.get('greenox_points', 0)
    if current_points < cost:
        return jsonify({
            "success": False,
            "message": f"Insufficient Greenox Points! Required: {cost} points, You have: {current_points} points."
        }), 400

    # Deduct points
    matched_user['greenox_points'] = current_points - cost

    # Generate unique digital voucher code
    prefix_map = {
        "govt_travel_30": "GOVT-TRV30",
        "cashback_5": "CB-RS5",
        "free_bus_ride": "GOVT-BUS-FREE"
    }
    code_prefix = prefix_map.get(reward_id, "GRN-RWD")
    voucher_code = f"{code_prefix}-{int(time.time() % 100000):05d}"

    voucher = {
        "id": f"VCH-{int(time.time() % 10000):04d}",
        "code": voucher_code,
        "reward_id": reward_id,
        "reward_name": plan["name"],
        "cost": cost,
        "description": plan["description"],
        "redeemed_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "expires_at": "Valid for 60 Days",
        "status": "ACTIVE / READY TO USE"
    }

    if 'redeemed_vouchers' not in matched_user:
        matched_user['redeemed_vouchers'] = []
    matched_user['redeemed_vouchers'].insert(0, voucher)

    if 'points_history' not in matched_user:
        matched_user['points_history'] = []
    matched_user['points_history'].insert(0, {
        "id": f"PTS-{int(time.time() % 100000):05d}",
        "type": "redeemed",
        "points": -cost,
        "reason": f"Redeemed: {plan['name']} (Voucher: {voucher_code})",
        "date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })

    save_json(USERS_JSON, users)

    return jsonify({
        "success": True,
        "message": f"Successfully redeemed '{plan['name']}'! Your coupon code is {voucher_code}.",
        "voucher": voucher,
        "remaining_points": matched_user['greenox_points']
    })

# ----------------- ADMIN USER MANAGEMENT & SESSION STATUS -----------------

@app.route('/api/admin/delete-user', methods=['POST'])
def admin_delete_user():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    role = data.get('role', '').strip().lower()

    if not email and not phone:
        return jsonify({"success": False, "message": "Email or Phone required to identify user."}), 400

    users = load_json(USERS_JSON, [])
    original_len = len(users)

    # Filter out target user
    users = [
        u for u in users
        if not (
            ((email and u.get('email', '').strip().lower() == email) or (phone and u.get('phone', '').strip() == phone))
            and (not role or u.get('role', '').strip().lower() == role)
        )
    ]

    if len(users) == original_len:
        return jsonify({"success": False, "message": "User not found in registered database."}), 404

    save_json(USERS_JSON, users)
    rewrite_all_users_to_csv(users)

    return jsonify({
        "success": True,
        "message": "User permanently removed and deleted from GREENOX platform and registered_user.csv!"
    })

@app.route('/api/admin/logout-user', methods=['POST'])
def admin_logout_user():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    role = data.get('role', '').strip().lower()

    users = load_json(USERS_JSON, [])
    updated = False
    for u in users:
        if ((email and u.get('email', '').strip().lower() == email) or (phone and u.get('phone', '').strip() == phone)) \
           and (not role or u.get('role', '').strip().lower() == role):
            u['force_logout'] = True
            u['force_logout_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            updated = True

    if not updated:
        return jsonify({"success": False, "message": "User not found."}), 404

    save_json(USERS_JSON, users)
    return jsonify({
        "success": True,
        "message": "User session invalidated! The user will be logged out immediately upon next activity."
    })

@app.route('/api/user/session-status', methods=['GET'])
def check_session_status():
    email = request.args.get('email', '').strip().lower()
    phone = request.args.get('phone', '').strip()
    role = request.args.get('role', '').strip().lower()

    if not email and not phone:
        return jsonify({"valid": True})

    users = load_json(USERS_JSON, [])
    for u in users:
        if ((email and u.get('email', '').strip().lower() == email) or (phone and u.get('phone', '').strip() == phone)) \
           and (not role or u.get('role', '').strip().lower() == role):
            if u.get('force_logout'):
                u['force_logout'] = False
                save_json(USERS_JSON, users)
                return jsonify({
                    "valid": False,
                    "reason": "force_logout",
                    "message": "Your session has been terminated by the GREENOX Administrator."
                })
            return jsonify({
                "valid": True,
                "greenox_points": u.get('greenox_points', 0)
            })

    # User no longer exists in users.json (was deleted)
    return jsonify({
        "valid": False,
        "reason": "deleted",
        "message": "Your account has been removed from the platform by the Administrator."
    })

@app.route('/api/admin/update-booking-status', methods=['POST'])
def update_booking_status():
    data = request.get_json() or {}
    booking_id = data.get('booking_id')
    new_status = data.get('status', 'Completed')

    bookings = load_json(BOOKINGS_JSON, [])
    target_booking = None
    for b in bookings:
        if b.get('id') == booking_id:
            b['status'] = new_status
            target_booking = b
            break

    if not target_booking:
        return jsonify({"success": False, "message": "Booking not found"}), 404

    save_json(BOOKINGS_JSON, bookings)
    return jsonify({"success": True, "message": f"Booking {booking_id} marked as {new_status}!", "booking": target_booking})

@app.route('/api/admin/download-csv', methods=['GET'])
def download_csv():
    init_csv()
    return send_file(CSV_FILE, as_attachment=True, download_name='registered_user.csv')

# ----------------- STATIC ROUTING -----------------

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    file_path = os.path.join(BASE_DIR, 'public', path)
    if os.path.exists(file_path):
        return send_from_directory('public', path)
    return send_from_directory('public', 'index.html')

if __name__ == '__main__':
    import socket
    import threading
    import webbrowser
    import subprocess
    import re

    port = int(os.environ.get('PORT', 3000))
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    # Start Cloudflare Tunnel in background supervisor thread if cloudflared.exe is present
    cf_exe = os.path.join(BASE_DIR, "cloudflared.exe")
    public_url_file = os.path.join(BASE_DIR, "PUBLIC_URL.txt")

    def run_tunnel():
        if not os.path.exists(cf_exe):
            return

        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

        while True:
            try:
                log_path = os.path.join(BASE_DIR, "tunnel.log")
                cmd = [
                    cf_exe, "tunnel",
                    "--protocol", "http2",
                    "--no-autoupdate",
                    "--url", f"http://127.0.0.1:{port}",
                    "--logfile", log_path
                ]
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
                )

                for _ in range(120):
                    time.sleep(0.3)
                    if os.path.exists(log_path):
                        try:
                            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                                content = f.read()
                                matches = re.findall(r"https://[-a-zA-Z0-9.]+\.trycloudflare\.com", content)
                                if matches:
                                    pub_url = matches[-1]
                                    print("\n" + "=" * 65, flush=True)
                                    print(">> GLOBAL PUBLIC LINK (ACCESSIBLE WORLDWIDE ON ANY PHONE / DEVICE):", flush=True)
                                    print(f">> {pub_url}", flush=True)
                                    print("=" * 65 + "\n", flush=True)
                                    with open(public_url_file, "w", encoding="utf-8") as pf:
                                        pf.write(pub_url)
                                    break
                        except Exception:
                            pass
                
                while proc.poll() is None:
                    time.sleep(3)
                
                print("[!] Cloudflare Tunnel disconnected. Reconnecting in 3 seconds...", flush=True)
                time.sleep(3)

            except Exception as e:
                print(f"[!] Tunnel supervisor notice: {e}", flush=True)
                time.sleep(5)

    threading.Thread(target=run_tunnel, daemon=True).start()

    print("==================================================")
    print("GREENOX ECO-CLEAN WEB PLATFORM")
    print("==================================================")
    print(f"-> Local Machine Access:    http://localhost:3000")
    print(f"-> Local Wi-Fi Network:     http://{local_ip}:3000")
    print("-> Users Database:          registered_user.csv")
    print("==================================================")
    
    app.run(host='0.0.0.0', port=port, debug=False)
