const { askGemini } = require('./gemini');

async function findDuplicate(currentBug, allTasks) {

    const candidates = allTasks
        .filter(task => task.id !== currentBug.id)
        .map(task => ({
            id: task.id,
            name: task.name,
            description: task.description || '',
            type: task.type,
            parentId: task.parentId || null
        }));

    const prompt = `
Ты QA Lead.

Новый баг:

ID: ${currentBug.id}
Название: ${currentBug.name}
Описание: ${currentBug.description}

Существующие таски и сабтаски:

${candidates.map(task => `
ID: ${task.id}
Тип: ${task.type}${task.parentId ? ` (parent: ${task.parentId})` : ''}
Название: ${task.name}
Описание: ${task.description}
`).join('\n---\n')}

Определи:

1. Есть ли дубликат нового бага среди существующих тасков.
2. Если есть — укажи ID дубликата.
3. Укажи уверенность от 0 до 100.

Верни только JSON без markdown-обёртки:

{
  "duplicate": true,
  "taskId": "123",
  "confidence": 95
}
`;

    return askGemini(prompt);
}

async function assignSeverity(bug) {

    const prompt = `
Ты QA Lead с опытом в коммерческих продуктах. Определи severity бага — строго и без завышения.

Баг:
ID: ${bug.id}
Название: ${bug.name}
Описание: ${bug.description}

Уровни severity:

- high: ТОЛЬКО если выполняется хотя бы одно из условий:
  * система полностью недоступна или падает
  * невозможно выполнить ключевую бизнес-операцию (оплата, вход, регистрация, оформление заказа)
  * данные пользователей теряются или повреждаются
  * баг напрямую приводит к финансовым потерям клиента прямо сейчас

- medium: функция работает неправильно, но система доступна и основной сценарий выполним:
  * некорректная валидация поля
  * неверное сообщение об ошибке
  * UI-проблема влияющая на UX
  * фича работает частично или с задержкой
  * баг воспроизводится не всегда

- low: не влияет на функциональность:
  * опечатка, неверный текст
  * косметический баг
  * незначительное отклонение в дизайне

Правила оценки:
1. Оценивай только прямой и немедленный эффект бага — не строй цепочки косвенных последствий
2. Если сомневаешься между high и medium — выбирай medium
3. Если сомневаешься между medium и low — выбирай medium
4. Валидация полей, сообщения об ошибках, UI-баги — всегда medium или low, никогда не high

Верни только JSON без markdown-обёртки:

{
  "severity": "medium",
  "reason": "краткое обоснование на русском, 1-2 предложения"
}
`;

    return askGemini(prompt);
}

module.exports = {
    findDuplicate,
    assignSeverity
};