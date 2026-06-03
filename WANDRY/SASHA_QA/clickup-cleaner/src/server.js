require('dotenv').config();
 
const express = require('express');
 
const { getAllTasks } = require('./clickup');
const { findDuplicate } = require('./bugProcessor');
 
const app = express();
 
app.use(express.json());
 
app.get('/', (req, res) => {
    res.send('Server is running');
});
 
app.post('/webhook', async (req, res) => {
 
    res.sendStatus(200);
 
    try {
 
        console.log('\n=== WEBHOOK RECEIVED ===\n');
        console.log('Body:', JSON.stringify(req.body, null, 2));
 
        const payload = req.body.payload;
 
        if (!payload?.id) {
            console.log('No payload.id in webhook body, skipping');
            return;
        }
 
        const currentBug = {
            id: payload.id,
            name: payload.name,
            description: payload.text_content || ''
        };
 
        console.log('NEW BUG:');
        console.log(currentBug);
 
        const allTasks = await getAllTasks();
 
        console.log(`Found ${allTasks.length} tasks`);
 
        const result = await findDuplicate(currentBug, allTasks);
 
        console.log('\n=== AI RESULT ===');
        console.log(result);
        console.log('=================\n');
 
    } catch (error) {
 
        console.error('Webhook error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
 
    }
 
});
 
app.listen(process.env.PORT, () => {
    console.log(`Server started on port ${process.env.PORT}`);
});
 