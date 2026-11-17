import { onScopeDispose } from 'vue'
import { createFirebaseSettings } from '@/account/firebase-settings'
import { useConnectAccount } from './account'

export function useConnectSettings() {
  const store = useConnectAccount()
  const controller = createFirebaseSettings({
    uid: store.account!.uid,
    acquireToken: store.identityToken,
    refreshSession: store.refresh,
    ...(import.meta.env.DEV && import.meta.env.MODE === 'fixture' ? {
      acquireToken: async () => 'local-fixture-token',
      authURL: `${location.origin}/__fixture/auth`,
      databaseURL: `${location.origin}/__fixture/database`,
      functionsURL: `${location.origin}/__fixture/functions`,
      namespace: 'fixture',
    } : {}),
  })
  onScopeDispose(controller.dispose)
  return controller
}
