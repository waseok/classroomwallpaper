// =============================================
// CONSTANTS
// =============================================
const COLORS = ['#3b82f6','#8b5cf6','#f97316','#10b981','#ef4444','#ec4899','#14b8a6','#f59e0b'];
const DAYS_KR = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
const DAY_LABELS = ['월','화','수','목','금'];

const DEFAULT_RULES = [
  { title: '서로 존중하기', desc: '친구의 말에 귀 기울이고, 다름을 인정해요', color: '#3b82f6' },
  { title: '수업에 집중하기', desc: '선생님이 말씀하실 때 경청하고 적극적으로 참여해요', color: '#8b5cf6' },
  { title: '교실을 깨끗하게', desc: '내 자리는 내가 정리하고, 함께 쓰는 공간을 소중히 해요', color: '#f97316' },
  { title: '시간 약속 지키기', desc: '수업 시작 전 자리에 앉고, 정해진 시간을 잘 지켜요', color: '#10b981' },
];

const DEFAULT_TIMETABLE = [
  { label: '1교시', start: '09:00', end: '09:40', type: 'in-class', days: [1,2,3,4,5], subjects: {} },
  { label: '2교시', start: '09:50', end: '10:30', type: 'in-class', days: [1,2,3,4,5], subjects: {} },
  { label: '3교시', start: '10:40', end: '11:20', type: 'in-class', days: [1,2,3,4,5], subjects: {} },
  { label: '4교시', start: '11:30', end: '12:10', type: 'in-class', days: [1,2,3,4,5], subjects: {} },
  { label: '점심시간', start: '12:10', end: '13:00', type: 'lunch-time', days: [1,2,3,4,5], subjects: {} },
  { label: '5교시', start: '13:00', end: '13:40', type: 'in-class', days: [1,2,3,4,5], subjects: {} },
  { label: '6교시', start: '13:50', end: '14:30', type: 'in-class', days: [2], subjects: {} },
];

// =============================================
// STATE
// =============================================
let rules = [];
let isEditing = false;
let timetable = [];
let settings = { showRemaining: true, chimeEnabled: true, colonBlink: true, showSeconds: true, timetableMode: false, dailyPeriods: { 1:5, 2:6, 3:5, 4:5, 5:5 } };
let viewData = { activeTab: 'rules', notebook: '', notices: [] };
let lastPeriodLabel = null;
let lastChimeTime = 0;
let audioCtx = null;
let notebookTimer = null;

let drag = {
  active: false, cardEl: null, index: -1, currentIndex: -1,
  startY: 0, offsetY: 0, cardRects: [], cardH: 0,
};

let ttDrag = {
  active: false, rowEl: null, index: -1, currentIndex: -1,
  startY: 0, offsetY: 0, cardRects: [], cardH: 0, rows: [],
};

// =============================================
// HELPERS
// =============================================
function timeToMins(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(mins) {
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}

// =============================================
// LOAD / SAVE
// =============================================
function loadRules() {
  try {
    const s = localStorage.getItem('classroomRules');
    rules = s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_RULES));
  } catch { rules = JSON.parse(JSON.stringify(DEFAULT_RULES)); }
}
function saveRules() { localStorage.setItem('classroomRules', JSON.stringify(rules)); }

function loadTimetable() {
  try {
    const s = localStorage.getItem('classroomTimetable');
    timetable = s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_TIMETABLE));
  } catch { timetable = JSON.parse(JSON.stringify(DEFAULT_TIMETABLE)); }
  timetable.forEach(entry => { if (!entry.subjects) entry.subjects = {}; });
}
function saveTimetable() {
  timetable.sort((a, b) => timeToMins(a.start) - timeToMins(b.start));
  localStorage.setItem('classroomTimetable', JSON.stringify(timetable));
}

function loadSettings() {
  try {
    const s = localStorage.getItem('classroomSettings');
    if (s) {
      const saved = JSON.parse(s);
      settings = { ...settings, ...saved };
      if (!settings.dailyPeriods) settings.dailyPeriods = { 1:5, 2:6, 3:5, 4:5, 5:5 };
      if (settings.chimeEnabled === undefined) settings.chimeEnabled = true;
      if (settings.colonBlink === undefined) settings.colonBlink = true;
      if (settings.showSeconds === undefined) settings.showSeconds = true;
      if (settings.timetableMode === undefined) settings.timetableMode = false;
    }
  } catch { /* keep defaults */ }
}
function saveSettings() { localStorage.setItem('classroomSettings', JSON.stringify(settings)); }

function loadViewData() {
  try {
    const s = localStorage.getItem('classroomViewData');
    if (s) viewData = JSON.parse(s);
  } catch { /* keep defaults */ }
}
function saveViewData() { localStorage.setItem('classroomViewData', JSON.stringify(viewData)); }

