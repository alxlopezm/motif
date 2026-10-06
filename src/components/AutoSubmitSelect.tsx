'use client';

import type { SelectHTMLAttributes } from 'react';

/** A <select> that submits its enclosing <form> on change (for filters with no "Apply" step). */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
