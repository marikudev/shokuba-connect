"use client";

import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_PANEL_LANGS,
  loadSessionDraft,
  storeSessionDraft,
  type CardSource,
  type PanelCount,
  type PanelLangSelection,
  type PanelLangs,
} from "@/lib/cards";

// useEditorDraft — everything the operator is currently typing
// and choosing, and its per-tab persistence.
//
// Extracted from app/page.tsx in the refactor; the
// behaviour is unchanged.
//
// The draft (input text, division, topic, chosen model, panel
// count and panel languages, active card slot) is stored in
// sessionStorage: it survives a refresh in the same tab, and it
// is deliberately NOT shared between tabs — two tabs are two
// work surfaces, unlike the cards, which are shared property.
// The hook owns the load-on-mount, the save-on-change, and the
// small guards that keep those two from fighting:
//   - nothing is stored before the initial load has run (an
//     early save would overwrite the stored draft with the
//     initial empty state);
//   - after a session delete, exactly one save is suppressed,
//     because the delete's state resets would otherwise
//     immediately re-store an empty draft and undo the wipe.
export function useEditorDraft() {
  const [text, setText] = useState("");
  const [division, setDivision] = useState("");
  const [topic, setTopic] = useState("");
  // "" means no model chosen yet: the picker starts on
  // 言語モデルを選択 and every translate action stays disabled
  // until the operator picks one, so tokens cannot
  // be spent by an accidental click on a preselected model.
  const [model, setModel] = useState<string>("");
  // The industry choice : "" until the operator picks
  // one in the context bar; translation stays disabled while "".
  const [industry, setIndustry] = useState<string>("");
  const [panelCount, setPanelCount] = useState<PanelCount>(2);
  const [panelLangs, setPanelLangs] = useState<PanelLangs>([
    ...DEFAULT_PANEL_LANGS,
  ]);
  // Display mode: true hides the input column and leaves the
  // card rail beside the panels. Stored with the draft, so a
  // refresh mid-chourei keeps the chosen mode.
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  // The newest editor source, mirrored into a ref so an
  // in-flight translation response can tell whether its input
  // is still current (results for a changed input are
  // discarded). A ref, not state, because the check happens
  // inside an async continuation, long after the render that
  // started the request.
  const sourceRef = useRef<CardSource>({ text: "", division: "", topic: "" });
  useEffect(() => {
    sourceRef.current = { text, division, topic };
  }, [text, division, topic]);

  // The active slot, mirrored for the same reason: the
  // translation pipeline reads it when a response lands, not
  // when the click happened.
  const activeSlotRef = useRef<number | null>(null);
  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  // After a session delete, the state resets below would
  // immediately re-store an empty draft; this flag makes the
  // draft effect skip exactly that one write, so the delete
  // really removes every key.
  const suppressNextStoreRef = useRef(false);
  const suppressNextStore = () => {
    suppressNextStoreRef.current = true;
  };

  // Load the stored draft once, on mount. Reading
  // storage is an external-system sync, hence the scoped lint
  // disable (same pattern as the other storage hooks).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const draft = loadSessionDraft(window.sessionStorage);
    if (draft) {
      setText(draft.text);
      setDivision(draft.division);
      setTopic(draft.topic);
      setActiveSlot(draft.activeSlot);
      setPanelCount(draft.panelCount);
      setPanelLangs(draft.panelLangs);
      setModel(draft.model);
      setIndustry(draft.industry);
      setSidebarHidden(draft.sidebarHidden);
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist the draft and panel choices whenever they change —
  // but never before the load above has run, and never for the
  // one reset that follows a session delete.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (suppressNextStoreRef.current) {
      suppressNextStoreRef.current = false;
      return;
    }
    storeSessionDraft(window.sessionStorage, {
      text,
      division,
      topic,
      activeSlot,
      panelCount,
      panelLangs,
      model,
      industry,
      sidebarHidden,
    });
  }, [
    ready,
    text,
    division,
    topic,
    activeSlot,
    panelCount,
    panelLangs,
    model,
    industry,
    sidebarHidden,
  ]);

  // Changing a panel's dropdown never calls the
  // API. The stored triple stays distinct among chosen
  // languages: if the chosen language sits in another slot, the
  // two slots swap. Choosing 言語を選択 ("") simply clears the
  // slot.
  const handlePanelLanguageChange = (
    panelIndex: number,
    code: PanelLangSelection,
  ) => {
    setPanelLangs((previous) => {
      const next: PanelLangs = [...previous];
      if (code !== "") {
        const conflict = next.indexOf(code);
        if (conflict !== -1 && conflict !== panelIndex) {
          next[conflict] = next[panelIndex];
        }
      }
      next[panelIndex] = code;
      return next;
    });
  };

  // Session-delete support: back to a blank work surface (the page wipes
  // the underlying storage itself).
  const reset = () => {
    setText("");
    setDivision("");
    setTopic("");
    setActiveSlot(null);
    setModel("");
    setIndustry("");
    setPanelCount(2);
    setPanelLangs([...DEFAULT_PANEL_LANGS]);
    setSidebarHidden(false);
  };

  return {
    text,
    setText,
    division,
    setDivision,
    topic,
    setTopic,
    model,
    setModel,
    industry,
    setIndustry,
    panelCount,
    setPanelCount,
    panelLangs,
    setPanelLangs,
    sidebarHidden,
    setSidebarHidden,
    handlePanelLanguageChange,
    activeSlot,
    setActiveSlot,
    activeSlotRef,
    sourceRef,
    ready,
    suppressNextStore,
    reset,
  };
}
