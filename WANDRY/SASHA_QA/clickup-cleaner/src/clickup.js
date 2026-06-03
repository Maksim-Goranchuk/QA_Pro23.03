const axios = require('axios');
 
const headers = {
    Authorization: process.env.CLICKUP_TOKEN
};
 
const ACTIVE_STATUSES = ['backlog', 'current', 'in progress', 'test', 'retest', 'tested'];
 
async function getAllTasks() {
 
    const response = await axios.get(
        `https://api.clickup.com/api/v2/list/${process.env.LIST_ID}/task`,
        {
            headers,
            params: {
                subtasks: true,
                include_closed: true,
                page: 0
            }
        }
    );
 
    const tasks = response.data.tasks || [];
 
    const flat = [];
 
    for (const task of tasks) {
 
        const status = task.status?.status?.toLowerCase() || '';
 
        if (!ACTIVE_STATUSES.includes(status)) {
            continue;
        }
 
        if (task.parent) {
            flat.push({
                id: task.id,
                name: task.name,
                description: task.description || task.text_content || '',
                status,
                type: 'subtask',
                parentId: task.parent
            });
            continue;
        }
 
        flat.push({
            id: task.id,
            name: task.name,
            description: task.description || task.text_content || '',
            status,
            type: 'task'
        });
    }
 
    return flat;
}
 
async function getTask(taskId) {
    const response = await axios.get(
        `https://api.clickup.com/api/v2/task/${taskId}`,
        { headers }
    );
    return response.data;
}
 
module.exports = {
    getAllTasks,
    getTask
};
 