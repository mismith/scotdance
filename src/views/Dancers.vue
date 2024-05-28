<template>
  <Blades class="Dancers app-scroll-frame app-scroll" stacks>
    <Blade class="col-md-4 app-scroll-frame">
      <v-toolbar class="flex-none">
        <SearchField v-model="q" :loading="isSearching" :disabled="!me" v-test="'search-dancers:search-field'" />
      </v-toolbar>
      <template v-if="!me">
        <RequiresPermission class="ma-auto pa-4 pb-8" />
      </template>
      <v-list v-else-if="results.length" class="app-scroll">
        <v-list-item
          v-for="result in results"
          :key="result.name"
          :to="{ name: $route.name, query: { ...$route.query, s: result.name } }"
          exact
        >
          <v-list-item-avatar :color="result.dancers.some(({ $favorite }) => $favorite) ? 'secondary' : 'grey'">
            {{ result.initials }}
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ result.name }}</v-list-item-title>
          </v-list-item-content>
          <v-icon>{{ mdiChevronRight }}</v-icon>
        </v-list-item>
      </v-list>
      <EmptyState
        v-else-if="q && !isSearching"
        :icon="mdiClose"
        label="No dancers match"
      />
    </Blade>
    <Blade ref="detailsRef" class="col-md-8 app-scroll">
      <template v-if="currentResult && me">
        <header v-if="allDancers.length > 1" class="d-flex justify-end pa-4">
          <v-btn small color="secondary" :outlined="isAllFavorited" @click="handleFavoriteAll(!isAllFavorited)">
            <v-icon class="mr-2">{{ mdiStarShooting }}</v-icon>
            {{isAllFavorited ? 'Unfavourite' : 'Favourite'}} all
          </v-btn>
        </header>
        <v-list expand class="grouped">
          <v-list-group
            v-for="group in currentResultGroups"
            :key="group[idKey]"
            :value="true"
          >
            <template #activator>
              <v-subheader>
                <div class="flex text-truncate pr-3">
                  {{ group.competition.name }}
                </div>
                <div class="dot-divided text-truncate">
                  <span v-if="group.competition.date">{{ $moment(group.competition.date).format('MMM D, YYYY') }}</span>
                  <span v-if="group.competition.location">{{ group.competition.location }}</span>
                </div>
              </v-subheader>
            </template>

            <v-list two-line>
              <DancerListItem
                v-for="dancer in group.dancers"
                :key="dancer[idKey]"
                :dancer="dancer"
                :loading="isLoading"
                :to="{ name: 'competition.dancers', params: { competitionId: dancer.$competitionId, dancerId: dancer[idKey] } }"
              >
                <Spinner v-if="isLoading" size="32" />
              </DancerListItem>
            </v-list>
          </v-list-group>
        </v-list>
        <footer class="d-flex justify-center pa-3 mb-3">
          <v-btn text small color="error" @click="handleReportMismatch">Report a Mismatch</v-btn>
        </footer>
      </template>
      <EmptyState
        v-else
        :icon="mdiMagnify"
        label="Search for dancers"
        description="Discover which competitions they have participated in"
      />
    </Blade>
  </Blades>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import {
  mdiChevronRight,
  mdiClose,
  mdiMagnify,
  mdiStarShooting,
} from '@mdi/js';
import orderBy from 'lodash.orderby';
import groupBy from 'lodash.groupby';
import { idKey, fns, cache } from '@/helpers/firebase';
import {
  groupExtender,
  dancerExtender,
  initialify,
} from '@/helpers/competition';
import RequiresPermission from '@/components/RequiresPermission.vue';
import SearchField from '@/components/SearchField.vue';
import DancerListItem from '@/components/DancerListItem.vue';
import EmptyState from '@/components/EmptyState.vue';
import Spinner from '@/components/Spinner.vue';

const searchDancers = fns.httpsCallable('searchDancers');

