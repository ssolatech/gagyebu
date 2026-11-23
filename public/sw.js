// 오프라인에서도 앱 화면은 열리게 하는 서비스 워커.
// 항상 인터넷에서 최신 파일을 먼저 받고, 실패하면(오프라인) 저장해 둔 파일을 쓴다.
// 구글 로그인·드라이브 요청은 건드리지 않는다. (저장과 불러오기에는 인터넷이 필요)
const CACHE = 'gagyebu-v5'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
        }
        return res
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./'))),
  )
})
