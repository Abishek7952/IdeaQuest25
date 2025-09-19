#!/usr/bin/env python3
"""
Start the server and open the dashboard for testing
"""

import subprocess
import time
import webbrowser
import sys
import os

def start_server():
    """Start the Flask server"""
    print("🚀 Starting Flask server...")
    
    try:
        # Start server in background
        process = subprocess.Popen([
            sys.executable, "server.py"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait a moment for server to start
        time.sleep(3)
        
        # Check if process is still running
        if process.poll() is None:
            print("✅ Server started successfully!")
            return process
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Server failed to start:")
            print(f"STDOUT: {stdout.decode()}")
            print(f"STDERR: {stderr.decode()}")
            return None
            
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return None

def open_dashboard():
    """Open the dashboard in the default browser"""
    print("🌐 Opening dashboard in browser...")
    
    try:
        # Open main page first
        webbrowser.open("http://localhost:5000")
        time.sleep(2)
        
        # Open dashboard directly
        webbrowser.open("http://localhost:5000/dashboard?room=testroom")
        print("✅ Dashboard opened in browser!")
        
    except Exception as e:
        print(f"❌ Error opening browser: {e}")

def main():
    print("🎯 Enhanced Dashboard Launcher")
    print("=" * 50)
    
    # Start server
    server_process = start_server()
    
    if server_process:
        try:
            # Open dashboard
            open_dashboard()
            
            print("\n🎉 Dashboard is ready!")
            print("\n📋 Features to test:")
            print("1. 📊 Sentiment Analysis - Real-time emotion tracking")
            print("2. 🤖 AI Summary - Generate meeting summaries with MOM and action items")
            print("3. 🎤 Speaking Distribution - See who's talking the most")
            print("4. 📈 Meeting Metrics - Duration, participants, engagement")
            print("5. 🏆 Participant Leaderboard - Engagement rankings")
            print("6. 📝 Recent Transcript - Live conversation feed")
            
            print("\n🔧 How to test:")
            print("1. Join a room on the main page")
            print("2. Start speaking to generate data")
            print("3. Click 'Dashboard' button to see analytics")
            print("4. Click 'Generate Summary' for AI insights")
            
            print("\n⏹️  Press Ctrl+C to stop the server")
            
            # Keep server running
            server_process.wait()
            
        except KeyboardInterrupt:
            print("\n🛑 Stopping server...")
            server_process.terminate()
            server_process.wait()
            print("✅ Server stopped.")
            
    else:
        print("❌ Failed to start server. Please check for errors above.")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
