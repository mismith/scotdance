<template>
  <Blades class="AdminInfo" stacks>
    <Blade id="blade-subsections" class="col-md-3 app-scroll">
      <v-list>
        <v-list-item
          v-for="subsection in toOrderedArray(section.subsections)"
          :key="subsection[idKey]"
          :to="{ name: 'competition.admin.info', params: { subsectionId: subsection[idKey] } }"
        >
          <v-list-item-avatar>
            <v-icon :class="subsection.icon" />
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ subsection.name }}</v-list-item-title>
          </v-list-item-content>
          <v-icon>mdi-chevron-right</v-icon>
        </v-list-item>
      </v-list>
    </Blade>
    <Blade id="blade-form" class="col-md-9 app-scroll app-scroll-frame">
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
        icon="mdi-settings"
        label="Competition settings"
      />
    </Blade>
  </Blades>
</template>

<script>
import {
  idKey,
  toOrderedArray,
} from '@/helpers/firebase';
import MiHotTable from '@/components/admin/MiHotTable.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';
import AdminInvites from '@/components/admin/Invites.vue';

export default {
  name: 'AdminInfo',
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
  watch: {
    currentSubsection: {
      async handler(currentSubsection) {
        // scroll to blade, if necessary
        await this.$nextTick();
        const id = currentSubsection ? 'form' : 'subsections';
        const element = document.getElementById(`blade-${id}`);
        this.$scrollTo(element, { container: this.$el });
      },
      immediate: true,
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
    MiHotTable,
    DynamicForm,
    AdminInvites,
  },
};
</script>
