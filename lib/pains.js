var R = require('ramda');

module.exports = function(addon) {
  var PAINS_KEY = 'pains';

  return {
    reportPain: function(clientKey, description, reporter) {
      return addon.settings.get(PAINS_KEY, clientKey).then(function(currentPains) {
        var pains = R.ifElse(
          R.any(R.propEq('description', description)),
          R.map(R.when(R.propEq('description', description), R.evolve({
            reporters: R.compose(
              R.uniqBy(R.prop('id')),
              R.append(reporter)
            ),
          }))),
          R.append({description: description, reporters: [reporter]})
        )(currentPains || []);
        return addon.settings.set(PAINS_KEY, pains, clientKey);
      });
    },
  };
};
