<script setup lang="ts">
import { onScopeDispose, reactive, ref } from 'vue'
import { onValue } from 'firebase/database'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import { dataRef } from '@/firebase'
import { confirm } from '@/lib/admin/feedback'
import { versionJump } from '@/lib/admin/versions'
import { write } from '@/lib/admin/write'

// The app versions people are told to update to.

const versions = ref<Record<string, string>>({})
const off = onValue(dataRef('versions'), (snap) => (versions.value = (snap.val() ?? {}) as Record<string, string>))
onScopeDispose(off)
const APPS = [
  { key: 'web', label: 'Web' },
  { key: 'ios', label: 'iPhone and iPad' },
  { key: 'android', label: 'Android' },
]

// A typo (200.0.0) would ask everyone to update to a release that doesn't
// exist, so a big jump, or going back, asks first. Saying no puts back the
// saved version (in a new box: the old one takes the save as done).
const resets = reactive<Record<string, number>>({})
const saveVersion = (key: string, label: string) => async (v: string | null) => {
  const from = versions.value[key]
  const jump = v ? versionJump(from, v) : null
  const ok =
    !jump ||
    (await confirm({
      title: `Set ${label} to ${v}?`,
      message:
        jump === 'big'
          ? `That’s a big jump from ${from}, and everyone on an older version will be asked to update to it. Check it’s been released.`
          : `That’s lower than ${from}, so people on the versions in between will stop being asked to update.`,
      confirmLabel: 'Save',
    }))
  if (!ok) {
    resets[key] = (resets[key] ?? 0) + 1
    return
  }
  await write({ [`versions/${key}`]: v })
}
const versionPattern = (v: string) => (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v) ? null : 'Use a version like 4.0.1.')
</script>

<template>
  <div class="max-w-3xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Versions"
      description="People on an older version are asked to update. Set each app’s once its release is live in the store. The web’s sets itself when it deploys."
    />
    <div class="grid gap-4 sm:grid-cols-3">
      <TextField
        v-for="p in APPS"
        :key="`${p.key}-${resets[p.key] ?? 0}`"
        :model-value="versions[p.key]"
        :label="p.label"
        placeholder="4.0.0"
        :validate="versionPattern"
        :save="saveVersion(p.key, p.label)"
      />
    </div>
  </div>
</template>
