---
name: Волейбол·Черкащина
description: >
  Публічна платформа турнірів Федерації волейболу Черкащини. Напрямок «Сучасний мінімал»:
  білий фон, майже монохром, один синій акцент, великий шрифт, скруглені картки.
  Реалізація — shadcn/ui на Tailwind (Next.js); цей DESIGN.md задає лише бренд-шар поверх
  дефолтів shadcn.
status: final
updated: 2026-09-02
sources:
  - ../../../specs/spec-cherkasy-volley/SPEC.md
colors:
  # Бренд-оверайди поверх дефолтів shadcn. Нелічені токени (popover, card, input, ring)
  # успадковуються від shadcn. Тема — лише світла у v1.
  background: '#FFFFFF'
  foreground: '#0E0E10'
  muted: '#F5F5F4'
  muted-foreground: '#6B6B70'
  border: '#E7E7E4'
  primary: '#1F6FEB'
  primary-foreground: '#FFFFFF'
  accent: '#1F6FEB'          # єдиний акцент = primary; окремого акцентного кольору немає
  accent-foreground: '#FFFFFF'
  success: '#1F8A54'         # завершений матч / зіграно
  success-foreground: '#FFFFFF'
  destructive: '#C4342B'     # видалити результат / знос ролі
typography:
  # Системний стек, без завантаження веб-шрифтів (low-ops).
  fontFamily: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  numeric: 'font-variant-numeric: tabular-nums'   # обовʼязково на всіх цифрових клітинках
  display:
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.08'
    letterSpacing: '-0.6px'
  display-sm:
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.12'
    letterSpacing: '-0.3px'
  body:
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontSize: 13px
    fontWeight: '500'
  caption:
    fontSize: 11px
    fontWeight: '500'
    letterSpacing: '0.2px'
    textTransform: 'none'
rounded:
  sm: 7px
  md: 10px
  lg: 14px
  full: 999px
spacing:
  # 4-базова шкала (як Tailwind): 4 8 12 16 20 24 32 40 48 64.
  contentMaxWidth: 1120px
  tablePaddingY: 13px
  tablePaddingX: 12px
components:
  discipline-nav-item-active:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    radius: '{rounded.sm}'
    fontWeight: '600'
  tab-chip:
    radius: '{rounded.full}'
    border: '1px solid {colors.border}'
    foreground: '{colors.muted-foreground}'
  tab-chip-active:
    border: '1px solid {colors.foreground}'
    foreground: '{colors.foreground}'
  standings-row-qualifying:
    marker: '{colors.primary}'      # позиція 1–4: номер синій, жирний
  bracket-pair:
    background: '{colors.muted}'
    radius: '{rounded.md}'
  bracket-pair-tbd:
    background: '{colors.background}'
    border: '1px dashed {colors.border}'
    foreground: '#B0B0B4'
  status-badge:
    radius: '{rounded.full}'
    fontSize: '{typography.caption.fontSize}'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  empty-state:
    border: '1px dashed {colors.border}'
    radius: '{rounded.lg}'
    foreground: '{colors.muted-foreground}'
---

## Brand & Style

Волейбол·Черкащина — публічний сайт-довідник обласної федерації: де подивитись розклад,
таблицю й архів, замість того щоб гортати чат. Бренд-експресія — стриманий сучасний продукт:
багато білого, майже монохром, **один синій акцент**, який означає «сюди варто дивитись»
(позиції плейоф, активна вкладка, головна дія). Жодних декоративних кольорів, градієнтів чи
ілюстрацій. Дані — головний герой екрана; хром максимально тихий.

Реалізація успадковує shadcn/ui на Tailwind повністю. Цей DESIGN.md задає лише бренд-шар:
синій primary, системний шрифт, дещо ширші скруглення, кілька доменних компонентів
(таблиця, сітка, статус-бейдж). Компоненти, що приходять із shadcn as-is (Button, Card,
Dialog, Sheet, Tabs, Toast, DropdownMenu, Input, Select), використовуються без візуальних
змін.

`[ПРИПУЩЕННЯ]` shadcn/ui як система обрано за замовчуванням під цей вигляд і соло-супровід —
підтвердити. Якщо не shadcn, токени вище лишаються чинними як власна система.

## Colors

Палітра — синій primary плюс нейтралі, плюс дві функційні мітки.

- **Синій `#1F6FEB`** — єдиний бренд/акцентний колір. Активна вкладка, номер позиції 1–4 у
  таблиці, головна кнопка дії, посилання. Ніде як декор.
- **`#1F8A54` (success)** — лише «зіграно / результат внесено» (галочка біля матчу,
  заповнений рахунок).
- **`#C4342B` (destructive)** — лише руйнівні дії (видалити результат, зняти роль адміна) —
  колір shadcn destructive.