export default {
  name: 'Dancers',
  reactiveInject: {
    competitionsBundle: [
      'competitionsRef',
      'competitionsDataRef',
    ],
  },
  localStorage: {
    q: {
      type: String,
      default: '',
    },
    s: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      mdiChevronRight,
      mdiClose,
      mdiMagnify,
      mdiStarShooting,

      idKey,

      isSearching: false,
      searchResults: [],
      isLoading: false,
      dancers: undefined,
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    results() {
      return this.searchResults?.grouped_hits?.map((group) => {
        const name = group?.group_key[0] || '';
        return {
          name,
          initials: initialify(name),
          dancers: group.hits?.map(({ document: { id, ...data } }) => {
            const dancer = {
              [idKey]: id,
              ...data,
            };
            // extend to allow showing favorites immediately
            return dancerExtender(dancer, [], this.$store);
          }),
        };
      }) || [];
    },
    currentResult() {
      return this.results?.find(({ name }) => name === this.s);
    },

    allDancers() {
      return this.currentResultGroups.flatMap((group) => group.dancers);
    },
    isAllFavorited() {
      return this.currentResultGroups.every((group) => group.dancers.every(({ $favorite }) => $favorite));
    },
  },
  asyncComputed: {
    async currentResultGroups() {
      if (this.dancers || this.currentResult?.dancers) {
        const grouped = groupBy(this.dancers || this.currentResult.dancers, (dancer) => dancer.$competitionId);
        const currentResultGroups = await Object.entries(grouped)
          .reduce(async (acc, [competitionId, dancers]) => {
            const competition = cache.competitions[competitionId] || (await this.competitionsRef.child(competitionId).get()).val();
            if (!cache.competitions[competitionId]) {
              cache.competitions[competitionId] = competition;
            }
            if (competition) {
              return (await acc).concat({
                [idKey]: competitionId,
                competition,
                dancers,
              });
            }
            return acc;
          }, []);
        return orderBy(
          currentResultGroups,
          [
            ['competition', 'date'],
            ['competition', idKey],
          ],
          ['desc'],
        );
      }
      return [];
    },
  },
  watch: {
    async me() {
      if (this.q) {
        await this.search(this.q);
      }
    },
    '$route.query.q': {
      handler(q) {
        if (this.q !== q) {
          this.q = q || '';
        }
      },
      immediate: true,
    },
    '$route.query.s': {
      handler(s) {
        if (this.s !== s) {
          this.s = s || '';
        }
      },
      immediate: true,
    },
    q: {
      handler(q) {
        if (!this.me) return;

        if (q !== this.$route.query.q) {
          this.$router.replace({ name: this.$route.name, query: { ...this.$route.query, q } });
        }
        if (!q && this.s) {
          this.$router.replace({ name: this.$route.name, query: { ...this.$router.query, s: '' } });
        }

        this.search(q);
      },
      immediate: true,
    },
    s: {
      async handler(s) {
        if (!this.me) return;

        if (s !== this.$route.query.s) {
          this.$router.replace({ name: this.$route.name, query: { ...this.$route.query, s } });
        }

        // scroll to details, if necessary
        await this.$nextTick();
        this.$scrollTo(this.$refs.detailsRef?.$el, { container: this.$el });
      },
      immediate: true,
    },
    currentResult() {
      this.hydrateCurrentResult();
    },
  },
  mounted() {
    this.$store.commit('setViewed', ['ui', 'search-dancers', true]);
  },
  methods: {
    ...mapActions([
      'help',
      'toggleFavoriteDancer',
    ]),

    async search(q) {
      this.isSearching = true;
      try {
        if (q) {
          const { data } = await searchDancers({
            q,
            group_by: '$name',
            group_limit: 99,
            per_page: 99,
          });
          this.$set(this, 'searchResults', data);
        } else {
          this.$set(this, 'searchResults', []);
          await this.$nextTick();
        }
      } catch (error) {
        console.error(error); // eslint-disable-line no-console
      }
      this.isSearching = false;
    },
    async hydrateCurrentResult() {
      if (!this.currentResult?.dancers) return;

      // clear old values while loading from new result
      this.dancers = undefined;
      this.isLoading = true;

      try {
        const start = Date.now();
        this.dancers = await Promise.all(
          this.currentResult.dancers.map(async (dancer, i) => {
            const groups = [];
            if (dancer.$competitionId && dancer.groupId) {
              const groupPath = `${dancer.$competitionId}/groups/${dancer.groupId}`;
              const group = cache.groups[groupPath] || (await this.competitionsDataRef.child(groupPath).get()).val();
              if (!cache.groups[groupPath]) {
                cache.groups[groupPath] = group;
              }
              const categories = [];
              if (group?.categoryId) {
                const categoryPath = `${dancer.$competitionId}/categories/${group.categoryId}`;
                const category = cache.categories[categoryPath] || (await this.competitionsDataRef.child(categoryPath).get()).val();
                if (!cache.categories[categoryPath]) {
                  cache.categories[categoryPath] = category;
                }
                categories.push({ [idKey]: group.categoryId, ...category });
              }
              groups.push(groupExtender({ [idKey]: dancer.groupId, ...group }, i, categories));
            }
            return dancerExtender(dancer, groups, this.$store);
          }),
        );
        const elapsed = Date.now() - start;
        const minLoading = 1000;
        if (elapsed > 50 && elapsed < minLoading) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, minLoading - elapsed)));
        }
      } catch (error) {
        console.error(error); // eslint-disable-line no-console
      }
      this.isLoading = false;
    },

    async handleFavoriteAll(on = true) {
      await Promise.all(this.currentResultGroups
        .flatMap((group) => group.dancers
          .map((dancer) => this.toggleFavoriteDancer({ ...dancer, $favorite: !on }))));
    },

    handleReportMismatch() {
      const canGetHelp = this.help(true) !== undefined;
      if (!canGetHelp) return;

      window.$crisp.push([
        'do',
        'message:send',
        ['text', `I think there might be a mismatch on this page: ${this.$route.fullPath}`],
      ]);
    },
  },
  components: {
    SearchField,
    DancerListItem,
    EmptyState,
    Spinner,
    RequiresPermission,
  },
};
</script>
