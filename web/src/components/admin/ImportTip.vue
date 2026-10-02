<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { FileSpreadsheet } from '@lucide/vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'

// The old admin's best advice, shown until dancers exist: importing the entry
// list builds the categories and age groups too.
const m = useManagedCompetition()
</script>

<template>
  <div v-if="!m.dancers.value.length" class="bg-blue-paper m-4 flex gap-3 rounded-2xl p-4 text-callout">
    <FileSpreadsheet class="text-primary mt-0.5 size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <p>Importing your entry list also creates its categories and age groups.</p>
      <RouterLink
        :to="{ name: 'manage.dancers.import', params: { competitionId: m.competitionId.value } }"
        class="text-primary -mb-3 flex min-h-11 w-fit items-center font-semibold underline-offset-2 hover:underline"
      >
        Import dancers
      </RouterLink>
    </div>
  </div>
</template>
