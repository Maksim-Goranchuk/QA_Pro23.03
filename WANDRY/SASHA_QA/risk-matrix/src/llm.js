import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `
Ты — старший QA Risk Analyst с экспертизой в бизнес-анализе.

Перед тем как расставить приоритеты рискам, ты ВСЕГДА выполняешь бизнес-анализ:

## ШАГ 1 — Определи бизнес-ядро продукта

Найди функции, которые:
- Генерируют или обрабатывают деньги (продажи, оплата, кассы, транзакции, тарифы, счета)
- Являются основным value proposition продукта (то, ради чего пользователь платит)
- Блокируют работу всего бизнеса при отказе (core flow, критические интеграции)
- Связаны с юридической или финансовой ответственностью

Это HIGH-ядро. Всё что входит в него — приоритет High по умолчанию.

## ШАГ 2 — Определи вспомогательные функции

Функции которые ПОДДЕРЖИВАЮТ бизнес, но не являются его ядром:
- Административные панели и отчёты (бухгалтерия, аналитика, логи)
- Настройки, профили, уведомления
- Вспомогательные справочники и словари

Эти функции важны, но НЕ могут получить приоритет выше чем ядро.
Если бухгалтерский модуль только отображает данные — это Medium/Low, даже если он сложный.
Если бухгалтерский модуль ИНИЦИИРУЕТ транзакции — это High.

## ШАГ 3 — Применяй матрицу приоритетов

Приоритет = f(impact на бизнес, probability):

| Ситуация | Приоритет |
|---|---|
| Финансовые потери / нарушение транзакций | High |
| Блокировка основного пользовательского flow | High |
| Нарушение бизнес-логики в ядре продукта | High |
| Security / auth / data breach | High |
| Деградация вспомогательных функций | Medium |
| Некорректное отображение данных (не транзакционных) | Medium/Low |
| UI баги, косметические проблемы | Low |

## ПРАВИЛО ОТНОСИТЕЛЬНОСТИ

Приоритеты выставляй ОТНОСИТЕЛЬНО друг друга внутри конкретного продукта.
Никогда не давай вспомогательному модулю приоритет выше, чем модулю который генерирует деньги.
Если сомневаешься — спроси себя: "Потеряет ли бизнес деньги если это сломается прямо сейчас?"
Да → High. Частично → Medium. Нет → Low.
`,
});

const RETRY_OPTIONS = {
  maxAttempts: 5,
  initialDelayMs: 2000,   // 2s → 4s → 8s → 16s → 32s
  backoffMultiplier: 2,
  retryableStatuses: [503, 429, 500, 502, 504],
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(prompt) {
  let delayMs = RETRY_OPTIONS.initialDelayMs;

  for (let attempt = 1; attempt <= RETRY_OPTIONS.maxAttempts; attempt++) {
    try {
      console.log(`🤖 Gemini request attempt ${attempt}/${RETRY_OPTIONS.maxAttempts}...`);
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      const status = err?.status ?? err?.response?.status ?? err?.code;
      const isRetryable =
        RETRY_OPTIONS.retryableStatuses.includes(Number(status)) ||
        err?.message?.includes("503") ||
        err?.message?.includes("overloaded") ||
        err?.message?.includes("unavailable");

      if (!isRetryable || attempt === RETRY_OPTIONS.maxAttempts) {
        console.error(`❌ Gemini failed after ${attempt} attempt(s):`, err.message);
        throw err;
      }

      console.warn(
        `⚠️  Gemini ${status ?? "error"} on attempt ${attempt}. Retrying in ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
      delayMs *= RETRY_OPTIONS.backoffMultiplier;
    }
  }
}

export async function analyzeRisks(text) {
  const prompt = `
Проанализируй текст и составь полную риск-матрицу.

Сначала мысленно определи: какие модули/функции в этом продукте составляют бизнес-ядро (генерируют деньги / критичны для работы), а какие — вспомогательные. Расставь приоритеты исходя из этого.

Требования по количеству:
- HIGH рисков: минимум 5 (только реально критичные для бизнеса)
- MEDIUM рисков: минимум 8
- LOW рисков: минимум 5
- Итого: 20–40 рисков в зависимости от объёма текста
- Каждый компонент/модуль — минимум 1 риск
- test_cases: 2–3 конкретных сценария через точку с запятой

Верни ТОЛЬКО валидный JSON без markdown и пояснений:

{
  "risks": [
    {
      "component": "string",
      "risk": "string",
      "cause": "string",
      "probability": "L|M|H",
      "impact": "L|M|H",
      "priority": "Low|Medium|High",
      "test_cases": "string"
    }
  ]
}

Если текст пустой → верни {"risks": []}

Текст для анализа:
${text}
`;

  const result = await generateWithRetry(prompt);
  const response = await result.response;

  let raw = response.text();

  raw = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("❌ Gemini returned invalid JSON:\n", raw);
    return { risks: [] };
  }

  if (!parsed || !Array.isArray(parsed.risks)) {
    return { risks: [] };
  }

  parsed.risks = parsed.risks.slice(0, 50);

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const impactOrder = { H: 0, M: 1, L: 2 };

  parsed.risks.sort((a, b) => {
    const byPriority =
      (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    if (byPriority !== 0) return byPriority;
    return (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3);
  });

  return parsed;
}