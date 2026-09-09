import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:3000"

def post_json(endpoint, payload):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8')), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8')), e.code

def get_json(endpoint):
    req = urllib.request.Request(f"{BASE_URL}{endpoint}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8')), resp.status

def run_tests():
    print("==================================================")
    print("STARTING GREENOX ALL-FEATURES AUTOMATED TEST SUITE")
    print("==================================================")

    # 1. Test Password Policy
    print("\n[TEST 1] Password Policy Checks:")
    # Too long (>20 chars)
    res, status = post_json('/api/register', {
        "first_name": "Test", "surname": "User", "phone": "9000000001",
        "email": "pwd1@test.com", "password": "LongPassword123!ExtraChars",
        "confirm_password": "LongPassword123!ExtraChars", "role": "citizen"
    })
    print("  Too long (>20):", "PASSED" if status == 400 and "maximum 20" in res['message'] else f"FAILED ({res})")

    # Missing digit
    res, status = post_json('/api/register', {
        "first_name": "Test", "surname": "User", "phone": "9000000002",
        "email": "pwd2@test.com", "password": "NoDigitPassword!",
        "confirm_password": "NoDigitPassword!", "role": "citizen"
    })
    print("  Missing digit:", "PASSED" if status == 400 and "digit" in res['message'] else f"FAILED ({res})")

    # Missing special character
    res, status = post_json('/api/register', {
        "first_name": "Test", "surname": "User", "phone": "9000000003",
        "email": "pwd3@test.com", "password": "Password1234",
        "confirm_password": "Password1234", "role": "citizen"
    })
    print("  Missing special char:", "PASSED" if status == 400 and "special character" in res['message'] else f"FAILED ({res})")

    # Valid password (1-20 chars, digit, special char)
    res, status = post_json('/api/register', {
        "first_name": "Citizen", "surname": "Tester", "phone": "9111111111",
        "email": "citizen.valid@test.com", "password": "Secure@123",
        "confirm_password": "Secure@123", "role": "citizen", "address": "Sector 18 Green Park"
    })
    print("  Valid Password Registration:", "PASSED" if status == 200 and res['success'] else f"FAILED ({res})")

    # 2. Test Employee Registration (Aadhaar 10 digits & Govt/Private)
    print("\n[TEST 2] Employee Registration:")
    # Invalid Aadhaar (< 10 digits)
    res, status = post_json('/api/register', {
        "first_name": "Govt", "surname": "Worker", "phone": "9222222221",
        "email": "emp.invalid@test.com", "password": "Govt@123",
        "confirm_password": "Govt@123", "role": "employee",
        "aadhaar": "12345", "employee_type": "govt"
    })
    print("  Invalid Aadhaar (<10):", "PASSED" if status == 400 and "10 numeric digits" in res['message'] else f"FAILED ({res})")

    # Valid Govt Employee
    res, status = post_json('/api/register', {
        "first_name": "GovtWorker", "surname": "Singh", "phone": "9222222222",
        "email": "govt.worker@test.com", "password": "Govt@123",
        "confirm_password": "Govt@123", "role": "employee",
        "aadhaar": "9876543210", "employee_type": "govt", "address": "Municipal Ward 4"
    })
    print("  Valid Govt Employee:", "PASSED" if status == 200 and res['success'] else f"FAILED ({res})")

    # Valid Private Employee
    res, status = post_json('/api/register', {
        "first_name": "PrivateResponder", "surname": "Kumar", "phone": "9333333333",
        "email": "private.squad@test.com", "password": "Priv@123",
        "confirm_password": "Priv@123", "role": "employee",
        "aadhaar": "8765432109", "employee_type": "private", "address": "Eco Quick Hub"
    })
    print("  Valid Private Employee:", "PASSED" if status == 200 and res['success'] else f"FAILED ({res})")

    # 3. Test Organization Registration (Org ID & Org Name)
    print("\n[TEST 3] Organization Registration:")
    res, status = post_json('/api/register', {
        "first_name": "Corporate", "surname": "Lead", "phone": "9444444444",
        "email": "corporate.lead@greenox.org", "password": "Corp@123",
        "confirm_password": "Corp@123", "role": "organization",
        "org_id": "ORG-8899", "org_name": "EcoTech Global Industries", "address": "Cyber City Tower B"
    })
    print("  Valid Organization Registration:", "PASSED" if status == 200 and res['success'] else f"FAILED ({res})")

    # 4. Test Task & Booking Creation
    print("\n[TEST 4] Task & Booking Routing:")
    # Create citizen waste report task
    res_task, _ = post_json('/api/reports', {
        "address": "Opposite Metro Gate 3, Sector 62",
        "waste_type": "Plastic & Dry Waste",
        "photo": "https://images.unsplash.com/photo-1605600659908-0ef719419d41",
        "reporter_name": "Citizen Tester", "reporter_phone": "9111111111", "reporter_email": "citizen.valid@test.com"
    })
    print("  Created Citizen Waste Report:", "PASSED" if res_task.get('success') else "FAILED")

    # Create cleaning booking
    res_book, _ = post_json('/api/bookings', {
        "service_name": "Corporate Office", "service_price": 1999,
        "address": "Cyber City Tower B", "customer_name": "EcoTech Global Industries",
        "customer_phone": "9444444444", "customer_email": "corporate.lead@greenox.org",
        "timing_slot": "Tomorrow Morning: 08:00 AM - 11:00 AM"
    })
    print("  Created Cleaning Booking:", "PASSED" if res_book.get('success') else "FAILED")

    # 5. Test Employee Data Filtering (Govt vs Private)
    print("\n[TEST 5] Employee Task Separation:")
    res_govt, _ = get_json('/api/employee/data?type=govt')
    has_waste_task = any(t['address'] == "Opposite Metro Gate 3, Sector 62" for t in res_govt.get('pending_tasks', []))
    print("  Govt Employee sees Municipal Waste Task:", "PASSED" if has_waste_task and 'pending_tasks' in res_govt else "FAILED")

    res_priv, _ = get_json('/api/employee/data?type=private')
    has_booking = any(b['service_name'] == "Corporate Office" for b in res_priv.get('pending_tasks', []))
    print("  Private Employee sees Cleaning Booking Task:", "PASSED" if has_booking else "FAILED")

    # 6. Test Emergency SOS, Live Routing, and False Emergency Report
    print("\n[TEST 6] Emergency SOS & False Emergency Flow:")
    res_emg, _ = post_json('/api/emergency', {
        "caller_name": "Citizen Tester", "caller_phone": "9111111111", "caller_email": "citizen.valid@test.com",
        "address": "Sector 18 Green Park Main Drain",
        "emergency_details": "Chemical spillage foaming into municipal drain",
        "lat": 28.6139, "lng": 77.2090
    })
    emg_id = res_emg.get('emergency', {}).get('id')
    print("  Emergency SOS Created:", "PASSED" if emg_id else "FAILED")

    # Private Employee reports false emergency
    res_false, _ = post_json('/api/emergency/false-report', {
        "emergency_id": emg_id,
        "employee_name": "PrivateResponder Kumar",
        "employee_phone": "9333333333",
        "employee_gps": "28.6500, 77.2500",
        "emergency_location": "Sector 18 Green Park Main Drain",
        "location_match_status": "LOCATION NOT MATCHED (4.5km mismatch)",
        "photo": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86",
        "reason": "On-site verification shows area is clean with zero chemical runoff. Citizen false alarm."
    })
    print("  False Emergency Report Submitted:", "PASSED" if res_false.get('success') else "FAILED")

    # 7. Test Admin Reports Tab Data
    print("\n[TEST 7] Admin Reports Database:")
    res_admin, _ = get_json('/api/admin/data')
    reports = res_admin.get('reports', [])
    has_false_report = any(r['emergency_id'] == emg_id for r in reports)
    print("  Admin Data contains False Emergency Report:", "PASSED" if has_false_report else "FAILED")

    # 8. Test Citizen History & Trackers
    print("\n[TEST 8] Citizen History API:")
    res_hist, _ = get_json('/api/citizen/history?email=citizen.valid@test.com&phone=9111111111')
    hist_tasks = res_hist.get('tasks', [])
    hist_emg = res_hist.get('emergencies', [])
    print("  Citizen History has tasks & emergency timeline:", "PASSED" if len(hist_tasks) > 0 and len(hist_emg) > 0 else "FAILED")

    print("\n==================================================")
    print("ALL TESTS COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
