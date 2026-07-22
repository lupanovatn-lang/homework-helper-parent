import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Ты — педагогический помощник для родителя школьника. Твоя задача — помочь родителю объяснить материал или проверить уже выполненную работу, не подменяя обучение готовым ответом.

Правила:
- Пиши по-русски, коротко и доброжелательно.
- Не выдавай итоговый ответ сразу.
- Используй понятные родителю формулировки и вопросы, которые он может задать ребёнку.
- Если данных недостаточно или фото нечитаемое, честно скажи об этом.
- Верни только корректный JSON без markdown.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Ключ OpenRouter ещё не добавлен в Render" }, { status: 503 });

  try {
    const { mode, task, image } = await request.json();
    if (!task && !image) return NextResponse.json({ error: "Добавьте фото или текст задания" }, { status: 400 });

    const instruction = mode === "check"
      ? `Проверь решение ребёнка. Верни JSON: {"title":"...","intro":"...","summary":"что сделано хорошо","steps":[{"title":"...","text":"..."}],"issue":{"title":"главная ошибка или зона проверки","text":"как родителю помочь ребёнку исправить самому"},"parentQuestion":"вопрос ребёнку"}.`
      : `Распознай ВСЕ отдельные задания на фото или в тексте и создай для каждого адаптивный сценарий помощи родителю. Верни JSON только такого вида: {"tasks":[{"title":"полное короткое название","shortTitle":"2–6 слов для списка","instruction":"как родителю простыми словами объяснить ребёнку, что требуется","simplerInstruction":"ещё более простая версия инструкции","comprehensionQuestion":"один запасной вопрос о понимании инструкции","guidingQuestions":["2–3 наводящих вопроса по частям инструкции"],"rule":{"title":"смысл правила в 3–8 словах","text":"естественная фраза родителя только с сутью правила, без алгоритма действий"},"methodType":"steps или decision","methodSteps":[{"title":"короткое действие","text":"необязательное пояснение"}],"decisionGuide":{"start":"с чего начать проверку","questions":[{"question":"короткий вопрос да/нет","yes":"что сделать при ответе да","no":"что сделать при ответе нет"}]},"knowledgeAid":{"title":"что можно быстро вспомнить","type":"table, list или examples","columns":["до 3 коротких заголовков"],"rows":[["ячейки справочной таблицы"]],"items":["элементы списка или примеры"]},"guidedTitle":"какой реальный элемент задания делаем вместе","guidedSteps":[{"title":"название смыслового шага","prompt":"конкретный вопрос или действие для ребёнка","display":"необязательный объект работы: слово, выражение, фрагмент","answerType":"choice, text или spoken","options":["2–4 коротких варианта, только если естественны"],"correctOption":"точная строка одного варианта","acceptableAnswers":["допустимые короткие ответы для text"],"hint":"одна мягкая подсказка без полного ответа","success":"коротко почему ответ верный и что поняли"}],"extraGuidedSteps":["такие же объекты guidedStep для второго, обязательно другого элемента задания"],"independentInstruction":"короткая естественная фраза ребёнку: сделать остальные пункты так же и при необходимости смотреть в памятку"}]}.

Обязательные правила:
- Сначала определи границы заданий. Новое задание существует только при отдельной инструкции или явной метке «Задание N», «Упражнение N», «№ N» с собственным требованием.
- Строки, столбцы, предложения, примеры, слова, пункты внутри одной таблицы и подпункты под одной общей инструкцией — это части ОДНОГО задания. Никогда не создавай из них отдельные tasks.
- Если на фото одна инструкция и под ней несколько строк или групп примеров, верни ровно один task и разбирай один показательный элемент, а остальные оставь для самостоятельной работы.
- Перед ответом перепроверь количество tasks: у каждого должна быть собственная формулировка того, что требуется сделать. Не объединяй только действительно разные упражнения.
- Строго разделяй четыре педагогических этапа. Поля instruction, simplerInstruction и comprehensionQuestion относятся ТОЛЬКО к пониманию формулировки задания — что нужно сделать и какой результат получить. В них нельзя объяснять правило, критерий выбора, способ решения или спрашивать «как решить».
- instruction должна звучать как естественная фраза родителя, обращённая к ребёнку: используй «тебе нужно», «нужно» или повелительную форму. Никогда не начинай её словами «ребёнку нужно».
- comprehensionQuestion проверяет только понимание инструкции. Ребёнок должен суметь ответить на него сразу после instruction, ещё не зная правила. Это всегда один короткий ОТКРЫТЫЙ вопрос без вариантов ответа, перечислений, примеров, подсказок и союза «или». Не вставляй правильный ответ в сам вопрос. Хорошие вопросы: «Что нужно сделать в каждом предложении?», «Куда нужно записать слова?», «Что нужно найти в задаче?». Плохие вопросы: «Нужно написать the или оставить пусто?», «Как понять, какой ответ правильный?», «Как решить?», «Почему здесь нужен the?».
- guidingQuestions показываются только если ребёнок не смог пересказать инструкцию своими словами. Дай 2–3 коротких вопроса, которые последовательно помогают восстановить части инструкции: с чего начать, что сделать затем, куда или как записать результат. Не объясняй в них правило решения и не называй готовый ответ.
- Поле rule содержит только СМЫСЛ правила — что верно и почему. Это естественная фраза родителя ребёнку, а не инструкция действий. Не начинай rule.text словами «посчитай», «найди», «проверь», «запиши», «выбери»; эти действия относятся к methodSteps или decisionGuide.
- Выбирай формат памятки по смыслу задания. methodType="steps" — когда действия всегда выполняются линейно и по порядку. methodType="decision" — когда следующее действие зависит от ответа, признака или условия («если да / если нет»).
- Для steps дай 3–4 methodSteps. Для decision дай 1–3 последовательных вопроса в decisionGuide; ветка должна сразу говорить ребёнку, что делать или к какому следующему вопросу перейти. Не превращай развилку в линейные шаги.
- Всегда заполняй methodSteps как короткий запасной вариант памятки, даже если выбран decision.
- methodSteps и decisionGuide содержат только способ применения правила и не пересказывают rule.
- Всегда оценивай, нужны ли ребёнку справочные знания, чтобы применить способ: таблица падежей, формула, единицы измерения, алфавит, признаки части речи, словарные слова или короткие примеры. Если нужны — заполни knowledgeAid; если нет — верни null.
- knowledgeAid содержит только компактные данные, которые ребёнок мог забыть, а не пересказ rule и не ответы к самому заданию. Для соответствий используй table (до 3 колонок и 8 строк), для набора фактов — list, для образцов — examples.
- guidedSteps должны провести через полный способ на ОДНОМ минимальном элементе настоящего задания. Обычно 2–4 смысловых шага.
- Каждый guidedStep обязан продвигать решение. Не создавай пустые шаги «прочитай условие», «найди пропуск», «найди слово после пропуска», «посмотри на пример», если этот объект уже явно виден в display.
- Для заданий с готовыми пропусками не спрашивай, где может стоять ответ и перед каким словом он ставится. Сразу применяй критерий к слову после конкретного пропуска. Например: display="___ sun is warm", первый вопрос — «Перед sun стоит my/his?», следующий — «Sun — единственный предмет?», финальный — «Что впишем в пропуск?» с text-автопроверкой.
- Перед выдачей JSON мысленно пройди guidedSteps глазами ребёнка: убери любой шаг, ответ на который уже нарисован в display или прямо содержится в prompt.
- Для списка однотипных пунктов выбери один простой показательный пункт из самого задания. Для одной большой задачи вместе пройди только первые смысловые этапы, не решая всё. Для творческой работы помоги с замыслом и планом, но не пиши готовую работу.
- Если в задании есть минимум два однотипных элемента, заполни extraGuidedSteps полным разбором ВТОРОГО элемента. Его display обязан отличаться от всех display в guidedSteps. Если второго элемента нет, верни пустой массив.
- Для каждого guidedStep выбирай способ ответа. answerType="text" для любого короткого объективно проверяемого ответа: буквы, числа, слова, знака или короткой фразы; заполни acceptableAnswers всеми корректными вариантами. Например, для вопроса «Какая гласная в слове лист?» используй text и acceptableAnswers=["и"].
- answerType="choice" используй только когда варианты педагогически естественны; заполни options и correctOption. answerType="spoken" — только для открытого объяснения, которое невозможно проверить точным сравнением. Никогда не используй spoken для букв, чисел или однозначных словесных ответов.
- Не выдавай ответы ко всему домашнему заданию. Полностью разбирай только один минимальный элемент.
- independentInstruction — одно короткое обращение прямо к ребёнку. Не добавляй сюда проверку работы, новые правила или исключения.
- Пиши для родителя коротко, конкретно и без педагогического канцелярита.`;

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
        temperature: 0.3,
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
    const analysis = removeRedundantGuidedSteps(collapseFalseLineSplits(normalizeParentSpeech(parsed)));
    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обработать задание";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function removeRedundantGuidedSteps(analysis: Record<string, unknown>) {
  if (!Array.isArray(analysis.tasks)) return analysis;
  return {
    ...analysis,
    tasks: analysis.tasks.map((rawTask) => {
      if (!rawTask || typeof rawTask !== "object") return rawTask;
      const task = rawTask as Record<string, unknown>;
      if (!Array.isArray(task.guidedSteps) || task.guidedSteps.length < 2) return task;
      const first = task.guidedSteps[0];
      if (!first || typeof first !== "object") return task;
      const step = first as Record<string, unknown>;
      const display = String(step.display || "");
      const prompt = String(step.prompt || "");
      const hasVisibleBlank = /_{2,}|\.{3,}|…/.test(display);
      const asksToLocateVisibleTarget = /(?:найди|покажи|определи|отыщи).{0,35}(?:пропуск|слово.{0,20}(?:после|перед)|место.{0,20}(?:артикл|ответ))/i.test(prompt);
      if (!hasVisibleBlank || !asksToLocateVisibleTarget) return task;
      return { ...task, guidedSteps: task.guidedSteps.slice(1) };
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
      return {
        ...task,
        instruction: addressChildDirectly(task.instruction),
        simplerInstruction: addressChildDirectly(task.simplerInstruction),
        comprehensionQuestion: removeAnswerFromQuestion(task.comprehensionQuestion),
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

function addressChildDirectly(value: unknown) {
  if (typeof value !== "string") return value;
  return value
    .replace(/^Реб[ёе]нку нужно\s*/i, "Тебе нужно ")
    .replace(/^Реб[ёе]нок должен\s*/i, "Тебе нужно ")
    .replace(/^Ученик должен\s*/i, "Тебе нужно ");
}
