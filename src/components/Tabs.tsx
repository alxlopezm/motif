'use client';

import { useId, useState, type ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Plain client-side tab state (no URL sync) — consistent with how other transient, per-page UI
 * state in this app works (e.g. DecisionPanel's selected decision), rather than the searchParams
 * pattern used for the Patterns list's filters, which are meant to be bookmarkable/shareable.
 */
export function Tabs({ tabs, defaultTabId }: { tabs: TabDef[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const groupId = useId();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="tabs">
      <div className="tabs-list" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${groupId}-tab-${t.id}`}
            aria-selected={t.id === active?.id}
            aria-controls={`${groupId}-panel-${t.id}`}
            className={`tabs-tab${t.id === active?.id ? ' active' : ''}`}
            onClick={() => setActiveId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active && (
        <div role="tabpanel" id={`${groupId}-panel-${active.id}`} aria-labelledby={`${groupId}-tab-${active.id}`} className="tabs-panel">
          {active.content}
        </div>
      )}
    </div>
  );
}
