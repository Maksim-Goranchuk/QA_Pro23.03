Скрипт для автоматической обработки багов из ClickUp.  
При смене типа задачи на **bug** — проверяет дубликаты среди открытых тасков (в статусе BACKLOG, CURRENT, IN PROGRESS, TEST, RETEST, TESTED) и назначает severity с помощью Gemini AI.

- Получает webhook от ClickUp при смене типа задачи на bug
- Проверяет, является ли баг дубликатом среди открытых тасков и сабтасков
- Если дубликат найден — выводит ID и уверенность в консоль
- Если дубликата нет — определяет severity (high / medium / low) и выводит обоснование в консоль
- В ClickUp ничего не меняет, работает только в режиме прослушки

## Требования

- Node.js 
- Токен ClickUp 
- API-ключ Gemini
- ngrok (для локального запуска)

## Установка

1. Установить зависимости:
   npm install

2. Создать файл .env в корне проекта:
   PORT=3000
   CLICKUP_TOKEN=your_clickup_token
   LIST_ID=your_list_id
   GEMINI_API_KEY=your_gemini_api_key

## Запуск

1. Запустить сервер:
   node src/server.js

2. В отдельном терминале запустить ngrok:
   ngrok http 3000

3. Создать тестовый таск в backlog или current, сменить тип таска на Bug

## Пример вывода в консоли

Дубликат найден:
   ⚠️  DUPLICATE FOUND: task 86xyz123 (confidence: 91%)

Дубликата нет:
   ✅ No duplicate found

   === SEVERITY ===
   🔴 Severity: MEDIUM
   📝 Reason: Некорректная валидация поля email не блокирует
   основной сценарий, приложение продолжает работать.
   ================