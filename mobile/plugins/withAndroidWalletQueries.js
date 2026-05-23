const { withAndroidManifest } = require('expo/config-plugins');

const WALLET_SCHEMES = ['metamask', 'wc'];

function createQueryIntent(scheme) {
  return {
    action: [
      {
        $: {
          'android:name': 'android.intent.action.VIEW',
        },
      },
    ],
    category: [
      {
        $: {
          'android:name': 'android.intent.category.BROWSABLE',
        },
      },
    ],
    data: [
      {
        $: {
          'android:scheme': scheme,
        },
      },
    ],
  };
}

function hasSchemeQuery(intent, scheme) {
  return intent?.data?.some((item) => item?.$?.['android:scheme'] === scheme);
}

module.exports = function withAndroidWalletQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];

    const query = manifest.queries[0];
    query.intent = query.intent ?? [];

    for (const scheme of WALLET_SCHEMES) {
      if (!query.intent.some((intent) => hasSchemeQuery(intent, scheme))) {
        query.intent.push(createQueryIntent(scheme));
      }
    }

    return config;
  });
};
