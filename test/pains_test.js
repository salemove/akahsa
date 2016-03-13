'use strict';
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var memo = require('memo-is');
var R = require('ramda');
var Promise = require('rsvp').Promise;
var expect = chai.expect;
chai.use(sinonChai);

var memoized = function(thing) {
  return memo().is(R.always(thing));
};

describe('pains', function() {
  var pains = null;
  var get = memoized(null);
  var set = memoized(null);
  var addon = memo().is(function(){
    return {
      settings: {
        get: get(),
        set: set(),
      },
    };
  });

  beforeEach(function() {
    pains = require('../lib/pains')(addon());
  });

  describe('#reportPain', function() {
    var clientKey = memoized('a-key');
    var pain = memoized('');
    var reporter = memoized({});
    var currentPainsPromise = memoized(Promise.resolve([]));
    var setPainsPromise = memoized(Promise.resolve(null));
    var newPains = null;
    var error = null;

    get.is(function() {
      return sinon.stub()
        .withArgs('pains', clientKey())
        .returns(currentPainsPromise());
    });
    set.is(function() {
      return sinon.stub()
        .withArgs('pains', sinon.match.any, clientKey())
        .returns(setPainsPromise());
    });

    beforeEach(function() {
      newPains = null;
      error = null;
      return pains.reportPain(clientKey(), pain(), reporter()).then(function() {
        newPains = set().firstCall.args[1];
      }).catch(function(_error_) {
        error = _error_;
      });
    });

    context('with getting pains from DB failing', function() {
      var dbError = new Error('DB missing');
      currentPainsPromise.is(R.always(Promise.reject(dbError)));

      it('fails with same error', function() {
        expect(error).to.eql(dbError);
      });
    });

    context('with setting new pains to DB failing', function() {
      var dbError = new Error('DB missing');
      setPainsPromise.is(R.always(Promise.reject(dbError)));

      it('fails with same error', function() {
        expect(error).to.eql(dbError);
      });
    });

    context('with current DB entry being empty (null)', function() {
      var reportedPain = {
        id: 'an-id',
        description: 'a description',
      };
      var aReporter = {id: 1, name: 'a name'};
      currentPainsPromise.is(R.always(Promise.resolve(null)));
      pain.is(R.always(reportedPain));
      reporter.is(R.always(aReporter))

      it('inserts the reported pain into the DB', function() {
        expect(newPains).to.eql([{
          id: reportedPain.id,
          description: reportedPain.description,
          reporters: [aReporter],
        }]);
      });
    });

    context('with there being no pains (DB entry is an empty array)', function() {
      var reportedPain = {
        id: 'an-id',
        description: 'a description',
      };
      var aReporter = {id: 1, name: 'a name'};
      currentPainsPromise.is(R.always(Promise.resolve([])));
      pain.is(R.always(reportedPain));
      reporter.is(R.always(aReporter))

      it('inserts the reported pain into the DB', function() {
        expect(newPains).to.eql([{
          id: reportedPain.id,
          description: reportedPain.description,
          reporters: [aReporter],
        }]);
      });
    });

    context('with a different pain having been previously reported', function() {
      var reportedPain = {
        id: 'an-id',
        description: 'a description',
      };
      var aReporter = {id: 1, name: 'a name'};
      var previousPain = {
        id: 'other-id',
        description: 'different description',
        reporters: [aReporter],
      };
      currentPainsPromise.is(R.always(Promise.resolve([previousPain])));
      pain.is(R.always(reportedPain));
      reporter.is(R.always(aReporter))

      it('updates the DB record to include both pains', function() {
        expect(newPains).to.eql([previousPain, {
          id: reportedPain.id,
          description: reportedPain.description,
          reporters: [aReporter],
        }]);
      });
    });

    context('with the same pain having been previously reported', function() {
      var previousId = 'an id';
      var previousDescription = 'a description';
      var previousReporter = memoized({});
      var previousPain = memo().is(function() {
        return {
          id: previousId,
          description: previousDescription,
          reporters: [previousReporter()],
        };
      });
      currentPainsPromise.is(function() {
        return Promise.resolve([previousPain()]);
      });

      var itUpdatesTheDbRecord = function() {
        context('by the same reporter', function() {
          var aReporter = {id: 1, name: 'a name'};
          previousReporter.is(R.always(aReporter));
          reporter.is(R.always(aReporter))

          it('keeps the DB record the same', function() {
            expect(newPains).to.eql([previousPain()]);
          });
        });

        context('by a different reporter', function() {
          var aReporter = {id: 1, name: 'a name'};
          var differentReporter = {id: 2, name: 'different name'};
          previousReporter.is(R.always(differentReporter));
          reporter.is(R.always(aReporter))

          it('updates the DB record to include the other reporter', function() {
            expect(newPains).to.eql([{
              id: previousPain().id,
              description: previousPain().description,
              reporters: [differentReporter, aReporter],
            }]);
          });
        });
      };

      context('with the same exact description', function() {
        pain.is(R.always({
          id: 'another id',
          description: previousDescription,
        }));

        itUpdatesTheDbRecord();
      });

      context('with the description referring to the previous ID', function() {
        pain.is(R.always({
          id: 'another id',
          description: previousId,
        }));

        itUpdatesTheDbRecord();
      });
    });
  });

  describe('#listPains', function() {
    var clientKey = memoized('a-key');
    var currentPainsPromise = memoized(Promise.resolve([]));

    get.is(function() {
      return sinon.stub()
        .withArgs('pains', clientKey())
        .returns(currentPainsPromise());
    });

    context('with getting the pains from DB failing', function() {
      var dbError = new Error('DB missing');
      currentPainsPromise.is(R.always(Promise.reject(dbError)));

      it('fails with same error', function() {
        return pains.listPains(clientKey()).then(function success() {
          expect.fail();
        }, function failure(error) {
          expect(error).to.eql(dbError);
        });
      });
    });

    context('with getting the pains from DB succeeding', function() {
      var dbPains = [{mock: 'pain'}];
      currentPainsPromise.is(R.always(Promise.resolve(dbPains)));

      it('resolves with the pains returned from DB', function() {
        return pains.listPains(clientKey()).then(function success(returnedPains) {
          expect(returnedPains).to.eql(dbPains);
        });
      });
    });
  });

  describe('#healPain', function() {
    var clientKey = memoized('a-key');
    var description = memoized('');
    var expectedNewPains = memoized([]);
    var currentPainsPromise = memoized(Promise.resolve([]));
    var setPainsPromise = memoized(Promise.resolve(null));
    var healedPain = null;
    var error = null;

    get.is(function() {
      return sinon.stub()
        .withArgs('pains', clientKey())
        .returns(currentPainsPromise());
    });
    set.is(function() {
      return sinon.stub()
        .withArgs('pains', expectedNewPains(), clientKey())
        .returns(setPainsPromise());
    });

    beforeEach(function() {
      healedPain = null;
      error = null;
      return pains.healPain(clientKey(), description()).then(function(_healedPain_) {
        healedPain = _healedPain_;
      }).catch(function(_error_) {
        error = _error_;
      });
    });

    context('with getting pains from DB failing', function() {
      var dbError = new Error('DB missing');
      currentPainsPromise.is(R.always(Promise.reject(dbError)));

      it('fails with same error', function() {
        expect(error).to.eql(dbError);
      });
    });

    context('with current DB entry being empty (null)', function() {
      currentPainsPromise.is(R.always(Promise.resolve(null)));

      it('fails not finding the pain to heal', function() {
        expect(error).to.be.instanceof(Error);
      });
    });

    context('with there being no pains (DB entry is an empty array)', function() {
      currentPainsPromise.is(R.always(Promise.resolve([])));

      it('fails not finding the pain to heal', function() {
        expect(error).to.be.instanceof(Error);
      });
    });

    context('with a different pain in DB', function() {
      currentPainsPromise.is(R.always(Promise.resolve([{
        id: 'an id',
        description: 'a description',
      }])));
      description.is(R.always('something different'));

      it('fails not finding the pain to heal', function() {
        expect(error).to.be.instanceof(Error);
      });
    });

    var itHealsThePain = function(painToHeal) {
      context('with setting new pains to DB failing', function() {
        var dbError = new Error('DB missing');
        setPainsPromise.is(R.always(Promise.reject(dbError)));

        it('fails with same error', function() {
          expect(error).to.eql(dbError);
        });
      });

      context('with setting new pains to DB succeeding', function() {
        it('resolves with the healed pain', function() {
          expect(error).to.be.null;
          expect(healedPain).to.eql(painToHeal);
        });
      });
    };

    context('with a pain with matching ID in DB', function() {
      var id = 'an id';
      var painToHeal = {
        id: id,
        description: 'a description',
      };
      currentPainsPromise.is(R.always(Promise.resolve([painToHeal])));
      expectedNewPains.is(R.always([]));
      description.is(R.always(id));

      context('with no other pains in DB', function() {
        currentPainsPromise.is(R.always(Promise.resolve([painToHeal])));
        expectedNewPains.is(R.always([]));

        itHealsThePain(painToHeal);
      });

      context('with other pains in DB as well', function() {
        var otherPain = {
          id: 'other id',
          description: 'other description',
        };
        currentPainsPromise.is(R.always(Promise.resolve([otherPain, painToHeal])));
        expectedNewPains.is(R.always([otherPain]));

        itHealsThePain(painToHeal);
      });
    });

    context('with a pain with matching description in DB', function() {
      var existingDescription = 'a description';
      var painToHeal = {
        id: 'an id',
        description: existingDescription,
      };
      currentPainsPromise.is(R.always(Promise.resolve([painToHeal])));
      expectedNewPains.is(R.always([]));
      description.is(R.always(existingDescription));

      itHealsThePain(painToHeal);
    });
  });
});
