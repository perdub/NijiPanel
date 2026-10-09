import asyncio
import json
import urllib.request
import base64
import os
import websockets

SCREENSHOTS_DIR = "/root/.gemini/antigravity-cli/brain/7572943a-5175-4e4f-8f96-66f49acb7fb9/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.msg_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=100*1024*1024)

    async def send(self, method, params=None):
        self.msg_id += 1
        current_id = self.msg_id
        payload = {"id": current_id, "method": method, "params": params or {}}
        await self.ws.send(json.dumps(payload))
        while True:
            resp = json.loads(await self.ws.recv())
            if resp.get("id") == current_id:
                if "error" in resp:
                    raise Exception(f"CDP error {resp['error']}")
                return resp.get("result", {})

    async def evaluate(self, expr):
        res = await self.send("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        })
        return res.get("result", {}).get("value")

    async def screenshot(self, filename):
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        data = base64.b64decode(res["data"])
        out_path = os.path.join(SCREENSHOTS_DIR, filename)
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"Captured: {filename} ({len(data)} bytes)")
        return out_path

async def main():
    # 1. Fetch token
    req = urllib.request.Request('http://localhost:8080/api/auth/login', 
        data=json.dumps({'username': 'nijika', 'password': 'Password123!'}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST')
    with urllib.request.urlopen(req) as r:
        token = json.loads(r.read()).get('token')

    # 2. Connect
    req = urllib.request.Request("http://localhost:9222/json")
    with urllib.request.urlopen(req) as r:
        pages = json.loads(r.read())
    page = next((p for p in pages if p.get("type") == "page"), None)
    
    client = CDPClient(page["webSocketDebuggerUrl"])
    await client.connect()

    await client.send("Page.enable")
    await client.send("DOM.enable")
    await client.send("Emulation.setDeviceMetricsOverride", {
        "width": 1440,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False
    })

    await client.send("Page.navigate", {"url": "http://localhost:8080/"})
    await asyncio.sleep(1)

    await client.evaluate(f"""
        localStorage.setItem('serverdeck_token', '{token}');
        window.location.reload();
    """)
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

    for filename, tab_id in tabs:
        print(f"Navigating to tab: {tab_id} -> {filename}")
        res = await client.evaluate(f"""
            (() => {{
                // Find all buttons in aside and simulate click on matching tab
                const aside = document.querySelector('aside');
                if (!aside) return 'no aside';
                const buttons = Array.from(aside.querySelectorAll('button'));
                for (const b of buttons) {{
                    const title = b.getAttribute('title') || '';
                    const text = b.textContent || '';
                    if (title.toLowerCase().includes('{tab_id}') || text.toLowerCase().includes('{tab_id}')) {{
                        b.click();
                        return 'clicked via match ' + (title || text);
                    }}
                }}
                // Fallback by index or text
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
                    'firewall': 'Firewall',
                    'utils': 'Utilities'
                }};
                const label = map['{tab_id}'] || '{tab_id}';
                for (const b of buttons) {{
                    if (b.textContent.includes(label)) {{
                        b.click();
                        return 'clicked via label ' + label;
                    }}
                }}
                return 'not found';
            }})()
        """)
        print(f"Tab click result: {res}")
        await asyncio.sleep(1.5)
        await client.screenshot(filename)

    # Also capture grid mode
    print("Switching to grid mode...")
    await client.evaluate("""
        (() => {
            const aside = document.querySelector('aside');
            const btns = Array.from(aside.querySelectorAll('button'));
            const hostsBtn = btns.find(b => b.textContent.includes('Hosts'));
            if (hostsBtn) hostsBtn.click();
        })()
    """)
    await asyncio.sleep(1)
    await client.evaluate("""
        (() => {
            const gridBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Grid'));
            if (gridBtn) gridBtn.click();
        })()
    """)
    await asyncio.sleep(1)
    await client.screenshot("02_hosts_metrics_grid.png")

    print("ALL 11 SCREENSHOTS CAPTURED!")

if __name__ == "__main__":
    asyncio.run(main())
