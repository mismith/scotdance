<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { FileSpreadsheet } from '@lucide/vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'

// The old admin's best advice, shown until dancers exist: importing the entry
// list builds the categories and age groups too.
const m = useManagedCompetition()
</script>

<template>
  <div v-if="!m.dancers.value.length" class="bg-next text-next-foreground m-4 space-y-2 rounded-2xl p-4">
    <p class="flex gap-2.5 text-[0.9375rem] font-semibold">
      <FileSpreadsheet class="mt-0.5 size-5 shrink-0" />
      <span>Almost always, import your dancers from a spreadsheet. That also creates and links their age groups and categories, so there’s usually no need to fill these in first.</span>
    </p>
    <RouterLink :to="{ name: 'manage.dancers.import', params: { competitionId: m.competitionId.value } }" class="ml-7.5 inline-block font-bold underline underline-offset-2">
      Import dancers
    </RouterLink>
  </div>
</template>
