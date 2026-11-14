<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'
import { useMeStore } from '@/stores/me'

withDefaults(defineProps<{ size?: 'xs' | 'lg' }>(), { size: 'xs' })
const me = useMeStore()
</script>

<template>
  <Avatar
    :name="me.displayName || me.email || '?'"
    :email="me.email"
    :image="me.photoURL"
    :size="size"
    you
  />
</template>
