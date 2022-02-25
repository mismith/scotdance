<template>
  <div class="PrintSchedule">
    <section v-for="day in toOrderedArray(schedule.days)" :key="day[idKey]">
      <header>
        <h2>{{ day.name }}</h2>
        <div v-html="day.description" class="pre-line" />
      </header>

      <article v-for="block in toOrderedArray(day.blocks)" :key="block[idKey]">
        <header>
          <h3>{{ block.name }}</h3>
          <div v-html="block.description" class="pre-line" />
        </header>

        <div
          v-for="event in toOrderedArray(block.events)"
          :key="event[idKey]"
        >
          <header v-if="!eventInfoInTableHeaders">
            <h4>{{ event.name }}</h4>
            <div v-html="event.description" class="pre-line" />
          </header>
          <table
            cellspacing="0"
            border="1"
          >
            <tr>
              <th v-if="eventInfoInTableHeaders" />
              <th />
              <th v-for="platform in platforms" :key="platform[idKey]">
                {{ platform.$name }}
              </th>
            </tr>
            <template v-for="(dance, danceIndex) in toOrderedArray(event.dances)">
              <template v-if="dance.danceId">
                <tr :key="dance[idKey]">
                  <th v-if="eventInfoInTableHeaders && !danceIndex" :rowspan="toOrderedArray(event.dances).length || 1">
                    <h4>{{ event.name }}</h4>
                    <div v-html="event.description" class="pre-line" />
                  </th>
                  <th>
                    {{ (findByIdKey(dances, dance.danceId) || {}).$shortName }}
                  </th>
                  <th v-for="platform in toOrderedArray(dance.platforms)" :key="platform[idKey]">
                    <span
                      v-for="judge in staff.filter(judge => platform.orderedJudgeIds && platform.orderedJudgeIds.includes(judge[idKey]))"
                      :key="judge[idKey]"
                      v-html="judge.lastName"
                      class="slash-separated"
                    />
                  </th>
                </tr>
                <tr
                  v-for="(_, index) in Array.from(Array(toOrderedArray(dance.platforms).reduce((max, platform) => Math.max(max, platform.orderedGroupIds ? platform.orderedGroupIds.length : 0), 0)))"
                  :key="index"
                >
                  <td />
                  <td v-for="p in platforms" :key="p[idKey]">
                    {{ (dance.platforms[p[idKey]] && dance.platforms[p[idKey]].orderedGroupIds && (findByIdKey(groups, dance.platforms[p[idKey]].orderedGroupIds[index]) || {}).$name) || '' }}
                  </td>
                </tr>
              </template>
              <template v-else>
                <tr :key="dance[idKey]">
                  <th v-if="eventInfoInTableHeaders && !danceIndex" :rowspan="toOrderedArray(event.dances).length || 1">
                    <h4>{{ event.name }}</h4>
                    <div v-html="event.description" class="pre-line" />
                  </th>
                  <th :colspan="platforms.length + 1">{{ dance.name }}</th>
                </tr>
              </template>
            </template>
          </table>
        </div>

        <br />
        <hr class="pb" />
      </article>
    </section>
  </div>
</template>

<script>
import { idKey, toOrderedArray } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';

export default {
  name: 'PrintSchedule',
  reactiveInject: {
    competitionBundle: [
      'groups',
      'dances',
      'staff',
      'platforms',
      'schedule',
    ],
  },
  props: {
    eventInfoInTableHeaders: {
      type: Boolean,
    },
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
  },
  methods: {
    toOrderedArray,
    findByIdKey,
  },
  components: {
  },
};
</script>

<style lang="scss">
.PrintSchedule {
}
</style>
