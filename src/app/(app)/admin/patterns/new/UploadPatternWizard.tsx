'use client';

import { useActionState, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/constants';
import { isAdfDoc } from '@/components/content/adf-types';
import { splitAdfIntoSections, guessAttributeCode, type DetectedSection } from '@/lib/adf-sections';
import type { ActionState } from '@/lib/action-state';
import type { AttributeTypeRow } from '@/lib/patterns';

interface Props {
  attributeTypes: AttributeTypeRow[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}

/**
 * Everything after the file is picked happens client-side (parse, split into sections, guess
 * each section's attribute type) — there is no server round-trip until the final submit, which
 * sends the admin's fully-reviewed mapping as one JSON payload. Mirrors DecisionPanel.tsx's
 * useActionState + useTransition + manually-built FormData wiring.
 */
export function UploadPatternWizard({ attributeTypes, action }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [owner, setOwner] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [sections, setSections] = useState<DetectedSection[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setSections([]);
    setMapping({});

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!isAdfDoc(json)) throw new Error('not an ADF document');

      const detected = splitAdfIntoSections(json);
      const codes = attributeTypes.map((t) => t.code);
      const initialMapping: Record<string, string> = {};
      for (const section of detected) {
        const guessedCode = guessAttributeCode(section.headingText, codes);
        const matchedType = attributeTypes.find((t) => t.code === guessedCode);
        initialMapping[section.key] = matchedType?.id ?? '';
      }
      setSections(detected);
      setMapping(initialMapping);
    } catch {
      setParseError('This doesn’t look like a valid ADF export — expected JSON with a top-level "doc" type.');
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      name,
      category,
      owner,
      sourceUrl,
      sections: sections
        .filter((s) => mapping[s.key])
        .map((s) => ({ attributeTypeId: mapping[s.key], content: s.content })),
    };
    const fd = new FormData();
    fd.set('payload', JSON.stringify(payload));
    startTransition(() => formAction(fd));
  }

  const canSubmit = name.trim() && category && owner.trim() && sourceUrl.trim() && sections.length > 0 && !pending;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="pattern-name">Pattern name</label>
        <input id="pattern-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        {state?.fieldErrors?.name && <span className="error">{state.fieldErrors.name}</span>}
      </div>

      <div className="field">
        <label htmlFor="pattern-category">Category</label>
        <select
          id="pattern-category"
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          <option value="">Choose a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.category && <span className="error">{state.fieldErrors.category}</span>}
      </div>

      <div className="field">
        <label htmlFor="pattern-owner">Owner</label>
        <input id="pattern-owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)} />
        {state?.fieldErrors?.owner && <span className="error">{state.fieldErrors.owner}</span>}
      </div>

      <div className="field">
        <label htmlFor="pattern-source-url">Source URL (the pattern&rsquo;s page in Confluence)</label>
        <input
          id="pattern-source-url"
          className="input"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        {state?.fieldErrors?.sourceUrl && <span className="error">{state.fieldErrors.sourceUrl}</span>}
      </div>

      <div className="field">
        <label htmlFor="pattern-file">ADF export (.json)</label>
        <input id="pattern-file" className="input" type="file" accept=".json,application/json" onChange={onFileChange} />
        {fileName && <span className="muted small">{fileName}</span>}
        {parseError && <span className="error">{parseError}</span>}
      </div>

      {sections.length > 0 && (
        <div className="field">
          <label>Section mapping</label>
          <p className="muted small">
            Each detected section is matched to an attribute type where possible. Review and adjust before
            creating the pattern.
          </p>
          <table className="table-wrap">
            <thead>
              <tr>
                <th>Heading</th>
                <th>Preview</th>
                <th>Attribute type</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.key}>
                  <td>{s.headingText}</td>
                  <td className="muted small">{s.preview || '—'}</td>
                  <td>
                    <select
                      className="input"
                      value={mapping[s.key] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    >
                      <option value="">Don&rsquo;t include</option>
                      {attributeTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        {pending ? 'Creating…' : 'Create pattern'}
      </button>

      {state?.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
