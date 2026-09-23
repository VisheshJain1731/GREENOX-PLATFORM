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

def test_citizen_rating():
    print("==================================================")
    print("TESTING CITIZEN 5-STAR WORK RATING FEATURE")
    print("==================================================")

    ts = int(time.time())
    citizen_email = f"citizen_rate_{ts}@test.com"
    citizen_phone = f"99887{ts % 100000:05d}"
    cit_pass = "CitRating@123"

    emp_email = f"emp_rate_{ts}@test.com"
    emp_phone = f"99112{ts % 100000:05d}"
    emp_pass = "EmpRating@123"

    # 1. Register Citizen
    print("\n1. Registering test citizen...")
    cit_res = post_json('/api/register', {
        "role": "citizen",
        "first_name": "Aarav",
        "surname": "Patel",
        "email": citizen_email,
        "phone": citizen_phone,
        "address": "Eco Green Boulevard",
        "password": cit_pass,
        "confirm_password": cit_pass
    })
    assert cit_res.get('success'), f"Citizen registration failed: {cit_res}"
    print(f"Citizen registered: {citizen_email}")

    # 2. Register Employee
    print("\n2. Registering test municipal employee...")
    emp_res = post_json('/api/register', {
        "role": "employee",
        "employee_type": "govt",
        "first_name": "Ramesh",
        "surname": "Kumar",
        "email": emp_email,
        "phone": emp_phone,
        "address": "Sanitation Zone 1",
        "aadhaar": "1234567890",
        "password": emp_pass,
        "confirm_password": emp_pass
    })
    assert emp_res.get('success'), f"Employee registration failed: {emp_res}"
    print(f"Employee registered: {emp_email}")

    # 3. Citizen files waste report
    print("\n3. Citizen reporting a waste problem...")
    rep_res = post_json('/api/reports', {
        "address": "Sector 14 Green Park Avenue",
        "waste_type": "Wet & Organic Waste",
        "photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "lat": 28.6139,
        "lng": 77.2090,
        "reporter_name": "Aarav Patel",
        "reporter_phone": citizen_phone,
        "reporter_email": citizen_email
    })
    assert rep_res.get('success'), f"Report creation failed: {rep_res}"
    task_id = rep_res['task']['id']
    print(f"Report filed: ID {task_id}")

    # 4. Employee accepts task
    print("\n4. Employee accepting task...")
    acc_res = post_json('/api/employee/accept-task', {
        "task_id": task_id,
        "employee_name": "Ramesh Kumar",
        "employee_email": emp_email,
        "employee_phone": emp_phone
    })
    assert acc_res.get('success'), f"Accept task failed: {acc_res}"
    print(f"Task accepted by employee.")

    # 5. Employee completes task with proof photo and duration
    print("\n5. Employee completing task with after-cleaning proof photo...")
    complete_res = post_json('/api/employee/complete-task', {
        "task_id": task_id,
        "after_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "time_consumed": "20 mins",
        "notes": "Completely cleared garbage heap and disinfected corner.",
        "employee_name": "Ramesh Kumar",
        "employee_email": emp_email,
        "employee_phone": emp_phone
    })
    assert complete_res.get('success'), f"Complete task failed: {complete_res}"
    awarded_points = complete_res.get('awarded_points')
    print(f"Task completed! Points awarded: {awarded_points}")

    # 6. Check citizen notification
    print("\n6. Verifying citizen resolution notification...")
    notifs_res = get_json(f'/api/user/notifications?email={urllib.parse.quote(citizen_email)}&phone={urllib.parse.quote(citizen_phone)}')
    assert notifs_res.get('success'), f"Failed to get notifications: {notifs_res}"
    notif_list = notifs_res.get('notifications', [])
    resolved_notifs = [n for n in notif_list if n.get('ref_id') == task_id]
    assert len(resolved_notifs) > 0, "No resolution notification found for task!"
    print(f"Citizen notification found: {resolved_notifs[0]['title']}")

    # 7. Citizen rates the completed work (5 Stars + Review + Tags)
    print("\n7. Citizen rating the completed task (5 Stars + Feedback + Tags)...")
    rate_res = post_json('/api/citizen/rate-task', {
        "task_id": task_id,
        "rating": 5.0,
        "feedback": "Outstanding cleaning work! Spotless within 20 mins. Ramesh Kumar was very diligent.",
        "tags": ["⚡ Quick Response", "✨ Spotless Clean", "🌱 Eco Champion"],
        "citizen_email": citizen_email,
        "citizen_phone": citizen_phone,
        "citizen_name": "Aarav Patel"
    })
    assert rate_res.get('success'), f"Citizen rate task failed: {rate_res}"
    print(f"Rating submitted successfully: {rate_res['message']}")
    assert rate_res.get('rating') == 5.0, f"Expected rating 5.0, got {rate_res.get('rating')}"

    # 8. Check Citizen History reflects the rating
    print("\n8. Verifying citizen service history includes rating...")
    hist_res = get_json(f'/api/citizen/history?email={urllib.parse.quote(citizen_email)}&phone={urllib.parse.quote(citizen_phone)}')
    assert hist_res.get('success'), f"Failed to fetch history: {hist_res}"
    tasks_in_hist = hist_res.get('tasks', [])
    matched_hist_task = next((t for t in tasks_in_hist if t['id'] == task_id), None)
    assert matched_hist_task is not None, "Task not found in citizen history!"
    assert matched_hist_task.get('citizen_rating') == 5.0, f"Task rating mismatch in history: {matched_hist_task.get('citizen_rating')}"
    assert "Outstanding cleaning work" in matched_hist_task.get('citizen_feedback', ''), "Feedback not saved in task!"
    print("Citizen history verified: Rating 5.0 and feedback correctly recorded.")

    # 9. Check Showcase reflects the rating
    print("\n9. Verifying public showcase feed reflects citizen rating...")
    showcase_res = get_json('/api/showcase')
    assert showcase_res.get('success'), f"Failed to fetch showcase: {showcase_res}"
    showcase_items = showcase_res.get('showcase', [])
    assert len(showcase_items) > 0, "Showcase feed is empty!"
    latest_showcase = showcase_items[0]
    assert latest_showcase.get('rating') == 5.0, f"Showcase rating mismatch: {latest_showcase.get('rating')}"
    print(f"Showcase verified: Rating is {latest_showcase.get('rating')} Stars.")

    # 10. Check Employee Portal reflects the rating & average rating score
    print("\n10. Verifying employee portal metrics...")
    emp_data = get_json(f'/api/employee/data?type=govt&email={urllib.parse.quote(emp_email)}&phone={urllib.parse.quote(emp_phone)}')
    assert emp_data.get('success'), f"Failed to fetch employee data: {emp_data}"
    my_solved = emp_data.get('my_solved_tasks', [])
    assert any(t['id'] == task_id and t.get('citizen_rating') == 5.0 for t in my_solved), "Solved task in employee portal missing rating!"
    assert emp_data.get('avg_rating') == 5.0, f"Employee average rating mismatch: {emp_data.get('avg_rating')}"
    print(f"Employee metrics verified: Solved tasks: {emp_data.get('solved_count')}, Average Rating: {emp_data.get('avg_rating')} Stars.")

    print("\n==================================================")
    print("ALL CITIZEN 5-STAR WORK RATING TESTS PASSED!")
    print("==================================================")

if __name__ == '__main__':
    test_citizen_rating()
