<template>
  <Blades class="AdminSubsections" stacks>
    <Blade id="blade-subsections" class="col-md-3 app-scroll">
      <v-list>
        <v-list-item
          v-for="subsection in toOrderedArray(section.subsections)"
          :key="subsection[idKey]"
          :to="{ name: routeName, params: { subsectionId: subsection[idKey] } }"
        >
          <v-list-item-avatar>
            <v-icon :class="subsection.icon.startsWith('icon-') ? subsection.icon : undefined">
              {{ subsection.icon }}
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ subsection.name }}</v-list-item-title>
          </v-list-item-content>
          <v-icon>{{ mdiChevronRight }}</v-icon>
        </v-list-item>
      </v-list>
    </Blade>
    <Blade id="blade-form" class="col-md-9 app-scroll app-scroll-frame">
      <slot name="form" v-bind="{ currentSubsection }" />
    </Blade>
  </Blades>
</template>

<script>
import { mdiChevronRight } from '@mdi/js';
import { idKey, toOrderedArray } from '@/helpers/firebase';

export default {
  name: 'AdminSubsections',
  props: {
    section: Object,
    subsectionId: String,
    routeName: String,
  },
  data() {
    return {
      idKey,
      mdiChevronRight,
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
  },
};
</script>
