#!/usr/bin/env python3
"""
Quick test script for MCP FastAPI Server
Simple smoke tests for development
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def quick_test():
    """Run quick smoke tests"""
    base_url = f'http://localhost:{os.getenv("MCP_PORT", "8081")}'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {os.getenv('MCP_AUTH_TOKEN', 'demo-token-123')}"
    }
    
    print("🚀 Quick MCP Server Test")
    print("=" * 30)
    
    # Test 1: Health check
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Test 2: Tools list
    try:
        response = requests.get(f"{base_url}/tools/", headers=headers)
        if response.status_code == 200:
            data = response.json()
            tool_count = len(data.get('tools', []))
            print(f"✅ Tools list: {tool_count} tools available")
            print(json.dumps(data, indent=2))
        else:
            print(f"❌ Tools list failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Tools list error: {e}")
        return False
    
    # Test 3: Credit check tool
    try:
        payload = {
            "fullName": "Test User",
            "ssn": "1234",
            "dateOfBirth": "1990-01-01"
        }
        response = requests.post(f"{base_url}/tools/credit_check", 
                               headers=headers, json=payload)
        if response.status_code == 200:
            print("✅ Credit check tool working")
            print("Credit check result:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ Credit check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Credit check error: {e}")
        return False
    
    print("\n🎉 All quick tests passed! Server is ready.")
    return True

if __name__ == "__main__":
    success = quick_test()
    exit(0 if success else 1)
