const { GoogleAuth } = require('google-auth-library');
const audience = 'https://us-central1-scotdance-connect.cloudfunctions.net/api';
const google = new GoogleAuth();
/** Auth's retried deletion event is the authority; a browser never chooses an account to erase. */
exports.deleteConnectAccount = async (uid) => {
  const client = await google.getIdTokenClient(audience);
  await client.request({url: `${audience}/identity/deleted`, method: 'POST', data: {uid}, timeout: 30000});
};
