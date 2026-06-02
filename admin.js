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
      cache[currentBoard] = { content: posts, sha: result.content.sha };
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
      cache[board] = { content: posts, sha: result.content.sha };
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