- **Нейтралі:** `#FFFFFF` фон, `#0E0E10` текст, `#F5F5F4` тиха підкладка (картки сітки,
  активний пункт меню), `#6B6B70` вторинний текст, `#E7E7E4` лінії.
- Уникати: другого акцентного кольору, кольорових статус-плашок (крім success/destructive),
  градієнтів, тіней як ієрархії.

## Typography

Системний sans-serif, без веб-шрифтів. Три регістри:

- **display** (32 / 24px, вага 700, tracking −0.6px) — назва турніру в шапці сторінки,
  заголовки розділів («Розклад», «Архів»), привітання порожніх станів.
- **body** (14px) — усе решта.
- **caption** (11px, вага 500) — підписи стовпців таблиць, мета-рядки («тур 4 з 5»).

**Табличні цифри (`tabular-nums`) обовʼязкові** на кожній клітинці з числом — таблиці, рахунки
партій, сітка. Колонки чисел вирівнюються.

## Layout & Spacing

4-базова шкала Tailwind. Максимальна ширина контенту — **1120px** (таблиці й сітки широкі,
на відміну від вузьких продуктів).

- Публічні сторінки — одноколонковий потік, mobile-first; таблиця на вузькому екрані
  горизонтально скролиться всередині власного контейнера, сторінка по горизонталі не їде.
- Адмінські форми — та сама ширина, згруповані секції, лейбли зверху.
- Верхня навігація (не бічна): зліва лого, далі `Класичний` · `Пляжний` · `Архів`; на
  мобільному — та сама смуга, пункти згортаються в меню.

## Elevation & Depth

Успадковано від shadcn: ледь помітна тінь на hover інтерактивних карток, тінь на діалогах і
поповерах. Глибина не використовується як ієрархія — розділяють лінії `#E7E7E4` і підкладка
`#F5F5F4`, не тіні.

## Shapes

Ширші за дефолт shadcn: `sm` 7px (інпути, чипи-вкладки), `md` 10px (картки, кнопки, пари
сітки), `lg` 14px (діалоги, порожні стани), `full` (статус-бейджі, чипи фільтрів). Скруглення
дає «сучасний продукт», а не «таблиця з 2008».

## Components

**As-is зі shadcn (не чіпати):** Button (крім primary-варіанта), Card, Dialog, Sheet, Tabs,
Toast, DropdownMenu, Input, Select, Separator, Avatar, Skeleton.

**Бренд-шар:**

- **Button (primary)** — заливка `{colors.primary}`, текст білий, кут `{rounded.md}`. Одна
  на екран — головна дія (створити турнір, внести результат, сформувати плейоф).
- **Discipline nav** — верхня смуга; активний пункт на підкладці `{colors.muted}`,
  `{rounded.sm}`, вага 600.
- **Tab chip** — фільтр-вкладки всередині турніру (Таблиця / Розклад / Команди / Плейоф):
  пігулка з обведенням; активна — обведення кольору тексту, не заливка.
- **Standings table** — рядок; для позицій 1–4 номер позиції синій і жирний (мітка виходу в
  плейоф). Клітинки чисел — `tabular-nums`, вирівнювання по центру. Без зебри; розділювач —
  лінія `#F1F1EF`.
- **Bracket pair** — картка пари: підкладка `{colors.muted}`, `{rounded.md}`, зліва команди,
  справа рахунок. Стан «очікує суперників» — біла картка з пунктирним обведенням, текст
  `#B0B0B4`.
- **Status badge** — стан турніру / матчу: пігулка `caption`. `Чернетка` — сіра (лише для
  адміна), `Груповий етап` / `Плейоф` — контур синій, `Завершений` — контур `#6B6B70`,
  `Зіграно` — `success`.
- **Score input** — рядок полів для рахунку партій; кількість полів за пресетом системи
  очок (до 5 для «Класичного», рівно 3 для «Кастомного»); підсумок 3:1 рахується поруч
  автоматично.
- **Empty state** — пунктирна рамка `{rounded.lg}`, `display-sm` заголовок + рядок пояснення
  (розділ «Пляжний»; турнір без команд; архів року без турнірів).

## Do's and Don'ts

| Do | Don't |
|---|---|
| Успадковувати дефолти shadcn для всього поза бренд-шаром | Оверайдити кольорові токени shadcn понад primary |
| Синій — лише «дивись сюди» (плейоф-позиції, активне, головна дія) | Синій як декор, фон секцій, hover |
| `tabular-nums` на кожній числовій клітинці | Пропорційні цифри в таблицях і рахунках |
| Одна primary-кнопка на екран | Кілька конкуруючих CTA |
| `display` лише в шапках і порожніх станах | `display` для звичайного тексту «щоб красиво» |
| Розділяти лініями й підкладкою | Тіні як візуальна ієрархія |
| Таблиця скролиться всередині контейнера на мобільному | Горизонтальний скрол усієї сторінки |
