// Скины котиков. Чтобы добавить нового — допиши объект сюда и картинку в assets.js.
export const CATS = [
  { id: 'ugolek', name: 'Уголёк', body: '#3A3A44', belly: '#5A5A66', ear: '#6E5561', eye: '#8FE3C2' },
  { id: 'zefir',  name: 'Зефир',  body: '#F5F0E8', belly: '#FFFFFF', ear: '#F7C9D3', eye: '#7EC8F2' },
  { id: 'persik', name: 'Персик', body: '#F0A868', belly: '#FBD9B4', ear: '#E8899A', eye: '#7ED9A0' },
  { id: 'dymok',  name: 'Дымок',  body: '#9AA3B0', belly: '#C6CDD6', ear: '#E0A8B4', eye: '#F2D06B' },
];

export const DEFAULT_CAT = 'persik';

export function getCat(id) {
  return CATS.find((c) => c.id === id) || CATS.find((c) => c.id === DEFAULT_CAT);
}
