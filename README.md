# 가계부

폰에 설치해서 쓰는 개인 가계부 웹앱 (PWA).

- 내역은 기기(localStorage)에 저장 — 인터넷 없이 사용
- ☁ 업로드: 구글 드라이브의 '가계부' 스프레드시트를 기기 내용으로 덮어씀 (보기·백업용)
- 설정 > 시트에서 불러오기: 새 기기에서 복원
- 한 달 시작일(월급일) 설정, 달력, 통계, 예산, CSV 내보내기

## 개발

```
npm install
cp .env.example .env.local   # VITE_GOOGLE_CLIENT_ID 입력
npm run dev                  # http://localhost:5173
```

## 배포 (GitHub Pages, gh-pages 브랜치)

`npm run build` 후 `dist/` 내용을 `gh-pages` 브랜치에 올린다. 배포할 때마다 `public/sw.js`의 CACHE 숫자를 올린다.
