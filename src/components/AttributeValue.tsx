/** Renders an arbitrary jsonb attribute value. React escapes all text, so no HTML injection. */
export function AttributeValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <p className="muted">No value</p>;
  }
  if (typeof value === 'string') return <p className="pre-wrap">{value}</p>;
  if (typeof value === 'number' || typeof value === 'boolean') return <p>{String(value)}</p>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="muted">No value</p>;
    return (
      <ul>
        {value.map((item, i) => (
          <li key={i}>
            <AttributeValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}
