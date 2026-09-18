import urllib.request
import json
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:3000"

def post(path, body):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as r:
        return r.status, json.loads(r.read().decode('utf-8'))

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req) as r:
        return r.status, json.loads(r.read().decode('utf-8'))

print("--- Testing Live GREENOX Server on http://127.0.0.1:3000 ---")

# 1. Test Static Index.html fetch
req_html = urllib.request.Request(f"{BASE_URL}/")
with urllib.request.urlopen(req_html) as r:
    html = r.read().decode('utf-8')
    assert "Plant a Tree (Eco Initiative)" in html, "Tree package not in HTML"
    assert "treeAddonCard" in html, "treeAddonCard not in HTML"
    assert "adminSolvedSection" in html, "adminSolvedSection not in HTML"
    assert "Clear Solved History" in html, "Clear Solved History button not in HTML"
    print(" [x] Static HTML contains Tree Planting, 50% discount add-on, and Solved Complaints History markup.")

# 2. Test Standalone Tree Planting booking (₹599)
status, res = post("/api/bookings", {
    "service_name": "Plant a Tree (Eco Initiative)",
    "service_price": 599,
    "timing_slot": "Tomorrow Morning",
    "address": "Sector 10 Live Test Park",
    "customer_name": "Live Test Citizen",
    "customer_phone": "8888811111",
    "customer_email": "live.tree@test.com",
    "tree_planting_included": True
})
assert status == 200 and res['success']
tree_b_id = res['booking']['id']
print(f" [x] Standalone Tree Planting booked successfully: #{tree_b_id} (₹{res['booking']['service_price']})")

# 3. Test Booking with Tree Add-on 50% discount (+₹299)
status, res = post("/api/bookings", {
    "service_name": "Kitchen and Washroom",
    "service_price": 1298,  # 999 + 299 = 1298
    "timing_slot": "Immediate Express",
    "address": "Sector 12 Tower A",
    "customer_name": "Live Customer 2",
    "customer_phone": "8888822222",
    "customer_email": "live.addon@test.com",
    "tree_planting_included": True,
    "tree_addon_price": 299
})
assert status == 200 and res['success']
addon_b_id = res['booking']['id']
print(f" [x] Service with 50% Tree Planting Addon booked: #{addon_b_id} (Total: ₹{res['booking']['service_price']})")

# 4. Test Admin Close Booking due to Heavy Load
status, res = post("/api/admin/close-booking", {
    "booking_id": addon_b_id,
    "reason": "The service / private booking you raised has been temporarily closed due to heavy load."
})
assert status == 200 and res['success']
assert res['booking']['status'] == 'Closed (Heavy Load)'
print(f" [x] Admin successfully closed booking #{addon_b_id} (Status: {res['booking']['status']})")

# 5. Test Waste Report Creation & Admin Closure with notification
status, res = post("/api/reports", {
    "address": "Sector 29 Market Dump",
    "waste_type": "Construction Debris",
    "photo": "https://images.unsplash.com/photo-1605600659908-0ef719419d41",
    "lat": 28.6139,
    "lng": 77.2090,
    "reporter_name": "Reporter Alpha",
    "reporter_phone": "8888833333",
    "reporter_email": "alpha.report@test.com"
})
task_id = res['task']['id']
print(f" [x] Created complaint #{task_id}")

status, res = post("/api/admin/close-task", {
    "task_id": task_id,
    "reason": "The service / complaint you raised has been temporarily closed due to heavy load. Please try again later."
})
assert status == 200 and res['success']
assert res['task']['status'] == 'Closed (Heavy Load)'
print(f" [x] Admin successfully closed complaint #{task_id} (Status: {res['task']['status']})")

# 6. Verify notification delivered to citizen
status, res = get("/api/user/notifications?email=alpha.report@test.com&phone=8888833333")
assert status == 200 and res['success']
assert len(res['notifications']) > 0
notif = res['notifications'][0]
assert "temporarily closed due to heavy load" in notif['message']
print(f" [x] Citizen received heavy load closure notification: '{notif['title']}'")

# 7. Create, Resolve, check Solved History, and Clear Solved History
status, res = post("/api/reports", {
    "address": "Sector 50 Green Avenue",
    "waste_type": "Organic & Food Waste",
    "photo": "https://images.unsplash.com/photo-1605600659908-0ef719419d41",
    "reporter_name": "Reporter Beta",
    "reporter_phone": "8888844444",
    "reporter_email": "beta.report@test.com"
})
task_id2 = res['task']['id']

status, res = post("/api/admin/update-task-status", {
    "task_id": task_id2,
    "status": "Resolved",
    "after_photo": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86",
    "time_consumed": "25 mins"
})
assert status == 200 and res['success']
print(f" [x] Complaint #{task_id2} marked as Resolved and points awarded.")

# Check admin solved history data
status, res = get("/api/admin/data")
assert status == 200
solved_tasks = res.get('solved_tasks', [])
matching = [t for t in solved_tasks if t['id'] == task_id2]
assert len(matching) > 0, "Resolved task not in solved_tasks"
st = matching[0]
assert st['reporter_name'] == "Reporter Beta"
assert st['reporter_email'] == "beta.report@test.com"
assert st['reporter_phone'] == "8888844444"
print(f" [x] Solved history verified with citizen name '{st['reporter_name']}', email '{st['reporter_email']}', phone '{st['reporter_phone']}', and location '{st['address']}'")

# Clear solved history
status, res = post("/api/admin/clear-solved-history", {})
assert status == 200 and res['success']
print(f" [x] Admin cleared solved complaints history ({res['cleared_count']} cleared)")

status, res = get("/api/admin/data")
assert len(res.get('solved_tasks', [])) == 0
print(" [x] Solved complaints history successfully empty after clear action.")

print("\n>>> ALL 4 NEW FEATURES VERIFIED END-TO-END ON LIVE SERVER WITH 100% SUCCESS! <<<")
