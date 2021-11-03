<template>
  <Blades class="Series app-scroll-frame">
    <Blade :active="!currentSerie" class="col-md-4 app-scroll">
      <v-subheader>Series</v-subheader>
      <v-list>
        <SerieListItem
          v-for="serie in series"
          :key="serie[idKey]"
          :serie="serie"
          :to="{ params: { serieId: serie[idKey] } }"
        />
      </v-list>
    </Blade>
    <Blade :active="currentSerie" class="col-md-8">
      <BladeToolbar
        :to="{ name: $route.name }"
        class="hidden-md-and-up"
      />

      <div v-if="currentSerie" class="app-scroll">
        <section class="pa-4">
          <v-avatar
            v-if="currentSerie.image"
            color="white"
            size="200"
            class="elevation-2 mb-4"
            :class="{ 'ml-3': $vuetify.breakpoint.mdAndUp }"
            :style="{ float: $vuetify.breakpoint.mdAndUp ? 'right' : undefined }"
          >
            <img :src="currentSerie.image" />
          </v-avatar>

          <h1 class="display-1 mb-4">{{ currentSerie.name }}</h1>
          <p class="headline serie-name" v-if="currentSerie.shortName">
            {{ currentSerie.shortName }}
          </p>

          <div
            v-if="currentSerie.description"
            v-html="currentSerie.description"
            class="pre-line"
          />
        </section>

        <v-list expand class="grouped">
          <v-list-group :value="true">
            <template #activator>
              <v-subheader>Competitions</v-subheader>
            </template>

            <v-list>
              <CompetitionListItem
                v-for="competition in serieCompetitions"
                :key="competition[idKey]"
                :competition="{
                  ...competition,
                  $image: competition.image,
                  $serie: null,
                }"
                :to="{
                  name: 'competition.info',
                  params: { ...$route.params, competitionId: competition[idKey] },
                }"
              >
                <template #action><span /></template>
              </CompetitionListItem>
            </v-list>
          </v-list-group>
        </v-list>
      </div>
      <EmptyState
        v-else
        icon="mdi-set-none"
        label="Competition Series"
        description="Events spanning multiple days, or recurring throughout a season"
      />
    </Blade>
  </Blades>
</template>

<script>
import { idKey } from '@/helpers/firebase';
import SerieListItem from '@/components/SerieListItem.vue';
import CompetitionListItem from '@/components/CompetitionListItem.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';

export default {
  name: 'Series',
  reactiveInject: {
    competitionsBundle: [
      'competitions',
      'series',
    ],
  },
  props: {
    serieId: String,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    currentSerie() {
      return this.series.find(({ [idKey]: id }) => id === this.serieId);
    },
    serieCompetitions() {
      return this.competitions.filter(({ serieId }) => serieId === this.serieId);
    },
  },
  components: {
    SerieListItem,
    CompetitionListItem,
    BladeToolbar,
  },
};
</script>

<style lang="scss">
.Series {
  section {
    &::after {
      content: " ";
      display: table;
      clear: both;
    }
  }
}
</style>
