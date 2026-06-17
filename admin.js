/* =============================================
   화서문화유산연구원 | admin.js
   에디터: ProseMirror (Tiptap 대체 직접 구현)
   ============================================= */
(function () {
  'use strict';

  // ── 상태 ─────────────────────────────────────
  let currentBoard = 'surface';
  let editingId    = null;
  let cache        = {};
  let newFiles     = [];
  let keepAttach   = [];

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

  // ══════════════════════════════════════════════
  //  ProseMirror 에디터 (Tiptap 기능 직접 구현)
  // ══════════════════════════════════════════════

  let pmEditor = null; // EditorView 인스턴스

  // ── 스키마 빌드 ───────────────────────────────
  function buildSchema() {
    const {
      Schema,
      DOMParser: PMDOMParser,
    } = window.ProsemirrorModel || prosemirrorModel;

    const {
      nodes: basicNodes,
      marks: basicMarks,
    } = window.ProsemirrorSchemaBasic || prosemirrorSchemaBasic;

    const { addListNodes } = window.ProsemirrorSchemaList || prosemirrorSchemaList;

    const { tableNodes } = window.ProsemirrorTables || prosemirrorTables;

    // 기본 노드에 리스트, 이미지, 표 추가
    let nodes = addListNodes(
      basicNodes.append({
        image: {
          inline: true,
          attrs: { src: {}, alt: { default: null }, title: { default: null } },
          group: 'inline',
          draggable: true,
          parseDOM: [{ tag: 'img[src]', getAttrs(dom) {
            return { src: dom.getAttribute('src'), alt: dom.getAttribute('alt'), title: dom.getAttribute('title') };
          }}],
          toDOM(node) { return ['img', node.attrs]; },
        },
      }),
      'paragraph block*',
      'block'
    );

    // 표 노드 추가
    nodes = nodes.append(tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {},
    }));

    // 마크: 기본 + underline + strikethrough + link
    const marks = basicMarks.append({
      underline: {
        parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
        toDOM() { return ['u', 0]; },
      },
      strikethrough: {
        parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
        toDOM() { return ['s', 0]; },
      },
    });

    return new Schema({ nodes, marks });
  }

  // ── 플러그인 모음 ─────────────────────────────
  function buildPlugins(schema) {
    const { keymap }     = window.ProsemirrorKeymap    || prosemirrorKeymap;
    const { history, undo, redo } = window.ProsemirrorHistory || prosemirrorHistory;
    const { baseKeymap, toggleMark, setBlockType, wrapIn, lift,
            chainCommands, exitCode, newlineInCode,
            createParagraphNear, liftEmptyBlock, splitBlockKeepMarks } =
              window.ProsemirrorCommands || prosemirrorCommands;
    const { wrapInList, splitListItem, liftListItem, sinkListItem } =
      window.ProsemirrorSchemaList || prosemirrorSchemaList;
    const { dropCursor }  = window.ProsemirrorDropcursor || prosemirrorDropcursor;
    const { gapCursor }   = window.ProsemirrorGapcursor  || prosemirrorGapcursor;
    const { columnResizing, tableEditing, goToNextCell } =
      window.ProsemirrorTables || prosemirrorTables;

    const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

    const editorKeymap = keymap({
      'Mod-z':       undo,
      'Shift-Mod-z': redo,
      'Mod-b':       toggleMark(schema.marks.strong),
      'Mod-i':       toggleMark(schema.marks.em),
      'Mod-u':       toggleMark(schema.marks.underline),
      'Tab':         goToNextCell(1),
      'Shift-Tab':   goToNextCell(-1),
      'Enter':       chainCommands(
                       newlineInCode,
                       createParagraphNear,
                       liftEmptyBlock,
                       splitBlockKeepMarks
                     ),
    });

    return [
      history(),
      keymap(baseKeymap),
      editorKeymap,
      dropCursor(),
      gapCursor(),
      columnResizing(),
      tableEditing(),
    ];
  }

  // ── 에디터 초기화 ─────────────────────────────
  function initEditor() {
    if (pmEditor) return pmEditor;

    const { EditorState }      = window.ProsemirrorState || prosemirrorState;
    const { EditorView }       = window.ProsemirrorView  || prosemirrorView;
    const { DOMParser: PMParser, DOMSerializer } = window.ProsemirrorModel || prosemirrorModel;

    const schema  = buildSchema();
    const plugins = buildPlugins(schema);

    const container = document.getElementById('tiptap-editor');
    if (!container) return null;

    const state = EditorState.create({
      schema,
      plugins,
      doc: schema.node('doc', null, [schema.node('paragraph')]),
    });

    const view = new EditorView(container, {
      state,
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);
        updateToolbarState();
        updateLinkBubble();
      },
      // 이미지 붙여넣기 처리
      handleDOMEvents: {
        paste(view, event) {
          const items = Array.from((event.clipboardData || {}).items || []);
          const imageItem = items.find(it => it.type.startsWith('image/'));
          if (!imageItem) return false;
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) handleImageFile(file);
          return true;
        },
        // 표 우클릭 컨텍스트 메뉴
        contextmenu(view, event) {
          const target = event.target;
          if (target.closest('table')) {
            event.preventDefault();
            showTableContextMenu(event.clientX, event.clientY);
            return true;
          }
          return false;
        },
      },
    });

    pmEditor = view;
    pmEditor._schema = schema;

    // 툴바 버튼 이벤트 바인딩
    bindToolbar(view, schema);

    return view;
  }

  // ── 툴바 버튼 바인딩 ─────────────────────────
  function bindToolbar(view, schema) {
    const { toggleMark, setBlockType, wrapIn, lift, chainCommands } =
      window.ProsemirrorCommands || prosemirrorCommands;
    const { wrapInList, liftListItem } = window.ProsemirrorSchemaList || prosemirrorSchemaList;

    function cmd(fn) {
      return function (e) {
        e.preventDefault();
        fn(view.state, view.dispatch, view);
        view.focus();
      };
    }

    const B = id => document.getElementById(id);

    B('tt-bold').addEventListener('mousedown',      cmd(toggleMark(schema.marks.strong)));
    B('tt-italic').addEventListener('mousedown',    cmd(toggleMark(schema.marks.em)));
    B('tt-underline').addEventListener('mousedown', cmd(toggleMark(schema.marks.underline)));
    B('tt-strike').addEventListener('mousedown',    cmd(toggleMark(schema.marks.strikethrough)));

    B('tt-h1').addEventListener('mousedown', cmd(
      chainCommands(
        setBlockType(schema.nodes.heading, { level: 1 }),
        setBlockType(schema.nodes.paragraph)
      )
    ));
    B('tt-h2').addEventListener('mousedown', cmd(
      chainCommands(
        setBlockType(schema.nodes.heading, { level: 2 }),
        setBlockType(schema.nodes.paragraph)
      )
    ));
    B('tt-h3').addEventListener('mousedown', cmd(
      chainCommands(
        setBlockType(schema.nodes.heading, { level: 3 }),
        setBlockType(schema.nodes.paragraph)
      )
    ));

    B('tt-ul').addEventListener('mousedown', cmd(
      chainCommands(wrapInList(schema.nodes.bullet_list), lift)
    ));
    B('tt-ol').addEventListener('mousedown', cmd(
      chainCommands(wrapInList(schema.nodes.ordered_list), lift)
    ));
    B('tt-bq').addEventListener('mousedown', cmd(
      chainCommands(wrapIn(schema.nodes.blockquote), lift)
    ));

    B('tt-link').addEventListener('mousedown', e => {
      e.preventDefault();
      promptLink(view, schema);
    });

    B('tt-table').addEventListener('mousedown', e => {
      e.preventDefault();
      toggleTableDialog();
    });

    B('tt-clear').addEventListener('mousedown', cmd(clearAllMarks));
  }

  // ── 마크 전체 해제 ────────────────────────────
  function clearAllMarks(state, dispatch) {
    const { Transaction } = window.ProsemirrorState || prosemirrorState;
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      let tr = state.tr;
      state.schema.marks && Object.values(state.schema.marks).forEach(mark => {
        tr = tr.removeMark(from, to, mark);
      });
      dispatch(tr);
    }
    return true;
  }

  // ── H1/H2/H3 토글 (같은 레벨이면 paragraph로) ─
  function toggleHeading(level) {
    return function (state, dispatch, view) {
      const { setBlockType } = window.ProsemirrorCommands || prosemirrorCommands;
      const schema = state.schema;
      const { $from } = state.selection;
      const node = $from.node($from.depth);
      if (node.type === schema.nodes.heading && node.attrs.level === level) {
        return setBlockType(schema.nodes.paragraph)(state, dispatch, view);
      }
      return setBlockType(schema.nodes.heading, { level })(state, dispatch, view);
    };
  }

  // ── 툴바 활성 상태 갱신 ──────────────────────
  function updateToolbarState() {
    if (!pmEditor) return;
    const state  = pmEditor.state;
    const schema = state.schema;
    const { from, to, $from } = state.selection;

    function hasMark(markType) {
      if (!markType) return false;
      return state.doc.rangeHasMark(from === to ? Math.max(0, from - 1) : from, to, markType);
    }

    function setActive(id, active) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('is-active', active);
    }

    setActive('tt-bold',      hasMark(schema.marks.strong));
    setActive('tt-italic',    hasMark(schema.marks.em));
    setActive('tt-underline', hasMark(schema.marks.underline));
    setActive('tt-strike',    hasMark(schema.marks.strikethrough));

    const blockType = $from.node($from.depth).type;
    const headingLevel = $from.node($from.depth).attrs?.level;
    setActive('tt-h1', blockType === schema.nodes.heading && headingLevel === 1);
    setActive('tt-h2', blockType === schema.nodes.heading && headingLevel === 2);
    setActive('tt-h3', blockType === schema.nodes.heading && headingLevel === 3);

    // 리스트 / 인용
    let inUl = false, inOl = false, inBq = false;
    for (let d = $from.depth; d >= 0; d--) {
      const n = $from.node(d);
      if (n.type === schema.nodes.bullet_list)   inUl = true;
      if (n.type === schema.nodes.ordered_list)  inOl = true;
      if (n.type === schema.nodes.blockquote)    inBq = true;
    }
    setActive('tt-ul', inUl);
    setActive('tt-ol', inOl);
    setActive('tt-bq', inBq);
  }

  // ── 링크 삽입/수정 ───────────────────────────
  function promptLink(view, schema) {
    const { from, to, empty } = view.state.selection;
    let existing = null;

    // 이미 링크 마크가 있으면 현재 URL 가져오기
    view.state.doc.nodesBetween(from, to, (node) => {
      if (!node.isLeaf) return;
      const lm = node.marks.find(m => m.type === schema.marks.link);
      if (lm && !existing) existing = lm.attrs.href;
    });

    const url = window.prompt('링크 URL을 입력하세요:', existing || 'https://');
    if (url === null) return;

    if (!url.trim()) {
      // URL 지우면 링크 제거
      const { removeMark } = window.ProsemirrorCommands || prosemirrorCommands;
      removeMark(schema.marks.link)(view.state, view.dispatch);
      view.focus();
      return;
    }

    const href = /^https?:\/\/|^mailto:/.test(url.trim()) ? url.trim() : 'https://' + url.trim();
    const mark = schema.marks.link.create({ href, target: '_blank', rel: 'noopener' });
    const { toggleMark } = window.ProsemirrorCommands || prosemirrorCommands;

    let tr = view.state.tr;
    if (!empty) {
      tr = tr.addMark(from, to, mark);
    } else {
      // 선택 없으면 URL 텍스트 삽입 후 마크 적용
      tr = tr.insertText(href, from);
      tr = tr.addMark(from, from + href.length, mark);
    }
    view.dispatch(tr);
    view.focus();
  }

  // ── 링크 버블 ────────────────────────────────
  function updateLinkBubble() {
    if (!pmEditor) return;
    const bubble = document.getElementById('link-bubble');
    if (!bubble) return;
    const state  = pmEditor.state;
    const { from, to } = state.selection;
    let href = null;

    state.doc.nodesBetween(from, to, node => {
      if (!node.isLeaf) return;
      const lm = node.marks.find(m => m.type === state.schema.marks.link);
      if (lm && !href) href = lm.attrs.href;
    });

    if (!href) { bubble.style.display = 'none'; return; }

    const { view: pmView } = pmEditor;
    const coords = pmEditor.coordsAtPos(from);
    bubble.style.display = 'flex';
    bubble.style.left    = `${coords.left}px`;
    bubble.style.top     = `${coords.top - 44}px`;

    const aEl = document.getElementById('link-bubble-href');
    if (aEl) { aEl.href = href; aEl.textContent = href; }
  }

  window.editLink = function () {
    if (!pmEditor) return;
    promptLink(pmEditor, pmEditor._schema);
    document.getElementById('link-bubble').style.display = 'none';
  };

  window.removeLink = function () {
    if (!pmEditor) return;
    const { from, to } = pmEditor.state.selection;
    const mark = pmEditor._schema.marks.link;
    pmEditor.dispatch(pmEditor.state.tr.removeMark(from, to, mark));
    document.getElementById('link-bubble').style.display = 'none';
    pmEditor.focus();
  };

  // ── 이미지 처리 (붙여넣기 / 첨부 드롭) ────────
  async function handleImageFile(file) {
    const token = localStorage.getItem('hwaseo_token');
    if (!token) { alert('로그인 토큰이 없습니다.'); return; }
    if (!pmEditor) return;

    // 1) base64 미리보기
    const dataUrl = await fileToDataUrl(file);
    insertImageToEditor(dataUrl);

    // 2) 백그라운드 업로드 후 src 교체
    try {
      const result = await GithubDB.uploadFile(file, token, currentBoard);
      // DOM에서 해당 img 교체
      const editorEl = document.getElementById('tiptap-editor');
      if (editorEl) {
        editorEl.querySelectorAll(`img[src="${dataUrl}"]`)
          .forEach(img => { img.src = result.rawUrl; });
      }
    } catch (e) {
      alert(`이미지 업로드 실패: ${e.message}`);
    }
  }

  function insertImageToEditor(src) {
    if (!pmEditor) return;
    const schema = pmEditor._schema;
    const { from } = pmEditor.state.selection;
    const node = schema.nodes.image.create({ src });
    const tr   = pmEditor.state.tr.insert(from, node);
    pmEditor.dispatch(tr);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = () => reject(new Error('파일 읽기 실패'));
      r.readAsDataURL(file);
    });
  }

  // ── 표 삽입 다이얼로그 ────────────────────────
  function toggleTableDialog() {
    const dlg = document.getElementById('table-dialog');
    if (!dlg) return;
    dlg.style.display = dlg.style.display === 'none' ? 'flex' : 'none';
  }

  window.confirmInsertTable = function () {
    const rows = parseInt(document.getElementById('tbl-rows').value, 10) || 3;
    const cols = parseInt(document.getElementById('tbl-cols').value, 10) || 3;
    insertTable(rows, cols);
    document.getElementById('table-dialog').style.display = 'none';
  };

  window.cancelInsertTable = function () {
    document.getElementById('table-dialog').style.display = 'none';
  };

  function insertTable(rows, cols) {
    if (!pmEditor) return;
    const { insertTable: pmInsertTable } = window.ProsemirrorTables || prosemirrorTables;
    if (typeof pmInsertTable === 'function') {
      pmInsertTable(rows, cols, false)(pmEditor.state, pmEditor.dispatch);
    } else {
      // 폴백: DOM으로 직접 삽입
      const schema = pmEditor._schema;
      const cells  = [];
      for (let c = 0; c < cols; c++) {
        cells.push(schema.nodes.table_cell.create(null, schema.nodes.paragraph.create()));
      }
      const tableRows = [];
      for (let r = 0; r < rows; r++) {
        tableRows.push(schema.nodes.table_row.create(null, cells.map(c => c)));
      }
      const table = schema.nodes.table.create(null, tableRows);
      const { from } = pmEditor.state.selection;
      pmEditor.dispatch(pmEditor.state.tr.insert(from, table));
    }
    pmEditor.focus();
  }

  // ── 표 컨텍스트 메뉴 ─────────────────────────
  function showTableContextMenu(x, y) {
    const menu = document.getElementById('tiptap-ctx-menu');
    if (!menu) return;
    menu.style.display = 'block';
    menu.style.left    = `${x}px`;
    menu.style.top     = `${y}px`;
  }

  function hideTableContextMenu() {
    const menu = document.getElementById('tiptap-ctx-menu');
    if (menu) menu.style.display = 'none';
  }

  window.tableCmd = function (cmd) {
    hideTableContextMenu();
    if (!pmEditor) return;
    const tables  = window.ProsemirrorTables || prosemirrorTables;
    const fn = tables[cmd];
    if (typeof fn === 'function') {
      fn()(pmEditor.state, pmEditor.dispatch, pmEditor);
      pmEditor.focus();
    }
  };

  // ── HTML ↔ ProseMirror ────────────────────────
  function loadHtmlToEditor(html) {
    if (!pmEditor) return;
    const schema = pmEditor._schema;
    const { DOMParser: PMParser } = window.ProsemirrorModel || prosemirrorModel;

    const raw = html || '';
    let domNode;

    if (/^\s*<[a-zA-Z]/.test(raw)) {
      // HTML 콘텐츠
      const div = document.createElement('div');
      div.innerHTML = raw;
      domNode = div;
    } else {
      // 레거시 텍스트 → HTML 변환
      const escaped = raw
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
        .replace(/\n/g,'<br>');
      const div = document.createElement('div');
      div.innerHTML = `<p>${escaped}</p>`;
      domNode = div;
    }

    const doc = PMParser.fromSchema(schema).parse(domNode);
    const { EditorState } = window.ProsemirrorState || prosemirrorState;
    const newState = EditorState.create({
      schema,
      plugins: pmEditor.state.plugins,
      doc,
    });
    pmEditor.updateState(newState);
  }

  function getEditorHtml() {
    if (!pmEditor) return '';
    const { DOMSerializer } = window.ProsemirrorModel || prosemirrorModel;
    const schema   = pmEditor._schema;
    const serializer = DOMSerializer.fromSchema(schema);
    const fragment = serializer.serializeFragment(pmEditor.state.doc.content);
    const div = document.createElement('div');
    div.appendChild(fragment);
    return div.innerHTML.trim();
  }

  function syncEditorToTextarea() {
    const ta = document.getElementById('write-content');
    if (ta) ta.value = getEditorHtml();
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
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('admin-screen').style.display  = 'block';
    document.getElementById('admin-badge').style.display   = 'inline-block';
    errEl.style.display = 'none';

    initAttachUI();
    ['surface','excavation','academic','report','news','free'].forEach(b => loadList(b));
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
    if (!listEl) return;
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
    if (!listEl) return;
    if (!posts || !posts.length) {
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
    ['write-title','write-date','write-author'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'write-author') el.value = '관리자';
      else if (id === 'write-date') el.value = GithubDB.today();
      else el.value = '';
    });
    const ta = document.getElementById('write-content');
    if (ta) ta.value = '';
    if (pmEditor) {
      const { EditorState } = window.ProsemirrorState || prosemirrorState;
      const schema = pmEditor._schema;
      pmEditor.updateState(EditorState.create({
        schema,
        plugins: pmEditor.state.plugins,
        doc: schema.node('doc', null, [schema.node('paragraph')]),
      }));
    }
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
    // 에디터 초기화 (모달 열린 후)
    requestAnimationFrame(() => {
      initEditor();
      if (pmEditor) pmEditor.focus();
    });
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
    document.getElementById('btn-submit').textContent    = '수정 저장';
    renderExistingFiles(post.attachments || []);
    document.getElementById('write-modal').style.display = 'flex';

    requestAnimationFrame(() => {
      initEditor();
      loadHtmlToEditor(post.content || '');
      if (pmEditor) pmEditor.focus();
    });
  };

  window.closeModal = function () {
    document.getElementById('write-modal').style.display = 'none';
    document.getElementById('table-dialog').style.display = 'none';
    document.getElementById('link-bubble').style.display  = 'none';
    hideTableContextMenu();
    newFiles = []; keepAttach = [];
  };

  // ── 저장 ─────────────────────────────────────
  window.submitPost = async function () {
    // 업로드 중인 base64 이미지 체크
    const editorEl = document.getElementById('tiptap-editor');
    if (editorEl && editorEl.querySelectorAll('img[src^="data:"]').length > 0) {
      alert('이미지 업로드가 아직 완료되지 않았습니다. 잠시 후 다시 저장하세요.');
      return;
    }

    syncEditorToTextarea();

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
    let uploadedAttachments = [...keepAttach];

    if (newFiles.length) {
      prog.style.display = 'block';
      for (let i = 0; i < newFiles.length; i++) {
        prog.textContent = `파일 업로드 중... (${i+1}/${newFiles.length}) ${newFiles[i].name}`;
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
    if (el) { el.textContent = msg; el.style.color = '#c00'; el.style.display = 'block'; }
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

  // ── 전역 이벤트 ──────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); hideTableContextMenu(); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#tiptap-ctx-menu')) hideTableContextMenu();
    if (!e.target.closest('#link-bubble') && !e.target.closest('.tiptap-editor')) {
      const bubble = document.getElementById('link-bubble');
      if (bubble) bubble.style.display = 'none';
    }
  });

  // ── 세션 복원 ────────────────────────────────
  (function restoreSession() {
    const token = localStorage.getItem('hwaseo_token');
    if (!token) return;
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('admin-screen').style.display  = 'block';
    const badge = document.getElementById('admin-badge');
    if (badge) badge.style.display = 'inline-block';
    initAttachUI();
    ['surface','excavation','academic','report','news','free'].forEach(b => loadList(b));
  })();

})();
