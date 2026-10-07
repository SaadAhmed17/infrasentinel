'use client';

import { useState } from 'react';
import { Ellipsis, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormDialog } from '@/components/ui/form-dialog';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/form-styles';
import { DropdownMenu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface ServerRef {
  id: string;
  name: string;
}

type ActionKind = 'rename' | 'key' | 'delete';

/** The ⋯ menu for a server (managers only). */
export function ServerMenu({
  server,
  onAction,
  className,
}: {
  server: ServerRef;
  onAction: (kind: ActionKind) => void;
  className?: string;
}) {
  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${server.name}`} className={cn('relative z-10', className)}>
          <Ellipsis />
        </Button>
      }
    >
      <MenuItem icon={Pencil} onClick={() => onAction('rename')}>
        Rename
      </MenuItem>
      <MenuItem icon={KeyRound} onClick={() => onAction('key')}>
        Replace agent key
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={Trash2} onClick={() => onAction('delete')} destructive>
        Delete server
      </MenuItem>
    </DropdownMenu>
  );
}

/**
 * The dialogs behind the menu, with their API calls and toasts. Render
 * `dialogs` once on the page and call `open(kind, server)` from the menu.
 */
export function useServerActions({
  onRenamed,
  onKeyReplaced,
  onDeleted,
}: {
  onRenamed?: (server: ServerRef) => void;
  onKeyReplaced: (server: ServerRef, apiKey: string) => void;
  onDeleted: (server: ServerRef) => void;
}) {
  const toast = useToast();
  // the last action stays set while its dialog animates closed
  const [action, setAction] = useState<{ kind: ActionKind; server: ServerRef } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  function open(kind: ActionKind, server: ServerRef) {
    setAction({ kind, server });
    setName(server.name);
    setError('');
    setIsOpen(true);
  }

  async function run() {
    if (!action) return;
    const { kind, server } = action;
    const newName = name.trim();
    if (kind === 'rename') {
      if (newName === server.name) return setIsOpen(false);
      if (newName.length < 2) return setError('Use at least 2 characters.');
    }
    setBusy(true);
    setError('');
    try {
      if (kind === 'delete') {
        await apiClient.delete(`/servers/${server.id}`);
        toast.success(`${server.name} deleted`);
        onDeleted(server);
      } else if (kind === 'key') {
        const result = await apiClient.post<{ apiKey: string }>(`/servers/${server.id}/regenerate-key`, {});
        toast.success('Agent key replaced', 'Restart the agent with the new key.');
        onKeyReplaced(server, result.apiKey);
      } else {
        const updated = await apiClient.patch<ServerRef>(`/servers/${server.id}`, { name: newName });
        toast.success(`Renamed to ${updated.name}`);
        onRenamed?.(updated);
      }
      setIsOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const kind = action?.kind;
  const serverName = action?.server.name ?? '';
  const dialogs = (
    <>
      <ConfirmDialog
        open={isOpen && (kind === 'delete' || kind === 'key')}
        onOpenChange={setIsOpen}
        busy={busy}
        error={error}
        destructive={kind === 'delete'}
        title={kind === 'delete' ? `Delete ${serverName}?` : `Replace the agent key for ${serverName}?`}
        description={
          kind === 'delete'
            ? 'Its metrics are deleted. Its alerts stay with their incidents.'
            : 'The current key stops working right away. Restart the agent with the new key.'
        }
        confirmLabel={kind === 'delete' ? 'Delete server' : 'Replace key'}
        onConfirm={run}
      />
      <FormDialog
        open={isOpen && kind === 'rename'}
        onOpenChange={setIsOpen}
        title={`Rename ${serverName}`}
        submitLabel="Save"
        busy={busy}
        error={error}
        onSubmit={run}
      >
        <label htmlFor="server-new-name" className={fieldLabelClass}>
          Name
        </label>
        <input
          id="server-new-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={100}
          className={fieldControlClass}
        />
      </FormDialog>
    </>
  );

  return { open, dialogs };
}
