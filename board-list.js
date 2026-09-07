/* =============================================
   화서문화유산연구원 | board-list.js
   게시판 목록 페이지 공통 로직 (GitHub JSON 연동)
   ============================================= */
// 검색어에 포함된 HTML 특수문자를 이스케이프 (제목 하이라이트 시 태그 주입 방지)
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

// 제목 문자열에서 검색어와 일치하는 부분을 <mark>로 감싸 강조 표시
function highlightTitle(title, keyword) {
  const safeTitle = escapeHtml(title || '(제목 없음)');
  if (!keyword) return safeTitle;
  const safeKeyword = escapeHtml(keyword);
  const idx = safeTitle.toLowerCase().indexOf(safeKeyword.toLowerCase());
  if (idx === -1) return safeTitle;
  return safeTitle.slice(0, idx)
    + '<mark class="search-hit">' + safeTitle.slice(idx, idx + safeKeyword.length) + '</mark>'
    + safeTitle.slice(idx + safeKeyword.length);
}

async function initBoardList({ dataFile, boardSlug, boardLabel }) {
  const container = document.getElementById('board-container');
  const paginEl   = document.getElementById('pagination');
  const totalEl   = document.getElementById('total-count');
  const pageSize  = SITE_CONFIG.PAGE_SIZE;
  const NOTICE_PIN_MAX = SITE_CONFIG.NOTICE_PIN_MAX || 5; // 상단 고정 공지 최대 노출 개수
  let currentPage = parseInt(GithubDB.getParam('page') || '1', 10);
  let allRows      = [];
  let filteredRows = []; // 검색 결과(검색어 없으면 allRows와 동일)
  let pinnedNotices = []; // 1페이지 상단에 고정 노출할 공지 (최신순 최대 5개)
  let searchKeyword = (GithubDB.getParam('q') || '').trim();

  // ── 검색창 UI 삽입 ──
  const toolbar = document.querySelector('.board-toolbar');
  let searchInputEl = null;
  if (toolbar) {
    const searchWrap = document.createElement('div');
    searchWrap.className = 'board-search';
    searchWrap.innerHTML = `
      <input type="text" id="board-search-input" class="board-search-input"
             placeholder="제목으로 검색" value="${escapeHtml(searchKeyword)}" />
      <button type="button" id="board-search-btn" class="board-search-btn">검색</button>
    `;
    toolbar.appendChild(searchWrap);
    searchInputEl = searchWrap.querySelector('#board-search-input');
    const searchBtnEl = searchWrap.querySelector('#board-search-btn');
    const doSearch = () => applyFilter(searchInputEl.value);
    searchBtnEl.addEventListener('click', doSearch);
    searchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    });
  }

  // ── 데이터 로드 ──
  try {
    const { content } = await GithubDB.readFile(dataFile);
    allRows = content;
  } catch (e) {
    container.textContent = `<div class="error-box">데이터를 불러오지 못했습니다.<br><small>${e.message}</small></div>`;
    return;
  }

  if (!allRows.length) {
    totalEl.innerHTML = 0;
    container.innerHTML = '<div class="board-state"><p>등록된 게시글이 없습니다.</p></div>';
    return;
  }

  // 배열은 최신 작성순으로 저장되어 있으므로(unshift) 그 순서 그대로
  // 앞에서부터 최대 5개의 공지를 뽑아 1페이지 상단에 고정 노출한다.
  pinnedNotices = allRows.filter(row => row.type === '공지').slice(0, NOTICE_PIN_MAX);
  const pinnedIds = new Set(pinnedNotices.map(row => row.id));

  // ── 제목 검색 필터 적용 ──
  function applyFilter(keyword) {
    searchKeyword = (keyword || '').trim();
    filteredRows = searchKeyword
      ? allRows.filter(row => (row.title || '').toLowerCase().includes(searchKeyword.toLowerCase()))
      : allRows;
    render(1);
  }

  // ── 렌더 ──
  function buildRow(row, globalIdx, { pinned = false, isNewest = false } = {}) {
    const isNotice = row.type === '공지';
    const url      = GithubDB.postUrl(boardSlug, row.id);
    return `<tr class="${pinned ? 'row-notice-pinned' : ''}">
      <td>${isNotice ? '<span class="tag-notice">공지</span>' : globalIdx}</td>
      <td class="col-title">
        <a href="${url}">
          <span class="title-text">${highlightTitle(row.title, searchKeyword)}</span>
          ${isNewest ? '<img src="images/new.png" alt="신규" class="new-icon" />' : ''}
        </a>
      </td>
      <td>${row.author || '관리자'}</td>
      <td>${row.date || ''}</td>
    </tr>`;
  }

  function render(page) {
    currentPage = page;
    const rows        = filteredRows;
    const isSearching = !!searchKeyword;

    totalEl.innerHTML = rows.length;

    if (!rows.length) {
      container.innerHTML = `<div class="board-state"><p>'${escapeHtml(searchKeyword)}'(으)로 검색된 게시글이 없습니다.</p></div>`;
      paginEl.innerHTML = '';
      updateUrl(page);
      return;
    }

    const totalPages = Math.ceil(rows.length / pageSize);
    const start      = (page - 1) * pageSize;
    const pageRows   = rows.slice(start, start + pageSize);
    const newestId   = allRows[0] ? allRows[0].id : null;

    // 검색 중이 아닐 때, 1페이지에서만 공지 상단 고정 영역을 보여준다.
    // 본문 목록에서는 상단에 고정된 공지와 같은 글(중복)을 제외한다.
    const pinnedHtml = (!isSearching && page === 1 && pinnedNotices.length)
      ? pinnedNotices.map(row => buildRow(row, '', { pinned: true, isNewest: row.id === newestId })).join('')
      : '';

    const bodyHtml = pageRows
      .map((row, i) => ({ row, globalIdx: rows.length - start - i }))
      .filter(({ row }) => !(!isSearching && page === 1 && pinnedIds.has(row.id)))
      .map(({ row, globalIdx }) => buildRow(row, globalIdx, { isNewest: row.id === newestId }))
      .join('');

    container.innerHTML = `
      <table class="board-table">
        <thead>
          <tr>
            <th style="width:70px;">번호</th>
            <th class="col-title">제목</th>
            <th style="width:120px;">작성자</th>
            <th style="width:110px;">날짜</th>
          </tr>
        </thead>
        <tbody>
          ${pinnedHtml}
          ${bodyHtml}
        </tbody>
      </table>`;

    renderPagination(page, totalPages);
    updateUrl(page);
  }

  // 현재 페이지/검색어를 주소창 쿼리스트링에 반영 (새로고침·공유 시 유지)
  function updateUrl(page) {
    const params = new URLSearchParams();
    if (searchKeyword) params.set('q', searchKeyword);
    if (page > 1) params.set('page', page);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function renderPagination(current, total) {
    if (total <= 1) { paginEl.innerHTML = ''; return; }
    const range = 5;
    let start = Math.max(1, current - Math.floor(range / 2));
    let end   = Math.min(total, start + range - 1);
    if (end - start < range - 1) start = Math.max(1, end - range + 1);

    let html = `<button class="page-btn ${current===1?'disabled':''}" onclick="changePage(${current-1})" ${current===1?'disabled':''}>‹</button>`;
    if (start > 1) { html += `<button class="page-btn" onclick="changePage(1)">1</button>`; if (start>2) html += `<span class="page-btn disabled" style="border:none;">…</span>`; }
    for (let i = start; i <= end; i++) html += `<button class="page-btn ${i===current?'active':''}" onclick="changePage(${i})">${i}</button>`;
    if (end < total) { if (end<total-1) html += `<span class="page-btn disabled" style="border:none;">…</span>`; html += `<button class="page-btn" onclick="changePage(${total})">${total}</button>`; }
    html += `<button class="page-btn ${current===total?'disabled':''}" onclick="changePage(${current+1})" ${current===total?'disabled':''}>›</button>`;
    paginEl.innerHTML = html;
  }

  window.changePage = function (page) {
    const total = Math.ceil(filteredRows.length / pageSize);
    if (page < 1 || page > total) return;
    render(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 초기 렌더: URL에 검색어(q)가 있으면 검색 상태로, 없으면 전체 목록으로 시작
  filteredRows = searchKeyword
    ? allRows.filter(row => (row.title || '').toLowerCase().includes(searchKeyword.toLowerCase()))
    : allRows;
  render(currentPage);
}
