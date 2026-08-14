import time
import asyncio
import urllib.request
import json
from playwright.async_api import async_playwright

def trigger_chaos():
    try:
        # Set scenario to hostage leak demo
        req = urllib.request.Request(
            "http://localhost:8000/api/scenarios/set",
            data=json.dumps({"scenario": "hostage_leak_demo"}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req)
        time.sleep(1)
        # Inject leak
        req2 = urllib.request.Request(
            "http://localhost:8000/api/chaos/inject_leak",
            data=json.dumps({"reason": "ASYNC_CANCELLED_ERROR_BACKEND_PROPAGATION_FAILURE"}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req2)
    except Exception as e:
        print(f"Chaos trigger error: {e}")

async def capture():
    trigger_chaos()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1200}, device_scale_factor=2)
        page = await context.new_page()
        
        print("Navigating to http://localhost:8000...")
        await page.goto("http://localhost:8000", wait_until="networkidle")
        
        # Wait 4 seconds for WebSocket stream updates
        await asyncio.sleep(4)
        
        screenshot_path = "c:/Users/Nesh/Desktop/KV/frontend/src/assets/dashboard_real.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"Screenshot saved to: {screenshot_path}")
        
        artifact_path = "C:/Users/Nesh/.gemini/antigravity/brain/61272a38-ebb0-4775-9003-fb2a8779c853/dashboard_real.png"
        await page.screenshot(path=artifact_path, full_page=False)
        print(f"Artifact screenshot saved to: {artifact_path}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(capture())
