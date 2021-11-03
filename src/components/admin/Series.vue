<template>
  <Blades class="AdminSeries stacks">
    <Blade class="col-md-4 app-scroll">
      <v-subheader class="d-flex">
        <div class="flex">
          Series
        </div>

        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn v-on="on" icon @click="handleCreate()">
              <v-icon>{{ mdiPlus }}</v-icon>
            </v-btn>
          </template>
          <span>Add new series</span>
        </v-tooltip>
      </v-subheader>
      <v-radio-group :value="competition.serieId" class="pa-0 ma-0">
        <v-list avatar>
          <SerieListItem
            v-for="availableSerie in availableSeries"
            :key="availableSerie[idKey]"
            :serie="availableSerie"
            :to="{ params: { itemId: availableSerie[idKey] } }"
          >
            <template #action>
              <v-list-item-action>
                <v-radio
                  :value="availableSerie[idKey]"
                  @change="v => handleToggle(availableSerie[idKey], competition, v)"
                />
              </v-list-item-action>
            </template>
          </SerieListItem>

          <v-list-item v-if="!availableSeries.length" class="empty">
            <v-list-item-avatar>
              <v-icon>{{ mdiClose }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              No series yet. <a @click="handleCreate()">Add one.</a>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-radio-group>
    </Blade>
    <Blade class="col-md-8 app-scroll">
      <template v-if="currentSerie">
        <DynamicForm
          :fields="fields"
          :data="currentSerie"
          class="pa-4"
          @field-input="handleChange"
        />

        <v-list expand class="grouped">
          <v-list-group v-model="isCompetitionListExpanded">
            <template #activator>
              <v-subheader>
                Competitions Included ({{ Object.keys(currentSerie.competitions || {}).length }})
              </v-subheader>
            </template>
            <v-list>
              <CompetitionListItem
                v-for="availableCompetition in availableCompetitions"
                :key="availableCompetition[idKey]"
                :competition="{
                  ...availableCompetition,
                  $image: availableCompetition.image,
                  $serie: null,
                }"
                :to="{
                  name: 'competition.admin.info',
                  params: { ...$route.params, competitionId: availableCompetition[idKey] },
                }"
              >
                <template #action>
                  <v-switch
                    v-if="!(availableCompetition.serieId && availableCompetition.serieId !== serieId)"
                    class="ml-3"
                    :input-value="availableCompetition.serieId === serieId"
                    @change="v => handleToggle(serieId, availableCompetition, v)"
                    @click.prevent
                  />
                  <span v-else />
                </template>
              </CompetitionListItem>
            </v-list>
          </v-list-group>
        </v-list>

        <v-spacer />
        <div class="d-flex align-center justify-center flex-none pa-3">
          <v-btn text color="error" @click="confirmRemove = true">
            Delete Series
          </v-btn>
          <DialogCard
            v-model="confirmRemove"
            title="Delete series"
            text="Are you sure you want to permanently delete this series, thereby unlinking it from any/all competitions?"
            cancel-label="No"
            submit-label="Yes"
            @submit="handleRemove()"
          />
        </div>
      </template>

      <EmptyState
        v-else
        :icon="mdiSetNone"
        label="Link competitions together"
        description="Group multiple day events into an overarching series"
      />
    </Blade>

    <DialogCard
      :value="confirmCreate"
      title="Add new series:"
      cancel-label="Cancel"
      submit-label="Add"
      :disabled="!(confirmCreateValue || '').trim()"
      @cancel="confirmCreate.reject()"
      @submit="confirmCreate.resolve()"
    >
      <template #text>
        <div class="app-scroll px-4">
          <v-text-field ref="confirmCreateValue" v-model="confirmCreateValue" label="Series Name" />
        </div>
      </template>
    </DialogCard>
  </Blades>
</template>

<script>
import { mapState } from 'vuex';
import { mdiClose, mdiPlus, mdiSetNone } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import competitionAdminSchema from '@/schemas/competition-admin';
import DynamicForm from '@/components/admin/DynamicForm.vue';
import SerieListItem from '@/components/SerieListItem.vue';
import CompetitionListItem from '@/components/CompetitionListItem.vue';

