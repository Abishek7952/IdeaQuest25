#!/usr/bin/env python3
"""
Test script to verify real-time dashboard functionality
"""

import requests
import time
import json

def test_dashboard_realtime():
    """Test the real-time dashboard functionality"""
    base_url = "http://localhost:5000"
    room = "testroom"
    
    print("Testing Real-time Dashboard Functionality")
    print("=" * 50)
    
    # 1. Add test data to the room
    print("1. Adding test data to room...")
    try:
        response = requests.post(f"{base_url}/test-data/{room}")
        if response.status_code == 200:
            print("✓ Test data added successfully")
            print(f"  Response: {response.json()}")
        else:
            print(f"✗ Failed to add test data: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error adding test data: {e}")
        return False
    
    # 2. Test engagement endpoint
    print("\n2. Testing engagement endpoint...")
    try:
        response = requests.get(f"{base_url}/engagement/{room}")
        if response.status_code == 200:
            data = response.json()
            print("✓ Engagement data retrieved successfully")
            print(f"  Participants: {len(data.get('leaderboard', []))}")
            print(f"  Meeting duration: {data.get('meeting_duration', 0)} seconds")
        else:
            print(f"✗ Failed to get engagement data: {response.status_code}")
    except Exception as e:
        print(f"✗ Error getting engagement data: {e}")
    
    # 3. Test sentiment endpoint
    print("\n3. Testing sentiment endpoint...")
    try:
        response = requests.get(f"{base_url}/sentiment/{room}")
        if response.status_code == 200:
            data = response.json()
            print("✓ Sentiment data retrieved successfully")
            print(f"  Sentiment history entries: {len(data.get('sentiment_history', []))}")
            print(f"  Overall sentiment: {data.get('overall_sentiment', 'unknown')}")
        else:
            print(f"✗ Failed to get sentiment data: {response.status_code}")
    except Exception as e:
        print(f"✗ Error getting sentiment data: {e}")
    
    # 4. Test transcript endpoint
    print("\n4. Testing transcript endpoint...")
    try:
        response = requests.get(f"{base_url}/transcript/{room}")
        if response.status_code == 200:
            data = response.json()
            print("✓ Transcript data retrieved successfully")
            print(f"  Transcript entries: {len(data.get('transcript', []))}")
        else:
            print(f"✗ Failed to get transcript data: {response.status_code}")
    except Exception as e:
        print(f"✗ Error getting transcript data: {e}")
    
    # 5. Test dashboard page
    print("\n5. Testing dashboard page...")
    try:
        response = requests.get(f"{base_url}/dashboard?room={room}")
        if response.status_code == 200:
            print("✓ Dashboard page accessible")
            print(f"  Page size: {len(response.text)} characters")
        else:
            print(f"✗ Failed to access dashboard: {response.status_code}")
    except Exception as e:
        print(f"✗ Error accessing dashboard: {e}")
    
    print("\n" + "=" * 50)
    print("Dashboard URL: http://localhost:5000/dashboard?room=testroom")
    print("Main App URL: http://localhost:5000")
    print("\nTo test real-time functionality:")
    print("1. Open the main app in one browser tab")
    print("2. Open the dashboard in another tab")
    print("3. Join a meeting in the main app")
    print("4. Start speaking or typing messages")
    print("5. Watch the dashboard update in real-time!")
    
    return True

if __name__ == "__main__":
    test_dashboard_realtime()
