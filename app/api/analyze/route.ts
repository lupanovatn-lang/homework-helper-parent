import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Ты помогаешь родителю разобрать школьное домашнее задание с ребёнком.

Пиши по-русски коротко, тепло и конкретно. Не подменяй обучение готовым ответом ко всему заданию.
Если фото нечитаемое или данных мало — скажи честно.
Верни только корректный JSON без markdown.`;

const REVIEW_PROMPT = `Ты — учитель и редактор. Проверь JSON сценария помощи родителю до показа.

Исправь только реальные ошибки:
- фактические ошибки в правиле, примере, подсказках и ответах;
- несоответствие исходному заданию;
- пустые шаги вроде «найди пропуск» / «прочитай условие», если объект уже в display;
- неполные acceptableAnswers;
- instruction, переписанную своими словами вместо дословной.

Сохрани структуру JSON. Верни только корректный JSON без markdown.`;

const EXPLAIN_SCHEMA = `{"tasks":[{"title":"короткое название","shortTitle":"2–6 слов","instruction":"дословная инструкция с фото/текста","simplerInstruction":"короткая понятная версия для ребёнка","comprehensionQuestion":"один открытый вопрос: понял ли инструкцию","guidingQuestions":["2–3 коротких уточняющих вопроса по действиям инструкции"],"rule":{"title":"название знания","kind":"rule|formula|table|scheme|list|definition|principle","text":"1–3 предложения: суть знания для ребёнка, без алгоритма"},"ruleExample":{"display":"близкий другой пример","explanation":"одно пояснение","kind":"demo|example|compare|scheme"},"methodType":"steps|decision","methodSteps":[{"title":"короткое действие"}],"decisionGuide":{"start":"с чего начать","questions":[{"question":"да/нет","yes":"...","no":"..."}]},"knowledgeAid":{"title":"название опоры","type":"table|list|examples","required":false,"actionLabel":"открыть опору","columns":["..."],"rows":[["..."]],"items":["..."]},"guidedTitle":"первый пункт задания","guidedSteps":[{"title":"...","prompt":"вопрос ребёнку","display":"первый объект работы","answerType":"choice|text|spoken","options":["..."],"correctOption":"...","acceptableAnswers":["..."],"hint":"мягкая подсказка без полного ответа","success":"коротко почему верно"}],"extraGuidedSteps":[],"independentInstruction":"короткая фраза ребёнку: сделай остальные так же"}]}`;

const EXPLAIN_RULES = `Сценарий для интерфейса: 1) понять задание, 2) сделать первый пункт, 3) остальные сам с памяткой.

Задания:
- Новое task только при отдельной инструкции или метке «Задание/Упражнение/№» со своим требованием.
- Строки таблицы, слова и пункты под одной инструкцией — одно задание.
- Если однотипных элементов несколько: guidedSteps = первый по порядку, extraGuidedSteps = второй. Не выбирай «удобный» поздний пункт.

Инструкция:
- instruction — дословная транскрипция требования. Сохрани абзацы, списки, символы. Не упрощай и не добавляй «тебе нужно». Примеры под инструкцией не включай. Дефис переноса строки склеивай («запи-»+«ши» → «запиши»).
- simplerInstruction — короткая помощь, если ребёнок не понял.
- guidingQuestions — только про понимание инструкции, не про правило решения.

Знание и памятка:
- rule.text — живое объяснение знания ребёнку. Не начинай с «посчитай/найди/запиши».
- ruleExample — только если реально помогает; иначе null. Не раскрывай ответы текущего задания.
- Для безударной гласной в корне пример: «пропуск → проверочное слово с ударением на этой гласной → итог» (в_да → во́ды → вода́).
- methodType=steps для линейного порядка; decision — если есть развилка да/нет. methodSteps всегда заполни как короткую памятку (3–4 шага).
- knowledgeAid — только если нужна таблица/список/формула, которой нет в ruleExample; иначе null. required=true лишь когда без опоры нельзя.

