/* =============================================
   화서문화유산연구원 | gnb.js
   GNB 공통 렌더링 + 현재 페이지 active 처리
   ============================================= */
(function () {
  'use strict';

  const GNB_DATA = [
    {
      label: '연구원소개',
      sub: [
        { label: '인사말',                   href: 'about-greeting.html' },
        { label: '로고 CI 유래와 이름의 의미', href: 'about-ci.html' },
        { label: '조직도/부서안내',           href: 'about-org.html' },
        { label: '오시는 길',                 href: 'about-map.html' },
      ],
    },
    {
      label: '매장유산조사안내',
      sub: [
        { label: '문화유산조사란?',   href: 'survey-about.html' },
        { label: '조사의뢰 및 방법', href: 'survey-request.html' },
        { label: '국비지원',         href: 'survey-support.html' },
        { label: '조사비용 자동계산', href: 'survey-calc.html' },
      ],
    },
    {
      label: '조사현황',
      sub: [
        { label: '지표조사',     href: 'research-surface.html' },
        { label: '발굴조사',     href: 'research-excavation.html' },
        { label: '학술연구용역', href: 'research-academic.html' },
      ],
    },
    {
      label: '자료실',
      sub: [
        { label: '발간보고서', href: 'archive-report.html' },
      ],
    },
    {
      label: '게시판',
      sub: [
        { label: '학계소식',   href: 'board-news.html' },
        { label: '자유게시판', href: 'board-free.html' },
        { label: '공지사항',   href: 'board-notice.html' },
      ],
    },
  ];

  // 현재 페이지 파일명
  const currentPage = location.pathname.split('/').pop() || 'index.html';

  // GNB HTML 생성
  function buildGnb() {
    return GNB_DATA.map(menu => {
      const isActive = menu.sub.some(s => s.href === currentPage);
      const subHtml = menu.sub.map(s => {
        const isCurrent = s.href === currentPage;
        return `<li><a href="${s.href}"${isCurrent ? ' style="color:var(--color-navy);font-weight:600;"' : ''}>${s.label}</a></li>`;
      }).join('');
      return `
        <li class="gnb-item has-sub${isActive ? ' active' : ''}">
          <a href="#" class="gnb-link">${menu.label}</a>
          <ul class="sub-menu">${subHtml}</ul>
        </li>`;
    }).join('');
  }

  // GNB 삽입
  const gnbEl = document.getElementById('gnb');
  if (gnbEl) {
    gnbEl.innerHTML = `<ul class="gnb-list">${buildGnb()}</ul>`;
  }

  // 사이드바 active 처리 (sidebar-nav 안의 현재 페이지 링크)
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.getAttribute('href') === currentPage) {
      a.classList.add('active');
    }
  });

})();
