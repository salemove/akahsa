var R = require('ramda');

module.exports = function(addon) {
  var PAINS_KEY = 'pains';

  return {
    listPains: function(clientKey) {
      return addon.settings.get(PAINS_KEY, clientKey);
    },
    reportPain: function(clientKey, pain, reporter) {
      return addon.settings.get(PAINS_KEY, clientKey).then(function(currentPains) {
        var matchesPain = R.either(
          R.propEq('description', pain.description),
          R.propEq('id', pain.description)
        );
        var pains = R.ifElse(
          R.any(matchesPain),
          R.map(R.when(matchesPain, R.evolve({
            reporters: R.compose(
              R.uniqBy(R.prop('id')),
              R.append(reporter)
            ),
          }))),
          R.append({id: pain.id, description: pain.description, reporters: [reporter]})
        )(currentPains || []);
        return addon.settings.set(PAINS_KEY, pains, clientKey);
      });
    },
  };
};
