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

    attached = await b_call("Target.attachToTarget", {"targetId": target_id, "flatten": True})
    session_id = attached["sessionId"]

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
    await asyncio.sleep(2.5)

    # Click Setup Guide button in TopHeader
    print("Opening Onboarding Setup Wizard...")
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('header button'));
            const guideBtn = btns.find(b => b.textContent.includes('Setup Guide') || (b.title && b.title.includes('Setup Guide')));
            if (guideBtn) guideBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # 1. Step 1: SSH Master Key
    print("Capturing 15_onboarding_step1_ssh_key.png...")
    await s_shot("15_onboarding_step1_ssh_key.png")

    # Navigate to Step 2: First Server
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const nextBtn = btns.find(b => b.textContent.includes('Next: Connect First Server') || b.textContent.includes('FIRST SERVER'));
            if (nextBtn) nextBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # Fill sample data in Step 2
    await s_eval("""
        (() => {
            const inputs = document.querySelectorAll('input[type="text"]');
            if (inputs[1]) inputs[1].value = '192.168.1.100';
        })()
    """)
    await asyncio.sleep(0.5)

    print("Capturing 16_onboarding_step2_first_server.png...")
    await s_shot("16_onboarding_step2_first_server.png")

    # Navigate to Step 3: Stack Setup
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const step3Btn = btns.find(b => b.textContent.includes('STACK SETUP') || b.textContent.includes('Skip adding server'));
            if (step3Btn) step3Btn.click();
        })()
    """)
    await asyncio.sleep(1)

    print("Capturing 17_onboarding_step3_provisioning_stack.png...")
    await s_shot("17_onboarding_step3_provisioning_stack.png")

    # Navigate to Step 4: Tour & Finish
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const step4Btn = btns.find(b => b.textContent.includes('TOUR & FINISH') || b.textContent.includes('Save & Continue'));
            if (step4Btn) step4Btn.click();
        })()
    """)
    await asyncio.sleep(1)

    print("Capturing 18_onboarding_step4_tour.png...")
    await s_shot("18_onboarding_step4_tour.png")

    # Clean up
    await b_call("Target.closeTarget", {"targetId": target_id})
    await browser_ws.close()
    print("ALL ONBOARDING SCREENSHOTS CAPTURED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