// =============================================
// RENDER RULES
// =============================================
function renderRules() {
  const container = document.getElementById('rulesContainer');
  container.innerHTML = '';
  document.getElementById('rightPanel').classList.toggle('edit-mode', isEditing);

  rules.forEach((rule, i) => {
    const card = document.createElement('div');
    card.className = 'rule-card';
    card.dataset.index = i;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#10303;';
    handle.addEventListener('pointerdown', e => startDrag(e, i, card));

    const numWrap = document.createElement('div');
    numWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    const num = document.createElement('div');
    num.className = 'rule-number';
    num.style.color = rule.color || COLORS[i % COLORS.length];
    num.textContent = String(i + 1).padStart(2, '0');
    numWrap.appendChild(num);

    const palette = document.createElement('div');
    palette.className = 'number-colors';
    COLORS.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (c === rule.color ? ' active' : '');
      dot.style.background = c;
      dot.onclick = () => { rules[i].color = c; saveRules(); renderRules(); };
      palette.appendChild(dot);
    });
    numWrap.appendChild(palette);

    const content = document.createElement('div');
    content.className = 'rule-content';

    const title = document.createElement('div');
    title.className = 'rule-title';
    title.textContent = rule.title;
    title.contentEditable = isEditing;
    title.spellcheck = false;
    title.addEventListener('blur', () => { rules[i].title = title.textContent.trim() || '새 규칙'; saveRules(); });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });

    const desc = document.createElement('div');
    desc.className = 'rule-desc';
    desc.textContent = rule.desc;
    desc.contentEditable = isEditing;
    desc.spellcheck = false;
    desc.addEventListener('blur', () => { rules[i].desc = desc.textContent.trim(); saveRules(); });
    desc.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); desc.blur(); } });

    content.appendChild(title);
    content.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'rule-actions';

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete-btn';
    delBtn.innerHTML = '&#10005;';
    delBtn.onclick = () => {
      card.style.transition = 'transform 0.3s, opacity 0.3s';
      card.style.transform = 'scale(0.8)';
      card.style.opacity = '0';
      setTimeout(() => { rules.splice(i, 1); saveRules(); renderRules(); showToast('규칙이 삭제되었어요'); }, 250);
    };
    actions.appendChild(delBtn);

    card.appendChild(handle);
    card.appendChild(numWrap);
    card.appendChild(content);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

// =============================================
// DRAG & DROP
// =============================================
function startDrag(e, index, cardEl) {
  if (!isEditing) return;
  e.preventDefault();

  const container = document.getElementById('rulesContainer');
  const cards = [...container.querySelectorAll('.rule-card')];
  const rect = cardEl.getBoundingClientRect();

  const rects = cards.map(c => c.getBoundingClientRect());
  const cardH = rect.height;

  drag = {
    active: true, cardEl, index, currentIndex: index,
    startY: e.clientY, offsetY: e.clientY - rect.top,
    cardRects: rects, cardH, cards,
  };

  cardEl.classList.add('is-lifted');
  cardEl.style.setProperty('--card-width', rect.width + 'px');
  cardEl.style.left = rect.left + 'px';
  cardEl.style.top = (e.clientY - drag.offsetY) + 'px';

  cards.forEach(c => c.style.setProperty('--card-h', cardH + 'px'));
  document.body.classList.add('is-dragging');

  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
}

function onDragMove(e) {
  if (!drag.active) return;
  const { cardEl, offsetY, index, cards, cardRects, cardH } = drag;

  cardEl.style.top = (e.clientY - offsetY) + 'px';

  const centerY = e.clientY - offsetY + cardH / 2;
  let newIndex = index;

  for (let i = 0; i < cardRects.length; i++) {
    const r = cardRects[i];
    const midY = r.top + r.height / 2;
    if (i < index && centerY < midY) { newIndex = i; break; }
    if (i > index && centerY > midY) { newIndex = i; }
  }

  if (newIndex !== drag.currentIndex) {
    drag.currentIndex = newIndex;
    cards.forEach((c, i) => {
      if (i === index) return;
      c.classList.remove('shift-down', 'shift-up');
      if (index < newIndex) {
        if (i > index && i <= newIndex) c.classList.add('shift-up');
      } else if (index > newIndex) {
        if (i >= newIndex && i < index) c.classList.add('shift-down');
      }
    });
  }
}

function onDragEnd() {
  if (!drag.active) return;
  const { cardEl, index, currentIndex, cards } = drag;

  cardEl.classList.remove('is-lifted');
  cardEl.style.cssText = '';
  cards.forEach(c => { c.classList.remove('shift-down', 'shift-up'); c.style.removeProperty('--card-h'); });
  document.body.classList.remove('is-dragging');

  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);

  if (index !== currentIndex) {
    const moved = rules.splice(index, 1)[0];
    rules.splice(currentIndex, 0, moved);
    saveRules();
    showToast('순서가 변경되었어요');
  }

  drag.active = false;
  renderRules();
}

// =============================================
// ADD RULE / TOGGLE EDIT / TOAST
// =============================================
function addRule() {
  rules.push({ title: '새 규칙', desc: '설명을 입력하세요', color: COLORS[rules.length % COLORS.length] });
  saveRules(); renderRules();
  showToast('새 규칙이 추가되었어요');
  setTimeout(() => {
    const titles = document.querySelectorAll('.rule-title');
    const last = titles[titles.length - 1];
    if (last) { last.focus(); document.execCommand('selectAll', false, null); }
  }, 100);
}

