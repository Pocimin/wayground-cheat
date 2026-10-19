// ==UserScript==
// @name         Hack Wayground
// @author       Anonymous
// @description  Hack Wayground V2 - Smart Solver & Auto Answer
// @namespace    http://tampermonkey.net/
// @match        https://wayground.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_addStyle
// @run-at       document-start
// @icon         https://blackarch.org/images/logo/ba-logo.png
// @version      4.6.0
// @downloadURL  https://raw.githubusercontent.com/AtelierMizumi/wayground-tool/main/wayground-script.user.js
// @updateURL    https://raw.githubusercontent.com/AtelierMizumi/wayground-tool/main/wayground-script.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const targetWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const targetDoc = targetWindow.document || document;

    // ==========================================
    // 1. ANTI-CHEAT DEFENSE & TAB-SWITCH PROTECTION
    // Prevents Quizizz / Wayground from logging "Tab Switch" alerts to teacher
    // ==========================================
    try {
        Object.defineProperty(targetDoc, 'hidden', {
            get: () => false,
            configurable: true
        });
        Object.defineProperty(targetDoc, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });
        Object.defineProperty(targetDoc, 'webkitHidden', {
            get: () => false,
            configurable: true
        });
        Object.defineProperty(targetDoc, 'webkitVisibilityState', {
            get: () => 'visible',
            configurable: true
        });
        targetDoc.hasFocus = () => true;
    } catch (e) {}

    // ==========================================
    // 2. KEYBOARD PROTECTION & INPUT ISOLATION
    // Prevents page shortcuts/traps from suppressing typing in tool inputs
    // ==========================================
    const isToolElement = (el) => {
        if (!el) return false;
        try {
            if (el.nodeType !== 1) el = el.parentElement;
            if (!el) return false;
            return !!(
                el.id === 'key-input' ||
                el.id === 'pin-input' ||
                el.id === 'wg-speed-input' ||
                el.id === 'wg-sheet-search' ||
                el.id === 'solver-panel' ||
                el.id === 'solver-mini-icon' ||
                el.id === 'wg-cheatsheet-modal' ||
                el.hasAttribute('data-wg-tool') ||
                (el.closest && (el.closest('#solver-panel') || el.closest('#solver-mini-icon') || el.closest('#wg-cheatsheet-modal') || el.closest('[data-wg-tool]')))
            );
        } catch (e) {
            return false;
        }
    };

    const origAddEventListener = targetWindow.EventTarget.prototype.addEventListener;
    const origRemoveEventListener = targetWindow.EventTarget.prototype.removeEventListener;
    const listenerWrapperMap = new WeakMap();

    // 2.1 Monkey-patch EventTarget.addEventListener & removeEventListener
    try {
        targetWindow.EventTarget.prototype.addEventListener = function (type, listener, options) {
            // Anti-cheat tab-switch blocker: suppress visibilitychange & window blur from host page
            if (['visibilitychange', 'webkitvisibilitychange'].includes(type)) {
                return;
            }
            if (['blur', 'focusout'].includes(type) && (this === targetWindow || this === targetDoc)) {
                return;
            }

            if (typeof listener === 'function' && ['keydown', 'keyup', 'keypress', 'beforeinput', 'input'].includes(type)) {
                if (isToolElement(this)) {
                    return origAddEventListener.call(this, type, listener, options);
                }
                let wrappedListener = listenerWrapperMap.get(listener);
                if (!wrappedListener) {
                    wrappedListener = function (event) {
                        if (isToolElement(event.target) || (event.composedPath && event.composedPath().some(isToolElement))) {
                            return; // Bypass host page key listener when inside tool
                        }
                        return listener.apply(this, arguments);
                    };
                    listenerWrapperMap.set(listener, wrappedListener);
                }
                return origAddEventListener.call(this, type, wrappedListener, options);
            }
            return origAddEventListener.call(this, type, listener, options);
        };

        targetWindow.EventTarget.prototype.removeEventListener = function (type, listener, options) {
            if (typeof listener === 'function' && ['keydown', 'keyup', 'keypress', 'beforeinput', 'input'].includes(type)) {
                const wrappedListener = listenerWrapperMap.get(listener) || listener;
                return origRemoveEventListener.call(this, type, wrappedListener, options);
            }
            return origRemoveEventListener.call(this, type, listener, options);
        };
    } catch (e) {
        console.warn('[Wayground Tool] addEventListener patch failed:', e);
    }

    // 2.2 Monkey-patch Event.prototype.preventDefault & KeyboardEvent.prototype.preventDefault
    try {
        const origPreventDefault = targetWindow.Event.prototype.preventDefault;
        targetWindow.Event.prototype.preventDefault = function () {
            if (isToolElement(this.target) || (this.composedPath && this.composedPath().some(isToolElement))) {
                return; // Disallow suppressing native typing in tool inputs
            }
            return origPreventDefault.apply(this, arguments);
        };
        if (targetWindow.KeyboardEvent && targetWindow.KeyboardEvent.prototype && targetWindow.KeyboardEvent.prototype.hasOwnProperty('preventDefault')) {
            const origKeyPrevent = targetWindow.KeyboardEvent.prototype.preventDefault;
            targetWindow.KeyboardEvent.prototype.preventDefault = function () {
                if (isToolElement(this.target) || (this.composedPath && this.composedPath().some(isToolElement))) {
                    return;
                }
                return origKeyPrevent.apply(this, arguments);
            };
        }
    } catch (e) {
        console.warn('[Wayground Tool] preventDefault patch failed:', e);
    }

    // 2.3 Intercept onkeydown/onkeypress/onkeyup property setters on document & window
    const patchInlineHandler = (obj, propName) => {
        try {
            let internalHandler = null;
            Object.defineProperty(obj, propName, {
                configurable: true,
                enumerable: true,
                get() {
                    return internalHandler;
                },
                set(fn) {
                    if (['onvisibilitychange'].includes(propName) || (propName === 'onblur' && (obj === targetDoc || obj === targetWindow))) {
                        internalHandler = () => {}; // Neutralize inline tab-switch anti-cheat handlers
                        return;
                    }
                    if (typeof fn === 'function') {
                        internalHandler = function (event) {
                            if (isToolElement(event.target) || (event.composedPath && event.composedPath().some(isToolElement))) {
                                return;
                            }
                            return fn.apply(this, arguments);
                        };
                    } else {
                        internalHandler = fn;
                    }
                }
            });
        } catch (e) {}
    };

    ['onkeydown', 'onkeypress', 'onkeyup', 'onbeforeinput', 'oninput', 'onblur', 'onvisibilitychange'].forEach(prop => {
        patchInlineHandler(targetDoc, prop);
        patchInlineHandler(targetWindow, prop);
    });

    // 2.4 Capture-phase bodyguard listener on window
    const isolationGuard = (e) => {
        if (isToolElement(e.target) || (e.composedPath && e.composedPath().some(isToolElement))) {
            e.stopImmediatePropagation();
        }
    };
    ['keydown', 'keypress', 'keyup', 'beforeinput', 'input'].forEach(evtType => {
        origAddEventListener.call(targetWindow, evtType, isolationGuard, true);
    });

    // ==========================================
    // 3. STYLES & UI DESIGN
    // ==========================================
    const STYLES = `
        #solver-panel {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 290px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
            z-index: 9999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #f8fafc;
            padding: 12px 14px;
            box-sizing: border-box;
            user-select: none;
            touch-action: none;
        }
        .wg-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: move;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            margin-bottom: 10px;
            touch-action: none;
        }
        .wg-panel-title-wrap {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 13px;
            font-weight: 700;
            color: #38bdf8;
            letter-spacing: 0.3px;
        }
        .wg-panel-actions {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .wg-header-btn {
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: #94a3b8;
            border-radius: 6px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            padding: 0;
            transition: all 0.15s;
        }
        .wg-header-btn:hover {
            background: rgba(255, 255, 255, 0.18);
            color: white;
        }
        #solver-status {
            font-size: 12.5px;
            line-height: 1.4;
            color: #e2e8f0;
            word-break: break-word;
            margin-bottom: 8px;
        }
        .wg-input-row {
            display: flex;
            gap: 6px;
            margin-bottom: 6px;
        }
        #key-input, #pin-input {
            flex: 1;
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: rgba(0, 0, 0, 0.35);
            color: white;
            font-size: 12px;
            outline: none;
            box-sizing: border-box;
            user-select: text !important;
            touch-action: manipulation;
        }
        #key-input:focus, #pin-input:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }
        #save-key-btn, #load-btn {
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0 12px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
            white-space: nowrap;
        }
        #save-key-btn:hover, #load-btn:hover {
            background: #2563eb;
        }
        .wg-key-help {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 4px;
            line-height: 1.3;
        }
        .wg-key-help a {
            color: #38bdf8;
            text-decoration: none;
        }
        .wg-key-help a:hover {
            text-decoration: underline;
        }
        .wg-settings-box {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 12px;
        }
        .wg-checkbox-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #cbd5e1;
            cursor: pointer;
        }
        .wg-checkbox-row input[type="checkbox"] {
            cursor: pointer;
            accent-color: #38bdf8;
            width: 15px;
            height: 15px;
        }
        .wg-speed-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #cbd5e1;
        }
        .wg-stepper-wrap {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .wg-step-btn {
            background: rgba(255, 255, 255, 0.1);
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 4px;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
            padding: 0;
            line-height: 1;
            transition: all 0.15s;
        }
        .wg-step-btn:hover {
            background: rgba(56, 189, 248, 0.25);
            color: #38bdf8;
            border-color: #38bdf8;
        }
        .wg-number-input {
            width: 44px;
            padding: 2px 4px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: rgba(0, 0, 0, 0.3);
            color: white;
            font-size: 12px;
            text-align: center;
            outline: none;
            user-select: text !important;
        }
        .wg-select-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #cbd5e1;
            margin-top: 2px;
        }
        .wg-select-input {
            background: rgba(0, 0, 0, 0.4);
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 6px;
            padding: 3px 6px;
            font-size: 11px;
            outline: none;
            cursor: pointer;
        }
        .wg-select-input option {
            background: #0f172a;
            color: white;
        }
        #change-key-btn, #change-pin-btn, .wg-sheet-btn, .wg-sec-btn {
            background: rgba(255, 255, 255, 0.06);
            color: #94a3b8;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            padding: 5px;
            font-size: 11px;
            cursor: pointer;
            margin-top: 4px;
            transition: all 0.15s;
            text-align: center;
            width: 100%;
            box-sizing: border-box;
        }
        #change-key-btn:hover, #change-pin-btn:hover, .wg-sheet-btn:hover, .wg-sec-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            color: #f1f5f9;
        }
        .wg-nav-row {
            display: flex;
            gap: 4px;
            margin-top: 6px;
        }
        .wg-chip-btn {
            background: rgba(255, 255, 255, 0.08);
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
        }
        .wg-chip-btn:hover {
            background: rgba(255, 255, 255, 0.18);
            color: white;
        }
        .wg-chip-primary {
            background: linear-gradient(135deg, #3b82f6, #6366f1) !important;
            color: white !important;
            border-color: rgba(99, 102, 241, 0.4) !important;
            font-weight: 600 !important;
        }
        .wg-chip-primary:hover {
            background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
        }
        .wg-chip-active {
            background: #ef4444 !important;
            color: white !important;
            border-color: #f87171 !important;
        }
        .wg-countdown-wrap {
            margin: 6px 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .wg-progress-bg {
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
        }
        .wg-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #38bdf8, #818cf8);
            width: 100%;
            transition: width 0.1s linear;
        }
        .wg-live-timer-controls {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-wrap: wrap;
            margin-top: 4px;
        }

        /* Floating Mini Icon */
        #solver-mini-icon {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 42px;
            height: 42px;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 9999999;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 18px;
            color: #38bdf8;
            opacity: 0.18;
            touch-action: none;
            user-select: none;
            transition: opacity 0.25s ease, transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        #solver-mini-icon:hover {
            opacity: 0.95;
            transform: scale(1.08);
            border-color: #38bdf8;
            box-shadow: 0 8px 20px rgba(56, 189, 248, 0.35);
        }

        /* Cheatsheet Modal */
        .wg-modal-overlay {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(4px);
            z-index: 99999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
        }
        .wg-modal-card {
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
            width: 100%;
            max-width: 480px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            padding: 14px;
            box-sizing: border-box;
            color: #f8fafc;
            font-family: inherit;
        }
        .wg-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 10px;
        }
        .wg-modal-title {
            font-size: 14px; font-weight: 700; color: #38bdf8;
        }
        .wg-search-input {
            background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.18);
            color: white; border-radius: 6px; padding: 5px 8px; font-size: 12px;
            margin-bottom: 8px; outline: none; box-sizing: border-box; width: 100%;
        }
        .wg-sheet-content {
            overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 4px;
            max-height: 55vh; padding-right: 2px; scrollbar-width: thin;
        }
        .wg-sheet-item {
            display: flex; gap: 6px; align-items: baseline;
            padding: 5px 7px; border-radius: 6px; background: rgba(255, 255, 255, 0.03);
            font-size: 12px;
        }
        .wg-sheet-num {
            font-weight: 700; color: #a78bfa; font-size: 11px; min-width: 24px; flex-shrink: 0;
        }
        .wg-sheet-ans {
            color: #e2e8f0; word-break: break-word; line-height: 1.3;
        }

        /* Mobile & Touch Responsive Optimization */
        @media (max-width: 600px), (pointer: coarse) {
            #solver-panel {
                bottom: 12px; left: 12px;
                padding: 10px 12px;
                max-width: calc(100vw - 24px);
            }
            #solver-mini-icon {
                bottom: 12px; left: 12px;
                width: 46px; height: 46px; font-size: 20px;
            }
            #key-input, #pin-input, .wg-number-input {
                font-size: 14px;
            }
            #save-key-btn, #load-btn {
                padding: 0 14px; min-height: 36px; font-size: 13px;
            }
            .wg-checkbox-row {
                min-height: 30px;
            }
            .wg-speed-row {
                min-height: 30px;
            }
            .wg-header-btn {
                width: 28px; height: 28px; font-size: 14px;
            }
            .wg-chip-btn {
                height: 28px; font-size: 11.5px;
            }
        }
    `;

    const applyStyles = () => {
        if (typeof GM_addStyle !== 'undefined') {
            try { GM_addStyle(STYLES); return; } catch(e) {}
        }
        const target = document.head || document.documentElement;
        if (target) {
            const styleEl = document.createElement('style');
            styleEl.textContent = STYLES;
            target.appendChild(styleEl);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                const styleEl = document.createElement('style');
                styleEl.textContent = STYLES;
                (document.head || document.documentElement).appendChild(styleEl);
            });
        }
    };
    applyStyles();

    // ==========================================
    // 4. STORAGE & CONFIG
    // ==========================================
    const STORAGE_KEY = 'wayground_api_key';
    const PIN_STORAGE_KEY = 'wayground_last_pin';
    const CONFIG_KEY = 'wayground_tool_config';

    function safeGetStorage(key) {
        try {
            return sessionStorage.getItem(key) || localStorage.getItem(key) || '';
        } catch (e) {
            try { return localStorage.getItem(key) || ''; } catch (e2) {}
        }
        return '';
    }

    function safeSetStorage(key, val) {
        try { sessionStorage.setItem(key, val); } catch (e) {}
        try { localStorage.setItem(key, val); } catch (e) {}
    }

    function safeRemoveStorage(key) {
        try { sessionStorage.removeItem(key); } catch (e) {}
        try { localStorage.removeItem(key); } catch (e) {}
    }

    const defaultConfig = {
        autoSelect: true,
        autoNext: true,       // automatically advance to next question in test mode
        baseSpeed: 2.0,       // average selection delay in seconds
        randomize: true,      // randomize variance within +-20%
        dynamicPacing: false, // auto-increase delay for longer questions (human simulator)
        stealthLevel: 'ghost',// 'ghost' (super subtle underline) | 'subtle' (faint tint) | 'standard' (full border)
        minimized: false      // minimize to small floating icon
    };

    function loadConfig() {
        try {
            const saved = safeGetStorage(CONFIG_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    ...defaultConfig,
                    ...parsed,
                    autoNext: typeof parsed.autoNext === 'boolean' ? parsed.autoNext : defaultConfig.autoNext,
                    baseSpeed: (typeof parsed.baseSpeed === 'number' && !isNaN(parsed.baseSpeed)) ? Math.max(0.2, parsed.baseSpeed) : defaultConfig.baseSpeed,
                    stealthLevel: ['ghost', 'subtle', 'standard'].includes(parsed.stealthLevel) ? parsed.stealthLevel : defaultConfig.stealthLevel
                };
            }
        } catch (e) {}
        return { ...defaultConfig };
    }

    function saveConfig(cfg) {
        try {
            safeSetStorage(CONFIG_KEY, JSON.stringify(cfg));
        } catch (e) {}
    }

    let config = loadConfig();
    const cachedAnswers = new Map();
    let cachedQuestionsList = [];
    let lastQuestionFingerprint = '';
    let solveTimer = null;

    let activeTimer = {
        intervalId: null,
        remainingMs: 0,
        totalMs: 0,
        isPaused: false,
        answer: null,
        questionData: null
    };

    function stopActiveTimer() {
        if (activeTimer.intervalId) {
            clearInterval(activeTimer.intervalId);
            activeTimer.intervalId = null;
        }
        if (solveTimer) {
            clearTimeout(solveTimer);
            solveTimer = null;
        }
        activeTimer.isPaused = false;
        activeTimer.answer = null;
        activeTimer.questionData = null;
    }

    let currentApiKey = (safeGetStorage(STORAGE_KEY) || '').trim();

    // ==========================================
    // 5. DIACRITICS & TEXT NORMALIZATION
    // ==========================================
    function normalizeVietnameseWord(word) {
        if (!word) return '';
        if (/^[a-z0-9]+_[1-5]$/.test(word)) return word;
        const toneMap = {
            '\u0300': '1', // Huyền
            '\u0301': '2', // Sắc
            '\u0303': '3', // Ngã
            '\u0309': '4', // Hỏi
            '\u0323': '5'  // Nặng
        };
        const nfd = word.normalize('NFD');
        let base = '';
        let tone = '';
        for (let i = 0; i < nfd.length; i++) {
            const char = nfd[i];
            if (toneMap[char]) {
                tone = toneMap[char];
            } else if (/[\u0300-\u036f]/.test(char)) {
                continue; // strip secondary diacritics (hat, horn, breve)
            } else {
                base += char;
            }
        }
        base = base.replace(/đ/g, 'd').replace(/Đ/g, 'd');
        return (tone ? base + '_' + tone : base).normalize('NFC');
    }

    function stripOptionPrefix(text) {
        if (!text) return '';
        return text
            .replace(/^\s*(?:câu|question|cau)\s*\d+[\s:.-]*/i, '')
            .replace(/^\s*\d+[\s:.)-]+\s*/, '')
            .replace(/^\s*[\(\[\{]?[A-Za-z0-9][\.\)\:\-\]\}\s]\s*/, '')
            .replace(/^\s*[A-Za-z0-9]\s+/, '')
            .trim();
    }

    function normalizeText(text) {
        if (!text) return '';
        let s = String(text);
        s = s.replace(/<[^>]+>/g, ' ');
        s = s.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, ' ')
             .replace(/&#39;|&apos;/gi, ' ')
             .replace(/&lt;/gi, ' ')
             .replace(/&gt;/gi, ' ')
             .replace(/&ndash;/gi, ' ')
             .replace(/&mdash;/gi, ' ');

        s = s.replace(/^\s*(?:câu|question|cau)\s*\d+[\s:.-]*/i, ' ');
        s = s.replace(/^\s*\d+[\s:.)-]+\s*/, ' ');
        s = s.replace(/^\s*[\(\[\{]?[a-z0-9][\.\)\:\-\]\}\s]\s*/i, ' ');
        s = s.replace(/["'“”‘’«»„‟`]/g, ' ')
             .replace(/[–—―→\-><=…~]/g, ' ')
             .replace(/_(?![1-5]\b)/g, ' ')
             .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, ' ')
             .replace(/[.,/#!$%^&*;:{}=\`~()?\[\]{}|\\+<>@]/g, ' ');

        const words = s.toLowerCase().trim().split(/\s+/).filter(Boolean);
        return words.map(normalizeVietnameseWord).join(' ');
    }

    function getWordOverlap(str1, str2) {
        if (!str1 || !str2) return 0;
        const words1 = str1.split(/\s+/).filter(w => w.length >= 2);
        const words2 = new Set(str2.split(/\s+/).filter(w => w.length >= 2));
        if (words1.length === 0 || words2.size === 0) return 0;
        let match = 0;
        for (const w of words1) {
            if (words2.has(w)) match++;
        }
        return match / Math.max(words1.length, words2.size);
    }

    function getOptionMatchScore(optRawText, target) {
        if (!optRawText || !target) return 0;
        const optClean = stripOptionPrefix(optRawText);
        const optNorm = normalizeText(optClean);
        const targetClean = stripOptionPrefix(target);
        const targetNorm = normalizeText(targetClean);
        if (!optNorm || !targetNorm) return 0;

        // 1. Exact match = 100 points
        if (optNorm === targetNorm) return 100;

        // 2. Prefix / Suffix match = 85 points
        if (optNorm.endsWith(' ' + targetNorm) || targetNorm.endsWith(' ' + optNorm)) return 85;
        if (optNorm.startsWith(targetNorm + ' ') || targetNorm.startsWith(optNorm + ' ')) return 85;

        // 3. Substring containment with high coverage
        if (targetNorm.length >= 6 && optNorm.length >= 6) {
            if (optNorm.includes(targetNorm)) {
                const ratio = targetNorm.length / optNorm.length;
                if (ratio >= 0.7) return Math.round(ratio * 80);
            } else if (targetNorm.includes(optNorm)) {
                const ratio = optNorm.length / targetNorm.length;
                if (ratio >= 0.7) return Math.round(ratio * 80);
            }
        }

        return 0;
    }

    function isOptionMatch(optRawText, targets) {
        if (!optRawText || !targets) return false;
        const targetList = Array.isArray(targets) ? targets : [targets];
        return targetList.some(target => getOptionMatchScore(optRawText, target) >= 50);
    }

    function findMatchingOptions(options, answersArray, isMultipleChoice = false) {
        if (!options || options.length === 0 || !answersArray || answersArray.length === 0) return [];

        const targets = answersArray.filter(Boolean);
        if (targets.length === 0) return [];

        // If Single Choice: pick the single best option with highest score
        if (!isMultipleChoice || targets.length === 1) {
            const target = targets[0];
            let bestOpt = null;
            let highestScore = 0;

            for (const opt of options) {
                const score = getOptionMatchScore(opt.rawText, target);
                if (score > highestScore) {
                    highestScore = score;
                    bestOpt = opt;
                }
            }

            if (bestOpt && highestScore >= 50) {
                return [bestOpt];
            }
            return [];
        }

        // If Multiple Choice (MSQ): for each target answer, pick best matching option
        const matched = [];
        for (const target of targets) {
            let bestOpt = null;
            let highestScore = 0;
            for (const opt of options) {
                if (matched.includes(opt)) continue;
                const score = getOptionMatchScore(opt.rawText, target);
                if (score > highestScore) {
                    highestScore = score;
                    bestOpt = opt;
                }
            }
            if (bestOpt && highestScore >= 50) {
                matched.push(bestOpt);
            }
        }
        return matched;
    }

    const cleanTextForDisplay = (text) => text?.replace(/<p>|<\/p>/g, '').trim().replace(/\s+/g, ' ') || '';

    function findGamePin() {
        // 1. URL search params (gc, pin, gameCode, room, roomCode, quizId)
        try {
            const url = new URL(window.location.href);
            for (const param of ['gc', 'pin', 'gameCode', 'room', 'roomCode', 'quizId']) {
                const val = url.searchParams.get(param);
                if (val) {
                    const clean = val.replace(/\s+/g, '');
                    if (clean.length === 6 || clean.length === 8) return clean;
                }
            }
            const pathMatch = url.pathname.match(/\/(?:game|join)\/(\d{6,8})/);
            if (pathMatch) return pathMatch[1];
        } catch (e) {}

        // 2. Storage check
        try {
            for (const storage of [sessionStorage, localStorage]) {
                for (let i = 0; i < storage.length; i++) {
                    const k = storage.key(i) || '';
                    if (k.startsWith('wayground_') || k.startsWith('wg_')) continue;
                    if (/pin|room|game/i.test(k)) {
                        const val = storage.getItem(k) || '';
                        const m = val.match(/"(?:gameCode|roomHash|pin|roomCode)":\s*"?(\d{6,8})"?/i) || val.match(/\b(\d{6,8})\b/);
                        if (m) return m[1];
                    }
                }
            }
        } catch (e) {}

        // 3. Known DOM elements
        const domPin = document.querySelector('[data-testid*="game-code"], [data-testid*="pin"], .game-code, .room-pin, .pin-code, input[name="roomCode"]');
        if (domPin) {
            const txt = (domPin.value || domPin.textContent || '').replace(/\s+/g, '');
            const m = txt.match(/\b(\d{6,8})\b/);
            if (m) return m[1];
        }

        // 4. Tree walker across body
        const pinRegex = /\b(\d{3,4})\s?(\d{3,4})\b/;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(parent.tagName)) continue;
            if (parent.closest && parent.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]')) continue;

            const text = node.nodeValue.trim();
            const match = text.match(pinRegex);
            if (match) {
                const pin = match[1] + match[2];
                if (pin.length === 6 || pin.length === 8) {
                    return pin;
                }
            }
        }
        return null;
    }

    // ==========================================
    // 6. API AUTHENTICATION & ANSWER FETCHING
    // ==========================================
    async function authenticateWithKey(key, statusDisplay) {
        if (!key) return false;
        if (statusDisplay) {
            statusDisplay.textContent = "⏳ Đang xác thực key...";
            statusDisplay.style.color = "white";
        }
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://api.cheatnetwork.eu/auth/redirect?backup=${encodeURIComponent(key)}`,
                headers: { "Host": "api.cheatnetwork.eu" },
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data?.success) {
                            currentApiKey = key;
                            safeSetStorage(STORAGE_KEY, key);
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (e) {
                        resolve(false);
                    }
                },
                onerror: () => resolve(false)
            });
        });
    }

    async function fetchAndCacheAnswers(pin, statusDisplay, isRetry = false) {
        if (!currentApiKey) return false;
        if (statusDisplay) {
            statusDisplay.textContent = isRetry ? "⏳ Đang tải lại..." : "⏳ Đang tải đáp án...";
            statusDisplay.style.color = "white";
        }

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://api.cheatnetwork.eu/quizizz/${pin}/answers`,
                headers: {
                    "Authorization": currentApiKey,
                    "Host": "api.cheatnetwork.eu"
                },
                onload: async (res) => {
                    try {
                        const data = JSON.parse(res.responseText);

                        if (res.status === 401 || data?.message === "Invalid API key" || data?.message?.includes("key")) {
                            if (!isRetry) {
                                statusDisplay.textContent = "⏳ Thử cấp lại quyền...";
                                const reauth = await authenticateWithKey(currentApiKey);
                                if (reauth) {
                                    resolve(await fetchAndCacheAnswers(pin, statusDisplay, true));
                                    return;
                                } else {
                                    statusDisplay.textContent = "❌ Key lỗi / Hết hạn";
                                    statusDisplay.style.color = '#ff5555';
                                    resolve(false);
                                    return;
                                }
                            } else {
                                statusDisplay.textContent = "❌ Truy cập bị từ chối";
                                statusDisplay.style.color = '#ff5555';
                                resolve(false);
                                return;
                            }
                        }

                        if (!data?.answers) throw new Error("No Data");
                        cachedQuestionsList = [];
                        data.answers.forEach(item => {
                            if (!item.id && !item._id) return;
                            const itemId = item.id || item._id;
                            const qText = item.text || item.query?.text || item.structure?.query?.text || item.query?.media?.[0]?.url || '';
                            const qOpts = item.options || item.structure?.options || [];
                            cachedQuestionsList.push({ id: itemId, type: item.type, options: qOpts, text: qText });

                            const rawAns = item.answer !== undefined ? item.answer : (item.structure?.answer !== undefined ? item.structure.answer : null);

                            const extractOptionText = (opt) => {
                                if (!opt) return '';
                                if (typeof opt === 'string') return cleanTextForDisplay(opt);
                                return cleanTextForDisplay(opt.text || opt.media?.[0]?.url || opt.id || '');
                            };

                            if (item.type === 'MSQ' && Array.isArray(rawAns)) {
                                const multi = rawAns.map(idx => {
                                    if (typeof idx === 'number' && qOpts[idx]) {
                                        return extractOptionText(qOpts[idx]);
                                    }
                                    if (typeof idx === 'string') {
                                        const parsed = parseInt(idx, 10);
                                        if (!isNaN(parsed) && qOpts[parsed]) {
                                            return extractOptionText(qOpts[parsed]);
                                        }
                                        return cleanTextForDisplay(idx);
                                    }
                                    return cleanTextForDisplay(idx);
                                }).filter(Boolean);
                                if (multi.length) cachedAnswers.set(itemId, multi);
                            } else if (item.type === 'BLANK' || item.type === 'open') {
                                const ans = Array.isArray(rawAns) ? rawAns[0] : (rawAns || item.text || '');
                                if (ans) cachedAnswers.set(itemId, typeof ans === 'object' ? cleanTextForDisplay(ans.text || '') : cleanTextForDisplay(String(ans)));
                            } else if (Array.isArray(rawAns) && rawAns.length > 0) {
                                const first = rawAns[0];
                                if (typeof first === 'number' && qOpts[first]) {
                                    const optText = extractOptionText(qOpts[first]);
                                    if (optText) cachedAnswers.set(itemId, optText);
                                } else if (typeof first === 'string') {
                                    const parsed = parseInt(first, 10);
                                    if (!isNaN(parsed) && qOpts[parsed]) {
                                        const optText = extractOptionText(qOpts[parsed]);
                                        if (optText) cachedAnswers.set(itemId, optText);
                                    } else {
                                        cachedAnswers.set(itemId, cleanTextForDisplay(first));
                                    }
                                } else if (first?.text) {
                                    cachedAnswers.set(itemId, cleanTextForDisplay(first.text));
                                }
                            } else if (typeof rawAns === 'number' && qOpts[rawAns]) {
                                const optText = extractOptionText(qOpts[rawAns]);
                                if (optText) cachedAnswers.set(itemId, optText);
                            } else if (typeof rawAns === 'string') {
                                const parsed = parseInt(rawAns, 10);
                                if (!isNaN(parsed) && qOpts[parsed]) {
                                    const optText = extractOptionText(qOpts[parsed]);
                                    if (optText) cachedAnswers.set(itemId, optText);
                                } else {
                                    cachedAnswers.set(itemId, cleanTextForDisplay(rawAns));
                                }
                            }
                        });
                        resolve(cachedAnswers.size > 0);

                    } catch (e) {
                        if (!isRetry) {
                            statusDisplay.textContent = "❌ Lỗi dữ liệu";
                            statusDisplay.style.color = '#ff5555';
                        }
                        resolve(false);
                    }
                },
                onerror: () => {
                    statusDisplay.textContent = "❌ Lỗi mạng";
                    statusDisplay.style.color = '#ff5555';
                    resolve(false);
                }
            });
        });
    }

    // ==========================================
    // 7. QUESTION & ANSWER PROCESSING (CLASSIC & TEST MODE)
    // ==========================================
    function getActiveQuestionContainer() {
        const candidates = Array.from(document.querySelectorAll('[data-quesid], [data-question-id], .question-container, [data-testid*="question-container"], .assessment-question, .question-card, main, [role="main"]'));
        for (const el of candidates) {
            if (el.offsetParent !== null && !el.classList.contains('hidden') && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden') {
                return el;
            }
        }
        return document.querySelector('[data-quesid]') || document.querySelector('.question-container') || document.querySelector('.question-card') || document.querySelector('#question-container') || document.body;
    }

    function getQuestionTitle(container) {
        if (!container) return '';
        const titleEl = container.querySelector(
            '[data-testid="question-title"], .question-text, .question-text-color, .q-title, .question-title, #question-text, .typed-prompt, [class*="question-text"], [class*="questionText"], [class*="prompt"], [class*="query"], h1, h2, h3, h4'
        );
        if (titleEl) {
            return titleEl.innerText || titleEl.textContent || '';
        }
        const pEls = Array.from(container.querySelectorAll('p, div'));
        for (const p of pEls) {
            if (p.closest && p.closest('.option, button, [role="radio"], [role="checkbox"], [data-wg-tool], #solver-panel, #solver-mini-icon, #wg-cheatsheet-modal')) continue;
            const txt = (p.innerText || p.textContent || '').trim();
            if (txt.length > 10) return txt;
        }
        return '';
    }

    function getOptionRawText(el) {
        if (!el) return '';
        try {
            // Clone and strip circular badges, letters, icons
            const clone = el.cloneNode(true);
            clone.querySelectorAll(
                '[class*="marker"], [class*="badge"], [class*="index"], [class*="letter"], [class*="circle"], [class*="indicator"], [aria-hidden="true"], svg'
            ).forEach(node => {
                const t = (node.innerText || node.textContent || '').trim();
                if (t.length <= 4) {
                    node.remove();
                }
            });
            const clean = (clone.innerText || clone.textContent || '').trim();
            if (clean.length > 0) {
                return clean;
            }
        } catch (e) {}

        const textNode = el.querySelector('.option-text-inner, [class*="option-text"], [class*="optionText"], [class*="text-container"], [class*="choice-text"], .resizeable-text, p');
        let txt = textNode ? (textNode.innerText || textNode.textContent || '') : (el.innerText || el.textContent || '');
        const imgAlt = el.querySelector('img')?.alt || el.querySelector('img')?.src || '';
        return (txt || imgAlt || '').trim();
    }

    function getCurrentQuestionData() {
        const questionContainer = getActiveQuestionContainer() || document.body;

        let questionId = questionContainer.dataset?.quesid ||
            questionContainer.dataset?.questionId ||
            questionContainer.getAttribute?.('data-quesid') ||
            questionContainer.getAttribute?.('data-question-id') ||
            '';

        // Find standard option elements (including Quizizz Test Mode option-trigger buttons)
        const optionSelector = '[data-testid^="option-trigger-"], [data-testid*="option-trigger"], [data-testid^="option-"], [data-cy^="option-"], .option.is-selectable, .option, button[class*="option"], [role="radio"], [role="checkbox"], .choice-btn, label[class*="option"], [class*="choice-item"], [data-testid*="choice"], div[class*="option-container"]';
        let optionEls = Array.from(questionContainer.querySelectorAll(optionSelector));
        if (optionEls.length === 0) {
            optionEls = Array.from(document.querySelectorAll(optionSelector));
        }
        optionEls = optionEls.filter(el => el.offsetParent !== null && !isToolElement(el));

        // CRITICAL: Filter out parent containers that wrap other options!
        if (optionEls.length > 1) {
            optionEls = optionEls.filter((el, idx, arr) => {
                const isParent = arr.some(other => other !== el && el.contains(other));
                return !isParent;
            });
        }

        // Match active question against cachedQuestionsList (robust against question & option shuffling)
        let activeQuestionItem = null;
        if (cachedQuestionsList.length > 0) {
            const domTitle = getQuestionTitle(questionContainer);
            const normDomTitle = normalizeText(domTitle);
            const normDomOptions = optionEls.map(el => normalizeText(getOptionRawText(el))).filter(t => t.length > 0);
            const normContainerText = normalizeText(questionContainer.innerText || document.body.innerText || '');

            let bestItem = null;
            let highestScore = 0;

            for (const item of cachedQuestionsList) {
                const qRawText = item.text || item.query?.text || item.structure?.query?.text || '';
                const normItemTitle = normalizeText(qRawText);
                const itemOpts = (item.options || item.structure?.options || []).map(o => {
                    const t = typeof o === 'string' ? o : (o.text || o.media?.[0]?.url || '');
                    return normalizeText(t);
                }).filter(t => t.length > 0);

                let score = 0;

                // 1. Direct ID match
                if (questionId && (item.id === questionId || item._id === questionId)) {
                    score += 200;
                }

                // 2. Question Title match
                if (normDomTitle && normItemTitle) {
                    if (normDomTitle === normItemTitle) {
                        score += 150;
                    } else if (normDomTitle.includes(normItemTitle) || normItemTitle.includes(normDomTitle)) {
                        score += 100;
                    } else {
                        const overlap = getWordOverlap(normDomTitle, normItemTitle);
                        if (overlap >= 0.5) {
                            score += Math.round(overlap * 90);
                        }
                    }
                }

                // 3. Option texts match (even when options or questions are shuffled!)
                if (normDomOptions.length > 0 && itemOpts.length > 0) {
                    let matchedCount = 0;
                    for (const domOpt of normDomOptions) {
                        if (domOpt.length < 2) continue;
                        const matched = itemOpts.some(targetOpt => {
                            if (domOpt === targetOpt) return true;
                            if (domOpt.endsWith(' ' + targetOpt) || targetOpt.endsWith(' ' + domOpt)) return true;
                            if (domOpt.startsWith(targetOpt + ' ') || targetOpt.startsWith(domOpt + ' ')) return true;
                            if (domOpt.length >= 5 && targetOpt.length >= 5 && (domOpt.includes(targetOpt) || targetOpt.includes(domOpt))) return true;
                            return false;
                        });
                        if (matched) matchedCount++;
                    }

                    if (matchedCount >= 3) {
                        score += 120;
                    } else if (matchedCount === 2) {
                        score += 70;
                    } else if (matchedCount === 1) {
                        score += 25;
                    }
                }

                // 4. Container text fallback
                if (score < 40 && normContainerText && normItemTitle && normItemTitle.length > 8) {
                    if (normContainerText.includes(normItemTitle)) {
                        score += 60;
                    } else {
                        const overlap = getWordOverlap(normContainerText, normItemTitle);
                        if (overlap >= 0.6) {
                            score += Math.round(overlap * 50);
                        }
                    }
                }

                if (score > highestScore) {
                    highestScore = score;
                    bestItem = item;
                }
            }

            if (bestItem && highestScore >= 25) {
                activeQuestionItem = bestItem;
                questionId = bestItem.id;
            }
        }

        // Test Mode Fallback: Find elements by expected option texts
        if (optionEls.length === 0 && activeQuestionItem) {
            const expectedOpts = activeQuestionItem.options || activeQuestionItem.structure?.options || [];
            if (Array.isArray(expectedOpts) && expectedOpts.length > 0) {
                const foundOpts = [];
                for (const expected of expectedOpts) {
                    const targetText = typeof expected === 'string' ? expected : (expected.text || expected.media?.[0]?.url || '');
                    if (!targetText) continue;
                    const normTarget = normalizeText(targetText);

                    const allNodes = Array.from(document.querySelectorAll('button, [role="button"], [role="radio"], div[class*="option"], div[class*="choice"], div[class*="cursor"], div[class*="item"], p, span'));
                    for (const node of allNodes) {
                        if (node.offsetParent === null || isToolElement(node)) continue;
                        const txt = normalizeText(node.innerText || node.textContent || '');

                        if (txt === normTarget || (normTarget.length >= 5 && (txt.includes(normTarget) || normTarget.includes(txt)))) {
                            const clickable = node.closest('button, [role="radio"], [role="button"], [role="checkbox"], div[class*="cursor"], div[class*="option"], div[class*="choice"], div[class*="card"], li') || node;
                            if (!foundOpts.includes(clickable) && !isToolElement(clickable)) {
                                foundOpts.push(clickable);
                                break;
                            }
                        }
                    }
                }
                if (foundOpts.length > 0) {
                    optionEls = foundOpts;
                }
            }
        }

        if (optionEls.length > 0) {
            const options = optionEls.map(el => {
                return {
                    rawText: getOptionRawText(el),
                    element: el
                };
            });
            return { questionId, type: 'CHOICE', options, container: questionContainer };
        }

        const inputEl = document.querySelector('input.question-input, textarea.question-input, input[type="text"], textarea');
        if (inputEl && inputEl.offsetParent !== null && !isToolElement(inputEl)) {
            return { questionId, type: 'BLANK', inputEl, container: questionContainer };
        }

        return null;
    }

    function clearHighlights() {
        document.querySelectorAll('.wg-correct-highlight').forEach(el => {
            el.classList.remove('wg-correct-highlight');
            el.style.backgroundColor = '';
            el.style.boxShadow = '';
            el.style.borderRadius = '';
            el.style.border = '';
        });
        document.querySelectorAll('.wg-correct-text').forEach(el => {
            el.classList.remove('wg-correct-text');
            el.style.fontWeight = '';
            el.style.letterSpacing = '';
        });
    }

    // Smart & discreet answer highlighting directly on the Wayground interface
    function highlightCorrectAnswers(answer, questionData) {
        if (!questionData) return;
        clearHighlights();

        if (questionData.type === 'CHOICE' && questionData.options) {
            const answersArray = Array.isArray(answer) ? answer : [answer];
            const isMSQ = questionData.isMSQ || (Array.isArray(answer) && answer.length > 1);
            const matchingOpts = findMatchingOptions(questionData.options, answersArray, isMSQ);

            matchingOpts.forEach(opt => {
                opt.element.classList.add('wg-correct-highlight');

                if (config.stealthLevel === 'ghost') {
                    // Ghost: Ultra-discreet, virtually transparent background, subtle underline only
                    opt.element.style.setProperty('background-color', 'rgba(34, 197, 94, 0.03)', 'important');
                    opt.element.style.setProperty('box-shadow', 'inset 0 -2.5px 0 0 rgba(74, 222, 128, 0.38)', 'important');
                    opt.element.style.setProperty('border-radius', '6px', 'important');
                } else if (config.stealthLevel === 'subtle') {
                    // Subtle: Faint green tint
                    opt.element.style.setProperty('background-color', 'rgba(34, 197, 94, 0.08)', 'important');
                    opt.element.style.setProperty('box-shadow', '0 0 0 1.5px rgba(34, 197, 94, 0.22)', 'important');
                    opt.element.style.setProperty('border-radius', '8px', 'important');
                } else {
                    // Standard: Clear border
                    opt.element.style.setProperty('background-color', 'rgba(34, 197, 94, 0.12)', 'important');
                    opt.element.style.setProperty('box-shadow', '0 0 0 2px rgba(34, 197, 94, 0.4)', 'important');
                    opt.element.style.setProperty('border-radius', '8px', 'important');
                }

                const textInner = opt.element.querySelector('.option-text-inner, .text-container, p, span') || opt.element;
                textInner.classList.add('wg-correct-text');
                textInner.style.setProperty('font-weight', config.stealthLevel === 'ghost' ? '600' : '700', 'important');
            });
        } else if (questionData.type === 'BLANK' && questionData.inputEl) {
            const textAnswer = Array.isArray(answer) ? answer[0] : answer;
            const cleanAns = cleanTextForDisplay(textAnswer);
            if (!questionData.inputEl.value) {
                questionData.inputEl.setAttribute('placeholder', `💡 Đáp án: ${cleanAns}`);
            }
        }
    }

    function triggerClick(el) {
        if (!el) return;
        try {
            const target = el.querySelector('button, [role="button"], [role="radio"], [role="checkbox"], input, label') || el;

            if (typeof window.PointerEvent === 'function') {
                try {
                    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, view: window }));
                    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, view: window }));
                } catch (e) {}
            }

            try {
                target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            } catch (e) {}

            try {
                if (typeof target.click === 'function') {
                    target.click();
                } else {
                    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                }
            } catch (e) {}

            if (target.tagName === 'INPUT' && (target.type === 'radio' || target.type === 'checkbox')) {
                target.checked = true;
                target.dispatchEvent(new Event('change', { bubbles: true }));
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } catch (e) {
            try { el.click(); } catch (err) {}
        }
    }

    function findNextButton() {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[role="button"], div[role="button"]'));
        return buttons.find(btn => {
            if (btn.offsetParent === null || btn.disabled) return false;
            if (btn.closest && btn.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]')) return false;

            // NEVER click buttons inside modals, dialogs, popups or alerts!
            if (btn.closest && btn.closest('[role="dialog"], [role="alertdialog"], .modal, .dialog, .popup, [class*="modal"], [class*="dialog"], [class*="popup"], [class*="overlay"]')) {
                return false;
            }

            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
            const className = (btn.className || '').toLowerCase();

            // EXCLUDE final submission / finish buttons!
            if (text.includes('nộp bài kiểm tra') || text.includes('submit exam') || text.includes('submit test') || text.includes('kết thúc bài') || text.includes('finish quiz') || text.includes('end quiz') || text.includes('end test')) {
                return false;
            }

            // EXCLUDE attempt / session / exit / error modal controls!
            if (text.includes('attempt') || ariaLabel.includes('attempt') || testId.includes('attempt') || className.includes('attempt')) {
                return false;
            }
            if (['exit', 'thoát', 'try again', 'thử lại', 'retry', 'resume', 'lần làm', 'lượt làm'].some(k => text.includes(k) || ariaLabel.includes(k) || testId.includes(k))) {
                return false;
            }

            // Positive matches for NEXT QUESTION
            if (ariaLabel.includes('next') || ariaLabel.includes('tiếp') || ariaLabel.includes('tiếp theo')) return true;
            if (text === 'next' || text === 'tiếp theo' || text === 'tiếp' || text.startsWith('next ') || text.includes('câu tiếp') || text.includes('câu sau') || text.includes('câu tiếp theo')) return true;
            if (testId.includes('next') || testId.includes('arrow-right')) return true;
            if (className.includes('nav-button-next') || className.includes('next-btn') || className.includes('next-button')) return true;
            if (btn.querySelector('i.fa-arrow-right, i.fa-chevron-right, svg[data-icon="arrow-right"], svg[data-icon="chevron-right"], [data-icon="chevron-right"]')) return true;

            return false;
        });
    }

    function findPrevButton() {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[role="button"], div[role="button"]'));
        return buttons.find(btn => {
            if (btn.offsetParent === null || btn.disabled) return false;
            if (btn.closest && btn.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]')) return false;

            // NEVER click buttons inside modals, dialogs, popups or alerts!
            if (btn.closest && btn.closest('[role="dialog"], [role="alertdialog"], .modal, .dialog, .popup, [class*="modal"], [class*="dialog"], [class*="popup"], [class*="overlay"]')) {
                return false;
            }

            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
            const className = (btn.className || '').toLowerCase();

            // EXCLUDE attempt / session / exit / error modal controls!
            if (text.includes('attempt') || ariaLabel.includes('attempt') || testId.includes('attempt') || className.includes('attempt')) {
                return false;
            }
            if (['exit', 'thoát', 'try again', 'thử lại', 'retry', 'resume', 'lần làm', 'lượt làm'].some(k => text.includes(k) || ariaLabel.includes(k) || testId.includes(k))) {
                return false;
            }

            // Positive matches for PREV QUESTION
            if (ariaLabel.includes('prev') || ariaLabel.includes('trước') || ariaLabel.includes('quay lại')) return true;
            if (text === 'prev' || text === 'previous' || ['quay lại', 'câu trước', 'trước'].includes(text) || text.includes('câu trước')) return true;
            if (testId.includes('prev') || testId.includes('arrow-left')) return true;
            if (className.includes('nav-button-prev') || className.includes('prev-btn') || className.includes('prev-button')) return true;
            if (btn.querySelector('i.fa-arrow-left, i.fa-chevron-left, svg[data-icon="arrow-left"], svg[data-icon="chevron-left"]')) return true;

            return false;
        });
    }

    function advanceNextQuestion() {
        const nextBtn = findNextButton();
        if (nextBtn) {
            triggerClick(nextBtn);
            return true;
        }
        try {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, bubbles: true }));
            return true;
        } catch (e) {
            return false;
        }
    }

    function advancePrevQuestion() {
        const prevBtn = findPrevButton();
        if (prevBtn) {
            triggerClick(prevBtn);
            return true;
        }
        try {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, bubbles: true }));
            return true;
        } catch (e) {
            return false;
        }
    }

    function solveQuestion(answer, questionData) {
        const safeSubmitOrNext = (attempts = 0) => {
            if (attempts > 4) return;

            // In Test Mode: check if Next button exists
            const nextBtn = findNextButton();
            if (nextBtn) {
                if (config.autoNext) {
                    advanceNextQuestion();
                }
                return;
            }

            // In Game Mode: check per-question submit button
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const submitBtn = buttons.find(btn => {
                if (btn.closest && btn.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]')) return false;
                const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                // STRICT SAFETY: NEVER click exam submission buttons!
                if (text.includes('nộp bài kiểm tra') || text.includes('submit exam') || text.includes('submit test') || text.includes('kết thúc bài') || text.includes('finish quiz') || text.includes('end quiz') || text.includes('end test')) {
                    return false;
                }
                return ['submit', 'nộp', 'nộp bài', 'trả lời'].includes(text) ||
                    btn.classList.contains('submit-btn');
            });

            if (submitBtn && !submitBtn.disabled && submitBtn.offsetParent !== null) {
                triggerClick(submitBtn);
            } else if (attempts < 3) {
                setTimeout(() => safeSubmitOrNext(attempts + 1), 400);
            }
        };

        if (questionData.type === 'CHOICE') {
            const answersArray = Array.isArray(answer) ? answer : [answer];
            const isMSQ = questionData.isMSQ || (Array.isArray(answer) && answer.length > 1);
            const matchingOpts = findMatchingOptions(questionData.options, answersArray, isMSQ);
            let scriptDidClick = false;

            matchingOpts.forEach(opt => {
                opt.element.style.border = '2px solid rgba(34, 197, 94, 0.6)';
                triggerClick(opt.element);
                scriptDidClick = true;
            });

            if (scriptDidClick && config.autoSelect) {
                setTimeout(() => safeSubmitOrNext(), 850);
            }
        } else if (questionData.type === 'BLANK' && questionData.inputEl) {
            const textAnswer = Array.isArray(answer) ? answer[0] : answer;
            questionData.inputEl.value = textAnswer;
            questionData.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            questionData.inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            if (config.autoSelect) {
                setTimeout(() => safeSubmitOrNext(), 850);
            }
        }
    }

    let isAutoFilling = false;
    let autoFillTimer = null;

    function stopAutoFill() {
        isAutoFilling = false;
        if (autoFillTimer) {
            clearTimeout(autoFillTimer);
            autoFillTimer = null;
        }
        const autoFillBtn = document.getElementById('wg-autofill-btn');
        if (autoFillBtn) {
            autoFillBtn.textContent = '🚀 Giải Cả Đề';
            autoFillBtn.classList.remove('wg-chip-active');
        }
    }

    async function runAutoFillAll(statusDisplay) {
        if (isAutoFilling) {
            stopAutoFill();
            statusDisplay.textContent = '⏸️ Đã dừng tự động';
            return;
        }

        isAutoFilling = true;
        const autoFillBtn = document.getElementById('wg-autofill-btn');
        if (autoFillBtn) {
            autoFillBtn.textContent = '⏹️ Dừng Giải';
            autoFillBtn.classList.add('wg-chip-active');
        }

        const step = async () => {
            if (!isAutoFilling) return;

            const qd = getCurrentQuestionData();
            if (qd && cachedAnswers.has(qd.questionId)) {
                const ans = cachedAnswers.get(qd.questionId);
                highlightCorrectAnswers(ans, qd);
                solveQuestion(ans, qd);
            }

            await new Promise(r => setTimeout(r, 600));
            if (!isAutoFilling) return;

            const nextBtn = findNextButton();
            if (nextBtn) {
                advanceNextQuestion();
                autoFillTimer = setTimeout(step, 800);
            } else {
                stopAutoFill();
                statusDisplay.innerHTML = '🎉 <b>Đã điền hết tất cả câu!</b> Hãy kiểm tra và tự nộp bài.';
                statusDisplay.style.color = '#50fa7b';
            }
        };

        step();
    }

    function updateTimerDisplay() {
        const secEl = document.getElementById('wg-timer-sec');
        const barEl = document.getElementById('wg-progress-bar');
        if (secEl) {
            const sec = Math.max(0, (activeTimer.remainingMs / 1000)).toFixed(1);
            secEl.textContent = `${sec}s`;
        }
        if (barEl && activeTimer.totalMs > 0) {
            const pct = Math.min(100, Math.max(0, (activeTimer.remainingMs / activeTimer.totalMs) * 100));
            barEl.style.width = `${pct}%`;
        }
    }

    function renderLiveTimerUI(statusDisplay, displayAnswerText, variancePct) {
        const secStr = Math.max(0, (activeTimer.remainingMs / 1000)).toFixed(1);
        const varStr = config.randomize ? ` (${variancePct >= 0 ? '+' : ''}${variancePct}%)` : '';
        const paceStr = config.dynamicPacing ? ' 🧠' : '';

        statusDisplay.innerHTML = `
            <div style="font-weight: 600; color: #38bdf8; margin-bottom: 2px;">💡 Đáp án:</div>
            <div style="font-size: 13px; font-weight: 700; color: #50fa7b; margin-bottom: 4px;">${displayAnswerText}</div>
            <div class="wg-countdown-wrap">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8;">
                    <span>Tự chọn sau: <b id="wg-timer-sec" style="color: #f8fafc;">${secStr}s</b>${varStr}${paceStr}</span>
                </div>
                <div class="wg-progress-bg">
                    <div id="wg-progress-bar" class="wg-progress-bar" style="width: 100%;"></div>
                </div>
                <div class="wg-live-timer-controls">
                    <button id="wg-timer-now-btn" class="wg-chip-btn" style="color: #38bdf8; font-weight: 600;">⚡ Chọn ngay</button>
                    <button id="wg-timer-pause-btn" class="wg-chip-btn">⏸️ Dừng</button>
                    <button id="wg-timer-minus-btn" class="wg-chip-btn" title="Giảm 1s">−1s</button>
                    <button id="wg-timer-plus-btn" class="wg-chip-btn" title="Thêm 1s">+1s</button>
                </div>
            </div>
        `;

        const nowBtn = document.getElementById('wg-timer-now-btn');
        const pauseBtn = document.getElementById('wg-timer-pause-btn');
        const minusBtn = document.getElementById('wg-timer-minus-btn');
        const plusBtn = document.getElementById('wg-timer-plus-btn');

        if (nowBtn) {
            nowBtn.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                const ans = activeTimer.answer;
                const qd = activeTimer.questionData;
                stopActiveTimer();
                if (ans && qd) solveQuestion(ans, qd);
            };
        }
        if (pauseBtn) {
            pauseBtn.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                activeTimer.isPaused = !activeTimer.isPaused;
                pauseBtn.textContent = activeTimer.isPaused ? '▶️ Tiếp' : '⏸️ Dừng';
            };
        }
        if (minusBtn) {
            minusBtn.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (!activeTimer.intervalId && activeTimer.remainingMs <= 0) return;
                activeTimer.remainingMs = Math.max(100, activeTimer.remainingMs - 1000);
                activeTimer.totalMs = Math.max(activeTimer.remainingMs, activeTimer.totalMs - 1000);
                updateTimerDisplay();
            };
        }
        if (plusBtn) {
            plusBtn.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (!activeTimer.intervalId && activeTimer.remainingMs <= 0) return;
                activeTimer.remainingMs += 1000;
                activeTimer.totalMs += 1000;
                updateTimerDisplay();
            };
        }
    }

    async function mainSolver(statusDisplay) {
        stopActiveTimer();

        const questionData = getCurrentQuestionData();
        if (!questionData?.questionId) return;

        // Synchronize fingerprint immediately so subsequent DOM changes don't misidentify this question as a new one
        lastQuestionFingerprint = getQuestionFingerprint();

        const answer = cachedAnswers.get(questionData.questionId);
        if (answer) {
            const displayAnswerText = Array.isArray(answer) ? answer.map(cleanTextForDisplay).join('<br>') : cleanTextForDisplay(answer);

            // 1. Highlight answer with stealth settings
            highlightCorrectAnswers(answer, questionData);

            // 2. Auto or Manual mode
            if (config.autoSelect) {
                let delayMs = Math.max(300, Math.round(config.baseSpeed * 1000));
                let variancePct = 0;
                if (config.randomize) {
                    const variance = (Math.random() * 0.4) - 0.2;
                    variancePct = Math.round(variance * 100);
                    delayMs = Math.max(200, Math.round(delayMs * (1 + variance)));
                }

                if (config.dynamicPacing && questionData) {
                    let textLen = 0;
                    if (questionData.options) {
                        textLen = questionData.options.reduce((sum, o) => sum + (o.rawText?.length || 0), 0);
                    }
                    const extraMs = Math.min(2500, Math.floor(textLen / 40) * 500);
                    delayMs += extraMs;
                }

                activeTimer.remainingMs = delayMs;
                activeTimer.totalMs = delayMs;
                activeTimer.isPaused = false;
                activeTimer.answer = answer;
                activeTimer.questionData = questionData;

                renderLiveTimerUI(statusDisplay, displayAnswerText, variancePct);

                const tickMs = 100;
                activeTimer.intervalId = setInterval(() => {
                    if (activeTimer.isPaused) return;

                    activeTimer.remainingMs -= tickMs;
                    if (activeTimer.remainingMs <= 0) {
                        const ans = activeTimer.answer;
                        const qd = activeTimer.questionData;
                        stopActiveTimer();
                        if (ans && qd) {
                            solveQuestion(ans, qd);
                        }
                    } else {
                        updateTimerDisplay();
                    }
                }, tickMs);
            } else {
                // Manual mode: Highlight answer only, no countdown
                statusDisplay.innerHTML = `
                    <div style="font-weight: 600; color: #38bdf8; margin-bottom: 2px;">💡 Đáp án (Thủ công):</div>
                    <div style="font-size: 13px; font-weight: 700; color: #50fa7b; margin-bottom: 4px;">${displayAnswerText}</div>
                    <div style="margin-top: 4px;">
                        <button id="wg-manual-solve-btn" class="wg-chip-btn" style="color: #38bdf8; font-weight: 600;">⚡ Bấm chọn đáp án này ngay</button>
                    </div>
                `;
                const manualBtn = document.getElementById('wg-manual-solve-btn');
                if (manualBtn) {
                    manualBtn.onclick = () => solveQuestion(answer, questionData);
                }
            }
        } else {
            statusDisplay.textContent = "🔍 Không có đáp án câu này";
            statusDisplay.style.color = "#ffb86c";
        }
    }

    function getQuestionFingerprint() {
        const qd = getCurrentQuestionData();
        if (!qd) return '';
        const optSummary = (qd.options || []).map(o => o.rawText).join('|');
        return `${qd.questionId}__${optSummary}`;
    }

    function checkQuestionChange(statusDisplay) {
        const fp = getQuestionFingerprint();
        if (fp && fp !== lastQuestionFingerprint) {
            stopActiveTimer();
            lastQuestionFingerprint = fp;
            mainSolver(statusDisplay);
        }
    }

    // ==========================================
    // 8. USER INTERFACE INITIALIZATION
    // ==========================================
    function setupUI() {
        if (document.getElementById('solver-panel')) return;

        const savedPin = (safeGetStorage(PIN_STORAGE_KEY) || '').trim();

        const panelHtml = `
            <!-- Floating Mini Restore Icon -->
            <div id="solver-mini-icon" title="Mở bảng Wayground Tool (Alt + H)" data-wg-tool="true">
                ⚡
            </div>

            <!-- Main Panel -->
            <div id="solver-panel" data-wg-tool="true">
                <div class="wg-panel-header">
                    <div class="wg-panel-title-wrap">
                        <span>⚡ Wayground Solver</span>
                    </div>
                    <div class="wg-panel-actions">
                        <button id="wg-panic-btn" class="wg-header-btn" title="Boss Key / Ẩn khẩn cấp (Alt + X)">🚨</button>
                        <button id="wg-min-btn" class="wg-header-btn" title="Thu nhỏ (Alt + H)">−</button>
                    </div>
                </div>
                <div id="solver-status">Đang khởi tạo...</div>
                <div id="key-container" style="display: none;">
                    <div class="wg-input-row">
                        <input type="text" id="key-input" placeholder="Nhập API Key..." value="${currentApiKey}">
                        <button id="save-key-btn">Lưu Key</button>
                    </div>
                    <div class="wg-key-help">
                        Chưa có Key? <a href="https://cheatnetwork.eu/" target="_blank" rel="noopener noreferrer">Lấy API Key tại CheatNetwork ↗</a>
                    </div>
                </div>
                <div id="pin-container" style="display: none;">
                    <div class="wg-input-row">
                        <input type="text" id="pin-input" placeholder="Nhập mã PIN phòng..." value="${savedPin}">
                        <button id="load-btn">Tải</button>
                    </div>
                    <div id="pin-cancel-row" style="display: none; justify-content: flex-end; margin-top: 2px;">
                        <button id="cancel-pin-btn" type="button" style="background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; text-decoration: underline; padding: 2px 4px;">◀ Quay lại bảng điều khiển</button>
                    </div>
                </div>
                <div id="settings-container" class="wg-settings-box" style="display: none;">
                    <label class="wg-checkbox-row">
                        <span>Tự động chọn đáp án</span>
                        <input type="checkbox" id="wg-auto-chk" ${config.autoSelect ? 'checked' : ''}>
                    </label>
                    <label class="wg-checkbox-row" title="Tự động bấm Next/Tiếp theo sau khi chọn xong đáp án">
                        <span>Tự chuyển câu (Next)</span>
                        <input type="checkbox" id="wg-autonext-chk" ${config.autoNext ? 'checked' : ''}>
                    </label>
                    <div class="wg-speed-row">
                        <span>Tốc độ chọn:</span>
                        <div class="wg-stepper-wrap">
                            <button id="wg-speed-minus-btn" class="wg-step-btn" title="Giảm 0.5s">−</button>
                            <div style="display: flex; align-items: center; gap: 2px;">
                                <input type="number" id="wg-speed-input" class="wg-number-input" min="0.2" max="30" step="0.5" value="${config.baseSpeed}">
                                <span style="font-size: 11px; color: #94a3b8;">s</span>
                            </div>
                            <button id="wg-speed-plus-btn" class="wg-step-btn" title="Tăng 0.5s">+</button>
                        </div>
                    </div>
                    <label class="wg-checkbox-row">
                        <span>Ngẫu nhiên thời gian (±20%)</span>
                        <input type="checkbox" id="wg-rand-chk" ${config.randomize ? 'checked' : ''}>
                    </label>
                    <label class="wg-checkbox-row" title="Tự động thêm thời gian dựa theo độ dài câu để mô phỏng người thật">
                        <span>Giả lập đọc đề (câu dài thêm giờ)</span>
                        <input type="checkbox" id="wg-dynamic-chk" ${config.dynamicPacing ? 'checked' : ''}>
                    </label>
                    <div class="wg-select-row">
                        <span>Kiểu highlight:</span>
                        <select id="wg-stealth-select" class="wg-select-input">
                            <option value="ghost" ${config.stealthLevel === 'ghost' ? 'selected' : ''}>👻 Siêu kín đáo (Chỉ bạn biết)</option>
                            <option value="subtle" ${config.stealthLevel === 'subtle' ? 'selected' : ''}>🌿 Mờ nhẹ thanh lịch</option>
                            <option value="standard" ${config.stealthLevel === 'standard' ? 'selected' : ''}>👁️ Viền rõ ràng</option>
                        </select>
                    </div>
                    <div class="wg-nav-row">
                        <button id="wg-prev-btn" class="wg-chip-btn" style="flex: 1;" title="Câu trước (Alt + ←)">◀ Trước</button>
                        <button id="wg-autofill-btn" class="wg-chip-btn wg-chip-primary" style="flex: 1.4;" title="Tự động giải và duyệt qua tất cả các câu hỏi">🚀 Giải Cả Đề</button>
                        <button id="wg-next-btn" class="wg-chip-btn" style="flex: 1;" title="Câu sau (Alt + →)">Tiếp ▶</button>
                    </div>
                    <button id="wg-cheatsheet-btn" class="wg-sheet-btn" style="display: none;">📋 Xem Toàn Bộ Đáp Án</button>
                    <div class="wg-action-btn-row" style="display: flex; gap: 6px; margin-top: 4px;">
                        <button id="change-pin-btn" class="wg-sec-btn" style="flex: 1;" title="Nhập mã phòng khác">🎮 Đổi Mã Phòng</button>
                        <button id="change-key-btn" class="wg-sec-btn" style="flex: 1;" title="Đổi API Key khác">🔑 Đổi Key</button>
                    </div>
                </div>
            </div>

            <!-- Quiz Cheatsheet Modal -->
            <div id="wg-cheatsheet-modal" class="wg-modal-overlay" style="display: none;" data-wg-tool="true">
                <div class="wg-modal-card">
                    <div class="wg-modal-header">
                        <span class="wg-modal-title">📋 Toàn Bộ Đáp Án Đề Thi</span>
                        <button id="wg-close-sheet-btn" class="wg-header-btn">✕</button>
                    </div>
                    <input type="text" id="wg-sheet-search" class="wg-search-input" placeholder="🔍 Tìm câu hỏi / đáp án...">
                    <div id="wg-sheet-list" class="wg-sheet-content"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', panelHtml);

        const panel = document.getElementById('solver-panel');
        const miniIcon = document.getElementById('solver-mini-icon');
        const minBtn = document.getElementById('wg-min-btn');
        const panicBtn = document.getElementById('wg-panic-btn');
        const status = document.getElementById('solver-status');
        const keyContainer = document.getElementById('key-container');
        const pinContainer = document.getElementById('pin-container');
        const settingsContainer = document.getElementById('settings-container');
        const keyInput = document.getElementById('key-input');
        const saveKeyBtn = document.getElementById('save-key-btn');
        const pinInput = document.getElementById('pin-input');
        const loadBtn = document.getElementById('load-btn');
        const changePinBtn = document.getElementById('change-pin-btn');
        const cancelPinBtn = document.getElementById('cancel-pin-btn');
        const changeKeyBtn = document.getElementById('change-key-btn');
        const autoChk = document.getElementById('wg-auto-chk');
        const autoNextChk = document.getElementById('wg-autonext-chk');
        const prevBtn = document.getElementById('wg-prev-btn');
        const nextBtn = document.getElementById('wg-next-btn');
        const autofillBtn = document.getElementById('wg-autofill-btn');
        const speedInput = document.getElementById('wg-speed-input');
        const speedMinusBtn = document.getElementById('wg-speed-minus-btn');
        const speedPlusBtn = document.getElementById('wg-speed-plus-btn');
        const randChk = document.getElementById('wg-rand-chk');
        const dynamicChk = document.getElementById('wg-dynamic-chk');
        const stealthSelect = document.getElementById('wg-stealth-select');
        const cheatsheetBtn = document.getElementById('wg-cheatsheet-btn');
        const cheatsheetModal = document.getElementById('wg-cheatsheet-modal');
        const closeSheetBtn = document.getElementById('wg-close-sheet-btn');
        const sheetSearch = document.getElementById('wg-sheet-search');
        const sheetList = document.getElementById('wg-sheet-list');
        const panelHeader = panel.querySelector('.wg-panel-header');

        // Drag & Move logic for Mobile Touch and Desktop Mouse
        function setupDraggable(element, handle, storageKey) {
            let isDragging = false;
            let startX = 0, startY = 0;
            let initialLeft = 0, initialTop = 0;
            let didMove = false;

            try {
                const saved = safeGetStorage(storageKey);
                if (saved) {
                    const { x, y } = JSON.parse(saved);
                    const maxX = Math.max(8, (window.innerWidth || 360) - element.offsetWidth - 8);
                    const maxY = Math.max(8, (window.innerHeight || 640) - element.offsetHeight - 8);
                    const curX = Math.min(Math.max(8, x), maxX);
                    const curY = Math.min(Math.max(8, y), maxY);
                    element.style.left = curX + 'px';
                    element.style.top = curY + 'px';
                    element.style.bottom = 'auto';
                    element.style.right = 'auto';
                }
            } catch (e) {}

            const onPointerDown = (e) => {
                if (e.button && e.button !== 0) return;
                if (e.target.closest('button, input, a, label, select')) return;

                isDragging = true;
                didMove = false;
                startX = e.clientX;
                startY = e.clientY;

                const rect = element.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;

                try {
                    handle.setPointerCapture(e.pointerId);
                } catch (err) {}
            };

            const onPointerMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                if (!didMove && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                    didMove = true;
                }

                if (didMove) {
                    let newX = initialLeft + dx;
                    let newY = initialTop + dy;

                    const maxX = Math.max(8, (window.innerWidth || 360) - element.offsetWidth - 8);
                    const maxY = Math.max(8, (window.innerHeight || 640) - element.offsetHeight - 8);
                    newX = Math.min(Math.max(8, newX), maxX);
                    newY = Math.min(Math.max(8, newY), maxY);

                    element.style.left = newX + 'px';
                    element.style.top = newY + 'px';
                    element.style.bottom = 'auto';
                    element.style.right = 'auto';
                }
            };

            const onPointerUp = (e) => {
                if (!isDragging) return;
                isDragging = false;
                try {
                    handle.releasePointerCapture(e.pointerId);
                } catch (err) {}

                if (didMove) {
                    const rect = element.getBoundingClientRect();
                    safeSetStorage(storageKey, JSON.stringify({ x: rect.left, y: rect.top }));
                }
            };

            handle.addEventListener('pointerdown', onPointerDown);
            handle.addEventListener('pointermove', onPointerMove);
            handle.addEventListener('pointerup', onPointerUp);
            handle.addEventListener('pointercancel', onPointerUp);

            return () => didMove;
        }

        setupDraggable(panel, panelHeader, 'wg_panel_pos');
        const miniDragMoved = setupDraggable(miniIcon, miniIcon, 'wg_mini_pos');

        // Prevent tool panel clicks and typing from triggering host page listeners
        panel.addEventListener('click', (e) => e.stopPropagation());
        panel.addEventListener('mousedown', (e) => {
            if (!panelHeader.contains(e.target)) {
                e.stopPropagation();
            }
        });

        [keyInput, pinInput, speedInput].forEach(inp => {
            inp.addEventListener('pointerdown', (e) => e.stopPropagation());
            inp.addEventListener('mousedown', (e) => e.stopPropagation());
            inp.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        });

        window.addEventListener('resize', () => {
            [panel, miniIcon].forEach(el => {
                if (!el || el.style.display === 'none') return;
                const rect = el.getBoundingClientRect();
                const maxX = Math.max(8, window.innerWidth - el.offsetWidth - 8);
                const maxY = Math.max(8, window.innerHeight - el.offsetHeight - 8);
                if (rect.left > maxX) el.style.left = maxX + 'px';
                if (rect.top > maxY) el.style.top = maxY + 'px';
            });
        });

        // Minimize / Expand logic
        function setMinimized(minimized) {
            config.minimized = minimized;
            saveConfig(config);
            if (minimized) {
                panel.style.display = 'none';
                miniIcon.style.display = 'flex';
            } else {
                panel.style.display = 'block';
                miniIcon.style.display = 'none';
            }
        }

        minBtn.onclick = () => setMinimized(true);
        miniIcon.onclick = (e) => {
            if (miniDragMoved()) {
                e.stopPropagation();
                return;
            }
            setMinimized(false);
        };

        // Hotkey Alt+H to toggle minimize/expand
        origAddEventListener.call(targetWindow, 'keydown', (e) => {
            if (e.altKey && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                setMinimized(!config.minimized);
            }
        });

        // Boss Key / Panic Mode (Alt+X or 🚨)
        let isPanicked = false;
        let prePanicMinimized = config.minimized;

        function togglePanic() {
            isPanicked = !isPanicked;
            let restoreSpot = document.getElementById('wg-panic-restore-spot');

            if (isPanicked) {
                prePanicMinimized = config.minimized;
                panel.style.display = 'none';
                miniIcon.style.display = 'none';
                cheatsheetModal.style.display = 'none';
                clearHighlights();
                stopActiveTimer();
                stopAutoFill();

                if (!restoreSpot) {
                    restoreSpot = document.createElement('div');
                    restoreSpot.id = 'wg-panic-restore-spot';
                    restoreSpot.style.cssText = 'position:fixed;bottom:0;left:0;width:35px;height:35px;z-index:99999999;opacity:0.001;cursor:default;';
                    restoreSpot.setAttribute('data-wg-tool', 'true');
                    let clickCount = 0;
                    let clickTimer = null;
                    restoreSpot.addEventListener('click', (e) => {
                        e.stopPropagation();
                        clickCount++;
                        clearTimeout(clickTimer);
                        clickTimer = setTimeout(() => { clickCount = 0; }, 600);
                        if (clickCount >= 3) {
                            togglePanic();
                            clickCount = 0;
                        }
                    });
                    document.body.appendChild(restoreSpot);
                } else {
                    restoreSpot.style.display = 'block';
                }
            } else {
                if (restoreSpot) restoreSpot.style.display = 'none';
                setMinimized(prePanicMinimized);
                mainSolver(status);
            }
        }

        panicBtn.onclick = togglePanic;

        origAddEventListener.call(targetWindow, 'keydown', (e) => {
            if (e.altKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                togglePanic();
            }
        });

        // Initialize minimize state
        setMinimized(config.minimized);

        // View States
        function showKeyView() {
            status.textContent = "🔑 Nhập API Key";
            status.style.color = "white";
            keyContainer.style.display = "block";
            pinContainer.style.display = "none";
            settingsContainer.style.display = "none";
            cheatsheetBtn.style.display = "none";
        }

        function showPinView(showCancel = false) {
            status.textContent = "🎮 Nhập mã phòng";
            status.style.color = "white";
            keyContainer.style.display = "none";
            pinContainer.style.display = "block";
            settingsContainer.style.display = "none";
            cheatsheetBtn.style.display = "none";

            const cancelRow = document.getElementById('pin-cancel-row');
            if (cancelRow) {
                cancelRow.style.display = (showCancel && cachedAnswers.size > 0) ? 'flex' : 'none';
            }
            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.textContent = 'Tải';
            }
            setTimeout(() => {
                if (pinInput) {
                    pinInput.focus();
                    pinInput.select();
                }
            }, 60);
        }

        // Settings change listeners
        autoChk.onchange = () => {
            config.autoSelect = autoChk.checked;
            saveConfig(config);
            stopActiveTimer();
            mainSolver(status);
        };

        autoNextChk.onchange = () => {
            config.autoNext = autoNextChk.checked;
            saveConfig(config);
        };

        prevBtn.onclick = () => {
            advancePrevQuestion();
        };

        nextBtn.onclick = () => {
            advanceNextQuestion();
        };

        autofillBtn.onclick = () => {
            runAutoFillAll(status);
        };

        const onSpeedUpdate = (deltaMs = 0) => {
            let val = parseFloat(speedInput.value);
            if (isNaN(val) || val < 0.2) val = 0.5;
            config.baseSpeed = val;
            saveConfig(config);
            if (activeTimer.intervalId && deltaMs !== 0) {
                activeTimer.remainingMs = Math.max(100, activeTimer.remainingMs + deltaMs);
                activeTimer.totalMs = Math.max(activeTimer.remainingMs, activeTimer.totalMs + deltaMs);
                updateTimerDisplay();
            } else if (!activeTimer.intervalId) {
                mainSolver(status);
            }
        };
        speedInput.oninput = () => onSpeedUpdate(0);
        speedInput.onchange = () => {
            onSpeedUpdate(0);
            speedInput.value = config.baseSpeed;
        };

        speedMinusBtn.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            let cur = parseFloat(speedInput.value) || config.baseSpeed;
            cur = Math.max(0.5, Math.round((cur - 0.5) * 10) / 10);
            speedInput.value = cur;
            onSpeedUpdate(-500);
        };

        speedPlusBtn.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            let cur = parseFloat(speedInput.value) || config.baseSpeed;
            cur = Math.min(30, Math.round((cur + 0.5) * 10) / 10);
            speedInput.value = cur;
            onSpeedUpdate(500);
        };

        randChk.onchange = () => {
            config.randomize = randChk.checked;
            saveConfig(config);
            mainSolver(status);
        };

        dynamicChk.onchange = () => {
            config.dynamicPacing = dynamicChk.checked;
            saveConfig(config);
            mainSolver(status);
        };

        stealthSelect.onchange = () => {
            config.stealthLevel = stealthSelect.value;
            saveConfig(config);
            const qd = getCurrentQuestionData();
            if (qd && cachedAnswers.has(qd.questionId)) {
                highlightCorrectAnswers(cachedAnswers.get(qd.questionId), qd);
            }
        };

        // Quiz Cheatsheet Modal Logic
        function renderCheatSheet(filter = '') {
            if (!sheetList) return;
            const normFilter = normalizeText(filter);
            let itemsHtml = '';
            let index = 1;

            cachedQuestionsList.forEach(item => {
                const ans = cachedAnswers.get(item.id);
                if (!ans) return;
                const ansDisplay = Array.isArray(ans) ? ans.join(', ') : String(ans);
                const qPrompt = item.text || item.query?.text || item.structure?.query?.text || '';

                if (normFilter) {
                    const normAns = normalizeText(ansDisplay);
                    const normQ = normalizeText(qPrompt);
                    if (!normAns.includes(normFilter) && !normQ.includes(normFilter)) return;
                }

                itemsHtml += `
                    <div class="wg-sheet-item" style="display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                        <span class="wg-sheet-num" style="min-width: 24px; font-weight: 700; color: #a78bfa; font-size: 11px;">#${index}</span>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                            ${qPrompt ? `<div style="color: #94a3b8; font-size: 11px; line-height: 1.3;">${cleanTextForDisplay(qPrompt)}</div>` : ''}
                            <span class="wg-sheet-ans" style="color: #50fa7b; font-weight: 600; font-size: 12px;">${cleanTextForDisplay(ansDisplay)}</span>
                        </div>
                    </div>
                `;
                index++;
            });

            sheetList.innerHTML = itemsHtml || '<div style="color:#94a3b8; font-size:12px; padding:10px; text-align:center;">Không tìm thấy đáp án phù hợp</div>';
        }

        cheatsheetBtn.onclick = () => {
            renderCheatSheet(sheetSearch.value);
            cheatsheetModal.style.display = 'flex';
            sheetSearch.focus();
        };

        closeSheetBtn.onclick = () => {
            cheatsheetModal.style.display = 'none';
        };

        cheatsheetModal.onclick = (e) => {
            if (e.target === cheatsheetModal) {
                cheatsheetModal.style.display = 'none';
            }
        };

        sheetSearch.oninput = () => {
            renderCheatSheet(sheetSearch.value);
        };

        // Load Answers Action
        let isAnswersLoaded = false;
        let isLoadingAnswers = false;

        const runLoadAnswers = async (manualClick = false) => {
            if (isLoadingAnswers) return;
            if (!manualClick && isAnswersLoaded) return;

            const pin = pinInput.value.trim().replace(/\s+/g, '');
            if (!pin) {
                status.textContent = "⚠️ Vui lòng nhập PIN";
                status.style.color = '#facc15';
                if (pinInput) pinInput.focus();
                return;
            }

            isLoadingAnswers = true;
            if (loadBtn) {
                loadBtn.disabled = true;
                loadBtn.textContent = '⏳';
            }
            status.textContent = "⏳ Đang tải đáp án...";
            status.style.color = '#38bdf8';

            try {
                // If switching rooms or manual click, clear stale answers
                cachedAnswers.clear();
                cachedQuestionsList = [];
                lastQuestionFingerprint = '';

                const success = await fetchAndCacheAnswers(pin, status);
                if (success) {
                    isAnswersLoaded = true;
                    safeSetStorage(PIN_STORAGE_KEY, pin);
                    pinContainer.style.display = 'none';
                    settingsContainer.style.display = 'block';
                    status.textContent = "🚀 Sẵn sàng!";
                    status.style.color = 'white';

                    // Update mini-icon to reflect ready state
                    miniIcon.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                    miniIcon.style.color = '#50fa7b';

                    // Enable Cheatsheet button
                    cheatsheetBtn.style.display = 'block';
                    cheatsheetBtn.textContent = `📋 Xem Toàn Bộ Đáp Án (${cachedAnswers.size} câu)`;

                    // Ensure Question 1 or active question is solved immediately!
                    const bootstrapSolve = (retry = 0) => {
                        const qd = getCurrentQuestionData();
                        if (qd) {
                            checkQuestionChange(status);
                        } else if (retry < 12) {
                            setTimeout(() => bootstrapSolve(retry + 1), 250);
                        }
                    };
                    bootstrapSolve();
                } else {
                    isAnswersLoaded = false;
                    if (status.textContent.includes('Đang tải')) {
                        status.textContent = "❌ Không tìm thấy mã PIN";
                        status.style.color = '#ff5555';
                    }
                }
            } catch (err) {
                isAnswersLoaded = false;
                status.textContent = "❌ Lỗi: " + (err.message || 'Không tải được');
                status.style.color = '#ff5555';
            } finally {
                isLoadingAnswers = false;
                if (loadBtn) {
                    loadBtn.disabled = false;
                    loadBtn.textContent = 'Tải';
                }
            }
        };

        loadBtn.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            runLoadAnswers(true);
        };

        pinInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runLoadAnswers(true);
            }
        };

        pinInput.oninput = () => {
            isAnswersLoaded = false;
        };

        if (changePinBtn) {
            changePinBtn.onclick = () => {
                isAnswersLoaded = false;
                stopActiveTimer();
                stopAutoFill();
                showPinView(true);
            };
        }

        if (cancelPinBtn) {
            cancelPinBtn.onclick = () => {
                if (cachedAnswers.size > 0) {
                    pinContainer.style.display = 'none';
                    settingsContainer.style.display = 'block';
                    cheatsheetBtn.style.display = 'block';
                    status.textContent = "🚀 Sẵn sàng!";
                    status.style.color = 'white';
                    mainSolver(status);
                }
            };
        }

        const onSaveKey = async () => {
            const k = keyInput.value.trim();
            if (!k) return;
            saveKeyBtn.disabled = true;
            if (await authenticateWithKey(k, status)) {
                status.textContent = "✅ Key OK";
                status.style.color = '#50fa7b';
                setTimeout(showPinView, 600);
            } else {
                status.textContent = "❌ Key không đúng";
                status.style.color = '#ff5555';
                saveKeyBtn.disabled = false;
            }
        };

        saveKeyBtn.onclick = onSaveKey;
        keyInput.onkeydown = (e) => {
            if (e.key === 'Enter') onSaveKey();
        };

        changeKeyBtn.onclick = () => {
            safeRemoveStorage(STORAGE_KEY);
            safeRemoveStorage(PIN_STORAGE_KEY);
            currentApiKey = '';
            isAnswersLoaded = false;
            cachedAnswers.clear();
            cachedQuestionsList = [];
            lastQuestionFingerprint = '';
            showKeyView();
        };

        // Continuous PIN Poller until found & loaded
        let pinPoller = null;
        const checkAndApplyPin = () => {
            if (isAnswersLoaded || isLoadingAnswers) {
                if (pinPoller) clearInterval(pinPoller);
                return true;
            }
            const detectedPin = findGamePin();
            if (detectedPin) {
                pinInput.value = detectedPin;
                if (currentApiKey) {
                    if (pinPoller) {
                        clearInterval(pinPoller);
                        pinPoller = null;
                    }
                    status.textContent = "✅ Thấy PIN: " + detectedPin;
                    status.style.color = "#50fa7b";
                    runLoadAnswers();
                }
                return true;
            }
            return false;
        };

        // DOM Mutation Observer for question transitions
        let isObserverProcessing = false;
        const observer = new MutationObserver((mutations) => {
            if (isObserverProcessing) return;

            // Filter out mutations that originated exclusively inside tool elements
            const hasExternalMutation = mutations.some(m => {
                const target = m.target;
                if (!target) return false;
                if (target.nodeType === 3) {
                    return !target.parentElement?.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]');
                }
                if (target.closest) {
                    return !target.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]');
                }
                return true;
            });

            if (!hasExternalMutation) return;

            isObserverProcessing = true;
            try {
                checkQuestionChange(status);
                if (!isAnswersLoaded && !isLoadingAnswers) {
                    checkAndApplyPin();
                }
            } finally {
                isObserverProcessing = false;
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        // Keyboard navigation listeners: ArrowRight / ArrowLeft
        origAddEventListener.call(targetWindow, 'keyup', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                setTimeout(() => checkQuestionChange(status), 250);
            }
        });

        // Navigation hotkeys: Alt + Left (Prev), Alt + Right (Next)
        origAddEventListener.call(targetWindow, 'keydown', (e) => {
            if (e.altKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
                e.preventDefault();
                advancePrevQuestion();
            } else if (e.altKey && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) {
                e.preventDefault();
                advanceNextQuestion();
            }
        });

        // Intercept clicks on web buttons that might trigger question changes
        origAddEventListener.call(targetWindow, 'click', (e) => {
            if (e.target && !e.target.closest('#solver-panel, #solver-mini-icon, #wg-cheatsheet-modal, [data-wg-tool]')) {
                setTimeout(() => checkQuestionChange(status), 300);
            }
        }, true);

        // Initialize state & start PIN detection
        if (currentApiKey) {
            showPinView();
            if (!checkAndApplyPin()) {
                pinPoller = setInterval(() => {
                    if (checkAndApplyPin()) {
                        clearInterval(pinPoller);
                        pinPoller = null;
                    }
                }, 300);
                setTimeout(() => {
                    if (pinPoller) clearInterval(pinPoller);
                }, 30000);
            }
        } else {
            showKeyView();
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setupUI();
    } else {
        setTimeout(setupUI, 500);
    }
})();
