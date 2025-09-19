#!/usr/bin/env python3
"""
Test script for the enhanced dashboard functionality
"""

import requests
import json
import time
import sys

def test_dashboard_endpoints():
    """Test all dashboard-related endpoints"""
    base_url = "http://localhost:5000"
    test_room = "testroom"
    
    print("🧪 Testing Dashboard Endpoints...")
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint working")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False
    
    # Test dashboard page
    try:
        response = requests.get(f"{base_url}/dashboard?room={test_room}", timeout=5)
        if response.status_code == 200:
            print("✅ Dashboard page accessible")
        else:
            print(f"❌ Dashboard page failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Dashboard page error: {e}")
    
    # Test engagement endpoint
    try:
        response = requests.get(f"{base_url}/engagement/{test_room}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Engagement endpoint working")
            print(f"   - Participants: {data.get('total_participants', 0)}")
        else:
            print(f"❌ Engagement endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Engagement endpoint error: {e}")
    
    # Test sentiment endpoint
    try:
        response = requests.get(f"{base_url}/sentiment/{test_room}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Sentiment endpoint working")
            print(f"   - Overall sentiment: {data.get('overall_sentiment', 'unknown')}")
        else:
            print(f"❌ Sentiment endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Sentiment endpoint error: {e}")
    
    # Test transcript endpoint
    try:
        response = requests.get(f"{base_url}/transcript/{test_room}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Transcript endpoint working")
            print(f"   - Transcript entries: {len(data.get('transcript', []))}")
        else:
            print(f"❌ Transcript endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Transcript endpoint error: {e}")
    
    # Test summarize endpoint
    try:
        response = requests.post(f"{base_url}/summarize", 
                               json={"room": test_room}, 
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ Summarize endpoint working")
            print(f"   - AI Backend: {data.get('ai_backend', 'unknown')}")
        else:
            print(f"❌ Summarize endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Summarize endpoint error: {e}")
    
    return True

def add_test_data():
    """Add some test data to make the dashboard more interesting"""
    base_url = "http://localhost:5000"
    test_room = "testroom"
    
    print("\n📊 Adding test data...")
    
    try:
        response = requests.post(f"{base_url}/test-data/{test_room}", timeout=5)
        if response.status_code == 200:
            print("✅ Test data added successfully")
        else:
            print(f"❌ Failed to add test data: {response.status_code}")
    except Exception as e:
        print(f"❌ Test data error: {e}")

def main():
    print("🚀 Dashboard Functionality Test")
    print("=" * 50)
    
    # Wait a moment for server to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(2)
    
    # Test endpoints
    if test_dashboard_endpoints():
        print("\n🎯 Basic endpoints working!")
        
        # Add test data
        add_test_data()
        
        print("\n🎉 Dashboard test completed!")
        print("\n📋 Next steps:")
        print("1. Open http://localhost:5000 in your browser")
        print("2. Click the 'Dashboard' button")
        print("3. Verify all sections are working:")
        print("   - Sentiment Analysis chart")
        print("   - AI Summary generation")
        print("   - Speaking Distribution")
        print("   - Meeting Metrics")
        print("   - Participant Leaderboard")
        
        return True
    else:
        print("\n❌ Some tests failed. Check server status.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
