import os
import sys
import csv
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, send_file

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

app = Flask(__name__, static_folder='public', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
CSV_FILE = os.path.join(BASE_DIR, 'registered_user.csv')
USERS_JSON = os.path.join(DATA_DIR, 'users.json')
TASKS_JSON = os.path.join(DATA_DIR, 'tasks.json')
BOOKINGS_JSON = os.path.join(DATA_DIR, 'bookings.json')
EMERGENCIES_JSON = os.path.join(DATA_DIR, 'emergencies.json')
SHOWCASE_JSON = os.path.join(DATA_DIR, 'showcase.json')

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
CSV_HEADERS = ['Phone Number', 'Email', 'First Name', 'Surname', 'Address', 'Role', 'Registered At']

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
            user.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
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
                u.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            ])

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

    # Basic validations
    if not first_name or not surname or not phone or not email or not password:
        return jsonify({"success": False, "message": "All required fields must be filled."}), 400

    # Password match validation
    if password != confirm_password:
        return jsonify({"success": False, "message": "Confirm password does not match!"}), 400

    # Admin key validation (Requirement: Must match GREEN@OX)
    if role == 'admin':
        if admin_key != 'GREEN@OX':
            return jsonify({"success": False, "message": "Failed to login/register: Invalid GREENOX Admin Key."}), 403

    users = load_json(USERS_JSON, [])
    
    # Check if duplicate phone or email exists for the same role
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
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    users.append(new_user)
    save_json(USERS_JSON, users)
    append_user_to_csv(new_user)

    user_clean = {k: v for k, v in new_user.items() if k != 'password'}
    return jsonify({
        "success": True,
        "message": "Registration completed successfully! Data saved to backend and registered_user.csv.",
        "user": user_clean
    })

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'citizen').strip().lower()

    if not phone or not email or not password:
        return jsonify({"success": False, "message": "Please enter Phone Number, Email, and Password."}), 400

    users = load_json(USERS_JSON, [])
    
    matched_user = None
    for u in users:
        if u.get('phone') == phone and u.get('email') == email and u.get('password') == password and u.get('role') == role:
            matched_user = u
            break

    if not matched_user:
        return jsonify({
            "success": False,
            "message": "Wrong details entered! Phone number, email, and password must match registered records."
        }), 401

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
        "headline": headline,  # Task headline is address
        "address": address,
        "waste_type": waste_type,
        "photo": photo or "https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80",
        "lat": lat,
        "lng": lng,
        "reporter_name": reporter_name,
        "reporter_phone": reporter_phone,
        "reporter_email": reporter_email,
        "status": "Pending",
        "assigned_team": "Eco Response Squad",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    tasks.insert(0, new_task)
    save_json(TASKS_JSON, tasks)

    return jsonify({
        "success": True,
        "message": "Waste report submitted successfully! Dispatched as Task to Admin Portal.",
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
        "status": "Confirmed",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    bookings.insert(0, new_booking)
    save_json(BOOKINGS_JSON, bookings)

    return jsonify({
        "success": True,
        "message": "Cleaning service booked successfully! Delivered to Admin Portal under Private Booking.",
        "booking": new_booking
    })

# ----------------- EMERGENCY HELP API -----------------

@app.route('/api/emergency', methods=['POST'])
def create_emergency():
    data = request.get_json() or {}
    emg_type = data.get('type', 'same_location')
    caller_name = data.get('caller_name', 'Registered Citizen')
    caller_phone = data.get('caller_phone', '')
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
        "severity": severity,
        "status": "DISPATCHED",
        "dispatched_team": "Rapid Emergency Hazmat Squad",
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    emergencies.insert(0, new_emergency)
    save_json(EMERGENCIES_JSON, emergencies)

    return jsonify({
        "success": True,
        "message": "EMERGENCY DISPATCHED! Admin center notified.",
        "emergency": new_emergency
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
    
    users_clean = [{k: v for k, v in u.items() if k != 'password'} for u in users]

    return jsonify({
        "success": True,
        "tasks": tasks,
        "bookings": bookings,
        "emergencies": emergencies,
        "showcase": showcase,
        "users": users_clean,
        "stats": {
            "total_tasks": len(tasks),
            "pending_tasks": len([t for t in tasks if t.get('status') == 'Pending']),
            "private_bookings": len(bookings),
            "emergency_calls": len(emergencies),
            "solved_cases": len(showcase),
            "registered_users": len(users)
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

    save_json(TASKS_JSON, tasks)

    # If resolved, add to public showcase feed
    if new_status == 'Resolved':
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
            "team": target_task.get('assigned_team', 'Greenox Delta Squad'),
            "solved_at": "Just now",
            "rating": 5.0,
            "status": "Resolved & Verified"
        }
        showcase.insert(0, new_showcase_item)
        save_json(SHOWCASE_JSON, showcase)

    return jsonify({"success": True, "message": f"Task {task_id} marked as {new_status}!", "task": target_task})

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

    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    # Start Cloudflare Tunnel in background thread if cloudflared.exe is present
    cf_exe = os.path.join(BASE_DIR, "cloudflared.exe")
    public_url_file = os.path.join(BASE_DIR, "PUBLIC_URL.txt")

    def run_tunnel():
        if os.path.exists(cf_exe):
            try:
                log_path = os.path.join(BASE_DIR, "tunnel.log")
                if os.path.exists(log_path):
                    try:
                        os.remove(log_path)
                    except Exception:
                        pass
                proc = subprocess.Popen(
                    [cf_exe, "tunnel", "--url", "http://127.0.0.1:3000", "--logfile", log_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                for _ in range(60):
                    time.sleep(0.5)
                    if os.path.exists(log_path):
                        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                            match = re.search(r"https://[-a-zA-Z0-9.]+\.trycloudflare\.com", content)
                            if match:
                                pub_url = match.group(0)
                                print("\n" + "=" * 60, flush=True)
                                print("🌟 GLOBAL PUBLIC LINK (ACCESSIBLE ON ANY PHONE / ANDROID / DEVICE):", flush=True)
                                print(f"👉 {pub_url}", flush=True)
                                print("=" * 60 + "\n", flush=True)
                                with open(public_url_file, "w", encoding="utf-8") as pf:
                                    pf.write(pub_url)
                                break
            except Exception as e:
                print(f"[!] Tunnel startup notice: {e}", flush=True)

    threading.Thread(target=run_tunnel, daemon=True).start()

    print("==================================================")
    print("GREENOX ECO-CLEAN WEB PLATFORM")
    print("==================================================")
    print(f"-> Local Machine Access:    http://localhost:3000")
    print(f"-> Local Wi-Fi Network:     http://{local_ip}:3000")
    print("-> Users Database:          registered_user.csv")
    print("==================================================")
    
    def open_browser():
        time.sleep(1.5)
        try:
            webbrowser.open("http://127.0.0.1:3000")
        except Exception:
            pass

    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=False)