function toggleEdit() {
  isEditing = !isEditing;
  const btn = document.getElementById('editToggle');
  btn.textContent = isEditing ? '완료' : '편집';
  btn.classList.toggle('active', isEditing);
  renderRules();
  if (!isEditing) showToast('저장되었어요');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// =============================================
// SETTINGS
// =============================================
function toggleShowRemaining() {
  settings.showRemaining = document.getElementById('showRemainingToggle').checked;
  saveSettings();
}

function openSettings() {
  document.getElementById('settingsModal').classList.add('open');
  document.getElementById('showRemainingToggle').checked = settings.showRemaining;
  document.getElementById('chimeToggle').checked = settings.chimeEnabled;
  document.getElementById('colonBlinkToggle').checked = settings.colonBlink;
  document.getElementById('secondsToggle').checked = settings.showSeconds;
  document.getElementById('timetableModeToggle').checked = settings.timetableMode;
  renderDailyPeriods();
  renderTimetableEditor();
  renderSubjectGrid();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

// =============================================
// CHANGELOG
// =============================================
function openChangelog() {
  document.getElementById('changelogModal').classList.add('open');
}

function closeChangelog() {
  document.getElementById('changelogModal').classList.remove('open');
}

// =============================================
// TIMETABLE EDITOR
// =============================================
function renderTimetableEditor() {
  const container = document.getElementById('ttList');
  container.innerHTML = '';

  timetable.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'tt-row';

    // Label
    const labelInput = document.createElement('input');
    labelInput.className = 'tt-label-input';
    labelInput.type = 'text';
    labelInput.value = entry.label;
    labelInput.addEventListener('change', () => {
      timetable[i].label = labelInput.value.trim() || '새 교시';
      saveTimetable();
    });

    // Start time
    const startInput = document.createElement('input');
    startInput.className = 'tt-time-input';
    startInput.type = 'time';
    startInput.value = entry.start;
    startInput.addEventListener('change', () => {
      if (startInput.value) {
        timetable[i].start = startInput.value;
        saveTimetable();
        renderTimetableEditor();
      } else {
        startInput.value = timetable[i].start;
      }
    });

    const sep = document.createElement('span');
    sep.className = 'tt-separator';
    sep.textContent = '~';

    // End time
    const endInput = document.createElement('input');
    endInput.className = 'tt-time-input';
    endInput.type = 'time';
    endInput.value = entry.end;
    endInput.addEventListener('change', () => {
      if (endInput.value) {
        timetable[i].end = endInput.value;
        saveTimetable();
        renderTimetableEditor();
      } else {
        endInput.value = timetable[i].end;
      }
    });

    // Type
    const typeSelect = document.createElement('select');
    typeSelect.className = 'tt-type-select';
    [['in-class', '수업'], ['lunch-time', '점심'], ['break-time', '쉬는시간']].forEach(([val, txt]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = txt;
      if (val === entry.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      timetable[i].type = typeSelect.value;
      saveTimetable();
    });

    // Day buttons
    const daysDiv = document.createElement('div');
    daysDiv.className = 'tt-days';
    DAY_LABELS.forEach((dayLabel, di) => {
      const dayNum = di + 1;
      const btn = document.createElement('button');
      btn.className = 'tt-day-btn' + (entry.days.includes(dayNum) ? ' active' : '');
      btn.textContent = dayLabel;
      btn.addEventListener('click', () => {
        const idx = entry.days.indexOf(dayNum);
        if (idx >= 0) entry.days.splice(idx, 1);
        else { entry.days.push(dayNum); entry.days.sort(); }
        saveTimetable();
        renderTimetableEditor();
      });
      daysDiv.appendChild(btn);
    });

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'tt-delete-btn';
    delBtn.innerHTML = '&#10005;';
    delBtn.addEventListener('click', () => {
      timetable.splice(i, 1);
      saveTimetable();
      renderTimetableEditor();
      showToast('시간이 삭제되었어요');
    });

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'tt-drag-handle';
    handle.innerHTML = '&#10303;';
    handle.addEventListener('pointerdown', e => startTtDrag(e, i, row));

    row.appendChild(handle);
    row.appendChild(labelInput);
    row.appendChild(startInput);
    row.appendChild(sep);
    row.appendChild(endInput);
    row.appendChild(typeSelect);
    row.appendChild(daysDiv);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function addTimetableEntry() {
  const lastEntry = timetable[timetable.length - 1];
  let startMins = lastEntry ? timeToMins(lastEntry.end) + 10 : 540;
  let endMins = startMins + 40;
  if (endMins > 1439) endMins = 1439;

  timetable.push({
    label: (timetable.length + 1) + '교시',
    start: minsToTime(startMins),
    end: minsToTime(endMins),
    type: 'in-class',
    days: [1, 2, 3, 4, 5],
    subjects: {},
  });
  saveTimetable();
  renderTimetableEditor();
  showToast('새 시간이 추가되었어요');
}

function resetTimetable() {
  if (!confirm('시간표를 기본값으로 초기화할까요?')) return;
  timetable = JSON.parse(JSON.stringify(DEFAULT_TIMETABLE));
  saveTimetable();
  renderTimetableEditor();
  renderSubjectGrid();
  showToast('시간표가 초기화되었어요');
}

function renderSubjectGrid() {
  const grid = document.getElementById('subjectGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const dayLabels = ['월', '화', '수', '목', '금'];
  const inClassEntries = timetable.filter(e => e.type === 'in-class');

  // Header row: empty corner + day headers
  const corner = document.createElement('div');
  grid.appendChild(corner);
  dayLabels.forEach(label => {
    const hdr = document.createElement('div');
    hdr.className = 'subject-grid-header';
    hdr.textContent = label;
    grid.appendChild(hdr);
  });

  // Each period row
  inClassEntries.forEach((entry, _) => {
    const idx = timetable.indexOf(entry);
    const lbl = document.createElement('div');
    lbl.className = 'subject-grid-label';
    lbl.textContent = entry.label;
    grid.appendChild(lbl);

    for (let d = 1; d <= 5; d++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'subject-grid-input';
      input.value = entry.subjects[d] || '';
      input.placeholder = '-';
      input.addEventListener('input', () => {
        timetable[idx].subjects[d] = input.value;
        saveTimetable();
        if (settings.timetableMode) renderTimetableDisplay();
      });
      grid.appendChild(input);
    }
  });
}

// =============================================
// TIMETABLE DRAG & DROP
// =============================================
function startTtDrag(e, index, rowEl) {
  e.preventDefault();

  const container = document.getElementById('ttList');
  const rows = [...container.querySelectorAll('.tt-row')];
  const rect = rowEl.getBoundingClientRect();
  const rects = rows.map(r => r.getBoundingClientRect());
  const cardH = rect.height;

  ttDrag = {
    active: true, rowEl, index, currentIndex: index,
    startY: e.clientY,
    cardRects: rects, cardH, rows,
  };

  rowEl.classList.add('tt-lifted');
  rows.forEach(r => r.style.setProperty('--tt-card-h', cardH + 'px'));
  document.body.classList.add('is-dragging');

  document.addEventListener('pointermove', onTtDragMove);
  document.addEventListener('pointerup', onTtDragEnd);
}

function onTtDragMove(e) {
  if (!ttDrag.active) return;
  const { rowEl, startY, index, rows, cardRects, cardH } = ttDrag;

  const dy = e.clientY - startY;
  rowEl.style.transform = 'translateY(' + dy + 'px) scale(1.02)';

  const origCenter = cardRects[index].top + cardH / 2;
  const centerY = origCenter + dy;
  let newIndex = index;

  for (let i = 0; i < cardRects.length; i++) {
    const r = cardRects[i];
    const midY = r.top + r.height / 2;
    if (i < index && centerY < midY) { newIndex = i; break; }
    if (i > index && centerY > midY) { newIndex = i; }
  }

  if (newIndex !== ttDrag.currentIndex) {
    ttDrag.currentIndex = newIndex;
    rows.forEach((r, i) => {
      if (i === index) return;
      r.classList.remove('tt-shift-down', 'tt-shift-up');
      if (index < newIndex) {
        if (i > index && i <= newIndex) r.classList.add('tt-shift-up');
      } else if (index > newIndex) {
        if (i >= newIndex && i < index) r.classList.add('tt-shift-down');
      }
    });
  }
}

function onTtDragEnd() {
  if (!ttDrag.active) return;
  const { rowEl, index, currentIndex, rows } = ttDrag;

  rowEl.classList.remove('tt-lifted');
  rowEl.style.transform = '';
  rows.forEach(r => { r.classList.remove('tt-shift-down', 'tt-shift-up'); r.style.removeProperty('--tt-card-h'); });
  document.body.classList.remove('is-dragging');

  document.removeEventListener('pointermove', onTtDragMove);
  document.removeEventListener('pointerup', onTtDragEnd);

  if (index !== currentIndex) {
    const moved = timetable.splice(index, 1)[0];
    timetable.splice(currentIndex, 0, moved);
    localStorage.setItem('classroomTimetable', JSON.stringify(timetable));
    showToast('시간표 순서가 변경되었어요');
  }

  ttDrag.active = false;
  renderTimetableEditor();
}

// =============================================
// TAB SWITCHING
// =============================================
function switchTab(tabName) {
  viewData.activeTab = tabName;
  saveViewData();

  if (isEditing) {
    isEditing = false;
    document.getElementById('editToggle').textContent = '편집';
    document.getElementById('editToggle').classList.remove('active');
    document.getElementById('rightPanel').classList.remove('edit-mode');
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.getElementById('tabRules').style.display = tabName === 'rules' ? '' : 'none';
  document.getElementById('tabNotebook').style.display = tabName === 'notebook' ? '' : 'none';
  document.getElementById('tabNotice').style.display = tabName === 'notice' ? '' : 'none';

  if (tabName === 'notebook') {
    document.getElementById('notebookArea').value = viewData.notebook || '';
    applyNotebookFontSize();
  }
  if (tabName === 'notice') {
    renderNotices();
  }
}

function initTabs() {
  const tab = viewData.activeTab || 'rules';
  switchTab(tab);
}

// =============================================
// NOTEBOOK (알림장)
// =============================================
function onNotebookInput() {
  clearTimeout(notebookTimer);
  notebookTimer = setTimeout(() => {
    viewData.notebook = document.getElementById('notebookArea').value;
    saveViewData();
  }, 500);
}

function changeNotebookFontSize(delta) {
  const fontSize = (viewData.notebookFontSize || 18) + delta;
  const clamped = Math.max(12, Math.min(80, fontSize));
  viewData.notebookFontSize = clamped;
  saveViewData();
  applyNotebookFontSize();
}

function setNotebookFontSize(val) {
  var size = parseInt(val) || 18;
  size = Math.max(12, Math.min(80, size));
  viewData.notebookFontSize = size;
  saveViewData();
  applyNotebookFontSize();
}

function applyNotebookFontSize() {
  const size = viewData.notebookFontSize || 18;
  const area = document.getElementById('notebookArea');
  if (area) area.style.fontSize = size + 'px';
  const fullscreenBody = document.getElementById('notebookFullscreenBody');
  if (fullscreenBody) fullscreenBody.style.fontSize = size + 'px';
  const input = document.getElementById('fontSizeInput');
  if (input) input.value = size;
  const inputFs = document.getElementById('fontSizeInputFullscreen');
  if (inputFs) inputFs.value = size;
}

// =============================================
// NOTICES (공지사항)
// =============================================
function renderNotices() {
  const container = document.getElementById('noticeContainer');
  if (!container) return;
  container.innerHTML = '';
  const notices = viewData.notices || [];

  notices.forEach((notice, i) => {
    const card = document.createElement('div');
    card.className = 'notice-card';

    const dot = document.createElement('div');
    dot.className = 'notice-dot';

    const content = document.createElement('div');
    content.className = 'notice-content';
    content.contentEditable = true;
    content.spellcheck = false;
    content.textContent = notice.text;
    content.addEventListener('blur', () => {
      viewData.notices[i].text = content.textContent.trim() || '새 공지';
      saveViewData();
    });
    content.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); content.blur(); }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'notice-delete-btn';
    delBtn.innerHTML = '&#10005;';
    delBtn.onclick = () => {
      card.style.transition = 'transform 0.3s, opacity 0.3s';
      card.style.transform = 'scale(0.8)';
      card.style.opacity = '0';
      setTimeout(() => {
        viewData.notices.splice(i, 1);
        saveViewData();
        renderNotices();
        showToast('공지가 삭제되었어요');
      }, 250);
    };

    card.appendChild(dot);
    card.appendChild(content);
    card.appendChild(delBtn);
    container.appendChild(card);
  });
}

function addNotice() {
  viewData.notices.push({ text: '새 공지사항' });
  saveViewData();
  renderNotices();
  showToast('새 공지가 추가되었어요');
  setTimeout(() => {
    const items = document.querySelectorAll('.notice-content');
    const last = items[items.length - 1];
    if (last) { last.focus(); document.execCommand('selectAll', false, null); }
  }, 100);
}

// =============================================
// AUTO-GENERATE TIMETABLE
// =============================================
function generateTimetable() {
  if (!confirm('기존 시간표를 덮어쓰고 새로 생성할까요?')) return;

  const startTimeStr = document.getElementById('autoStartTime').value || '09:00';
  let startMins = timeToMins(startTimeStr);
  const newTimetable = [];

  for (let p = 1; p <= 7; p++) {
    const endMins = startMins + 40;
    newTimetable.push({
      label: p + '교시',
      start: minsToTime(startMins),
      end: minsToTime(endMins),
      type: 'in-class',
      days: [1, 2, 3, 4, 5],
      subjects: {},
    });

    if (p === 4) {
      // 점심시간 50분
      newTimetable.push({
        label: '점심시간',
        start: minsToTime(endMins),
        end: minsToTime(endMins + 50),
        type: 'lunch-time',
        days: [1, 2, 3, 4, 5],
        subjects: {},
      });
      startMins = endMins + 50;
    } else {
      startMins = endMins + 10; // 10분 쉬는시간 갭
    }
  }

  timetable = newTimetable;
  saveTimetable();
  renderTimetableEditor();
  showToast('시간표가 자동 생성되었어요');
}

// =============================================
// CHIME (수업 시작 알림음)
// =============================================
function initAudio() {
  const unlock = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    document.removeEventListener('click', unlock);
  };
  document.addEventListener('click', unlock);
}

function playChime() {
  if (!audioCtx || !settings.chimeEnabled) return;
  const now = Date.now();
  if (now - lastChimeTime < 60000) return;
  lastChimeTime = now;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.3 + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * 0.3);
    osc.stop(audioCtx.currentTime + i * 0.3 + 0.5);
  });
}

