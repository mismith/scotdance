<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import { formatExternalURL, formatHumanURL } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import {
  staffEntityRef,
  staffMemberName,
  type StaffMember,
} from '@/types/competition'

const props = defineProps<{ member: StaffMember | null }>()
const emit = defineEmits<{ close: [] }>()

const displayMember = ref<StaffMember | null>(null)
watch(
  () => props.member,
  (m) => {
    if (m) displayMember.value = m
  },
  { immediate: true },
)

const isOpen = computed(() => !!props.member)
const name = computed(() =>
  displayMember.value ? staffMemberName(displayMember.value) : '',
)
const entityRef = computed(() =>
  displayMember.value ? staffEntityRef(displayMember.value) : null,
)
</script>

<template>
  <Dialog :open="isOpen" variant="sheet" size="md" @close="emit('close')">
    <template v-if="displayMember" #header>
      <div class="flex items-center gap-3">
        <StaffAvatar :member="displayMember" :size="56" />
        <div class="min-w-0 flex-1 space-y-0.5">
          <p v-if="displayMember.type" class="text-muted-foreground text-sm font-bold">{{ displayMember.type }}</p>
          <h2 class="text-title">{{ name || '?' }}</h2>
        </div>
      </div>
    </template>

    <template v-if="displayMember">
      <div class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
        <p v-if="displayMember.location" class="text-muted-foreground text-base">{{ displayMember.location }}</p>
        <FavoriteButton v-if="entityRef" :id="entityRef.id" :type="entityRef.type" :name="name" labelled />

        <div
          v-if="displayMember.description"
          class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline"
          v-html="sanitizeRichText(displayMember.description)"
        />

        <a
          v-if="displayMember.website"
          :href="formatExternalURL(displayMember.website)"
          target="_blank"
          rel="noopener"
          class="bg-card border-strong inline-flex h-11 items-center gap-1.5 rounded-full border px-4 font-bold"
        >
          <ExternalLink class="size-4" />
          {{ formatHumanURL(displayMember.website) }}
        </a>


        <RouterLink
          v-if="entityRef"
          :to="{
            name: `${entityRef.routePrefix}.info`,
            params: { [entityRef.idParam]: entityRef.id },
          }"
          class="bg-primary text-primary-foreground flex h-12 items-center justify-center rounded-xl text-base font-bold"
        >
          See all their competitions
        </RouterLink>
      </div>
    </template>
  </Dialog>
</template>
