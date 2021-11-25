<template>
  <div class="AdminInvites">
    <v-list expand class="grouped">
      <v-list-group :value="true">
        <template #activator>
          <v-subheader>Administrators</v-subheader>
        </template>

        <v-list two-line>
          <v-slide-y-transition group hide-on-leave>
            <v-list-item
              v-for="invite in administrators"
              :key="invite[idKey]"
            >
              <v-list-item-avatar :color="invite.submitted ? '' : 'primary'">
                <v-icon>{{ invite.submitted ? mdiCheckCircle : mdiCheck }}</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title v-test="`invites:admin:${invite[idKey]}:email`">
                  {{ invite.payload.email }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ invite.submitted ? 'Submitted' : 'Since' }}
                  <time :title="invite.accepted">
                    {{ $moment(invite.accepted).fromNow() }}
                  </time>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action v-if="!invite.submitted">
                <v-tooltip fixed left>
                  <template #activator="{ on }">
                    <v-btn v-test="`invites:admin:${invite[idKey]}:remove`" icon v-on="on" @click="handleAdministratorDemote(invite)">
                      <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                  </template>
                  <span>Remove Admin</span>
                </v-tooltip>
              </v-list-item-action>
            </v-list-item>
          </v-slide-y-transition>

          <v-list-item>
            <v-list-item-avatar>
              <v-icon>{{ mdiAccountKey }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>System Administrators</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-list-group>
      <DialogCard
        :value="confirmDemote"
        title="Demote administrator"
        text="Are you sure you want to revoke this user's ability to administer this competition?"
        cancel-label="No"
        submit-label="Yes"
        @cancel="confirmDemote.reject()"
        @submit="confirmDemote.resolve()"
      />

      <v-list-group :value="true">
        <template #activator>
          <v-subheader>Invites</v-subheader>
        </template>

        <v-list two-line>
          <v-slide-y-transition group hide-on-leave>
            <v-list-item
              v-for="invite in invites"
              :key="invite[idKey]"
            >
              <v-list-item-avatar
                :color="FirebaseInvites.is(invite, FirebaseInvites.status.CREATED) && 'secondary'"
              >
                <v-icon>{{
                  FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED, FirebaseInvites.status.EXPIRED)
                  ? mdiCancel
                  : mdiEmailOutline
                }}</v-icon>
              </v-list-item-avatar>

              <v-list-item-content>
                <v-list-item-title v-test="`invites:invite:${invite[idKey]}:email`">
                  {{ invite.payload.email }}
                </v-list-item-title>
                <v-list-item-subtitle>
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
                </v-list-item-subtitle>
              </v-list-item-content>

              <v-list-item-action v-if="FirebaseInvites.is(invite, FirebaseInvites.status.CANCELLED, FirebaseInvites.status.EXPIRED)">
                <v-tooltip fixed left>
                  <template #activator="{ on }">
                    <v-btn v-on="on" icon @click="handleInviteDelete(invite)">
                      <v-icon>{{ mdiDelete }}</v-icon>
                    </v-btn>
                  </template>
                  <span>Delete Invite</span>
                </v-tooltip>
              </v-list-item-action>
              <v-list-item-action v-else>
                <v-tooltip fixed left>
                  <template #activator="{ on }">
                    <v-btn v-on="on" icon @click="handleInviteCancel(invite)">
                      <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                  </template>
                  <span>Cancel Invite</span>
                </v-tooltip>
              </v-list-item-action>
            </v-list-item>
          </v-slide-y-transition>

          <v-list-item v-if="!invites.length" class="empty">
            <v-list-item-avatar>
              <v-icon>{{ mdiClose }}</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              No pending invites.
            </v-list-item-content>
          </v-list-item>
          <v-divider class="mb-2" />
          <NewDynamicField
            :field="{ title: 'Invite by Email', data: 'email', type: 'email' }"
            @change="handleInviteCreate"
            class="pl-4"
            v-test="'invites:email-field'"
          />
        </v-list>
      </v-list-group>
    </v-list>
  </div>
</template>

<script>
import {
  mdiAccountKey,
  mdiCancel,
  mdiCheck,
  mdiCheckCircle,
  mdiClose,
  mdiDelete,
  mdiEmailOutline,
} from '@mdi/js';
import { FirebaseInvites } from '@mismith/firebase-tools';
import { idKey, db } from '@/helpers/firebase';
import NewDynamicField from '@/components/admin/NewDynamicField.vue';

export default {
  name: 'AdminInvites',
  props: {
    competitionId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
    competition: Object,
  },
  data() {
    return {
      idKey,
      mdiAccountKey,
      mdiCancel,
      mdiCheck,
      mdiCheckCircle,
      mdiClose,
      mdiDelete,
      mdiEmailOutline,
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
    submissionId() {
      return this.competition && this.competition.submissionId;
    },
    administrators() {
      const email = this.submission && this.submission.contact && this.submission.contact.email;

      return this.invitesRaw
        .filter((invite) => {
          // show submitter as such instead of showing as a regularly invited user
          if (invite.payload && invite.payload.email === email) {
            return false;
          }

          return FirebaseInvites.is(invite, FirebaseInvites.status.ACCEPTED);
        })
        .concat(this.submission && this.submission.submitted ? [
          {
            accepted: this.submission.submitted,
            payload: this.submission.contact || {},
            ...this.submission,
          },
        ] : []);
    },
    invites() {
      return this.invitesRaw
        .filter((invite) => !FirebaseInvites.is(invite, FirebaseInvites.status.ACCEPTED));
    },
  },
  watch: {
    submissionId: {
      handler(submissionId, previousSubmissionId) {
        if (submissionId && submissionId !== previousSubmissionId) {
          const submissionRef = db.child('competitions:submissions').child(submissionId);
          if (this.submission) this.$unbind('submission');
          this.$bindAsObject('submission', submissionRef);
        }
      },
      immediate: true,
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
