'use client';

import { useSyncExternalStore } from 'react';
import { apiClient } from '@/lib/api-client';

// Small shared store for what the app frame shows on every page: the
// organization name and the number of open incidents. Kept outside React so
// moving between pages doesn't refetch or flash empty values.
interface ShellState {
  orgName: string | null;
  /** The organization request failed; the next page visit tries again. */
  orgFailed: boolean;
  openIncidents: number | null;
}

const EMPTY: ShellState = { orgName: null, orgFailed: false, openIncidents: null };
let state: ShellState = EMPTY;
const listeners = new Set<() => void>();
let orgRequest: Promise<void> | null = null;

function update(partial: Partial<ShellState>) {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

export function useShellState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function loadOrganization() {
  if (state.orgName || orgRequest) return;
  orgRequest = apiClient
    .get<{ name: string }>('/organizations/me')
    .then((org) => update({ orgName: org.name, orgFailed: false }))
    .catch(() => update({ orgFailed: true }))
    .finally(() => {
      orgRequest = null;
    });
}

export function setOrganizationName(name: string) {
  update({ orgName: name, orgFailed: false });
}

/** Refreshes the open-incident count (called on a timer and after status changes). */
export function refreshOpenIncidents() {
  apiClient
    .get<{ openIncidents: number }>('/incidents/dashboard-summary')
    .then((summary) => update({ openIncidents: summary.openIncidents }))
    .catch(() => undefined);
}

/** Forget everything when the signed-in user changes. */
export function resetShellState() {
  orgRequest = null;
  update(EMPTY);
}
