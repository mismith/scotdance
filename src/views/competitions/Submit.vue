<template>
  <div class="CompetitionsSubmit app-scroll-frame app-scroll alt">
    <!-- @TODO: scrolling not working on mobile? -->
    <v-stepper v-model="currentStep" vertical class="flex-none pb-4">
      <v-stepper-step
        :step="1"
        :complete="currentStep > 1"
        :editable="currentStep > 1 && !submitting && !submitted"
      >
        Submissions Overview
      </v-stepper-step>
      <v-stepper-content :step="1">
        Are you involved in organizing a competition that could benefit from {{ $store.state.$package.$name }}?<br />Simply begin the process below at least <strong>one month before</strong> your event's start date.

        <div v-for="checklist in checklists" :key="checklist[idKey]" v-test="'submit:step.start'">
          <header v-html="$sanitize(checklist.title)" class="mt-6 mb-4" />
          <v-list flat style="max-width: 540px;">
            <v-list-group
              v-for="item in checklist.items"
              :key="item.title"
              v-model="item.$active"
            >
              <template #activator>
                <div class="d-flex align-center py-2 mr-auto">
                  <v-icon
                    :color="item.$active ? 'primary' : 'grey'"
                    :large="$vuetify.breakpoint.smAndUp"
                    class="ml-2"
                  >
                    {{ item.icon || mdiCheck }}
                  </v-icon>
                  <div class="ml-4" :class="{
                    'subtitle-1': $vuetify.breakpoint.smAndUp,
                    'primary--text': item.$active,
                  }">
                    {{ item.title }}
                  </div>
                </div>
              </template>

              <v-card text>
                <v-card-text v-html="$sanitize(item.description)" />
              </v-card>
            </v-list-group>
          </v-list>
        </div>

        <footer class="mt-5">
          <v-btn color="primary" class="mx-0" @click="handleStart" v-test="'submit:start'">Start</v-btn>
          <v-btn v-if="$store.getters.hasPermission('admin')" color="secondary" class="stripes ml-3" @click="handleSkip" v-test="'submit:skip'">
            Skip
          </v-btn>
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
          <div class="d-flex flex-wrap" v-test="`submit:step.${step[idKey]}`">
            <DynamicForm
              v-model="step.$isValid"
              :fields="step.fields"
              :data="submission[step[idKey]]"
              class="flex"
              @field-input="handleStepInput(step, $event)"
              @submit="handleStepSubmit(step)"
            >
              <template #field="{ field, attrs, on }">
                <DynamicField
                  v-if="field.data === 'venue' || field.data === 'address'"
                  v-bind="attrs"
                  v-on="on"
                  :field="{ ...field, type: 'place' }"
                  @place-pick="(placeObject) => handlePlacePick(placeObject, field.data)"
                />
              </template>
              <footer class="mt-2">
                <v-btn
                  type="submit"
                  color="primary"
                  :loading="submitting"
                  class="mx-0"
                  v-test="`submit:step.${step[idKey]}:next`"
                >
                  {{ step.submitLabel || 'Next' }}
                </v-btn>
              </footer>
            </DynamicForm>
            <div v-if="step[idKey] === 'competition'" class="col-md-4 ml-6 hidden-sm-and-down">
              <figure class="device-frame mb-4">
                <div class="device-frame-content v-application theme--light app-scroll d-flex flex-column">
                  <v-toolbar dark color="primary" class="flex-none">
                    <v-toolbar-title class="title">
                      {{ $store.state.$package.$name }}
                    </v-toolbar-title>
                  </v-toolbar>
                  <CompetitionInfo />
                </div>
                <figcaption class="device-frame-caption">In-App Preview</figcaption>
              </figure>
            </div>
          </div>
        </v-stepper-content>
      </template>
    </v-stepper>

    <div v-if="submitted" class="pa-4" v-test="'submit:submitted'">
      <EmptyState
        :icon="mdiEmailOutline"
        label="All done!"
        description="Expect a confirmation email in your inbox momentarily."
      >
        <p class="mt-4">Your submission will be reviewed <strong>within 7 days</strong>, and you will receive another email once approved.</p>
        <p>(Check your spam in the meantime, just in case.)</p>

        <v-btn color="primary" @click="handleRestart" v-test="'submit:restart'">Submit Another Competition</v-btn>
      </EmptyState>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import pick from 'lodash.pick';
import { mdiCheck, mdiEmailOutline } from '@mdi/js';
import { idKey, db, toOrderedArray } from '@/helpers/firebase';
import { getPlaceFields } from '@/helpers/maps';
import steps, { checklists } from '@/schemas/submissions';
import CompetitionInfo from '@/views/competition/Info.vue';
import DynamicForm from '@/components/admin/DynamicForm.vue';

export default {
  name: 'CompetitionsSubmit',
  reactiveProvide: {
    name: 'competitionBundle',
    include: [
      'competition',
      'staff',
    ],
  },
  data() {
    return {
      idKey,
      mdiCheck,
      mdiEmailOutline,

      steps: undefined,
      currentStep: undefined,

      preview: undefined,
      submission: undefined,
      submitting: false,
      submitted: false,

      checklists: toOrderedArray(checklists),
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    competition() {
      return this.preview;
    },
    staff() {
      return [];
    },
  },
  methods: {
    reset() {
      this.steps = toOrderedArray(steps).map((step) => ({
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
          [field.data]: (typeof field.default === 'function' ? field.default(this) : field.default) || null,
        }), {}),
      }), {});
      this.submitted = false;
    },

    handleStart() {
      const start = () => {
        this.submission.contact = {
          ...this.submission.contact,
          name: this.me.displayName,
          email: this.me.email,
        };
        this.currentStep += 1;
      };
      if (this.me) {
        return start();
      }

      // auto-advance post-auth...
      this.$store.commit('addPostLoginCallback', start);

      // ...while opening dialog to inform user they need to login
      return this.$store.commit('setCurrentDialog', 'submissions');
    },

    handlePlacePick(placeObject, type) {
      const data = this.submission.competition;
      const { venue, address, location } = getPlaceFields(placeObject);
      if (type === 'venue' || !data.venue) {
        data.venue = venue;
      }
      if (type === 'address' || !data.address) {
        data.address = address;
      }
      if (!data.location) {
        data.location = location;
      }

      this.preview = {
        ...this.preview,
        ...data,
      };
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
      });

      this.submitting = false;
      this.submitted = true;
    },

    async handleRestart() {
      const previousSubmission = { ...this.submission };
      this.reset();
      this.submission.competition = {
        date: this.$moment(previousSubmission.competition.date, 'YYYY-MM-DD').add(1, 'day').format('YYYY-MM-DD'),
        ...pick(previousSubmission.competition, [
          'venue',
          'address',
          'location',
        ]),
      };
      this.submission.contact = pick(previousSubmission.contact, [
        'name',
        'email',
      ]);
      this.currentStep += 1;
    },

    async handleSkip() {
      this.$router.push({
        name: 'competition.admin.info',
        params: {
          competitionId: db.push().key,
        },
      });
    },
  },
  created() {
    this.reset();
  },
  components: {
    DynamicForm,
    CompetitionInfo,
  },
};
</script>

<style lang="scss">
.CompetitionsSubmit {
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
