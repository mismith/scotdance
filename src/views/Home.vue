<template>
  <div class="Home app-scroll-frame app-scroll">
    <section id="hero">
      <div>
        <img src="@/assets/img/touchicon.png" alt="" width="88" height="88" />
        <h1 class="display-2 my-4">{{ $package.$name }}</h1>
        <p class="headline">{{ $package.description }}</p>
        <p class="subtitle-1">Skip the pen and paper—attend highland dance competitions in style with this app for your mobile device.</p>
        <p class="print-hide">
          <v-btn :to="{ name: 'competitions' }" color="primary" large class="ma-2">
            Browse Competitions
          </v-btn>
          <v-btn :to="{ name: 'competitions.submit' }" color="secondary" large class="ma-2">
            Submit Competition
          </v-btn>
        </p>
        <div v-if="!isNative" class="store-badges">
          <a href="https://itunes.apple.com/us/app/scotdance/id1386475626?mt=8" target="_blank" class="ma-2">
            <img src="@/assets/img/app-store.svg?url" alt="Download on the App Store" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank" class="ma-2">
            <img src="@/assets/img/play-store.svg?url" alt="Get it on Google Play" />
          </a>
          <p class="caption">
            (or access everything directly from your mobile/desktop web browser)
          </p>
        </div>
        <h1 class="display-1 print-show">
          <a href="https://scotdance.app">www.scotdance.app</a>
        </h1>
      </div>
    </section>

    <section id="about" class="alt">
      <header>
        <h2 class="display-1 my-4">A virtual program of events</h2>
        <p class="subtitle-1">Modernize your highland dancing experience by interacting with competition information digitally.</p>
      </header>
      <v-container>
        <v-row justify="center">
          <v-col class="col-sm-4">
            <v-icon color="primary" class="icon-people" />
            <h2 class="title my-4">Dancers</h2>
            <p>Search through dancers by their competition number, name, age group, etc. Then mark your favourites for easy tracking.</p>
          </v-col>
          <v-col class="col-sm-4">
            <v-icon color="primary" class="icon-clock" />
            <h2 class="title my-4">Schedule</h2>
            <p>Use the at-a-glance schedule to check event start times, which platforms to dance at, order of dances, and more.</p>
          </v-col>
          <v-col class="col-sm-4">
            <v-icon color="primary" class="icon-trophy" />
            <h2 class="title my-4">Results</h2>
            <p>Get real-time results updates—from callbacks through to placings—and review them anytime after a competition, too.</p>
          </v-col>
        </v-row>
      </v-container>
      <footer>
        <v-btn :to="{ name: 'competitions' }" color="primary" class="ma-2">
          Browse Competitions
        </v-btn>
        <v-btn :to="{ name: 'competitions.submit' }" color="secondary" class="ma-2">
          Submit Competition
        </v-btn>
      </footer>
    </section>

    <section id="faq">
      <header>
        <h2 class="display-1 my-4"><abbr title="Frequently Asked Questions">FAQs</abbr></h2>
        <dl>
          <dt class="title">
            Is there a cost associated with using this site/app at my local competition?
          </dt>
          <dd class="pre-line">
            No! All competition data is user-submitted—and you can use it as a competition organizer or competition attendee for free anywhere in the world. There is no plan for this to ever change.
          </dd>

          <dt class="title">
            Is ScotDance.app affiliated with any association, organization, governing body, or particular competition(s)?
          </dt>
          <dd class="pre-line">
            No, it is a completely independent, not-for-profit, volunteer run endeavour.
          </dd>

          <dt class="title">
            Do I need to download or install anything to get access?
          </dt>
          <dd class="pre-line">
            No, it's entirely optional to use the App/Play Store distributed apps; everything works exactly the same in a web browser on whatever device(s) you own (e.g. by visiting <a href="http://www.scotdance.app">www.scotdance.app</a>). Of course, it's handy to have a dedicated place for easy access, so installing a mobile app makes that possible.
          </dd>

          <dt class="title">
            Is it safe to use? Are you harvesting my data? Are there privacy concerns with having this information available online?
          </dt>
          <dd class="pre-line">
            This service is, in plain words, completely legitimate. It checks all the security boxes you would/should expect, and does nothing remotely nefarious with the (minimal) data it does collect from you. Furthermore, since all competition data is user-submitted, it's conceptually equivalent to uploading scanned or exported results PDFs to a dance association's website—just made more convenient, hopefully. You can also read more details on the <RouterLink :to="{ name: 'policies' }">Policies</RouterLink> page.
          </dd>

          <dt class="title">
            Why are dancers I've favourited <v-icon color="secondary">{{ mdiStar }}</v-icon> in one competition not favourited in all competitions?
          </dt>
          <dd class="pre-line">
            Since dancer numbers are unique for each competition—and names, locations, and ages can be misspelled or change over time—it's very difficult (for a computer) to distinguish "Jane Doe" in Competition A from "Jane Doe" in Competition B. So until this app can be connected more directly to registrations, it's unfortunately necessary to re-favourite dancers for each competition.
          </dd>
        </dl>
      </header>
    </section>

    <section id="info" class="alt">
      <header>
        <h2 class="display-1 my-4">Info</h2>
        <p>{{ $package.$name }} (2017-{{ currentYear }}) by <a href="https://mismith.io" target="_blank" class="ext">Murray Rowan</a></p>
        <p>View the source code on <a href="https://github.com/mismith/scotdance" target="_blank" class="ext">GitHub</a></p>
        <p>Track development via <a href="https://trello.com/b/ZCZ8t1fH" target="_blank" class="ext">Trello</a></p>
        <p v-if="$store.state.helpAvailable">Support/Feedback: <a href="#" @click.prevent="help(true)">Live Chat / Email</a></p>
        <p>Legal: <router-link :to="{ name: 'policies' }">Policies</router-link></p>
        <p v-test="'version'"><small>{{ devicePlatform }} App v{{ $package.version || '?' }}</small></p>
      </header>
    </section>
  </div>
</template>

<script>
import { mdiStar } from '@mdi/js';
import {
  mapState,
  mapActions,
} from 'vuex';

export default {
  name: 'Home',
  data() {
    return {
      mdiStar,
    };
  },
  computed: {
    ...mapState([
      '$package',
      '$device',
    ]),

    currentYear() {
      return new Date().getFullYear();
    },
    devicePlatform() {
      switch (this.$device?.platform?.toLowerCase()) {
        case 'ios': return 'iOS';
        case 'android': return 'Android';
        case 'web': return 'Web';
        default: return '';
      }
    },
  },
  methods: {
    ...mapActions([
      'help',
    ]),
  },
};
</script>

<style lang="scss">
.Home {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  text-align: center;

  section {
    flex-shrink: 0;
    padding: 0 0 40px;

    & > header {
      padding: 20px;
    }
  }
  #hero {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;

    h1 {
      @media (max-width: 400px) {
        // prevent overflow on iPhone 5
        font-size: 36px !important;
      }
    }
    .store-badges {
      a {
        display: inline-block;
      }
      img {
        height: 48px;
      }
    }
  }
  #about {
    .v-icon {
      font-size: 88px;
    }
    .col {
      min-width: 240px;
      padding: 20px;
    }
  }
  #faq {
    dl {
      max-width: 768px;
      text-align: left;
      margin: 0 auto;

      dt,
      dd {
        margin: 12px 0;
      }
      dt {
        margin-top: 48px;
      }
    }
  }
  #info {
    a {
      white-space: nowrap;
    }
  }
}
</style>
