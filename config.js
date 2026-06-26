/* =============================================
   화서문화유산연구원 | config.js
   ★ 이 파일만 설정하면 됩니다 ★
   ============================================= */
const SITE_CONFIG = {
  GITHUB_OWNER:  'Cola473',
  GITHUB_REPO:   'hwaseo',
  GITHUB_BRANCH: 'main',

  // 게시글 JSON 파일 경로
  DATA_FILE_NEWS:   'data/posts-news.json',    // 학계소식
  DATA_FILE_FREE:   'data/posts-free.json',    // 자유게시판
  DATA_FILE_NOTICE: 'data/posts-notice.json',  // 공지사항
  DATA_FILE_SURVEY1:'data/posts-surface.json', // 지표조사
  DATA_FILE_SURVEY2:'data/posts-excavation.json', // 발굴조사
  DATA_FILE_SURVEY3:'data/posts-academic.json',// 학술연구용역
  DATA_FILE_REPORT: 'data/posts-report.json',  // 발간보고서

  ADMIN_PASSWORD:  'hwaseo2024!',
  MAIN_LIST_COUNT: 5,
  PAGE_SIZE:       15,
  NOTICE_PIN_MAX:  5, // 게시판 목록 1페이지 상단에 고정 노출할 공지 최대 개수
};
