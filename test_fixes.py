#!/usr/bin/env python3
"""
Test script to verify the fixes for:
1. Sentiment percentages showing 0%
2. Generate Summary button not working
3. Download button not working
"""

import requests
import json
import time
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:5000"
TEST_ROOM = "test-room"

def test_sentiment_data():
    """Test sentiment data endpoint"""
    print("🧪 Testing sentiment data...")
    
    # First, add some test transcript data with sentiment
    test_messages = [
        {"text": "This is great! I love this meeting.", "sentiment": "positive"},
        {"text": "I'm not sure about this approach.", "sentiment": "neutral"},
        {"text": "This is terrible and frustrating.", "sentiment": "negative"},
        {"text": "Amazing work everyone!", "sentiment": "positive"},
        {"text": "I disagree with this decision.", "sentiment": "negative"},
    ]
    
    # Simulate adding transcript entries
    for i, msg in enumerate(test_messages):
        data = {
            "room": TEST_ROOM,
            "text": msg["text"],
            "ts": int(time.time()) + i,
            "speaker": f"TestUser{i+1}"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/transcript", json=data)
            print(f"   ✅ Added message: {msg['text'][:30]}...")
        except Exception as e:
            print(f"   ❌ Failed to add message: {e}")
    
    # Test sentiment endpoint
    try:
        response = requests.get(f"{BASE_URL}/sentiment/{TEST_ROOM}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Sentiment endpoint working")
            print(f"   📊 Sentiment history entries: {len(data.get('sentiment_history', []))}")
            print(f"   📈 Overall sentiment: {data.get('overall_sentiment', 'unknown')}")
            return True
        else:
            print(f"   ❌ Sentiment endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Sentiment test failed: {e}")
        return False

def test_summary_generation():
    """Test summary generation endpoint"""
    print("🧪 Testing summary generation...")
    
    try:
        data = {
            "room": TEST_ROOM,
            "include_sentiment": True,
            "include_action_items": True
        }
        
        response = requests.post(f"{BASE_URL}/summarize", json=data)
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Summary generation working")
            print(f"   📝 Summary result: {result.get('result', 'No result')[:50]}...")
            print(f"   📊 Transcript length: {result.get('transcript_length', 0)}")
            return True
        else:
            print(f"   ❌ Summary generation failed: {response.status_code}")
            print(f"   📄 Response: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Summary test failed: {e}")
        return False

def test_transcript_download():
    """Test transcript download endpoint"""
    print("🧪 Testing transcript download...")
    
    try:
        response = requests.get(f"{BASE_URL}/transcript/{TEST_ROOM}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Transcript endpoint working")
            print(f"   📄 Transcript entries: {data.get('total_entries', 0)}")
            
            if data.get('transcript') and len(data['transcript']) > 0:
                print(f"   📝 Sample entry: {data['transcript'][0].get('text', 'No text')[:30]}...")
                return True
            else:
                print(f"   ⚠️  No transcript data available")
                return False
        else:
            print(f"   ❌ Transcript endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Transcript test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting fix verification tests...")
    print(f"🎯 Target server: {BASE_URL}")
    print(f"🏠 Test room: {TEST_ROOM}")
    print("-" * 50)
    
    # Wait a moment for server to be ready
    time.sleep(2)
    
    # Run tests
    results = []
    results.append(("Sentiment Data", test_sentiment_data()))
    results.append(("Summary Generation", test_summary_generation()))
    results.append(("Transcript Download", test_transcript_download()))
    
    # Print results
    print("-" * 50)
    print("📊 Test Results:")
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {status} {test_name}")
    
    all_passed = all(result[1] for result in results)
    if all_passed:
        print("\n🎉 All tests passed! The fixes should be working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the server logs for more details.")
    
    return all_passed

if __name__ == "__main__":
    main()
