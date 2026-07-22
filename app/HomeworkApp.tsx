"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Camera, Check, CheckCircle, FileImage,
  Image as ImageIcon, Lightbulb, MagnifyingGlass, Plant,
  ShieldCheck, Sparkle, X,
} from "@phosphor-icons/react";

const SAMPLE_TASK = "Вычисли: 48 : 6 + 7 × 3. Объясни порядок действий.";
type KnowledgeKind = "rule" | "formula" | "table" | "scheme" | "list" | "definition" | "principle";
type ExampleKind = "demo" | "example" | "compare" | "scheme";
const LOADING_STEPS = [
  { after: 0, label: "Смотрим задание" },
  { after: 5, label: "Понимаем, что нужно сделать" },
  { after: 12, label: "Готовим подсказки родителю" },
  { after: 20, label: "Проверяем точность" },
  { after: 30, label: "Ещё немного — почти готово" },
] as const;
type Mode = "explain" | "check";
type Screen = "start" | "tasks" | "learn" | "result";
type GuidedStep = {
  title: string;
  prompt: string;
  display?: string;
  answerType?: "choice" | "text" | "spoken";
  options?: string[];
  correctOption?: string;
  acceptableAnswers?: string[];
  hint: string;
  success: string;
};
type HomeworkTask = {
  title: string;
  shortTitle: string;
  instruction: string;
  simplerInstruction: string;
  comprehensionQuestion: string;
  guidingQuestions?: string[];
  rule: { title: string; text: string; kind?: KnowledgeKind };
  ruleExample?: { display: string; explanation: string; kind?: ExampleKind } | null;
  methodType?: "steps" | "decision";
  methodSteps: Array<{ title: string; text?: string }>;
  decisionGuide?: {
    start: string;
    questions: Array<{ question: string; yes: string; no: string }>;
  };
  knowledgeAid?: {
    title: string;
    type: "table" | "list" | "examples";
    required?: boolean;
    actionLabel?: string;
    columns?: string[];
    rows?: string[][];
    items?: string[];
  } | null;
  guidedTitle: string;
  guidedSteps: GuidedStep[];
  extraGuidedSteps?: GuidedStep[];
  independentInstruction: string;
};
type Analysis = {
  tasks?: HomeworkTask[];
  title?: string;
  intro?: string;
  summary?: string;
  steps?: Array<{ title: string; text: string }>;
  issue?: { title: string; text: string };
  parentQuestion?: string;
};

