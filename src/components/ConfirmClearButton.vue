<template>
  <v-btn
    rounded
    outlined
    x-small
    class="ConfirmClearButton"
    :style="{ opacity: value ? 1 : undefined }"
    @click.stop="handleClick()"
  >
    Clear<v-expand-x-transition><span v-if="value">?</span></v-expand-x-transition>
  </v-btn>
</template>

<script>

export default {
  name: 'ConfirmClearButton',
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    handleClick() {
      if (this.value) {
        this.$emit('confirmed');
        this.$emit('input', false);
      } else {
        this.$emit('confirming');
        this.$emit('input', true);
      }
    },
  },
};
</script>
