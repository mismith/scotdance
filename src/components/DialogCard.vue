<template>
  <v-dialog
    ref="dialog"
    v-model="isOpen"
    :max-width="fullWidth ? 'none' : 300"
    scrollable
    class="DialogCard"
    @keydown.esc.stop="handleCancel"
  >
    <template #activator="props">
      <slot name="activator" v-bind="props" />
    </template>
    <form @submit.prevent="handleSubmit" class="v-dialog--scrollable">
      <v-card>
        <slot name="title">
          <v-card-title v-if="title" v-html="$sanitize(title)" class="title" />
        </slot>

        <slot name="text">
          <v-card-text>
            <slot>
              <div v-if="text" v-html="$sanitize(text)"></div>
            </slot>
          </v-card-text>
        </slot>

        <slot name="actions">
          <v-card-actions class="justify-end">
            <slot name="cancel">
              <v-btn
                v-if="cancelLabel !== null"
                text
                @click="handleCancel"
              >
                {{ cancelLabel }}
              </v-btn>
            </slot>
            <slot name="submit">
              <v-btn
                v-if="submitLabel !== null"
                text
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
    value: Boolean,
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
    async close() {
      await this.$nextTick();
      this.isOpen = false;
      if (this.$refs.dialog) {
        this.$refs.dialog.isActive = false;
      }
    },
    handleCancel() {
      this.$emit('cancel');
      this.close();
    },
    handleSubmit() {
      this.$emit('submit');

      if (!this.async) {
        this.close();
      }
    },
  },
};
</script>
