import { Archivo } from 'next/font/google';

/**
 * Scoped to the app header only (design/README.md's "Visual rules": "Use a single font,
 * Archivo") — the rest of the app keeps its existing system-ui stack; this isn't a global
 * typography change. Apply `archivo.className` to the header element.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});
