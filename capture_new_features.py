import asyncio
import json
import urllib.request
import base64
import os
import websockets

SCREENSHOTS_DIR = "/root/.gemini/antigravity-cli/brain/7572943a-5175-4e4f-8f96-66f49acb7fb9/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

async def main():
    # 1. Get auth token
    req = urllib.request.Request('http://localhost:8080/api/auth/login', 
        data=json.dumps({'username': 'nijika', 'password': 'Password123!'}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST')
    with urllib.request.urlopen(req) as r:
        token = json.loads(r.read())['token']

    # 2. Connect to browser target
    req = urllib.request.Request('http://localhost:9222/json/version')
    with urllib.request.urlopen(req) as r:
        b_ws = json.loads(r.read())['webSocketDebuggerUrl']
    
    browser_ws = await websockets.connect(b_ws, max_size=100*1024*1024)

    msg_id = 0
    async def b_call(method, params=None):
        nonlocal msg_id
        msg_id += 1
        cid = msg_id
        await browser_ws.send(json.dumps({"id": cid, "method": method, "params": params or {}}))
        while True:
            resp = json.loads(await browser_ws.recv())
            if resp.get("id") == cid:
                return resp.get("result", {})

    target = await b_call("Target.createTarget", {"url": "http://localhost:8080/"})
    target_id = target["targetId"]
    print("Created target:", target_id)

    attached = await b_call("Target.attachToTarget", {"targetId": target_id, "flatten": True})
    session_id = attached["sessionId"]
    print("Attached sessionId:", session_id)

    async def s_call(method, params=None):
        nonlocal msg_id
        msg_id += 1
        cid = msg_id
        await browser_ws.send(json.dumps({"id": cid, "sessionId": session_id, "method": method, "params": params or {}}))
        while True:
            resp = json.loads(await browser_ws.recv())
            if resp.get("id") == cid:
                if "error" in resp:
                    raise Exception(f"Session error: {resp['error']}")
                return resp.get("result", {})

    async def s_eval(expr):
        r = await s_call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return r.get("result", {}).get("value")

    async def s_shot(filename):
        r = await s_call("Page.captureScreenshot", {"format": "png"})
        raw = base64.b64decode(r["data"])
        out = os.path.join(SCREENSHOTS_DIR, filename)
        with open(out, "wb") as f:
            f.write(raw)
        print(f"Captured: {filename} ({len(raw)} bytes)")

    await s_call("Page.enable")
    await s_call("DOM.enable")
    await s_call("Emulation.setDeviceMetricsOverride", {
        "width": 1440,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False
    })

    # Set token in localStorage & reload
    await asyncio.sleep(1)
    await s_eval(f"localStorage.setItem('serverdeck_token', '{token}'); location.reload();")
    await asyncio.sleep(3)

    # 1. Capture Sidebar Tree Structure
    print("Capturing 12_sidebar_tree_structure.png...")
    await s_shot("12_sidebar_tree_structure.png")

    # 2. Switch to Terminal and open multi-session tabs
    print("Navigating to Terminal and creating tabs...")
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('aside button'));
            const termBtn = btns.find(b => b.textContent.includes('Terminal'));
            if (termBtn) termBtn.click();
        })()
    """)
    await asyncio.sleep(2)

    # Click "+ New Tab" button
    await s_eval("""
        (() => {
            const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Tab') || (b.title && b.title.includes('new terminal')));
            if (addBtn) addBtn.click();
        })()
    """)
    await asyncio.sleep(1.5)

    # Open 3rd tab as well to demonstrate multi-tab power
    await s_eval("""
        (() => {
            const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Tab') || (b.title && b.title.includes('new terminal')));
            if (addBtn) addBtn.click();
        })()
    """)
    await asyncio.sleep(1.5)

    print("Capturing 11_terminal_multi_tab.png...")
    await s_shot("11_terminal_multi_tab.png")

    # 3. Open Settings Modal and switch to Host Provisioning tab
    print("Opening Settings Modal -> Host Provisioning...")
    await s_eval("""
        (() => {
            const settingsBtn = document.querySelector('button[title*="Settings"]');
            if (settingsBtn) settingsBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    await s_eval("""
        (() => {
            const provBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Provisioning'));
            if (provBtn) provBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # Click preset button to populate script
    await s_eval("""
        (() => {
            const presetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Full Stack') || b.textContent.includes('Docker & Compose'));
            if (presetBtn) presetBtn.click();
        })()
    """)
    await asyncio.sleep(0.5)

    print("Capturing 13_provisioning_settings.png...")
    await s_shot("13_provisioning_settings.png")

    # Close Settings modal
    await s_eval("""
        (() => {
            const closeBtn = document.querySelector('button[class*="rounded-lg text-carbon-400"]');
            if (closeBtn) closeBtn.click();
        })()
    """)
    await asyncio.sleep(0.8)

    # 4. Open Hosts view and click "Add Host" to show the Auto-Provisioning checkbox
    print("Navigating to Hosts and opening Add Host modal...")
    await s_eval("""
        (() => {
            const hostsBtn = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent.includes('Fleet Overview') || b.textContent.includes('Hosts'));
            if (hostsBtn) hostsBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    await s_eval("""
        (() => {
            const addHostBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Host') || (b.title && b.title.includes('Add Host')));
            if (addHostBtn) addHostBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    print("Capturing 14_add_host_provisioning_checkbox.png...")
    await s_shot("14_add_host_provisioning_checkbox.png")

    # Clean up
    await b_call("Target.closeTarget", {"targetId": target_id})
    await browser_ws.close()
    print("ALL SCREENSHOTS CAPTURED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
