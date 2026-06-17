/* =============================================
   화서문화유산연구원 | admin.js
   ============================================= */
(function () {
  'use strict';

  // ── 상태 ─────────────────────────────────────
  let currentBoard = 'news';
  let editingId    = null;
  let cache        = { news: null, free: null };
  let newFiles     = [];    // 새로 추가할 File[]
  let keepAttach   = [];    // 수정 시 유지할 기존 첨부[]

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
    ul.innerHTML = `<li class="attach-existing-label">기존 첨부파일</li>` +
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
      errEl.textContent = '비밀번호가 올바르지 않습니다.';
      errEl.style.display = 'block'; return;
    }
    if (!token) {
      errEl.textContent = 'GitHub Token을 입력하세요.';
      errEl.style.display = 'block'; return;
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
    document.getElementById(`tab-${board}`).style.display = 'block';
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  };

  // ── 목록 로드 ────────────────────────────────
  async function loadList(board) {
    const listEl = document.getElementById(`list-${board}`);
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
    const listEl = document.getElementById(`list-${board}`);
    if (!posts.length) {
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
    ['write-title','write-date','write-author','write-content'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'write-author' ? '관리자'
                       : id === 'write-date'   ? GithubDB.today() : '';
    });
    const ed = document.getElementById('wysiwyg-editor');
    if (ed) ed.innerHTML = '';
    if (quillInstance) quillInstance.root.innerHTML = '';
    renderNewFiles();
    renderExistingFiles([]);
    const errEl = document.getElementById('modal-error');
    if (errEl) errEl.style.display = 'none';
    const prog = document.getElementById('attach-progress');
    if (prog) prog.style.display = 'none';
  }

  window.openWriteModal = function (board) {
    currentBoard = board;
    editingId    = null;
    resetForm();
    document.getElementById('modal-title').textContent   = '새 글 작성';
    document.getElementById('btn-submit').textContent    = '저장';
    document.getElementById('write-modal').style.display = 'flex';
  };

  window.openEditModal = function (board, id) {
    currentBoard = board;
    editingId    = id;
    resetForm();
    const post = (cache[board]?.content || []).find(p => p.id === id);
    if (!post) return;

    document.getElementById('modal-title').textContent   = '게시글 수정';
    document.getElementById('write-title').value         = post.title  || '';
    document.getElementById('write-date').value          = post.date   || '';
    document.getElementById('write-author').value        = post.author || '관리자';
    document.getElementById('write-content').value       = post.content || '';
    document.getElementById('btn-submit').textContent    = '수정 저장';
    renderExistingFiles(post.attachments || []);
    document.getElementById('write-modal').style.display = 'flex';
  };

  window.closeModal = function () {
    document.getElementById('write-modal').style.display = 'none';
    newFiles = []; keepAttach = [];
  };

  // ── 저장 ─────────────────────────────────────
  window.submitPost = async function () {
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
    let uploadedAttachments = [...keepAttach]; // 유지할 기존 첨부

    // 새 파일 업로드
    if (newFiles.length) {
      prog.style.display = 'block';
      for (let i = 0; i < newFiles.length; i++) {
        prog.textContent = `파일 업로드 중... (${i + 1}/${newFiles.length}) ${newFiles[i].name}`;
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
      id:          editingId || `post_${Date.now()}`,
      type:        (() => {
                     const el = document.getElementById('write-type');
                     if (el) return el.value;
                     // write-type 요소 없으면 수정 시 기존 type 유지, 신규는 ''
                     if (editingId) {
                       const existing = (cache[currentBoard]?.content || []).find(p => p.id === editingId);
                       return existing?.type || '';
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
      cache[currentBoard] = { content: posts, sha: result?.content?.sha || cached.sha };
      renderList(currentBoard, posts);
      closeModal();
    } catch (e) {
      showModalError(`저장 실패: ${e.message}`);
    } finally {
      btn.disabled    = false;
      btn.textContent = editingId ? '수정 저장' : '저장';
      prog.style.display = 'none';
    }
  };

  function showModalError(msg) {
    const el = document.getElementById('modal-error');
    el.textContent = msg; el.style.color = '#c00'; el.style.display = 'block';
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
      cache[board] = { content: posts, sha: result?.content?.sha || cached.sha };
      renderList(board, posts);
      closeDeleteModal();
    } catch (e) {
      alert(`삭제 실패: ${e.message}`);
    } finally {
      btn.textContent = '삭제'; btn.disabled = false;
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
  });


  // ══════════════════════════════════════════════
  //  Quill.js 에디터
  // ══════════════════════════════════════════════

  let quillInstance = null;

  // ── Quill에 table 태그 허용 등록 ─────────────
  // Quill 1.x는 기본적으로 <table>을 허용하지 않으므로
  // BlockEmbed Blot으로 등록해 삭제되지 않도록 함
  (function registerTableBlot() {
    try {
      const BlockEmbed = Quill.import('blots/block/embed');
      const Block      = Quill.import('blots/block');
      const Container  = Quill.import('blots/container');

      // <table> Blot
      class TableBlot extends BlockEmbed {
        static create(value) {
          const node = super.create();
          node.innerHTML = value || '';
          return node;
        }
        static value(node) { return node.innerHTML; }
      }
      TableBlot.blotName = 'table';
      TableBlot.tagName  = 'table';

      // <tr>, <td>, <th>, <thead>, <tbody> — Block으로 허용
      ['tr','td','th','thead','tbody'].forEach(tag => {
        class T extends Block {}
        T.blotName = tag;
        T.tagName  = tag;
        try { Quill.register(T, true); } catch(e) {}
      });

      Quill.register(TableBlot, true);
    } catch(e) {
      // Quill 미로드 시 무시
    }
  })();

  // ── Quill 초기화 ─────────────────────────────
  function initQuill() {
    // 이미 있으면 기존 인스턴스 반환
    if (quillInstance) return quillInstance;

    const quill = new Quill('#quill-editor', {
      theme: 'snow',
      placeholder: '내용을 입력하세요. 이미지는 Ctrl+V로 붙여넣기 할 수 있습니다.',
      modules: {
        toolbar: {
          container: [
            ['bold', 'italic', 'underline'],
            [{ 'header': [1, 2, 3, false] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link'],
            ['clean'],
          ],
        },
        clipboard: { matchVisual: false },
      },
    });

    // ── 이미지 Ctrl+V 붙여넣기 처리 ─────────────
    quill.root.addEventListener('paste', function(e) {
      const items = Array.from((e.clipboardData || {}).items || []);
      const imageItem = items.find(it => it.type.startsWith('image/'));
      if (!imageItem) return; // 이미지 아니면 Quill 기본 처리

      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) insertImageFile(file);
    });

    quillInstance = quill;
    return quill;
  }

  // ── 표 삽입 ──────────────────────────────────
  window.openTableDialog = function() {
    document.getElementById('table-dialog').style.display = 'flex';
    document.getElementById('tbl-rows').focus();
  };
  window.cancelInsertTable = function() {
    document.getElementById('table-dialog').style.display = 'none';
  };

  window.confirmInsertTable = function() {
    const rows = Math.max(1, Math.min(20, parseInt(document.getElementById('tbl-rows').value) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(document.getElementById('tbl-cols').value) || 3));
    document.getElementById('table-dialog').style.display = 'none';

    const quill  = quillInstance;
    if (!quill) return;
    const editor = quill.root;

    // 표 DOM 생성
    const table  = document.createElement('table');
    table.setAttribute('style', 'border-collapse:collapse;width:100%;margin:12px 0;');

    const thead   = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const th = document.createElement('th');
      th.setAttribute('style', 'border:1px solid #d0d5dd;padding:8px 12px;background:#f0f3f7;font-weight:600;min-width:80px;');
      th.textContent = '\u00a0';
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows - 1; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.setAttribute('style', 'border:1px solid #d0d5dd;padding:8px 12px;min-width:80px;');
        td.textContent = '\u00a0';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    // Quill disable → MutationObserver 중단 → DOM 삽입 → enable
    quill.disable();

    const sel = window.getSelection();
    let refNode = null;
    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node.parentNode !== editor) node = node.parentNode;
      refNode = node;
    }

    if (refNode && editor.contains(refNode)) {
      editor.insertBefore(table, refNode.nextSibling);
    } else {
      editor.appendChild(table);
    }

    // 표 뒤 빈 단락
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    if (table.nextSibling) editor.insertBefore(p, table.nextSibling);
    else editor.appendChild(p);

    quill.enable();

    // 첫 번째 셀에 커서
    setTimeout(() => {
      const firstCell = table.querySelector('th');
      if (firstCell) {
        firstCell.textContent = '';
        const r = document.createRange();
        r.setStart(firstCell, 0);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    }, 30);
  };

  function initTableContextMenu() {
    const editor = document.querySelector('#quill-editor .ql-editor');
    if (!editor) return;

    // 기존 메뉴 제거
    const old = document.getElementById('table-ctx-menu');
    if (old) old.remove();

    const menu = document.createElement('div');
    menu.id = 'table-ctx-menu';
    menu.className = 'table-ctx-menu';
    menu.style.display = 'none';
    menu.innerHTML = `
      <button onclick="tableCtx('addRow')">행 추가 (아래)</button>
      <button onclick="tableCtx('addCol')">열 추가 (오른쪽)</button>
      <hr style="margin:4px 0;border-color:#eee;">
      <button onclick="tableCtx('delRow')" style="color:#c00;">행 삭제</button>
      <button onclick="tableCtx('delCol')" style="color:#c00;">열 삭제</button>
      <button onclick="tableCtx('delTable')" style="color:#c00;">표 전체 삭제</button>
    `;
    document.body.appendChild(menu);

    let ctxCell = null;

    editor.addEventListener('contextmenu', function(e) {
      const cell = e.target.closest('td, th');
      if (!cell) return;
      e.preventDefault();
      ctxCell = cell;
      menu.style.display = 'block';
      menu.style.left = e.pageX + 'px';
      menu.style.top  = e.pageY + 'px';
    });

    document.addEventListener('click', () => { menu.style.display = 'none'; });

    window.tableCtx = function(action) {
      if (!ctxCell) return;
      const table = ctxCell.closest('table');
      const row   = ctxCell.closest('tr');
      const cellIdx = [...row.children].indexOf(ctxCell);

      if (action === 'addRow') {
        const cols = row.children.length;
        const newRow = document.createElement('tr');
        Array.from({length: cols}, () => {
          const td = document.createElement('td');
          td.style.cssText = 'border:1px solid #d0d5dd;padding:8px 12px;min-width:60px;';
          newRow.appendChild(td);
        });
        row.parentNode.insertBefore(newRow, row.nextSibling);
      } else if (action === 'addCol') {
        table.querySelectorAll('tr').forEach((r, ri) => {
          const isHead = r.parentNode.tagName === 'THEAD';
          const cell = document.createElement(isHead ? 'th' : 'td');
          cell.style.cssText = isHead
            ? 'border:1px solid #d0d5dd;padding:8px 12px;background:#f0f3f7;font-weight:600;min-width:60px;'
            : 'border:1px solid #d0d5dd;padding:8px 12px;min-width:60px;';
          const ref = r.children[cellIdx + 1] || null;
          r.insertBefore(cell, ref ? ref.nextSibling : null);
        });
      } else if (action === 'delRow') {
        if (table.querySelectorAll('tr').length > 1) row.remove();
        else table.remove();
      } else if (action === 'delCol') {
        const allRows = table.querySelectorAll('tr');
        if (allRows[0].children.length <= 1) { table.remove(); return; }
        allRows.forEach(r => { if (r.children[cellIdx]) r.children[cellIdx].remove(); });
      } else if (action === 'delTable') {
        table.remove();
      }
      menu.style.display = 'none';
    };
  }

  // ── 이미지 파일 → 즉시 미리보기 → 업로드 → URL 교체 ──
  async function insertImageFile(file) {
    const token = localStorage.getItem('hwaseo_token');
    if (!token) { alert('로그인 토큰이 없습니다.'); return; }

    const quill   = quillInstance;
    const range   = quill.getSelection(true);
    const insertAt = range ? range.index : Math.max(0, quill.getLength() - 1);

    // 1) base64로 에디터에 즉시 삽입 (사용자에게 바로 보임)
    const dataUrl = await fileToDataUrl(file);
    quill.insertEmbed(insertAt, 'image', dataUrl);
    quill.insertText(insertAt + 1, '\n');
    quill.setSelection(insertAt + 2);

    // 2) 백그라운드 업로드
    try {
      const result = await GithubDB.uploadFile(file, token, currentBoard);

      // 3) 에디터 DOM에서 해당 img의 src를 GitHub URL로 교체
      const imgs = quill.root.querySelectorAll(`img[src="${dataUrl}"]`);
      imgs.forEach(img => { img.src = result.rawUrl; });
    } catch (e) {
      alert(`이미지 업로드 실패: ${e.message}\n(이미지는 에디터에 표시되지만 저장 시 포함되지 않을 수 있습니다.)`);
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });
  }

  // ── Quill HTML → write-content textarea 동기화 ─
  function syncQuillToTextarea() {
    const ta = document.getElementById('write-content');
    if (!ta || !quillInstance) return;

    // Quill 편집 영역 HTML 복사 후 정제
    const editorEl = quillInstance.root;
    if (!editorEl) return;

    // DOM을 복제해서 Quill 전용 속성/클래스 제거
    const clone = editorEl.cloneNode(true);

    // contenteditable 속성 제거
    clone.removeAttribute('contenteditable');
    clone.removeAttribute('spellcheck');

    // Quill이 추가하는 data-* 속성 및 class 중 ql-* 제거
    clone.querySelectorAll('[class]').forEach(el => {
      const cleaned = [...el.classList]
        .filter(c => !c.startsWith('ql-'))
        .join(' ');
      if (cleaned) el.className = cleaned;
      else el.removeAttribute('class');
    });

    // ql-* 클래스만 있던 최상위 div wrapper 내용을 바로 사용
    ta.value = clone.innerHTML.trim();

    console.log('[저장 내용 확인] content:', ta.value.substring(0, 200));
  }

  // ── 저장된 HTML → Quill에 로드 ───────────────
  // 저장된 content → Quill에 로드 (HTML / 레거시 텍스트 모두 처리)
  function loadHtmlToQuill(content) {
    const quill = quillInstance || initQuill();
    if (!quill) return;

    const raw = content || '';

    // HTML 여부 판별 (Quill로 저장한 글은 <p> 등으로 시작)
    const isHtml = /^\s*<[a-zA-Z]/.test(raw.trim());

    if (isHtml) {
      // Quill HTML — 그대로 삽입
      quill.root.innerHTML = raw;
    } else {
      // 레거시 텍스트 포맷 → HTML 변환 후 삽입
      // \n → <br>, **bold** → <strong>, [텍스트](URL) → <a>
      let html = raw
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, '<br>');
      quill.root.innerHTML = `<p>${html}</p>`;
    }

    quill.setSelection(quill.getLength(), 0);
  }

  // ── openWriteModal 오버라이드 ─────────────────
  const _origOpenWrite = window.openWriteModal;
  window.openWriteModal = function(board) {
    _origOpenWrite(board);
    const quill = initQuill();
    quill.root.innerHTML = '';
    quill.focus();
    setTimeout(initTableContextMenu, 100);
  };

  // ── openEditModal 오버라이드 ──────────────────
  const _origOpenEdit = window.openEditModal;
  window.openEditModal = function(board, id) {
    _origOpenEdit(board, id);
    const post = (cache[board]?.content || []).find(p => p.id === id);
    initQuill();
    loadHtmlToQuill(post?.content || '');
    setTimeout(initTableContextMenu, 100);
  };

  // ── submitPost 오버라이드 ─────────────────────
  const _origSubmit = window.submitPost;
  window.submitPost = async function() {
    // 아직 업로드 중인 base64 이미지가 있으면 잠시 대기
    if (quillInstance) {
      const base64Imgs = quillInstance.root.querySelectorAll('img[src^="data:"]');
      if (base64Imgs.length > 0) {
        alert('이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 저장하세요.');
        return;
      }
    }
    syncQuillToTextarea();
    await _origSubmit();
  };

  // ── 새로고침 후 자동 로그인 복원 ─────────────
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
