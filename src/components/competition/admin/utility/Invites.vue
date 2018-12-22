<template>
  <div class="admin-invites">
    <md-list class="md-list-cards">
      <md-list-item-cards md-expand md-expanded>
        <md-subheader>Administrators</md-subheader>
        <md-list slot="md-expand" class="md-double-line">
          <md-list-item
            v-for="invite in administrators"
            :key="invite[idKey]"
          >
            <md-avatar class="md-avatar-icon md-primary">
              <v-icon>check</v-icon>
            </md-avatar>
            <div class="md-list-item-text">
              <div>{{ invite.payload.email }}</div>
              <span>
                Since
                <time :title="invite.accepted">
                  {{ $moment(invite.accepted).fromNow() }}
                </time>
              </span>
            </div>
            <md-button
              class="md-icon-button md-list-action"
              @click="handleAdministratorDemote(invite)"
            >
              <v-icon>clear</v-icon>
              <md-tooltip md-direction="right">Remove Admin</md-tooltip>
            </md-button>
          </md-list-item>
          <md-list-item>
            <md-avatar class="md-avatar-icon">
              <v-icon>verified_user</v-icon>
            </md-avatar>
            <div class="md-list-item-text">
              <div>System Administrators</div>
            </div>
          </md-list-item>
        </md-list>
      </md-list-item-cards>

      <md-dialog-confirm
        :md-active.sync="confirmDemote"
        md-title="Demote administrator"
        md-content="Are you sure you want to revoke this user's ability to administer this competition?"
        md-confirm-text="Yes"
        md-cancel-text="No"
        @md-confirm="confirmDemote.resolve()"
        @md-cancel="confirmDemote.reject()"
      />
    </md-list>
    <md-list class="md-list-cards">
      <md-list-item-cards md-expand md-expanded>
        <md-subheader>Invites</md-subheader>
        <md-list slot="md-expand" class="md-double-line">
          <md-list-item
            v-for="invite in invites"
            :key="invite[idKey]"
          >
            <md-avatar
              class="md-avatar-icon"
              :class="{
                'md-accent': FirebaseInvites.is(invite, FirebaseInvites.status.CREATED),
              }"
            >
              <md-icon>{{
                FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED, FirebaseInvites.status.EXPIRED)
                ? 'clear'
                : 'mail_outline'
              }}</md-icon>
            </md-avatar>
            <div class="md-list-item-text">
              <div>{{ invite.payload.email }}</div>
              <span v-if="FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED)">
                Cancelled
                <time :title="invite.cancelled">
                  {{ $moment(invite.cancelled).fromNow() }}
                </time>
              </span>
              <span v-else-if="FirebaseInvites.is(invite, FirebaseInvites.status.EXPIRED)">
                Expired
                <time :title="invite.expires">
                  {{ $moment(invite.expires).fromNow() }}
                </time>
              </span>
              <span v-else-if="FirebaseInvites.is(invite, FirebaseInvites.status.CREATED)">
                Invited
                <time :title="invite.created">
                  {{ $moment(invite.created).fromNow() }}
                </time>
              </span>
              <span>
                &bull;
                <a href="#" @click="handleInviteResend(invite)">Resend</a>
              </span>
            </div>
            <md-button
              v-if="FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED, FirebaseInvites.status.EXPIRED)"
              class="md-icon-button md-list-action"
              @click="handleInviteDelete(invite)"
            >
              <v-icon>delete</v-icon>
              <md-tooltip md-direction="right">Delete Invite</md-tooltip>
            </md-button>
            <md-button
              class="md-icon-button md-list-action"
              @click="handleInviteCancel(invite)"
            >
              <v-icon>clear</v-icon>
              <md-tooltip md-direction="right">Cancel Invite</md-tooltip>
            </md-button>
          </md-list-item>
          <md-divider />
          <new-dynamic-field
            :field="{ title: 'Invite by Email', data: 'email', type: 'email' }"
            @change="handleInviteCreate"
          />
        </md-list>
      </md-list-item-cards>
    </md-list>
  </div>
</template>

<script>
import { FirebaseInvites } from '@mismith/firebase-tools';
import { idKey } from '@/helpers/firebase';
import NewDynamicField from '@/components/admin/utility/NewDynamicField.vue';

export default {
  name: 'admin-invites',
  props: {
    competitionId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      idKey,
      FirebaseInvites,
      firebaseInvites: new FirebaseInvites(this.competitionDataRef.child('invites')),
      confirmDemote: undefined,
    };
  },
  firebase() {
    return {
      invitesRaw: this.firebaseInvites.ref,
    };
  },
  computed: {
    administrators() {
      return this.invitesRaw.filter(invite => FirebaseInvites.is(invite, FirebaseInvites.status.ACCEPTED));
    },
    invites() {
      return this.invitesRaw.filter(invite => !FirebaseInvites.is(invite, FirebaseInvites.status.ACCEPTED));
    },
  },
  methods: {
    handleInviteCreate(invitee) {
      this.firebaseInvites.create({
        email: invitee.email,
      });
    },
    handleInviteResend(invite) {
      this.firebaseInvites.resend(invite[idKey]);
    },
    handleInviteCancel(invite) {
      this.firebaseInvites.cancel(invite[idKey]);
    },
    handleInviteDelete(invite) {
      this.firebaseInvites.delete(invite[idKey]);
    },
    async handleAdministratorDemote(invite) {
      try {
        await new Promise((resolve, reject) => {
          this.confirmDemote = { resolve, reject };
        });
        this.handleInviteDelete(invite);
      } catch (err) {
        if (err) console.error(err); // eslint-disable-line no-console
      } finally {
        this.confirmDemote = null;
      }
    },
  },
  components: {
    NewDynamicField,
  },
};
</script>

<style lang="scss">
.admin-invites {

}
</style>
