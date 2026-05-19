<script setup lang="ts">
import { computed } from 'vue'
import { staffMemberName, type StaffMember } from '@/types/competition'

const props = withDefaults(
  defineProps<{ member: StaffMember; size?: number; favorite?: boolean }>(),
  { size: 40, favorite: false },
)

const name = computed(() => staffMemberName(props.member))
</script>

<template>
  <img
    v-if="member.image"
    :src="member.image"
    :alt="name"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :class="[
      'shrink-0 rounded-full object-cover',
      favorite ? 'bg-secondary ring-secondary ring-2' : 'bg-muted',
    ]"
  />
</template>
