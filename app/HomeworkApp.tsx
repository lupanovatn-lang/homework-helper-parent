"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Camera, Check, CheckCircle, FileImage,
  Lightbulb, MagnifyingGlass, Plant, Question, ShieldCheck, Sparkle, X,
} from "@phosphor-icons/react";

const SAMPLE_TASK = "Вычисли: 48 : 6 + 7 × 3. Объясни порядок действий.";
type Mode = "explain" | "check";
type Analysis = {
  title: string;
  intro: string;
  rule?: { title: string; text: string };
  methodSteps?: Array<{ title: string; text: string }>;
  taskIntro?: string;
  summary?: string;
  steps?: Array<{ title: string; text: string }>;
  issue?: { title: string; text: string };
  parentQuestion?: string;
};

export function HomeworkApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("explain");
  const [file, setFile] = useState<File | null>(null);
  const [showText, setShowText] = useState(false);
  const [task, setTask] = useState("");
  const [screen, setScreen] = useState<"start" | "method" | "result">("start");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const hasTask = Boolean(file || task.trim());

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (picked) { setFile(picked); setTask(""); setShowText(false); }
  }

  async function begin() {
    if (!hasTask) { setShowText(true); setTask(SAMPLE_TASK); return; }
    setLoading(true);
    setError("");
    try {
      const image = file ? await fileToDataUrl(file) : null;
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, task: task.trim(), image }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось разобрать задание");
      setAnalysis(data.analysis);
      setScreen(mode === "explain" ? "method" : "result");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось разобрать задание");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setScreen("start"); setFile(null); setTask(""); setShowText(false); }

  if (screen === "method" && mode === "explain") {
    return <MethodScreen analysis={analysis} onBack={() => setScreen("start")} onContinue={() => setScreen("result")} />;
  }

  if (screen === "result") {
    return (
      <main className="page-shell"><section className="mobile-prototype result-screen">
        <header className="topbar result-topbar">
          <button className="icon-button" onClick={() => setScreen("start")} aria-label="Назад"><ArrowLeft size={22} weight="bold" /></button>
          <div className="secure"><ShieldCheck size={19} /> Без регистрации</div>
        </header>
        <div className="result-heading">
          <div className="result-icon"><Sparkle size={25} weight="fill" /></div>
          <p className="eyebrow">{mode === "explain" ? "Разбираем задание" : "Проверка решения"}</p>
          <h1>{analysis?.title || (mode === "explain" ? "Применяем способ к заданию" : "Вот что стоит проверить")}</h1>
          <p>{mode === "explain" ? (analysis?.taskIntro || "Теперь пройдите по заданию вместе, не называя готовый ответ.") : (analysis?.intro || "Покажите ребёнку место ошибки и предложите исправить самому.")}</p>
        </div>
        {mode === "explain" ? <ExplainResult analysis={analysis} /> : <CheckResult analysis={analysis} />}
        <button className="primary-button compact" onClick={reset}>Разобрать другое задание <ArrowRight size={20} weight="bold" /></button>
      </section></main>
    );
  }

  return (
    <main className="page-shell"><section className="mobile-prototype">
      <header className="topbar">
        <div className="brand-placeholder" aria-label="Сервис помощи с домашним заданием"><Sparkle size={26} weight="fill" /></div>
        <div className="secure"><ShieldCheck size={19} /> Без регистрации</div>
      </header>
      <section className="intro">
        <h1>Поможем с домашним заданием</h1>
        <p>Сфотографируйте задание. Подскажем, как объяснить его ребёнку, или проверим уже выполненную работу.</p>
      </section>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" onChange={chooseFile} />
      {file ? (
        <div className="file-state"><div className="file-icon"><FileImage size={30} /></div><div><strong>Фото добавлено</strong><span>{file.name}</span></div><button onClick={() => setFile(null)} aria-label="Удалить фото"><X size={20} weight="bold" /></button></div>
      ) : showText ? (
        <div className="text-state"><label htmlFor="task">Введите условие задания</label><textarea id="task" autoFocus value={task} onChange={(e) => setTask(e.target.value)} placeholder="Например: реши задачу № 5…" /><button className="text-link small" onClick={() => { setShowText(false); setTask(""); }}><Camera size={18} /> Добавить фото</button></div>
      ) : (
        <button className="upload-zone" onClick={() => inputRef.current?.click()}><span className="camera-circle"><Camera size={46} /></span><strong>Сфотографировать задание</strong><small>Поддерживаются фото, сканы и скриншоты</small></button>
      )}
      {!showText && !file && <button className="text-link" onClick={() => setShowText(true)}>Ввести текстом</button>}
      <section className="mode-section">
        <h2>Что нужно сделать?</h2>
        <div className="mode-grid" role="radiogroup" aria-label="Выберите сценарий">
          <ModeCard selected={mode === "explain"} onClick={() => setMode("explain")} icon={<Lightbulb size={31} />} title="Объяснить ребёнку" text="Пошагово, вопросами и подсказками" />
          <ModeCard selected={mode === "check"} onClick={() => setMode("check")} icon={<MagnifyingGlass size={31} />} title="Проверить решение" text="Найдём ошибку и подскажем, что исправить" />
        </div>
        {mode === "check" && <p className="context-note"><Camera size={16} /> Добавьте фото задания вместе с решением ребёнка</p>}
      </section>
      <button className="primary-button" onClick={begin} disabled={loading}><span>{loading ? "Разбираем…" : "Начать"}</span>{loading ? <span className="spinner" /> : <ArrowRight size={25} weight="bold" />}</button>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="promise"><span><Plant size={23} weight="fill" /></span>Не выдаём готовый ответ —<br /> помогаем ребёнку понять</div>
    </section></main>
  );
}

