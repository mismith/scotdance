import { messaging } from 'firebase-admin';
import * as flatten from 'obj-flatten';
import { diff } from 'fast-array-diff';

class FirebaseNotifications {
  database;
  config;

  static flattenPaths(obj) {
    return Object.keys(flatten(obj, '/') || {});
  }
  static getTopicPath(topic) {
    return `/topics/${topic.replace(/[^a-zA-Z0-9-_.~%]/g, '-')}`;
  }

  constructor(database, config = {}) {
    this.database = database;
    this.config = config;
  }

  async getUserTopics(userId) {
    const userTopicsSnap = await this.config.db
      .child('users:topics')
      .child(userId)
      .once('value');
    return FirebaseNotifications.flattenPaths(userTopicsSnap.val());
  }
  async getUserTokens(userId) {
    const userTokensSnap = await this.config.db
      .child('users:tokens')
      .child(userId)
      .once('value');
    return FirebaseNotifications.flattenPaths(userTokensSnap.val());
  }

  hookTokens(path = 'users:tokens') {
    const ref = this.database.ref(`${path}/{userId}/{tokenId}`);

    return {
      ref,
      onCreate: ref.onCreate(async (after, ctx) => {
        const userTopics = await this.getUserTopics(ctx.params.userId);

        return Promise.all(userTopics.map((topic) => {
          return messaging()
            .subscribeToTopic(ctx.params.tokenId, FirebaseNotifications.getTopicPath(topic));
        }));
      }),
      onDelete: ref.onDelete(async (snap, ctx) => {
        const userTopics = await this.getUserTopics(ctx.params.userId);

        return Promise.all(userTopics.map((topic) => {
          return messaging()
            .unsubscribeFromTopic(ctx.params.tokenId, FirebaseNotifications.getTopicPath(topic));
        }));
      }),
    };
  }
  hookTopics(path = 'users:topics') {
    const ref = this.database.ref(`${path}/{userId}`);

    return {
      ref,
      onWrite: ref.onWrite(async ({ before, after }, ctx) => {
        const topicsBefore = FirebaseNotifications.flattenPaths(before.val());
        const topicsAfter = FirebaseNotifications.flattenPaths(after.val());
        const { removed, added } = diff(topicsBefore, topicsAfter);
        const userTokens = await this.getUserTokens(ctx.params.userId);

        return Promise.all([
          removed.map(topic => messaging()
            .unsubscribeFromTopic(userTokens, FirebaseNotifications.getTopicPath(topic))),
          added.map(topic => messaging()
            .subscribeToTopic(userTokens, FirebaseNotifications.getTopicPath(topic))),
        ]);
      }),
    };
  }
}

export default class Notifications extends FirebaseNotifications {
  async fetchGroupName (competitionId, groupId) { // @TODO: unduplicate this
    const competitionRef = this.config.db.child('competitions:data').child(competitionId);
    const groupRef = await competitionRef.child('groups').child(groupId);
    const group = (await groupRef.once('value')).val();
    const categoryRef = await competitionRef.child('categories').child(group.categoryId);
    const category = (await categoryRef.once('value')).val();

    return `${category ? category.name : ''} ${group.name || ''}`;
  }

  hookResults(path = '/{competitionId}/{groupId}/{danceId}') {
    const ref = this.database.ref(path);

    return {
      ref,
      onCreate: ref.onCreate(async (snap, ctx) => {
        const { competitionId, groupId, danceId } = ctx.params;
        const title = danceId === 'callbacks' ? 'Callbacks Announced' : 'Results Available';
        const body = await this.fetchGroupName(competitionId, groupId);

        return messaging().send({
          notification: {
            title,
            body,
          },
          data: {
            to: JSON.stringify({
              name: 'competition.results',
              params: {
                competitionId,
                groupId,
                danceId,
              },
            }),
          },
          topic: Notifications.getTopicPath(`competitions/${competitionId}/results`),
        });
      }),
    };
  }
}
