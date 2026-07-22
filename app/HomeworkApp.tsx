"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Camera, ChatCircleDots, Check, CheckCircle, FileImage,
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

  async function analyzeHomework(nextMode: Mode) {
    if (!hasTask) { setShowText(true); setTask(SAMPLE_TASK); return; }
    setLoading(true); setError("");
    try {
      const image = file ? await fileToCompressedDataUrl(file) : null;
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode, task: task.trim(), image }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось разобрать задание");
      setAnalysis(data.analysis); setCurrentTask(0); setCompletedTasks([]);
      setMode(nextMode);
      if (nextMode === "check") setScreen("result");
      else {
        const nextTasks = normalizeTasks(data.analysis);
        setScreen(nextTasks.length === 1 ? "learn" : "tasks");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось разобрать задание");
    } finally { setLoading(false); }
  }

  function begin() {
    void analyzeHomework(mode);
  }

  function checkFinishedWork() {
    setScreen("start");
    void analyzeHomework("check");
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
    return (
      <LearningFlow
        task={task}
        taskIndex={currentTask}
        taskCount={tasks.length}
        preview={preview}
        onBack={() => setScreen(tasks.length > 1 ? "tasks" : "start")}
        onMarkComplete={() => { setCompletedTasks((items) => items.includes(currentTask) ? items : [...items, currentTask]); }}
        onLeave={() => setScreen(tasks.length > 1 ? "tasks" : "start")}
        onCheckWork={checkFinishedWork}
      />
    );
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
        <ModeCard selected={mode === "explain"} onClick={() => !loading && setMode("explain")} icon={<Lightbulb size={31} />} title="Объяснить" text="Задание → первый пункт вместе → дальше сам" />
        <ModeCard selected={mode === "check"} onClick={() => !loading && setMode("check")} icon={<MagnifyingGlass size={31} />} title="Проверить решение" text="Разберём ошибки и поможем исправить самому" />
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
    <p className="flow-note"><Sparkle size={16} /> Задание → вместе первый пункт → остальные сам</p>
  </FlowShell>;
}

