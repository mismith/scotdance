<template>
  <div class="admin-platforms white" :class="{ interactive: admin }">
    <div v-if="platforms.length" class="pools">
      <div
        v-for="pool in pools"
        :key="pool[idKey]"
        class="pool"
        :class="{ empty: !pool.$items.length }"
      >
        <v-subheader>{{ pool.$name || pool.name }}</v-subheader>

        <draggable
          v-model="pool.$items"
          :options="{ group: 'items', disabled: !admin }"
          @sort="handleSort(pool)"
          class="draggable"
        >
          <v-chip
            v-for="poolItem in pool.$items"
            :key="poolItem[idKey]"
            :color="hasFavorites(findGroupDancers(poolItem, dancers)) ? 'secondary' : (isJudge(poolItem) && 'primary')"
            @click="!admin && $emit('item-click', poolItem)"
          >
            {{ poolItem.$name || poolItem.name }}
            <v-icon v-if="!admin" right>more_vert</v-icon>
          </v-chip>
        </draggable>
      </div>
    </div>
    <div v-else>
      <empty-state
        icon="warning"
        label="No platforms"
        description="Add at least one platform first"
      />
    </div>

    <footer v-if="admin">
      <v-btn flat :disabled="!item.platforms" @click="handleCopy">Copy</v-btn>
      <v-btn flat :disabled="clipboard.type !== 'platforms'" @click="handlePaste">Paste</v-btn>
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
import { findGroupDancers } from '@/helpers/results';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'admin-platforms',
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
            ...hydrateByIdKey(poolPlatform.orderedGroupIds, this.danceGroups),
          ].filter(item => item || null) : [];
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
          ],
        });
      }

      return pools;
    },
  },
  methods: {
    ...mapMutations([
      'copy',
    ]),

    findGroupDancers,
    hasFavorites,

    isJudge: item => item.type === 'Judge',

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
.admin-platforms {
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
      animation: bounce-in 300ms 150ms ease-in forwards;
      opacity: 0;

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
