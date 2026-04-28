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
API_KEY = "AIzaSyD9v434GoGGy0Zpfp8iYtxMI-AFJLhzx60"
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
PROMPT  = (
    "Look at this exam/quiz question screenshot. "
    "Reply with ONLY a single letter: A, B, C, or D — the correct answer. "
    "No explanation, no punctuation, just one letter."
)

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
                update_fn(answer, "Shift+A", "ok")
            else:
                update_fn("!", "No answer", "err")
        elif "error" in data:
            code = data["error"].get("code", "?")
            update_fn("!", f"Err {code}", "err")
        else:
            update_fn("!", "Bad resp", "err")

    except Exception as e:
        update_fn("!", str(e)[:12], "err")
    finally:
        state["is_loading"] = False
        if not state["is_hidden"]:
            show_fn()


# ── UI ────────────────────────────────────────────────────────────────────────
def run_ui():
    import tkinter as tk

    root = tk.Tk()
    root.title("ExamHelper")
    root.overrideredirect(True)
    root.attributes("-alpha", 0.92)
    root.attributes("-topmost", True)

    try:
        root.tk.call("::tk::unsupported::MacWindowStyle", "style", root._w, "help", "noActivates")
    except Exception:
        pass

    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    W, H = 110, 110
    root.geometry(f"{W}x{H}+{sw - W - 20}+{sh - H - 60}")

    frame = tk.Frame(root, bg="#1a1a2e", bd=2, relief="solid")
    frame.pack(fill="both", expand=True)

    answer_lbl = tk.Label(frame, text="?",
                          font=("Arial Black", 52, "bold"),
                          fg="#00ff88", bg="#1a1a2e")
    answer_lbl.pack(expand=True)

    status_lbl = tk.Label(frame, text="Shift+A",
                          font=("Arial", 9),
                          fg="#888888", bg="#1a1a2e")
    status_lbl.pack(pady=(0, 6))

    # ── Drag ──────────────────────────────────────────────────────────────────
    drag = {"x": 0, "y": 0}
    def on_press(e):  drag["x"], drag["y"] = e.x, e.y
    def on_drag(e):
        root.geometry(f"+{root.winfo_x()+e.x-drag['x']}+{root.winfo_y()+e.y-drag['y']}")
    for w in (frame, answer_lbl, status_lbl):
        w.bind("<ButtonPress-1>", on_press)
        w.bind("<B1-Motion>", on_drag)

    COLORS = {
        "A": "#ff6b6b", "B": "#ffd93d", "C": "#6bcb77", "D": "#4d96ff",
        "!": "#ff4444", "?": "#00ff88", ".": "#ffffff"
    }

    def update_ui(letter, status, mode):
        answer_lbl.config(text=letter, fg=COLORS.get(letter, "#00ff88"))
        status_lbl.config(text=status, fg="#888888" if mode == "ok" else "#ff4444")
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
        answer_lbl.config(text="...", fg="#ffffff")
        status_lbl.config(text="Thinking...", fg="#ffaa00")
        root.withdraw()
        threading.Thread(
            target=capture_and_ask,
            args=(lambda l, s, m: root.after(0, lambda: update_ui(l, s, m)), show_win),
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

    # ── Tkinter hotkeys ───────────────────────────────────────────────────────
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
            root.after(0, lambda: status_lbl.config(text="Click+Shft+A", fg="#ffaa00"))

    threading.Thread(target=start_global_hotkeys, daemon=True).start()

    # ── Keep on top loop ──────────────────────────────────────────────────────
    def keep_on_top():
        if not state["is_hidden"]:
            root.attributes("-topmost", True)
            root.lift()
        root.after(1000, keep_on_top)

    root.after(500, keep_on_top)
    root.mainloop()


if __name__ == "__main__":
    run_ui()
