<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePiperProfile } from '@/composables/usePiperProfile'
import StaffProfileBody from '@/components/StaffProfileBody.vue'

const route = useRoute()
const p = usePiperProfile()
const id = computed(() => String(route.params.piperId ?? ''))
</script>

<template>
  <StaffProfileBody
    kind="pipers"
    :id="id"
    :name="p.displayName.value"
    :location="p.location.value"
    :image="p.image.value"
    :bio="p.bio.value"
    :loading="p.loading.value"
    :appearances="p.appearances.value"
  />
</template>
