(function () {
    'use strict';

    // ── 1. Single point of truth: the exam_security_active flag ──────────────
    const FLAG = 'exam_security_active';
    const real = Storage.prototype.getItem;
    const realSet = Storage.prototype.setItem;

    Storage.prototype.getItem = function (key) {
        if (key === FLAG) return null;
        return real.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
        if (key === FLAG) return;
        return realSet.call(this, key, value);
    };

    // ── 2. Kill the "Mode Ujian Terkunci" overlay + script nodes ─────────────
    const scrub = () => {
        const overlay = document.getElementById('quiz-lock-overlay');
        if (overlay) overlay.remove();

        document.querySelectorAll('.path-mod-quiz .que').forEach(el => {
            el.style.webkitUserSelect = 'text';
            el.style.mozUserSelect = 'text';
            el.style.msUserSelect = 'text';
            el.style.userSelect = 'text';
        });

        document.querySelectorAll('script').forEach(s => {
            if (s.textContent && s.textContent.includes('quiz-lock-overlay')) s.remove();
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scrub);
    } else {
        scrub();
    }
})();
