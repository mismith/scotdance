<template>
  <div class="invite app-scroll-frame app-scroll">
    <v-layout align-center justify-center class="pa-3">
      <div v-if="!$store.state.me">
        <empty-state
          icon="block"
          label="Login required"
          description="In order to accept this invite, you need an account."
        />
        <account-buttons />
      </div>
      <div v-else-if="!invite">
        <mi-md-spinner />
      </div>
      <div v-else-if="!invite.created">
        <empty-state
          icon="clear"
          label="Invite not found"
          description="Perhaps try asking to be invited again?"
        />
      </div>
      <div v-else-if="invite.accepted && invite.acceptedBy">
        <div v-if="$store.state.me && $store.state.me[idKey] === invite.acceptedBy">
          <empty-state
            icon="check"
            label="Invite accepted"
            md-rounded
            class="md-primary"
          />
          <v-layout justify-center>
            <v-btn
              color="primary"
              :to="{ name: 'competition.admin.info', params: { competitionId }}"
            >
              Administer Competition
            </v-btn>
          </v-layout>
        </div>
        <div v-else>
          <empty-state
            icon="cancel"
            label="Invite already accepted"
            description="Perhaps try asking to be invited again?"
          />
        </div>
      </div>
      <div v-else-if="invite.cancelled">
        <empty-state
          icon="cancel"
          label="Invite cancelled"
          description="You'll need to ask to be invited again."
        />
      </div>
      <div v-else-if="$moment().isAfter(invite.expires)">
        <empty-state
          icon="timer_off"
          label="Invite expired"
          description="You'll need to ask to be invited again."
        />
      </div>
      <div v-else>
        <empty-state
          icon="drafts"
          label="Your Invitation"
          description="Get administrator access to this competition."
        />
        <v-layout justify-center>
          <v-btn
            color="primary"
            :loading="invite.accepted && !invite.acceptedBy"
            @click="handleAccept"
          >
            Accept
          </v-btn>
        </v-layout>
      </div>
    </v-layout>
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