function toggleChime() {
  settings.chimeEnabled = document.getElementById('chimeToggle').checked;
  saveSettings();
}

function toggleColonBlink() {
  settings.colonBlink = document.getElementById('colonBlinkToggle').checked;
  applyColonBlink();
  saveSettings();
}

function applyColonBlink() {
  document.querySelectorAll('.colon').forEach(el => {
    el.style.animationName = settings.colonBlink ? 'colonBlink' : 'none';
  });
}

function toggleSecondsDisplay() {
  settings.showSeconds = document.getElementById('secondsToggle').checked;
  applySecondsVisibility();
  saveSettings();
}

function applySecondsVisibility() {
  const panel = document.getElementById('leftPanel');
  if (!panel) return;
  panel.classList.toggle('hide-seconds', !settings.showSeconds);
}

// =============================================
// TIMETABLE MODE (LEFT PANEL DISPLAY)
// =============================================
function toggleTimetableMode() {
  settings.timetableMode = !settings.timetableMode;
  saveSettings();
  applyTimetableMode();
}

function toggleTimetableModeSetting() {
  settings.timetableMode = document.getElementById('timetableModeToggle').checked;
  saveSettings();
  applyTimetableMode();
}

function applyTimetableMode() {
  const panel = document.getElementById('leftPanel');
  const btn = document.getElementById('timetableToggleBtn');
  const toggle = document.getElementById('timetableModeToggle');

  panel.classList.toggle('timetable-mode', settings.timetableMode);
  btn.classList.toggle('active', settings.timetableMode);
  if (toggle) toggle.checked = settings.timetableMode;

  if (settings.timetableMode) {
    renderTimetableDisplay();
  }
}

