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
      : `Создай адаптивное объяснение именно для этого домашнего задания. Сначала определи цель и нужное правило, затем дай короткий способ действия, а после выбери минимальную часть настоящего задания для совместного выполнения родителем и ребёнком.

Верни JSON: {"title":"короткое название темы","intro":"суть темы","taskGoal":"простыми словами, что требуется получить в этом ДЗ","rule":{"title":"правило в 3–7 словах","text":"одно простое предложение"},"methodSteps":[{"title":"короткое действие ребёнка","text":"что именно сделать"}],"guidedPractice":{"label":"что именно взято из задания","item":"конкретный элемент или первый смысловой этап настоящего задания","question":"один вопрос, с которого родитель начинает совместную работу","hint":"мягкая подсказка без полного ответа","explanation":"короткий разбор этого одного элемента или этапа"},"independentStep":"что ребёнок теперь делает сам","checkPrompt":"как родителю проверить результат без выдачи ответов"}.

Правила выбора совместной части:
- Если есть ряд однотипных примеров, слов, предложений или строк таблицы — выбери один самый простой и показательный элемент из самого задания, не обязательно первый.
- Если задача одна и неделимая — вместе выполните только первый смысловой этап: понять вопрос, выделить данные или выбрать способ, но не решай всё за ребёнка.
- Для сочинения, пересказа или творческой работы — вместе определите замысел или план, но не создавай готовую работу.
- methodSteps: ровно 3 коротких универсальных шага для этого типа задания.
- Не создавай похожее дополнительное упражнение и не повторяй один и тот же план на разных экранах.
- Не раскрывай ответы ко всему заданию: допустим подробный разбор только одного минимального элемента.`;

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
    const analysis = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обработать задание";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
