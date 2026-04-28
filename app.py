import threading
import time
import io
import sys
import os

from PIL import ImageGrab
from google import genai
from google.genai import types

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = "AIzaSyBxSp8TBKcfvSN9OJ3uHdpMlQ8QQA2lpjs"
client = genai.Client(api_key=GEMINI_API_KEY)

# ── State shared between threads ──────────────────────────────────────────────
state = {
    "is_loading": False,
    "is_hidden": False,
}

# ── AI capture (runs in background thread) ────────────────────────────────────
def capture_and_ask(update_fn, show_fn):
    time.sleep(0.25)  # wait for window to hide
    try:
        screenshot = ImageGrab.grab()
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        buf.seek(0)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=buf.getvalue(), mime_type="image/png"),
                "Look at this exam/quiz question screenshot. "
                "Reply with ONLY a single letter: A, B, C, or D — the correct answer. "
                "No explanation, no punctuation, just one letter."
            ]
        )
        answer = next((c for c in response.text.strip().upper() if c in "ABCD"), None)
        if answer:
            update_fn(answer, "Shift+A", "ok")
        else:
            update_fn("!", "No answer", "err")
    except Exception as e:
        update_fn("!", str(e)[:12], "err")
    finally:
        state["is_loading"] = False
        if not state["is_hidden"]:
            show_fn()


# ── UI using tkinter from the correct Python ──────────────────────────────────
def run_ui():
    import tkinter as tk

    root = tk.Tk()
    root.title("ExamHelper")
    root.attributes("-topmost", True)
    root.attributes("-alpha", 0.92)
    root.overrideredirect(True)

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

    # Drag
    drag = {"x": 0, "y": 0}
    def on_press(e):  drag["x"], drag["y"] = e.x, e.y
    def on_drag(e):
        root.geometry(f"+{root.winfo_x()+e.x-drag['x']}+{root.winfo_y()+e.y-drag['y']}")
    for w in (frame, answer_lbl, status_lbl):
        w.bind("<ButtonPress-1>", on_press)
        w.bind("<B1-Motion>", on_drag)

    COLORS = {"A":"#ff6b6b","B":"#ffd93d","C":"#6bcb77","D":"#4d96ff",
              "!":"#ff4444","?":"#00ff88",".":"#ffffff"}

    def update_ui(letter, status, mode):
        answer_lbl.config(text=letter, fg=COLORS.get(letter, "#00ff88"))
        status_lbl.config(
            text=status,
            fg="#888888" if mode == "ok" else "#ff4444"
        )

    def show_win():
        root.after(0, root.deiconify)

    def trigger():
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

    def toggle():
        if state["is_hidden"]:
            state["is_hidden"] = False
            root.deiconify()
        else:
            state["is_hidden"] = True
            root.withdraw()

    def quit_app():
        root.destroy()
        sys.exit(0)

    # Hotkeys via pynput
    def start_hotkeys():
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

            with K.Listener(on_press=on_press_key, on_release=on_release_key) as l:
                l.join()
        except Exception as e:
            root.after(0, lambda: status_lbl.config(text="No hotkey", fg="#ff4444"))

    threading.Thread(target=start_hotkeys, daemon=True).start()

    root.mainloop()


if __name__ == "__main__":
    run_ui()