function renderTimetableDisplay() {
  const container = document.getElementById('timetableDisplay');
  if (!container) return;
  container.innerHTML = '';

  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const isWeekend = (day === 0 || day === 6);

  if (isWeekend) {
    container.innerHTML = '<div class="timetable-empty-msg">주말에는 수업이 없어요</div>';
    return;
  }

  const entries = getTodayEntries(now);
  if (entries.length === 0) {
    container.innerHTML = '<div class="timetable-empty-msg">오늘은 수업이 없어요</div>';
    return;
  }

  // 교시 수에 따라 행 크기 자동 조절
  let rowFontSize = '2rem';
  let rowPadding = '0.85rem 1rem';
  if (entries.length >= 9) {
    rowFontSize = '1.5rem';
    rowPadding = '0.5rem 1rem';
  } else if (entries.length >= 7) {
    rowFontSize = '1.75rem';
    rowPadding = '0.65rem 1rem';
  }

  entries.forEach(entry => {
    const start = timeToMins(entry.start);
    const end = timeToMins(entry.end);

    const row = document.createElement('div');
    row.className = 'tt-display-row';
    row.style.fontSize = rowFontSize;
    row.style.padding = rowPadding;

    if (mins >= end) {
      row.classList.add('tt-past');
    } else if (mins >= start && mins < end) {
      row.classList.add('tt-current');
      if (entry.type === 'lunch-time') row.classList.add('lunch-time');
    } else {
      row.classList.add('tt-future');
    }

    const label = document.createElement('span');
    label.className = 'tt-display-label';
    label.textContent = entry.label;

    const subjectSpan = document.createElement('span');
    subjectSpan.className = 'tt-display-subject';
    subjectSpan.textContent = entry.subjects[day] || '';

    row.appendChild(label);
    row.appendChild(subjectSpan);
    container.appendChild(row);
  });
}

