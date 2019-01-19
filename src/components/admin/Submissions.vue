<template>
  <Blades class="AdminSubmissions">
    <Blade :active="!currentSubmission" class="xs12 md4">
      <div v-if="submissions.length" class="app-scroll-frame app-scroll">
        <v-list v-if="loaded" two-line>
          <v-list-tile
            v-for="submission in submissions"
            :key="submission[idKey]"
            :to="{ name: $route.name, params: { submissionId: submission[idKey] } }"
          >
            <v-list-tile-avatar :color="submission.approved ? 'primary' : 'secondary'">
              <v-icon>{{ submission.approved ? 'check' : 'new_releases' }}</v-icon>
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>
                {{ submission.competition.name }}
              </v-list-tile-title>
              <v-list-tile-sub-title v-if="submission.approved" :title="submission.approved">
                Approved:
                {{ $moment(submission.approved).fromNow() }}
              </v-list-tile-sub-title>
              <v-list-tile-sub-title v-else :title="submission.submitted">
                Submitted:
                {{ $moment(submission.submitted).fromNow() }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-icon>chevron_right</v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
        <div v-else class="app-scroll-frame">
          <Spinner />
        </div>
      </div>
      <EmptyState
        v-else
        icon="clear"
        label="No submissions found"
      />
    </Blade>
    <Blade :active="currentSubmission" class="xs12 md8">
      <BladeToolbar class="hidden-md-and-up" />

      <div v-if="currentSubmission" class="app-scroll-frame app-scroll alt">
        <v-list expand class="grouped flex">
          <v-list-group
            v-for="step in steps"
            :key="step[idKey]"
            :value="true"
          >
            <v-subheader slot="activator">
              {{ step.name }}
            </v-subheader>
            <DynamicForm
              :fields="step.fields"
              :data="currentSubmission[step[idKey]]"
              class="white pa-3"
              @field-change="handleChanges($event, `competitions:submissions/${submissionId}/${step[idKey]}`)"
            />
          </v-list-group>
        </v-list>
        <footer class="layout align-center flex-none mb-2">
          <div class="pa-3">
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
          <div class="pa-3" style="text-align: right;">
            <v-btn
              v-if="!currentSubmission.approvedBy"
              color="primary"
              :loading="currentSubmission.approved"
              @click="handleApprove"
              class="ma-0"
            >
              Approve
            </v-btn>
            <div v-if="currentSubmission.approvedBy">
              Approval Time:
              <strong>{{ $moment.duration($moment(currentSubmission.approved).diff(currentSubmission.submitted)).humanize() }}</strong>
            </div>
            <div v-if="currentSubmission.approvedBy">
              Approved By:
              <strong>{{ getUser(currentSubmission.approvedBy).email }}</strong>
            </div>
          </div>
        </footer>
      </div>
      <EmptyState
        v-else
        icon="touch_app"
        label="See submission details"
        description="Select a submission"
      />
    </Blade>
  </Blades>
</template>

<script>
import { idKey, db, toOrderedArray } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';
import steps from '@/schemas/submissions';
import CompetitionListItem from '@/components/utility/CompetitionListItem.vue';
import DynamicForm from '@/components/admin/utility/DynamicForm.vue';
import BladeToolbar from '@/components/utility/BladeToolbar.vue';

export default {
  name: 'AdminSubmissions',
  props: {
    submissionId: String,
    submissions: Array,
    users: Array,
  },
  data() {
    return {
      idKey,

      steps: toOrderedArray(steps),

      loaded: false,
    };
  },
  computed: {
    currentSubmission() {
      if (this.submissionId) {
        return this.submissions.find(submission => submission[idKey] === this.submissionId);
      }
      return null;
    },
  },
  methods: {
    getUser(userId) {
      return findByIdKey(this.users, userId);
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
    await db.child('submissions').once('value'); // @TODO: re-use existing ref somehow

    this.loaded = true;
  },
  components: {
    CompetitionListItem,
    DynamicForm,
    BladeToolbar,
  },
};
</script>
