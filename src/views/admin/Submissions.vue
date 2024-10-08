<template>
  <Blades class="AdminSubmissions">
    <Blade :active="!currentSubmission" class="col-md-4">
      <div v-if="submissions.length" class="app-scroll-frame app-scroll">
        <v-list v-if="loaded" two-line>
          <v-list-item
            v-for="submission in orderedSubmissions"
            :key="submission[idKey]"
            :to="{ name: $route.name, params: { submissionId: submission[idKey] } }"
            v-test="`submissions:submission:${submission[idKey]}`"
          >
            <v-list-item-avatar :color="submission.approved ? 'primary' : 'secondary'">
              <v-icon>{{ submission.approved ? mdiCheck : mdiNewBox }}</v-icon>
            </v-list-item-avatar>

            <v-list-item-content>
              <v-list-item-title>
                {{ submission.competition && submission.competition.name }}
              </v-list-item-title>
              <v-list-item-subtitle v-if="submission.approved" :title="submission.approved">
                Approved:
                {{ $moment(submission.approved).fromNow() }}
              </v-list-item-subtitle>
              <v-list-item-subtitle v-else :title="submission.submitted">
                Submitted:
                {{ $moment(submission.submitted).fromNow() }}
              </v-list-item-subtitle>
            </v-list-item-content>

            <v-list-item-action>
              <v-icon>{{ mdiChevronRight }}</v-icon>
            </v-list-item-action>
          </v-list-item>
        </v-list>
        <div v-else class="app-scroll-frame">
          <Spinner />
        </div>
      </div>
      <EmptyState
        v-else
        :icon="mdiClose"
        label="No submissions found"
        v-test="'submissions:empty'"
      />
    </Blade>
    <Blade :active="currentSubmission" class="col-md-8">
      <BladeToolbar
        :to="{ name: $route.name }"
        class="hidden-md-and-up"
      />

      <div v-if="currentSubmission" class="app-scroll-frame app-scroll alt">
        <v-list expand class="grouped">
          <v-list-group
            v-for="step in steps"
            :key="step[idKey]"
            :value="true"
          >
            <template #activator>
              <v-subheader>{{ step.name }}</v-subheader>
            </template>

            <v-list>
              <DynamicForm
                v-if="currentSubmission[step[idKey]]"
                :fields="step.fields.map(field => ({ readonly: currentSubmission.approved, ...field }))"
                :data="currentSubmission[step[idKey]]"
                class="pa-4"
                @field-change="handleChanges($event, `competitions:submissions/${submissionId}/${step[idKey]}`)"
              />
              <v-list-item v-else class="empty">
                <v-list-item-avatar>
                  <v-icon>{{ mdiClose }}</v-icon>
                </v-list-item-avatar>
                <v-list-item-content>
                  No more info.
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-list-group>
        </v-list>
        <footer class="pb-2">
          <div class="d-flex align-center flex-none flex-wrap">
            <div class="pa-4">
              <div :title="currentSubmission.submitted">
                Submitted:
                <strong>{{ $moment(currentSubmission.submitted).format('LLLL') }}</strong>
              </div>
              <div v-if="currentSubmission.approvedBy" :title="currentSubmission.approved">
                Approved:
                <strong>{{ $moment(currentSubmission.approved).format('LLLL') }}</strong>
              </div>
            </div>
            <v-spacer />
            <div class="pa-4" style="text-align: right;">
              <v-btn
                v-if="!currentSubmission.approvedBy"
                color="primary"
                :loading="currentSubmission.approved"
                @click="handleApprove"
                class="ma-0"
                v-test="'submissions:approve'"
              >
                Approve
              </v-btn>
              <template v-else>
                <div>
                  Approval Time:
                  <strong>{{ $moment.duration($moment(currentSubmission.approved).diff(currentSubmission.submitted)).humanize() }}</strong>
                </div>
                <div>
                  Approved By:
                  <strong>{{ getUser(currentSubmission.approvedBy).email }}</strong>
                </div>
              </template>
            </div>
          </div>
          <div v-if="currentSubmission.competitionId" class="pt-0 px-2 pb-2" style="text-align: right;">
            <v-btn
              :to="{ name: 'competition.info', params: { competitionId: currentSubmission.competitionId } }"
              class="ma-2"
              v-test="'submissions:view'"
            >
              View Competition
            </v-btn>
            <v-btn
              v-if="currentSubmission.competitionId"
              color="primary"
              :to="{ name: 'competition.admin.info', params: { competitionId: currentSubmission.competitionId } }"
              class="ma-2"
              v-test="'submissions:administer'"
            >
              Administer Competition
            </v-btn>
          </div>
        </footer>
      </div>
      <EmptyState
        v-else
        :icon="mdiGestureTap"
        label="See submission details"
        description="Select a submission"
      />
    </Blade>
  </Blades>
</template>

<script>
import {
  mdiCheck,
  mdiChevronRight,
  mdiClose,
  mdiGestureTap,
  mdiNewBox,
} from '@mdi/js';
import { idKey, db, toOrderedArray } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';
import { mapRouteParams } from '@/helpers/router';
import steps from '@/schemas/submissions';
import DynamicForm from '@/components/admin/DynamicForm.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';

export default {
  name: 'AdminSubmissions',
  reactiveInject: {
    adminBundle: [
      'submissions',
      'users',
    ],
  },
  data() {
    return {
      idKey,
      mdiCheck,
      mdiChevronRight,
      mdiClose,
      mdiGestureTap,
      mdiNewBox,

      steps: toOrderedArray(steps),

      loaded: false,
    };
  },
  computed: {
    ...mapRouteParams([
      'submissionId',
    ]),

    orderedSubmissions() {
      const orderedSubmissions = [...this.submissions];
      orderedSubmissions.reverse();
      return orderedSubmissions;
    },
    currentSubmission() {
      if (this.submissionId) {
        return this.submissions.find((submission) => submission[idKey] === this.submissionId);
      }
      return null;
    },
  },
  methods: {
    getUser(userId) {
      return findByIdKey(this.users, userId) || {};
    },

    handleChanges(changes, prefix) {
      Object.entries(changes).forEach(([path, change]) => {
        this.$emit('change', {
          [`${prefix}/${path}`]: change,
        });
      });
    },

    handleApprove() {
      this.$emit('change', {
        [`competitions:submissions/${this.submissionId}/approved`]: this.$moment().format(),
      });
    },
  },
  async created() {
    await db.child('competitions:submissions').once('value'); // @TODO: re-use existing ref somehow

    this.loaded = true;
  },
  components: {
    DynamicForm,
    BladeToolbar,
  },
};
</script>
