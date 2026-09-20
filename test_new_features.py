import os
import sys
import json
import time

# Ensure clean working dir
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import app, USERS_JSON, load_json, save_json

client = app.test_client()

def test_login_lockout():
    print("\n--- TEST 1: Login Lockout after 7 attempts ---")
    bad_phone = "9999999999"
    bad_email = "lockout_test@test.com"
    bad_pwd = "WrongPassword1!"
    
    # Send 6 wrong attempts
    for i in range(1, 7):
        res = client.post("/api/login", json={
            "phone": bad_phone,
            "email": bad_email,
            "password": bad_pwd,
            "role": "citizen"
        })
        data = res.get_json()
        print(f"Attempt {i}: status={res.status_code}, data={data}")
        assert res.status_code == 401
        assert data.get("attempts_left") == (7 - i)

    # 7th attempt triggers 3-minute lockout (429)
    res7 = client.post("/api/login", json={
        "phone": bad_phone,
        "email": bad_email,
        "password": bad_pwd,
        "role": "citizen"
    })
    data7 = res7.get_json()
    print(f"Attempt 7 (Lockout Trigger): status={res7.status_code}, data={data7}")
    assert res7.status_code == 429
    assert data7.get("locked") is True
    assert data7.get("remaining_seconds") == 180

    # 8th attempt is still locked out
    res8 = client.post("/api/login", json={
        "phone": bad_phone,
        "email": bad_email,
        "password": bad_pwd,
        "role": "citizen"
    })
    data8 = res8.get_json()
    print(f"Attempt 8 (While Locked): status={res8.status_code}, data={data8}")
    assert res8.status_code == 429
    assert data8.get("locked") is True
    print(">>> TEST 1 PASSED: 7 failed attempts lead to 3-minute lockout (429 status)!")

def test_registration_and_points_system():
    print("\n--- TEST 2: Registration, Report Waste, Task Resolve & Greenox Points ---")
    ts = int(time.time() % 100000)
    email = f"citizen_{ts}@greenox.com"
    phone = f"987{ts:07d}"
    
    # 1. Register citizen
    reg_res = client.post("/api/register", json={
        "first_name": "EcoHero",
        "surname": f"User{ts}",
        "phone": phone,
        "email": email,
        "address": "Sector 21 Green Park",
        "password": "Password@123",
        "confirm_password": "Password@123",
        "role": "citizen"
    })
    print("Registration:", reg_res.status_code, reg_res.get_json())
    assert reg_res.status_code == 200

    # 2. Check initial points
    pts_res = client.get(f"/api/citizen/points?email={email}&phone={phone}")
    print("Initial Points:", pts_res.get_json())
    assert pts_res.get_json().get("points") == 0

    # 3. Create a waste report complaint
    rpt_res = client.post("/api/reports", json={
        "address": "Sector 21 Garbage Pile",
        "waste_type": "Plastic & Dry Waste",
        "photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "reporter_name": "EcoHero",
        "reporter_phone": phone,
        "reporter_email": email
    })
    rpt_data = rpt_res.get_json()
    print("Report Created:", rpt_data)
    task_id = rpt_data["task"]["id"]

    # 4. Resolve task from employee / admin side with photo proof
    resolve_res = client.post("/api/admin/update-task-status", json={
        "task_id": task_id,
        "status": "Resolved",
        "after_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "time_consumed": "25 mins"
    })
    resolve_data = resolve_res.get_json()
    print("Task Resolved:", resolve_data)
    awarded_points = resolve_data["task"]["awarded_points"]
    print(f"Awarded Points: {awarded_points}")
    assert 35 <= awarded_points <= 70

    # 5. Check citizen points balance
    pts_after = client.get(f"/api/citizen/points?email={email}&phone={phone}")
    pts_data = pts_after.get_json()
    print("Points after task resolve:", pts_data)
    assert pts_data.get("points") == awarded_points
    assert len(pts_data.get("history")) == 1
    print(f">>> TEST 2 PASSED: Task resolve awarded {awarded_points} Greenox Points (in range 35-70)!")
    return email, phone, awarded_points

def test_rewards_redemption(email, phone, initial_pts):
    print("\n--- TEST 3: Rewards Redemption ---")
    # Grant user 1500 points for testing all redemption tiers
    users = load_json(USERS_JSON, [])
    for u in users:
        if u.get("email") == email:
            u["greenox_points"] = 1500
    save_json(USERS_JSON, users)

    # 1. Redeem Tier 2: Rs 5 Cashback (100 pts)
    r1 = client.post("/api/citizen/redeem", json={
        "email": email,
        "phone": phone,
        "reward_id": "cashback_5"
    })
    d1 = r1.get_json()
    print("Redeem Rs 5 Cashback (100 pts):", d1)
    assert r1.status_code == 200
    assert d1["voucher"]["cost"] == 100
    assert d1["remaining_points"] == 1400

    # 2. Redeem Tier 1: 30% Off Govt Travel (200 pts)
    r2 = client.post("/api/citizen/redeem", json={
        "email": email,
        "phone": phone,
        "reward_id": "govt_travel_30"
    })
    d2 = r2.get_json()
    print("Redeem 30% Govt Travel (200 pts):", d2)
    assert r2.status_code == 200
    assert d2["voucher"]["cost"] == 200
    assert d2["remaining_points"] == 1200

    # 3. Redeem Tier 3: Free Govt Bus Service (1000 pts)
    r3 = client.post("/api/citizen/redeem", json={
        "email": email,
        "phone": phone,
        "reward_id": "free_bus_ride"
    })
    d3 = r3.get_json()
    print("Redeem Free Bus Ride (1000 pts):", d3)
    assert r3.status_code == 200
    assert d3["voucher"]["cost"] == 1000
    assert d3["remaining_points"] == 200

    # 4. Attempt to redeem 1000 pts with only 200 pts remaining -> should fail (400)
    r4 = client.post("/api/citizen/redeem", json={
        "email": email,
        "phone": phone,
        "reward_id": "free_bus_ride"
    })
    d4 = r4.get_json()
    print("Redeem without sufficient balance:", r4.status_code, d4)
    assert r4.status_code == 400
    assert "Insufficient" in d4["message"]

    # Verify vouchers list
    pts_final = client.get(f"/api/citizen/points?email={email}&phone={phone}")
    assert len(pts_final.get_json()["vouchers"]) == 3
    print(">>> TEST 3 PASSED: All 3 reward redemption tiers verified with correct balance deduction and digital voucher code generation!")

