<template>
  <blades class="admin-info" :stacks="true">
    <blade id="blade-subtabs" class="md-small-size-100 md-size-25 md-scroll">
      <md-list>
        <md-list-item
          v-for="subtab in toOrderedArray(section.subtabs)"
          :key="subtab[idKey]"
          :to="{ name: 'competition.admin.info', params: { subtabId: subtab[idKey] } }"
        >
          <div class="md-list-item-text">{{ subtab.title }}</div>
          <md-icon>chevron_right</md-icon>
        </md-list-item>
      </md-list>
    </blade>
    <blade id="blade-form" class="md-small-size-100 md-size-75 md-scroll">
      <div v-if="currentSubtab">
        <dynamic-form
          v-if="currentSubtab.fields"
          :fields="currentSubtab.fields"
          :data="competition"
          class="md-padding"
          @change="handleChanges"
        />
        <footer
          v-if="inTabs('general')"
          class="md-layout md-alignment-center"
          style="margin-top: auto;"
        >
          <md-button @click="confirmRemove = true" class="md-accent">
            Delete Competition
          </md-button>
          <md-dialog-confirm
            :md-active.sync="confirmRemove"
            md-title="Delete competition"
            md-content="Are you sure you want to permanently delete this competition?"
            md-confirm-text="Yes"
            md-cancel-text="No"
            @md-confirm="handleRemove"
          />
        </footer>
      </div>
      <div v-else>
        <md-empty-state
          md-icon="settings"
          md-label="Competition settings"
        />
      </div>
    </blade>
  </blades>
</template>

<script>
import {
  idKey,
  toOrderedArray,
} from '@/helpers/firebase';
import DynamicForm from '@/components/admin/utility/DynamicForm.vue';

export default {
  name: 'admin-info',
  props: {
    competitionId: String,
    subtabId: String,
    competitionRef: {
      type: Object,
      required: true,
    },
    competitionDataRef: {
      type: Object,
      required: true,
    },
    section: Object,
    competition: Object,
  },
  data() {
    return {
      idKey,

      confirmRemove: false,
    };
  },
  computed: {
    currentSubtab() {
      return (this.section.subtabs || {})[this.subtabId];
    },
  },
  methods: {
    toOrderedArray,

    inTabs(...tabs) {
      return tabs.some(tab => this.subtabId === tab);
    },

    async handleRemove() {
      await this.awaitSave(
        this.competitionRef.remove(),
        this.competitionDataRef.remove(),
      );
      this.$router.replace('/');
    },

    handleChanges(...args) {
      this.$emit('info-change', ...args);
    },
  },
  components: {
    DynamicForm,
  },
};
</script>

<style lang="scss">
.admin-info {

}
</style>
