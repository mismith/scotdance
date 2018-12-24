<template>
  <div class="invite layout align-center justify-center app-scroll-frame app-scroll alt pa-3">
    <div v-if="!$store.state.me">
      <empty-state
        icon="block"
        label="Login required"
        description="In order to accept this invite, you need an account."
      />
      <account-buttons />
    </div>
    <div v-else-if="!invite">
      <spinner />
    </div>
    <empty-state
      v-else-if="!invite.created"
      icon="clear"
      label="Invite not found"
      description="Perhaps try asking to be invited again?"
    />
    <div v-else-if="invite.accepted && invite.acceptedBy">
      <div v-if="$store.state.me && $store.state.me[idKey] === invite.acceptedBy">
        <empty-state
          icon="check"
          label="Invite accepted"
        />
        <footer class="layout justify-center">
          <v-btn
            color="primary"
            :to="{ name: 'competition.admin.info', params: { competitionId }}"
          >
            Administer Competition
          </v-btn>
        </footer>
      </div>
      <empty-state
        v-else
        icon="cancel"
        label="Invite already accepted"
        description="Perhaps try asking to be invited again?"
      />
    </div>
    <empty-state
      v-else-if="invite.cancelled"
      icon="cancel"
      label="Invite cancelled"
      description="You'll need to ask to be invited again."
    />
    <empty-state
      v-else-if="$moment().isAfter(invite.expires)"
      icon="timer_off"
      label="Invite expired"
      description="You'll need to ask to be invited again."
    />
    <div v-else>
      <empty-state
        icon="drafts"
        label="Your Invitation"
        description="Get administrator access to this competition."
      />
      <footer class="layout justify-center">
        <v-btn
          color="primary"
          :loading="invite.accepted && !invite.acceptedBy"
          @click="handleAccept"
        >
          Accept
        </v-btn>
      </footer>
    </div>
  </div>
</template>

<script>
import { FirebaseInvites } from '@mismith/firebase-tools';
import { idKey } from '@/helpers/firebase';
import AccountButtons from '@/components/utility/AccountButtons.vue';

export default {
  name: 'invite',
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
    AccountButtons,
  },
};
</script>

<style lang="scss">
.invite {

}
</style>
