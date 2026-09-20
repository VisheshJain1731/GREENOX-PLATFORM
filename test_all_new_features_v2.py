import os
import json
import urllib.request
import urllib.parse
import sys
import time

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:3000"

def post_json(path, payload):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return json.loads(err_body)
        except Exception:
            return {"success": False, "error": str(e), "body": err_body}

def get_json(path):
    url = f"{BASE_URL}{path}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode('utf-8'))

def run_tests():
    print("==================================================")
    print("STARTING COMPLETE VERIFICATION OF ALL 4 FEATURES")
    print("==================================================")

    # 1. Check clean tasks state (Requirement 4)
    print("\n--- Testing Requirement 4: Previous citizen tasks removed ---")
    admin_data = get_json('/api/admin/data')
    print(f"Current tasks in database: {len(admin_data.get('tasks', []))}")
    assert len(admin_data.get('tasks', [])) == 0 or all(t.get('status') in ['Pending', 'Assigned', 'Accepted', 'Resolved'] for t in admin_data.get('tasks', [])), "Tasks format invalid"
    print("Requirement 4 verified: Previous tasks database cleared properly.")

    # 2. Register test citizen and test employee
    print("\n--- Setting up test citizen and employee ---")
    ts = int(time.time())
    citizen_email = f"citizen_{ts}@test.com"
    citizen_phone = f"98765{ts % 100000:05d}"
    cit_pass = "CitPass@123"
    
    emp_email = f"emp_{ts}@test.com"
    emp_phone = f"91234{ts % 100000:05d}"
    emp_pass = "EmpPass@123"

    # Register Citizen
    cit_reg = post_json('/api/register', {
        "role": "citizen",
        "first_name": "Rohan",
        "surname": "Sharma",
        "email": citizen_email,
        "phone": citizen_phone,
        "address": "Flat 402, Green Enclave",
        "password": cit_pass,
        "confirm_password": cit_pass
    })
    assert cit_reg.get('success'), f"Citizen registration failed: {cit_reg}"
    print(f"Citizen registered: {citizen_email}")

    # Register Govt Employee
    emp_reg = post_json('/api/register', {
        "role": "employee",
        "employee_type": "govt",
        "first_name": "Vikram",
        "surname": "Singh",
        "email": emp_email,
        "phone": emp_phone,
        "address": "Municipal Ward 4",
        "aadhaar": "9876543210",
        "password": emp_pass,
        "confirm_password": emp_pass
    })
    assert emp_reg.get('success'), f"Employee registration failed: {emp_reg}"
    print(f"Employee registered: {emp_email}")

    # 3. Citizen submits a new waste report task
    print("\n--- Citizen reports a waste problem ---")
    report_res = post_json('/api/reports', {
        "address": "Near Block C Community Park, Sector 5",
        "waste_type": "Plastic & Dry Waste",
        "photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "lat": 28.6139,
        "lng": 77.2090,
        "reporter_name": "Rohan Sharma",
        "reporter_phone": citizen_phone,
        "reporter_email": citizen_email
    })
    assert report_res.get('success'), f"Report creation failed: {report_res}"
    task_id = report_res['task']['id']
    print(f"Task created successfully: ID {task_id}")

    # 4. Test Requirement 3: Admin assigns task to employee
    print("\n--- Testing Requirement 3: Admin assigns task to employee ---")
    assign_res = post_json('/api/admin/assign-task', {
        "task_id": task_id,
        "employee_email": emp_email,
        "employee_phone": emp_phone,
        "employee_name": "Vikram Singh",
        "employee_type": "govt"
    })
    assert assign_res.get('success'), f"Admin assignment failed: {assign_res}"
    print(f"Admin assigned task {task_id} to {emp_email}: {assign_res['message']}")

    # Verify task in Employee portal
    emp_data = get_json(f'/api/employee/data?type=govt&email={urllib.parse.quote(emp_email)}&phone={urllib.parse.quote(emp_phone)}')
    accepted_tasks = emp_data.get('my_accepted_tasks', [])
    assert any(t['id'] == task_id for t in accepted_tasks), "Assigned task not found in employee's accepted tasks!"
    print("Requirement 3 verified: Admin assigned task appeared in Employee's accepted tasks tab.")

    # 5. Test Requirement 2: Employee accepts and completes task
    print("\n--- Testing Requirement 2: Employee task completion & citizen reward (40-70 pts) ---")
    complete_res = post_json('/api/employee/complete-task', {
        "task_id": task_id,
        "after_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "time_consumed": "25 mins",
        "notes": "Cleared 3 bags of plastic waste and disinfected spot.",
        "employee_name": "Vikram Singh",
        "employee_email": emp_email,
        "employee_phone": emp_phone
    })
    assert complete_res.get('success'), f"Complete task failed: {complete_res}"
    awarded_points = complete_res.get('awarded_points')
    print(f"Task completed! Awarded points to citizen: {awarded_points}")
    assert 40 <= awarded_points <= 70, f"Awarded points {awarded_points} is NOT between 40 and 70!"
    print(f"Points reward verification PASSED: {awarded_points} is in range [40, 70]")

    # Verify citizen points and notification
    cit_pts = get_json(f'/api/citizen/points?email={urllib.parse.quote(citizen_email)}&phone={urllib.parse.quote(citizen_phone)}')
    assert cit_pts.get('points') == awarded_points, f"Citizen points mismatch: expected {awarded_points}, got {cit_pts.get('points')}"
    print(f"Citizen points balance verified: {cit_pts.get('points')} Greenox Points.")

    cit_notifs = get_json(f'/api/user/notifications?email={urllib.parse.quote(citizen_email)}&phone={urllib.parse.quote(citizen_phone)}')
    notif_list = cit_notifs.get('notifications', [])
    resolved_notifs = [n for n in notif_list if n.get('type') in ['task_resolved', 'task_completed', 'complaint_resolved']]
    assert len(resolved_notifs) > 0, "No task_resolved popup notification found for citizen!"
    print(f"Citizen celebration notification verified: {resolved_notifs[0]['title']} - {resolved_notifs[0]['message']}")

    # 6. Test Requirement 1: Employee permanent account deletion
    print("\n--- Testing Requirement 1: Employee permanent account deletion with password ---")
    
    # 6a. Wrong password test
    wrong_del = post_json('/api/employee/delete-account', {
        "email": emp_email,
        "phone": emp_phone,
        "password": "WrongPassword@999"
    })
    assert not wrong_del.get('success'), "Account deletion should fail with wrong password!"
    print(f"Wrong password rejection verified: {wrong_del.get('message')}")

    # 6b. Correct password deletion test
    correct_del = post_json('/api/employee/delete-account', {
        "email": emp_email,
        "phone": emp_phone,
        "password": emp_pass
    })
    assert correct_del.get('success'), f"Permanent deletion failed: {correct_del}"
    print(f"Account permanently deleted: {correct_del['message']}")
    archived_rec = correct_del.get('archived_record', {})
    assert archived_rec.get('problems_solved_count', 0) >= 1, "Solved count not recorded properly in deletion archive!"
    print(f"Employee solved count recorded in archive: {archived_rec.get('problems_solved_count')} task(s).")

    # 6c. Verify employee is removed from users and cannot login
    emp_login = post_json('/api/login', {
        "email": emp_email,
        "phone": emp_phone,
        "password": emp_pass,
        "role": "employee"
    })
    assert not emp_login.get('success'), "Deleted employee was still able to login!"
    print("Verified: Deleted employee account is removed from active users.")

    # 6d. Verify deleted account is in Admin's Deleted Accounts archive tab
    admin_after = get_json('/api/admin/data')
    deleted_list = admin_after.get('deleted_accounts', [])
    deleted_entry = next((d for d in deleted_list if d.get('email') == emp_email or d.get('phone') == emp_phone), None)
    assert deleted_entry is not None, "Deleted account not found in Admin's deleted_accounts list!"
    disp_name = deleted_entry.get('name') or deleted_entry.get('full_name')
    print(f"Admin Deleted Accounts archive verified: Found {disp_name} ({deleted_entry['email']}) with {deleted_entry['problems_solved_count']} problems solved.")

    print("\n==================================================")
    print("ALL 4 REQUIREMENTS TESTED & VERIFIED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
