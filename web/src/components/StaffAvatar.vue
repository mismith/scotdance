<script setup lang="ts">
import { computed } from 'vue'
import { staffMemberName, type StaffMember } from '@/types/competition'

const props = withDefaults(
  defineProps<{ member: StaffMember; size?: number }>(),
  { size: 40 },
)

const name = computed(() => staffMemberName(props.member))
</script>

<template>
  <img
    v-if="member.image"
    :src="member.image"
    :alt="name"
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="bg-muted shrink-0 rounded-full object-cover"
  />
</template>
