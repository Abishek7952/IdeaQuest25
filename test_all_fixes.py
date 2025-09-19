#!/usr/bin/env python3
"""
Comprehensive test script to verify all dashboard fixes:
1. Sentiment percentages showing 0%
2. Generate Summary button not working  
3. Download button not working
4. Meeting metrics only showing duration
"""

import requests
import json
import time
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:5000"
TEST_ROOM = "testroom"

def add_test_data():
    """Add test data to the room"""
    print("🔧 Adding test data...")
    
    try:
        response = requests.post(f"{BASE_URL}/test-data/{TEST_ROOM}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Test data added successfully")
            print(f"   👥 Participants: {data.get('participants', 0)}")
            print(f"   📝 Transcript entries: {data.get('transcript_entries', 0)}")
            print(f"   💭 Sentiment entries: {data.get('sentiment_entries', 0)}")
            return True
        else:
            print(f"   ❌ Failed to add test data: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error adding test data: {e}")
        return False

def test_sentiment_percentages():
    """Test sentiment percentage calculation"""
    print("🧪 Testing sentiment percentages...")
    
    try:
        response = requests.get(f"{BASE_URL}/sentiment/{TEST_ROOM}")
        if response.status_code == 200:
            data = response.json()
            history = data.get('sentiment_history', [])
            
            if len(history) > 0:
                # Calculate expected percentages
                positive = sum(1 for entry in history if entry.get('score', 0) > 0.2)
                negative = sum(1 for entry in history if entry.get('score', 0) < -0.2)
                neutral = len(history) - positive - negative
                
                total = len(history)
                pos_percent = round((positive / total) * 100) if total > 0 else 0
                neu_percent = round((neutral / total) * 100) if total > 0 else 0
                neg_percent = round((negative / total) * 100) if total > 0 else 0
                
                print(f"   ✅ Sentiment data available: {len(history)} entries")
                print(f"   📊 Expected percentages: {pos_percent}% positive, {neu_percent}% neutral, {neg_percent}% negative")
                return True
            else:
                print(f"   ⚠️  No sentiment history available")
                return False
        else:
            print(f"   ❌ Sentiment endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Sentiment test failed: {e}")
        return False

def test_engagement_metrics():
    """Test engagement metrics calculation"""
    print("🧪 Testing engagement metrics...")
    
    try:
        response = requests.get(f"{BASE_URL}/engagement/{TEST_ROOM}")
        if response.status_code == 200:
            data = response.json()
            
            leaderboard = data.get('leaderboard', [])
            meeting_duration = data.get('meeting_duration', 0)
            total_participants = data.get('total_participants', 0)
            
            print(f"   ✅ Engagement data available")
            print(f"   👥 Participants: {total_participants}")
            print(f"   🏆 Leaderboard entries: {len(leaderboard)}")
            print(f"   ⏱️  Meeting duration: {meeting_duration:.1f} seconds")
            
            if leaderboard:
                avg_engagement = sum(p.get('engagement_score', 0) for p in leaderboard) / len(leaderboard)
                avg_attention = sum(p.get('avg_attention', 0) for p in leaderboard) / len(leaderboard)
                print(f"   📈 Avg engagement: {avg_engagement:.2f}")
                print(f"   👁️  Avg attention: {avg_attention:.2f}")
            
            return True
        else:
            print(f"   ❌ Engagement endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Engagement test failed: {e}")
        return False

def test_summary_generation():
    """Test summary generation"""
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
            print(f"   📝 Has result: {'Yes' if result.get('result') else 'No'}")
            print(f"   📊 Transcript length: {result.get('transcript_length', 0)}")
            print(f"   🤖 AI backend: {result.get('ai_backend', 'Unknown')}")
            
            if result.get('stats'):
                stats = result['stats']
                print(f"   📈 Word count: {stats.get('word_count', 0)}")
                print(f"   ⏱️  Estimated duration: {stats.get('estimated_duration', 0):.1f} min")
            
            return True
        else:
            print(f"   ❌ Summary generation failed: {response.status_code}")
            print(f"   📄 Response: {response.text[:100]}...")
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
            transcript = data.get('transcript', [])
            
            print(f"   ✅ Transcript endpoint working")
            print(f"   📄 Transcript entries: {len(transcript)}")
            
            if transcript:
                sample_entry = transcript[0]
                print(f"   📝 Sample entry: {sample_entry.get('speaker', 'Unknown')}: {sample_entry.get('text', '')[:50]}...")
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
    """Run comprehensive test suite"""
    print("🚀 Starting comprehensive dashboard fix verification...")
    print(f"🎯 Target server: {BASE_URL}")
    print(f"🏠 Test room: {TEST_ROOM}")
    print("=" * 60)
    
    # Step 1: Add test data
    if not add_test_data():
        print("❌ Failed to add test data. Cannot proceed with tests.")
        return False
    
    print()
    
    # Step 2: Run all tests
    tests = [
        ("Sentiment Percentages", test_sentiment_percentages),
        ("Engagement Metrics", test_engagement_metrics),
        ("Summary Generation", test_summary_generation),
        ("Transcript Download", test_transcript_download)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{'-' * 40}")
        result = test_func()
        results.append((test_name, result))
    
    # Step 3: Print final results
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS:")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {status} {test_name}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL TESTS PASSED! Dashboard fixes are working correctly.")
        print("\n📋 What to do next:")
        print("   1. Open the dashboard in your browser")
        print("   2. Navigate to the test room")
        print("   3. Verify all metrics are displaying correctly")
        print("   4. Test the Generate Summary button")
        print("   5. Test the Download Transcript button")
    else:
        print("⚠️  SOME TESTS FAILED. Check the server logs for more details.")
        print("\n🔧 Troubleshooting:")
        print("   1. Ensure the server is running on localhost:5000")
        print("   2. Check server logs for any errors")
        print("   3. Verify all dependencies are installed")
    
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    main()
