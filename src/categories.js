// 분류와 결제수단. 기록에는 이름(name)만 저장하므로, 여기서 이모지·색을 바꿔도 기존 기록은 그대로 보인다.
export const CATEGORIES = {
  expense: [
    { name: '식비', icon: '🍚', color: '#e76f51' },
    { name: '카페·간식', icon: '☕', color: '#b07d62' },
    { name: '교통', icon: '🚌', color: '#2a9d8f' },
    { name: '쇼핑', icon: '🛍️', color: '#e9a23b' },
    { name: '생활', icon: '🧴', color: '#8ab17d' },
    { name: '주거·통신', icon: '🏠', color: '#457b9d' },
    { name: '의료', icon: '💊', color: '#d1495b' },
    { name: '문화·여가', icon: '🎬', color: '#9b5de5' },
    { name: '경조사', icon: '🎁', color: '#f28482' },
    { name: '기타', icon: '📦', color: '#8d99ae' },
  ],
  income: [
    { name: '월급', icon: '💰', color: '#2a9d8f' },
    { name: '부수입', icon: '💵', color: '#52b788' },
    { name: '용돈', icon: '🧧', color: '#e9a23b' },
    { name: '금융수익', icon: '📈', color: '#457b9d' },
    { name: '기타', icon: '📦', color: '#8d99ae' },
  ],
}

export const METHODS = ['카드', '현금', '계좌이체']

const FALLBACK = { icon: '📦', color: '#8d99ae' }

export function categoryInfo(type, name) {
  return CATEGORIES[type]?.find((c) => c.name === name) ?? { name, ...FALLBACK }
}
