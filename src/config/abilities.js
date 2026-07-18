// Суперспособности. Расходники: покупка в магазине даёт +1 заряд (стек,
// не разовая разблокировка — см. progress.js getItemCount/buyItemCharge/useItemCharge).
//
// kind:
//   'active'  — игрок сам активирует кнопкой в HUD (UIScene рисует кнопку)
//   'passive' — применяется автоматически: при старте уровня или при подборе
//               на карте, без кнопки
//
// Чтобы добавить новую способность: строка сюда + спрайт в assets.js + вся
// логика применения (по образцу bone/shield в GameScene.js).
export const ABILITIES = [
  { id: 'bone',   name: 'Сочная косточка', price: 25, kind: 'active' },
  { id: 'shield', name: 'Щит',             price: 35, kind: 'passive' },
];

export function getAbility(id) {
  return ABILITIES.find((a) => a.id === id);
}
