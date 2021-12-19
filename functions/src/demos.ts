import admin from 'firebase-admin';
import * as faker from 'faker';
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

    const date = faker.date.future();
    const stateAbbr = faker.address.stateAbbr();
    await db.child('competitions').child(competitionId).set({
      name: `Demo Competition ${Date.now()}`,
      date: date.toISOString().split('T')[0],
      image: 'data:image/png;base64,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',
      venue: faker.company.companyName(),
      address: faker.address.streetAddress(),
      location: `${faker.address.city()}, ${stateAbbr}`,
      sobhd: `${faker.random.arrayElement(['C','S','E','W','I','U','A'])}-${stateAbbr}-CO-${date.getFullYear().toString().substr(-2)}-${faker.random.number({ min: 1000, max: 2000 })}`,
      registrationURL: 'https://docs.google.com/forms/d/abcdefghijklmnopqrstuvwxyz',
      registrationStart: `${faker.date.past().toISOString().split(':')[0]}:00`,
      registrationEnd: `${faker.date.future().toISOString().split(':')[0]}:00`,
      links: {
        [faker.datatype.hexaDecimal(16)]: {
          name: faker.company.catchPhraseNoun(),
          url: faker.internet.url(),
        },
        [faker.datatype.hexaDecimal(16)]: {
          name: faker.company.catchPhraseNoun(),
          url: faker.internet.url(),
        },
      },
      demo: true,
    });
    await db.child('competitions:data').child(competitionId).set({
      staff: ['Judge', 'Judge', 'Judge', 'Piper', 'Piper', 'Volunteer', 'Volunteer', 'Volunteer', 'Volunteer'].reduce((acc, type, i) => ({
        ...acc,
        [`${i}${faker.datatype.hexaDecimal(15)}`]: {
          type,
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName(),
          location: `${faker.address.city()}, ${faker.address.stateAbbr()}`,
          description: faker.lorem.paragraphs(),
          image: faker.image.people(200, 200), // @TODO: avoid randomizing
          website: faker.internet.url(),
        },
      }), {}),
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
