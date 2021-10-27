<template>
  <AdminSubsections
    :section="section"
    :subsection-id="subsectionId"
    class="AdminInfo"
  >
    <template #form="{ currentSubsection }">
      <template v-if="currentSubsection">
        <MiHotTable
          v-if="currentSubsection.hot"
          :settings="currentSubsection.hot"
          :data="toOrderedArray(info[subsectionId])"
          @change="handleSubsectionChange"
        />
        <DynamicForm
          v-else-if="currentSubsection.fields"
          :fields="currentSubsection.fields"
          :data="info[subsectionId]"
          @field-change="handleSubsectionChange"
          class="pa-4"
        />
      </template>
      <EmptyState
        v-else
        :icon="mdiCogBox"
        label="App Admin"
      />
    </template>
  </AdminSubsections>
</template>

<script>
import { mdiCogBox, mdiCalendarMultiple } from '@mdi/js';
import { idKey, toOrderedArray } from '@/helpers/firebase';
import AdminSubsections from '@/components/admin/Subsections.vue';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';

export default {
  name: 'AdminInfo',
  reactiveInject: {
    adminBundle: [
      'section',
      'versions',
      'faqs',
      'submissions',
      'users',
    ],
  },
  props: {
    subsectionId: String,
  },
  data() {
    return {
      idKey,
      mdiCogBox,
      mdiCalendarMultiple,
    };
  },
  computed: {
    info() {
      return {
        versions: this.versions,
        faqs: this.faqs,
      };
    },
  },
  methods: {
    toOrderedArray,

    handleSubsectionChange(changes) {
      const subsectionChanges = Object.entries(changes).reduce((acc, [path, change]) => {
        acc[`${this.subsectionId}/${path}`] = change;
        return acc;
      }, {});
      this.$emit('change', subsectionChanges);
    },
  },
  components: {
    AdminSubsections,
    MiHotTable,
    DynamicForm,
  },
};
</script>
