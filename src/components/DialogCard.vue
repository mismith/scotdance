<template>
  <v-dialog
    ref="dialog"
    v-model="isOpen"
    :max-width="fullWidth ? 'none' : 300"
    class="DialogCard"
    @keydown.esc.stop="handleCancel"
  >
    <slot slot="activator" name="activator"></slot>
    <form @submit.prevent="handleSubmit" class="v-dialog--scrollable">
      <v-card>
        <slot name="title">
          <v-card-title v-if="title" v-html="title" class="title" />
        </slot>

        <slot name="text">
          <v-card-text>
            <slot>
              <div v-if="text" v-html="text"></div>
            </slot>
          </v-card-text>
        </slot>

        <slot name="actions">
          <v-card-actions class="justify-end">
            <slot name="cancel">
              <v-btn
                v-if="cancelLabel !== null"
                flat
                @click="handleCancel"
              >
                {{ cancelLabel }}
              </v-btn>
            </slot>
            <slot name="submit">
              <v-btn
                v-if="submitLabel !== null"
                flat
                color="primary"
                type="submit"
                :loading="loading"
                :disabled="disabled"
              >
                {{ submitLabel }}
              </v-btn>
            </slot>
          </v-card-actions>
        </slot>
      </v-card>
    </form>
  </v-dialog>
</template>

<script>
export default {
  name: 'DialogCard',
  props: {
    value: true,
    title: String,
    text: String,
    cancelLabel: {
      type: String,
      default: 'Done',
    },
    submitLabel: {
      type: String,
      default: null,
    },
    loading: Boolean,
    disabled: Boolean,
    fullWidth: Boolean,
    async: Boolean,
  },
  computed: {
    isOpen: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      },
    },
  },
  watch: {
    async isOpen(isOpen) {
      if (isOpen) {
        await this.$nextTick();
        const { $el } = this.$refs;
        if ($el) {
          const el = $el.querySelector('[type="submit"]');
          if (el) {
            el.focus();
          }
        }
      }
    },
  },
  methods: {
    async handleCancel() {
      this.$emit('cancel');

      await this.$nextTick();
      this.$refs.dialog.isActive = false;
      this.isOpen = false;
    },
    async handleSubmit() {
      this.$emit('submit');

      if (!this.async) {
        await this.$nextTick();
        this.$refs.dialog.isActive = false;
        this.isOpen = false;
      }
    },
  },
};
</script>