// =============================================
// DAILY PERIODS SETTINGS
// =============================================
function renderDailyPeriods() {
  const grid = document.getElementById('dailyPeriodsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const labels = ['월', '화', '수', '목', '금'];

  labels.forEach((label, di) => {
    const dayNum = di + 1;
    const item = document.createElement('div');
    item.className = 'daily-period-item';

    const lbl = document.createElement('div');
    lbl.className = 'daily-period-label';
    lbl.textContent = label;

    const sel = document.createElement('select');
    sel.className = 'daily-period-select';
    for (let n = 4; n <= 7; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n + '교시';
      if (settings.dailyPeriods[dayNum] === n) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      settings.dailyPeriods[dayNum] = parseInt(sel.value);
      saveSettings();
    });

    item.appendChild(lbl);
    item.appendChild(sel);
    grid.appendChild(item);
  });
}

// =============================================
// CLOCK & PERIOD DETECTION
// =============================================
function getTodayEntries(now) {
  const day = now.getDay();
  const isWeekend = (day === 0 || day === 6);
  if (isWeekend) return [];

  let todayEntries = timetable
    .filter(e => e.days.includes(day))
    .sort((a, b) => timeToMins(a.start) - timeToMins(b.start));

  const maxPeriods = settings.dailyPeriods ? settings.dailyPeriods[day] : null;
  if (maxPeriods) {
    let periodCount = 0;
    let lastPeriodEndMins = 0;
    const filtered = [];
    for (const e of todayEntries) {
      if (/^\d+교시$/.test(e.label)) {
        periodCount++;
        if (periodCount <= maxPeriods) {
          filtered.push(e);
          lastPeriodEndMins = timeToMins(e.end);
        }
      } else {
        filtered.push(e);
      }
    }
    todayEntries = filtered.filter(e => {
      if (/^\d+교시$/.test(e.label)) return true;
      return timeToMins(e.start) < lastPeriodEndMins;
    });
  }

  return todayEntries;
}

