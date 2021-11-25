<template>
  <RequiresPermission class="CompetitionInvite d-flex align-center justify-center app-scroll-frame app-scroll pa-4">
    <div v-if="!invite">
      <Spinner />
    </div>
    <EmptyState
      v-else-if="!invite.created"
      :icon="mdiClose"
      label="Invite not found"
      description="Perhaps try asking to be invited again?"
    />
    <div v-else-if="invite.accepted && invite.acceptedBy">
      <div v-if="$store.state.me && $store.state.me[idKey] === invite.acceptedBy">
        <EmptyState
          :icon="mdiCheck"
          label="Invite accepted"
        />
        <footer class="d-flex justify-center">
          <v-btn
            color="primary"
            :to="{ name: 'competition.admin.info', params: { competitionId }}"
            v-test="'invite:administer'"
          >
            Administer Competition
          </v-btn>
        </footer>
      </div>
      <EmptyState
        v-else
        :icon="mdiCancel"
        label="Invite already accepted"
        description="Perhaps try asking to be invited again?"
      />
    </div>
    <EmptyState
      v-else-if="invite.cancelled"
      :icon="mdiCancel"
      label="Invite cancelled"
      description="You'll need to ask to be invited again."
    />
    <EmptyState
      v-else-if="$moment().isAfter(invite.expires)"
      :icon="mdiTimerOff"
      label="Invite expired"
      description="You'll need to ask to be invited again."
    />
    <div v-else>
      <EmptyState
        :icon="mdiEmailOpen"
        label="Your Invitation"
        description="Get administrator access to this competition."
      />
      <footer class="d-flex justify-center">
        <v-btn
          color="primary"
          :loading="invite.accepted && !invite.acceptedBy"
          @click="handleAccept"
          v-test="'invite:accept'"
        >
          Accept
        </v-btn>
      </footer>
    </div>
  </RequiresPermission>
</template>

<script>
import {
  mdiCancel,
  mdiCheck,
  mdiClose,
  mdiEmailOpen,
  mdiTimerOff,
} from '@mdi/js';
import { FirebaseInvites } from '@mismith/firebase-tools';
import { idKey } from '@/helpers/firebase';
import { mapRouteParams } from '@/helpers/router';
import RequiresPermission from '@/components/RequiresPermission.vue';

export default {
  name: 'CompetitionInvite',
  reactiveInject: {
    competitionBundle: [
      'competitionId',
      'competitionDataRef',
    ],
  },
  data() {
    return {
      idKey,
      mdiCancel,
      mdiCheck,
      mdiClose,
      mdiEmailOpen,
      mdiTimerOff,

      firebaseInvites: new FirebaseInvites(this.competitionDataRef.child('invites')),
    };
  },
  computed: {
    ...mapRouteParams([
      'inviteId',
    ]),

    invite() {
      return this.inviteRaw;
    },
  },
  watch: {
    inviteId: {
      handler(inviteId) {
        if (this.inviteRaw) this.$unbind('inviteRaw');
        this.$bindAsObject('inviteRaw', this.firebaseInvites.ref.child(inviteId));
      },
      immediate: true,
    },
  },
  methods: {
    async handleAccept() {
      await this.firebaseInvites.accept(this.inviteId);
    },
  },
  components: {
    RequiresPermission,
  },
};
</script>
