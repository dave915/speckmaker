import type { Screen } from './types';

export const FRAME_WIDTH = 740;
export const FRAME_BASE_HEIGHT = 880;
export const FRAME_MAX_HEIGHT = 20000;
const candidates = ['[role="tab"]', '[data-bs-toggle="tab"], [data-toggle="tab"]', 'button[data-tab], a[data-tab], [data-tab-target]', '.tabs .tab, .tab-bar .tab, .tab-nav button, .tab-buttons button, .tabs button, .tab-btn, .tab-button, .tab', 'button[onclick*="Tab"], button[onclick*="tab"], a[onclick*="Tab"], a[onclick*="tab"]'];

export function detectScreens(html: string): Screen[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const selector of candidates) {
    const tabs = [...doc.querySelectorAll(selector)];
    if (tabs.length > 1) return tabs.slice(0, 12).map((tab, index) => ({
      name: tab.textContent?.trim().slice(0, 60) || `화면 ${index + 1}`, selector, index,
      panelId: tab.getAttribute('aria-controls') || tab.getAttribute('data-bs-target')?.replace(/^#/, '') || tab.getAttribute('data-target')?.replace(/^#/, '') || undefined,
    }));
  }
  return [{ name: doc.title || '기본 화면' }];
}

export function screenHtml(html: string, screen: Screen, channel: string): string {
  const config = JSON.stringify({ screen, channel }).replaceAll('<', '\\u003c');
  // The bridge lives in the sandbox. The parent accepts messages only from its own frame window.
  const script = `<script>(function () {
    var config = ${config}, screen = config.screen;
    var activated = false, interacted = false, pending = 0, lastHeight = 0;
    var lastViewport = 0, growthLoops = 0, released = [], dragging = false, space = false;
    function send(type, values) { parent.postMessage(Object.assign({speck: config.channel, type: type}, values || {}), '*'); }
    function measure() {
      pending = 0;
      if (!document.body) return;
      var height = Math.ceil(Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.scrollHeight));
      var viewport = window.innerHeight;
      // Some apps deliberately use 100vh plus an overflowing child. Preserve their scrolling
      // instead of repeatedly growing the viewport forever.
      if (viewport !== lastViewport && height > viewport + 2 && lastHeight > 0) growthLoops++;
      else if (height <= viewport + 2) growthLoops = 0;
      lastViewport = viewport;
      if (height !== lastHeight && growthLoops < 3) {
        lastHeight = height;
        send('height', {height: Math.max(880, Math.min(20000, height))});
      }
    }
    function schedule() { if (!pending) pending = requestAnimationFrame(measure); }
    function panelId(button) {
      var target = button.getAttribute('aria-controls') || button.getAttribute('data-bs-target') || button.getAttribute('data-target') || button.getAttribute('data-tab-target') || button.getAttribute('data-tab') || button.getAttribute('href');
      return target ? target.replace(/^#/, '') : null;
    }
    function restoreFallback() { released.forEach(function (restore) { restore(); }); released = []; }
    function revealIfNeeded(id) {
      var panel = id && document.getElementById(id);
      if (!panel || (getComputedStyle(panel).display !== 'none' && !panel.hidden)) { schedule(); return; }
      Array.from(panel.parentElement.children).forEach(function (item) {
        if (item !== panel && item.getAttribute('role') !== 'tabpanel' && !item.matches('.tab-pane,.tab-panel,.tab-content')) return;
        var hidden = item.hidden, display = item.style.getPropertyValue('display'), priority = item.style.getPropertyPriority('display');
        released.push(function () { item.hidden = hidden; if (display) item.style.setProperty('display', display, priority); else item.style.removeProperty('display'); });
        item.hidden = item !== panel;
        item.style.setProperty('display', item === panel ? 'block' : 'none', 'important');
      });
      schedule();
    }
    function activate() {
      if (activated || interacted) return;
      var button = screen.selector ? document.querySelectorAll(screen.selector)[screen.index || 0] : null;
      if (screen.selector && !button) return;
      activated = true;
      if (button) button.click();
      setTimeout(function () { revealIfNeeded(screen.panelId || (button && panelId(button))); }, 0);
    }
    document.addEventListener('click', function (event) {
      if (event.isTrusted) interacted = true;
      var button = screen.selector && event.target instanceof Element ? event.target.closest(screen.selector) : null;
      if (!button) return;
      restoreFallback();
      growthLoops = 0;
      setTimeout(function () { revealIfNeeded(panelId(button)); }, 0);
    }, true);
    document.addEventListener('pointerdown', function (event) {
      if (event.isTrusted) interacted = true;
      send('focus');
      if (space || event.button === 1) {
        event.preventDefault(); dragging = true;
        send('pan-start', {x: event.clientX, y: event.clientY});
      }
    }, true);
    document.addEventListener('pointermove', function (event) {
      if (dragging) { event.preventDefault(); send('pan-move', {x: event.clientX, y: event.clientY}); }
      else send('pointer', {x: event.clientX, y: event.clientY});
    }, true);
    document.addEventListener('pointerup', function () { if (dragging) { dragging = false; send('pan-end'); } }, true);
    document.addEventListener('wheel', function (event) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault(); send('zoom', {deltaY: event.deltaY, x: event.clientX, y: event.clientY});
      } else if (!event.target.closest('textarea,select')) {
        // Keep authored scrollable panels usable. Outside those, wheel gestures move the canvas.
        var node = event.target, scrollable = false;
        while (node && node !== document.body && node !== document.documentElement) {
          var style = getComputedStyle(node);
          if ((/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) || (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)) { scrollable = true; break; }
          node = node.parentElement;
        }
        if (!scrollable && document.documentElement.scrollHeight <= window.innerHeight + 2) {
          event.preventDefault(); send('pan-wheel', {deltaX: event.deltaX, deltaY: event.deltaY});
        }
      }
    }, {passive: false});
    document.addEventListener('keydown', function (event) {
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.code === 'Space') { event.preventDefault(); space = true; }
      if (['c','v','h','1','+','=','-','Escape'].indexOf(event.key) !== -1) {
        event.preventDefault(); send('shortcut', {key: event.key});
      }
    });
    document.addEventListener('keyup', function (event) { if (event.code === 'Space') { space = false; dragging = false; send('pan-end'); } });
    window.addEventListener('blur', function () { space = false; dragging = false; send('pan-end'); });
    function ready() {
      activate(); schedule();
      new ResizeObserver(schedule).observe(document.body);
      new MutationObserver(schedule).observe(document.body, {subtree:true,childList:true,attributes:true,characterData:true});
      document.addEventListener('load', schedule, true);
      if (document.fonts) document.fonts.ready.then(schedule);
      [100, 400, 1000].forEach(function (delay) { setTimeout(function () { activate(); schedule(); }, delay); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true}); else ready();
    window.addEventListener('load', schedule, {once:true});
  })();<\/script>`;
  const csp = '<meta http-equiv="Content-Security-Policy" content="base-uri \'none\'; form-action \'none\'; object-src \'none\'">';
  return html.replace(/<head([^>]*)>/i, `<head$1>${csp}`) + script;
}
