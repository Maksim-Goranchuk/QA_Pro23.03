const axios = require('axios');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function askGemini(prompt, retries = 3) {

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ]
                }
            );

            return response.data.candidates[0].content.parts[0].text;

        } catch (error) {
            lastError = error;

            const status = error.response?.status;
            const isRetryable = status === 503 || status === 429 || status === 500;

            console.log(`\n❌ GEMINI ERROR (attempt ${attempt}/${retries})`);
            console.log(error.response?.data || error.message);

            if (!isRetryable || attempt === retries) {
                throw error;
            }

            const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s

            console.log(`⏳ Retrying in ${delay}ms...\n`);
            await sleep(delay);
        }
    }

    throw lastError;
}

module.exports = {
    askGemini
};