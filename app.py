import threading
import time
import io
import sys
import os
import json
import base64

import requests
from PIL import ImageGrab

# ── Config ────────────────────────────────────────────────────────────────────
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
PROMPT  = (
    "Look at this exam/quiz question screenshot. "
    "Reply with ONLY a single letter: A, B, C, or D — the correct answer. "
    "No explanation, no punctuation, just one letter."
)

_k = ["QUl6YVN5Q0lhZ", "DcxLTV1VWFabT", "NaM2tUbnRMc2c", "1UzVGbWlZRzZz"]
API_KEY = base64.b64decode("".join(_k)).decode()

state = {
    "is_loading": False,
    "is_hidden": False,
}

# ── AI capture ────────────────────────────────────────────────────────────────
def capture_and_ask(update_fn, show_fn):
    time.sleep(0.25)
    try:
        screenshot = ImageGrab.grab()
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        payload = {
            "contents": [{
                "parts": [
                    {"inline_data": {"mime_type": "image/png", "data": img_b64}},
                    {"text": PROMPT}
                ]
            }]
        }
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": API_KEY,
        }

        resp = requests.post(API_URL, headers=headers, json=payload, timeout=30)
        data = resp.json()

        if "candidates" in data:
            raw = data["candidates"][0]["content"]["parts"][0]["text"].strip().upper()
            answer = next((c for c in raw if c in "ABCD"), None)
            if answer:
                update_fn(answer, "ok")
            else:
                update_fn("?", "err")
        elif "error" in data:
            update_fn("?", "err")
        else:
            update_fn("?", "err")

    except Exception as e:
        update_fn("?", "err")
    finally:
        state["is_loading"] = False
        if not state["is_hidden"]:
            show_fn()


# ── Force above fullscreen on macOS via applescript ──────────────────────────
def mac_force_front(win_id):
    """Use osascript to bring window above fullscreen spaces on macOS."""
    try:
        import subprocess
        subprocess.Popen([
            "osascript", "-e",
            'tell application "System Events" to set frontmost of every process whose unix id is '
            + str(os.getpid()) + " to true"
        ])
    except Exception:
        pass


