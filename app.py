import threading
import time
import io
import sys
import os
import base64

import requests
from PIL import ImageGrab

# ── Config ────────────────────────────────────────────────────────────────────
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
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

# ── Set window above SEB on macOS using Cocoa NSWindow level ──────────────────
def mac_set_topmZZost(root):
    """Set window to kCGScreenSaverWindowLevel (1000) — above SEB's kiosk level."""
    try:
        import ctypes, ctypes.util
        # Load AppKit
        appkit = ctypes.cdll.LoadLibrary(ctypes.util.find_library("AppKit"))
        objc   = ctypes.cdll.LoadLibrary(ctypes.util.find_library("objc"))

        objc.objc_getClass.restype        = ctypes.c_void_p
        objc.sel_registerName.restype     = ctypes.c_void_p
        objc.objc_msgSend.restype         = ctypes.c_void_p
        objc.objc_msgSend.argtypes        = [ctypes.c_void_p, ctypes.c_void_p]

        # Get the NSWindow from the Tk window ID
        root.update()
        wid = root.winfo_id()

        # Use NSApp windows to find our window and set level
        NSApp_class = objc.objc_getClass(b"NSApplication")
        sel_shared  = objc.sel_registerName(b"sharedApplication")
        nsapp       = objc.objc_msgSend(NSApp_class, sel_shared)

        sel_windows = objc.sel_registerName(b"windows")
        windows     = objc.objc_msgSend(nsapp, sel_windows)

        sel_count   = objc.sel_registerName(b"count")
        objc.objc_msgSend.restype = ctypes.c_ulong
        count = objc.objc_msgSend(windows, sel_count)
        objc.objc_msgSend.restype = ctypes.c_void_p

        sel_obj_at  = objc.sel_registerName(b"objectAtIndex:")
        sel_set_lvl = objc.sel_registerName(b"setLevel:")

        # kCGScreenSaverWindowLevel = 1000 (above everything including SEB)
        LEVEL = 1000

        for i in range(count):
            objc.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
            win = objc.objc_msgSend(windows, sel_obj_at, i)
            objc.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_long]
            objc.objc_msgSend(win, sel_set_lvl, LEVEL)

        # Also set collection behavior to show on all spaces including fullscreen
        sel_coll    = objc.sel_registerName(b"setCollectionBehavior:")
        # NSWindowCollectionBehaviorCanJoinAllSpaces (1) | NSWindowCollectionBehaviorStationary (16)
        for i in range(count):
            objc.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
            win = objc.objc_msgSend(windows, sel_obj_at, i)
            objc.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
            objc.objc_msgSend(win, sel_coll, 1 | 16)

    except Exception as e:
        pass  # fallback to tkinter topmost


# ── AI capture ────────────────────────────────────────────────────────────────
def capture_and_ask(update_fn, show_fn):
    time.sleep(0.15)
    try:
        print("[*] Taking screenshot...")
        screenshot = ImageGrab.grab()
        print(f"[*] Screenshot: {screenshot.size}")

        max_w = 1280
        if screenshot.width > max_w:
            ratio = max_w / screenshot.width
            screenshot = screenshot.resize((max_w, int(screenshot.height * ratio)), 1)

        buf = io.BytesIO()
        screenshot.convert("RGB").save(buf, format="JPEG", quality=82, optimize=True)
        img_b64 = base64.b64encode(buf.getvalue()).decode()
        print(f"[*] Sending {len(img_b64)//1024}KB to Gemini...")

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
        print(f"[*] Raw response: {data}")

        if "candidates" in data:
            raw = data["candidates"][0]["content"]["parts"][0]["text"].strip().upper()
            answer = next((c for c in raw if c in "ABCD"), None)
            print(f"[*] Answer: {answer}")
            if answer:
                update_fn(answer, "ok")
            else:
                update_fn("?", "err")
        else:
            print(f"[!] No candidates in response")
            update_fn("?", "err")

    except Exception as e:
        print(f"[!] Exception: {e}")
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
            # Hide from taskbar: set WS_EX_TOOLWINDOW, remove WS_EX_APPWINDOW
            root.update()
            hwnd = ctypes.windll.user32.GetParent(root.winfo_id())
            GWL_EXSTYLE    = -20
            WS_EX_TOOLWINDOW = 0x00000080
            WS_EX_APPWINDOW  = 0x00040000
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            style = (style | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW
            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
            # Also set always on top
            HWND_TOPMOST = -1
            ctypes.windll.user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, 0x0002 | 0x0001)
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
        if sys.platform == "darwin":
            mac_set_topmost(root)

    def show_win():
        def _show():
            root.deiconify()
            root.attributes("-topmost", True)
            root.lift()
            if sys.platform == "darwin":
                mac_set_topmost(root)
        root.after(0, _show)

    def trigger(event=None):
        if state["is_loading"]:
            return
        state["is_loading"] = True
        # Show "..." while working — don't hide the window
        answer_lbl.config(text="...", fg="#888888", font=("Helvetica", 11, "bold"))
        # Hide briefly just for the screenshot, then come back
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
            if sys.platform == "darwin":
                mac_set_topmost(root)
        else:
            state["is_hidden"] = True
            root.withdraw()

    def quit_app(event=None):
        root.destroy()
        sys.exit(0)

    root.bind("<Shift-a>", trigger)
    root.bind("<Shift-A>", trigger)
    root.bind("<Shift-z>", toggle)
    root.bind("<Shift-Z>", toggle)
    root.bind("<F10>", quit_app)

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
            pass

    threading.Thread(target=start_global_hotkeys, daemon=True).start()

    # ── Set high window level on macOS after UI is ready ─────────────────────
    def init_topmost():
        root.attributes("-topmost", True)
        root.lift()
        if sys.platform == "darwin":
            mac_set_topmost(root)

    root.after(300, init_topmost)

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
