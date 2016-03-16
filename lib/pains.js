var R = require('ramda');
var Promise = require('rsvp').Promise;

module.exports = function(addon) {
  var PAINS_KEY = 'pains';

  var escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };

  var matches = function(description) {
    return R.either(
      R.propEq('description', description),
      R.compose(
        R.test(new RegExp(escapeRegExp(description))),
        R.prop('id')
      )
    );
  };

  return {
    reportPain: function(clientKey, pain, reporter) {
      return addon.settings.get(PAINS_KEY, clientKey).then(function(currentPains) {
        var matchesPain = matches(pain.description);
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
    listPains: function(clientKey) {
      return addon.settings.get(PAINS_KEY, clientKey);
    },
    healPain: function(clientKey, description) {
      return addon.settings.get(PAINS_KEY, clientKey).then(function(currentPains) {
        currentPains = currentPains || [];
        var matchesHealedPain = matches(description);
        if (R.any(matchesHealedPain, currentPains)) {
          var healedPain = R.find(matchesHealedPain, currentPains);
          var newPains = R.reject(matchesHealedPain, currentPains);
          return addon.settings.set(PAINS_KEY, newPains, clientKey).then(function() {
            return healedPain;
          });
        } else {
          return Promise.reject(new Error("Couldn't find that pain."));
        }
      });
    },
  };
};
