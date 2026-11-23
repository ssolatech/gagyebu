import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 어느 주소에 올려도 동작하게 상대 경로로 빌드
  // 구글 로그인 원본에 http://localhost:5173 이 등록돼 있어서 포트를 고정한다. (모두의 카페와 같은 클라이언트 ID 사용)
  // 모두의 카페 서버가 켜져 있으면 5173이 이미 사용 중이라 에러가 난다. 그때는 그쪽 서버를 끄고 실행한다.
  server: { port: 5173, strictPort: true },
})
