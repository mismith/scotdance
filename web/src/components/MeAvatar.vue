<script setup lang="ts">
import { ref, watch } from 'vue'
import Avatar from '@/components/Avatar.vue'
import { gravatarUrl } from '@/lib/gravatar'
import { useMeStore } from '@/stores/me'

// You, as a circle: your Gravatar picture, or your initials. The same
// everywhere you appear (the account button, the sidebar, your Account page).
withDefaults(defineProps<{ size?: 'xs' | 'lg' }>(), { size: 'xs' })

const me = useMeStore()
const image = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => (image.value = await gravatarUrl(email, 200)),
  { immediate: true },
)
</script>

<template>
  <Avatar :name="me.displayName || me.email || '?'" :image="image" :size="size" you />
</template>
