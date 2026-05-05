import { computed, reactive, ref } from 'vue';
import { onValue } from 'firebase/database';
import { compareVersions } from 'compare-versions';
import { version as currentVersion } from '../../package.json';
import { dataRef } from '@/firebase';

// Hardcoded until Capacitor is wired; then read Capacitor.getPlatform() for ios/android.
const PLATFORM = 'web';

const latestVersion = ref<string | null>(null);
const dialogOpen = ref(false);

const updateAvailable = computed(() => {
  if (!latestVersion.value) return false;
  return compareVersions(currentVersion, latestVersion.value) < 0;
});

onValue(dataRef('versions'), (snap) => {
  const value = snap.val();
  if (value && typeof value === 'object') {
    const v = (value as Record<string, unknown>)[PLATFORM];
    latestVersion.value = typeof v === 'string' ? v : null;
  } else {
    latestVersion.value = null;
  }
});

function openDialog() {
  if (updateAvailable.value) dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
}

function applyUpdate() {
  dialogOpen.value = false;
  window.location.reload();
}

const state = reactive({
  currentVersion,
  latestVersion,
  updateAvailable,
  dialogOpen,
  openDialog,
  closeDialog,
  applyUpdate,
});

export function useUpdate() {
  return state;
}
