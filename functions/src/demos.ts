import admin from 'firebase-admin';
import { attachUserToCompetition } from './utility/competition';

class Demos {
  database;
  config;

  constructor(database, config = {}) {
    this.database = database;
    this.config = config;
  }

  async handleCreate(after, ctx) {
    const { db } = this.config;
    const { userId, competitionId } = ctx.params;

    await db.child('competitions').child(competitionId).set({
      name: 'DemoComp', // @TODO
      demo: true,
    });
    // @TODO: add/generate dummy/seed data
    await attachUserToCompetition({
        db,
        userId,
        competitionId,
    });
    await after.ref.child('started').set(admin.database.ServerValue.TIMESTAMP);
  }

  async handleRemove(_, ctx) {
    const { db } = this.config;
    const { competitionId } = ctx.params;

    await Promise.all([
      db.child('competitions').child(competitionId).remove(),
      db.child('competitions:data').child(competitionId).remove(),
    ]);
  }

  // eslint-disable-next-line class-methods-use-this
  async handleError(err, snap, ctx) {
    // eslint-disable-next-line no-console
    console.error(err, snap && snap.val(), ctx);
  }

  hook(path) {
    const ref = this.database.ref(path);
    const stoppedRef = this.database.ref(`${path}/stopped`);

    return {
      ref,
      onCreate: ref.onCreate(async (after, ctx) => {
        try {
          return await this.handleCreate(after, ctx);
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
      onDelete: ref.onDelete(async (before, ctx) => {
        try {
          return await this.handleRemove(before, ctx);
        } catch (err) {
          return this.handleError(err, before, ctx);
        }
      }),
      onStop: stoppedRef.onCreate(async (after, ctx) => {
        try {
          return await this.handleRemove(after, ctx);
        } catch (err) {
          return this.handleError(err, after, ctx);
        }
      }),
    };
  }
}

export default Demos;
