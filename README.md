# garfield coder

Одностраничная визитка: ASCII-имя и генеративный WebGL-фон.
Никаких фреймворков и сборки — чистые HTML/CSS/JS.

## Локальный запуск

```bash
python3 -m http.server 8899
```

Открыть <http://127.0.0.1:8899/>.

## Структура

```
index.html                 разметка визитки
assets/css/splash.css      стили, палитра, кнопки
assets/js/flowfield.js     WebGL-шейдер: flow field (адвекция по градиенту fbm)
assets/js/ascii-title.js   ASCII-имя: текст → сетка символов, волна, курсор
assets/img/favicon.svg
```

## Что поменять

**Ссылки** — три кнопки в `index.html` (`class="social"`):

- GitHub: `https://github.com/garfieldcoder`
- Telegram: `https://t.me/garfieldcoder`
- канал: `https://t.me/garfieldcoder_dev`

Заменить `href`, `aria-label` и `title`.

**Текст ASCII** — `LINES` в `assets/js/ascii-title.js`
(по умолчанию `["GARFIELD", "CODER"]`). Набор символов — `CHARSET`.

**Параметры шейдера** — объект `opts` в начале `assets/js/flowfield.js`:
`color`, `highlight`, `speed`, `scale`, `opacity`, `mouseInteractive`, `maxPixels`.
Цвета палитры также заданы в CSS-переменных `assets/css/splash.css`.

**Цвет и градиент имени** — `.ascii__pre` в `splash.css`.

## Поведение

- `prefers-reduced-motion: reduce` — статичный кадр, без анимаций.
- Нет WebGL — показывается CSS-фолбэк с тёплым градиентом.
- Если JS отключён — виден обычный заголовок `GARFIELD / CODER`.
- Шрифты грузятся с Google Fonts, при офлайне работают системные фолбэки.

## Публикация

Сайт: <https://dmcrtr24.github.io> — GitHub Pages, ветка `main`, корень репозитория.

```bash
git push origin main   # Pages пересобирается автоматически
```

Локально: `python3 -m http.server 8899`.