export function HomeworkApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("explain");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [showText, setShowText] = useState(false);
  const [task, setTask] = useState("");
  const [screen, setScreen] = useState<Screen>("start");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [currentTask, setCurrentTask] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [error, setError] = useState("");
  const hasTask = Boolean(file || task.trim());

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (picked) {
      setFile(picked); setPreview(URL.createObjectURL(picked));
      setTask(""); setShowText(false);
    }
  }

  async function begin() {
    if (!hasTask) { setShowText(true); setTask(SAMPLE_TASK); return; }
    setLoading(true); setError("");
    try {
      const image = file ? await fileToCompressedDataUrl(file) : null;
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, task: task.trim(), image }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось разобрать задание");
      setAnalysis(data.analysis); setCurrentTask(0); setCompletedTasks([]);
      if (mode === "check") setScreen("result");
      else {
        const nextTasks = normalizeTasks(data.analysis);
        setScreen(nextTasks.length === 1 ? "learn" : "tasks");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось разобрать задание");
    } finally { setLoading(false); }
  }

  function reset() {
    setScreen("start"); setFile(null); setPreview(""); setTask("");
    setShowText(false); setAnalysis(null); setCompletedTasks([]);
  }

  function removeRecognizedTask(index: number) {
    setAnalysis((current) => {
      if (!current?.tasks || current.tasks.length <= 1) return current;
      return { ...current, tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index) };
    });
    setCompletedTasks((items) => items.filter((item) => item !== index).map((item) => item > index ? item - 1 : item));
    setCurrentTask(0);
  }

  const tasks = normalizeTasks(analysis);
  const loadingProgress = useLoadingProgress(loading, Boolean(file));

  if (screen === "tasks") return <TaskPicker tasks={tasks} preview={preview} completed={completedTasks} onBack={() => setScreen("start")} onChoose={(index) => { setCurrentTask(index); setScreen("learn"); }} onRemove={removeRecognizedTask} />;
  if (screen === "learn") {
    const task = tasks[currentTask] || tasks[0];
    if (!task) return <main className="page-shell"><section className="mobile-prototype"><p className="error-message" role="alert">Не удалось открыть задание. Попробуйте ещё раз.</p><button className="primary-button" onClick={() => setScreen("start")}>На главную</button></section></main>;
    return <LearningFlow task={task} taskIndex={currentTask} taskCount={tasks.length} preview={preview} onBack={() => setScreen(tasks.length > 1 ? "tasks" : "start")} onComplete={() => { setCompletedTasks((items) => items.includes(currentTask) ? items : [...items, currentTask]); setScreen(tasks.length > 1 ? "tasks" : "start"); }} />;
  }
  if (screen === "result") return <CheckResultScreen analysis={analysis} onBack={() => setScreen("start")} onReset={reset} />;

  return (
    <main className="page-shell"><section className="mobile-prototype">
      <header className="topbar"><div className="brand-placeholder"><Sparkle size={26} weight="fill" /></div><Secure /></header>
      <section className="intro"><h1>Поможем с домашним заданием</h1><p>Сфотографируйте задание. Подскажем, как объяснить его ребёнку, или проверим уже выполненную работу.</p></section>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" onChange={chooseFile} />
      {file ? <div className="file-state"><div className="file-icon"><FileImage size={30} /></div><div><strong>Фото добавлено</strong><span>{file.name}</span></div><button onClick={() => { setFile(null); setPreview(""); }} aria-label="Удалить фото" disabled={loading}><X size={20} weight="bold" /></button></div>
      : showText ? <div className="text-state"><label htmlFor="task">Введите условие задания</label><textarea id="task" autoFocus value={task} onChange={(e) => setTask(e.target.value)} placeholder="Например: реши задачу № 5…" disabled={loading} /><button className="text-link small" onClick={() => { setShowText(false); setTask(""); }} disabled={loading}><Camera size={18} /> Добавить фото</button></div>
      : <button className="upload-zone" onClick={() => inputRef.current?.click()} disabled={loading}><span className="camera-circle"><Camera size={46} /></span><strong>Сфотографировать задание</strong><small>Поддерживаются фото, сканы и скриншоты</small></button>}
      {!showText && !file && <button className="text-link" onClick={() => setShowText(true)} disabled={loading}>Ввести текстом</button>}
      <section className="mode-section"><h2>Чем помочь?</h2><div className="mode-grid" role="radiogroup">
        <ModeCard selected={mode === "explain"} onClick={() => !loading && setMode("explain")} icon={<Lightbulb size={31} />} title="Разобрать задание" text="Поймём задание, вспомним правило и начнём вместе" />
        <ModeCard selected={mode === "check"} onClick={() => !loading && setMode("check")} icon={<MagnifyingGlass size={31} />} title="Проверить работу" text="Найдём ошибки и подскажем, как их исправить" />
      </div>{mode === "check" && <p className="context-note"><Camera size={16} /> Добавьте фото задания вместе с решением ребёнка</p>}</section>
      <button className="primary-button" onClick={begin} disabled={loading}><span>{loading ? "Разбираем…" : "Начать"}</span>{loading ? <span className="spinner" /> : <ArrowRight size={25} weight="bold" />}</button>
      {loading && <LoadingStatus elapsed={loadingProgress.elapsed} label={loadingProgress.label} progress={loadingProgress.progress} eta={loadingProgress.eta} />}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="promise"><span><Plant size={23} weight="fill" /></span>Без готовых ответов —<br /> помогаем ребёнку понять</div>
    </section></main>
  );
}

function TaskPicker({ tasks, preview, completed, onBack, onChoose, onRemove }: { tasks: HomeworkTask[]; preview: string; completed: number[]; onBack: () => void; onChoose: (index: number) => void; onRemove: (index: number) => void }) {
  const next = tasks.findIndex((_, index) => !completed.includes(index));
  return <FlowShell onBack={onBack}><div className="picker-head"><p className="success-label"><CheckCircle size={19} weight="fill" /> Фото распознано</p><h1>{tasks.length > 1 ? `На фото нашли ${tasks.length} задания` : "Задание распознано"}</h1><p>{completed.length ? "Продолжим со следующим заданием." : "Разберём по очереди — начнём с первого."}</p></div>
    {preview && <a className="photo-preview" href={preview} target="_blank" rel="noreferrer"><img src={preview} alt="Фотография домашнего задания" /><span><ImageIcon size={18} /> Открыть фото</span></a>}
    <div className="task-cards">{tasks.map((item, index) => { const done = completed.includes(index); const active = index === (next < 0 ? 0 : next); return <div key={`${item.title}-${index}`} className={`task-card ${active ? "active" : ""} ${done ? "done" : ""}`}><button className="task-card-main" onClick={() => onChoose(index)}><span className="task-index">{done ? <Check size={17} weight="bold" /> : index + 1}</span><span><strong>Задание {index + 1}</strong><small>{item.shortTitle}</small></span><span className="task-status">{done ? "Готово" : active ? "Начать" : "Выбрать"} <ArrowRight size={16} /></span></button>{tasks.length > 1 && <button className="task-remove" onClick={() => onRemove(index)} aria-label={`Удалить задание ${index + 1}`} title="Удалить лишнее задание"><X size={16} weight="bold" /></button>}</div>; })}</div>
    {next >= 0 ? <button className="primary-button flow-primary" onClick={() => onChoose(next)}>Начать задание {next + 1} <ArrowRight size={21} weight="bold" /></button> : <button className="primary-button flow-primary" onClick={onBack}>Завершить разбор <Check size={21} weight="bold" /></button>}
    <p className="flow-note"><Sparkle size={16} /> Для каждого задания: инструкция → правило → вместе → самостоятельно</p>
  </FlowShell>;
}

