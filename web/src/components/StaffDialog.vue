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
          <div
            v-if="displayMember.type"
            class="text-foreground/65 text-xs text-eyebrow"
          >
            {{ displayMember.type }}
          </div>
          <h2 class="text-2xl leading-tight font-medium tracking-tight">
            {{ name || '?' }}
          </h2>
        </div>
        <FavoriteButton
          v-if="entityRef"
          :id="entityRef.id"
          :type="entityRef.type"
          :name="name"
          class="-mr-2 shrink-0"
        />
      </div>
    </template>

    <template v-if="displayMember">
      <div class="space-y-3 p-4">
        <div
          v-if="displayMember.location"
          class="text-item-subtitle text-muted-foreground"
        >
          {{ displayMember.location }}
        </div>

        <div
          v-if="displayMember.description"
          class="text-lg"
          v-html="sanitizeRichText(displayMember.description)"
        />

        <a
          v-if="displayMember.website"
          :href="formatExternalURL(displayMember.website)"
          target="_blank"
          rel="noopener"
          class="bg-card hover:bg-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5"
        >
          <ExternalLink class="size-4" />
          {{ formatHumanURL(displayMember.website) }}
        </a>

        <p
          v-if="!displayMember.description && !displayMember.website"
          class="text-muted-foreground italic"
        >
          No bio yet.
        </p>

        <RouterLink
          v-if="entityRef"
          :to="{
            name: `${entityRef.routePrefix}.info`,
            params: { [entityRef.idParam]: entityRef.id },
          }"
          class="text-primary hover:text-primary/80 inline-block px-1 py-2 text-sm font-medium"
        >
          View profile →
        </RouterLink>
      </div>
    </template>
  </Dialog>
</template>
