/* =============================================
   화서문화유산연구원 | script.js
   ============================================= */

(function () {
  'use strict';

  /* ── 헤더 스크롤 효과 ── */
  const header = document.getElementById('site-header');

  function onScroll() {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── 히어로 켄번즈 효과 시작 ── */
  const hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('load', function () {
      hero.classList.add('loaded');
    });
  }

  /* ── 모바일 메뉴 토글 ── */
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const gnb       = document.getElementById('gnb');

  if (mobileBtn && gnb) {
    mobileBtn.addEventListener('click', function () {
      const isOpen = gnb.classList.toggle('open');
      mobileBtn.setAttribute('aria-expanded', isOpen);
      mobileBtn.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // 모바일에서 GNB 항목 클릭 시 서브메뉴 토글
    const gnbItems = gnb.querySelectorAll('.gnb-item.has-sub');
    gnbItems.forEach(function (item) {
      const link = item.querySelector('.gnb-link');
      link.addEventListener('click', function (e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          item.classList.toggle('open');
        }
      });
    });

    // 오버레이 클릭 시 닫기
    document.addEventListener('click', function (e) {
      if (gnb.classList.contains('open') &&
          !gnb.contains(e.target) &&
          !mobileBtn.contains(e.target)) {
        gnb.classList.remove('open');
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.setAttribute('aria-label', '메뉴 열기');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── 퀵링크 스크롤 이동 ── */
  const heroBtn = document.querySelector('.hero-btn');
  if (heroBtn) {
    heroBtn.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const headerH = parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('--header-h'));
        const top = target.getBoundingClientRect().top + window.scrollY - headerH;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  }

  /* ── 게시판 날짜 포맷 ── */
  // 필요 시 서버 데이터를 가져와 동적으로 렌더링하는 코드를 여기에 추가하세요.
  // 현재는 HTML에 정적으로 작성된 내용을 사용합니다.

  /* ── 이미지 로드 에러 처리 (로고 폴백) ── */
  document.querySelectorAll('img[onerror]').forEach(function (img) {
    // onerror 속성 인라인 핸들러가 이미 처리하므로 추가 작업 불필요
  });

  /* ── 리사이즈 시 모바일 메뉴 초기화 ── */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && gnb && gnb.classList.contains('open')) {
      gnb.classList.remove('open');
      if (mobileBtn) {
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.setAttribute('aria-label', '메뉴 열기');
      }
      document.body.style.overflow = '';
    }
  });

  /* ── 현재 연도 자동 업데이트 (푸터 저작권) ── */
  const copyEls = document.querySelectorAll('.footer-copy');
  copyEls.forEach(function (el) {
    el.textContent = el.textContent.replace(/\d{4}/, new Date().getFullYear());
  });

  /* ── 모바일 메뉴 버튼 애니메이션 ── */
  if (mobileBtn) {
    mobileBtn.addEventListener('click', function () {
      const spans = this.querySelectorAll('span');
      const isOpen = gnb.classList.contains('open');
      if (isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity   = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity   = '';
        spans[2].style.transform = '';
      }
    });
  }

  /* Consultation popup */
  const consultInfo = {
    phone: '031-8073-9030',
    time: '평일 09:00 - 18:00',
    email: 'hwaseo130@naver.com',
    readyItems: [
      '1. 조사 대상지 주소 또는 지번',
      '2. 사업 종류와 현재 진행 단계',
      '3. 대상지 면적, 위치도, 현장 사진',
      '4. 문화재 관련 인허가 또는 안내받은 공문 내용',
      '5. 희망 상담 방식과 연락 가능한 시간'
    ]
  };

  function createConsultModal() {
    if (document.getElementById('consultModal')) {
      return document.getElementById('consultModal');
    }

    const modal = document.createElement('div');
    modal.id = 'consultModal';
    modal.className = 'consult-modal-backdrop';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <section class="consult-modal" role="dialog" aria-modal="true" aria-labelledby="consultModalTitle">
        <div class="consult-modal-head">
          <h2 class="consult-modal-title" id="consultModalTitle">상담문의 안내</h2>
          <button type="button" class="consult-modal-close" aria-label="닫기">&times;</button>
        </div>
        <div class="consult-modal-body">
          <div class="consult-contact-grid">
            <div class="consult-contact-card">
              <span class="consult-contact-label">전화번호</span>
              <strong class="consult-contact-value"><a href="tel:${consultInfo.phone.replace(/-/g, '')}">${consultInfo.phone}</a></strong>
            </div>
            <div class="consult-contact-card">
              <span class="consult-contact-label">상담시간</span>
              <strong class="consult-contact-value">${consultInfo.time}</strong>
            </div>
            <div class="consult-contact-card">
              <span class="consult-contact-label">메일주소</span>
              <strong class="consult-contact-value"><a href="mailto:${consultInfo.email}">${consultInfo.email}</a></strong>
            </div>
          </div>
          <div class="consult-ready-box">
            <h3 class="consult-ready-title">[상담 시 필요한 내용]</h3>
            <ul class="consult-ready-list">
              ${consultInfo.readyItems.map(function (item) {
                return `<li>${item}</li>`;
              }).join('')}
            </ul>
          </div>
        </div>  
      </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  const consultModal = createConsultModal();

  function openConsultModal() {
    consultModal.classList.add('is-open');
    consultModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('consult-modal-open');
    const closeButton = consultModal.querySelector('.consult-modal-close');
    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeConsultModal() {
    consultModal.classList.remove('is-open');
    consultModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('consult-modal-open');
  }

  document.addEventListener('click', function (e) {
    const clickedEl = e.target.closest ? e.target.closest('a, button') : null;
    const consultTrigger = clickedEl && (
      clickedEl.matches('.consult-btn, .sidebar-quick-item.accent') ||
      clickedEl.getAttribute('href') === 'survey-request.html' ||
      clickedEl.textContent.indexOf('상담문의') !== -1
    );
    if (consultTrigger) {
      e.preventDefault();
      openConsultModal();
      return;
    }

    if (e.target === consultModal || e.target.closest('.consult-modal-close')) {
      closeConsultModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && consultModal.classList.contains('is-open')) {
      closeConsultModal();
    }
  });

})();
