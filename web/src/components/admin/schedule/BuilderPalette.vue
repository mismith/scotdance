<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BuilderChip from './BuilderChip.vue'
import { newSpacerId, useBuilder } from './builder'

// What can go in the schedule, to drag into it. These are only listed here:
// they're added and changed in their own Manage sections.

const b = useBuilder()
const to = (name: string) => ({
  name,
  params: { competitionId: b.m.competitionId.value },
})
const steps = (s?: string | number) => String(s ?? '').trim()
</script>

<template>
  <div class="space-y-5">
    <section class="space-y-1.5">
      <header class="flex items-baseline justify-between gap-2">
        <h2 class="text-eyebrow">Dances</h2>
        <RouterLink :to="to('manage.dances')" class="text-primary text-sm font-bold"
          >Edit</RouterLink
        >
      </header>
      <div class="flex flex-wrap gap-1.5 md:flex-col">
        <BuilderChip
          v-for="(d, i) in b.dances.value"
          :key="d.id"
          kind="dance"
          :label="b.danceName(d.id)"
          :title="d.label"
          :data="
            () => ({
              type: 'dance',
              danceId: d.id,
              rowId: '',
              index: i,
              source: 'palette',
            })
          "
        >
          {{ b.danceName(d.id)
          }}<span v-if="steps(d.steps)" class="ml-1 font-normal opacity-60"
            >({{ steps(d.steps) }})</span
          >
        </BuilderChip>
      </div>
      <p v-if="!b.dances.value.length" class="text-muted-foreground text-sm">None yet.</p>
    </section>

    <section class="space-y-1.5">
      <header class="flex items-baseline justify-between gap-2">
        <h2 class="text-eyebrow">Age groups</h2>
        <RouterLink :to="to('manage.groups')" class="text-primary text-sm font-bold"
          >Edit</RouterLink
        >
      </header>
      <template
        v-for="c in [...b.categories.value, { id: '', label: 'Other' }]"
        :key="c.id"
      >
        <div v-if="b.groupsByCategory.value.get(c.id)?.length" class="space-y-1">
          <h3 class="text-muted-foreground pt-1 text-sm font-bold">{{ c.label }}</h3>
          <div class="flex flex-wrap gap-1.5 md:flex-col">
            <BuilderChip
              v-for="(g, i) in b.groupsByCategory.value.get(c.id)"
              :key="g.id"
              kind="group"
              :label="g.name?.trim() || g.label"
              :title="g.label"
              :data="
                () => ({ type: 'group', groupId: g.id, index: i, source: 'palette' })
              "
            />
          </div>
        </div>
      </template>
      <p v-if="!b.m.groups.value.length" class="text-muted-foreground text-sm">
        None yet.
      </p>
      <BuilderChip
        v-else
        kind="spacer"
        label="Spacer"
        title="Spacer: drag between age groups on a platform to show a gap"
        class="mt-2 w-fit md:w-auto"
        :data="
          () => ({ type: 'group', groupId: newSpacerId(), index: 0, source: 'palette' })
        "
      />
    </section>

    <section class="space-y-1.5">
      <header class="flex items-baseline justify-between gap-2">
        <h2 class="text-eyebrow">Judges</h2>
        <RouterLink :to="to('manage.staff')" class="text-primary text-sm font-bold"
          >Edit</RouterLink
        >
      </header>
      <div class="flex flex-wrap gap-1.5 md:flex-col">
        <BuilderChip
          v-for="(j, i) in b.judges.value"
          :key="j.id"
          kind="judge"
          :label="j.label"
          :data="() => ({ type: 'judge', judgeId: j.id, index: i, source: 'palette' })"
        />
      </div>
      <p v-if="!b.judges.value.length" class="text-muted-foreground text-sm">None yet.</p>
    </section>
  </div>
</template>
