# Local browser end-to-end tests (Python Playwright + Chromium). No network,
# no real email: tests/browser/mini-pages.mjs runs the real Functions with
# the email provider stubbed. Run: python3 tests/browser/<file>.py
import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json, subprocess, sys, urllib.request
from playwright.sync_api import sync_playwright
env = json.dumps({"RESEND_API_KEY": "re_stub", "MM_ENQUIRY_NOTIFICATION_EMAIL": "staff@example.test",
                  "TURNSTILE_SITE_KEY": "1x00000000000000000000AA", "TURNSTILE_SECRET_KEY": "1x0000000000000000000000000000000AA"})
srv = subprocess.Popen(["node", os.path.join(HERE, "mini-pages.mjs"), os.path.abspath(os.path.join(HERE, "..", "..")), "8792", env], stdout=subprocess.PIPE, text=True)
srv.stdout.readline(); base = "http://127.0.0.1:8792"
FAKE = """window.turnstile={_n:0,render:function(el,o){window.__tsOpts=o;var d=document.createElement('iframe');d.src='https://challenges.cloudflare.com/x';el.appendChild(d);return 'w'+(this._n++);},
getResponse:function(){return window.__tsToken||'';},reset:function(){window.__tsResets=(window.__tsResets||0)+1;}};
setTimeout(function(){window.mmTurnstileLoaded&&window.mmTurnstileLoaded();},0);"""
ok = []
def check(n, c): ok.append(c); print(("PASS " if c else "FAIL ") + n)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        ctx.route("https://challenges.cloudflare.com/turnstile/**", lambda r: r.fulfill(status=200, content_type="text/javascript", body=FAKE))
        ctx.route("https://challenges.cloudflare.com/x", lambda r: r.fulfill(status=200, content_type="text/html", body="<p>widget</p>"))
        sv = []
        ctx.route("https://challenges.cloudflare.com/turnstile/v0/siteverify", lambda r: r.fulfill(status=200, body="{}"))
        pg = ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(base + "/contact.html", wait_until="load"); pg.wait_for_timeout(800)
        check("widget slot rendered when both keys configured", pg.locator(".form-turnstile iframe").count() == 1)
        check("widget rendered with action 'enquiry' and the public site key", pg.evaluate("window.__tsOpts && window.__tsOpts.action==='enquiry' && window.__tsOpts.sitekey==='1x00000000000000000000AA'"))
        f = pg.locator("form[data-enquiry-form]")
        f.locator("input[name=name]").fill("E2E"); f.locator("input[name=email]").fill("e2e@example.test")
        f.locator("textarea[name=message]").fill("hello"); f.locator("input[name=consent]").check()
        f.locator("button[type=submit]").click(); pg.wait_for_timeout(800)
        check("without a solved challenge the server refuses (verification message shown)", "verification" in f.locator(".form-message").inner_text().lower())
        check("widget reset after the attempt (tokens are single-use)", pg.evaluate("window.__tsResets") == 1)
        check("no CSP violation for the Turnstile script or iframe", not [e for e in errs if "Content Security Policy" in e])
        b.close()
finally:
    srv.terminate()
print(f"{sum(ok)}/{len(ok)} passed"); sys.exit(0 if all(ok) else 1)
