import {
  firebase,
} from '@/helpers/firebase';

export default {
  data() {
    return {
      me: undefined,

      credentials: {
        email: undefined,
        password: undefined,
      },
      authLoading: false,
      authError: undefined,

      unbindFirebaseAuth: undefined,
    };
  },
  methods: {
    register(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .createUserWithEmailAndPassword(credentials.email, credentials.password)
        .then(() => {
          this.authLoading = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;
        });
    },
    forgot(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .sendPasswordResetEmail(credentials.email)
        .then(() => {
          this.authLoading = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;
        });
    },
    login(credentials = this.credentials) {
      this.authLoading = true;
      this.authError = null;

      return firebase.auth()
        .signInWithEmailAndPassword(credentials.email, credentials.password)
        .then(() => {
          this.authLoading = false;
        })
        .catch((err) => {
          this.authLoading = false;
          this.authError = err;
        });
    },
    logout() {
      return firebase.auth().signOut();
    },
  },
  created() {
    this.unbindFirebaseAuth = firebase.auth().onAuthStateChanged((me) => {
      if (me) {
        this.me = me.providerData[0];

        this.$emit('authed', this.me);
      } else {
        this.me = me;

        this.$emit('unauthed', this.me);
      }
    });
  },
  beforeDestroy() {
    if (this.unbindFirebaseAuth) {
      this.unbindFirebaseAuth();
    }
  },
};
