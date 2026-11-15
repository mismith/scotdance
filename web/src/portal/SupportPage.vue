<script setup lang="ts">
import { onMounted } from 'vue'
import Button from '@/components/ui/Button.vue'
import { useConnectAccount } from './account'
import { openSupport } from './support'
const store = useConnectAccount()
onMounted(() => { void store.run(openSupport) })
</script>
<template>
  <section class="space-y-5">
    <h1 class="text-hero">Support</h1>
    <Button variant="primary" :busy="store.busy" @click="store.run(openSupport)">Open chat</Button>
  </section>
</template>
