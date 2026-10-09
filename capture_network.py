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

    # 1. Open Network Inspector for Sydney Node from the hosts view
    print("Opening Network Inspector Modal for Sydney Edge Node...")
    await s_eval("""
        (() => {
            const rows = Array.from(document.querySelectorAll('tbody tr'));
            const sydneyRow = rows.find(r => r.textContent.includes('Sydney Edge Node'));
            if (sydneyRow) {
                const netBtn = sydneyRow.querySelector('button[title*="Inspect Network"]');
                if (netBtn) netBtn.click();
            }
        })()
    """)
    # Wait for probe to complete (returns real live interfaces & GeoIP)
    await asyncio.sleep(4.5)

    print("Capturing 20_network_inspector_modal.png...")
    await s_shot("20_network_inspector_modal.png")

    # Click eth0 filter tab to inspect eth0 details and subnet calculations
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const eth0Btn = btns.find(b => b.textContent.trim() === 'eth0');
            if (eth0Btn) eth0Btn.click();
        })()
    """)
    await asyncio.sleep(0.5)
    print("Capturing 20b_network_interface_eth0_detail.png...")
    await s_shot("20b_network_interface_eth0_detail.png")

    # Close modal
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const closeBtn = btns.find(b => b.textContent.trim() === 'Close');
            if (closeBtn) closeBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # 2. Open Add Host Modal and test network probe
    print("Testing Add Host Modal Network Probe...")
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const addBtn = btns.find(b => b.textContent.includes('Add Host') || b.textContent.includes('Add Server'));
            if (addBtn) addBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # Fill host fields and click Test Network & GeoIP
    await s_eval("""
        (() => {
            const inputs = document.querySelectorAll('input');
            inputs.forEach(inp => {
                if (inp.placeholder && inp.placeholder.includes('192.168')) {
                    inp.value = '172.17.0.1';
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (inp.placeholder && inp.placeholder.includes('Production')) {
                    inp.value = 'Sydney Gateway Pro';
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        })()
    """)
    await asyncio.sleep(0.5)

    print("Capturing 21_add_host_with_network_test.png...")
    await s_shot("21_add_host_with_network_test.png")

    # Close Add Host Modal
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
            if (cancelBtn) cancelBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # 3. Open Onboarding Setup Wizard & step 2
    print("Opening Onboarding Modal Step 2...")
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('header button'));
            const guideBtn = btns.find(b => b.textContent.includes('Setup Guide') || (b.title && b.title.includes('Setup Guide')));
            if (guideBtn) guideBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # Go to step 2
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const nextBtn = btns.find(b => b.textContent.includes('Next: Connect First Server') || b.textContent.includes('FIRST SERVER'));
            if (nextBtn) nextBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    # Fill 172.17.0.1 and click Test Network & GeoIP
    print("Triggering Test Network & GeoIP in Onboarding Step 2...")
    await s_eval("""
        (() => {
            const inputs = document.querySelectorAll('input[type="text"]');
            if (inputs[1]) {
                inputs[1].value = '172.17.0.1';
                inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            }
            const btns = Array.from(document.querySelectorAll('button'));
            const testBtn = btns.find(b => b.textContent.includes('Test Network & GeoIP'));
            if (testBtn) testBtn.click();
        })()
    """)
    await asyncio.sleep(4.5)

    # Close the full inspector modal to reveal the inline summary in step 2
    await s_eval("""
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const closeBtn = btns.find(b => b.textContent.trim() === 'Close');
            if (closeBtn) closeBtn.click();
        })()
    """)
    await asyncio.sleep(1)

    print("Capturing 22_onboarding_step2_network_probe.png...")
    await s_shot("22_onboarding_step2_network_probe.png")

    # Clean up
    await b_call("Target.closeTarget", {"targetId": target_id})
    await browser_ws.close()
    print("ALL NETWORK SCREENSHOTS CAPTURED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
