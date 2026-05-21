import { GEMINI_API_KEY } from './config.js';

// ───────────────────────────────────────────────
// Константы
// ───────────────────────────────────────────────

const MODEL = 'gemini-2.0-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `Ты — опытный QA-инженер. Пользователь даёт описание фичи/требований, а ты генерируешь структурированный список тест-кейсов.

Верни ТОЛЬКО валидный JSON без комментариев и маркдауна, строго в таком формате:
{
  "positive": ["проверка 1", "проверка 2", ...],
  "negative": ["проверка 1", "проверка 2", ...],
  "edge":     ["проверка 1", "проверка 2", ...]
}

Правила:
- positive: позитивные сценарии (всё работает корректно, happy path и его вариации)
- negative: негативные (ошибочный ввод, нарушение правил, ошибки системы)
- edge: граничные значения (min/max длины, 0, пустые поля, спецсимволы, race conditions)
- Каждая проверка — одно чёткое действие + ожидаемый результат, на русском языке
- 4–8 пунктов в каждой группе в зависимости от сложности требований
- Никакой нумерации внутри строк, просто текст`;

// ───────────────────────────────────────────────
// DOM-элементы
// ───────────────────────────────────────────────

const featureInput = document.getElementById('featureInput');
const runBtn       = document.getElementById('runBtn');
const clearBtn     = document.getElementById('clearBtn');
const statusMsg    = document.getElementById('statusMsg');
const errorBox     = document.getElementById('errorBox');
const resultsEl    = document.getElementById('results');

// ───────────────────────────────────────────────
// Основная логика
// ───────────────────────────────────────────────

async function runAnalysis() {
  const text = featureInput.value.trim();
  if (!text) {
    featureInput.focus();
    return;
  }

  setLoading(true);
  clearError();
  resultsEl.innerHTML = '';

  try {
    const checks = await fetchChecks(text);
    renderResults(checks);

    const total = Object.values(checks).flat().length;
    statusMsg.textContent = `Готово · ${total} проверок`;
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

async function fetchChecks(description) {
  const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: description }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Ошибка API: ${response.status}`);
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Пустой ответ от модели. Попробуйте ещё раз.');

  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Не удалось разобрать ответ модели. Попробуйте ещё раз.');
  }
}

// ───────────────────────────────────────────────
// Рендеринг
// ───────────────────────────────────────────────

const SECTIONS = [
  {
    key:      'positive',
    label:    'Позитивные',
    modifier: 'pos',
    iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  },
  {
    key:      'negative',
    label:    'Негативные',
    modifier: 'neg',
    iconPath: 'M10 10 14 14M14 10l-4 4M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  },
  {
    key:      'edge',
    label:    'Граничные значения',
    modifier: 'edge',
    iconPath: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  },
];

function renderResults(data) {
  resultsEl.innerHTML = SECTIONS.map(({ key, label, modifier, iconPath }) => {
    const items = data[key] || [];
    if (!items.length) return '';

    return `
      <article class="result-section" aria-label="${label} проверки">
        <div class="section-head">
          <span class="badge badge--${modifier}">${label}</span>
          <span class="section-count">${items.length} проверок</span>
        </div>
        <ul class="check-list">
          ${items.map(item => `
            <li class="check-item">
              <svg class="check-icon check-icon--${modifier}" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="${iconPath}"/>
              </svg>
              <span>${escapeHtml(item)}</span>
            </li>
          `).join('')}
        </ul>
      </article>
    `;
  }).join('');
}

// ───────────────────────────────────────────────
// Утилиты
// ───────────────────────────────────────────────

function setLoading(on) {
  runBtn.disabled = on;
  if (on) {
    runBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Анализирую...';
    statusMsg.textContent = '';
  } else {
    runBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      Сгенерировать проверки`;
  }
}

function showError(msg) {
  errorBox.textContent = '⚠ ' + msg;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

function clearAll() {
  featureInput.value = '';
  resultsEl.innerHTML = '';
  clearError();
  statusMsg.textContent = '';
  featureInput.focus();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ───────────────────────────────────────────────
// События
// ───────────────────────────────────────────────

runBtn.addEventListener('click', runAnalysis);
clearBtn.addEventListener('click', clearAll);

featureInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runAnalysis();
});
