import unittest
import json
import os
import server

class TestGreenoxNewFeatures(unittest.TestCase):
    def setUp(self):
        server.app.config['TESTING'] = True
        self.client = server.app.test_client()

    def test_01_tree_planting_booking_standalone(self):
        # Test standalone tree planting booking for Rs 599
        res = self.client.post('/api/bookings', json={
            "service_name": "Plant a Tree (Eco Initiative)",
            "service_price": 599,
            "receipt": {
                "service_fee": 420,
                "worker_fee": 100,
                "consumables_fee": 50,
                "platform_fee": 29,
                "total_amount": 599
            },
            "timing_slot": "Tomorrow Morning: 08:00 AM - 11:00 AM",
            "address": "Sector 14 Green Park",
            "customer_name": "Test Citizen",
            "customer_phone": "9999988888",
            "customer_email": "tree.citizen@greenox.test",
            "user_type": "citizen",
            "tree_planting_included": True,
            "has_tree_planting": True
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        booking = data['booking']
        self.assertEqual(booking['service_price'], 599)
        self.assertTrue(booking['has_tree_planting'])
        self.assertTrue(booking['tree_planting_included'])
        self.assertEqual(booking['status'], 'Pending')
        self.__class__.tree_booking_id = booking['id']

    def test_02_tree_planting_booking_addon_50_percent(self):
        # Test Home Deep Cleaning (1499) + Tree Planting Add-on (+299, 50% off) = 1798
        res = self.client.post('/api/bookings', json={
            "service_name": "Home Deep Cleaning",
            "service_price": 1798,
            "receipt": {
                "service_fee": 1050,
                "worker_fee": 250,
                "consumables_fee": 120,
                "platform_fee": 79,
                "tree_planting_addon": True,
                "tree_addon_price": 299,
                "total_amount": 1798
            },
            "timing_slot": "Weekend Special Slot",
            "address": "Green Avenue Tower 4",
            "customer_name": "Addon Customer",
            "customer_phone": "9999977777",
            "customer_email": "addon.citizen@greenox.test",
            "user_type": "citizen",
            "tree_planting_included": True,
            "tree_addon_price": 299,
            "has_tree_planting": True
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        booking = data['booking']
        self.assertEqual(booking['service_price'], 1798)
        self.assertTrue(booking['tree_planting_included'])
        self.assertEqual(booking['tree_addon_price'], 299)
        self.__class__.addon_booking_id = booking['id']

    def test_03_admin_close_private_booking(self):
        # Admin closes private booking due to heavy load
        booking_id = getattr(self.__class__, 'tree_booking_id', None)
        self.assertIsNotNone(booking_id)

        res = self.client.post('/api/admin/close-booking', json={
            "booking_id": booking_id,
            "reason": "The service / private booking you raised has been temporarily closed due to heavy load."
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['booking']['status'], 'Closed (Heavy Load)')
        self.assertIn('temporarily closed due to heavy load', data['notification']['message'])

    def test_04_create_and_close_waste_complaint(self):
        # 1. Citizen creates waste complaint
        res = self.client.post('/api/reports', json={
            "address": "Sector 45 Landmark Junction",
            "waste_type": "Plastic & Dry Waste",
            "photo": "data:image/png;base64,iVBORw0KGgo=",
            "lat": 28.6139,
            "lng": 77.2090,
            "reporter_name": "Complaint Citizen",
            "reporter_phone": "9999966666",
            "reporter_email": "complaint.user@greenox.test"
        })
        self.assertEqual(res.status_code, 200)
        task = res.get_json()['task']
        task_id = task['id']

        # 2. Admin closes complaint due to heavy load
        close_res = self.client.post('/api/admin/close-task', json={
            "task_id": task_id,
            "reason": "The service / complaint you raised has been temporarily closed due to heavy load. Please try again later."
        })
        self.assertEqual(close_res.status_code, 200)
        close_data = close_res.get_json()
        self.assertTrue(close_data['success'])
        self.assertEqual(close_data['task']['status'], 'Closed (Heavy Load)')
        self.assertIn('temporarily closed due to heavy load', close_data['notification']['message'])

        # 3. Citizen checks notifications
        notif_res = self.client.get('/api/user/notifications?email=complaint.user@greenox.test&phone=9999966666')
        self.assertEqual(notif_res.status_code, 200)
        notif_data = notif_res.get_json()
        self.assertTrue(notif_data['success'])
        self.assertGreater(len(notif_data['notifications']), 0)
        self.assertEqual(notif_data['notifications'][0]['ref_id'], task_id)
        self.assertEqual(notif_data['notifications'][0]['type'], 'heavy_load_closure')

    def test_05_solved_complaints_history_and_clear(self):
        # 1. Create a task to resolve
        res = self.client.post('/api/reports', json={
            "address": "Sector 18 Market Plaza",
            "waste_type": "Organic & Food Waste",
            "photo": "data:image/png;base64,iVBORw0KGgo=",
            "lat": 28.5700,
            "lng": 77.3200,
            "reporter_name": "Eco Advocate",
            "reporter_phone": "9999955555",
            "reporter_email": "advocate@greenox.test"
        })
        task_id = res.get_json()['task']['id']

        # 2. Resolve task
        res_resolve = self.client.post('/api/admin/update-task-status', json={
            "task_id": task_id,
            "status": "Resolved",
            "after_photo": "data:image/png;base64,iVBORw0KGgo=",
            "time_consumed": "20 mins"
        })
        self.assertEqual(res_resolve.status_code, 200)

        # 3. Verify task appears in solved_tasks with citizen full details and location
        admin_data_res = self.client.get('/api/admin/data')
        self.assertEqual(admin_data_res.status_code, 200)
        admin_data = admin_data_res.get_json()
        self.assertTrue(admin_data['success'])
        
        solved = [t for t in admin_data['solved_tasks'] if t['id'] == task_id]
        self.assertEqual(len(solved), 1)
        st = solved[0]
        self.assertEqual(st['reporter_name'], 'Eco Advocate')
        self.assertEqual(st['reporter_email'], 'advocate@greenox.test')
        self.assertEqual(st['reporter_phone'], '9999955555')
        self.assertEqual(st['address'], 'Sector 18 Market Plaza')
        self.assertEqual(st['status'], 'Resolved')

        # 4. Clear solved history
        clear_res = self.client.post('/api/admin/clear-solved-history')
        self.assertEqual(clear_res.status_code, 200)
        clear_data = clear_res.get_json()
        self.assertTrue(clear_data['success'])
        self.assertGreaterEqual(clear_data['cleared_count'], 1)

        # 5. Verify solved_tasks is now empty
        admin_data_res2 = self.client.get('/api/admin/data')
        admin_data2 = admin_data_res2.get_json()
        self.assertEqual(len(admin_data2['solved_tasks']), 0)
        self.assertEqual(len(admin_data2['showcase']), 0)

    def test_06_delete_individual_solved_task(self):
        # 1. Create and resolve a task
        res = self.client.post('/api/reports', json={
            "address": "Sector 62 IT Hub Gate 1",
            "waste_type": "E-Waste & Electronics",
            "photo": "data:image/png;base64,iVBORw0KGgo=",
            "reporter_name": "Individual Test Reporter",
            "reporter_phone": "9999944444",
            "reporter_email": "individual@greenox.test"
        })
        task_id = res.get_json()['task']['id']

        self.client.post('/api/admin/update-task-status', json={
            "task_id": task_id,
            "status": "Resolved",
            "after_photo": "data:image/png;base64,iVBORw0KGgo=",
            "time_consumed": "15 mins"
        })

        # Verify it exists in solved_tasks
        data_before = self.client.get('/api/admin/data').get_json()
        self.assertTrue(any(t['id'] == task_id for t in data_before['solved_tasks']))

        # 2. Delete individual solved task
        del_res = self.client.post('/api/admin/delete-solved-task', json={"task_id": task_id})
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.get_json()['success'])

        # 3. Verify it is removed
        data_after = self.client.get('/api/admin/data').get_json()
        self.assertFalse(any(t['id'] == task_id for t in data_after['solved_tasks']))

if __name__ == '__main__':
    unittest.main()
