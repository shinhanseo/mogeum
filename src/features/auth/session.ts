import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session }
  | { status: 'error'; message: string };

/** Subscribe before restore; a late restore must never overwrite a newer sign-out. */
export function observeSession(client: SupabaseClient, publish: (state: SessionState) => void) {
  let active = true;
  let revision = 0;
  publish({ status: 'loading' });
  const emit = (session: Session | null) => publish(session ? { status: 'signed-in', session } : { status: 'signed-out' });
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    revision++;
    if (active) emit(session);
  });
  const initialRevision = revision;
  void client.auth.getSession().then(({ data, error }) => {
    if (!active || revision !== initialRevision) return;
    if (error) publish({ status: 'error', message: '로그인 상태를 확인하지 못했어요. 다시 시도해주세요.' });
    else emit(data.session);
  }).catch(() => {
    if (active && revision === initialRevision) publish({ status: 'error', message: '로그인 상태를 확인하지 못했어요. 다시 시도해주세요.' });
  });
  return () => { active = false; data.subscription.unsubscribe(); };
}
