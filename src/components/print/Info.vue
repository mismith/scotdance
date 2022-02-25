<template>
  <section class="PrintInfo">
    <img v-if="competition.image" :src="competition.image" alt="" class="md-4" />
    <h1 class="display-1 mb-4">{{ competition.name }}</h1>
    <h2 v-if="competition.date" class="mb-4">
      {{ $moment(competition.date).format('dddd, MMMM D, YYYY') }}
    </h2>
    <h4 class="mb-4">
      <div v-if="competition.venue">{{ competition.venue }}</div>
      <div v-if="competition.address">{{ competition.address }}</div>
      <div>{{ competition.location }}</div>
    </h4>

    <div v-if="competition.description" v-html="competition.description" class="mb-4 pre-line" />
    <div v-if="competition.sobhd" class="mb-4">
      <small>{{ competition.sobhd }}</small>
    </div>

    <article
      v-for="(group, name) in groupedStaff"
      :key="name"
      class="mb-4"
    >
      <header>
        <h4>{{ name }}s</h4>
      </header>

      <div v-for="member in group" :key="member[idKey]">
        {{ member.$name }}<template v-if="member.location">, {{ member.location}}</template>
      </div>
    </article>
    <hr class="pb" />
  </section>
</template>

<script>
import groupBy from 'lodash.groupby';

export default {
  name: 'PrintInfo',
  reactiveInject: {
    competitionBundle: [
      'competition',
      'staff',
    ],
  },
  computed: {
    groupedStaff() {
      return groupBy(this.staff.filter((member) => member.type), 'type');
    },
  },
};
</script>
