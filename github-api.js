/* =============================================
   화서문화유산연구원 | github-api.js
   GitHub API 읽기 / 쓰기 / 파일 업로드
   ============================================= */
(function (global) {
  'use strict';

  const BASE = 'https://api.github.com';

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

  // ── JSON 파일 읽기 ──────────────────────────
  async function readFile(path) {
    const { GITHUB_OWNER: o, GITHUB_REPO: r, GITHUB_BRANCH: b } = SITE_CONFIG;
    const res = await fetch(
      `${BASE}/repos/${o}/${r}/contents/${path}?ref=${b}&t=${Date.now()}`,
      { headers: apiHeaders() }
    );
    if (res.status === 404) return { content: [], sha: null };
    if (!res.ok) throw new Error(`읽기 실패: ${res.status}`);
    const data = await res.json();
    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    return { content: JSON.parse(decoded), sha: data.sha };
  }

  // ── JSON 파일 쓰기 ──────────────────────────
  async function writeFile(path, content, sha, token) {
    const { GITHUB_OWNER: o, GITHUB_REPO: r, GITHUB_BRANCH: b } = SITE_CONFIG;
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
    const res = await fetch(`${BASE}/repos/${o}/${r}/contents/${path}`, {
      method: 'PUT',
      headers: apiHeaders(token),
      body: JSON.stringify({
        message: `게시글 업데이트: ${path}`,
        content: encoded,
        branch: b,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `쓰기 실패: ${res.status}`);
    }
    return res.json();
  }

  // ── 바이너리 파일 업로드 (이미지·첨부파일) ──
  // File 객체 → base64 → GitHub contents API
  async function uploadFile(file, token) {
    const { GITHUB_OWNER: o, GITHUB_REPO: r, GITHUB_BRANCH: b } = SITE_CONFIG;

    // 파일명 충돌 방지: 타임스탬프 + 원본명
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-가-힣]/g, '_')}`;
    const isImage  = file.type.startsWith('image/');
    const folder   = isImage ? 'uploads/images' : 'uploads/files';
    const path     = `${folder}/${safeName}`;

    // File → ArrayBuffer → base64
    const buffer  = await file.arrayBuffer();
    const bytes   = new Uint8Array(buffer);
    let binary    = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const encoded = btoa(binary);

    const res = await fetch(`${BASE}/repos/${o}/${r}/contents/${path}`, {
      method: 'PUT',
      headers: apiHeaders(token),
      body: JSON.stringify({
        message: `첨부 업로드: ${safeName}`,
        content: encoded,
        branch: b,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `업로드 실패: ${res.status}`);
    }

    const result = await res.json();
    // raw 파일 URL (GitHub Pages에서 직접 접근 가능)
    const rawUrl = `https://${o}.github.io/${r}/${path}`;
    return { path, rawUrl, name: file.name, size: file.size, isImage };
  }

  // ── 파일 삭제 ───────────────────────────────
  async function deleteUpload(path, token) {
    const { GITHUB_OWNER: o, GITHUB_REPO: r, GITHUB_BRANCH: b } = SITE_CONFIG;
    // 먼저 sha 조회
    const res = await fetch(`${BASE}/repos/${o}/${r}/contents/${path}?ref=${b}`,
      { headers: apiHeaders(token) });
    if (!res.ok) return; // 이미 없으면 무시
    const { sha } = await res.json();

    await fetch(`${BASE}/repos/${o}/${r}/contents/${path}`, {
      method: 'DELETE',
      headers: apiHeaders(token),
      body: JSON.stringify({ message: `첨부 삭제: ${path}`, sha, branch: b }),
    });
  }

  // ── 토큰 검증 ───────────────────────────────
  async function validateToken(token) {
    const { GITHUB_OWNER: o, GITHUB_REPO: r } = SITE_CONFIG;
    const res = await fetch(`${BASE}/repos/${o}/${r}`, { headers: apiHeaders(token) });
    return res.ok;
  }

  // ── 유틸 ────────────────────────────────────
  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function today() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}`;
  }

  function postUrl(board, id) {
    return `post.html?board=${board}&id=${id}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
  }

  global.GithubDB = {
    readFile, writeFile, uploadFile, deleteUpload,
    validateToken, getParam, today, postUrl, formatBytes,
  };
})(window);
