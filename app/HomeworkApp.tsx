"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Camera, Check, CheckCircle, FileImage,
  Lightbulb, MagnifyingGlass, Plant, ShieldCheck, Sparkle, X,
} from "@phosphor-icons/react";

const SAMPLE_TASK = "Вычисли: 48 : 6 + 7 × 3. Объясни порядок действий.";
type Mode = "explain" | "check";

export function HomeworkApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("explain");
  const [file, setFile] = useState<File | null>(null);
  const [showText, setShowText] = useState(false);
  const [task, setTask] = useState("");
  const [screen, setScreen] = useState<"start" | "result">("start");
  const [loading, setLoading] = useState(false);
  const hasTask = Boolean(file || task.trim());

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (picked) { setFile(picked); setTask(""); setShowText(false); }
  }

  function begin() {
    if (!hasTask) { setShowText(true); setTask(SAMPLE_TASK); return; }
    setLoading(true);
    window.setTimeout(() => { setLoading(false); setScreen("result"); }, 850);
  }

  function reset() { setScreen("start"); setFile(null); setTask(""); setShowText(false); }

  if (screen === "result") {
    return (
      <main className="page-shell"><section className="mobile-prototype result-screen">
        <header className="topbar result-topbar">
          <button className="icon-button" onClick={() => setScreen("start")} aria-label="Назад"><ArrowLeft size={22} weight="bold" /></button>
          <div className="secure"><ShieldCheck size={19} /> Без регистрации</div>
        </header>
        <div className="result-heading">
          <div className="result-icon"><Sparkle size={25} weight="fill" /></div>
          <p className="eyebrow">{mode === "explain" ? "План объяснения" : "Проверка решения"}</p>
          <h1>{mode === "explain" ? "Объясните ребёнку по шагам" : "Вот что стоит проверить"}</h1>
          <p>{mode === "explain" ? "Не называйте ответ сразу — начните с вопроса." : "Покажите ребёнку место ошибки и предложите исправить самому."}</p>
        </div>
        {mode === "explain" ? <ExplainResult /> : <CheckResult />}
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
      <div className="promise"><span><Plant size={23} weight="fill" /></span>Не выдаём готовый ответ —<br /> помогаем ребёнку понять</div>
    </section></main>
  );
}

function ModeCard({ selected, onClick, icon, title, text }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return <button className={`mode-card ${selected ? "selected" : ""}`} onClick={onClick} role="radio" aria-checked={selected}>{selected && <span className="selected-check"><Check size={13} weight="bold" /></span>}<span className="mode-icon">{icon}</span><strong>{title}</strong><small>{text}</small></button>;
}

function ExplainResult() {
  return <div className="steps-list"><div className="step-row"><span>1</span><div><strong>Спросите про порядок действий</strong><p>«Какое действие здесь нужно выполнить первым? Почему?»</p></div></div><div className="step-row"><span>2</span><div><strong>Разберите выражение на части</strong><p>Сначала 48 : 6, отдельно 7 × 3, затем сложение.</p></div></div><div className="step-row"><span>3</span><div><strong>Попросите проверить себя</strong><p>Пусть ребёнок проговорит порядок действий ещё раз.</p></div></div></div>;
}

function CheckResult() {
  return <div className="check-list"><div className="check-summary"><CheckCircle size={27} weight="fill" /><div><strong>Начало решения верное</strong><p>Деление выполнено правильно.</p></div></div><div className="issue-box"><span>Обратите внимание</span><strong>Нарушен порядок действий</strong><p>Ребёнок сложил числа до умножения. Предложите отметить действия над выражением цифрами.</p></div><div className="parent-prompt"><Lightbulb size={22} weight="fill" /><p><strong>Что спросить:</strong> «Какое правило помогает выбрать следующее действие?»</p></div></div>;
}
