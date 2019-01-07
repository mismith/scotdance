<template>
  <div class="admin-invites">
    <v-list expand class="grouped">
      <v-list-group :value="true">
        <v-subheader slot="activator">Administrators</v-subheader>
        <v-list two-line>
          <v-list-tile
            v-for="invite in administrators"
            :key="invite[idKey]"
          >
            <v-list-tile-avatar color="primary">
              <v-icon>check</v-icon>
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ invite.payload.email }}</v-list-tile-title>
              <v-list-tile-sub-title>
                Since
                <time :title="invite.accepted">
                  {{ $moment(invite.accepted).fromNow() }}
                </time>
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-tooltip fixed left>
                <v-btn icon slot="activator" @click="handleAdministratorDemote(invite)">
                  <v-icon>clear</v-icon>
                </v-btn>
                <span>Remove Admin</span>
              </v-tooltip>
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-avatar>
              <v-icon>verified_user</v-icon>
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>System Administrators</v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-list-group>

      <dialog-card
        :value="confirmDemote"
        title="Demote administrator"
        text="Are you sure you want to revoke this user's ability to administer this competition?"
        cancel-label="No"
        submit-label="Yes"
        @cancel="confirmDemote.reject()"
        @submit="confirmDemote.resolve()"
      />
    </v-list>
    <v-list expand class="grouped">
      <v-list-group :value="true">
        <v-subheader slot="activator">Invites</v-subheader>
        <v-list two-line>
          <v-list-tile
            v-for="invite in invites"
            :key="invite[idKey]"
          >
            <v-list-tile-avatar
              :color="FirebaseInvites.is(invite, FirebaseInvites.status.CREATED) && 'secondary'"
            >
              <v-icon>{{
                FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED, FirebaseInvites.status.EXPIRED)
                ? 'cancel'
                : 'mail_outline'
              }}</v-icon>
            </v-list-tile-avatar>

            <v-list-tile-content>
              <v-list-tile-title>{{ invite.payload.email }}</v-list-tile-title>
              <v-list-tile-sub-title>
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
              </v-list-tile-sub-title>
            </v-list-tile-content>

            <v-list-tile-action v-if="FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED, FirebaseInvites.status.EXPIRED)">
              <v-tooltip fixed left>
                <v-btn slot="activator" icon @click="handleInviteDelete(invite)">
                  <v-icon>delete</v-icon>
                </v-btn>
                <span>Delete Invite</span>
              </v-tooltip>
            </v-list-tile-action>
            <v-list-tile-action v-else>
              <v-tooltip fixed left>
                <v-btn slot="activator" icon @click="handleInviteCancel(invite)">
                  <v-icon>cancel</v-icon>
                </v-btn>
                <span>Cancel Invite</span>
              </v-tooltip>
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile v-if="!invites.length" class="empty">
            <v-list-tile-avatar>
              <v-icon>clear</v-icon>
            </v-list-tile-avatar>
            No pending invites.
          </v-list-tile>
          <v-divider />
          <new-dynamic-field
            :field="{ title: 'Invite by Email', data: 'email', type: 'email' }"
            @change="handleInviteCreate"
            class="pl-3 pt-2"
          />
        </v-list>
      </v-list-group>
    </v-list>
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