Первый пункт (guidedSteps):
- Разбери один реальный первый элемент задания. Обычно 1–2 шага, редко 3.
- Сразу применяй правило к объекту в display. Не создавай шаги «прочитай условие», «посмотри на слово», «найди пропуск», если пропуск/слово уже показаны.
- answerType=text для букв, чисел, слов; перечисли все нормальные правильные варианты в acceptableAnswers. choice — только если варианты естественны. spoken — только для открытого объяснения.
- hint — одна тёплая подсказка, которая намекает на правило, но не сдаёт ответ.
- independentInstruction — коротко и по-человечески: сделай остальные пункты так же.

Тон: коротко, конкретно, без канцелярита и запугивания. Не выдавай ответы ко всему ДЗ.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Ключ OpenRouter ещё не добавлен в Render" }, { status: 503 });

  try {
    const { mode, task, image } = await request.json();
    if (!task && !image) return NextResponse.json({ error: "Добавьте фото или текст задания" }, { status: 400 });

    const instruction = mode === "check"
      ? `Проверь решение ребёнка. Верни JSON: {"title":"...","intro":"...","summary":"что сделано хорошо","steps":[{"title":"...","text":"..."}],"issue":{"title":"главная ошибка или зона проверки","text":"как родителю помочь ребёнку исправить самому"},"parentQuestion":"вопрос ребёнку"}. Пиши коротко, тепло и по делу.`
      : `Распознай задания на фото или в тексте и создай сценарий помощи родителю.

Верни JSON вида: ${EXPLAIN_SCHEMA}

${EXPLAIN_RULES}`;

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: `${instruction}\n\nУсловие, введённое пользователем: ${task || "нет текста, смотри фото"}` },
    ];
    if (image) content.push({ type: "image_url", image_url: { url: image } });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Homework Helper for Parents",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-5.2",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || "OpenRouter не смог обработать задание";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const raw = result?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Модель вернула пустой ответ");
    const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
    // Второй вызов модели удваивал ожидание (часто +20–30 сек). Включать только явно.
    const reviewed = process.env.OPENROUTER_ENABLE_REVIEW === "1"
      ? await reviewPedagogicalAccuracy({ apiKey, analysis: parsed, task })
      : parsed;
    const analysis = removeRedundantRitualSteps(collapseFalseLineSplits(normalizeParentSpeech(reviewed)));
    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обработать задание";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function reviewPedagogicalAccuracy({ apiKey, analysis, task }: { apiKey: string; analysis: Record<string, unknown>; task?: string }) {
  try {
    const content: Array<Record<string, unknown>> = [{
      type: "text",
      text: `Исходный текст пользователя: ${task || "текст не введён; опирайся на поля instruction/title/guidedSteps как на транскрипт фото"}\n\nПодготовленный ответ для проверки:\n${JSON.stringify(analysis)}`,
    }];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Homework Helper Quality Review",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_REVIEW_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-5.2",
        messages: [
          { role: "system", content: REVIEW_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return analysis;
    const result = await response.json();
    const raw = result?.choices?.[0]?.message?.content;
    if (!raw) return analysis;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  } catch {
    return analysis;
  }
}

function hasVisibleBlank(value: unknown) {
  return /(?:[A-Za-zА-Яа-яЁё]\s*[_.…⋯]|\b_{2,}\b|\.{3,}|…)/.test(String(value || ""));
}

function hasVisibleWorkObject(value: unknown) {
  return String(value || "").trim().length >= 2;
}

function isFindBlankStep(title: unknown, prompt: unknown = "") {
  const text = `${String(title || "")} ${String(prompt || "")}`.toLocaleLowerCase("ru");
  return /(?:най(?:ти|ди)|находить|определ(?:и|ить)|покаж(?:и|ить)|отыщ(?:и|ить)|ищут)\s+(?:место\s+)?(?:пропуск|пропущ)/i.test(text)
    || /где\s+(?:в\s+слове\s+)?(?:стоит\s+)?пропуск/i.test(text)
    || /место\s+пропуск/i.test(text);
}

function isEmptyRitualStep(title: unknown, prompt: unknown = "", flags: { blankVisible?: boolean; objectVisible?: boolean } = {}) {
  const text = `${String(title || "")} ${String(prompt || "")}`.toLocaleLowerCase("ru");
  const titleOnly = String(title || "").trim().toLocaleLowerCase("ru");

  if (flags.blankVisible && isFindBlankStep(title, prompt)) return true;

  const readCondition = /(?:прочита(?:й|ть)|прочти|прочесть|перечитай|перечитать)\s+(?:ещё\s+раз\s+)?(?:условие|задани[ея]|инструкци[юяеи]|текст(?:\s+задания)?)/i.test(text)
    || /(?:посмотри|посмотреть)\s+(?:ещё\s+раз\s+)?(?:на\s+)?(?:условие|задани[ея]|инструкци[юяеи])/i.test(text)
    || /^(?:прочитай|прочитать|прочти|прочесть|перечитай)$/i.test(titleOnly);

  const lookAtShownObject = /(?:посмотри|посмотреть|покажи|показать)\s+(?:ещё\s+раз\s+)?(?:на\s+)?(?:это\s+)?(?:слово|пример|выражени[ея]|фрагмент|экран)/i.test(text)
    || /(?:найди|найти|определи|определить)\s+(?:это\s+)?(?:слово|пример)(?:\s+в\s+задании)?(?!\s+(?:провер|родствен|однокорен))/i.test(text)
    || /какой\s+(?:это\s+)?(?:слово|пример)|что\s+написано\s+в\s+(?:задании|примере)|какое\s+слово\s+(?:видишь|перед\s+тобой)/i.test(text);

  const emptyStart = /^(?:начать|начинаем|старт|прочитай условие|прочитай задание|посмотри на слово|посмотри на пример)$/i.test(titleOnly);

  if (readCondition || emptyStart) return true;
  if (flags.objectVisible && lookAtShownObject) return true;
  return false;
}

function stripRitualGuidedSteps(steps: unknown) {
  if (!Array.isArray(steps) || !steps.length) return steps;
  const cleaned = steps.filter((rawStep) => {
    if (!rawStep || typeof rawStep !== "object") return true;
    const step = rawStep as Record<string, unknown>;
    const display = String(step.display || "");
    const objectVisible = hasVisibleWorkObject(display);
    const blankVisible = hasVisibleBlank(display);
    if (!objectVisible && !blankVisible) return true;
    return !isEmptyRitualStep(step.title, step.prompt, { blankVisible, objectVisible: objectVisible || blankVisible });
  });
  return cleaned.length ? cleaned : steps;
}

function removeRedundantRitualSteps(analysis: Record<string, unknown>) {
  if (!Array.isArray(analysis.tasks)) return analysis;
  return {
    ...analysis,
    tasks: analysis.tasks.map((rawTask) => {
      if (!rawTask || typeof rawTask !== "object") return rawTask;
      const task = rawTask as Record<string, unknown>;
      const guidedSteps = Array.isArray(task.guidedSteps) ? task.guidedSteps : [];
      const extraGuidedSteps = Array.isArray(task.extraGuidedSteps) ? task.extraGuidedSteps : [];
      const blankVisible = hasVisibleBlank(task.instruction)
        || guidedSteps.some((step) => step && typeof step === "object" && hasVisibleBlank((step as Record<string, unknown>).display))
        || extraGuidedSteps.some((step) => step && typeof step === "object" && hasVisibleBlank((step as Record<string, unknown>).display));
      const objectVisible = guidedSteps.some((step) => step && typeof step === "object" && hasVisibleWorkObject((step as Record<string, unknown>).display))
        || extraGuidedSteps.some((step) => step && typeof step === "object" && hasVisibleWorkObject((step as Record<string, unknown>).display));

      let methodSteps = task.methodSteps;
      if ((blankVisible || objectVisible) && Array.isArray(task.methodSteps)) {
        const filtered = task.methodSteps.filter((rawStep) => {
          if (!rawStep || typeof rawStep !== "object") return true;
          const step = rawStep as Record<string, unknown>;
          return !isEmptyRitualStep(step.title, step.text, { blankVisible, objectVisible: objectVisible || blankVisible });
        });
        if (filtered.length) methodSteps = filtered.slice(0, 4);
      }

      return {
        ...task,
        methodSteps,
        guidedSteps: stripRitualGuidedSteps(task.guidedSteps),
        extraGuidedSteps: stripRitualGuidedSteps(task.extraGuidedSteps),
      };
    }),
  };
}

function collapseFalseLineSplits(analysis: Record<string, unknown>) {
  if (!Array.isArray(analysis.tasks) || analysis.tasks.length < 2) return analysis;
  const tasks = analysis.tasks.filter((task): task is Record<string, unknown> => Boolean(task && typeof task === "object"));
  if (tasks.length !== analysis.tasks.length) return analysis;

  const looksLikeRows = tasks.every((task) => {
    const label = `${String(task.title || "")} ${String(task.shortTitle || "")}`;
    return /(?:строка|ряд)\s*№?\s*\d+/i.test(label);
  });
  if (!looksLikeRows) return analysis;

  const first = { ...tasks[0] };
  first.title = String(first.title || "Задание").replace(/(?:для\s+)?(?:строки|строка|ряда|ряд)\s*№?\s*\d+/gi, "").replace(/\s{2,}/g, " ").trim() || "Разбираем задание";
  first.shortTitle = "Все строки задания";
  return { ...analysis, tasks: [first] };
}

function normalizeParentSpeech(analysis: Record<string, unknown>) {
  if (!Array.isArray(analysis.tasks)) return analysis;

  return {
    ...analysis,
    tasks: analysis.tasks.map((rawTask) => {
      if (!rawTask || typeof rawTask !== "object") return rawTask;
      const task = rawTask as Record<string, unknown>;
      const example = task.ruleExample && typeof task.ruleExample === "object"
        ? task.ruleExample as Record<string, unknown>
        : null;
      const hasExample = Boolean(example && String(example.display || "").trim());
      const aid = task.knowledgeAid && typeof task.knowledgeAid === "object"
        ? task.knowledgeAid as Record<string, unknown>
        : null;
      const redundantExamples = hasExample && aid && aid.type === "examples" && aid.required !== true;
      return {
        ...task,
        instruction: typeof task.instruction === "string" ? repairLineBreakHyphenation(task.instruction) : task.instruction,
        simplerInstruction: addressChildDirectly(task.simplerInstruction),
        comprehensionQuestion: removeAnswerFromQuestion(task.comprehensionQuestion),
        ruleExample: hasExample ? example : null,
        knowledgeAid: redundantExamples ? null : task.knowledgeAid,
      };
    }),
  };
}

function removeAnswerFromQuestion(value: unknown) {
  if (typeof value !== "string") return value;
  const question = value.replace(/^Что ты должен сделать/i, "Что нужно сделать").trim();
  if (/\sили\s/i.test(question) && question.includes(":")) return `${question.split(":")[0].replace(/[?.!]+$/, "")}?`;
  return question;
}

function repairLineBreakHyphenation(value: string) {
  if (typeof value !== "string" || !value) return "";
  return value
    .replace(/\u00AD/g, "")
    .replace(/([A-Za-zА-Яа-яЁё])-\r?\n+([A-Za-zА-Яа-яЁё])/g, "$1$2")
    .replace(/([A-Za-zА-Яа-яЁё])-[ \t]+([A-Za-zА-Яа-яЁё])/g, "$1$2");
}

function addressChildDirectly(value: unknown) {
  if (typeof value !== "string") return value;
  return value
    .replace(/^Реб[ёе]нку нужно\s*/i, "Тебе нужно ")
    .replace(/^Реб[ёе]нок должен\s*/i, "Тебе нужно ")
    .replace(/^Ученик должен\s*/i, "Тебе нужно ");
}
