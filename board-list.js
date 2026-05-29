/* =============================================
   화서문화유산연구원 | board-list.js
   게시판 목록 페이지 공통 로직 (GitHub JSON 연동)
   ============================================= */
async function initBoardList({ dataFile, boardSlug, boardLabel }) {
  const container = document.getElementById('board-container');
  const paginEl   = document.getElementById('pagination');
  const totalEl   = document.getElementById('total-count');
  const pageSize  = SITE_CONFIG.PAGE_SIZE;
  let currentPage = parseInt(GithubDB.getParam('page') || '1', 10);
  let allRows     = [];

  // ── 데이터 로드 ──
  try {
    const { content } = await GithubDB.readFile(dataFile);
    allRows = content;
  } catch (e) {
    container.textContent = `<div class="error-box">데이터를 불러오지 못했습니다.<br><small>${e.message}</small></div>`;
    return;
  }

  totalEl.innerHTML = allRows.length;

  if (!allRows.length) {
    container.innerHTML = '<div class="board-state"><p>등록된 게시글이 없습니다.</p></div>';
    return;
  }

  // ── 렌더 ──
  function render(page) {
    currentPage = page;
    const totalPages = Math.ceil(allRows.length / pageSize);
    const start      = (page - 1) * pageSize;
    const pageRows   = allRows.slice(start, start + pageSize);

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
          ${pageRows.map((row, i) => {
            const globalIdx = allRows.length - start - i;
            const isNotice  = row.type === '공지';
            const url       = GithubDB.postUrl(boardSlug, row.id);
            return `<tr>
              <td>${isNotice ? '<span class="tag-notice">공지</span>' : globalIdx}</td>
              <td class="col-title">
                <a href="${url}">${row.title || '(제목 없음)'}</a>
              </td>
              <td>${row.author || '관리자'}</td>
              <td>${row.date || ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    renderPagination(page, totalPages);
    history.replaceState(null, '', page === 1 ? location.pathname : `?page=${page}`);
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
    const total = Math.ceil(allRows.length / pageSize);
    if (page < 1 || page > total) return;
    render(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  render(currentPage);
}