function LearningFlow({ task, taskIndex, taskCount, preview, onBack, onComplete }: { task: HomeworkTask; taskIndex: number; taskCount: number; preview: string; onBack: () => void; onComplete: () => void }) {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<"" | "hint" | "correct" | "wrong">("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [aidOpen, setAidOpen] = useState(Boolean(task.knowledgeAid?.required));
  const [aidAvailable, setAidAvailable] = useState(Boolean(task.knowledgeAid?.required));
  const [practiceRound, setPracticeRound] = useState<1 | 2>(1);
  const activeGuidedSteps = practiceRound === 2 && task.extraGuidedSteps?.length ? task.extraGuidedSteps : task.guidedSteps;
  const guided = activeGuidedSteps[guidedIndex] || activeGuidedSteps[0];

  function nextGuided() {
    if (guidedIndex < activeGuidedSteps.length - 1) { setGuidedIndex((v) => v + 1); setSelected(""); setTypedAnswer(""); setFeedback(""); }
    else setStage(4);
  }

  function changeAidOpen(open: boolean) {
    setAidOpen(open);
    if (open) setAidAvailable(true);
  }

  return <FlowShell onBack={onBack}>
    <div className="flow-body">
      <TaskContext task={task} index={taskIndex} count={taskCount} preview={preview} />
      <Route stage={stage} />
      {stage === 1 && <StageOne task={task} onNext={() => setStage(2)} />}
      {stage === 2 && <StageTwo task={task} aidOpen={aidOpen} onAidOpenChange={changeAidOpen} onBack={() => setStage(1)} onNext={() => setStage(3)} />}
      {stage === 3 && (
        <StageThree
          task={task}
          practiceRound={practiceRound}
          guided={guided}
          guidedIndex={guidedIndex}
          guidedCount={activeGuidedSteps.length}
          selected={selected}
          typedAnswer={typedAnswer}
          feedback={feedback}
          aidOpen={aidOpen}
          aidAvailable={aidAvailable}
          onSelect={(option) => { setSelected(option); setFeedback(""); }}
          onTypedAnswer={(value) => { setTypedAnswer(value); setFeedback(""); }}
          onFeedback={setFeedback}
          onAidOpenChange={changeAidOpen}
          onBack={() => setStage(2)}
          onNext={nextGuided}
        />
      )}
      {stage === 4 && <section className="stage-content independent"><div className="stage-main"><p className="stage-label">Шаг 4 из 4</p><h1>Теперь остальные — самостоятельно</h1><div className="child-prompt independent-prompt"><span>Скажите ребёнку</span><p>«{task.independentInstruction}»</p></div><div className="memory-card"><button className="memory-head" onClick={() => setMemoryOpen((v) => !v)}><span><BookOpen size={19} /> Памятка, если нужна</span><small>{memoryOpen ? "Свернуть" : "Показать"}</small></button>{memoryOpen && <div className="memory-content"><span className="memory-section-label">Как действовать</span><MethodGuide task={task} compact /></div>}</div>{aidAvailable && <KnowledgeAid aid={task.knowledgeAid} open={aidOpen} onOpenChange={changeAidOpen} />}</div><div className="stage-actions"><button className="primary-button flow-primary" onClick={onComplete}>Ребёнок закончил <ArrowRight size={20} weight="bold" /></button>{practiceRound === 1 && Boolean(task.extraGuidedSteps?.length) && <button className="secondary-button flow-secondary" onClick={() => { setPracticeRound(2); setStage(3); setGuidedIndex(0); setSelected(""); setTypedAnswer(""); setFeedback(""); }}>Сделать ещё один пункт вместе</button>}</div></section>}
    </div>
  </FlowShell>;
}

function StageOne({ task, onNext }: { task: HomeworkTask; onNext: () => void }) {
  const [phase, setPhase] = useState<"check" | "guide" | "retell" | "fallback">("check");
  const [guideIndex, setGuideIndex] = useState(0);
  const guidingQuestions = task.guidingQuestions?.length ? task.guidingQuestions : [task.comprehensionQuestion];
  const currentQuestion = guidingQuestions[Math.min(guideIndex, guidingQuestions.length - 1)];
  function nextQuestion() {
    if (guideIndex < guidingQuestions.length - 1) setGuideIndex((index) => index + 1);
    else setPhase("retell");
  }
  return (
    <section className="stage-content instruction-stage">
      <div className="stage-main">
        <h1>Прочитайте инструкцию</h1>
        <div className="child-material instruction-source focus-block">
          <InstructionText text={task.instruction} />
        </div>
        {phase === "check" && (
          <Recommendation title="Рекомендация">
            Попросите ребёнка рассказать своими словами, что нужно сделать.
          </Recommendation>
        )}
        {phase === "guide" && (
          <Recommendation title="Спросите ребёнка" note="Задайте вопрос, только если ребёнок не назвал это действие.">
            {currentQuestion}
          </Recommendation>
        )}
        {phase === "retell" && (
          <Recommendation title="Попросите пересказать ещё раз">
            Теперь ещё раз расскажи своими словами, что нужно сделать во всём задании.
          </Recommendation>
        )}
        {phase === "fallback" && (
          <Recommendation title="Объясните ещё проще">
            {task.simplerInstruction}
          </Recommendation>
        )}
      </div>
      <div className="stage-actions">
        {phase === "check" && (
          <>
            <button className="primary-button flow-primary" onClick={onNext}>Понятно, что делать <ArrowRight size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={() => setPhase("guide")}>Объяснить задание</button>
          </>
        )}
        {phase === "guide" && (
          <>
            <button className="primary-button flow-primary" onClick={nextQuestion}>{guideIndex < guidingQuestions.length - 1 ? "Следующий вопрос" : "Снова пересказать всё"} <ArrowRight size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={nextQuestion}>Это действие уже назвал</button>
          </>
        )}
        {phase === "retell" && (
          <>
            <button className="primary-button flow-primary" onClick={onNext}>Понятно, что делать <ArrowRight size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={() => setPhase("fallback")}>Всё ещё непонятно</button>
          </>
        )}
        {phase === "fallback" && (
          <>
            <button className="primary-button flow-primary" onClick={onNext}>Понятно, что делать <ArrowRight size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={() => { setPhase("guide"); setGuideIndex(0); }}>Вернуться к вопросам</button>
          </>
        )}
      </div>
    </section>
  );
}

function Recommendation({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <div className="recommendation-card">
      <div className="recommendation-head">
        <Lightbulb size={20} weight="regular" />
        <strong>{title}</strong>
      </div>
      <p>{children}</p>
      {note && <small>{note}</small>}
    </div>
  );
}

function InstructionText({ text }: { text: string }) {
  const blocks = splitInstructionBlocks(repairLineBreakHyphenation(text));
  return (
    <div className="instruction-text">
      {blocks.map((block, index) => (
        block.type === "list"
          ? <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{protectShortTokens(item)}</li>)}</ul>
          : <p key={`p-${index}`}>{protectShortTokens(block.text)}</p>
      ))}
    </div>
  );
}

