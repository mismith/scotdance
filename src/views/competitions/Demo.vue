<template>
  <div class="CompetitionsDemo app-scroll-frame app-scroll">
    <div class="ma-auto">
        <EmptyState
            :icon="mdiMonitorEye"
            label="Admin panel preview"
            class="mb-10"
            style="max-width: 600px;"
        >
            <p>Explore a fully customizable demo competition where you can play around with the admin panel to see first-hand how everything works.</p>
            <p><em>Noone else will see this competition, and it will be permanently deleted in 1 hour.</em></p>
            <br />

            <!-- <p>Some things to look out for:</p>
            <ul class="mb-6">
                <li>header icons</li>
                <li>listed + published won't actually work</li>
            </ul> -->

            <template v-if="isDemoRunning && !isStarting">
              <v-btn
                v-for="demoRunning in demosRunning"
                :key="demoRunning[idKey]"
                :to="{ name: 'competition.admin.info', params: { competitionId: demoRunning[idKey] } }"
                color="primary"
              >
                Administer Demo Competition
              </v-btn>
              <v-subheader>
                <span>
                  This demo competition expires in <strong><CountdownTicker :end-timestamp="demosRunning[0].started + (60 * 60 * 1000)" format="distance" /></strong>

                  <v-tooltip bottom>
                    <template #activator="{ on }">
                      <v-btn
                        v-on="on"
                        icon
                        small
                        :loading="isStopping"
                        @click="handleStop"
                        class="dimmed ml-1"
                      >
                        <v-icon small>{{ mdiCloseOctagon }}</v-icon>
                      </v-btn>
                    </template>
                    Stop demo
                  </v-tooltip>
                </span>
              </v-subheader>
            </template>
            <v-btn
              v-else
              large
              color="amber"
              :loading="isStarting"
              @click="handleStart"
              class="black--text"
            >
              Start Demo
            </v-btn>
        </EmptyState>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { formatDistanceStrict } from 'date-fns';
import { mdiMonitorEye, mdiCloseOctagon } from '@mdi/js';
import { idKey, db, firebase } from '@/helpers/firebase';

export default {
  name: 'CompetitionsDemo',
  data() {
    return {
      idKey,
      mdiMonitorEye,
      mdiCloseOctagon,

      demosRef: undefined,
      demoTimeLeft: undefined,

      isStarting: false,
      isStopping: false,
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),

    demos() {
      return this.demosRaw || [];
    },

    demosRunning() {
      return this.demos.filter((demo) => {
        return demo.started && !demo.stopped;
      });
    },
    isDemoRunning() {
      return Boolean(this.demosRunning.length);
    },
  },
  watch: {
    me() {
      this.loadFirebase();
    },
  },
  methods: {
    formatDistanceStrict,

    loadFirebase() {
      if (!this.me) return;

      this.demosRef = db.child('users:demos').child(this.me[idKey]);

      if (this.demosRaw) this.$unbind('demosRaw');
      this.$bindAsArray('demosRaw', this.demosRef);
    },

    handleStart() {
      const demo = () => {
        this.start();
      };
      if (this.$store.state.me) {
        return demo();
      }

      // auto-advance post-auth...
      this.$store.commit('addPostLoginCallback', demo);

      // ...while opening dialog to inform user they need to login
      return this.$store.commit('setCurrentDialog', 'demo');
    },

    async start() {
      try {
        this.isStarting = true;

        // request a new demo
        const demoSnap = await this.demosRef.push({
          requested: firebase.database.ServerValue.TIMESTAMP,
        });

        // wait for it to be created
        const started = demoSnap.ref.child('started');
        await new Promise((resolve, reject) => {
          let off;
          const timeout = setTimeout(() => {
            off?.();
            reject(new Error(`Starting demo (${demoSnap.key}) timed out`));
          }, 10000); // 10 seconds
          const handler = (startedSnap) => {
            if (startedSnap.val()) {
              clearTimeout(timeout);
              off?.();
              resolve();
            }
          };
          off = () => started.off('value', handler);
          started.on('value', handler);
        });

        // @TODO?: alert user of success / say "Go!"

        // redirect to admin panel for newly created competition
        await this.$router.push({
          name: 'competition.admin.info',
          params: {
            competitionId: demoSnap.key,
          },
        });
      // } catch (err) {
      //   throw err; // @TODO: inform user of timeout
      } finally {
        this.isStarting = false;
      }
    },

    async handleStop() {
      this.isStopping = true;
      await Promise.all(this.demosRunning.map((demo) => {
        return this.demosRef.child(demo[idKey]).child('stopped').set(firebase.database.ServerValue.TIMESTAMP);
      }));
      this.isStopping = false;
    },
  },
  async created() {
    this.loadFirebase();
  },
};
</script>

<style lang="scss">
.CompetitionsDemo {
}
</style>
