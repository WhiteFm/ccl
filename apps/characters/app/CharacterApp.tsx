"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { abilityModifier, validatePointBuy, type AbilityId, type AbilityScores } from "./rules";
import en from "./i18n/en.json";
import ru from "./i18n/ru.json";

type Locale = "ru" | "en";
type View = "auth" | "dashboard" | "builder" | "manager";
type TabId = "basic" | "class" | "background" | "abilities" | "equipment" | "spells" | "features";
type ManagerTab = "overview" | "skills" | "equipment" | "spells" | "details";
type ClassId = string;
type Copy = typeof ru;

interface CharacterSlot {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  description: string;
  avatar?: string;
}

interface Draft {
  name: string;
  avatar?: string;
  species: string;
  alignment: string;
  languages: string[];
  description: string;
  classId: string;
  backgroundId: string;
  abilityMethod: "point_buy" | "dice";
  scores: AbilityScores;
  equipment: string[];
  spells: string[];
}

const ABILITIES: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];
const TAB_IDS: TabId[] = ["basic", "class", "background", "abilities", "equipment", "spells", "features"];
const TAB_KEYS: Record<TabId, keyof Copy> = {
  basic: "tabBasic",
  class: "tabClass",
  background: "tabBackground",
  abilities: "tabAbilities",
  equipment: "tabEquipment",
  spells: "tabSpells",
  features: "tabFeatures"
};
const STORAGE = {
  locale: "ccl.locale",
  session: "ccl.session",
  slots: "ccl.character-slots",
  draft: "ccl.character-draft"
};
const INITIAL_DRAFT: Draft = {
  name: "",
  species: "",
  alignment: "",
  languages: [],
  description: "",
  classId: "",
  backgroundId: "",
  abilityMethod: "point_buy",
  scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  equipment: [],
  spells: []
};
const INITIAL_SLOTS: Array<CharacterSlot | null> = [null, null, null];

function loadInitialState() {
  const fallback = {
    locale: "en" as Locale,
    authenticated: false,
    view: "auth" as View,
    slots: INITIAL_SLOTS,
    draft: INITIAL_DRAFT,
  };

  try {
    const savedLocale = localStorage.getItem(STORAGE.locale);
    const authenticated = localStorage.getItem(STORAGE.session) === "true";
    const savedSlots = localStorage.getItem(STORAGE.slots);
    const savedDraft = localStorage.getItem(STORAGE.draft);

    return {
      locale: savedLocale === "ru" || savedLocale === "en" ? savedLocale : fallback.locale,
      authenticated,
      view: authenticated ? "dashboard" as View : fallback.view,
      slots: savedSlots ? JSON.parse(savedSlots) as Array<CharacterSlot | null> : fallback.slots,
      draft: savedDraft ? JSON.parse(savedDraft) as Draft : fallback.draft,
    };
  } catch {
    return fallback;
  }
}

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

function BrandMark() {
  return <img className="brand-mark" src="/ccl-logo.svg" alt="CCL" />;
}