function repairLineBreakHyphenation(value: string) {
  if (typeof value !== "string" || !value) return "";
  return value
    .replace(/\u00AD/g, "")
    .replace(/([A-Za-zА-Яа-яЁё])-\r?\n+([A-Za-zА-Яа-яЁё])/g, "$1$2")
    .replace(/([A-Za-zА-Яа-яЁё])-[ \t]+([A-Za-zА-Яа-яЁё])/g, "$1$2");
}

function splitInstructionBlocks(value: string) {
  const lines = value.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const blocks: Array<{ type: "paragraph"; text: string } | { type: "list"; items: string[] }> = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    blocks.push({ type: "list", items: list });
    list = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const listMatch = line.match(/^\s*(?:[-•–—]|\d+[.)]|[а-яА-Яa-zA-Z][.)])\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      list.push(listMatch[1].trim());
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushParagraph();
      continue;
    }
    flushList();
    paragraph.push(line.trimStart());
  }
  flushList();
  flushParagraph();
  return blocks.length ? blocks : [{ type: "paragraph" as const, text: value.trim() }];
}

function protectShortTokens(value: string) {
  return value
    .replace(/(№)\s+/g, "$1\u00A0")
    .replace(/(\d)\s+(?=[×÷+\-–—=:])/g, "$1\u00A0")
    .replace(/([×÷+\-–—=:])\s+(\d)/g, "$1\u00A0$2")
    .replace(/(\S)\s+([№§%°×÷+\-–—=]|[а-яА-ЯёЁa-zA-Z0-9]{1,2})(?=\s|$|[.,;:!?)\]])/g, "$1\u00A0$2");
}