function MethodScreen({ analysis, onBack, onContinue }: { analysis: Analysis | null; onBack: () => void; onContinue: () => void }) {
  const methodSteps = analysis?.methodSteps?.length ? analysis.methodSteps : [
    { title: "Прочитай задание", text: "Пойми, что нужно найти или сделать." },
    { title: "Спроси себя", text: "Какое правило поможет выполнить задание?" },
    { title: "Сделай и проверь", text: "Выполни действие и проверь себя по условию." },
  ];
  const rule = analysis?.rule || { title: "Сначала вспомним главное", text: analysis?.intro || "Назовите ребёнку только одно правило, которое понадобится в этом задании." };

  return <main className="page-shell"><section className="mobile-prototype method-screen">
    <header className="topbar result-topbar">
      <button className="icon-button" onClick={onBack} aria-label="Назад"><ArrowLeft size={22} weight="bold" /></button>
      <div className="secure"><ShieldCheck size={19} /> Без регистрации</div>
    </header>
    <div className="method-heading">
      <p className="eyebrow">Способ действия</p>
      <h1>Как выполнять задание</h1>
      <p>Покажите ребёнку простой порядок действий.</p>
    </div>
    <div className="rule-strip"><BookOpen size={22} /><div><strong>{rule.title}</strong><p>{rule.text}</p></div></div>
    <div className="method-list">{methodSteps.slice(0, 3).map((step, index) => <div className="method-row" key={`${step.title}-${index}`}><span className="method-number">{index + 1}</span><span className="method-symbol">{index === 0 ? <BookOpen size={21} /> : index === 1 ? <Question size={21} /> : <CheckCircle size={21} />}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}</div>
    <div className="main-question"><Lightbulb size={22} /><p><strong>Главный вопрос:</strong> «Какое правило поможет сделать этот шаг?»</p></div>
    <button className="primary-button method-cta" onClick={onContinue}>Перейти к заданию <ArrowRight size={22} weight="bold" /></button>
    <button className="text-link method-back" onClick={onBack}>Вернуться к заданию</button>
  </section></main>;
}

function ModeCard({ selected, onClick, icon, title, text }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return <button className={`mode-card ${selected ? "selected" : ""}`} onClick={onClick} role="radio" aria-checked={selected}>{selected && <span className="selected-check"><Check size={13} weight="bold" /></span>}<span className="mode-icon">{icon}</span><strong>{title}</strong><small>{text}</small></button>;
}

function ExplainResult({ analysis }: { analysis: Analysis | null }) {
  const steps = analysis?.steps?.length ? analysis.steps : [
    { title: "Спросите про порядок действий", text: "«Какое действие здесь нужно выполнить первым? Почему?»" },
    { title: "Разберите выражение на части", text: "Сначала выполните действия по правилу, затем соедините результаты." },
    { title: "Попросите проверить себя", text: "Пусть ребёнок проговорит ход решения ещё раз." },
  ];
  return <><div className="applied-badge"><CheckCircle size={18} weight="fill" /> Способ уже разобрали</div><div className="steps-list applied-steps">{steps.slice(0, 3).map((step, index) => <div className="step-row" key={`${step.title}-${index}`}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.text}</p></div></div>)}</div>{analysis?.parentQuestion && <div className="parent-prompt"><Lightbulb size={22} weight="fill" /><p><strong>Что спросить ребёнка:</strong> {analysis.parentQuestion}</p></div>}</>;
}

function CheckResult({ analysis }: { analysis: Analysis | null }) {
  return <div className="check-list"><div className="check-summary"><CheckCircle size={27} weight="fill" /><div><strong>{analysis?.summary || "Что уже сделано хорошо"}</strong><p>{analysis?.steps?.[0]?.text || "Проверьте совпадение условия и первого шага решения."}</p></div></div><div className="issue-box"><span>Обратите внимание</span><strong>{analysis?.issue?.title || "Проверьте ход решения"}</strong><p>{analysis?.issue?.text || "Предложите ребёнку самостоятельно найти место, где изменился ход рассуждения."}</p></div><div className="parent-prompt"><Lightbulb size={22} weight="fill" /><p><strong>Что спросить:</strong> {analysis?.parentQuestion || "«Как ты можешь проверить этот шаг другим способом?»"}</p></div></div>;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать фотографию"));
    reader.readAsDataURL(file);
  });
}
