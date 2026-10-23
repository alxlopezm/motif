import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { getAttributeTypes } from '@/lib/patterns';
import { UploadPatternWizard } from './UploadPatternWizard';
import { createPatternFromAdfAction } from './actions';

export async function generateMetadata() {
  return { title: 'Upload pattern' };
}

export default async function UploadPatternPage() {
  await requireRole(['arb_member']);
  const attributeTypes = await getAttributeTypes();

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/patterns">Patterns</Link>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="breadcrumb-current">Upload from Confluence</span>
      </nav>

      <div className="upload-header">
        <div className="upload-icon-badge" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <h1 className="upload-title">Upload a Confluence pattern</h1>
          <p className="muted">
            Import an Enterprise Architecture pattern from a Confluence ADF export. Its sections are matched to
            this app&rsquo;s attribute types automatically — you&rsquo;ll review and adjust that mapping before
            the pattern is created.
          </p>
        </div>
      </div>

      <UploadPatternWizard attributeTypes={attributeTypes} action={createPatternFromAdfAction} />
    </>
  );
}