def test_admin_user_management(email, phone):
    print("\n--- TEST 4: Admin User Management (Force Logout & Delete User) ---")
    # 1. Force Logout User
    lo_res = client.post("/api/admin/logout-user", json={
        "email": email,
        "phone": phone,
        "role": "citizen"
    })
    print("Admin Force Logout:", lo_res.get_json())
    assert lo_res.status_code == 200

    # Check session status
    sess_res = client.get(f"/api/user/session-status?email={email}&phone={phone}&role=citizen")
    print("Session Status after force logout:", sess_res.get_json())
    assert sess_res.get_json()["valid"] is False
    assert sess_res.get_json()["reason"] == "force_logout"

    # 2. Delete User
    del_res = client.post("/api/admin/delete-user", json={
        "email": email,
        "phone": phone,
        "role": "citizen"
    })
    print("Admin Delete User:", del_res.get_json())
    assert del_res.status_code == 200

    # Check session status again (should be deleted)
    sess_del = client.get(f"/api/user/session-status?email={email}&phone={phone}&role=citizen")
    print("Session Status after delete:", sess_del.get_json())
    assert sess_del.get_json()["valid"] is False
    assert sess_del.get_json()["reason"] == "deleted"
    print(">>> TEST 4 PASSED: Admin Force Logout and User Permanent Removal successfully verified!")

def test_phone_number_digit_validation():
    print("\n--- TEST 5: Phone Number 10-Digit Validation on Registration ---")
    ts = int(time.time() % 100000)
    
    # 1. Less than 10 digits (9 digits)
    res_short = client.post("/api/register", json={
        "first_name": "Short", "surname": "Phone", "phone": "987654321",
        "email": f"short_{ts}@greenox.com", "password": "Secure@123",
        "confirm_password": "Secure@123", "role": "citizen"
    })
    data_short = res_short.get_json()
    print("Short phone (<10 digits): status=", res_short.status_code, "data=", data_short)
    assert res_short.status_code == 400
    assert "Phone number must be exactly 10 digits" in data_short.get("message", "")

    # 2. More than 10 digits (11 digits)
    res_long = client.post("/api/register", json={
        "first_name": "Long", "surname": "Phone", "phone": "987654321099",
        "email": f"long_{ts}@greenox.com", "password": "Secure@123",
        "confirm_password": "Secure@123", "role": "citizen"
    })
    data_long = res_long.get_json()
    print("Long phone (>10 digits): status=", res_long.status_code, "data=", data_long)
    assert res_long.status_code == 400
    assert "Phone number must be exactly 10 digits" in data_long.get("message", "")

    # 3. Non-digit characters (10 chars but contains letters)
    res_alpha = client.post("/api/register", json={
        "first_name": "Alpha", "surname": "Phone", "phone": "987654321a",
        "email": f"alpha_{ts}@greenox.com", "password": "Secure@123",
        "confirm_password": "Secure@123", "role": "citizen"
    })
    data_alpha = res_alpha.get_json()
    print("Non-digit phone: status=", res_alpha.status_code, "data=", data_alpha)
    assert res_alpha.status_code == 400
    assert "Phone number must be exactly 10 digits" in data_alpha.get("message", "")

    # 4. Valid exactly 10-digit phone
    valid_phone = f"987{ts:07d}"
    res_valid = client.post("/api/register", json={
        "first_name": "Valid", "surname": "PhoneUser", "phone": valid_phone,
        "email": f"valid_phone_{ts}@greenox.com", "password": "Secure@123",
        "confirm_password": "Secure@123", "role": "citizen"
    })
    data_valid = res_valid.get_json()
    print("Valid 10-digit phone: status=", res_valid.status_code, "data=", data_valid)
    assert res_valid.status_code == 200
    assert data_valid.get("success") is True
    print(">>> TEST 5 PASSED: 10-digit phone number validation on registration verified!")

if __name__ == "__main__":
    try:
        test_login_lockout()
        email, phone, pts = test_registration_and_points_system()
        test_rewards_redemption(email, phone, pts)
        test_admin_user_management(email, phone)
        test_phone_number_digit_validation()
        print("\n=======================================================")
        print("ALL 5 FEATURE TESTS PASSED 100% SUCCESSFULLY!")
        print("=======================================================")
    except Exception as e:
        print(f"\n[!] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

