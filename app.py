import tkinter as tk
import threading
import time
import io
import sys
import os
import subprocess

from PIL import ImageGrab
import google.generativeai as genai

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = "AIzaSyBxSp8TBKcfvSN9OJ3uHdpMlQ8QQA2lpjs"

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")


# ── Overlay ───────────────────────────────────────────────────────────────────
class OverlayApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ExamHelper")
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", 0.92)
        self.root.overrideredirect(True)

        # Bottom-right corner
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        w, h = 110, 110
        self.root.geometry(f"{w}x{h}+{sw - w - 20}+{sh - h - 60}")

        self.frame = tk.Frame(self.root, bg="#1a1a2e", bd=2, relief="solid")
        self.frame.pack(fill="both", expand=True)

        self.answer_label = tk.Label(
            self.frame, text="?",
            font=("Arial Black", 52, "bold"),
            fg="#00ff88", bg="#1a1a2e"
        )
        self.answer_label.pack(expand=True)

        self.status_label = tk.Label(
            self.frame, text="Shift+A",
            font=("Arial", 9), fg="#888888", bg="#1a1a2e"
        )
        self.status_label.pack(pady=(0, 6))

        for w in (self.frame, self.answer_label, self.status_label):
            w.bind("<ButtonPress-1>", self.start_drag)
            w.bind("<B1-Motion>", self.do_drag)

        self.is_loading = False
        self.is_hidden = False
        self._drag_x = self._drag_y = 0

        # Start hotkey listener in background thread
        threading.Thread(target=self.listen_hotkeys, daemon=True).start()

        self.root.protocol("WM_DELETE_WINDOW", self.quit_app)
        self.root.mainloop()

    # ── Drag ──────────────────────────────────────────────────────────────────
    def start_drag(self, event):
        self._drag_x = event.x
        self._drag_y = event.y

    def do_drag(self, event):
        x = self.root.winfo_x() + event.x - self._drag_x
        y = self.root.winfo_y() + event.y - self._drag_y
        self.root.geometry(f"+{x}+{y}")

    # ── UI state ──────────────────────────────────────────────────────────────
    def set_answer(self, letter):
        colors = {"A": "#ff6b6b", "B": "#ffd93d", "C": "#6bcb77", "D": "#4d96ff"}
        self.answer_label.config(text=letter.upper(), fg=colors.get(letter.upper(), "#00ff88"))
        self.status_label.config(text="Shift+A", fg="#888888")
        self.is_loading = False

    def set_loading(self):
        self.is_loading = True
        self.answer_label.config(text="...", fg="#ffffff")
        self.status_label.config(text="Thinking...", fg="#ffaa00")

    def set_error(self, msg="ERR"):
        self.answer_label.config(text="!", fg="#ff4444")
        self.status_label.config(text=msg[:12], fg="#ff4444")
        self.is_loading = False

    def toggle_visibility(self):
        if self.is_hidden:
            self.root.deiconify()
            self.is_hidden = False
        else:
            self.root.withdraw()
            self.is_hidden = True

    # ── Hotkeys ───────────────────────────────────────────────────────────────
    def listen_hotkeys(self):
        try:
            import keyboard
            keyboard.add_hotkey("shift+a", self.trigger_screenshot)
            keyboard.add_hotkey("shift+z", lambda: self.root.after(0, self.toggle_visibility))
            keyboard.add_hotkey("f10", self.quit_app)
            keyboard.wait()
        except Exception as e:
            # keyboard needs root on Mac — fall back to pynput
            self.listen_hotkeys_pynput()

    def listen_hotkeys_pynput(self):
        try:
            from pynput import keyboard as pynput_kb

            pressed = set()

            def on_press(key):
                try:
                    pressed.add(key.char.lower() if hasattr(key, 'char') and key.char else key)
                except Exception:
                    pressed.add(key)

                shift = pynput_kb.Key.shift in pressed or pynput_kb.Key.shift_r in pressed
                char = next((k for k in pressed if isinstance(k, str)), None)

                if shift and char == 'a':
                    self.trigger_screenshot()
                elif shift and char == 'z':
                    self.root.after(0, self.toggle_visibility)

            def on_release(key):
                try:
                    pressed.discard(key.char.lower() if hasattr(key, 'char') and key.char else key)
                except Exception:
                    pressed.discard(key)
                if key == pynput_kb.Key.f10:
                    self.quit_app()

            with pynput_kb.Listener(on_press=on_press, on_release=on_release) as listener:
                listener.join()
        except Exception as e:
            self.root.after(0, lambda: self.set_error("No hotkey"))

    # ── Screenshot + AI ───────────────────────────────────────────────────────
    def trigger_screenshot(self):
        if self.is_loading:
            return
        self.root.after(0, self.set_loading)
        threading.Thread(target=self.capture_and_ask, daemon=True).start()

    def capture_and_ask(self):
        try:
            # Hide overlay so it's not in the screenshot
            self.root.after(0, lambda: self.root.withdraw())
            time.sleep(0.2)

            screenshot = ImageGrab.grab()

            if not self.is_hidden:
                self.root.after(0, lambda: self.root.deiconify())

            buf = io.BytesIO()
            screenshot.save(buf, format="PNG")

            response = model.generate_content([
                {
                    "mime_type": "image/png",
                    "data": buf.getvalue()
                },
                (
                    "Look at this exam/quiz question screenshot. "
                    "Reply with ONLY a single letter: A, B, C, or D — the correct answer. "
                    "No explanation, no punctuation, just one letter."
                )
            ])

            answer = next((c for c in response.text.strip().upper() if c in "ABCD"), None)

            if answer:
                self.root.after(0, lambda: self.set_answer(answer))
            else:
                self.root.after(0, lambda: self.set_error("No ans"))

        except Exception as e:
            msg = str(e)[:10]
            self.root.after(0, lambda: self.set_error(msg))

    # ── Quit ──────────────────────────────────────────────────────────────────
    def quit_app(self):
        try:
            self.root.destroy()
        except Exception:
            pass
        sys.exit(0)


if __name__ == "__main__":
    OverlayApp()
