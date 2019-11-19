<template>
  <div class="AdminPlatforms white" :class="{ interactive: admin }">
    <div v-if="!isEmpty" class="pools">
      <div
        v-for="pool in pools"
        :key="pool[idKey]"
        class="pool"
        :class="{ empty: !pool.$items.length }"
      >
        <v-subheader>{{ pool.$name || pool.name }}</v-subheader>

        <draggable
          v-model="pool.$items"
          group="items"
          :disabled="!admin"
          @sort="handleSort(pool)"
          class="draggable"
        >
          <v-chip
            v-for="poolItem in pool.$items"
            :key="poolItem[idKey]"
            :color="getChipColor(poolItem)"
            :dark="!!getChipColor(poolItem)"
            :disabled="getChipColor(poolItem) === null"
            :style="{ visibility: !admin && getChipColor(poolItem) === null && 'hidden' }"
            class="ma-1"
            @click="!admin && $emit('item-click', poolItem)"
          >
            {{ poolItem.$name || poolItem.name }}
          </v-chip>
        </draggable>
      </div>
    </div>
    <EmptyState
      v-else-if="admin && !danceGroups.length"
      icon="mdi-alert"
      label="No dance groups found"
      >
      <router-link :to="{ name: 'competition.admin.dance-groups' }">
        <span class="subtitle-1">Configure some first &rsaquo;</span>
      </router-link>
    </EmptyState>
    <EmptyState
      v-else-if="admin"
      icon="mdi-alert"
      label="No platforms found"
      >
      <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'platforms' } }">
        <span class="subtitle-1">Add at least one platform first &rsaquo;</span>
      </router-link>
    </EmptyState>
    <v-list-item v-else class="empty">
      <v-list-item-avatar>
        <v-icon>mdi-close</v-icon>
      </v-list-item-avatar>
      <v-list-item-content>
        No more info.
      </v-list-item-content>
    </v-list-item>

    <footer v-if="admin && !isEmpty" class="pa-3">
      <v-btn text :disabled="!item.platforms" @click="handleCopy">Copy</v-btn>
      <v-btn text :disabled="clipboard.type !== 'platforms'" @click="handlePaste">Paste</v-btn>
      <v-btn text :disabled="!judges.length" @click="handleCycleJudges">Cycle Judges</v-btn>
    </footer>
  </div>
</template>

<script>
import Draggable from 'vuedraggable';
import {
  mapState,
  mapMutations,
} from 'vuex';
import {
  findByIdKey,
  hydrateByIdKey,
  hasFavorites,
} from '@/helpers/competition';
import { findGroupDancers, isPlaceholderId } from '@/helpers/results';
import { idKey } from '@/helpers/firebase';

function getPlaceholderSlot(timestamp = undefined) {
  return {
    [idKey]: timestamp || Date.now(),
    name: 'Spacer',
  };
}

