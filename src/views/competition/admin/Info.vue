<template>
  <AdminSubsections
    :section="section"
    :subsection-id="subsectionId"
    class="CompetitionAdminInfo"
  >
    <template #form="{ currentSubsection }">
      <template v-if="currentSubsection">
        <MiHotTable
          v-if="currentSubsection.hot"
          :settings="currentSubsection.hot"
          :data="toOrderedArray(competition[subsectionId])"
          @change="handleInfoSubsectionChanges"
        />
        <DynamicForm
          v-else-if="currentSubsection.fields"
          :fields="currentSubsection.fields"
          :data="competition"
          class="pa-4"
          @field-change="handleInfoChanges"
        />
        <AdminInvites v-else-if="inTabs('permissions')" v-bind="$props" />

        <v-spacer />
        <div v-if="inTabs('general')" class="d-flex align-center justify-center flex-none pa-3">
          <v-btn text color="error" @click="confirmRemove = true">
            Delete Competition
          </v-btn>
          <DialogCard
            v-model="confirmRemove"
            title="Delete competition"
            text="Are you sure you want to permanently delete this competition?"
            cancel-label="No"
            submit-label="Yes"
            @submit="handleRemove"
          />
        </div>
      </template>
      <EmptyState
        v-else
        :icon="mdiCog"
        label="Competition settings"
      />
    </template>
  </AdminSubsections>
</template>

<script>
import { mdiChevronRight, mdiCog } from '@mdi/js';
import { idKey, toOrderedArray } from '@/helpers/firebase';
import AdminSubsections from '@/components/admin/Subsections.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';
import AdminInvites from '@/components/admin/Invites.vue';

export default {
  name: 'CompetitionAdminInfo',
  props: {
    competitions: Array,
    competitionsRef: Object,
    competition: Object,
    competitionRef: Object,
    competitionDataRef: Object,
    competitionId: String,
    section: Object,
    subsectionId: String,
  },
  data() {
    return {
      idKey,
      mdiChevronRight,
      mdiCog,

      confirmRemove: false,
    };
  },
  methods: {
    toOrderedArray,

    inTabs(...tabs) {
      return tabs.some((tab) => this.subsectionId === tab);
    },

    async handleRemove() {
      await Promise.all([
        this.competitionRef.remove(),
        this.competitionDataRef.remove(),
      ]);
      this.$router.replace({ name: 'competitions' });
    },

    handleInfoChanges(...args) {
      this.$emit('info-change', ...args);
    },
    handleInfoSubsectionChanges(changes) {
      Object.entries(changes).forEach(([path, change]) => {
        this.handleInfoChanges({
          [`${this.subsectionId}/${path}`]: change,
        });
      });
    },
  },
  components: {
    AdminSubsections,
    MiHotTable,
    DynamicForm,
    AdminInvites,
  },
};
</script>
