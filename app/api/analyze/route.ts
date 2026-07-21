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
      : `Помоги родителю сначала кратко напомнить ребёнку нужное правило, затем показать универсальный способ действия, а после применить его к конкретному заданию. Верни JSON: {"title":"короткое название разбора конкретного задания","intro":"одно предложение о сути темы","rule":{"title":"правило в 3–7 словах","text":"одно простое предложение без исключений и перегруза"},"methodSteps":[{"title":"короткое действие ребёнка","text":"что именно сделать"}],"taskIntro":"короткий переход к заданию","steps":[{"title":"конкретный шаг по этому заданию","text":"что сказать или спросить, не выдавая готовый ответ"}],"parentQuestion":"один главный вопрос ребёнку"}. В methodSteps дай ровно 3 универсальных шага. В steps дай 2–3 коротких шага применения к загруженному заданию. Не повторяй правило в каждом шаге.`;

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
