'use client';

import {
  useActionState,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/constants';
import { isAdfDoc } from '@/components/content/adf-types';
import { splitAdfIntoSections, guessAttributeCode, type DetectedSection } from '@/lib/adf-sections';
import type { ActionState } from '@/lib/action-state';
import type { AttributeTypeRow } from '@/lib/patterns';

interface Props {
  attributeTypes: AttributeTypeRow[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}

const STEPS = [
  { n: 1, label: 'Details & file' },
  { n: 2, label: 'Review mapping' },
  { n: 3, label: 'Create pattern' },
] as const satisfies readonly { n: 1 | 2 | 3; label: string }[];

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/**
 * A real 3-step wizard (Details & file -> Review mapping -> Create pattern), all client state —
 * only the final step actually submits. Parsing/splitting/guessing stays entirely client-side
 * (see DetectedSection / guessAttributeCode), so steps 1-2 never touch the server; step 3 sends
 * the admin's fully-reviewed mapping as one JSON payload, same wiring as every other
 * useActionState + useTransition action form in this app (see DecisionPanel.tsx).
 */
export function UploadPatternWizard({ attributeTypes, action }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [owner, setOwner] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [sections, setSections] = useState<DetectedSection[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
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

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function clearFile() {
    setFileName(null);
    setSections([]);
    setMapping({});
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== 3) return; // Enter key in an earlier step's field shouldn't submit early.
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

  const detailsComplete = Boolean(name.trim() && category && owner.trim() && sourceUrl.trim());
  const canContinueToMapping = detailsComplete && sections.length > 0 && !parseError;
  const mappedCount = sections.filter((s) => mapping[s.key]).length;

  let step1Hint = 'Add a pattern name and an ADF file to continue.';
  if (detailsComplete && sections.length === 0) step1Hint = 'Add a Confluence ADF export (.json) to continue.';
  else if (!detailsComplete && sections.length > 0) step1Hint = 'Fill in the pattern name, category and owner to continue.';
  else if (canContinueToMapping) step1Hint = `${sections.length} section${sections.length === 1 ? '' : 's'} detected.`;

  return (
    <>
      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s.n} className="stepper-item">
            <span className={`stepper-step ${step >= s.n ? 'active' : ''}`}>
              <span className="stepper-circle">{s.n}</span>
              <span className="stepper-label">{s.label}</span>
            </span>
            {i < STEPS.length - 1 && <span className="stepper-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="upload-layout">
        <form onSubmit={onSubmit} noValidate className="card wizard-card">
          {step === 1 && (
            <>
              <h2>Pattern details</h2>
              <p className="muted small">How the pattern will appear in the catalog.</p>

              <div className="field">
                <label htmlFor="pattern-name">
                  Pattern name <span className="required">*</span>
                </label>
                <input
                  id="pattern-name"
                  className="input"
                  placeholder="e.g. Event-driven data ingestion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {state?.fieldErrors?.name && <span className="error">{state.fieldErrors.name}</span>}
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="pattern-category">
                    Category <span className="required">*</span>
                  </label>
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
                  <label htmlFor="pattern-owner">
                    Owner <span className="required">*</span>
                  </label>
                  <div className="input-icon-wrap">
                    <UserIcon />
                    <input
                      id="pattern-owner"
                      className="input"
                      placeholder="Name or team"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                    />
                  </div>
                  {state?.fieldErrors?.owner && <span className="error">{state.fieldErrors.owner}</span>}
                </div>
              </div>

              <div className="field">
                <label htmlFor="pattern-source-url">
                  Source URL <span className="required">*</span>
                </label>
                <div className="input-icon-wrap">
                  <LinkIcon />
                  <input
                    id="pattern-source-url"
                    className="input"
                    type="url"
                    placeholder="https://your-site.atlassian.net/wiki/spaces/..."
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                </div>
                <p className="field-hint">
                  The pattern&rsquo;s page in Confluence, so readers can trace it back to its source.
                </p>
                {state?.fieldErrors?.sourceUrl && <span className="error">{state.fieldErrors.sourceUrl}</span>}
              </div>

              <hr className="divider" />

              <h2>
                ADF export <span className="required">*</span>
              </h2>
              <p className="muted small">A single Confluence page exported as Atlassian Document Format (.json).</p>

              <div
                className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={onFileInputChange}
                />
                {fileName ? (
                  <div className="dropzone-file">
                    <span className="dropzone-filename">{fileName}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="dropzone-icon">
                      <UploadIcon />
                    </span>
                    <p className="dropzone-prompt">
                      Drop your .json file here, or{' '}
                      <button
                        type="button"
                        className="dropzone-browse"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        browse
                      </button>
                    </p>
                    <p className="dropzone-hint">Confluence ADF export · .json only</p>
                  </>
                )}
              </div>
              {parseError && <span className="error">{parseError}</span>}

              <div className="wizard-footer">
                <span className="wizard-footer-hint">{step1Hint}</span>
                <Link href="/patterns" className="btn btn-secondary">
                  Cancel
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canContinueToMapping}
                  onClick={() => setStep(2)}
                >
                  Continue to mapping <ArrowRightIcon />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Review mapping</h2>
              <p className="muted small">
                Each detected section is matched to an attribute type where possible. Review and adjust before
                creating the pattern.
              </p>

              <div className="table-wrap">
                <table>
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

              <div className="wizard-footer">
                <span className="wizard-footer-hint">
                  {mappedCount} of {sections.length} sections mapped.
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                  Continue to create <ArrowRightIcon />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Create pattern</h2>
              <p className="muted small">Review the details below, then create the pattern.</p>

              <dl className="summary-list">
                <div>
                  <dt>Pattern name</dt>
                  <dd>{name}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{category ? CATEGORY_LABELS[category] : '—'}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{owner}</dd>
                </div>
                <div>
                  <dt>Source URL</dt>
                  <dd className="pre-wrap">{sourceUrl}</dd>
                </div>
                <div>
                  <dt>ADF export</dt>
                  <dd>{fileName}</dd>
                </div>
                <div>
                  <dt>Sections mapped</dt>
                  <dd>
                    {mappedCount} of {sections.length}
                  </dd>
                </div>
              </dl>

              <div className="wizard-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)} disabled={pending}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? 'Creating…' : 'Create pattern'}
                </button>
              </div>

              {state?.error && (
                <p role="alert" className="form-error">
                  {state.error}
                </p>
              )}
            </>
          )}
        </form>

        <aside className="upload-sidebar">
          <div className="card">
            <h2>How it works</h2>
            <div className="howitworks-step">
              <span className="howitworks-num">1</span>
              <div>
                <p className="howitworks-title">Upload the export</p>
                <p className="howitworks-desc">Add the pattern&rsquo;s details and its ADF .json file.</p>
              </div>
            </div>
            <div className="howitworks-step">
              <span className="howitworks-num">2</span>
              <div>
                <p className="howitworks-title">Review the mapping</p>
                <p className="howitworks-desc">
                  Sections are matched to attribute types automatically. Adjust any that don&rsquo;t fit.
                </p>
              </div>
            </div>
            <div className="howitworks-step">
              <span className="howitworks-num">3</span>
              <div>
                <p className="howitworks-title">Create the pattern</p>
                <p className="howitworks-desc">The pattern is added to the catalog.</p>
              </div>
            </div>
          </div>

          <div className="card callout-info">
            <InfoIcon />
            <div>
              <p className="howitworks-title">Need the ADF file?</p>
              <p className="howitworks-desc">
                Export the page content in Atlassian Document Format (.json). Clear section headings in
                Confluence give the best automatic mapping.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
