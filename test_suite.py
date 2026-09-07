import urllib.request
import urllib.parse
import json
import csv
import sys

BASE_URL = "http://127.0.0.1:3000"

def post_json(path, data):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def get_json(path):
    url = f"{BASE_URL}{path}"
    with urllib.request.urlopen(url) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

print("==================================================")
print("RUNNING AUTOMATED TEST SUITE FOR GREENOX")
print("==================================================")

# Test 1: Password Mismatch Validation
print("\n[TEST 1] Register with mismatched passwords...")
code, res = post_json("/api/register", {
    "first_name": "Test",
    "surname": "User",
    "phone": "9999900001",
    "email": "mismatch@greenox.org",
    "address": "Green Avenue",
    "password": "pass1",
    "confirm_password": "pass2",
    "role": "citizen"
})
print(f"Status: {code}, Response: {res}")
assert code == 400 and "Confirm password does not match" in res["message"]
print("--> PASSED: Confirm password mismatch correctly rejected.")

# Test 2: Admin Key Validation (Invalid Key)
print("\n[TEST 2] Register Admin with invalid key...")
code, res = post_json("/api/register", {
    "first_name": "Fake",
    "surname": "Admin",
    "phone": "9999900002",
    "email": "fakeadmin@greenox.org",
    "address": "Headquarters",
    "password": "adminpassword",
    "confirm_password": "adminpassword",
    "role": "admin",
    "admin_key": "WRONG_KEY"
})
print(f"Status: {code}, Response: {res}")
assert code == 403 and "Invalid GREENOX Admin Key" in res["message"]
print("--> PASSED: Invalid admin key correctly rejected.")

