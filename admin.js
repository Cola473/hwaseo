/* =============================================
   화서문화유산연구원 | admin.js
   관리자 페이지 로직
   ============================================= */
(function () {
  'use strict';

  // ── 상태 ────────────────────────────────────
  let currentBoard = 'news';   // 현재 탭
  let editingId    = null;     // 수정 중인 글 ID (null = 새 글)
  let cache        = { news: null, free: null }; // { content, sha }

  // ── 설정 헬퍼 ───────────────────────────────
  function dataFile(board) {
    return board === 'news'
      ? SITE_CONFIG.DATA_FILE_NEWS
      : SITE_CONFIG.DATA_FILE_FREE;
  }

  // ── 로그인 ───────────────────────────────────
  window.doLogin = async function () {
    const pw    = document.getElementById('input-password').value.trim();
    const token = document.getElementById('input-token').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    if (pw !== SITE_CONFIG.ADMIN_PASSWORD) {
      errEl.textContent = '비밀번호가 올바르지 않습니다.';
      errEl.style.display = 'block';
      return;
    }
    if (!token) {
      errEl.textContent = 'GitHub Token을 입력하세요.';
      errEl.style.display = 'block';
      return;
    }

    errEl.textContent = '토큰 확인 중...';
    errEl.style.color = 'var(--color-navy-mid)';
    errEl.style.display = 'block';

    const ok = await GithubDB.validateToken(token);
    if (!ok) {
      errEl.textContent = '토큰이 유효하지 않거나 저장소 접근 권한이 없습니다.';
      errEl.style.color = '#c00';
      return;
    }

    sessionStorage.setItem('hwaseo_token', token);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    document.getElementById('admin-badge').style.display  = 'inline-block';
    errEl.style.display = 'none';

    loadList('news');
    loadList('free');
  };

  window.doLogout = function () {
    sessionStorage.removeItem('hwaseo_token');
    location.reload();
  };

  // ── 탭 전환 ─────────────────────────────────
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
        </span>
        <span class="admin-post-date">${p.date}</span>
        <span class="admin-post-actions">
          <button class="btn-edit" onclick="openEditModal('${board}', '${p.id}')">수정</button>
          <button class="btn-del"  onclick="openDeleteModal('${board}', '${p.id}')">삭제</button>
        </span>
      </div>
    `).join('');
  }

  // ── 글쓰기 모달 ─────────────────────────────
  window.openWriteModal = function (board) {
    currentBoard = board;
    editingId    = null;
    document.getElementById('modal-title').textContent  = '새 글 작성';
    document.getElementById('write-type').value         = '';
    document.getElementById('write-title').value        = '';
    document.getElementById('write-date').value         = GithubDB.today();
    document.getElementById('write-author').value       = '관리자';
    document.getElementById('write-content').value      = '';
    document.getElementById('modal-error').style.display = 'none';
    document.getElementById('btn-submit').textContent   = '저장';
    document.getElementById('write-modal').style.display = 'flex';
  };

  window.openEditModal = function (board, id) {
    currentBoard = board;
    editingId    = id;
    const posts  = (cache[board] && cache[board].content) || [];
    const post   = posts.find(p => p.id === id);
    if (!post) return;

    document.getElementById('modal-title').textContent   = '게시글 수정';
    document.getElementById('write-type').value          = post.type || '';
    document.getElementById('write-title').value         = post.title;
    document.getElementById('write-date').value          = post.date;
    document.getElementById('write-author').value        = post.author || '관리자';
    document.getElementById('write-content').value       = post.content;
    document.getElementById('modal-error').style.display = 'none';
    document.getElementById('btn-submit').textContent    = '수정 저장';
    document.getElementById('write-modal').style.display = 'flex';
  };

  window.closeModal = function () {
    document.getElementById('write-modal').style.display = 'none';
  };

  // ── 저장 ─────────────────────────────────────
  window.submitPost = async function () {
    const title   = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    const errEl   = document.getElementById('modal-error');
    const btn     = document.getElementById('btn-submit');
    errEl.style.display = 'none';

    if (!title)   { showModalError('제목을 입력하세요.'); return; }
    if (!content) { showModalError('내용을 입력하세요.'); return; }

    btn.textContent = '저장 중...';
    btn.disabled    = true;

    const post = {
      id:      editingId || `post_${Date.now()}`,
      type:    document.getElementById('write-type').value,
      title,
      date:    document.getElementById('write-date').value || GithubDB.today(),
      author:  document.getElementById('write-author').value || '관리자',
      content,
    };

    try {
      const cached = cache[currentBoard] || { content: [], sha: null };
      let posts    = [...(cached.content || [])];

      if (editingId) {
        const idx = posts.findIndex(p => p.id === editingId);
        if (idx !== -1) posts[idx] = post;
      } else {
        posts.unshift(post); // 최신 글이 맨 위
      }

      const token = sessionStorage.getItem('hwaseo_token');
      const result = await GithubDB.writeFile(dataFile(currentBoard), posts, cached.sha, token);

      // sha 업데이트
      cache[currentBoard] = {
        content: posts,
        sha: result.content.sha,
      };

      renderList(currentBoard, posts);
      closeModal();
    } catch (e) {
      showModalError(`저장 실패: ${e.message}`);
    } finally {
      btn.textContent = editingId ? '수정 저장' : '저장';
      btn.disabled    = false;
    }
  };

  function showModalError(msg) {
    const el = document.getElementById('modal-error');
    el.textContent     = msg;
    el.style.display   = 'block';
    el.style.color     = '#c00';
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
    btn.textContent = '삭제 중...';
    btn.disabled    = true;

    try {
      const cached = cache[board] || { content: [], sha: null };
      const posts  = cached.content.filter(p => p.id !== id);
      const token  = sessionStorage.getItem('hwaseo_token');
      const result = await GithubDB.writeFile(dataFile(board), posts, cached.sha, token);

      cache[board] = { content: posts, sha: result.content.sha };
      renderList(board, posts);
      closeDeleteModal();
    } catch (e) {
      alert(`삭제 실패: ${e.message}`);
    } finally {
      btn.textContent = '삭제';
      btn.disabled    = false;
    }
  }

  // ── ESC 키로 모달 닫기 ───────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });

})();
