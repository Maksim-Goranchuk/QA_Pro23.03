# Анализатор требований — QA Checklist Generator

Инструмент для QA: загружаете описание фичи, получаете структурированный список проверок — позитивных, негативных и граничных значений. Работает на базе Anthropic Claude API.

## Быстрый старт

### 1. Получите API-ключ

Зарегистрируйтесь на [console.anthropic.com](https://console.anthropic.com/settings/keys) и создайте ключ.

### 2. Создайте config.js

```bash
cp config.example.js config.js
```

Откройте `config.js` и вставьте ваш ключ:

```js
export const ANTHROPIC_API_KEY = 'sk-ant-ваш-ключ';
```

> `config.js` добавлен в `.gitignore` — ключ не попадёт в репозиторий.

### 3. Запустите локально

Файл использует ES-модули (`import/export`), поэтому нужен локальный сервер — просто открыть `index.html` двойным кликом не сработает.

**Вариант A — VS Code Live Server** (рекомендуется):
1. Установите расширение [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. Правой кнопкой по `index.html` → **Open with Live Server**

**Вариант B — через npx:**
```bash
npx serve .
```

**Вариант C — через Python:**
```bash
python3 -m http.server 8080
```

Затем откройте `http://localhost:8080` в браузере.

## Структура проекта

```
requirements-analyzer/
├── index.html          # Разметка
├── style.css           # Стили (поддержка светлой и тёмной темы)
├── app.js              # Логика, запросы к API
├── config.example.js   # Шаблон конфига (копируйте → config.js)
├── config.js           # Ваш ключ (в .gitignore)
├── .gitignore
└── README.md
```

## Горячие клавиши

| Действие | Сочетание |
|---|---|
| Запустить анализ | `Ctrl+Enter` / `Cmd+Enter` |

## Что будет дальше

- [ ] Подключение риск-матрицы из Google Drive
- [ ] Автоматическое обнаружение противоречий между требованиями и риск-матрицей
- [ ] Экспорт чеклиста в CSV / Markdown
