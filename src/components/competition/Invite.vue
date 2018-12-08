<template>
  <div class="invite md-scroll-frame md-scroll">
    <div class="md-layout md-alignment-center md-padding">
      <div v-if="!$store.state.me">
        <md-empty-state
          md-icon="block"
          md-label="Login required"
          md-description="In order to accept this invite, you need an account."
        />
        <account-buttons />
      </div>
      <div v-else-if="!invite">
        <mi-md-spinner />
      </div>
      <div v-else-if="!invite.created">
        <md-empty-state
          md-icon="clear"
          md-label="Invite not found"
          md-description="Perhaps try asking to be invited again?"
        />
      </div>
      <div v-else-if="invite.accepted && invite.acceptedBy">
        <div v-if="$store.state.me && $store.state.me[idKey] === invite.acceptedBy">
          <md-empty-state
            md-icon="check"
            md-label="Invite accepted"
            md-rounded
            class="md-primary"
          />
          <footer class="md-layout md-alignment-center">
            <md-button
              :to="{ name: 'competition.admin.info', params: { competitionId }}"
              class="md-primary md-raised"
            >
              Administer Competition
            </md-button>
          </footer>
        </div>
        <div v-else>
          <md-empty-state
            md-icon="cancel"
            md-label="Invite already accepted"
            md-description="Perhaps try asking to be invited again?"
          />
        </div>
      </div>
      <div v-else-if="invite.cancelled">
        <md-empty-state
          md-icon="cancel"
          md-label="Invite cancelled"
          md-description="You'll need to ask to be invited again."
        />
      </div>
      <div v-else-if="$moment().isAfter(invite.expires)">
        <md-empty-state
          md-icon="timer_off"
          md-label="Invite expired"
          md-description="You'll need to ask to be invited again."
        />
      </div>
      <div v-else>
        <md-empty-state
          md-icon="drafts"
          md-label="Your Invitation"
          md-description="Get administrator access to this competition."
        />
        <footer class="md-layout md-alignment-center">
          <md-spinnable :md-spinning="invite.accepted && !invite.acceptedBy">
            <md-button
              @click="handleAccept"
              class="md-primary md-raised"
            >
              Accept
            </md-button>
          </md-spinnable>
        </footer>
      </div>
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
  > .md-layout {
    flex: auto;
    padding-bottom: 15%;
  }
  footer {
    margin-top: 20px;
  }
}
</style>
