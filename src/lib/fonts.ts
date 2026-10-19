import { Archivo } from 'next/font/google';

/**
 * Scoped to the app header, and to the pattern-detail relationship-map section
 * (design/pattern-map/README.md) — the rest of the app keeps its existing system-ui stack;
 * this isn't a global typography change. Apply `archivo.className` to the relevant element.
 * Weight 400 is for that second use's body copy (captions, metadata values, descriptions).
 */
export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});
