import threading
import time
import io
import sys
import os
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
    time.sleep(0.15)  # just enough for window to hide
    try:
        screenshot = ImageGrab.grab()

        # ── Resize to max 1280px wide before encoding — massively cuts upload time
        max_w = 1280
        if screenshot.width > max_w:
            ratio = max_w / screenshot.width
            new_h = int(screenshot.height * ratio)
            screenshot = screenshot.resize((max_w, new_h), 1)  # 1 = LANCZOS

        buf = io.BytesIO()
        # JPEG is 5-10x smaller than PNG — much faster to upload
        screenshot.save(buf, format="JPEG", quality=82, optimize=True)
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        payload = {
            "contents": [{
                "parts": [
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
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
        else:
            update_fn("?", "err")

    except Exception:
        update_fn("?", "err")
    finally:
        state["is_loading"] = False
        if not state["is_hidden"]:
            show_fn()


# ── UI ────────────────────────────────────────────────────────────────────────
def run_ui():
    import tkinter as tk

    root = tk.Tk()
    root.title("")
    root.overrideredirect(True)
    root.attributes("-alpha", 0.82)
    root.attributes("-topmost", True)

    if sys.platform == "darwin":
        try:
            root.tk.call("::tk::unsupported::MacWindowStyle", "style", root._w, "help", "noActivates")
        except Exception:
            pass

    if sys.platform == "win32":
        try:
            import ctypes
            root.update()
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            ctypes.windll.user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0002 | 0x0001)
        except Exception:
            pass

    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    W, H = 42, 42
    root.geometry(f"{W}x{H}+{sw - W - 12}+{sh - H - 50}")

    BG = "#2b2b2b"
    frame = tk.Frame(root, bg=BG, highlightbackground="#3a3a3a", highlightthickness=1)
    frame.pack(fill="both", expand=True)

    answer_lbl = tk.Label(frame, text="·",
                          font=("Helvetica", 15, "bold"),
                          fg="#4a4a4a", bg=BG)
    answer_lbl.pack(expand=True)

    # ── Drag ──────────────────────────────────────────────────────────────────
    drag = {"x": 0, "y": 0}
    def on_press(e):  drag["x"], drag["y"] = e.x, e.y
    def on_drag(e):
        root.geometry(f"+{root.winfo_x()+e.x-drag['x']}+{root.winfo_y()+e.y-drag['y']}")
    for w in (frame, answer_lbl):
        w.bind("<ButtonPress-1>", on_press)
        w.bind("<B1-Motion>", on_drag)

    COLORS = {
        "A": "#c0392b", "B": "#b7950b", "C": "#1e8449", "D": "#1a5276", "?": "#4a4a4a",
    }

    def update_ui(letter, mode):
        if mode == "ok":
            answer_lbl.config(text=letter, fg=COLORS.get(letter, "#aaaaaa"),
                              font=("Helvetica", 17, "bold"))
        else:
            answer_lbl.config(text="·", fg="#4a4a4a", font=("Helvetica", 15, "bold"))
        root.attributes("-topmost", True)
        root.lift()

    def show_win():
        def _show():
            root.deiconify()
            root.attributes("-topmost", True)
            root.lift()
        root.after(0, _show)

    def trigger(event=None):
        if state["is_loading"]:
            return
        state["is_loading"] = True
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

    # ── Tkinter hotkeys (always work, no permissions needed) ──────────────────
    root.bind("<Shift-a>", trigger)
    root.bind("<Shift-A>", trigger)
    root.bind("<Shift-z>", toggle)
    root.bind("<Shift-Z>", toggle)
    root.bind("<F10>", quit_app)

    # ── Global hotkeys via pynput (needs Accessibility permission) ────────────
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
            # pynput failed — open Accessibility settings so user can grant it
            if sys.platform == "darwin":
                import subprocess
                subprocess.Popen([
                    "open",
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
                ])
            # Show gear icon as hint that permission is needed
            root.after(0, lambda: answer_lbl.config(
                text="⚙", fg="#ffaa00", font=("Helvetica", 18, "bold")
            ))

    threading.Thread(target=start_global_hotkeys, daemon=True).start()

    # ── Keep on top loop ──────────────────────────────────────────────────────
    def keep_on_top():
        if not state["is_hidden"]:
            root.attributes("-topmost", True)
            root.lift()
            if sys.platform == "darwin":
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
