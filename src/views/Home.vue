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
            <img src="@/assets/img/app-store.svg" alt="Download on the App Store" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank" class="ma-2">
            <img src="@/assets/img/play-store.svg" alt="Get it on Google Play" />
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
        <h2 class="display-1 my-4">FAQs</h2>
        <dl v-if="faqs.length">
          <template v-for="faq in faqs">
            <dt :key="faq.question" v-html="$sanitize(faq.question)" class="title" />
            <dd :key="faq.answer" v-html="$sanitize(faq.answer)" class="pre-line" />
          </template>
        </dl>
        <Spinner v-else />
      </header>
    </section>

    <section id="info" class="alt">
      <header>
        <h2 class="display-1 my-4">Info</h2>
        <p>{{ $package.$name }} was created in 2017 by <a href="https://mismith.io" target="_blank" class="ext">Murray Rowan</a></p>
        <p>View the source code on <a href="https://github.com/mismith/scotdance" target="_blank" class="ext">GitHub</a></p>
        <p>Track development via <a href="https://trello.com/b/ZCZ8t1fH" target="_blank" class="ext">Trello</a></p>
        <p>Legal documents: <router-link :to="{ name: 'policies' }">Policies</router-link></p>
        <p v-if="$store.state.helpAvailable">Support/Feedback through <a href="#" @click.prevent="help(true)">Live Chat</a></p>
        <p v-test="'version'"><small>{{ devicePlatform }} App v{{ $package.version || '?' }}</small></p>
      </header>
    </section>
  </div>
</template>

<script>
import {
  mapState,
  mapActions,
} from 'vuex';
import { db } from '@/helpers/firebase';

export default {
  name: 'Home',
  firebase: {
    faqs: db.child('faqs'),
  },
  computed: {
    ...mapState([
      '$package',
      '$device',
    ]),

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
        margin-top: 24px;
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