function getCurrentPeriod(now) {
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const isWeekend = (day === 0 || day === 6);

  if (isWeekend) return { label: '주말', type: 'off-time', endMins: null };

  const todayEntries = getTodayEntries(now);

  if (todayEntries.length === 0) return { label: '수업 없음', type: 'off-time', endMins: null };

  for (let i = 0; i < todayEntries.length; i++) {
    const entry = todayEntries[i];
    const start = timeToMins(entry.start);
    const end = timeToMins(entry.end);

    // Currently in this period
    if (mins >= start && mins < end) {
      const subject = entry.subjects ? (entry.subjects[day] || '') : '';
      return { label: entry.label, type: entry.type, endMins: end, subject: subject };
    }

    // Check gap to next entry (break time)
    if (mins >= end && i + 1 < todayEntries.length) {
      const nextStart = timeToMins(todayEntries[i + 1].start);
      if (mins < nextStart) {
        return { label: '쉬는 시간', type: 'break-time', endMins: nextStart };
      }
    }
  }

  // Before or after school
  const firstStart = timeToMins(todayEntries[0].start);
  const lastEnd = timeToMins(todayEntries[todayEntries.length - 1].end);

  if (mins < firstStart) return { label: '수업 전', type: 'off-time', endMins: null };
  if (mins >= lastEnd) return { label: '수업 끝', type: 'off-time', endMins: null };

  return { label: '수업 전', type: 'off-time', endMins: null };
}

function updateClock() {
  const n = new Date();
  let h = n.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  h = h % 12 || 12;
  document.getElementById('timeDisplay').innerHTML =
    h + '<span class="colon" style="animation-name:' + (settings.colonBlink ? 'colonBlink' : 'none') + '">:</span>' + String(n.getMinutes()).padStart(2, '0');
  document.getElementById('ampmDisplay').textContent = ampm;
  document.getElementById('secondsDisplay').textContent = ': ' + String(n.getSeconds()).padStart(2, '0');
  document.getElementById('dateDisplay').textContent =
    n.getFullYear() + '. ' + String(n.getMonth() + 1).padStart(2, '0') + '. ' + String(n.getDate()).padStart(2, '0');
  document.getElementById('dayName').textContent = DAYS_KR[n.getDay()];

  // Period alert with optional remaining time
  const period = getCurrentPeriod(n);
  const alertEl = document.getElementById('periodAlert');
  alertEl.className = 'period-alert ' + period.type;

  // Chime on period transition (수업 시작 시)
  if (lastPeriodLabel !== null && lastPeriodLabel !== period.label && period.type === 'in-class') {
    playChime();
  }
  lastPeriodLabel = period.label;

  // 과목명이 있으면 "3교시 · 수학" 형태로 표시
  const displayLabel = period.subject ? period.label + ' · ' + period.subject : period.label;

  if (settings.showRemaining && period.endMins !== null) {
    const currentTotalSecs = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    const endTotalSecs = period.endMins * 60;
    const remaining = endTotalSecs - currentTotalSecs;

    if (remaining > 0) {
      const remMin = Math.floor(remaining / 60);
      const remSec = remaining % 60;
      let remText;
      if (remMin > 0) {
        remText = remMin + '분 ' + String(remSec).padStart(2, '0') + '초';
      } else {
        remText = remSec + '초';
      }
      alertEl.textContent = '';
      alertEl.appendChild(document.createTextNode(displayLabel + ' '));
      const remSpan = document.createElement('span');
      remSpan.className = 'remaining-time';
      remSpan.textContent = '(' + remText + ' 남음)';
      alertEl.appendChild(remSpan);
    } else {
      alertEl.textContent = displayLabel;
    }
  } else {
    alertEl.textContent = displayLabel;
  }

  // Update timetable display if in timetable mode
  if (settings.timetableMode) {
    renderTimetableDisplay();
  }
}

// =============================================
// DATA EXPORT / IMPORT
// =============================================
function exportData() {
  const data = {
    classroomRules: localStorage.getItem('classroomRules'),
    classroomTimetable: localStorage.getItem('classroomTimetable'),
    classroomSettings: localStorage.getItem('classroomSettings'),
    classroomViewData: localStorage.getItem('classroomViewData')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const stamp = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
  a.download = 'classroom-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('백업 파일이 다운로드되었습니다');
}

function importData() {
  document.getElementById('importFileInput').click();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('현재 데이터를 덮어쓰게 됩니다. 계속할까요?')) {
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      const keys = ['classroomRules', 'classroomTimetable', 'classroomSettings', 'classroomViewData'];
      keys.forEach(function(key) {
        if (data[key] !== undefined && data[key] !== null) {
          localStorage.setItem(key, data[key]);
        }
      });
      location.reload();
    } catch (err) {
      alert('파일을 읽는 중 오류가 발생했습니다. 올바른 백업 파일인지 확인해주세요.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// =============================================
// FULLSCREEN
// =============================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function() {});
  } else {
    document.exitFullscreen().catch(function() {});
  }
}

document.addEventListener('fullscreenchange', function() {
  var btn = document.getElementById('fullscreenBtn');
  btn.innerHTML = document.fullscreenElement ? '&#x2716;' : '&#x26F6;';
  btn.title = document.fullscreenElement ? '전체화면 해제' : '전체화면';
});

// =============================================
// NOTEBOOK FULLSCREEN
// =============================================
function openNotebookFullscreen() {
  var text = document.getElementById('notebookArea').value || '';
  var fullscreenBody = document.getElementById('notebookFullscreenBody');
  fullscreenBody.value = text;
  fullscreenBody.style.fontSize = (viewData.notebookFontSize || 18) + 'px';
  document.getElementById('notebookFullscreen').classList.add('open');
  fullscreenBody.focus();
}

function closeNotebookFullscreen() {
  var fullscreenBody = document.getElementById('notebookFullscreenBody');
  var text = fullscreenBody.value;
  document.getElementById('notebookArea').value = text;
  viewData.notebook = text;
  saveViewData();
  document.getElementById('notebookFullscreen').classList.remove('open');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('notebookFullscreen').classList.contains('open')) {
    closeNotebookFullscreen();
  }
});

