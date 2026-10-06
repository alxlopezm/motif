import { requireRole } from '@/lib/session';
import { listRoles } from '@/lib/roles';
import { formatDateTime } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { updateRoleAction } from './actions';

export const metadata = { title: 'Role management' };

export default async function RolesPage() {
  await requireRole(['arb_member']);
  const roles = await listRoles();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Role management</h1>
          <p className="muted">
            The 4 roles the app enforces are fixed — this only edits how each one is labeled and
            described; it can&rsquo;t add or remove a role. Every change is recorded in the audit log
            against your account.
          </p>
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name &amp; description</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.code}>
                <td>
                  <code>{r.code}</code>
                </td>
                <td>
                  <ActionForm action={updateRoleAction} submitLabel="Save" pendingLabel="Saving…" variant="secondary" small className="inline-form">
                    <input type="hidden" name="code" value={r.code} />
                    <div className="field">
                      <label htmlFor={`name-${r.code}`} className="sr-only">
                        Name for {r.code}
                      </label>
                      <input id={`name-${r.code}`} name="name" type="text" defaultValue={r.name} required maxLength={100} />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor={`desc-${r.code}`} className="sr-only">
                        Description for {r.code}
                      </label>
                      <input
                        id={`desc-${r.code}`}
                        name="description"
                        type="text"
                        defaultValue={r.description ?? ''}
                        maxLength={500}
                        placeholder="No description"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </ActionForm>
                </td>
                <td className="small muted">{formatDateTime(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
