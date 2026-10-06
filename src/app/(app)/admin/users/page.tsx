import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listUsers } from '@/lib/users';
import { roleLabels } from '@/lib/roles';
import { ROLES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { changeRoleAction, createUserAction, resetPasswordAction, setActiveAction } from './actions';

export const metadata = { title: 'User management' };

export default async function UsersPage() {
  const actor = await requireRole(['arb_member']);
  const [users, ROLE_LABELS] = await Promise.all([listUsers(), roleLabels()]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>User management</h1>
          <p className="muted">
            Users are provisioned manually. Every change here is recorded in the audit log against your
            account. Users are deactivated, never deleted.
          </p>
        </div>
        <Link href="/admin/roles" className="btn btn-secondary">
          Manage roles
        </Link>
      </div>

      <section className="card" aria-label="Create user">
        <h2>Create user</h2>
        <ActionForm action={createUserAction} submitLabel="Create user" pendingLabel="Creating…" resetOnSuccess>
          <div className="filters">
            <div className="field">
              <label htmlFor="new-email">E-mail</label>
              <input id="new-email" name="email" type="email" required autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="new-name">Display name</label>
              <input id="new-name" name="displayName" type="text" required maxLength={100} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="new-role">Role</label>
              <select id="new-role" name="role" defaultValue="viewer">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="new-password">Initial password (min. 12 characters)</label>
              <input id="new-password" name="password" type="password" required minLength={12} autoComplete="new-password" />
            </div>
          </div>
        </ActionForm>
        <p className="small muted" style={{ marginTop: '0.75rem' }}>
          A pattern owner is matched to patterns whose owner field equals their e-mail address or display
          name (case-insensitive), so use the same identifier the source documents use.
        </p>
      </section>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === actor.id;
              return (
                <tr key={u.id} style={u.isActive ? undefined : { opacity: 0.7 }}>
                  <td>
                    <strong>{u.displayName}</strong> {self && <span className="muted">(you)</span>}
                    <div className="small muted">{u.email}</div>
                  </td>
                  <td>
                    {self ? (
                      ROLE_LABELS[u.role]
                    ) : (
                      <ActionForm action={changeRoleAction} submitLabel="Save" pendingLabel="Saving…" variant="secondary" small className="inline-form">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" defaultValue={u.role} aria-label={`Role for ${u.displayName}`}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </ActionForm>
                    )}
                  </td>
                  <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    {!self && (
                      <ActionForm
                        action={setActiveAction}
                        submitLabel={u.isActive ? 'Deactivate' : 'Reactivate'}
                        variant={u.isActive ? 'danger' : 'secondary'}
                        small
                        confirmMessage={
                          u.isActive ? `Deactivate ${u.displayName}? They will be signed out immediately.` : undefined
                        }
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="active" value={u.isActive ? 'false' : 'true'} />
                      </ActionForm>
                    )}
                    <details style={{ marginTop: '0.5rem' }}>
                      <summary className="small">Reset password</summary>
                      <ActionForm
                        action={resetPasswordAction}
                        submitLabel="Set password"
                        pendingLabel="Saving…"
                        variant="secondary"
                        small
                        resetOnSuccess
                        className="inline-form"
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={12}
                          autoComplete="new-password"
                          placeholder="New password"
                          aria-label={`New password for ${u.displayName}`}
                        />
                      </ActionForm>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