function StageTwo({ task, aidOpen, onAidOpenChange, onBack, onNext }: { task: HomeworkTask; aidOpen: boolean; onAidOpenChange: (open: boolean) => void; onBack: () => void; onNext: () => void }) {
  const [hintOpen, setHintOpen] = useState(false);
  const example = task.ruleExample?.display?.trim() ? task.ruleExample : null;
  const requiredAid = task.knowledgeAid?.required ? task.knowledgeAid : null;
  const optionalAid = task.knowledgeAid && !task.knowledgeAid.required && !(example && task.knowledgeAid.type === "examples")
    ? task.knowledgeAid
    : null;
  const heading = knowledgeHeading(inferKnowledgeKind(task));
  const tip = task.methodSteps?.[0]?.text || task.methodSteps?.[0]?.title || task.decisionGuide?.start || "Вместе вспомните, с чего начать применение правила к заданию.";

  function askHint() {
    if (optionalAid) onAidOpenChange(true);
    else setHintOpen(true);
  }

  return (
    <section className="stage-content instruction-stage rule-stage">
      <div className="stage-main">
        <h1>{heading}</h1>
        <div className="rule-material focus-block">
          {task.rule.title?.trim() && <span className="rule-kicker">{task.rule.title}</span>}
          <p className="rule-text">{task.rule.text}</p>
          {example && (
            <div className="rule-example-box">
              <span>Пример:</span>
              <strong>{example.display}</strong>
              {example.explanation?.trim() && <p>{example.explanation}</p>}
            </div>
          )}
          {requiredAid && <div className="knowledge-required"><KnowledgeAidBody aid={requiredAid} /></div>}
        </div>
        <Recommendation title="Рекомендация">
          Попросите ребёнка объяснить правило своими словами или привести свой пример.
        </Recommendation>
        {(optionalAid || hintOpen) && (
          optionalAid
            ? <KnowledgeAid aid={optionalAid} open={aidOpen || hintOpen} onOpenChange={(open) => { onAidOpenChange(open); if (!open) setHintOpen(false); }} />
            : <Recommendation title="Подсказка">{tip}</Recommendation>
        )}
      </div>
      <div className="stage-actions">
        <button className="primary-button flow-primary" onClick={onNext}>Дальше, к выполнению <ArrowRight size={20} weight="bold" /></button>
        <button className="secondary-button flow-secondary" onClick={askHint}><Lightbulb size={18} /> Нужна подсказка</button>
        <button className="text-link flow-back" onClick={onBack}>Вернуться к инструкции</button>
      </div>
    </section>
  );
}

