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
      <div className="page-head">
        <div>
          <h1>Upload a Confluence pattern</h1>
        </div>
      </div>

      <section className="card" aria-label="Upload pattern">
        <p className="muted">
          Pick a Confluence ADF export (.json). Its sections will be matched to this app&rsquo;s attribute
          types automatically — you can review and adjust that mapping before creating the pattern.
        </p>
        <UploadPatternWizard attributeTypes={attributeTypes} action={createPatternFromAdfAction} />
      </section>
    </>
  );
}