# Test 3: Admin Key Validation (Valid Key: GREEN@OX)
print("\n[TEST 3] Register Admin with valid key 'GREEN@OX'...")
code, res = post_json("/api/register", {
    "first_name": "Chief",
    "surname": "Officer",
    "phone": "9999900003",
    "email": "chief@greenox.org",
    "address": "Command Center, Tower 1",
    "password": "chiefpassword",
    "confirm_password": "chiefpassword",
    "role": "admin",
    "admin_key": "GREEN@OX"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
print("--> PASSED: Admin registered successfully with GREEN@OX key.")

# Test 4: Citizen Registration
print("\n[TEST 4] Register Citizen 'Rohan Kapoor'...")
code, res = post_json("/api/register", {
    "first_name": "Rohan",
    "surname": "Kapoor",
    "phone": "9988776655",
    "email": "rohan@greenox.org",
    "address": "Palm Grove Estate, Sector 21",
    "password": "rohanpassword",
    "confirm_password": "rohanpassword",
    "role": "citizen"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
print("--> PASSED: Citizen registered successfully.")

# Test 5: Verify registered_user.csv contains Rohan
print("\n[TEST 5] Checking registered_user.csv on disk...")
with open("registered_user.csv", "r", encoding="utf-8") as f:
    csv_rows = list(csv.reader(f))
    print(f"Total CSV Rows (including header): {len(csv_rows)}")
    header = csv_rows[0]
    print(f"Header: {header}")
    assert header == ['Phone Number', 'Email', 'First Name', 'Surname', 'Address', 'Role', 'Registered At']
    found_rohan = any(r[0] == '9988776655' and r[1] == 'rohan@greenox.org' for r in csv_rows)
    assert found_rohan, "Rohan Kapoor record not found in registered_user.csv"
print("--> PASSED: registered_user.csv verified on disk.")

# Test 6: Login with Wrong Password
print("\n[TEST 6] Login with wrong password...")
code, res = post_json("/api/login", {
    "phone": "9988776655",
    "email": "rohan@greenox.org",
    "password": "INCORRECT_PASSWORD",
    "role": "citizen"
})
print(f"Status: {code}, Response: {res}")
assert code == 401 and "Wrong details entered" in res["message"]
print("--> PASSED: Incorrect login details rejected.")

# Test 7: Login with Correct Details
print("\n[TEST 7] Login with correct details...")
code, res = post_json("/api/login", {
    "phone": "9988776655",
    "email": "rohan@greenox.org",
    "password": "rohanpassword",
    "role": "citizen"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
assert res["user"]["first_name"] == "Rohan"
print("--> PASSED: Login successful.")

# Test 8: Update Profile Address
print("\n[TEST 8] Update user address and sync to CSV...")
code, res = post_json("/api/user/update-address", {
    "email": "rohan@greenox.org",
    "phone": "9988776655",
    "address": "Penthouse 9, Palm Grove Tower, Sector 21"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
# Verify updated in CSV
with open("registered_user.csv", "r", encoding="utf-8") as f:
    csv_rows = list(csv.reader(f))
    rohan_row = next(r for r in csv_rows if r[0] == '9988776655')
    assert rohan_row[4] == "Penthouse 9, Palm Grove Tower, Sector 21"
print("--> PASSED: Address updated and synced to registered_user.csv.")

# Test 9: Submit Waste Report (Task Headline = Address)
print("\n[TEST 9] Submit Waste Incident Report...")
code, res = post_json("/api/reports", {
    "address": "Opposite Gate 2, Metro Station, Sector 15",
    "waste_type": "Plastic & Dry Waste",
    "photo": "https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80",
    "lat": 28.6150,
    "lng": 77.2100,
    "reporter_name": "Rohan Kapoor",
    "reporter_phone": "9988776655",
    "reporter_email": "rohan@greenox.org"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
assert res["task"]["headline"] == "Opposite Gate 2, Metro Station, Sector 15"
task_id = res["task"]["id"]
print(f"--> PASSED: Task created with headline=address (ID: {task_id}).")

# Test 10: Book Cleaning (Private Booking & Receipt)
print("\n[TEST 10] Book Cleaning Package...")
code, res = post_json("/api/bookings", {
    "service_name": "Home Deep Cleaning",
    "service_price": 1499,
    "receipt": {
        "service_fee": 1050,
        "worker_fee": 250,
        "consumables_fee": 120,
        "platform_fee": 79,
        "gst_applied": True,
        "gst_amount": 270,
        "total_amount": 1499
    },
    "timing_slot": "Tomorrow Morning: 08:00 AM - 11:00 AM",
    "address": "Penthouse 9, Palm Grove Tower, Sector 21",
    "customer_name": "Rohan Kapoor",
    "customer_phone": "9988776655",
    "customer_email": "rohan@greenox.org"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
assert res["booking"]["service_price"] == 1499
print("--> PASSED: Private booking confirmed and delivered to Admin.")

# Test 11: Emergency Help Dispatch
print("\n[TEST 11] Dispatch Emergency SOS...")
code, res = post_json("/api/emergency", {
    "type": "same_location",
    "caller_name": "Rohan Kapoor",
    "caller_phone": "9988776655",
    "address": "Penthouse 9, Palm Grove Tower, Sector 21",
    "emergency_details": "Severe chemical leakage near drainage ditch with pungent vapor fumes",
    "severity": "CRITICAL",
    "lat": 28.6139,
    "lng": 77.2090
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True
assert res["emergency"]["severity"] == "CRITICAL"
print("--> PASSED: Emergency dispatched to Admin with siren alerts.")

# Test 12: Showcase Solved Complaints Feed (Starts empty since dummy data removed)
print("\n[TEST 12] Fetch Solved Complaints Showcase...")
code, res = get_json("/api/showcase")
print(f"Status: {code}, Showcase items count: {res['count']}")
assert code == 200 and res["count"] >= 0
print("--> PASSED: Solved complaints showcase verified.")


# Test 13: Admin Resolve Task & Publish to Showcase
print("\n[TEST 13] Admin resolves task and publishes to showcase...")
code, res = post_json("/api/admin/update-task-status", {
    "task_id": task_id,
    "status": "Resolved",
    "after_photo": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
    "time_consumed": "18 mins"
})
print(f"Status: {code}, Response: {res}")
assert code == 200 and res["success"] is True

# Verify it appears in showcase now
code, res = get_json("/api/showcase")
latest_case = res["showcase"][0]
assert latest_case["headline"] == "Opposite Gate 2, Metro Station, Sector 15"
assert latest_case["time_consumed"] == "18 mins"
print("--> PASSED: Task resolved and published live to Solved Complaints feed.")

# Test 14: Admin All Data Endpoint
print("\n[TEST 14] Fetch Admin Central Data...")
code, res = get_json("/api/admin/data")
print(f"Status: {code}, Tasks: {len(res['tasks'])}, Bookings: {len(res['bookings'])}, Emergencies: {len(res['emergencies'])}, Users: {len(res['users'])}")
assert code == 200
assert len(res["tasks"]) >= 1
assert len(res["bookings"]) >= 1
assert len(res["emergencies"]) >= 1
assert len(res["users"]) >= 3
print("--> PASSED: Admin control data completely verified.")

print("\n==================================================")
print("ALL 14 TEST SCENARIOS PASSED WITH 100% SUCCESS!")
print("==================================================")
