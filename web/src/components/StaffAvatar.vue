<script setup lang="ts">
import { computed, ref } from 'vue'
import { Award } from '@lucide/vue'
import { initialsOf, nameHue } from '@/lib/format'
import { staffMemberName, type StaffMember } from '@/types/competition'

// A staff member's photo, or their initials on a disc when there isn't one
// (or it won't load). Sponsors are usually businesses and societies, so they
// get a glyph instead of initials. The name always sits beside it, so the
// disc itself says nothing to screen readers.
const props = withDefaults(defineProps<{ member: StaffMember; size?: number }>(), { size: 40 })

const name = computed(() => staffMemberName(props.member))
const sponsor = computed(() => /sponsor/i.test(props.member.type ?? ''))
const broken = ref(false)
// Initials on a soft colour of their own, from their name (as in Contacts).
const hue = computed(() => nameHue(name.value))
</script>

<template>
  <img
    v-if="member.image && !broken"
    :src="member.image"
    loading="lazy"
    decoding="async"
    alt=""
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="bg-muted shrink-0 rounded-full object-cover"
    @error="broken = true"
  />
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-[oklch(0.93_0.05_var(--h))] font-bold tracking-[0.01em] text-[oklch(0.45_0.13_var(--h))] select-none dark:bg-[oklch(0.34_0.06_var(--h))] dark:text-[oklch(0.88_0.08_var(--h))]"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px`, '--h': hue }"
    aria-hidden="true"
  >
    <Award v-if="sponsor" :style="{ width: `${size * 0.5}px`, height: `${size * 0.5}px` }" />
    <template v-else>{{ initialsOf(name) }}</template>
  </span>
</template>
