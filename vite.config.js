import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 배포용 빌드에만 넣는 보안 정책(CSP). 이 앱 파일, 구글 로그인, 구글 시트·드라이브 API, 구글 폰트 외에는
// 스크립트 실행과 외부 통신을 막는다. 개발 서버는 인라인 스크립트(HMR)를 써야 해서 넣지 않는다.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self' https://www.googleapis.com https://sheets.googleapis.com https://oauth2.googleapis.com https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const cspPlugin = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
}

export default defineConfig({
  plugins: [react(), cspPlugin],
  base: './', // 어느 주소에 올려도 동작하게 상대 경로로 빌드
  // 구글 로그인 원본에 http://localhost:5173 이 등록돼 있어서 포트를 고정한다. (모두의 카페와 같은 클라이언트 ID 사용)
  // 모두의 카페 서버가 켜져 있으면 5173이 이미 사용 중이라 에러가 난다. 그때는 그쪽 서버를 끄고 실행한다.
  server: { port: 5173, strictPort: true },
})
