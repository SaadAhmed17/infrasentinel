'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Collapsible } from '@base-ui/react/collapsible';
import { AlertCircle, ChevronRight, Mail, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { CopyButton, CopyField } from '@/components/ui/copy-button';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldControlClass, fieldHintClass, fieldInlineErrorClass, fieldLabelClass, fieldSelectClass } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { useNow } from '@/components/ui/relative-time';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { formatDate, formatTimeUntil, initialsFromEmail, plural } from '@/lib/format';
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, canManageTeam, roleLabel } from '@/lib/roles';
import { setOrganizationName, useShellState } from '@/lib/shell-store';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  createdAt: string;
}
interface Member {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}
interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// The API returns a link on localhost (API-2), so links are rebuilt from the
// token with the address this app is actually served from.
function invitationLink(token: string) {
  return `${window.location.origin}/accept-invite?token=${token}`;
}

function PanelError({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      tone="error"
      title={`Couldn't load ${what}`}
      description={message}
      className="py-10"
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[14px] text-foreground">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Organization

function OrganizationPanel({
  org,
  error,
  onRetry,
  onRenamed,
}: {
  org: Organization | null;
  error?: string;
  onRetry: () => void;
  onRenamed: (org: Organization) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const canEdit = canManageTeam(user?.role);
  const trimmed = name.trim();

  function startEditing() {
    if (!org) return;
    setName(org.name);
    setSaveError('');
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    if (trimmed.length < 2) {
      setSaveError('Use at least 2 characters.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await apiClient.patch<Organization>('/organizations/settings', { name: trimmed });
      onRenamed(updated);
      setOrganizationName(updated.name);
      setEditing(false);
      toast.success('Organization renamed', `It's now called ${updated.name}.`);
    } catch (err) {
      setSaveError(friendlyError(err, "Couldn't rename the organization. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel id="organization" title="Organization" flush>
      {!org ? (
        error ? (
          <PanelError what="the organization" message={error} onRetry={onRetry} />
        ) : (
          <div className="space-y-4 p-4 sm:p-5" role="status" aria-label="Loading">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/5" />
          </div>
        )
      ) : (
        <dl className="divide-y divide-border">
          <SettingRow label="Name">
            {editing ? (
              <form onSubmit={save} noValidate>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                    aria-label="Organization name"
                    aria-invalid={!!saveError || undefined}
                    aria-describedby={saveError ? 'org-name-error' : undefined}
                    autoFocus
                    maxLength={80}
                    className={cn(fieldControlClass, 'sm:max-w-sm')}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving || trimmed === org.name} className="flex-1 sm:flex-none">
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} className="flex-1 sm:flex-none">
                      Cancel
                    </Button>
                  </div>
                </div>
                {saveError && (
                  <p id="org-name-error" className={fieldInlineErrorClass}>
                    {saveError}
                  </p>
                )}
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{org.name}</span>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    Rename
                  </Button>
                )}
              </div>
            )}
          </SettingRow>
          <SettingRow label="Created">{formatDate(org.createdAt)}</SettingRow>
          <SettingRow label="Your role">{roleLabel(user?.role)}</SettingRow>
        </dl>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Team

function InviteForm({ onCreated, onCancel }: { onCreated: (invitation: Invitation) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Invitation | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const result = await apiClient.post<{ invitation: Invitation }>('/organizations/invitations', { email: email.trim(), role });
      setCreated(result.invitation);
      setEmail('');
      onCreated(result.invitation);
    } catch (err) {
      setError(friendlyError(err, "Couldn't create the invitation. Try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 border-b border-border bg-surface-2/50 px-4 py-4 sm:px-5">
      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end">
          <div>
            <label htmlFor="invite-email" className={fieldLabelClass}>
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              autoFocus
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'invite-error' : 'invite-role-hint'}
              className={fieldControlClass}
            />
          </div>
          <div>
            <label htmlFor="invite-role" className={fieldLabelClass}>
              Role
            </label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className={fieldSelectClass}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" disabled={sending} className="flex-1 lg:flex-none">
              {sending ? 'Creating…' : 'Create invitation'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 lg:flex-none">
              Cancel
            </Button>
          </div>
        </div>
        {error ? (
          <p id="invite-error" className={fieldInlineErrorClass}>
            {error}
          </p>
        ) : (
          <p id="invite-role-hint" className={fieldHintClass}>
            {roleLabel(role)}: {ROLE_DESCRIPTIONS[role].charAt(0).toLowerCase() + ROLE_DESCRIPTIONS[role].slice(1)}
          </p>
        )}
      </form>

      {created && (
        <Notice tone="success" className="animate-fade-up">
          <p className="font-medium">Invitation for {created.email} is ready</p>
          <p className="mb-2.5 text-muted-foreground">
            Send them this link. It works once and expires on {formatDate(created.expiresAt)}.
          </p>
          <CopyField value={invitationLink(created.token)} label="Copy link" ariaLabel="Invitation link" />
        </Notice>
      )}
    </div>
  );
}

function PendingInvitations({ invitations }: { invitations: Invitation[] }) {
  const now = useNow(); // 0 until the shared clock runs in the browser
  return (
    <ul className="divide-y divide-border">
      {invitations.map((invitation) => {
        const left = now ? formatTimeUntil(invitation.expiresAt, now) : undefined;
        const expired = left === null;
        return (
          <li key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-muted-foreground"
            >
              <Mail className="size-3.5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-foreground">{invitation.email}</span>
              <span className="block text-[12.5px] text-muted-foreground">
                {roleLabel(invitation.role)} ·{' '}
                {expired
                  ? `Expired on ${formatDate(invitation.expiresAt)}`
                  : left
                    ? `Expires ${left}`
                    : `Expires on ${formatDate(invitation.expiresAt)}`}
              </span>
            </span>
            {!expired && (
              <span className="w-full pl-12 sm:w-auto sm:pl-0">
                <CopyButton value={invitationLink(invitation.token)} label="Copy link" size="xs" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MemberRow({
  member,
  isYou,
  editable,
  saving,
  onRoleChange,
}: {
  member: Member;
  isYou: boolean;
  editable: boolean;
  saving: boolean;
  onRoleChange: (role: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:px-5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[12px] font-semibold text-primary-bright"
      >
        {initialsFromEmail(member.email)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium text-foreground">{member.email}</span>
          {isYou && (
            <span className="shrink-0 rounded-full border border-border-strong px-1.5 text-[11.5px] font-medium leading-[18px] text-muted-foreground">
              You
            </span>
          )}
        </span>
        <span className="block text-[12.5px] text-muted-foreground">Joined {formatDate(member.createdAt)}</span>
      </span>
      {editable ? (
        <select
          value={member.role}
          disabled={saving}
          onChange={(e) => onRoleChange(e.target.value)}
          aria-label={`Role of ${member.email}`}
          className={cn(fieldSelectClass, 'h-9 w-full text-[13.5px] sm:w-52')}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      ) : (
        <span className="w-full pl-12 text-[13.5px] text-muted-foreground sm:w-auto sm:pl-0">{roleLabel(member.role)}</span>
      )}
    </li>
  );
}

function RoleGuide() {
  return (
    <Collapsible.Root className="border-t border-border">
      <Collapsible.Trigger className="group flex w-full items-center gap-2 rounded-b-[calc(var(--radius-xl)-1px)] px-4 py-3 text-left text-[13.5px] font-medium text-foreground transition-colors duration-[120ms] hover:bg-accent/40 data-[panel-open]:rounded-b-none sm:px-5">
        <ChevronRight
          className="size-4 text-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-90"
          strokeWidth={1.75}
          aria-hidden
        />
        What can each role do?
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
        <dl className="grid gap-x-6 gap-y-1 px-4 pb-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-y-3 sm:px-5 sm:pb-5">
          {Object.keys(ROLE_LABELS).map((role) => (
            <div key={role} className="contents">
              <dt className="mt-2 text-[13.5px] font-medium text-foreground sm:mt-0">{roleLabel(role)}</dt>
              <dd className="text-[13.5px] leading-relaxed text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground sm:px-5">Everyone can use the AI assistant.</p>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function TeamPanel({
  members,
  invitations,
  membersError,
  onRetry,
  onRoleChange,
  onInvited,
  savingId,
  inviteFromLink,
}: {
  members: Member[] | null;
  invitations: Invitation[] | null;
  membersError?: string;
  onRetry: () => void;
  onRoleChange: (member: Member, role: string) => void;
  onInvited: (invitation: Invitation) => void;
  savingId: string | null;
  inviteFromLink: boolean;
}) {
  const { user } = useAuth();
  const canManage = canManageTeam(user?.role);
  const [inviting, setInviting] = useState(inviteFromLink && canManage);
  const pending = canManage ? (invitations ?? []) : [];
  const sectionLabel = 'px-4 pt-4 pb-1 text-label sm:px-5';

  return (
    <Panel
      id="team"
      title="Team"
      meta={members ? plural(members.length, 'member') : undefined}
      flush
      actions={
        canManage &&
        !inviting && (
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus />
            Invite member
          </Button>
        )
      }
    >
      {inviting && <InviteForm onCreated={onInvited} onCancel={() => setInviting(false)} />}

      {!members ? (
        membersError ? (
          <PanelError what="the team" message={membersError} onRetry={onRetry} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : (
        <>
          {pending.length > 0 && (
            <div className="border-b border-border">
              <p className={sectionLabel}>Pending invitations</p>
              <PendingInvitations invitations={pending} />
            </div>
          )}
          {pending.length > 0 && <p className={sectionLabel}>Members</p>}
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isYou={member.id === user?.userId}
                editable={canManage && member.role !== 'OWNER' && member.id !== user?.userId}
                saving={savingId === member.id}
                onRoleChange={(role) => onRoleChange(member, role)}
              />
            ))}
          </ul>
          {canManage && members.length === 1 && pending.length === 0 && !inviting && (
            <p className="border-t border-border px-4 py-3.5 text-[13.5px] text-muted-foreground sm:px-5">
              It&apos;s just you so far. Invite the people who look after your servers.
            </p>
          )}
          {!canManage && (
            <p className="border-t border-border px-4 py-3.5 text-[13.5px] text-muted-foreground sm:px-5">
              Only owners and admins can invite people or change roles.
            </p>
          )}
        </>
      )}
      <RoleGuide />
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function SettingsContent() {
  const { user } = useAuth();
  const toast = useToast();
  const inviteFromLink = useSearchParams().get('invite') === '1';
  const canManage = canManageTeam(user?.role);
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [errors, setErrors] = useState<{ org?: string; members?: string }>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      apiClient.get<Organization>('/organizations/me'),
      apiClient.get<Member[]>('/organizations/members'),
      canManage ? apiClient.get<Invitation[]>('/organizations/invitations') : Promise.resolve([]),
    ]).then(([orgResult, membersResult, invitesResult]) => {
      if (cancelled) return;
      if (orgResult.status === 'fulfilled') setOrg(orgResult.value);
      if (membersResult.status === 'fulfilled') setMembers(membersResult.value);
      // pending invitations are extra; without them the team list still works
      if (invitesResult.status === 'fulfilled') setInvitations(invitesResult.value);
      setErrors({
        org: orgResult.status === 'rejected' ? friendlyError(orgResult.reason) : undefined,
        members: membersResult.status === 'rejected' ? friendlyError(membersResult.reason) : undefined,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, canManage]);

  function retry() {
    setErrors({});
    setAttempt((n) => n + 1);
  }

  async function changeRole(member: Member, role: string) {
    const previous = member.role;
    setSavingId(member.id);
    setMembers((list) => list?.map((m) => (m.id === member.id ? { ...m, role } : m)) ?? null);
    try {
      await apiClient.patch(`/organizations/members/${member.id}/role`, { role });
      toast.success('Role changed', `${member.email} is now ${roleLabel(role)}.`);
    } catch (err) {
      setMembers((list) => list?.map((m) => (m.id === member.id ? { ...m, role: previous } : m)) ?? null);
      toast.error("Couldn't change the role", friendlyError(err));
    } finally {
      setSavingId(null);
    }
  }

  function addInvitation(invitation: Invitation) {
    setInvitations((list) => [invitation, ...(list ?? [])]);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <OrganizationPanel org={org} error={errors.org} onRetry={retry} onRenamed={setOrg} />
      <TeamPanel
        members={members}
        invitations={invitations}
        membersError={errors.members}
        onRetry={retry}
        onRoleChange={changeRole}
        onInvited={addInvitation}
        savingId={savingId}
        inviteFromLink={inviteFromLink}
      />
    </div>
  );
}

function SettingsMeta() {
  const { orgName } = useShellState();
  return orgName ? <span className="font-medium text-foreground/80">{orgName}</span> : null;
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Settings" meta={<SettingsMeta />}>
        <Suspense fallback={<SkeletonRows rows={4} />}>
          <SettingsContent />
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}
