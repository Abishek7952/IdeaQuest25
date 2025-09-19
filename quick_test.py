#!/usr/bin/env python3
"""
Quick test to verify dashboard functionality
"""

import requests
import time
import webbrowser
import subprocess
import sys
import os

def test_and_populate():
    """Test endpoints and populate data"""
    base_url = "http://localhost:5000"
    test_room = "testroom"
    
    print("🧪 Testing and populating dashboard...")
    
    try:
        # Add test data
        print("📊 Adding test data...")
        response = requests.post(f"{base_url}/test-data/{test_room}", timeout=10)
        if response.status_code == 200:
            print("✅ Test data added successfully")
        else:
            print(f"❌ Failed to add test data: {response.status_code}")
            return False
        
        # Test engagement endpoint
        print("🎯 Testing engagement endpoint...")
        response = requests.get(f"{base_url}/engagement/{test_room}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Engagement: {len(data.get('leaderboard', []))} participants")
            print(f"   Speaking distribution: {len(data.get('speaking_distribution', []))} entries")
        else:
            print(f"❌ Engagement endpoint failed: {response.status_code}")
        
        # Test sentiment endpoint
        print("😊 Testing sentiment endpoint...")
        response = requests.get(f"{base_url}/sentiment/{test_room}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Sentiment: {len(data.get('sentiment_history', []))} entries")
            print(f"   Overall sentiment: {data.get('overall_sentiment', 'unknown')}")
        else:
            print(f"❌ Sentiment endpoint failed: {response.status_code}")
        
        # Test transcript endpoint
        print("📝 Testing transcript endpoint...")
        response = requests.get(f"{base_url}/transcript/{test_room}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Transcript: {len(data.get('transcript', []))} entries")
        else:
            print(f"❌ Transcript endpoint failed: {response.status_code}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("🚀 Quick Dashboard Test")
    print("=" * 40)
    
    # Wait for server
    print("⏳ Waiting for server...")
    time.sleep(2)
    
    # Test and populate
    if test_and_populate():
        print("\n🎉 Dashboard ready!")
        print("\n🌐 Opening dashboard...")
        
        # Open dashboard
        webbrowser.open("http://localhost:5000/dashboard?room=testroom")
        
        print("\n✨ Dashboard features to verify:")
        print("1. 📊 Sentiment Analysis - Should show chart with data")
        print("2. 🎤 Speaking Distribution - Should show 4 participants")
        print("3. 🏆 Participant Leaderboard - Should show rankings")
        print("4. 📈 Meeting Metrics - Should show participant count")
        print("5. 🤖 AI Summary - Click 'Generate Summary' button")
        print("6. 📝 Recent Transcript - Should show conversation")
        
        return True
    else:
        print("\n❌ Dashboard test failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