export default {
  name: 'AdminPlatforms',
  props: {
    path: String,
    item: Object,
    groups: Array,
    dances: Array,
    dancers: Array,
    staff: Array,
    platforms: Array,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    ...mapState([
      'clipboard',
    ]),

    admin() {
      return !!this.path;
    },
    danceGroups() {
      return this.groups.filter((group) => {
        const dance = findByIdKey(this.dances, this.item.danceId);
        return dance && dance.groupIds && dance.groupIds[group[idKey]];
      });
    },
    unassignedDanceGroups() {
      return this.danceGroups.filter((group) => {
        return !Object.values(this.item.platforms || {}).some((platform) => {
          return (platform.orderedGroupIds || []).includes(group[idKey]);
        });
      });
    },
    judges() {
      return this.staff.filter(this.isJudge);
    },
    unassignedJudges() {
      return this.judges.filter((judge) => {
        return !Object.values(this.item.platforms || {}).some((platform) => {
          return (platform.orderedJudgeIds || []).includes(judge[idKey]);
        });
      });
    },
    pools() {
      // join items into a single array for sorting
      const pools = [
        ...this.platforms.map((platform) => {
          const poolPlatform = this.item && this.item.platforms && this.item.platforms[platform[idKey]];
          const $items = poolPlatform ? [
            ...hydrateByIdKey(poolPlatform.orderedJudgeIds, this.judges),
            ...hydrateByIdKey(poolPlatform.orderedGroupIds, [
              ...this.danceGroups,
              ...(poolPlatform.orderedGroupIds || [])
                .filter(isPlaceholderId)
                .map(getPlaceholderSlot),
            ]),
          ].filter(Boolean) : [];
          return {
            ...platform,
            $items,
          };
        }),
      ];

      if (this.admin) {
        pools.push({
          name: 'Unassigned',
          $items: [
            ...this.unassignedJudges,
            ...this.unassignedDanceGroups,
            getPlaceholderSlot(),
          ],
        });
      }

      return pools;
    },

    isEmpty() {
      return !(this.platforms.length && this.pools.some(pool => pool.$items.length));
    },
  },
  methods: {
    ...mapMutations([
      'copy',
    ]),

    isJudge: item => item.type === 'Judge',

    getChipColor(poolItem) {
      if (hasFavorites(findGroupDancers(poolItem, this.dancers))) {
        return 'secondary';
      }
      if (this.isJudge(poolItem)) {
        return 'primary';
      }
      if (isPlaceholderId(poolItem[idKey])) {
        return null;
      }
      return undefined;
    },

    handleSort(pool) {
      if (!pool[idKey]) return; // skip if removing from unassigned pool
      if (!this.path) return; // can't save changes if we don't know where to save to

      // pluck items of proper type of of joined sorting array
      const orderedGroupIds = pool.$items.filter(item => !this.isJudge(item)).map(group => group[idKey]);
      const orderedJudgeIds = pool.$items.filter(this.isJudge).map(judge => judge[idKey]);
      this.$emit('change', {
        [`${this.path}/platforms/${pool[idKey]}/orderedGroupIds`]: orderedGroupIds,
        [`${this.path}/platforms/${pool[idKey]}/orderedJudgeIds`]: orderedJudgeIds,
      });
    },

    handleCopy() {
      this.copy({
        data: this.item.platforms,
        type: 'platforms',
      });
    },
    handlePaste() {
      if (!this.clipboard.type === 'platforms') return; // ensure proper data type
      if (!this.path) return; // can't save changes if we don't know where to save to

      this.$emit('change', {
        [`${this.path}/platforms`]: this.clipboard.data,
      });
    },

    handleCycleJudges() {
      if (!this.item || !this.path) return; // can't save changes if we don't know where to save to

      // find the first platform's first assigned judge (if any)
      let judgeIndexOffset = 0;
      this.platforms.some(({ [idKey]: platformId }) => {
        if (
          this.item.platforms
          && this.item.platforms[platformId]
          && this.item.platforms[platformId].orderedJudgeIds
          && this.item.platforms[platformId].orderedJudgeIds.length
        ) {
          const [judgeId] = this.item.platforms[platformId].orderedJudgeIds;
          const judgeIndex = this.judges.findIndex(({ [idKey]: id }) => id === judgeId);
          if (judgeIndex >= 0) {
            // decrement by one to rotate judges around
            judgeIndexOffset = judgeIndex - 1;
            // wrap around if out of range
            if (judgeIndexOffset < 0) {
              judgeIndexOffset += this.judges.length;
            }
            // no need to keep looping now that we've found a match
            return true;
          }
        }
        return false;
      });

      // spread judges across all platforms, offsetting based on the first match found
      const judgeIds = this.judges.map(({ [idKey]: judgeId }) => judgeId);
      const cycledJudgeIds = judgeIds
        .slice(judgeIndexOffset, judgeIds.length)
        .concat(judgeIds.slice(0, judgeIndexOffset));
      const judgesPerPlatform = Math.floor(this.judges.length / this.platforms.length) || 1;
      const changes = this.platforms.reduce((acc, platform, index) => ({
        ...acc,
        [`${this.path}/platforms/${platform[idKey]}/orderedJudgeIds`]: cycledJudgeIds
          .slice(index * judgesPerPlatform, (index + 1) * judgesPerPlatform),
      }), {});
      this.$emit('change', changes);
    },
  },
  components: {
    Draggable,
  },
};
</script>

<style lang="scss">
@keyframes bounce-in {
  0% {
    transform: translate3d(50%, 0, 0);
    opacity: 0;
  }
  50% {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
  66% {
    transform: translate3d(6%, 0, 0);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
}
.AdminPlatforms {
  .pools {
    display: flex;

    .pool {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      flex-grow: 1;

      .draggable {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        flex-grow: 1;
        min-height: 64px;
      }
    }
  }
  &:not(.interactive) {
    .pools {
      animation: bounce-in 300ms 150ms ease-in both;

      .pool {
        &.empty {
          display: none;
        }
      }
    }
  }
  &.interactive {
    .pools {
      flex-wrap: wrap;

      .pool {
        .draggable {
          border: 1px dashed #999;
          border-radius: 20px;
          margin: 4px;

          .v-chip,
          .v-chip * {
            cursor: move;
          }
        }
      }
    }
  }
}
</style>
