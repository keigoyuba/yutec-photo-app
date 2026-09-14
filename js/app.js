/* 画面遷移・チェックリスト・撮影ボタンの処理などアプリ全体の制御 */
const Toast = (() => {
  let el, timer;
  function show(msg) {
    if (!el) el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  return { show };
})();

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// サンプルの撮影チェックリスト（本来はSheets連携で流し込む。現段階ではダミーデータ）
const SAMPLE_CHECKLIST = [
  { id: 1, koshu: '配管布設工', sokuten: 'No.1', label: '布設状況（全景）', done: false },
  { id: 2, koshu: '配管布設工', sokuten: 'No.1', label: '継手部（接合前）', done: false },
  { id: 3, koshu: '配管布設工', sokuten: 'No.2', label: '布設状況（全景）', done: false },
  { id: 4, koshu: '管更生工', sokuten: 'No.1', label: '施工前状況', done: false }
];

async function renderChecklist() {
  let items = await YutecDB.getChecklist();
  if (items.length === 0) {
    await YutecDB.setChecklist(SAMPLE_CHECKLIST);
    items = SAMPLE_CHECKLIST;
  }
  const area = document.getElementById('checklistArea');
  area.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'list-item';
    btn.innerHTML = `<span>${item.koshu} ${item.sokuten}｜${item.label}</span>
      <span class="${item.done ? 'check' : 'uncheck'}">${item.done ? '✔ 撮影済' : '未撮影'}</span>`;
    btn.onclick = async () => {
      await YutecDB.updateChecklistItem(item.id, !item.done);
      renderChecklist();
      updateChecklistBadge();
    };
    area.appendChild(btn);
  });
}

async function updateChecklistBadge() {
  const items = await YutecDB.getChecklist();
  const remaining = items.filter(i => !i.done).length;
  const badge = document.getElementById('checklistBadge');
  if (remaining > 0) {
    badge.style.display = 'flex';
    badge.textContent = remaining;
  } else {
    badge.style.display = 'none';
  }
}

// 黒板選択リスト（工種・測点の組み合わせ。現段階ではチェックリストと同じダミーデータから生成）
async function renderBlackboardList() {
  const items = await YutecDB.getChecklist();
  const area = document.getElementById('bbList');
  area.innerHTML = '';
  const uniq = [];
  const seen = new Set();
  items.forEach(i => {
    const key = i.koshu + '|' + i.sokuten;
    if (!seen.has(key)) { seen.add(key); uniq.push(i); }
  });
  uniq.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'list-item';
    btn.innerHTML = `<span>${item.koshu}｜${item.sokuten}</span><span>選択</span>`;
    btn.onclick = () => {
      currentBlackboard = { koshu: item.koshu, sokuten: item.sokuten };
      applyBlackboardContent();
      showScreen('camera');
    };
    area.appendChild(btn);
  });
}

let currentKoji = 'ユテック水道管布設工事';
let currentBlackboard = { koshu: '－', sokuten: '－' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function applyBlackboardContent() {
  Blackboard.setContent({
    koji: currentKoji,
    koshu: currentBlackboard.koshu,
    sokuten: currentBlackboard.sokuten,
    date: todayStr()
  });
}

async function refreshSyncBadge() {
  const count = await YutecDB.countUnsynced();
  document.getElementById('syncBadge').textContent = `同期待ち: ${count}`;
}

async function renderGallery() {
  const photos = await YutecDB.getAllPhotos();
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';
  photos.forEach(p => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(p.blob);
    grid.appendChild(img);
  });
}

async function handleCapture() {
  const wrapRect = document.querySelector('.camera-wrap').getBoundingClientRect();
  const result = await CameraModule.capture(Blackboard.isVisible(), {
    koji: currentKoji, koshu: currentBlackboard.koshu, sokuten: currentBlackboard.sokuten, date: todayStr()
  }, wrapRect);
  if (!result) return;

  await YutecDB.addPhoto({
    blob: result.blob,
    width: result.width,
    height: result.height,
    kojiName: currentKoji,
    koshu: currentBlackboard.koshu,
    sokuten: currentBlackboard.sokuten
  });

  const sizeKB = Math.round(result.blob.size / 1024);
  Toast.show(`撮影しました（${result.width}×${result.height} / 約${sizeKB}KB）`);
  refreshSyncBadge();
}

function initUI() {
  document.getElementById('currentKojiName').textContent = currentKoji;

  document.getElementById('btnMenu').onclick = () => showScreen('menu');
  document.getElementById('btnChecklist').onclick = () => { renderChecklist(); showScreen('checklist'); };
  document.getElementById('btnBlackboardSelect').onclick = () => { renderBlackboardList(); showScreen('bbselect'); };
  document.getElementById('btnCapture').onclick = handleCapture;

  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.onclick = () => showScreen(btn.dataset.back);
  });

  document.getElementById('bbToggle').onchange = (e) => Blackboard.setVisible(e.target.checked);

  document.getElementById('menuGallery').onclick = () => { renderGallery(); showScreen('gallery'); };
  document.getElementById('menuSettings').onclick = () => showScreen('settings');
  document.getElementById('menuKojiSelect').onclick = () => {
    const name = prompt('工事件名を入力してください', currentKoji);
    if (name) { currentKoji = name; document.getElementById('currentKojiName').textContent = name; applyBlackboardContent(); }
  };
  document.getElementById('menuSheetImport').onclick = () => {
    Toast.show('Sheets連携は次の開発ステップで実装予定です');
  };

  document.querySelectorAll('input[name="syncMode"]').forEach(radio => {
    radio.onchange = async (e) => {
      await YutecDB.setSetting('syncMode', e.target.value);
      Toast.show(e.target.value === 'wifi' ? 'Wi-Fi接続時のみ同期します' : '通常回線でも同期します');
    };
  });

  applyBlackboardContent();
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function setupOrientation() {
  const hint = document.getElementById('rotateHint');
  const msg = document.getElementById('rotateHintMsg');

  if (!isStandalone()) {
    msg.innerHTML = 'このアプリはホーム画面に追加してから起動すると、全画面・横向き固定で使えます。<br>まだの方は、ブラウザのメニューから「ホーム画面に追加」してください。';
    // ブラウザタブ表示の場合は常時ヒントは出さず、初回トーストのみで案内
    Toast.show('ホーム画面に追加すると全画面表示になります');
  }

  // Android・standalone環境では横向き固定を試みる（iOS Safariは非対応のためtry-catchで無視）
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (e) {
    // iOSや非対応環境では失敗するのが正常。CSSのorientationイベントで補助する
  }

  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    // 横向き固定が効いていない環境（主にiPhone）向けに、縦のままなら回転を促す
    hint.classList.toggle('show', isPortrait);
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();
}

async function main() {
  Blackboard.init();
  await CameraModule.init();
  initUI();
  await updateChecklistBadge();
  await refreshSyncBadge();
  await setupOrientation();

  const syncMode = await YutecDB.getSetting('syncMode', 'wifi');
  document.querySelector(`input[name="syncMode"][value="${syncMode}"]`).checked = true;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
}

document.addEventListener('DOMContentLoaded', main);
