<template>
  <form @submit.prevent="handleSubmit" class="NewDynamicField layout align-center">
    <DynamicField :field="field" :data="data" class="flex" />
    <v-btn type="submit" icon color="primary" :disabled="!isValid">
      <v-icon>add</v-icon>
    </v-btn>
  </form>
</template>

<script>
import DynamicField from '@/components/admin/utility/DynamicField.vue';

export default {
  name: 'new-dymnamic-field',
  props: {
    field: {
      type: Object,
      default: () => ({ title: 'Name', data: 'name' }),
    },
  },
  data() {
    return {
      data: {
        [this.field.data]: undefined,
      },
    };
  },
  computed: {
    isValid() {
      return !!(this.data[this.field.data] || '').trim();
    },
  },
  methods: {
    handleSubmit() {
      this.$emit('change', {
        ...this.data,
      });

      this.data[this.field.data] = '';
    },
  },
  components: {
    DynamicField,
  },
};
</script>

<style lang="scss">
.NewDynamicField {
  .v-list & {
    padding-right: 2px;
  }
}
</style>
