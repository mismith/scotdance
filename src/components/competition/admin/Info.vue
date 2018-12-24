<template>
  <blades class="admin-info" :stacks="true">
    <blade id="blade-subsections" class="xs12 md3 app-scroll alt">
      <v-list>
        <v-list-tile
          v-for="subsection in toOrderedArray(section.subsections)"
          :key="subsection[idKey]"
          :to="{ name: 'competition.admin.info', params: { subsectionId: subsection[idKey] } }"
        >
          <v-list-tile-content>
            <v-list-tile-title>{{ subsection.title }}</v-list-tile-title>
          </v-list-tile-content>
          <v-icon>chevron_right</v-icon>
        </v-list-tile>
      </v-list>
    </blade>
    <blade id="blade-form" class="xs12 md9 app-scroll">
      <template v-if="currentSubsection">
        <dynamic-form
          v-if="currentSubsection.fields"
          :fields="currentSubsection.fields"
          :data="competition"
          class="pa-3"
          @change="handleChanges"
        />
        <template v-if="inTabs('permissions')">
          <admin-invites v-bind="$props" />
        </template>

        <v-spacer />
        <div v-if="inTabs('general')" class="layout align-center justify-center flex-none">
          <v-btn flat color="error" @click="confirmRemove = true">
            Delete Competition
          </v-btn>
          <dialog-card
            v-model="confirmRemove"
            title="Delete competition"
            text="Are you sure you want to permanently delete this competition?"
            cancel-label="No"
            submit-label="Yes"
            @submit="handleRemove"
          />
        </div>
      </template>
      <empty-state
        v-else
        icon="settings"
        label="Competition settings"
      />
    </blade>
  </blades>
</template>

<script>
import {
  idKey,
  toOrderedArray,
} from '@/helpers/firebase';
import DynamicForm from '@/components/admin/utility/DynamicForm.vue';
import AdminInvites from '@/components/competition/admin/utility/Invites.vue';

export default {
  name: 'admin-info',
  props: {
    competitionId: String,
    subsectionId: String,
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
    currentSubsection() {
      return (this.section.subsections || {})[this.subsectionId];
    },
  },
  methods: {
    toOrderedArray,

    inTabs(...tabs) {
      return tabs.some(tab => this.subsectionId === tab);
    },

    async handleRemove() {
      await Promise.all([
        this.competitionRef.remove(),
        this.competitionDataRef.remove(),
      ]);
      this.$router.replace({ name: 'competitions' });
    },

    handleChanges(...args) {
      this.$emit('info-change', ...args);
    },
  },
  components: {
    DynamicForm,
    AdminInvites,
  },
};
</script>

<style lang="scss">
.admin-info {

}
</style>
