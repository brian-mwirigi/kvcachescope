import asyncio
from playwright.async_api import async_playwright

async def capture_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080}, device_scale_factor=2)
        page = await context.new_page()
        
        await page.goto("http://localhost:8000", wait_until="networkidle")
        await asyncio.sleep(2)
        
        # 1. Click a leaked block (e.g. block #96 or #100) to populate inspector
        buttons = await page.query_selector_all('button')
        for b in buttons:
            text = await b.inner_text()
            if text.strip() in ['96', '97', '98', '99', '100']:
                await b.click()
                break
                
        await asyncio.sleep(1)
        # Capture Memory Map tab with active block inspection
        await page.screenshot(path="c:/Users/Nesh/Desktop/KV/frontend/src/assets/profiler_memory_map.png")
        await page.screenshot(path="C:/Users/Nesh/.gemini/antigravity/brain/61272a38-ebb0-4775-9003-fb2a8779c853/profiler_memory_map.png")
        
        # 2. Click Logical Page Tables tab
        tabs = await page.query_selector_all('button')
        for t in tabs:
            txt = await t.inner_text()
            if 'Logical Page Tables' in txt:
                await t.click()
                break
                
        await asyncio.sleep(1)
        # Capture Logical Page Tables tab
        await page.screenshot(path="c:/Users/Nesh/Desktop/KV/frontend/src/assets/profiler_page_tables.png")
        await page.screenshot(path="C:/Users/Nesh/.gemini/antigravity/brain/61272a38-ebb0-4775-9003-fb2a8779c853/profiler_page_tables.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(capture_all())