function StageThree({
  task,
  practiceRound,
  guided,
  guidedIndex,
  guidedCount,
  selected,
  typedAnswer,
  feedback,
  aidOpen,
  aidAvailable,
  onSelect,
  onTypedAnswer,
  onFeedback,
  onAidOpenChange,
  onBack,
  onNext,
}: {
  task: HomeworkTask;
  practiceRound: 1 | 2;
  guided: GuidedStep;
  guidedIndex: number;
  guidedCount: number;
  selected: string;
  typedAnswer: string;
  feedback: "" | "hint" | "correct" | "wrong";
  aidOpen: boolean;
  aidAvailable: boolean;
  onSelect: (option: string) => void;
  onTypedAnswer: (value: string) => void;
  onFeedback: (value: "" | "hint" | "correct" | "wrong") => void;
  onAidOpenChange: (open: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const hasOptions = Boolean(guided.options?.length);
  const isText = guided.answerType === "text" && Boolean(guided.acceptableAnswers?.length);
  const canCheck = hasOptions ? Boolean(selected) : isText ? Boolean(typedAnswer.trim()) : false;

  function checkAnswer() {
    const correct = hasOptions
      ? selected === guided.correctOption
      : guided.acceptableAnswers?.some((answer) => normalizeAnswer(answer) === normalizeAnswer(typedAnswer));
    onFeedback(correct ? "correct" : "wrong");
  }

  return (
    <section className="stage-content practice-stage">
      <div className="stage-main">
        <h1>{practiceRound === 2 ? "Разбираем ещё один пункт" : "Выполняем вместе"}</h1>
        <p className="stage-subtitle">Применяем способ к настоящему заданию</p>
        {task.methodType !== "decision" && (
          <MethodTrail steps={task.methodSteps} active={Math.min(guidedIndex, task.methodSteps.length - 1)} />
        )}
        <div className="practice-material focus-block">
          <span className="rule-kicker">{guided.title}</span>
          <div className="practice-quote-box">
            {guided.display && <strong className="guided-display">{guided.display}</strong>}
            <p className="practice-prompt">{guided.prompt}</p>
            {hasOptions ? (
              <div className="answer-grid">
                {guided.options!.map((option) => (
                  <button key={option} className={selected === option ? "selected" : ""} onClick={() => onSelect(option)}>{option}</button>
                ))}
              </div>
            ) : isText ? (
              <label className="answer-input">
                <span>Ответ ребёнка</span>
                <input value={typedAnswer} onChange={(event) => onTypedAnswer(event.target.value)} placeholder="Введите ответ" autoComplete="off" />
              </label>
            ) : (
              <button className="secondary-button answer-spoken" onClick={() => onFeedback("correct")}>Ребёнок объяснил ответ</button>
            )}
            {feedback && (
              <div className={`guided-feedback ${feedback}`}>
                <strong>{feedback === "hint" ? "Подсказка" : feedback === "correct" ? "Верно" : "Попробуйте ещё раз"}</strong>
                <p>{feedback === "correct" ? guided.success : guided.hint}</p>
              </div>
            )}
          </div>
        </div>
        {aidAvailable && <KnowledgeAid aid={task.knowledgeAid} open={aidOpen} onOpenChange={onAidOpenChange} />}
      </div>
      <div className="stage-actions">
        {feedback === "correct" ? (
          <button className="primary-button flow-primary" onClick={onNext}>
            {guidedIndex < guidedCount - 1 ? "Следующий шаг" : "Теперь самостоятельно"} <ArrowRight size={20} weight="bold" />
          </button>
        ) : (
          <>
            <button className="primary-button flow-primary" disabled={!canCheck} onClick={checkAnswer}>Проверить ответ</button>
            <button className="secondary-button flow-secondary" onClick={() => onFeedback("hint")}><Lightbulb size={18} /> Нужна подсказка</button>
          </>
        )}
        {feedback === "wrong" && (
          <button className="text-link parent-override" onClick={() => onFeedback("correct")}>
            <CheckCircle size={18} weight="fill" /> Я проверил(а): ответ верный
          </button>
        )}
        <button className="text-link flow-back" onClick={onBack}>Вернуться к правилу</button>
      </div>
    </section>
  );
}

function inferKnowledgeKind(task: HomeworkTask): KnowledgeKind {
  if (task.rule.kind) return task.rule.kind;
  const blob = `${task.rule.title} ${task.knowledgeAid?.title || ""}`.toLocaleLowerCase("ru");
  if (/формул/.test(blob)) return "formula";
  if (/таблиц/.test(blob)) return "table";
  if (/схем/.test(blob)) return "scheme";
  if (/определен/.test(blob)) return "definition";
  if (/признак|слов/.test(blob) || task.knowledgeAid?.type === "list") return "list";
  if (/принцип/.test(blob)) return "principle";
  return "rule";
}

function knowledgeHeading(kind: KnowledgeKind) {
  if (kind === "formula") return "Посмотрите формулу";
  if (kind === "table") return "Посмотрите таблицу";
  if (kind === "scheme") return "Разберите схему";
  if (kind === "list") return "Вспомните вместе";
  if (kind === "definition") return "Прочитайте определение";
  return "Прочитайте правило";
}

function MethodGuide({ task, compact = false }: { task: HomeworkTask; compact?: boolean }) {
  const guide = task.decisionGuide;
  if (task.methodType !== "decision" || !guide?.questions?.length) return <MethodTrail steps={task.methodSteps} active={-1} />;
  return <div className={`decision-guide ${compact ? "compact" : ""}`}><div className="decision-start">{guide.start}</div>{guide.questions.slice(0, 3).map((item, index) => <div className="decision-node" key={`${item.question}-${index}`}><strong>{item.question}</strong><div><span><b>Да</b>{item.yes}</span><span><b>Нет</b>{item.no}</span></div></div>)}</div>;
}

function KnowledgeAidBody({ aid }: { aid: NonNullable<HomeworkTask["knowledgeAid"]> }) {
  const hasTable = aid.type === "table" && Boolean(aid.columns?.length && aid.rows?.length);
  const items = aid.items?.slice(0, 8) || [];
  return (
    <div className="knowledge-content embedded">
      <span className="knowledge-embedded-title">{aid.title}</span>
      {hasTable ? (
        <div className="knowledge-table">
          <div className="knowledge-row head">{aid.columns!.slice(0, 3).map((column) => <strong key={column}>{column}</strong>)}</div>
          {aid.rows!.slice(0, 8).map((row, index) => (
            <div className="knowledge-row" key={`${row.join("-")}-${index}`}>{row.slice(0, 3).map((cell, cellIndex) => <span key={`${cell}-${cellIndex}`}>{cell}</span>)}</div>
          ))}
        </div>
      ) : (
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      )}
    </div>
  );
}

function KnowledgeAid({ aid, open, onOpenChange }: { aid?: HomeworkTask["knowledgeAid"]; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!aid) return null;
  return (
    <div className="knowledge-aid">
      <button onClick={() => onOpenChange(!open)}>
        <span><Lightbulb size={17} weight="fill" /> {open ? aid.title : aid.actionLabel || aid.title}</span>
        <small>{open ? "Свернуть" : "Открыть"}</small>
      </button>
      {open && <KnowledgeAidBody aid={aid} />}
    </div>
  );
}

function MethodTrail({ steps, active }: { steps: Array<{ title: string }>; active: number }) {
  return <div className="method-trail">{steps.slice(0, 4).map((step, index) => <div key={`${step.title}-${index}`} className={index === active ? "active" : ""}><span>{index + 1}</span><small>{step.title}</small></div>)}</div>;
}

function Route({ stage }: { stage: number }) {
  const labels = ["Инструкция", "Правило", "Выполнение", "Проверим"];
  return <nav className="learning-route" aria-label="Этапы объяснения">{labels.map((label, index) => { const number = index + 1; return <div key={label} className={number === stage ? "active" : number < stage ? "done" : ""}><span>{number < stage ? <Check size={12} weight="bold" /> : number}</span><small>{label}</small></div>; })}</nav>;
}

function TaskContext({ task, index, count, preview }: { task: HomeworkTask; index: number; count: number; preview: string }) {
  return <div className="task-context">{preview ? <img src={preview} alt="Задание" /> : <FileImage size={27} />}<div><strong>Задание {index + 1}{count > 1 ? ` из ${count}` : ""}</strong><span>{task.shortTitle}</span></div>{preview && <a href={preview} target="_blank" rel="noreferrer"><ImageIcon size={17} /> Фото</a>}</div>;
}

function FlowShell({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return <main className="page-shell"><section className="mobile-prototype flow-screen"><header className="topbar"><button className="icon-button" onClick={onBack} aria-label="Назад"><ArrowLeft size={22} weight="bold" /></button><Secure /></header>{children}</section></main>;
}

function Secure() { return <div className="secure"><ShieldCheck size={19} /> Без регистрации</div>; }

function LoadingStatus({ elapsed, label, progress, eta }: { elapsed: number; label: string; progress: number; eta: string }) {
  const overEta = elapsed > 70;
  return (
    <div className="loading-status" role="status" aria-live="polite">
      <div className="loading-status-head">
        <strong>{label}</strong>
        <span>{elapsed} сек</span>
      </div>
      <div className="loading-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <p>{overEta
        ? "Сложная страница — обычно ещё немного. Приложение работает, можно подождать."
        : `Обычно занимает ${eta}. Можно подождать — приложение работает.`}</p>
    </div>
  );
}

function useLoadingProgress(active: boolean, hasPhoto: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [active]);
  const label = [...LOADING_STEPS].reverse().find((step) => elapsed >= step.after)?.label || LOADING_STEPS[0].label;
  const expected = hasPhoto ? 55 : 40;
  const progress = Math.min(94, Math.round(12 + (elapsed / expected) * 82));
  const eta = "1 минуту";
  return { elapsed, label, progress, eta };
}

function normalizeAnswer(value: string) { return value.toLocaleLowerCase("ru").replace(/[«»"'.,;:!?\s-]/g, ""); }

function ModeCard({ selected, onClick, icon, title, text }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return <button className={`mode-card ${selected ? "selected" : ""}`} onClick={onClick} role="radio" aria-checked={selected}>{selected && <span className="selected-check"><Check size={13} weight="bold" /></span>}<span className="mode-icon">{icon}</span><strong>{title}</strong><small>{text}</small></button>;
}

function CheckResultScreen({ analysis, onBack, onReset }: { analysis: Analysis | null; onBack: () => void; onReset: () => void }) {
  return <main className="page-shell"><section className="mobile-prototype result-screen"><header className="topbar"><button className="icon-button" onClick={onBack} aria-label="Назад"><ArrowLeft size={22} weight="bold" /></button><Secure /></header><div className="result-heading"><div className="result-icon"><Sparkle size={25} weight="fill" /></div><p className="eyebrow">Проверка решения</p><h1>{analysis?.title || "Вот что стоит проверить"}</h1><p>{analysis?.intro || "Покажите ребёнку место ошибки и предложите исправить самому."}</p></div><div className="check-list"><div className="check-summary"><CheckCircle size={27} weight="fill" /><div><strong>{analysis?.summary || "Что уже сделано хорошо"}</strong><p>{analysis?.steps?.[0]?.text || "Проверьте совпадение условия и первого шага решения."}</p></div></div><div className="issue-box"><span>Обратите внимание</span><strong>{analysis?.issue?.title || "Проверьте ход решения"}</strong><p>{analysis?.issue?.text || "Предложите ребёнку самостоятельно найти место, где изменился ход рассуждения."}</p></div><div className="parent-prompt"><Lightbulb size={22} weight="fill" /><p><strong>Что спросить:</strong> {analysis?.parentQuestion || "Как ты можешь проверить этот шаг другим способом?"}</p></div></div><button className="primary-button compact" onClick={onReset}>Разобрать другое задание <ArrowRight size={20} weight="bold" /></button></section></main>;
}

function normalizeTasks(analysis: Analysis | null): HomeworkTask[] {
  const fallback = fallbackTask();
  const source = analysis?.tasks?.length ? analysis.tasks : [fallback];
  return source.map((task) => ({
    ...fallback,
    ...task,
    title: String(task.title || fallback.title),
    shortTitle: String(task.shortTitle || fallback.shortTitle),
    instruction: String(task.instruction || fallback.instruction),
    simplerInstruction: String(task.simplerInstruction || fallback.simplerInstruction),
    comprehensionQuestion: String(task.comprehensionQuestion || fallback.comprehensionQuestion),
    guidingQuestions: task.guidingQuestions?.length ? task.guidingQuestions.map(String) : fallback.guidingQuestions,
    rule: {
      title: String(task.rule?.title || fallback.rule.title),
      text: String(task.rule?.text || fallback.rule.text),
      kind: task.rule?.kind || fallback.rule.kind,
    },
    ruleExample: task.ruleExample?.display
      ? {
          display: String(task.ruleExample.display),
          explanation: String(task.ruleExample.explanation || ""),
          kind: task.ruleExample.kind,
        }
      : null,
    methodSteps: task.methodSteps?.length ? task.methodSteps.slice(0, 4) : fallback.methodSteps,
    guidedSteps: task.guidedSteps?.length ? task.guidedSteps : fallback.guidedSteps,
    extraGuidedSteps: task.extraGuidedSteps?.length ? task.extraGuidedSteps : [],
    knowledgeAid: task.knowledgeAid || null,
    independentInstruction: String(task.independentInstruction || fallback.independentInstruction),
  }));
}

function fallbackTask(): HomeworkTask {
  return { title: "Разбираем задание", shortTitle: "Выполняем по шагам", instruction: "Прочитай условие и определи, что нужно сделать.", simplerInstruction: "Сначала поймём вопрос задания, затем выполним его по шагам.", comprehensionQuestion: "Что нужно получить в результате?", guidingQuestions: ["Что нужно сделать сначала?", "Что должно получиться в итоге?"], rule: { title: "Сначала пойми условие", kind: "rule", text: "В условии важно отделить известные данные от того, что требуется узнать." }, ruleExample: { display: "Что известно? → Что нужно узнать?", explanation: "Так мы связываем данные задания с его вопросом.", kind: "demo" }, methodSteps: [{ title: "Прочитать" }, { title: "Выбрать способ" }, { title: "Выполнить" }, { title: "Проверить" }], guidedTitle: "Первый шаг", guidedSteps: [{ title: "Начинаем вместе", prompt: "С чего нужно начать?", options: ["Прочитать условие", "Угадать ответ"], correctOption: "Прочитать условие", hint: "Посмотри, что именно спрашивается в задании.", success: "Верно: сначала внимательно читаем условие." }], independentInstruction: "Теперь сделай так же с остальными пунктами. Если забудешь шаг — посмотри в памятку." };
}

function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) return fileToDataUrl(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать фотографию"));
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.onerror = () => resolve(source);
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Не удалось прочитать фотографию")); reader.readAsDataURL(file); }); }