// =============================================
// VISITOR COUNTER
// =============================================
function getVisitorId() {
  var id = localStorage.getItem('classroomVisitorId');
  if (!id) {
    id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('classroomVisitorId', id);
  }
  return id;
}

function initVisitorCounter() {
  var today = new Date().toISOString().slice(0, 10);
  var visitorId = getVisitorId();
  var counterData = {};
  try {
    counterData = JSON.parse(localStorage.getItem('classroomVisitorCounter') || '{}');
  } catch(e) { counterData = {}; }

  // Check if this is a new session (not just a refresh)
  var isNewSession = !sessionStorage.getItem('classroomSessionActive');
  if (isNewSession) {
    sessionStorage.setItem('classroomSessionActive', '1');

    // Track unique visitors per day
    if (!counterData.todayVisitors) counterData.todayVisitors = [];
    if (counterData.lastVisitDate !== today) {
      counterData.lastVisitDate = today;
      counterData.todayVisitors = [visitorId];
      counterData.todayCount = 1;
    } else if (!counterData.todayVisitors.includes(visitorId)) {
      counterData.todayVisitors.push(visitorId);
      counterData.todayCount = counterData.todayVisitors.length;
    }

    // Track unique total visitors (preserve old count during migration)
    var oldTotal = counterData.totalCount || 0;
    if (!counterData.allVisitors) counterData.allVisitors = [];
    if (!counterData.allVisitors.includes(visitorId)) {
      counterData.allVisitors.push(visitorId);
    }
    counterData.totalCount = Math.max(oldTotal, counterData.allVisitors.length);

    localStorage.setItem('classroomVisitorCounter', JSON.stringify(counterData));
  } else {
    // Same session, just show existing counts
    if (counterData.lastVisitDate !== today) {
      counterData.lastVisitDate = today;
      counterData.todayCount = 0;
    }
  }

  // Show local counts immediately
  updateCounterDisplay(counterData.todayCount || 0, counterData.totalCount || 0);

  // Try external API for cross-device total count
  if (isNewSession) {
    fetchExternalCounter(true);
  } else {
    fetchExternalCounter(false);
  }
}

function fetchExternalCounter(increment) {
  var namespace = 'classroom-riencarna';
  var key = 'total-visits';
  var todayKey = 'today-' + new Date().toISOString().slice(0, 10);

  var totalUrl = 'https://api.counterapi.dev/v1/' + namespace + '/' + key;
  var todayUrl = 'https://api.counterapi.dev/v1/' + namespace + '/' + todayKey;
  if (increment) { totalUrl += '/up'; todayUrl += '/up'; }

  Promise.all([
    fetch(totalUrl).then(function(r) { return r.json(); }).catch(function() { return null; }),
    fetch(todayUrl).then(function(r) { return r.json(); }).catch(function() { return null; })
  ]).then(function(results) {
    var total = results[0] && results[0].count !== undefined ? results[0].count : 0;
    var today = results[1] && results[1].count !== undefined ? results[1].count : 0;
    if (total < today) total = today;
    if (total) document.getElementById('totalCount').textContent = total;
    if (today) document.getElementById('todayCount').textContent = today;

    // Save API values back to localStorage so refresh shows correct counts
    if (total || today) {
      try {
        var counterData = JSON.parse(localStorage.getItem('classroomVisitorCounter') || '{}');
        if (total) counterData.totalCount = Math.max(counterData.totalCount || 0, total);
        if (today) counterData.todayCount = Math.max(counterData.todayCount || 0, today);
        localStorage.setItem('classroomVisitorCounter', JSON.stringify(counterData));
      } catch(e) {}
    }
  });
}

function updateCounterDisplay(today, total) {
  document.getElementById('todayCount').textContent = today;
  document.getElementById('totalCount').textContent = total;
}

// =============================================
// INIT
// =============================================
loadSettings();
loadTimetable();
loadRules();
loadViewData();
renderRules();
initTabs();
initAudio();
applySecondsVisibility();
applyTimetableMode();
updateClock();
setInterval(updateClock, 1000);
initVisitorCounter();
