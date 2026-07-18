// Скины котиков. Чтобы добавить нового — допиши объект сюда и картинку в assets.js.
//
// price — цена в монетах. 0 = бесплатный, открыт с самого начала.
// Новый платный скин: добавь строку с price > 0 и картинки cat_<id>_{walk,sit,sleep}.
// Разблокировка и выбор идут через src/config/progress.js, магазин подхватит сам.
export const CATS = [
  // Бесплатные (открыты с начала)
  { id: 'ugolek', name: 'Уголёк', price: 0, body: '#3A3A44', belly: '#5A5A66', ear: '#6E5561', eye: '#8FE3C2' },
  { id: 'zefir',  name: 'Зефир',  price: 0, body: '#F5F0E8', belly: '#FFFFFF', ear: '#F7C9D3', eye: '#7EC8F2' },
  { id: 'persik', name: 'Персик', price: 0, body: '#F0A868', belly: '#FBD9B4', ear: '#E8899A', eye: '#7ED9A0' },
  { id: 'dymok',  name: 'Дымок',  price: 0, body: '#9AA3B0', belly: '#C6CDD6', ear: '#E0A8B4', eye: '#F2D06B' },
  // Платные (покупаются за монеты в магазине). Картинки — cat_<id>_{walk,sit,sleep}.
  // «kolli» — собака-игрок (пограничная колли), но играется через тот же слот котика.
  { id: 'bengal',    name: 'Честер',  price: 20 },
  { id: 'cornish',   name: 'Стрелка', price: 30 },
  { id: 'mainecoon', name: 'Барс',    price: 40 },
  { id: 'kolli',     name: 'Панда',   price: 50 },
];

export const DEFAULT_CAT = 'persik';

export function getCat(id) {
  return CATS.find((c) => c.id === id) || CATS.find((c) => c.id === DEFAULT_CAT);
}

export function getCatPrice(id) {
  return getCat(id).price || 0;
}
