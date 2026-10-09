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

    # Create target page
    target = await b_call("Target.createTarget", {"url": "http://localhost:8080/"})
    target_id = target["targetId"]
    print("Created target:", target_id)

    # Attach to target
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
    await asyncio.sleep(2.5)

    tabs = [
        ("01_hosts_dense_table.png", "hosts"),
        ("03_containers_view.png", "docker"),
        ("04_app_store_catalog.png", "appstore"),
        ("05_services_systemd.png", "services"),
        ("06_file_manager.png", "files"),
        ("07_port_registry.png", "ports"),
        ("08_firewall_fail2ban.png", "firewall"),
        ("09_cron_tasks.png", "cron"),
        ("10_compose_studio.png", "compose"),
        ("11_terminal_view.png", "terminal"),
    ]

    for fname, tab_id in tabs:
        await s_eval(f"""
            (() => {{
                const aside = document.querySelector('aside');
                if (!aside) return;
                const buttons = Array.from(aside.querySelectorAll('button'));
                for (const b of buttons) {{
                    const title = (b.getAttribute('title') || '').toLowerCase();
                    const text = (b.textContent || '').toLowerCase();
                    if (title.includes('{tab_id}') || text.includes('{tab_id}')) {{
                        b.click();
                        return;
                    }}
                }}
                const map = {{
                    'hosts': 'Hosts',
                    'services': 'Services',
                    'terminal': 'Terminal',
                    'appstore': 'App Store',
                    'docker': 'Containers',
                    'compose': 'Compose',
                    'files': 'File',
                    'cron': 'Cron',
                    'ports': 'Port',
                    'firewall': 'Firewall'
                }};
                const label = map['{tab_id}'] || '{tab_id}';
                for (const b of buttons) {{
                    if (b.textContent.includes(label)) {{
                        b.click();
                        return;
                    }}
                }}
            }})()
        """)
        await asyncio.sleep(1.2)
        await s_shot(fname)

    # Grid mode for hosts
    await s_eval("""
        (() => {
            const aside = document.querySelector('aside');
            const btns = Array.from(aside.querySelectorAll('button'));
            const hostsBtn = btns.find(b => b.textContent.includes('Hosts'));
            if (hostsBtn) hostsBtn.click();
        })()
    """)
    await asyncio.sleep(1)
    await s_eval("""
        (() => {
            const gridBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Grid'));
            if (gridBtn) gridBtn.click();
        })()
    """)
    await asyncio.sleep(1)
    await s_shot("02_hosts_metrics_grid.png")

    # Close created target
    await b_call("Target.closeTarget", {"targetId": target_id})
    await browser_ws.close()
    print("ALL FINISHED SUCCESS!")

if __name__ == "__main__":
    asyncio.run(main())
