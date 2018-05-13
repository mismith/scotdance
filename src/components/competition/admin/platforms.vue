<template>
  <div class="admin-platforms" :class="{ interactive: admin }">
    <div v-if="platforms.length" class="pools">
      <div v-for="pool in pools" :key="pool[idKey]" class="pool">
        <md-subheader>{{ pool.$name || pool.name }}</md-subheader>

        <draggable
          v-model="pool.$items"
          :options="{ group: 'items', disabled: !admin }"
          @sort="handleSort(pool)"
          class="draggable"
        >
          <md-chip
            v-for="poolItem in pool.$items"
            :key="poolItem[idKey]"
            @click="!admin && !poolItem.type && $router.push({
              name: 'competition.results',
              params: { groupId: poolItem[idKey], danceId: item.danceId }
            })"
            :class="{ 'md-primary': isJudge(poolItem) }"
          >
            {{ poolItem.$name || poolItem.name }}
          </md-chip>
        </draggable>
      </div>
    </div>
    <md-empty-state
      v-else
      md-icon="warning"
      md-label="No platforms"
      md-description="Add at least one platform first"
    />

    <footer v-if="admin">
      <md-button
        :disabled="!item.platforms"
        @click="handleCopy"
      >Copy</md-button>
      <md-button
        :disabled="clipboard.type !== 'platforms'"
        @click="handlePaste"
      >Paste</md-button>
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
} from '@/helpers/competition';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'admin-platforms',
  props: {
    path: String,
    item: Object,
    groups: Array,
    dances: Array,
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

    isJudge: item => item.type === 'Judge',

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
  },
  components: {
    Draggable,
  },
};
</script>

<style lang="scss">
.admin-platforms {
  .pools {
    display: flex;

    .pool {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      flex-grow: 1;

      .md-subheader {
        flex-grow: 0 !important;
      }
      .draggable {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        flex-grow: 1;
        min-height: 64px;

        .md-chip {
          margin: 1px 4px;
        }
      }
    }
  }
  &.interactive {
    flex-wrap: wrap;

    .pools {
      .pool {
        .draggable {
          padding: 4px 0;
          border: 1px dashed #999;
          border-radius: 20px;

          .md-chip {
            cursor: move;
          }
        }

        &:last-child {
          width: 100%;
          flex: none;
        }
      }
    }
  }
}
</style>