function LanguageSwitch({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return (
    <div className="language-switch" aria-label="Language">
      <button className={locale === "en" ? "active" : ""} onClick={() => onChange("en")} type="button">EN</button>
      <span>/</span>
      <button className={locale === "ru" ? "active" : ""} onClick={() => onChange("ru")} type="button">RU</button>
    </div>
  );
}

function Header({ copy, locale, onLocale, onLogout }: { copy: Copy; locale: Locale; onLocale: (locale: Locale) => void; onLogout: () => void }) {
  return (
    <header className="site-header">
      <div className="page-width header-inner">
        <div className="brand"><BrandMark /><span><strong>{copy.brand}</strong><small>{copy.product}</small></span></div>
        <div className="header-actions">
          <span className="demo-badge">{copy.demo}</span>
          <LanguageSwitch locale={locale} onChange={onLocale} />
          <button className="text-button" onClick={onLogout} type="button">{copy.logout}</button>
        </div>
      </div>
    </header>
  );
}

function SectionIntro({ number, title, lead }: { number: string; title: string; lead: string }) {
  return <div className="section-intro"><p className="eyebrow">{number}</p><h2>{title}</h2><p>{lead}</p></div>;
}

export default function CharacterApp() {
  const [initialState] = useState(loadInitialState);
  const [locale, setLocale] = useState<Locale>(initialState.locale);
  const [view, setView] = useState<View>(initialState.view);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authenticated, setAuthenticated] = useState(initialState.authenticated);
  const [slots, setSlots] = useState<Array<CharacterSlot | null>>(initialState.slots);
  const [slotIndex, setSlotIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialState.draft);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [managerTab, setManagerTab] = useState<ManagerTab>("overview");
  const [rolls, setRolls] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Partial<Record<AbilityId, number>>>({});
  const [selectedRoll, setSelectedRoll] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const copy = (locale === "ru" ? ru : en) as Copy;

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE.locale, locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem(STORAGE.slots, JSON.stringify(slots));
    localStorage.setItem(STORAGE.draft, JSON.stringify(draft));
  }, [draft, slots]);

  const pointBuy = useMemo(() => validatePointBuy(draft.scores), [draft.scores]);
  const abilitiesReady = draft.abilityMethod === "point_buy" ? pointBuy.valid : Object.keys(assignments).length === 6;
  const completion = Math.round(([draft.name.trim(), abilitiesReady].filter(Boolean).length / 2) * 100);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveError(false);
  }

  function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localStorage.setItem(STORAGE.session, "true");
    setAuthenticated(true);
    setView("dashboard");
  }

  function logout() {
    localStorage.removeItem(STORAGE.session);
    setAuthenticated(false);
    setView("auth");
  }

  function startBuilder(index: number) {
    setSlotIndex(index);
    setDraft(INITIAL_DRAFT);
    setAssignments({});
    setRolls([]);
    setActiveTab("basic");
    setView("builder");
  }

  function readPortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update("avatar", String(reader.result));
    reader.readAsDataURL(file);
  }

  function adjustScore(ability: AbilityId, delta: number) {
    const score = draft.scores[ability] + delta;
    if (score < 8 || score > 15) return;
    const candidate = { ...draft.scores, [ability]: score };
    if (!validatePointBuy(candidate).valid) return;
    update("scores", candidate);
  }

  function rollAbilities() {
    setRolls(Array.from({ length: 6 }, () => {
      const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => a - b);
      return dice[1] + dice[2] + dice[3];
    }));
    setAssignments({});
    setSelectedRoll(null);
  }

  function assignRoll(ability: AbilityId, index = selectedRoll) {
    if (index === null || rolls[index] === undefined) return;
    setAssignments((current) => {
      const next = { ...current };
      ABILITIES.forEach((id) => {
        if (next[id] === index) delete next[id];
      });
      next[ability] = index;
      return next;
    });
    setSelectedRoll(null);
  }

  function saveCharacter() {
    if (!draft.name.trim() || !abilitiesReady) {
      setSaveError(true);
      return;
    }
    const next = [...slots];
    next[slotIndex] = {
      id: "character-" + Date.now(),
      name: draft.name.trim(),
      classId: draft.classId,
      level: 1,
      description: draft.description,
      avatar: draft.avatar
    };
    setSlots(next);
    setManagerTab("overview");
    setView("manager");
  }

  function nextTab() {
    const index = TAB_IDS.indexOf(activeTab);
    if (index === TAB_IDS.length - 1) saveCharacter();
    else setActiveTab(TAB_IDS[index + 1]);
  }

  const className = (id: ClassId) => id || "—";

  if (!authenticated || view === "auth") {
    return (
      <main className="auth-shell">
        <section className="auth-story">
          <div className="auth-top">
            <div className="brand"><BrandMark /><span><strong>{copy.brand}</strong><small>{copy.product}</small></span></div>
            <LanguageSwitch locale={locale} onChange={setLocale} />
          </div>
          <div className="story-copy">
            <p className="eyebrow">{copy.authEyebrow}</p>
            <h1>{copy.authTitle}</h1>
            <p className="lead">{copy.authLead}</p>
            <div className="feature-list">
              {[copy.feature1, copy.feature2, copy.feature3].map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}
            </div>
          </div>
          <span className="edition">{copy.edition}</span>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-tabs">
              <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")} type="button">{copy.signin}</button>
              <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")} type="button">{copy.signup}</button>
            </div>
            <p className="eyebrow">{copy.demo}</p>
            <h2>{copy.welcome}</h2>
            <p className="muted">{copy.welcomeLead}</p>
            <form onSubmit={submitAuth}>
              <label><span>{copy.email}</span><input autoComplete="email" placeholder={copy.emailPlaceholder} required type="email" /></label>
              <label><span>{copy.password}</span><input autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={8} placeholder={copy.passwordPlaceholder} required type="password" /></label>
              <button className="primary-button" type="submit">{authMode === "signin" ? copy.signInAction : copy.signUpAction}<span>→</span></button>
            </form>
            <p className="legal">{copy.localAuth}</p>
          </div>
        </section>
      </main>
    );
  }

  if (view === "dashboard") {
    const used = slots.filter(Boolean).length;
    return (
      <main className="site-shell">
        <Header copy={copy} locale={locale} onLocale={setLocale} onLogout={logout} />
        <section className="page-width dashboard-hero">
          <div><p className="eyebrow">{copy.dashboardEyebrow}</p><h1>{copy.dashboardTitle}</h1><p className="lead">{copy.dashboardLead}</p></div>
          <div className="slot-meter"><span>{copy.slotsUsed}</span><strong>{used}<small>/3</small></strong><div className="meter"><i style={{ width: String(used / 3 * 100) + "%" }} /></div></div>
        </section>
        <section className="page-width character-grid">
          {slots.map((slot, index) => slot ? (
            <article className="character-card filled" key={slot.id}>
              <span className="card-index">0{index + 1}</span>
              <div className="portrait">{slot.avatar ? <img alt="" src={slot.avatar} /> : slot.name.slice(0, 1)}</div>
              <span className="status"><i />{copy.level} {slot.level}</span>
              <h2>{slot.name}</h2>
              <p className="class-label">{className(slot.classId)}</p>
              <p className="muted">{slot.description}</p>
              <button className="card-button" onClick={() => { setSlotIndex(index); setManagerTab("overview"); setView("manager"); }} type="button">{copy.open}<span>↗</span></button>
            </article>
          ) : (
            <article className="character-card empty" key={"empty-" + index}>
              <span className="card-index">0{index + 1}</span>
              <button onClick={() => startBuilder(index)} type="button"><span className="plus">+</span><strong>{copy.create}</strong><small>{copy.emptyLead}</small></button>
            </article>
          ))}
          <article className="more-card"><span>◇</span><div><p className="eyebrow">{copy.moreSlots}</p><h3>{copy.moreSlots}</h3><p>{copy.moreSlotsLead}</p></div></article>
        </section>
      </main>
    );
  }

  if (view === "manager") {
    const character = slots[slotIndex] || { id: "draft", name: draft.name, classId: draft.classId, level: 1, description: draft.description, avatar: draft.avatar };
    const managerTabs: ManagerTab[] = ["overview", "skills", "equipment", "spells", "details"];
    return (
      <main className="site-shell">
        <Header copy={copy} locale={locale} onLocale={setLocale} onLogout={logout} />
        <section className="page-width manager-hero">
          <button className="text-button" onClick={() => setView("dashboard")} type="button">← {copy.managerBack}</button>
          <div className="manager-id"><div className="manager-avatar">{character.avatar ? <img alt="" src={character.avatar} /> : character.name.slice(0, 1)}</div><div><p className="eyebrow">{copy.level} {character.level} · {className(character.classId)}</p><h1>{character.name}</h1><p>{character.description}</p></div></div>
        </section>
        <nav className="page-width manager-tabs">{managerTabs.map((tab) => <button className={managerTab === tab ? "active" : ""} key={tab} onClick={() => setManagerTab(tab)} type="button">{copy[tab]}</button>)}</nav>
        <section className="page-width manager-content">
          <div className="placeholder"><p className="eyebrow">{copy[managerTab]}</p><h2>{copy[managerTab]}</h2><p>{copy.managerNote}</p></div>
        </section>
      </main>
    );
  }

  const currentTabIndex = TAB_IDS.indexOf(activeTab);
  return (
    <main className="builder-shell">
      <Header copy={copy} locale={locale} onLocale={setLocale} onLogout={logout} />
      <section className="page-width builder-head">
        <div><button className="text-button" onClick={() => setView("dashboard")} type="button">← {copy.back}</button><p className="eyebrow">{copy.builderEyebrow}</p><h1>{draft.name || copy.newHero}</h1><p className="level-note"><b>1</b>{copy.levelNote}</p></div>
        <div className="completion"><span>{copy.completion}</span><strong>{completion}%</strong><div className="meter"><i style={{ width: String(completion) + "%" }} /></div><small>✓ {copy.draftSaved}</small></div>
      </section>
      <div className="page-width builder-layout">
        <nav className="builder-tabs">
          {TAB_IDS.map((tab, index) => <button className={cx(tab === activeTab && "active", index < currentTabIndex && "complete")} key={tab} onClick={() => setActiveTab(tab)} type="button"><span>{index < currentTabIndex ? "✓" : "0" + (index + 1)}</span>{copy[TAB_KEYS[tab]]}</button>)}
        </nav>
        <section className="builder-card">
          {renderTab()}
          {saveError && <p className="form-error" role="alert">{copy.saveError}</p>}
          <div className="builder-actions">
            <button className="secondary-button" onClick={() => currentTabIndex ? setActiveTab(TAB_IDS[currentTabIndex - 1]) : setView("dashboard")} type="button">← {copy.back}</button>
            <button className="primary-button" onClick={nextTab} type="button">{activeTab === "features" ? copy.save : copy.next}<span>→</span></button>
          </div>
        </section>
      </div>
    </main>
  );

  function renderTab() {
    if (activeTab === "basic") {
      return (
        <>
          <SectionIntro number="01" title={copy.basicTitle} lead={copy.basicLead} />
          <div className="basic-grid">
            <div className="portrait-upload">
              <div className="portrait large">{draft.avatar ? <img alt="" src={draft.avatar} /> : draft.name.slice(0, 1) || "?"}</div>
              <label className="upload"><input accept="image/png,image/jpeg" onChange={readPortrait} type="file" /><span>{copy.upload}</span></label><small>{copy.uploadHint}</small>
            </div>
            <div className="form-grid">
              <label className="field wide"><span>{copy.name}</span><input onChange={(event) => update("name", event.target.value)} placeholder={copy.namePlaceholder} value={draft.name} /></label>
              <label className="field wide"><span>{copy.description}</span><textarea onChange={(event) => update("description", event.target.value)} placeholder={copy.descriptionPlaceholder} rows={5} value={draft.description} /></label>
              <div className="notice field wide"><span>!</span><div><strong>{copy.product}</strong><p>{copy.contentMissing}</p></div></div>
            </div>
          </div>
        </>
      );
    }

    if (activeTab === "abilities") {
      return (
        <>
          <SectionIntro number="04" title={copy.abilitiesTitle} lead={copy.abilitiesLead} />
          <div className="segmented"><button className={draft.abilityMethod === "point_buy" ? "active" : ""} onClick={() => update("abilityMethod", "point_buy")} type="button">{copy.pointBuy}</button><button className={draft.abilityMethod === "dice" ? "active" : ""} onClick={() => update("abilityMethod", "dice")} type="button">{copy.dice}</button></div>
          {draft.abilityMethod === "point_buy" ? <><div className="budget"><span>{copy.pointsLeft}</span><strong>{pointBuy.remaining}</strong><small>/ 27</small></div><div className="ability-grid">{ABILITIES.map((ability) => <article className="ability-card" key={ability}><small>{ability.toUpperCase()}</small><h3>{copy[ability]}</h3><div><button onClick={() => adjustScore(ability, -1)} type="button">−</button><strong>{draft.scores[ability]}</strong><button onClick={() => adjustScore(ability, 1)} type="button">+</button></div><em>{abilityModifier(draft.scores[ability]) >= 0 ? "+" : ""}{abilityModifier(draft.scores[ability])}</em></article>)}</div></> : <>
            <div className="roll-toolbar"><button className="secondary-button" onClick={rollAbilities} type="button">⚄ {copy.roll}</button><p>{copy.rollHint}</p></div>
            {rolls.length > 0 && <div className="roll-results">{rolls.map((value, index) => { const assigned = ABILITIES.find((ability) => assignments[ability] === index); return <button className={cx(selectedRoll === index && "selected", assigned && "assigned")} draggable key={"roll-" + index} onClick={() => setSelectedRoll(selectedRoll === index ? null : index)} onDragStart={(event: DragEvent<HTMLButtonElement>) => event.dataTransfer.setData("text/plain", String(index))} type="button"><small>4d6</small><strong>{value}</strong><span>{assigned ? copy[assigned] : copy.unassigned}</span></button>; })}</div>}
            <div className="ability-grid targets">{ABILITIES.map((ability) => { const rollIndex = assignments[ability]; return <button className={cx("ability-card", selectedRoll !== null && "ready")} key={ability} onClick={() => assignRoll(ability)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); assignRoll(ability, Number(event.dataTransfer.getData("text/plain"))); }} type="button"><small>{ability.toUpperCase()}</small><h3>{copy[ability]}</h3><b>{rollIndex === undefined ? "—" : rolls[rollIndex]}</b></button>; })}</div>
          </>}
        </>
      );
    }

    const emptyTitles = {
      class: ["02", copy.classTitle, copy.classLead],
      background: ["03", copy.backgroundTitle, copy.backgroundLead],
      equipment: ["05", copy.equipmentTitle, copy.equipmentLead],
      spells: ["06", copy.spellsTitle, copy.spellsLead],
      features: ["07", copy.featuresTitle, copy.featuresLead]
    } as const;
    const [number, title, lead] = emptyTitles[activeTab as keyof typeof emptyTitles];
    return <><SectionIntro number={number} title={title} lead={lead} /><div className="empty-state"><span>◇</span><p>{copy.contentMissing}</p></div></>;
  }
}
