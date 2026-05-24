# 화서문화유산연구원 홈페이지

## 폴더 구조

```
hwaseo-website/
├── index.html        ← 메인 페이지
├── style.css         ← 전체 스타일
├── script.js         ← 인터랙션 스크립트
├── README.md         ← 이 파일
└── images/           ← 이미지 폴더 (직접 추가하세요)
    ├── logo.png              헤더 로고 (권장 높이: 48px)
    ├── logo-white.png        푸터용 흰색 로고
    ├── hero-bg.jpg           히어로 배경 이미지 (1920×800px 이상)
    ├── center-photo.jpg      메인 중앙 현장 사진
    ├── icon-survey.png       퀵링크 아이콘 - 문화유산조사란
    ├── icon-request.png      퀵링크 아이콘 - 조사의뢰
    ├── icon-support.png      퀵링크 아이콘 - 국비지원
    ├── logo-heritage.png     관련기관 - 국가유산청
    ├── logo-portal.png       관련기관 - 국가유산 협업포털
    ├── logo-support.png      관련기관 - 국가유산청 고객지원센터
    ├── logo-calc.png         관련기관 - 조사비용 자동계산
    ├── logo-kach.png         관련기관 - 한국문화유산협회
    └── logo-ksa.png          관련기관 - 한국고고학회
```

## 이미지 없이도 동작합니다

모든 이미지는 `onerror` 폴백 처리가 되어 있어,
이미지 파일이 없어도 텍스트나 이모지로 대체 표시됩니다.

## GitHub Pages 배포 방법

1. GitHub에 새 저장소(repository) 생성
2. 이 폴더 안의 파일 전체를 업로드 (`index.html`, `style.css`, `script.js`, `images/`)
3. Settings → Pages → Branch: `main`, folder: `/ (root)` 선택 후 Save
4. 잠시 후 `https://<계정명>.github.io/<저장소명>/` 에서 확인

## 색상 변수 (style.css 상단)

| 변수명            | 값        | 용도              |
|------------------|-----------|------------------|
| `--color-navy`   | `#1a3a5c` | 주요 네이비       |
| `--color-gold`   | `#c8960a` | 골드 포인트       |
| `--color-gold-lt`| `#e8b420` | 밝은 골드         |
| `--color-green`  | `#2e8b3e` | 블로그 버튼       |

색상을 바꾸려면 `style.css` 최상단 `:root { }` 블록의 값만 수정하면 됩니다.

## 게시판 내용 수정

`index.html` 안의 `<ul class="board-list">` 부분을 수정하면 됩니다.
추후 서버(PHP, Node.js 등)와 연동하면 동적으로 불러올 수 있습니다.

## 문의처 수정

`index.html` 하단 `<footer>` 안의 주소·전화번호를 수정하세요.
