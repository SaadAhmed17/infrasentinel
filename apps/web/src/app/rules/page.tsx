'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { RuleForm, TemplateCard } from '@/components/rules/rule-form';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { DropdownMenu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Panel } from '@/components/ui/panel';
import { SkeletonRows } from '@/components/ui/skeleton';
import { SeverityBadge } from '@/components/ui/status';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { canManageSecurity } from '@/lib/permissions';
import { RULE_TYPES, byRuleOrder, describeCondition, labelOf, type Rule } from '@/lib/rule-format';
import { RULE_TEMPLATES, templatePayload } from '@/lib/rule-templates';
import { cn } from '@/lib/utils';

function RuleMenu({ rule, onEdit, onDelete }: { rule: Rule; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${rule.name}`}>
          <Ellipsis />
        </Button>
      }
    >
      <MenuItem icon={Pencil} onClick={onEdit}>
        Edit
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={Trash2} onClick={onDelete} destructive>
        Delete rule
      </MenuItem>
    </DropdownMenu>
  );
}

/** On/off: a switch for managers, plain text for everyone else. */
function RuleState({ rule, canEdit, onToggle }: { rule: Rule; canEdit: boolean; onToggle: () => void }) {
  if (!canEdit) {
    return <span className={cn('text-[13px] font-medium', rule.isActive ? 'text-foreground' : 'text-muted-foreground')}>{rule.isActive ? 'On' : 'Off'}</span>;
  }
  return <Switch checked={rule.isActive} onChange={onToggle} label={`${rule.name} on`} />;
}

// First run: the six templates, each addable on its own or all at once.
function TemplatesEmptyState({
  canEdit,
  onAdded,
  onNew,
}: {
  canEdit: boolean;
  onAdded: (rules: Rule[]) => void;
  onNew: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function add(names: string[]) {
    setBusy(names.length > 1 ? 'all' : names[0]);
    const results = await Promise.allSettled(
      RULE_TEMPLATES.filter((t) => names.includes(t.name)).map((t) => apiClient.post<Rule>('/rules', templatePayload(t))),
    );
    const added = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) toast.error(added.length ? `Added ${added.length} of ${names.length} rules` : "Couldn't add the rule", friendlyError(failure.reason));
    else toast.success(added.length === 1 ? `${added[0].name} added` : `Added ${added.length} rules`, 'They are checked every 30 seconds.');
    onAdded(added);
    setBusy(null);
  }

  if (!canEdit) {
    return <EmptyState art="rules" title="No rules yet" description="Rules your team creates appear here." />;
  }
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold text-foreground">No rules yet</p>
          <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Start with the recommended rules. You can change or turn off each one later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onNew} disabled={!!busy}>
            Write your own
          </Button>
          <Button onClick={() => add(RULE_TEMPLATES.map((t) => t.name))} disabled={!!busy}>
            {busy === 'all' ? 'Adding…' : 'Add all six'}
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {RULE_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.name}
            template={t}
            action={
              <Button size="xs" variant="outline" onClick={() => add([t.name])} disabled={!!busy}>
                <Plus />
                {busy === t.name ? 'Adding…' : 'Add'}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}

function RulesContent() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = canManageSecurity(user?.role);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<{ rule: Rule | null } | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Rule[]>('/rules')
      .then((list) => {
        if (cancelled) return;
        setRules(list);
        setError('');
      })
      .catch((err) => !cancelled && setError(friendlyError(err)));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function openForm(rule: Rule | null) {
    setForm({ rule });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saved(rule: Rule) {
    const editing = !!form?.rule;
    setRules((list) => (editing ? (list ?? []).map((r) => (r.id === rule.id ? rule : r)) : [...(list ?? []), rule]));
    setForm(null);
    toast.success(editing ? 'Rule saved' : `${rule.name} created`, editing ? undefined : 'It is checked every 30 seconds.');
  }

  async function toggle(rule: Rule) {
    const isActive = !rule.isActive;
    setTogglingId(rule.id);
    setRules((list) => list?.map((r) => (r.id === rule.id ? { ...r, isActive } : r)) ?? null);
    try {
      await apiClient.patch(`/rules/${rule.id}/toggle`, { isActive });
      toast.success(`${rule.name} turned ${isActive ? 'on' : 'off'}`);
    } catch (err) {
      setRules((list) => list?.map((r) => (r.id === rule.id ? { ...r, isActive: !isActive } : r)) ?? null);
      toast.error(`Couldn't turn ${rule.name} ${isActive ? 'on' : 'off'}`, friendlyError(err));
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await apiClient.delete(`/rules/${deleting.id}`);
      setRules((list) => list?.filter((r) => r.id !== deleting.id) ?? null);
      if (form?.rule?.id === deleting.id) setForm(null);
      toast.success(`${deleting.name} deleted`);
      setDeleteOpen(false);
    } catch (err) {
      setDeleteError(friendlyError(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  const sorted = [...(rules ?? [])].sort(byRuleOrder);
  const activeCount = sorted.filter((r) => r.isActive).length;
  const menuFor = (rule: Rule) =>
    canEdit && (
      <RuleMenu
        rule={rule}
        onEdit={() => openForm(rule)}
        onDelete={() => {
          setDeleting(rule);
          setDeleteError('');
          setDeleteOpen(true);
        }}
      />
    );

  return (
    <AppShell
      title="Rules"
      meta={rules && rules.length > 0 ? `${activeCount} of ${rules.length} on · checked every 30 s` : undefined}
      actions={
        canEdit &&
        !form &&
        rules &&
        rules.length > 0 && (
          <Button className="flex-1 sm:flex-none" onClick={() => openForm(null)}>
            <Plus />
            New rule
          </Button>
        )
      }
    >
      <div className="space-y-5 sm:space-y-6">
        {form && <RuleForm key={form.rule?.id ?? 'new'} rule={form.rule} onSaved={saved} onCancel={() => setForm(null)} />}

        <Panel flush>
          {!rules ? (
            error ? (
              <EmptyState
                icon={AlertCircle}
                tone="error"
                title="Couldn't load the rules"
                description={error}
                action={
                  <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <SkeletonRows rows={5} />
            )
          ) : rules.length === 0 ? (
            <TemplatesEmptyState
              canEdit={canEdit}
              onAdded={(added) => setRules((list) => [...(list ?? []), ...added])}
              onNew={() => openForm(null)}
            />
          ) : (
            <>
              {/* desktop: a table */}
              <table className="hidden w-full text-[14px] lg:table">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="text-label w-[26%] px-5 py-3 font-medium">
                      Rule
                    </th>
                    <th scope="col" className="text-label px-5 py-3 font-medium">
                      Condition
                    </th>
                    <th scope="col" className="text-label w-36 px-5 py-3 font-medium">
                      Severity
                    </th>
                    <th scope="col" className="text-label w-20 px-5 py-3 font-medium">
                      On
                    </th>
                    {canEdit && (
                      <th scope="col" className="w-14 px-3 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((rule) => (
                    <tr key={rule.id} className="border-b border-border transition-colors duration-[120ms] last:border-0 hover:bg-accent/30">
                      <td className="px-5 py-3.5 align-top">
                        <p className={cn('font-semibold', rule.isActive ? 'text-foreground' : 'text-muted-foreground')}>{rule.name}</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{labelOf(RULE_TYPES, rule.ruleType)}</p>
                      </td>
                      <td className={cn('px-5 py-3.5 align-top text-[13.5px] leading-relaxed', rule.isActive ? 'text-foreground/85' : 'text-muted-foreground')}>
                        {describeCondition(rule)}
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <SeverityBadge severity={rule.severity} className={cn(!rule.isActive && 'opacity-60')} />
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <span className={cn('inline-flex h-6 items-center', togglingId === rule.id && 'opacity-70')}>
                          <RuleState rule={rule} canEdit={canEdit} onToggle={() => toggle(rule)} />
                        </span>
                      </td>
                      {canEdit && <td className="px-3 py-2.5 text-right align-top">{menuFor(rule)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* phones and tablets: a list */}
              <ul className="divide-y divide-border lg:hidden">
                {sorted.map((rule) => (
                  <li key={rule.id} className="flex items-start gap-2 py-3.5 pl-4 pr-2 sm:pl-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={cn('truncate text-[14.5px] font-semibold', rule.isActive ? 'text-foreground' : 'text-muted-foreground')}>
                          {rule.name}
                        </p>
                        <RuleState rule={rule} canEdit={canEdit} onToggle={() => toggle(rule)} />
                      </div>
                      <p className={cn('mt-1 text-[13.5px] leading-relaxed', rule.isActive ? 'text-foreground/85' : 'text-muted-foreground')}>
                        {describeCondition(rule)}
                      </p>
                      <p className="mt-2 flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
                        <SeverityBadge severity={rule.severity} compact />
                        {labelOf(RULE_TYPES, rule.ruleType)}
                      </p>
                    </div>
                    {canEdit && <div className="-my-1">{menuFor(rule)}</div>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {rules && rules.length > 0 && !canEdit && (
            <p className="border-t border-border px-4 py-3.5 text-[13.5px] text-muted-foreground sm:px-5">
              View only. Owners, admins and security analysts can change rules.
            </p>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        busy={deleteBusy}
        error={deleteError}
        title={`Delete ${deleting?.name ?? 'rule'}?`}
        description="Its past alerts and incidents stay."
        confirmLabel="Delete rule"
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}

export default function RulesPage() {
  return (
    <ProtectedRoute>
      <RulesContent />
    </ProtectedRoute>
  );
}