# ── UI ────────────────────────────────────────────────────────────────────────
def run_ui():
    import tkinter as tk

    root = tk.Tk()
    root.title("")  # no title — less noticeable in window switcher
    root.overrideredirect(True)
    root.attributes("-alpha", 0.82)
    root.attributes("-topmost", True)

    # ── macOS: set window level to "screen saver" level (above fullscreen) ───
    if sys.platform == "darwin":
        try:
            # NSScreenSaverWindowLevel = 1000, above fullscreen spaces
            root.tk.call("::tk::unsupported::MacWindowStyle", "style", root._w, "help", "noActivates")
            # Use ctypes to set CGWindowLevel above fullscreen
            import ctypes, ctypes.util
            appkit = ctypes.cdll.LoadLibrary(ctypes.util.find_library("AppKit"))
        except Exception:
            pass

    # ── Windows: use HWND_TOPMOST which works over fullscreen too ─────────────
    if sys.platform == "win32":
        try:
            import ctypes
            root.update()
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            HWND_TOPMOST = -1
            SWP_NOMOVE = 0x0002
            SWP_NOSIZE = 0x0001
            ctypes.windll.user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
        except Exception:
            pass

    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()

    # ── Tiny, stealthy size ───────────────────────────────────────────────────
    W, H = 42, 42
    root.geometry(f"{W}x{H}+{sw - W - 12}+{sh - H - 50}")

    # ── Stealth UI: looks like a tiny system indicator dot ───────────────────
    # Dark grey bg — blends with most taskbars/corners
    BG = "#2b2b2b"

    frame = tk.Frame(root, bg=BG, bd=1, relief="flat",
                     highlightbackground="#3a3a3a", highlightthickness=1)
    frame.pack(fill="both", expand=True)

    # Single label — small, muted, looks like a clock widget or battery indicator
    answer_lbl = tk.Label(
        frame,
        text="·",
        font=("Helvetica", 15, "bold"),
        fg="#4a4a4a",   # very muted when idle — barely visible
        bg=BG
    )
    answer_lbl.pack(expand=True)

    # ── Drag ──────────────────────────────────────────────────────────────────
    drag = {"x": 0, "y": 0}
    def on_press(e):  drag["x"], drag["y"] = e.x, e.y
    def on_drag(e):
        root.geometry(f"+{root.winfo_x()+e.x-drag['x']}+{root.winfo_y()+e.y-drag['y']}")
    for w in (frame, answer_lbl):
        w.bind("<ButtonPress-1>", on_press)
        w.bind("<B1-Motion>", on_drag)

    # Answer colors — bright only when answer is shown, muted otherwise
    COLORS = {
        "A": "#c0392b",  # muted red
        "B": "#b7950b",  # muted yellow
        "C": "#1e8449",  # muted green
        "D": "#1a5276",  # muted blue
        "?": "#4a4a4a",  # invisible idle
    }

    def update_ui(letter, mode):
        if mode == "ok":
            answer_lbl.config(
                text=letter,
                fg=COLORS.get(letter, "#aaaaaa"),
                font=("Helvetica", 17, "bold")
            )
        else:
            # error — just show dot again, no red flash
            answer_lbl.config(text="·", fg="#4a4a4a", font=("Helvetica", 15, "bold"))
        root.attributes("-topmost", True)
        root.lift()

    def show_win():
        def _show():
            root.deiconify()
            root.attributes("-topmost", True)
            root.lift()
            if sys.platform == "darwin":
                mac_force_front(os.getpid())
        root.after(0, _show)

    def trigger(event=None):
        if state["is_loading"]:
            return
        state["is_loading"] = True
        # Loading: show a tiny spinner-like dot animation
        answer_lbl.config(text="·", fg="#555555", font=("Helvetica", 15, "bold"))
        root.withdraw()
        threading.Thread(
            target=capture_and_ask,
            args=(lambda l, m: root.after(0, lambda: update_ui(l, m)), show_win),
            daemon=True
        ).start()

    def toggle(event=None):
        if state["is_hidden"]:
            state["is_hidden"] = False
            root.deiconify()
            root.attributes("-topmost", True)
            root.lift()
        else:
            state["is_hidden"] = True
            root.withdraw()

    def quit_app(event=None):
        root.destroy()
        sys.exit(0)

    # ── Tkinter hotkeys (when window focused) ─────────────────────────────────
    root.bind("<Shift-a>", trigger)
    root.bind("<Shift-A>", trigger)
    root.bind("<Shift-z>", toggle)
    root.bind("<Shift-Z>", toggle)
    root.bind("<F10>", quit_app)

    # ── Global hotkeys via pynput ─────────────────────────────────────────────
    def start_global_hotkeys():
        try:
            from pynput import keyboard as K
            pressed = set()

            def on_press_key(key):
                try:    k = key.char.lower() if key.char else key
                except: k = key
                pressed.add(k)
                shift = K.Key.shift in pressed or K.Key.shift_r in pressed
                chars = {x for x in pressed if isinstance(x, str)}
                if shift and 'a' in chars:
                    root.after(0, trigger)
                elif shift and 'z' in chars:
                    root.after(0, toggle)

            def on_release_key(key):
                try:    k = key.char.lower() if key.char else key
                except: k = key
                pressed.discard(k)
                if key == K.Key.f10:
                    root.after(0, quit_app)

            with K.Listener(on_press=on_press_key, on_release=on_release_key) as listener:
                listener.join()
        except Exception:
            pass  # silent — no visible error, just use tkinter bindings

    threading.Thread(target=start_global_hotkeys, daemon=True).start()

    # ── Keep on top — re-assert every 800ms ───────────────────────────────────
    def keep_on_top():
        if not state["is_hidden"]:
            root.attributes("-topmost", True)
            root.lift()
            if sys.platform == "darwin":
                # Re-apply mac window style to stay above fullscreen
                try:
                    root.tk.call("::tk::unsupported::MacWindowStyle",
                                 "style", root._w, "help", "noActivates")
                except Exception:
                    pass
        root.after(800, keep_on_top)

    root.after(500, keep_on_top)
    root.mainloop()


if __name__ == "__main__":
    run_ui()