function LearningFlow({
  task,
  taskIndex,
  taskCount,
  preview,
  onBack,
  onMarkComplete,
  onLeave,
  onCheckWork,
}: {
  task: HomeworkTask;
  taskIndex: number;
  taskCount: number;
  preview: string;
  onBack: () => void;
  onMarkComplete: () => void;
  onLeave: () => void;
  onCheckWork: () => void;
}) {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<"" | "hint" | "correct" | "wrong">("");
  const [supportsUnlocked, setSupportsUnlocked] = useState(false);
  const [aidOpen, setAidOpen] = useState(false);
  const [practiceRound, setPracticeRound] = useState<1 | 2>(1);
  const [wrapUp, setWrapUp] = useState(false);
  const activeGuidedSteps = practiceRound === 2 && task.extraGuidedSteps?.length ? task.extraGuidedSteps : task.guidedSteps;
  const guided = activeGuidedSteps[guidedIndex] || activeGuidedSteps[0];

  function resetStepState() {
    setSelected("");
    setTypedAnswer("");
    setFeedback("");
  }

  function nextGuided() {
    if (guidedIndex < activeGuidedSteps.length - 1) {
      setGuidedIndex((v) => v + 1);
      resetStepState();
    } else setStage(3);
  }

  function startAnotherTogether() {
    setPracticeRound(2);
    setStage(2);
    setGuidedIndex(0);
    setSupportsUnlocked(false);
    setWrapUp(false);
    resetStepState();
  }

  function finishAlone() {
    onMarkComplete();
    setWrapUp(true);
  }

  return <FlowShell onBack={onBack}>
    <div className="flow-body">
      <TaskContext task={task} index={taskIndex} count={taskCount} preview={preview} />
      <Route stage={stage} />
      {stage === 1 && <StageOne task={task} onNext={() => setStage(2)} />}
      {stage === 2 && (
        <StageTogether
          task={task}
          practiceRound={practiceRound}
          guided={guided}
          guidedIndex={guidedIndex}
          guidedCount={activeGuidedSteps.length}
          selected={selected}
          typedAnswer={typedAnswer}
          feedback={feedback}
          supportsUnlocked={supportsUnlocked}
          onSelect={setSelected}
          onTypedAnswer={setTypedAnswer}
          onFeedback={setFeedback}
          onUnlockSupports={() => setSupportsUnlocked(true)}
          onBack={() => setStage(1)}
          onNext={nextGuided}
        />
      )}
      {stage === 3 && (
        <StageAlone
          task={task}
          taskCount={taskCount}
          practiceRound={practiceRound}
          wrapUp={wrapUp}
          aidOpen={aidOpen}
          onAidOpenChange={setAidOpen}
          onFinish={finishAlone}
          onCheckWork={onCheckWork}
          onLeave={onLeave}
          onAnotherTogether={startAnotherTogether}
        />
      )}
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
        <h1>Поймём задание</h1>
        {phase === "check" ? (
          <div className="parent-actions">
            <div className="parent-action">
              <div className="parent-action-head">
                <BookOpen size={22} weight="regular" />
                <p>Попросите ребёнка прочитать инструкцию из учебника.</p>
              </div>
              <div className="instruction-quote focus-block">
                <InstructionText text={task.instruction} />
              </div>
            </div>
            <div className="parent-action">
              <div className="parent-action-head">
                <ChatCircleDots size={22} weight="regular" />
                <p>Попросите пересказать своими словами, что нужно сделать.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="stage-subtitle">Уточним, что ребёнок понял</p>
            <div className="instruction-quote focus-block compact">
              <InstructionText text={task.instruction} />
            </div>
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
          </>
        )}
      </div>
      <div className="stage-actions">
        {phase === "check" && (
          <>
            <button className="primary-button flow-primary" onClick={onNext}>Начать первый пункт <ArrowRight size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={() => setPhase("guide")}>Не понял — помочь вопросами</button>
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
            <button className="primary-button flow-primary" onClick={onNext}>Начать первый пункт <ArrowRight size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={() => setPhase("fallback")}>Всё ещё непонятно</button>
          </>
        )}
        {phase === "fallback" && (
          <>
            <button className="primary-button flow-primary" onClick={onNext}>Начать первый пункт <ArrowRight size={20} weight="bold" /></button>
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

function StageTogether({
  task,
  practiceRound,
  guided,
  guidedIndex,
  guidedCount,
  selected,
  typedAnswer,
  feedback,
  supportsUnlocked,
  onSelect,
  onTypedAnswer,
  onFeedback,
  onUnlockSupports,
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
  supportsUnlocked: boolean;
  onSelect: (option: string) => void;
  onTypedAnswer: (value: string) => void;
  onFeedback: (value: "" | "hint" | "correct" | "wrong") => void;
  onUnlockSupports: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const example = task.ruleExample?.display?.trim() ? task.ruleExample : null;
  const requiredAid = task.knowledgeAid?.required ? task.knowledgeAid : null;
  const hasOptions = Boolean(guided.options?.length);
  const isText = guided.answerType === "text" && Boolean(guided.acceptableAnswers?.length);
  const showMethod = Boolean(task.methodSteps?.length);

  function evaluate(option?: string, typed?: string) {
    const correct = hasOptions
      ? (option ?? selected) === guided.correctOption
      : guided.acceptableAnswers?.some((answer) => normalizeAnswer(answer) === normalizeAnswer(typed ?? typedAnswer));
    if (!correct) onUnlockSupports();
    onFeedback(correct ? "correct" : "wrong");
  }

  function askHint() {
    onUnlockSupports();
    onFeedback("hint");
  }

  function markSpokenDone() {
    onFeedback("correct");
  }

  function chooseOption(option: string) {
    onSelect(option);
    evaluate(option);
  }

  function submitTyped() {
    if (!typedAnswer.trim()) return;
    evaluate(undefined, typedAnswer);
  }

  return (
    <section className="stage-content together-stage">
      <div className="stage-main">
        <h1>{practiceRound === 2 ? "Ещё один пункт вместе" : "Первый пункт вместе"}</h1>
        <p className="stage-subtitle">Пусть ребёнок попробует. Подсказка откроет правило и порядок действий.</p>

        <div className="together-card">
          {guided.display && <p className="together-display">{guided.display}</p>}
          <div className="together-ask">
            <ChatCircleDots size={22} weight="regular" />
            <p>{guided.prompt}</p>
          </div>

          {hasOptions && (
            <div className="answer-grid together-options">
              {guided.options!.map((option) => (
                <button
                  key={option}
                  className={selected === option ? `selected ${feedback === "correct" ? "is-correct" : feedback === "wrong" ? "is-wrong" : ""}` : ""}
                  onClick={() => chooseOption(option)}
                  disabled={feedback === "correct"}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {feedback === "hint" && (
            <div className="together-feedback hint">
              <strong>Подсказка</strong>
              <p>{guided.hint}</p>
            </div>
          )}
          {feedback === "wrong" && (
            <div className="together-feedback wrong">
              <strong>Не торопимся</strong>
              <p>{guided.hint}</p>
            </div>
          )}
          {feedback === "correct" && (
            <div className="together-feedback correct">
              <strong>Отлично</strong>
              <p>{guided.success}</p>
            </div>
          )}

          {supportsUnlocked && (
            <div className="together-support">
              <span className="rule-kicker">Правило</span>
              <p className="rule-text">{task.rule.text}</p>
              {example && (
                <div className="rule-example-box">
                  <span>Пример</span>
                  <strong>{example.display}</strong>
                  {example.explanation?.trim() && <p>{example.explanation}</p>}
                </div>
              )}
              {showMethod && (
                <>
                  <span className="rule-kicker support-method-kicker">Порядок</span>
                  <MethodTrail steps={task.methodSteps} active={-1} />
                </>
              )}
              {requiredAid && <div className="knowledge-required"><KnowledgeAidBody aid={requiredAid} /></div>}
            </div>
          )}

          {isText && typeOpen && feedback !== "correct" && (
            <label className="answer-input">
              <span>Короткий ответ</span>
              <input
                value={typedAnswer}
                onChange={(event) => { onTypedAnswer(event.target.value); if (feedback && feedback !== "hint") onFeedback(""); }}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitTyped(); } }}
                placeholder="Например: о или сторож"
                autoComplete="off"
              />
            </label>
          )}
        </div>
      </div>
      <div className="stage-actions">
        {feedback === "correct" ? (
          <button className="primary-button flow-primary" onClick={onNext}>
            {guidedIndex < guidedCount - 1 ? "Дальше" : "Теперь сам"} <ArrowRight size={20} weight="bold" />
          </button>
        ) : (
          <>
            <button className="primary-button flow-primary" onClick={markSpokenDone}>Ребёнок ответил вслух</button>
            <button className="secondary-button flow-secondary" onClick={askHint}><Lightbulb size={18} /> Нужна подсказка</button>
            {isText && (
              typeOpen
                ? <button className="secondary-button flow-secondary" disabled={!typedAnswer.trim()} onClick={submitTyped}>Проверить написанное</button>
                : <button className="text-link flow-skip" onClick={() => setTypeOpen(true)}>Ввести короткий ответ</button>
            )}
            {feedback === "wrong" && (
              <button className="text-link parent-override" onClick={() => onFeedback("correct")}>
                Ответ всё же верный
              </button>
            )}
          </>
        )}
        <button className="text-link flow-back" onClick={onBack}>К заданию</button>
      </div>
    </section>
  );
}

function StageAlone({
  task,
  taskCount,
  practiceRound,
  wrapUp,
  aidOpen,
  onAidOpenChange,
  onFinish,
  onCheckWork,
  onLeave,
  onAnotherTogether,
}: {
  task: HomeworkTask;
  taskCount: number;
  practiceRound: 1 | 2;
  wrapUp: boolean;
  aidOpen: boolean;
  onAidOpenChange: (open: boolean) => void;
  onFinish: () => void;
  onCheckWork: () => void;
  onLeave: () => void;
  onAnotherTogether: () => void;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const tip = task.guidedSteps[0]?.hint || task.rule.text;

  return (
    <section className="stage-content independent-stage">
      <div className="stage-main">
        <h1>Теперь сам</h1>
        <p className="stage-subtitle">Памятка рядом — родитель может отойти</p>
        <div className="independent-material focus-block">
          <span className="rule-kicker">Скажите ребёнку</span>
          <div className="practice-quote-box">
            <p className="independent-speech">{task.independentInstruction}</p>
          </div>
        </div>
        <div className="alone-memo">
          <span className="rule-kicker">Памятка</span>
          <div className="alone-memo-body">
            <span className="memory-section-label">Правило</span>
            <p className="rule-text">{task.rule.text}</p>
            <span className="memory-section-label memory-rule-label">Порядок действий</span>
            <MethodGuide task={task} compact />
            <button className="secondary-button alone-hint-button" onClick={() => setHintOpen((open) => !open)}>
              <Lightbulb size={18} /> {hintOpen ? "Скрыть подсказку" : "Нужна подсказка"}
            </button>
            {hintOpen && <p className="alone-hint-text">{tip}</p>}
          </div>
        </div>
        {task.knowledgeAid && <KnowledgeAid aid={task.knowledgeAid} open={aidOpen} onOpenChange={onAidOpenChange} />}
      </div>
      <div className="stage-actions">
        {!wrapUp ? (
          <>
            <button className="primary-button flow-primary" onClick={onFinish}>Ребёнок закончил <ArrowRight size={20} weight="bold" /></button>
            {practiceRound === 1 && Boolean(task.extraGuidedSteps?.length) && (
              <button className="secondary-button flow-secondary" onClick={onAnotherTogether}>Разобрать ещё один пункт вместе</button>
            )}
          </>
        ) : (
          <>
            <button className="primary-button flow-primary" onClick={onCheckWork}>Проверить работу <MagnifyingGlass size={20} weight="bold" /></button>
            <button className="secondary-button flow-secondary" onClick={onLeave}>{taskCount > 1 ? "К списку заданий" : "На главную"}</button>
          </>
        )}
      </div>
    </section>
  );
}

function GuidedProgress({ index, count, title }: { index: number; count: number; title: string }) {
  if (count <= 1) return null;
  return (
    <div className="guided-progress">
      <div className="guided-progress-head">
        <span>Шаг {index + 1} из {count}</span>
        <small>{title}</small>
      </div>
      <div className="guided-progress-bar" aria-hidden="true">
        {Array.from({ length: count }, (_, step) => (
          <span key={step} className={step === index ? "active" : step < index ? "done" : ""} />
        ))}
      </div>
    </div>
  );
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
  const labels = ["Задание", "Вместе", "Сам"];
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
  return source.map((task) => {
    const guidedSteps = task.guidedSteps?.length ? task.guidedSteps : fallback.guidedSteps;
    const extraGuidedSteps = task.extraGuidedSteps?.length ? task.extraGuidedSteps : [];
    const methodSource = task.methodSteps?.length ? task.methodSteps.slice(0, 4) : fallback.methodSteps;
    const blankVisible = hasVisibleBlankText(task.instruction)
      || guidedSteps.some((step) => hasVisibleBlankText(step.display))
      || extraGuidedSteps.some((step) => hasVisibleBlankText(step.display));
    const objectVisible = guidedSteps.some((step) => hasVisibleWorkObjectText(step.display))
      || extraGuidedSteps.some((step) => hasVisibleWorkObjectText(step.display));
    const methodFiltered = (blankVisible || objectVisible)
      ? methodSource.filter((step) => !isEmptyRitualStepText(step.title, step.text, { blankVisible, objectVisible: objectVisible || blankVisible }))
      : methodSource;
    return {
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
      methodSteps: repairMethodStepsClient(methodFiltered.length ? methodFiltered : methodSource, {
        instruction: String(task.instruction || ""),
        guidedSteps,
        ruleText: String(task.rule?.text || ""),
      }),
      guidedSteps: repairGuidedStepsClient(stripRitualClientSteps(guidedSteps)),
      extraGuidedSteps: repairGuidedStepsClient(stripRitualClientSteps(extraGuidedSteps)),
      knowledgeAid: task.knowledgeAid || null,
      independentInstruction: String(task.independentInstruction || fallback.independentInstruction),
    };
  });
}

function hasVisibleBlankText(value?: string) {
  return /(?:[A-Za-zА-Яа-яЁё]\s*[_.…⋯]|\b_{2,}\b|\.{3,}|…)/.test(String(value || ""));
}

function hasVisibleWorkObjectText(value?: string) {
  return String(value || "").trim().length >= 2;
}

function isFindBlankStepText(title?: string, prompt?: string) {
  const text = `${title || ""} ${prompt || ""}`.toLocaleLowerCase("ru");
  return /(?:най(?:ти|ди)|находить|определ(?:и|ить)|покаж(?:и|ить)|отыщ(?:и|ить))\s+(?:место\s+)?(?:пропуск|пропущ)/i.test(text)
    || /где\s+(?:в\s+слове\s+)?(?:стоит\s+)?пропуск/i.test(text)
    || /место\s+пропуск/i.test(text);
}

function isEmptyRitualStepText(title?: string, prompt?: string, flags: { blankVisible?: boolean; objectVisible?: boolean } = {}) {
  const text = `${title || ""} ${prompt || ""}`.toLocaleLowerCase("ru");
  const titleOnly = String(title || "").trim().toLocaleLowerCase("ru");
  if (flags.blankVisible && isFindBlankStepText(title, prompt)) return true;
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

function stripRitualClientSteps<T extends GuidedStep>(steps: T[]) {
  if (!steps?.length) return steps;
  const cleaned = steps.filter((step) => {
    const objectVisible = hasVisibleWorkObjectText(step.display);
    const blankVisible = hasVisibleBlankText(step.display);
    if (!objectVisible && !blankVisible) return true;
    return !isEmptyRitualStepText(step.title, step.prompt, { blankVisible, objectVisible: objectVisible || blankVisible });
  });
  return cleaned.length ? cleaned : steps;
}

function guidedBlob(step: GuidedStep) {
  return `${step.title || ""} ${step.prompt || ""} ${step.display || ""}`.toLocaleLowerCase("ru");
}

function isLetterInsertGuided(step: GuidedStep) {
  return /(?:встав|вставь|букв|гласн|в\s+пропуск)/i.test(guidedBlob(step)) && !/проверочн/i.test(guidedBlob(step));
}

function isCheckWordGuided(step: GuidedStep) {
  return /проверочн|ударен/i.test(guidedBlob(step));
}

function repairGuidedStepsClient(steps: GuidedStep[]) {
  if (!steps?.length) return steps;
  if (steps.length === 1) {
    const step = steps[0];
    if (isLetterInsertGuided(step) && hasVisibleBlankText(step.display)) {
      return [{
        ...step,
        title: "Первый пункт",
        prompt: "Какое проверочное слово подойдёт и какую букву вставим?",
        answerType: "spoken" as const,
        options: undefined,
        correctOption: undefined,
      }];
    }
    return steps;
  }

  const hasCheckChain = steps.some(isLetterInsertGuided) && steps.some(isCheckWordGuided);
  const blankDisplay = steps.find((step) => hasVisibleBlankText(step.display))?.display
    || steps.find((step) => step.display?.trim())?.display
    || "";
  const letter = steps.find(isLetterInsertGuided);
  const check = steps.find(isCheckWordGuided) || steps[steps.length - 1];

  if (hasCheckChain || steps.length > 1) {
    return [{
      title: "Первый пункт",
      display: blankDisplay,
      prompt: hasCheckChain
        ? "Какое проверочное слово подойдёт и какую букву вставим?"
        : String(steps[0].prompt || "Что ответим в этом пункте?"),
      answerType: "spoken" as const,
      hint: check?.hint || letter?.hint || "Сначала подбери проверочное слово, где нужная гласная под ударением.",
      success: check?.success || letter?.success || "Верно: сначала проверка, потом буква.",
    }];
  }
  return steps;
}

function repairMethodStepsClient(
  methodSteps: Array<{ title: string; text?: string }>,
  context: { instruction: string; guidedSteps: GuidedStep[]; ruleText: string },
) {
  const blankVisible = hasVisibleBlankText(context.instruction)
    || context.guidedSteps.some((step) => hasVisibleBlankText(step.display));
  const blob = `${methodSteps.map((step) => `${step.title} ${step.text || ""}`).join(" ")} ${context.ruleText}`.toLocaleLowerCase("ru");
  if (!blankVisible || !/провероч|ударен|безудар|букв/.test(blob)) return methodSteps;

  const titles = methodSteps.map((step) => step.title.toLocaleLowerCase("ru"));
  const letterIndex = titles.findIndex((title) => /букв|встав/.test(title) && !/провероч/.test(title));
  const checkIndex = titles.findIndex((title) => /провероч|ударен/.test(title));
  const broken = (letterIndex >= 0 && checkIndex >= 0 && letterIndex < checkIndex)
    || (letterIndex === 0 && checkIndex < 0)
    || !methodSteps.length;
  if (!broken) return methodSteps;
  return [
    { title: "Подбери проверочное слово" },
    { title: "Поставь ударение" },
    { title: "Вставь букву" },
  ];
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