export default {
  name: 'AdminSeries',
  reactiveInject: {
    competitionsBundle: [
      'series',
      'seriesRef',
      'competitions',
      'competitionsRef',
    ],
    competitionBundle: [
      'competition',
      'competitionId',
    ],
  },
  localStorage: {
    isCompetitionListExpanded: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      mdiClose,
      mdiPlus,
      mdiSetNone,

      idKey,
      fields: competitionAdminSchema.info.subsections.series.fields,

      currentSerie: undefined,

      confirmCreate: undefined,
      confirmCreateValue: undefined,
      confirmRemove: false,
    };
  },
  computed: {
    ...mapState([
      'myPermissions',
    ]),

    serieId() {
      return this.$route.params.itemId;
    },
    availableSeries() {
      // only show series that contain only competitions that user has permissions to
      return this.series
        .filter(({ competitions = {} }) => Object.keys(competitions)
          .every((competitionId) => this.$store.getters
            .hasPermission(`competitions/${competitionId}`)));
    },
    availableCompetitions() {
      // only show competitions that user has permissions to
      return this.competitions
        .filter(({ [idKey]: competitionId }) => this.$store.getters
          .hasPermission(`competitions/${competitionId}`));
    },
  },
  watch: {
    serieId: {
      handler(serieId, previousItemId) {
        if (serieId !== previousItemId) {
          if (this.currentSerie) this.$unbind('currentSerie');
          if (serieId) {
            const serieRef = this.seriesRef.child(serieId);
            this.$bindAsObject('currentSerie', serieRef);
          }
        }
      },
      immediate: true,
    },
    async confirmCreate(confirmCreate) {
      if (!confirmCreate) {
        this.confirmCreateValue = undefined;
      } else {
        await this.$nextTick();
        this.$refs.confirmCreateValue.focus();
      }
    },
  },
  methods: {
    isInSeries(serieId, competition) {
      return competition.serieId === serieId;
    },
    async handleToggle(serieId, competition, on = serieId !== competition.serieId) {
      const val = on ? true : null;
      if (on && competition.serieId && competition.serieId !== serieId) {
        throw new Error('Already linked');
      }
      await Promise.all([ // @TODO: enforce only one serie per competition
        this.competitionsRef.child(competition[idKey]).child('serieId').set(on ? serieId : null),
        this.seriesRef.child(serieId).child('competitions').child(competition[idKey]).set(val),
      ]);
    },
    async handleChange(changes) {
      await this.seriesRef.child(this.currentSerie[idKey]).update(changes);
    },
    async handleCreate() {
      try {
        await new Promise((resolve, reject) => {
          this.confirmCreate = { resolve, reject };
        });
        const serie = {
          name: this.confirmCreateValue,
        };
        const { key: serieId } = await this.seriesRef.push(serie);
        await this.handleToggle(serieId, this.competition, true); // @TODO: enforce only one
        this.$router.push({ ...this.$route, params: { ...this.$route.params, itemId: serieId } });
      } catch (err) {
        if (err) console.error(err); // eslint-disable-line no-console
      } finally {
        this.confirmCreate = null;
        this.confirmCreateValue = undefined;
      }
    },
    async handleRemove() {
      await Promise.all([
        ...Object.keys(this.currentSerie.competitions)
          .map((competitionId) => this.handleToggle(this.serieId, {
            [idKey]: competitionId,
          }, false)),
        this.seriesRef.child(this.serieId).remove(),
      ]);
      this.$router.replace({ ...this.$route, params: { ...this.$route.params, itemId: null } });
    },
  },
  components: {
    DynamicForm,
    SerieListItem,
    CompetitionListItem,
  },
};
</script>

<style lang="scss">
.AdminSeries {
  .v-list-item {
    .v-radio {
      margin-right: 0;
    }
  }
}
</style>
