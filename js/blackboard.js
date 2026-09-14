/* 黒板オーバーレイのドラッグ移動・角ハンドルでのリサイズを担当 */
const Blackboard = (() => {
  let el, handle, wrap;
  let dragging = false, resizing = false;
  let startX, startY, startLeft, startTop, startW, startH;

  function init() {
    el = document.getElementById('blackboard');
    handle = document.getElementById('bbResizeHandle');
    wrap = document.querySelector('.camera-wrap');

    // 保存済みの位置・サイズを復元
    restoreLayout();

    el.addEventListener('pointerdown', onDragStart);
    handle.addEventListener('pointerdown', onResizeStart);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
  }

  function onDragStart(e) {
    if (e.target === handle) return; // ハンドル側はリサイズ扱い
    dragging = true;
    el.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    startLeft = rect.left - wrapRect.left;
    startTop = rect.top - wrapRect.top;
  }

  function onResizeStart(e) {
    resizing = true;
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    const rect = el.getBoundingClientRect();
    startW = rect.width; startH = rect.height;
  }

  function onMove(e) {
    if (!dragging && !resizing) return;
    const wrapRect = wrap.getBoundingClientRect();

    if (dragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      // 画面外にはみ出さないよう制限
      newLeft = Math.max(0, Math.min(newLeft, wrapRect.width - el.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, wrapRect.height - el.offsetHeight));
      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
    }

    if (resizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = Math.max(100, startW + dx);
      let newH = Math.max(60, startH + dy);
      // 画面からはみ出さないよう上限も設定
      const rect = el.getBoundingClientRect();
      newW = Math.min(newW, wrapRect.width - (rect.left - wrapRect.left));
      newH = Math.min(newH, wrapRect.height - (rect.top - wrapRect.top));
      el.style.width = newW + 'px';
      el.style.height = newH + 'px';
    }
  }

  function onEnd() {
    if (dragging || resizing) saveLayout();
    dragging = false;
    resizing = false;
  }

  function saveLayout() {
    const rect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const layout = {
      leftPct: (rect.left - wrapRect.left) / wrapRect.width,
      topPct: (rect.top - wrapRect.top) / wrapRect.height,
      widthPct: rect.width / wrapRect.width,
      heightPct: rect.height / wrapRect.height
    };
    YutecDB.setSetting('bbLayout', layout);
  }

  async function restoreLayout() {
    const layout = await YutecDB.getSetting('bbLayout', null);
    if (!layout) return;
    const wrapRect = wrap.getBoundingClientRect();
    el.style.left = (layout.leftPct * wrapRect.width) + 'px';
    el.style.top = (layout.topPct * wrapRect.height) + 'px';
    el.style.width = (layout.widthPct * wrapRect.width) + 'px';
    el.style.height = (layout.heightPct * wrapRect.height) + 'px';
  }

  function setVisible(visible) {
    el.classList.toggle('hidden', !visible);
  }

  function setContent({ koji, koshu, sokuten, date }) {
    document.getElementById('bbKoji').textContent = koji || '－';
    document.getElementById('bbKoshu').textContent = koshu || '－';
    document.getElementById('bbSokuten').textContent = sokuten || '－';
    document.getElementById('bbDate').textContent = date || '－';
  }

  function getElement() { return el; }
  function isVisible() { return !el.classList.contains('hidden'); }

  return { init, setVisible, setContent, getElement, isVisible };
})();
