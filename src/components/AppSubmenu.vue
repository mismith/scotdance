<template>
  <div class="AppSubmenu app-scroll-frame" v-test="'app-submenu'">
    <v-list>
      <v-slide-y-transition group hide-on-leave>
        <template v-for="group in groupedCompetitions">
          <v-subheader :key="group.name">
            <div class="flex">{{ group.name }}</div>
            <ConfirmClearButton
              v-if="clearable[group.name]"
              v-model="clearable[group.name].isConfirming"
              @confirmed="clearable[group.name].handler()"
              v-test="`app-submenu:group.${group.name}:action-button`"
            />
            <v-btn
              v-else
              rounded
              outlined
              x-small
              exact
              :to="{ name: 'competitions' }"
              v-test="`app-submenu:group.${group.name}:action-button`"
            >
              See All
            </v-btn>
          </v-subheader>
          <CompetitionListItem
            v-for="competition in group.competitions"
            :key="competition[idKey]"
            :competition="competition"
            :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
            v-test="`app-submenu:competition.${competition[idKey]}`"
          >
            <template #append>
              <v-list-item-action class="ml-0">
                <v-btn
                  icon
                  :color="competition.$pinned ? 'accent' : undefined"
                  @click.prevent.stop="togglePinnedCompetition(competition)"
                  v-test="`app-submenu:competition.${competition[idKey]}:pin`"
                >
                  <v-icon class="pin" :class="{ pinned: competition.$pinned }">
                    {{ competition.$pinned ? mdiPin : mdiPinOutline }}
                  </v-icon>
                </v-btn>
              </v-list-item-action>
            </template>
          </CompetitionListItem>
        </template>
      </v-slide-y-transition>
    </v-list>
  </div>
</template>

<script>
import orderBy from 'lodash.orderby';
import { mapMutations, mapActions } from 'vuex';
import { mdiPin, mdiPinOutline } from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import ConfirmClearButton from '@/components/ConfirmClearButton.vue';
import CompetitionListItem from '@/components/CompetitionListItem.vue';

export default {
  name: 'AppSubmenu',
  props: {
    competitions: Array,
    visible: Boolean,
  },
  data() {
    return {
      idKey,
      mdiPin,
      mdiPinOutline,

      clearable: {
        Pinned: {
          handler: () => this.unpinAll(),
          isConfirming: false,
        },
        'Recently Viewed': {
          handler: () => this.setViewed(['competitions']),
          isConfirming: false,
        },
      },
    };
  },
  computed: {
    groupedCompetitions() {
      this.resetClearConfirms();

      return [
        {
          name: 'Pinned',
          competitions: orderBy(
            this.competitions.filter(({ $pinned }) => $pinned),
            ['date', idKey],
            ['desc'],
          ),
        },
        {
          name: 'Recently Viewed',
          competitions: orderBy(
            this.competitions.filter(({ $viewed, $pinned }) => $viewed && !$pinned),
            ['$viewed', idKey],
            ['desc'],
          ),
        },
        {
          name: 'Other Competitions',
          competitions: orderBy(
            orderBy(this.competitions, ['$relevance'])
              .filter(({ $pinned, $viewed }) => !$pinned && !$viewed)
              .slice(0, 5),
            ['date', idKey],
            ['desc'],
          ),
        },
      ]
        .filter((group) => group.competitions.length);
    },
  },
  watch: {
    visible(visible) {
      if (!visible) {
        this.resetClearConfirms();
      }
    },
  },
  methods: {
    ...mapMutations([
      'setViewed',
    ]),
    ...mapActions([
      'togglePinnedCompetition',
    ]),

    async unpinAll() {
      await Promise.all(this.competitions.filter(({ $pinned }) => $pinned)
        .map((competition) => this.togglePinnedCompetition(competition)));
    },

    resetClearConfirms() {
      Object.keys(this.clearable).forEach((key) => {
        this.clearable[key].isConfirming = false;
      });
    },
  },
  components: {
    ConfirmClearButton,
    CompetitionListItem,
  },
};
</script>

<style lang="scss">
.AppSubmenu {
  .pin {
    &:not(.pinned) {
      transform: rotate(45deg);
    }
  }

  .v-subheader:not(:first-child) {
    margin-top: 32px;
  }

  .v-btn.v-size--x-small {
    opacity: 0.5;
  }
}
</style>
