# Local browser end-to-end tests (Python Playwright + Chromium). No network,
# no real email: tests/browser/mini-pages.mjs runs the real Functions with
# the email provider stubbed. Run: python3 tests/browser/<file>.py
import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
site = os.path.abspath(os.path.join(HERE, "..", ".."))
env = json.dumps({"RESEND_API_KEY": "re_stub_not_real", "MM_ENQUIRY_NOTIFICATION_EMAIL": "staff@example.test"})
srv = subprocess.Popen(["node", os.path.join(HERE, "mini-pages.mjs"), site, "8791", env], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
srv.stdout.readline()
base = "http://127.0.0.1:8791"
results = []
def check(name, ok): results.append((name, bool(ok))); print(("PASS " if ok else "FAIL ") + name)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vp_name, vp in (("desktop", {"width": 1366, "height": 900}), ("mobile", {"width": 390, "height": 844})):
            for page_name, extra in (("contact.html", {}), ("employers.html", {"company": "Acme Ltd"})):
                ctx = b.new_context(viewport=vp, is_mobile=vp_name == "mobile"); pg = ctx.new_page(); errs = []
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                pg.goto(f"{base}/{page_name}", wait_until="load"); pg.wait_for_timeout(300)
                form = pg.locator("form[data-enquiry-form]")
                # 1. empty submit -> server validation message shown, nothing sent
                form.locator("button[type=submit]").click(); pg.wait_for_timeout(500)
                msg = form.locator(".form-message").inner_text()
                check(f"{vp_name} {page_name}: empty form shows validation error", "fill in" in msg.lower() or "please" in msg.lower())
                # 2. valid submit -> success, one email
                form.locator("input[name=name]").fill("E2E Test")
                form.locator("input[name=email]").fill("e2e@example.test")
                for k, v in extra.items():
                    loc = form.locator(f"[name={k}]")
                    if loc.count(): loc.fill(v)
                form.locator("textarea[name=message]").fill("Synthetic end-to-end test enquiry.")
                form.locator("input[name=consent]").check()
                before = len(json.loads(urllib.request.urlopen(base + "/__outbox").read()))
                form.locator("button[type=submit]").click(); pg.wait_for_timeout(800)
                msg = form.locator(".form-message").inner_text()
                after = json.loads(urllib.request.urlopen(base + "/__outbox").read())
                check(f"{vp_name} {page_name}: valid enquiry shows success", "thank you" in msg.lower())
                check(f"{vp_name} {page_name}: exactly one email relayed to staff", len(after) == before + 1 and after[-1]["to"] == ["staff@example.test"] and after[-1]["reply_to"] == "e2e@example.test")
                check(f"{vp_name} {page_name}: no Turnstile widget when not configured", pg.locator(".form-turnstile").count() == 0)
                csp = [e for e in errs if "Content Security Policy" in e]
                check(f"{vp_name} {page_name}: no CSP violations / console errors", not csp and not [e for e in errs if "fonts.g" not in e and "ERR_TUNNEL" not in e and "status of 400" not in e])
                ctx.close()
        b.close()
finally:
    srv.terminate()
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} browser checks passed")
sys.exit(1 if failed else 0)
