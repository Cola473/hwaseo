/* =============================================
   화서문화유산연구원 | admin.js
   에디터: contenteditable 기반 커스텀 리치텍스트
   (외부 라이브러리 의존 없음)
   ============================================= */
(function () {
  'use strict';

  // ── 상태 ─────────────────────────────────────
  let currentBoard = 'surface';
  let editingId    = null;
  let cache        = {};
  let newFiles     = [];
  let keepAttach   = [];

  function dataFile(board) {
    const map = {
      news:       SITE_CONFIG.DATA_FILE_NEWS,
      free:       SITE_CONFIG.DATA_FILE_FREE,
      notice:     SITE_CONFIG.DATA_FILE_NOTICE,
      surface:    SITE_CONFIG.DATA_FILE_SURVEY1,
      excavation: SITE_CONFIG.DATA_FILE_SURVEY2,
      academic:   SITE_CONFIG.DATA_FILE_SURVEY3,
      report:     SITE_CONFIG.DATA_FILE_REPORT,
    };
    return map[board] || `data/posts-${board}.json`;
  }

  // ══════════════════════════════════════════════
  //  리치텍스트 에디터 (contenteditable 기반)
  // ══════════════════════════════════════════════
  let editorEl = null;       // contenteditable div
  let savedRange = null;     // 포커스 잃기 전 저장한 selection
  let ctxTargetCell = null;  // 우클릭된 테이블 셀

  function initEditor() {
    editorEl = document.getElementById('tiptap-editor');
    if (!editorEl || editorEl._initialized) return;
    editorEl._initialized = true;

    // placeholder 처리
    function updatePlaceholder() {
      if (editorEl.innerHTML === '' || editorEl.innerHTML === '<br>') {
        editorEl.classList.add('is-empty');
      } else {
        editorEl.classList.remove('is-empty');
      }
    }
    editorEl.addEventListener('input', updatePlaceholder);
    editorEl.addEventListener('focus', updatePlaceholder);

    // 이미지 Ctrl+V 붙여넣기
    editorEl.addEventListener('paste', function(e) {
      const items = Array.from((e.clipboardData || {}).items || []);
      const imageItem = items.find(it => it.type.startsWith('image/'));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) handleImageFile(file);
    });

    // 포커스 잃으면 selection 저장
    editorEl.addEventListener('mouseup', saveSelection);
    editorEl.addEventListener('keyup',   saveSelection);

    // 표 우클릭
    editorEl.addEventListener('contextmenu', function(e) {
      const cell = e.target.closest('td, th');
      if (!cell) return;
      e.preventDefault();
      ctxTargetCell = cell;
      showTableCtxMenu(e.clientX, e.clientY);
    });

    // 툴바 바인딩
    bindToolbar();

    updatePlaceholder();
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // 에디터 안의 range인지 확인
      if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
      }
    }
  }

  function restoreSelection() {
    if (!savedRange) { editorEl.focus(); return; }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    editorEl.focus();
  }

  // ── execCommand 래퍼 ─────────────────────────
  function exec(cmd, value) {
    restoreSelection();
    document.execCommand(cmd, false, value || null);
    editorEl.focus();
    updateToolbarState();
  }

  // ── 툴바 버튼 바인딩 ─────────────────────────
  function bindToolbar() {
    const B = id => document.getElementById(id);

    B('tt-bold').addEventListener('mousedown',      e => { e.preventDefault(); exec('bold'); });
    B('tt-italic').addEventListener('mousedown',    e => { e.preventDefault(); exec('italic'); });
    B('tt-underline').addEventListener('mousedown', e => { e.preventDefault(); exec('underline'); });
    B('tt-strike').addEventListener('mousedown',    e => { e.preventDefault(); exec('strikeThrough'); });

    B('tt-h1').addEventListener('mousedown', e => { e.preventDefault(); toggleBlock('h1'); });
    B('tt-h2').addEventListener('mousedown', e => { e.preventDefault(); toggleBlock('h2'); });
    B('tt-h3').addEventListener('mousedown', e => { e.preventDefault(); toggleBlock('h3'); });

    B('tt-ul').addEventListener('mousedown', e => { e.preventDefault(); exec('insertUnorderedList'); });
    B('tt-ol').addEventListener('mousedown', e => { e.preventDefault(); exec('insertOrderedList'); });
    B('tt-bq').addEventListener('mousedown', e => { e.preventDefault(); toggleBlockquote(); });

    B('tt-link').addEventListener('mousedown',  e => { e.preventDefault(); promptLink(); });
    B('tt-table').addEventListener('mousedown', e => { e.preventDefault(); toggleTableDialog(); });
    // 글자 크기
    const fsEl = document.getElementById('tt-fontsize');
    if (fsEl) {
      fsEl.addEventListener('change', function() {
        const pt  = parseInt(this.value, 10);
        const px  = Math.round(pt * 96 / 72); // pt → px 변환
        restoreSelection();
        document.execCommand('fontSize', false, '7'); // 임시 fontSize 마크 삽입
        // fontSize=7 로 삽입된 font 태그를 직접 px 스타일로 교체
        editorEl.querySelectorAll('font[size="7"]').forEach(el => {
          el.removeAttribute('size');
          el.style.fontSize = px + 'px';
        });
        editorEl.focus();
      });
    }

    B('tt-undo').addEventListener('mousedown',  e => { e.preventDefault(); exec('undo'); });
    B('tt-redo').addEventListener('mousedown',  e => { e.preventDefault(); exec('redo'); });
    B('tt-clear').addEventListener('mousedown', e => { e.preventDefault(); exec('removeFormat'); });

    // 에디터 내 키 입력 시 툴바 상태 갱신
    editorEl.addEventListener('keyup',   updateToolbarState);
    editorEl.addEventListener('mouseup', updateToolbarState);
  }

  // ── 헤딩 토글 ────────────────────────────────
  function toggleBlock(tag) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const block = getBlockAncestor(range.commonAncestorContainer);

    if (block && block.tagName.toLowerCase() === tag) {
      // 이미 해당 태그면 p로 변환
      document.execCommand('formatBlock', false, 'p');
    } else {
      document.execCommand('formatBlock', false, tag);
    }
    editorEl.focus();
    updateToolbarState();
  }

  function getBlockAncestor(node) {
    const blocks = ['P','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','DIV'];
    let n = node.nodeType === 3 ? node.parentElement : node;
    while (n && n !== editorEl) {
      if (blocks.includes(n.tagName)) return n;
      n = n.parentElement;
    }
    return null;
  }

  // ── 인용 토글 ────────────────────────────────
  function toggleBlockquote() {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const ancestor = sel.getRangeAt(0).commonAncestorContainer;
    const bq = (ancestor.nodeType === 3 ? ancestor.parentElement : ancestor).closest('blockquote');
    if (bq) {
      // blockquote 해제: 내용을 바깥으로
      const frag = document.createDocumentFragment();
      while (bq.firstChild) frag.appendChild(bq.firstChild);
      bq.parentNode.replaceChild(frag, bq);
    } else {
      document.execCommand('formatBlock', false, 'blockquote');
    }
    editorEl.focus();
    updateToolbarState();
  }

  // ── 링크 삽입 ────────────────────────────────
  function promptLink() {
    restoreSelection();
    const sel = window.getSelection();
    let existing = '';
    if (sel && sel.rangeCount > 0) {
      const anc = sel.getRangeAt(0).commonAncestorContainer;
      const a   = (anc.nodeType === 3 ? anc.parentElement : anc).closest('a');
      if (a) existing = a.href;
    }
    const url = window.prompt('링크 URL을 입력하세요:', existing || 'https://');
    if (url === null) return;
    if (!url.trim()) { exec('unlink'); return; }
    const href = /^https?:\/\/|^mailto:/.test(url.trim()) ? url.trim() : 'https://' + url.trim();
    exec('createLink', href);
    // target="_blank" 설정
    const sel2 = window.getSelection();
    if (sel2 && sel2.rangeCount > 0) {
      const links = editorEl.querySelectorAll('a[href="' + href + '"]');
      links.forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    }
  }

  // ── 툴바 활성 상태 갱신 ──────────────────────
  function updateToolbarState() {
    function setActive(id, active) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('is-active', !!active);
    }
    // 현재 커서 위치 글자 크기 → select 동기화
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        const el   = node.nodeType === 3 ? node.parentElement : node;
        const fs   = window.getComputedStyle(el).fontSize; // px
        if (fs) {
          const px = parseFloat(fs);
          const pt = Math.round(px * 72 / 96);
          const fsEl = document.getElementById('tt-fontsize');
          if (fsEl) {
            // 가장 가까운 옵션 선택
            const opts = [...fsEl.options].map(o => parseInt(o.value));
            const closest = opts.reduce((a, b) => Math.abs(b - pt) < Math.abs(a - pt) ? b : a);
            fsEl.value = String(closest);
          }
        }
      }
    } catch(e) {}

    try {
      setActive('tt-bold',      document.queryCommandState('bold'));
      setActive('tt-italic',    document.queryCommandState('italic'));
      setActive('tt-underline', document.queryCommandState('underline'));
      setActive('tt-strike',    document.queryCommandState('strikeThrough'));

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const block = getBlockAncestor(sel.getRangeAt(0).commonAncestorContainer);
        const tag   = block ? block.tagName.toLowerCase() : '';
        setActive('tt-h1', tag === 'h1');
        setActive('tt-h2', tag === 'h2');
        setActive('tt-h3', tag === 'h3');
        setActive('tt-bq', tag === 'blockquote');

        const ancestor = sel.getRangeAt(0).commonAncestorContainer;
        const node     = ancestor.nodeType === 3 ? ancestor.parentElement : ancestor;
        setActive('tt-ul', !!node.closest('ul'));
        setActive('tt-ol', !!node.closest('ol'));
      }
    } catch(e) { /* queryCommandState 지원 안 하는 경우 무시 */ }
  }

  // ── 표 삽입 다이얼로그 ────────────────────────
  function toggleTableDialog() {
    const dlg = document.getElementById('table-dialog');
    if (!dlg) return;
    dlg.style.display = dlg.style.display === 'none' ? 'flex' : 'none';
  }

  window.confirmInsertTable = function() {
    const rows = parseInt(document.getElementById('tbl-rows').value, 10) || 3;
    const cols = parseInt(document.getElementById('tbl-cols').value, 10) || 3;
    document.getElementById('table-dialog').style.display = 'none';
    insertTable(rows, cols);
  };

  window.cancelInsertTable = function() {
    document.getElementById('table-dialog').style.display = 'none';
  };

  function insertTable(rows, cols) {
    restoreSelection();

    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += r === 0 ? '<th><p><br></p></th>' : '<td><p><br></p></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    document.execCommand('insertHTML', false, html);
    editorEl.focus();
  }

  // ── 표 우클릭 컨텍스트 메뉴 ─────────────────
  function showTableCtxMenu(x, y) {
    const menu = document.getElementById('table-ctx-menu');
    if (!menu) return;
    menu.style.display = 'block';
    menu.style.left    = x + 'px';
    menu.style.top     = y + 'px';
  }

  function hideTableCtxMenu() {
    const menu = document.getElementById('table-ctx-menu');
    if (menu) menu.style.display = 'none';
    ctxTargetCell = null;
  }

  window.tableCtxCmd = function(cmd) {
    hideTableCtxMenu();
    if (!ctxTargetCell) return;
    const cell  = ctxTargetCell;
    const row   = cell.parentElement;
    const tbody = row.parentElement;
    const table = tbody.closest('table');

    switch (cmd) {
      case 'addColBefore': {
        const ci = cellIndex(cell);
        tbody.querySelectorAll('tr').forEach(tr => {
          const newCell = cloneCell(tr.cells[ci]);
          tr.insertBefore(newCell, tr.cells[ci]);
        });
        break;
      }
      case 'addColAfter': {
        const ci = cellIndex(cell);
        tbody.querySelectorAll('tr').forEach(tr => {
          const ref = tr.cells[ci];
          const newCell = cloneCell(ref);
          ref.parentNode.insertBefore(newCell, ref.nextSibling);
        });
        break;
      }
      case 'delCol': {
        const ci = cellIndex(cell);
        tbody.querySelectorAll('tr').forEach(tr => {
          if (tr.cells[ci]) tr.deleteCell(ci);
        });
        if (table.rows[0] && table.rows[0].cells.length === 0) table.remove();
        break;
      }
      case 'addRowBefore': {
        const newRow = cloneRow(row);
        row.parentNode.insertBefore(newRow, row);
        break;
      }
      case 'addRowAfter': {
        const newRow = cloneRow(row);
        row.parentNode.insertBefore(newRow, row.nextSibling);
        break;
      }
      case 'delRow': {
        row.remove();
        if (table.rows.length === 0) table.remove();
        break;
      }
      case 'delTable': {
        table.remove();
        break;
      }
    }
    editorEl.focus();
  };

  function cellIndex(cell) {
    return Array.from(cell.parentElement.cells).indexOf(cell);
  }

  function cloneCell(ref) {
    const tag  = ref ? ref.tagName : 'TD';
    const cell = document.createElement(tag);
    cell.innerHTML = '<p><br></p>';
    return cell;
  }

  function cloneRow(ref) {
    const tr = document.createElement('tr');
    Array.from(ref.cells).forEach(c => {
      tr.appendChild(cloneCell(c));
    });
    return tr;
  }

  // ── 이미지 처리 ──────────────────────────────
  async function handleImageFile(file) {
    const token = localStorage.getItem('hwaseo_token');
    if (!token) { alert('로그인 토큰이 없습니다.'); return; }

    const dataUrl = await fileToDataUrl(file);

    // 미리보기 즉시 삽입
    restoreSelection();
    document.execCommand('insertHTML', false,
      `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%;" />`);
    editorEl.focus();

    // 백그라운드 업로드 후 src 교체
    try {
      const result = await GithubDB.uploadFile(file, token, currentBoard);
      editorEl.querySelectorAll(`img[src="${dataUrl}"]`)
        .forEach(img => { img.src = result.rawUrl; });
    } catch(e) {
      alert(`이미지 업로드 실패: ${e.message}`);
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = () => reject(new Error('파일 읽기 실패'));
      r.readAsDataURL(file);
    });
  }

  // ── HTML 동기화 ───────────────────────────────
  function syncEditorToTextarea() {
    const ta = document.getElementById('write-content');
    if (!ta || !editorEl) return;

    // 불필요한 속성 제거 후 저장
    const clone = editorEl.cloneNode(true);
    clone.removeAttribute('contenteditable');
    clone.removeAttribute('data-placeholder');
    clone.removeAttribute('spellcheck');
    clone.classList.remove('is-empty');
    // <br> 단독으로 있는 빈 p 정리
    clone.querySelectorAll('p').forEach(p => {
      if (p.innerHTML === '<br>') p.innerHTML = '';
    });
    ta.value = clone.innerHTML.trim();
  }

  function loadHtmlToEditor(html) {
    if (!editorEl) return;
    const raw = (html || '').trim();
    if (!raw) {
      editorEl.innerHTML = '';
    } else if (/^\s*<[a-zA-Z]/.test(raw)) {
      editorEl.innerHTML = raw;
    } else {
      // 레거시 텍스트 → HTML
      const escaped = raw
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g,'<br>');
      editorEl.innerHTML = `<p>${escaped}</p>`;
    }
    // placeholder 갱신
    if (editorEl.innerHTML === '' || editorEl.innerHTML === '<br>') {
      editorEl.classList.add('is-empty');
    } else {
      editorEl.classList.remove('is-empty');
    }
  }

  function resetEditor() {
    if (!editorEl) return;
    editorEl.innerHTML = '';
    editorEl.classList.add('is-empty');
    editorEl.style.fontSize = '13px'; // 기본 10pt
    savedRange = null;
    // select도 기본값으로
    const fsEl = document.getElementById('tt-fontsize');
    if (fsEl) fsEl.value = '10';
  }

  // ── 첨부파일 UI ──────────────────────────────
  function initAttachUI() {
    const zone  = document.getElementById('attach-dropzone');
    const input = document.getElementById('attach-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      addFiles([...e.dataTransfer.files]);
    });
  }

  function addFiles(files) {
    const MAX = 10 * 1024 * 1024;
    files.forEach(f => {
      if (f.size > MAX) { alert(`"${f.name}"\n파일 크기가 10MB를 초과합니다.`); return; }
      if (newFiles.find(x => x.name === f.name && x.size === f.size)) return;
      newFiles.push(f);
    });
    renderNewFiles();
  }

  function renderNewFiles() {
    const ul = document.getElementById('attach-list');
    if (!ul) return;
    ul.innerHTML = newFiles.map((f, i) => `
      <li class="attach-item">
        <span class="attach-file-icon">${f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
        <span class="attach-file-name">${f.name}</span>
        <span class="attach-file-size">${GithubDB.formatBytes(f.size)}</span>
        <button class="attach-remove" onclick="removeNewFile(${i})" title="제거">✕</button>
      </li>`).join('');
  }

  function renderExistingFiles(attachments) {
    keepAttach = attachments ? [...attachments] : [];
    const ul   = document.getElementById('attach-existing');
    if (!ul) return;
    if (!keepAttach.length) { ul.innerHTML = ''; return; }
    ul.innerHTML = '<li class="attach-existing-label">기존 첨부파일</li>' +
      keepAttach.map((a, i) => `
        <li class="attach-item attach-item--existing">
          <span class="attach-file-icon">${a.isImage ? '🖼️' : '📄'}</span>
          <span class="attach-file-name">${a.name}</span>
          <span class="attach-file-size">${GithubDB.formatBytes(a.size)}</span>
          <button class="attach-remove" onclick="removeExistingFile(${i})" title="삭제">✕</button>
        </li>`).join('');
  }

  window.removeNewFile      = i => { newFiles.splice(i, 1); renderNewFiles(); };
  window.removeExistingFile = i => { keepAttach.splice(i, 1); renderExistingFiles(keepAttach); };

  // ── 로그인 ───────────────────────────────────
  window.doLogin = async function () {
    const pw    = document.getElementById('input-password').value.trim();
    const token = document.getElementById('input-token').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    if (pw !== SITE_CONFIG.ADMIN_PASSWORD) {
      errEl.textContent    = '비밀번호가 올바르지 않습니다.';
      errEl.style.display  = 'block'; return;
    }
    if (!token) {
      errEl.textContent    = 'GitHub Token을 입력하세요.';
      errEl.style.display  = 'block'; return;
    }

    errEl.textContent  = '토큰 확인 중...';
    errEl.style.color  = 'var(--color-navy-mid)';
    errEl.style.display = 'block';

    const ok = await GithubDB.validateToken(token);
    if (!ok) {
      errEl.textContent = '토큰이 유효하지 않거나 저장소 접근 권한이 없습니다.';
      errEl.style.color = '#c00'; return;
    }

    localStorage.setItem('hwaseo_token', token);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    document.getElementById('admin-badge').style.display  = 'inline-block';
    errEl.style.display = 'none';

    initAttachUI();
    ['surface','excavation','academic','report','news','free','notice'].forEach(b => loadList(b));
  };

  window.doLogout = function () {
    localStorage.removeItem('hwaseo_token');
    location.reload();
  };

  // ── 탭 전환 ──────────────────────────────────
  window.showTab = function (board, btnEl) {
    currentBoard = board;
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    document.getElementById('tab-' + board).style.display = 'block';
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  };

  // ── 목록 로드 ────────────────────────────────
  async function loadList(board) {
    const listEl = document.getElementById('list-' + board);
    if (!listEl) return;
    listEl.innerHTML = '<div class="board-state"><div class="spinner"></div><p>불러오는 중...</p></div>';
    try {
      const data = await GithubDB.readFile(dataFile(board));
      cache[board] = data;
      renderList(board, data.content);
    } catch (e) {
      listEl.innerHTML = `<div class="board-state"><p style="color:#c00;">불러오기 실패: ${e.message}</p></div>`;
    }
  }

  function renderList(board, posts) {
    const listEl = document.getElementById('list-' + board);
    if (!listEl) return;
    if (!posts || !posts.length) {
      listEl.innerHTML = '<div class="board-state"><p>등록된 게시글이 없습니다.</p></div>';
      return;
    }
    listEl.innerHTML = posts.map((p, idx) => `
      <div class="admin-post-row">
        <span class="admin-post-num">${posts.length - idx}</span>
        <span class="admin-post-title">
          ${p.type === '공지' ? '<span class="tag-notice">공지</span>' : ''}
          ${p.title}
          ${(p.attachments && p.attachments.length) ? `<span class="attach-badge">📎 ${p.attachments.length}</span>` : ''}
        </span>
        <span class="admin-post-date">${p.date}</span>
        <span class="admin-post-actions">
          <button class="btn-edit" onclick="openEditModal('${board}','${p.id}')">수정</button>
          <button class="btn-del"  onclick="openDeleteModal('${board}','${p.id}')">삭제</button>
        </span>
      </div>`).join('');
  }

  // ── 모달 열기/닫기 ───────────────────────────
  function resetForm() {
    newFiles   = [];
    keepAttach = [];
    const fields = { 'write-title': '', 'write-date': GithubDB.today(), 'write-author': '관리자' };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
    const ta = document.getElementById('write-content');
    if (ta) ta.value = '';
    resetEditor();
    renderNewFiles();
    renderExistingFiles([]);
    const errEl = document.getElementById('modal-error');
    if (errEl) errEl.style.display = 'none';
    const prog = document.getElementById('attach-progress');
    if (prog) prog.style.display = 'none';
    document.getElementById('table-dialog').style.display = 'none';
    hideTableCtxMenu();
  }

  window.openWriteModal = function (board) {
    currentBoard = board;
    editingId    = null;
    resetForm();
    document.getElementById('modal-title').textContent   = '새 글 작성';
    document.getElementById('btn-submit').textContent    = '저장';
    document.getElementById('write-modal').style.display = 'flex';
    // 에디터 초기화 (DOM이 보인 뒤 실행)
    requestAnimationFrame(() => {
      initEditor();
      if (editorEl) editorEl.focus();
    });
  };

  window.openEditModal = function (board, id) {
    currentBoard = board;
    editingId    = id;
    resetForm();
    const post = (cache[board] && cache[board].content || []).find(p => p.id === id);
    if (!post) return;

    document.getElementById('modal-title').textContent   = '게시글 수정';
    document.getElementById('write-title').value         = post.title  || '';
    document.getElementById('write-date').value          = post.date   || '';
    document.getElementById('write-author').value        = post.author || '관리자';
    document.getElementById('btn-submit').textContent    = '수정 저장';
    renderExistingFiles(post.attachments || []);
    document.getElementById('write-modal').style.display = 'flex';

    requestAnimationFrame(() => {
      initEditor();
      loadHtmlToEditor(post.content || '');
    });
  };

  window.closeModal = function () {
    document.getElementById('write-modal').style.display = 'none';
    document.getElementById('table-dialog').style.display = 'none';
    hideTableCtxMenu();
    newFiles = []; keepAttach = [];
  };

  // ── 저장 ─────────────────────────────────────
  window.submitPost = async function () {
    // 업로드 중인 base64 이미지 체크
    if (editorEl && editorEl.querySelectorAll('img[src^="data:"]').length > 0) {
      alert('이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 저장하세요.');
      return;
    }

    syncEditorToTextarea();

    const title   = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    const errEl   = document.getElementById('modal-error');
    const btn     = document.getElementById('btn-submit');
    const prog    = document.getElementById('attach-progress');
    errEl.style.display = 'none';

    if (!title)   { showModalError('제목을 입력하세요.'); return; }
    if (!content) { showModalError('내용을 입력하세요.'); return; }

    btn.disabled    = true;
    btn.textContent = '저장 중...';

    const token = localStorage.getItem('hwaseo_token');
    let uploadedAttachments = [...keepAttach];

    if (newFiles.length) {
      prog.style.display = 'block';
      for (let i = 0; i < newFiles.length; i++) {
        prog.textContent = `파일 업로드 중... (${i+1}/${newFiles.length}) ${newFiles[i].name}`;
        try {
          const result = await GithubDB.uploadFile(newFiles[i], token, currentBoard);
          uploadedAttachments.push(result);
        } catch (e) {
          showModalError(`"${newFiles[i].name}" 업로드 실패: ${e.message}`);
          btn.disabled = false;
          btn.textContent = editingId ? '수정 저장' : '저장';
          prog.style.display = 'none';
          return;
        }
      }
      prog.textContent = '게시글 저장 중...';
    }

    const post = {
      id:    editingId || ('post_' + Date.now()),
      type:  (() => {
               if (editingId) {
                 const existing = (cache[currentBoard] && cache[currentBoard].content || [])
                   .find(p => p.id === editingId);
                 return (existing && existing.type) || '';
               }
               return '';
             })(),
      title,
      date:        document.getElementById('write-date').value || GithubDB.today(),
      author:      document.getElementById('write-author').value || '관리자',
      content,
      attachments: uploadedAttachments,
    };

    try {
      const cached = cache[currentBoard] || { content: [], sha: null };
      let posts    = [...(cached.content || [])];

      if (editingId) {
        const idx = posts.findIndex(p => p.id === editingId);
        if (idx !== -1) posts[idx] = post; else posts.unshift(post);
      } else {
        posts.unshift(post);
      }

      const result = await GithubDB.writeFile(dataFile(currentBoard), posts, cached.sha, token);
      cache[currentBoard] = { content: posts, sha: (result && result.content && result.content.sha) || cached.sha };
      renderList(currentBoard, posts);
      closeModal();
    } catch (e) {
      showModalError('저장 실패: ' + e.message);
    } finally {
      btn.disabled    = false;
      btn.textContent = editingId ? '수정 저장' : '저장';
      prog.style.display = 'none';
    }
  };

  function showModalError(msg) {
    const el = document.getElementById('modal-error');
    if (el) { el.textContent = msg; el.style.color = '#c00'; el.style.display = 'block'; }
  }

  // ── 삭제 ─────────────────────────────────────
  let deleteTarget = { board: null, id: null };

  window.openDeleteModal = function (board, id) {
    deleteTarget = { board, id };
    document.getElementById('delete-modal').style.display = 'flex';
    document.getElementById('btn-delete-confirm').onclick = confirmDelete;
  };

  window.closeDeleteModal = function () {
    document.getElementById('delete-modal').style.display = 'none';
  };

  async function confirmDelete() {
    const { board, id } = deleteTarget;
    const btn = document.getElementById('btn-delete-confirm');
    btn.textContent = '삭제 중...'; btn.disabled = true;
    try {
      const cached = cache[board] || { content: [], sha: null };
      const posts  = cached.content.filter(p => p.id !== id);
      const token  = localStorage.getItem('hwaseo_token');
      const result = await GithubDB.writeFile(dataFile(board), posts, cached.sha, token);
      cache[board] = { content: posts, sha: (result && result.content && result.content.sha) || cached.sha };
      renderList(board, posts);
      closeDeleteModal();
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    } finally {
      btn.textContent = '삭제'; btn.disabled = false;
    }
  }

  // ── 전역 이벤트 ──────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); hideTableCtxMenu(); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#table-ctx-menu') && !e.target.closest('.tiptap-editor')) {
      hideTableCtxMenu();
    }
  });

  // ── 세션 복원 ────────────────────────────────
  (function restoreSession() {
    const token = localStorage.getItem('hwaseo_token');
    if (!token) return;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    const badge = document.getElementById('admin-badge');
    if (badge) badge.style.display = 'inline-block';
    initAttachUI();
    ['surface','excavation','academic','report','news','free','notice'].forEach(b => loadList(b));
  })();

})();
