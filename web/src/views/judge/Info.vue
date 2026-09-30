<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useJudgeProfile } from '@/composables/useJudgeProfile'
import StaffProfileBody from '@/components/StaffProfileBody.vue'

const route = useRoute()
const p = useJudgeProfile()
const id = computed(() => String(route.params.judgeId ?? ''))
</script>

<template>
  <StaffProfileBody
    kind="judges"
    :id="id"
    :name="p.displayName.value"
    :location="p.location.value"
    :image="p.image.value"
    :bio="p.bio.value"
    :loading="p.loading.value"
    :appearances="p.appearances.value"
  />
</template>
