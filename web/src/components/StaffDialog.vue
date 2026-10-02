<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ExternalLink, Scale } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import type { Morph } from '@/lib/morph'
import FavoriteButton from '@/components/FavoriteButton.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import Button from '@/components/ui/Button.vue'
import { formatExternalURL, formatHumanURL } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import {
  staffEntityRef,
  staffMemberName,
  type StaffMember,
} from '@/types/competition'

// A judge, piper, sponsor or other staff member. Opened from a schedule
// event, `judging` answers why you tapped them: "Platform A · Highland
// Fling, Sword Dance".
const props = defineProps<{ member: StaffMember | null; morph?: Morph; judging?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const displayMember = ref<StaffMember | null>(null)
const displayJudging = ref<string | null>(null)
watch(
  () => props.member,
  (m) => {
    if (!m) return
    displayMember.value = m
    displayJudging.value = props.judging ?? null
  },
  { immediate: true },
)

const isOpen = computed(() => (props.morph ? props.morph.open : !!props.member))
const name = computed(() =>
  displayMember.value ? staffMemberName(displayMember.value) : '',
)
const entityRef = computed(() =>
  displayMember.value ? staffEntityRef(displayMember.value) : null,
)

// Going to their page: the sheet leaves with this page rather than shrinking
// back while the next one comes in.
const router = useRouter()
function leaving() {
  const off = router.afterEach(() => {
    off()
    props.morph?.dismiss()
  })
}
</script>

<template>
  <Dialog :open="isOpen" :morph="morph" variant="sheet" size="md" @close="emit('close')">
    <template v-if="displayMember" #header>
      <div class="flex items-center gap-3">
        <StaffAvatar :member="displayMember" :size="56" />
        <div class="min-w-0 flex-1 space-y-0.5">
          <p v-if="displayMember.type" class="text-muted-foreground text-sm font-medium">{{ displayMember.type }}</p>
          <h2 class="text-title">{{ name || '?' }}</h2>
        </div>
      </div>
    </template>

    <template v-if="displayMember">
      <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
        <p v-if="displayJudging" class="bg-blue-paper text-callout flex items-start gap-2.5 rounded-xl px-3.5 py-3">
          <Scale class="text-primary mt-0.5 size-4 shrink-0" />
          <span><span class="font-semibold">Judging here:</span> {{ displayJudging }}</span>
        </p>
        <p v-if="displayMember.location" class="text-muted-foreground text-base">{{ displayMember.location }}</p>
        <FavoriteButton v-if="entityRef" :id="entityRef.id" :type="entityRef.type" :name="name" labelled variant="tonal" />

        <div
          v-if="displayMember.description"
          class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline"
          v-html="sanitizeRichText(displayMember.description)"
        />

        <Button
          v-if="displayMember.website"
          :href="formatExternalURL(displayMember.website)"
          target="_blank"
          rel="noopener"
          class="max-w-full"
        >
          <ExternalLink />
          <span class="truncate">{{ formatHumanURL(displayMember.website) }}</span>
        </Button>

        <Button
          v-if="entityRef"
          variant="primary"
          size="lg"
          block
          :to="{
            name: `${entityRef.routePrefix}.info`,
            params: { [entityRef.idParam]: entityRef.id },
          }"
          @click="leaving"
        >
          See all their competitions
        </Button>
      </div>
    </template>
  </Dialog>
</template>
