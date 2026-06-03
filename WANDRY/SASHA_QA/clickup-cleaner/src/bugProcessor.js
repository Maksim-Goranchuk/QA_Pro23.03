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
 
module.exports = {
    findDuplicate
};
 