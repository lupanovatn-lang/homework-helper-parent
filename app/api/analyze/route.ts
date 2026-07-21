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
      : `Подготовь родителю план объяснения. Верни JSON: {"title":"...","intro":"...","steps":[{"title":"шаг","text":"что сказать или спросить"}]}. Дай 3–4 шага.`;

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: `${instruction}\n\nУсловие, введённое пользователем: ${task || "нет текста, смотри фото"}` },
    ];
    if (image) content.push({ type: "image_url", image_url: { url: image } });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Помощь с домашним заданием",
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
