import threading
import time
import io
import sys
import os

import pygame
from PIL import ImageGrab
from google import genai
from google.genai import types

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = "AIzaSyBxSp8TBKcfvSN9OJ3uHdpMlQ8QQA2lpjs"
client = genai.Client(api_key=GEMINI_API_KEY)

# ── Constants ─────────────────────────────────────────────────────────────────
WIN_W, WIN_H = 110, 110
BG_COLOR      = (26, 26, 46)
BORDER_COLOR  = (80, 80, 120)
COLORS = {
    "?": (0, 255, 136),
    "A": (255, 107, 107),
    "B": (255, 217, 61),
    "C": (107, 203, 119),
    "D": (77, 150, 255),
    "!": (255, 68, 68),
    ".": (255, 255, 255),
}

# ── State ─────────────────────────────────────────────────────────────────────
state = {
    "answer": "?",
    "status": "Shift+A",
    "status_color": (136, 136, 136),
    "is_loading": False,
    "is_hidden": False,
    "dirty": True,   # redraw flag
}

def set_state(**kwargs):
    state.update(kwargs)
    state["dirty"] = True


# ── Screenshot + AI ───────────────────────────────────────────────────────────
def capture_and_ask():
    set_state(is_loading=True, answer=".", status="Thinking...", status_color=(255, 170, 0))
    time.sleep(0.2)  # let pygame hide the window first

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
            set_state(is_loading=False, answer=answer, status="Shift+A", status_color=(136, 136, 136))
        else:
            set_state(is_loading=False, answer="!", status="No answer", status_color=(255, 68, 68))

    except Exception as e:
        set_state(is_loading=False, answer="!", status=str(e)[:12], status_color=(255, 68, 68))


def trigger_screenshot():
    if state["is_loading"]:
        return
    threading.Thread(target=capture_and_ask, daemon=True).start()


# ── Hotkeys (pynput — no root needed on Mac) ──────────────────────────────────
def start_hotkeys(toggle_fn, quit_fn):
    def run():
        try:
            from pynput import keyboard as pynput_kb
            pressed = set()

            def on_press(key):
                try:
                    k = key.char.lower() if hasattr(key, 'char') and key.char else key
                except Exception:
                    k = key
                pressed.add(k)

                shift = (pynput_kb.Key.shift in pressed or pynput_kb.Key.shift_r in pressed)
                chars = {x for x in pressed if isinstance(x, str)}

                if shift and 'a' in chars:
                    trigger_screenshot()
                elif shift and 'z' in chars:
                    toggle_fn()

            def on_release(key):
                try:
                    k = key.char.lower() if hasattr(key, 'char') and key.char else key
                except Exception:
                    k = key
                pressed.discard(k)
                if key == pynput_kb.Key.f10:
                    quit_fn()

            with pynput_kb.Listener(on_press=on_press, on_release=on_release) as listener:
                listener.join()
        except Exception as e:
            set_state(answer="!", status="No hotkey", status_color=(255, 68, 68))

    threading.Thread(target=run, daemon=True).start()


# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    os.environ.setdefault("SDL_VIDEO_WINDOW_POS", "0,0")  # will be repositioned

    pygame.init()
    pygame.display.set_caption("ExamHelper")

    # Get screen size to position bottom-right
    info = pygame.display.Info()
    sw, sh = info.current_w, info.current_h
    win_x = sw - WIN_W - 20
    win_y = sh - WIN_H - 60

    os.environ["SDL_VIDEO_WINDOW_POS"] = f"{win_x},{win_y}"

    flags = pygame.NOFRAME
    screen = pygame.display.set_mode((WIN_W, WIN_H), flags)

    # Fonts
    font_big   = pygame.font.SysFont("Arial Black", 52, bold=True)
    font_small = pygame.font.SysFont("Arial", 11)

    clock = pygame.time.Clock()

    # Drag state
    dragging = False
    drag_offset = (0, 0)

    running = [True]

    def quit_app():
        running[0] = False

    def toggle_visibility():
        state["is_hidden"] = not state["is_hidden"]
        state["dirty"] = True
        if state["is_hidden"]:
            pygame.display.iconify()
        else:
            pygame.display.set_mode((WIN_W, WIN_H), flags)

    start_hotkeys(toggle_visibility, quit_app)

    while running[0]:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running[0] = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                dragging = True
                mx, my = pygame.mouse.get_pos()
                wx, wy = pygame.display.get_wm_info().get("window", (0, 0)), 0
                drag_offset = (mx, my)

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                dragging = False

            elif event.type == pygame.MOUSEMOTION and dragging:
                # Move window
                abs_x, abs_y = pygame.mouse.get_pos()
                # Use SDL to get window position
                try:
                    import ctypes
                    # Works on most platforms via SDL
                    pass
                except Exception:
                    pass

        if state["dirty"]:
            state["dirty"] = False

            # Background
            screen.fill(BG_COLOR)
            pygame.draw.rect(screen, BORDER_COLOR, (0, 0, WIN_W, WIN_H), 2)

            # Answer letter
            letter = state["answer"]
            color = COLORS.get(letter, (0, 255, 136))
            text_surf = font_big.render(letter, True, color)
            text_rect = text_surf.get_rect(center=(WIN_W // 2, WIN_H // 2 - 8))
            screen.blit(text_surf, text_rect)

            # Status text
            status_surf = font_small.render(state["status"], True, state["status_color"])
            status_rect = status_surf.get_rect(center=(WIN_W // 2, WIN_H - 12))
            screen.blit(status_surf, status_rect)

            pygame.display.flip()

        clock.tick(30)

    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()
