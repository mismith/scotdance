<template>
  <RequiresPermission class="CompetitionInvite d-flex align-center justify-center app-scroll-frame app-scroll pa-4">
    <div v-if="!invite">
      <Spinner />
    </div>
    <EmptyState
      v-else-if="!invite.created"
      icon="mdi-close"
      label="Invite not found"
      description="Perhaps try asking to be invited again?"
    />
    <div v-else-if="invite.accepted && invite.acceptedBy">
      <div v-if="$store.state.me && $store.state.me[idKey] === invite.acceptedBy">
        <EmptyState
          icon="mdi-check"
          label="Invite accepted"
        />
        <footer class="d-flex justify-center">
          <v-btn
            color="primary"
            :to="{ name: 'competition.admin.info', params: { competitionId }}"
          >
            Administer Competition
          </v-btn>
        </footer>
      </div>
      <EmptyState
        v-else
        icon="mdi-cancel"
        label="Invite already accepted"
        description="Perhaps try asking to be invited again?"
      />
    </div>
    <EmptyState
      v-else-if="invite.cancelled"
      icon="mdi-cancel"
      label="Invite cancelled"
      description="You'll need to ask to be invited again."
    />
    <EmptyState
      v-else-if="$moment().isAfter(invite.expires)"
      icon="mdi-timer-off"
      label="Invite expired"
      description="You'll need to ask to be invited again."
    />
    <div v-else>
      <EmptyState
        icon="mdi-email-open"
        label="Your Invitation"
        description="Get administrator access to this competition."
      />
      <footer class="d-flex justify-center">
        <v-btn
          color="primary"
          :loading="invite.accepted && !invite.acceptedBy"
          @click="handleAccept"
        >
          Accept
        </v-btn>
      </footer>
    </div>
  </RequiresPermission>
</template>

<script>
import { FirebaseInvites } from '@mismith/firebase-tools';
import { idKey } from '@/helpers/firebase';
import RequiresPermission from '@/components/RequiresPermission.vue';
import AccountButtons from '@/components/AccountButtons.vue';

export default {
  name: 'CompetitionInvite',
  props: {
    competitionId: String,
    inviteId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      idKey,

      firebaseInvites: new FirebaseInvites(this.competitionDataRef.child('invites')),
    };
  },
  computed: {
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
    AccountButtons,
  },
};
</script>
