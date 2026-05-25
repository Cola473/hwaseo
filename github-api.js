/* =============================================
   화서문화유산연구원 | github-api.js
   GitHub API를 통한 JSON 데이터 읽기/쓰기
   ============================================= */
(function (global) {
  'use strict';

  const BASE = 'https://api.github.com';

  // sessionStorage에서 토큰 가져오기 (로그인 시 저장)
  function getToken() {
    return sessionStorage.getItem('hwaseo_token') || '';
  }

  function apiHeaders(token) {
    return {
      'Authorization': `token ${token || getToken()}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  // 파일 읽기 → { content: Array, sha: string }
  async function readFile(path) {
    const { GITHUB_OWNER: owner, GITHUB_REPO: repo, GITHUB_BRANCH: branch } = SITE_CONFIG;
    const url = `${BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${Date.now()}`;
    const res = await fetch(url, { headers: apiHeaders() });

    if (res.status === 404) {
      // 파일 없으면 빈 배열로 시작
      return { content: [], sha: null };
    }
    if (!res.ok) throw new Error(`GitHub 읽기 실패: ${res.status}`);

    const data = await res.json();
    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    return { content: JSON.parse(decoded), sha: data.sha };
  }

  // 파일 쓰기 (생성 또는 업데이트)
  async function writeFile(path, content, sha, token) {
    const { GITHUB_OWNER: owner, GITHUB_REPO: repo, GITHUB_BRANCH: branch } = SITE_CONFIG;
    const url = `${BASE}/repos/${owner}/${repo}/contents/${path}`;
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));

    const body = {
      message: `게시글 업데이트: ${path}`,
      content: encoded,
      branch,
      ...(sha ? { sha } : {}),
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: apiHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub 쓰기 실패: ${res.status}`);
    }
    return res.json();
  }

  // 토큰 유효성 검사
  async function validateToken(token) {
    const { GITHUB_OWNER: owner, GITHUB_REPO: repo } = SITE_CONFIG;
    const res = await fetch(`${BASE}/repos/${owner}/${repo}`, {
      headers: apiHeaders(token),
    });
    return res.ok;
  }

  // URL 파라미터
  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  // 날짜 포맷 YYYY.MM.DD
  function today() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}`;
  }

  // 게시글 URL
  function postUrl(board, id) {
    return `post.html?board=${board}&id=${id}`;
  }

  global.GithubDB = { readFile, writeFile, validateToken, getParam, today, postUrl };
})(window);
