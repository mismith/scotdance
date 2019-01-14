<template>
  <div class="competitions-submit app-scroll-frame app-scroll alt">
    <v-stepper v-model="currentStep" vertical class="flex-none pb-3">
      <v-stepper-step
        :step="1"
        :complete="currentStep > 1"
        :editable="currentStep > 1 && !submitting && !submitted"
      >
        Submissions Overview
      </v-stepper-step>
      <v-stepper-content :step="1">
        Are you involved in organizing a competition that could benefit from {{ $store.state.$package.$name }}?<br />Simply begin the process below at least <strong>one month before</strong> your event's start date.

        <v-list style="max-width: 540px;">
          <template v-for="checklist in checklists">
            <header :key="checklist[idKey]" v-html="checklist.title" class="mt-4 mb-3" />
            <v-list-group
              v-for="item in checklist.items"
              :key="item.title"
              v-model="item.$active"
            >
              <v-layout slot="activator" align-center class="py-2">
                <v-icon :color="item.$active ? 'primary' : 'grey'" :large="$vuetify.breakpoint.smAndUp" class="ml-2">
                  {{ item.icon || 'check' }}
                </v-icon>
                <div class="ml-3" :class="{ subheading: $vuetify.breakpoint.smAndUp, 'primary--text': item.$active }">
                  {{ item.title }}
                </div>
              </v-layout>

              <v-card flat>
                <v-card-text v-html="item.description" />
              </v-card>
            </v-list-group>
          </template>
        </v-list>

        <footer class="mt-2">
          <v-btn color="primary" class="mx-0" @click="handleStart">Start</v-btn>
        </footer>
      </v-stepper-content>

      <template v-for="(step, index) in steps">
        <v-stepper-step
          :key="step[idKey]"
          :step="index + 2"
          :complete="step.$isValid"
          :editable="step.$isDirty && !submitting && !submitted"
        >
          {{ step.name }}
        </v-stepper-step>
        <v-stepper-content :key="step[idKey]" :step="index + 2">
          <div class="layout wrap">
            <dynamic-form
              v-model="step.$isValid"
              :fields="step.fields"
              :data="submission[step[idKey]]"
              class="flex"
              @field-input="handleStepInput(step, $event)"
              @submit="handleStepSubmit(step)"
            >
              <footer class="mt-2">
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="submitting"
                  class="mx-0"
                >
                  {{ step.submitLabel || 'Next' }}
                </v-btn>
              </footer>
            </dynamic-form>
            <div v-if="step[idKey] === 'competition'" class="flex md4 ml-4 hidden-sm-and-down">
              <figure class="device-frame mb-3">
                <div class="device-frame-content application theme--light app-scroll layout column">
                  <v-toolbar dark color="primary">
                    <v-toolbar-title class="title">{{ $store.state.$package.$name }}</v-toolbar-title>
                  </v-toolbar>
                  <competition-info :competition="preview" :staff="[]" />
                </div>
                <figcaption class="device-frame-caption">App Preview</figcaption>
              </figure>
            </div>
          </div>
        </v-stepper-content>
      </template>
    </v-stepper>

    <div v-if="submitted" class="pa-3">
      <empty-state
        icon="mail_outline"
        label="All done!"
        description="Expect a confirmation email in your inbox momentarily."
      >
        <p class="mt-3">Your submission will be reviewed <strong>within 7 days</strong>, and you will receive another email once approved.</p>

        <v-btn color="primary" @click="handleRestart">Submit Another Competition</v-btn>
      </empty-state>
    </div>
  </div>
</template>

<script>
import { idKey, db, toOrderedArray } from '@/helpers/firebase';
import steps, { checklists } from '@/schemas/submissions';
import DynamicForm from '@/components/admin/utility/DynamicForm.vue';
import AccountButtons from '@/components/utility/AccountButtons.vue';
import CompetitionInfo from '@/components/competition/Info.vue';

export default {
  name: 'competitions-submit',
  data() {
    return {
      idKey,

      steps: undefined,
      currentStep: undefined,

      preview: undefined,
      submission: undefined,
      submitting: false,
      submitted: false,

      checklists: toOrderedArray(checklists),
    };
  },
  methods: {
    reset() {
      this.steps = toOrderedArray(steps).map(step => ({
        $isDirty: false,
        $isValid: false,
        ...step,
      }));
      this.currentStep = 1;

      this.preview = {};
      this.submission = this.steps.reduce((submission, step) => ({
        ...submission,
        [step[idKey]]: (step.fields || []).reduce((fields, field) => ({
          ...fields,
          [field.data]: field.default || null,
        }), {}),
      }), {});
      this.submitted = false;
    },

    handleStart() {
      const start = () => {
        this.submission.contact = {
          name: this.$store.state.me.displayName,
          email: this.$store.state.me.email,
          ...this.submission.contact,
        };
        this.currentStep += 1;
      };
      if (this.$store.state.me) {
        return start();
      }

      // auto-advance post-auth...
      this.$store.commit('addPostLoginCallback', start);

      // ...while opening dialog to inform user they need to login
      return this.$store.commit('setCurrentDialog', 'submissions');
    },

    handleStepInput(step, change) {
      step.$isDirty = true; // eslint-disable-line no-param-reassign

      if (step[idKey] === 'competition') {
        this.preview = {
          ...this.preview,
          ...change,
        };
      }
    },
    async handleStepSubmit(step) {
      if (step.$isValid) {
        if (this.currentStep === this.steps.length + 1) {
          await this.handleSubmit();
        }
        this.currentStep += 1;
      }
    },
    async handleSubmit() {
      this.submitting = true;

      await db.child('competitions:submissions').push({
        ...this.submission,
        submitted: this.$moment().format(),
        userId: this.$store.state.me[idKey],
      });

      this.submitting = false;
      this.submitted = true;
    },

    async handleRestart() {
      this.reset();
    },
  },
  created() {
    this.reset();
  },
  components: {
    DynamicForm,
    AccountButtons,
    CompetitionInfo,
  },
};
</script>

<style lang="scss">
.competitions-submit {
  .device-frame {
    max-width: 400px;
    background-color: #333;
    padding: 24px;
    border-radius: 24px;
    border: solid 4px #999;

    .device-frame-content {
      min-height: 400px;
      max-height: 600px;
    }
    .device-frame-caption {
      color: #ccc;
      text-align: center;
      margin-top: 12px;
      margin-bottom: -12px;
    }
  }
}
</style>
