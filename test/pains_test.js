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
    var description = memoized('');
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
      return pains.reportPain(clientKey(), description(), reporter()).then(function() {
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
      var desc = 'a description';
      var aReporter = {id: 1, name: 'a name'};
      currentPainsPromise.is(R.always(Promise.resolve(null)));
      description.is(R.always(desc));
      reporter.is(R.always(aReporter))

      it('inserts the reported pain into the DB', function() {
        expect(newPains).to.eql([{
          description: desc,
          reporters: [aReporter],
        }]);
      });
    });

    context('with there being no pains (DB entry is an empty array)', function() {
      var desc = 'a description';
      var aReporter = {id: 1, name: 'a name'};
      currentPainsPromise.is(R.always(Promise.resolve([])));
      description.is(R.always(desc));
      reporter.is(R.always(aReporter))

      it('inserts the reported pain into the DB', function() {
        expect(newPains).to.eql([{
          description: desc,
          reporters: [aReporter],
        }]);
      });
    });

    context('with a different pain having been previously reported', function() {
      var desc = 'a description';
      var aReporter = {id: 1, name: 'a name'};
      var previousPain = {
        description: 'different description',
        reporters: [aReporter],
      };
      currentPainsPromise.is(R.always(Promise.resolve([previousPain])));
      description.is(R.always(desc));
      reporter.is(R.always(aReporter))

      it('updates the DB record to include both pains', function() {
        expect(newPains).to.eql([previousPain, {
          description: desc,
          reporters: [aReporter],
        }]);
      });
    });

    context('with the same pain having been previously reported', function() {
      context('by the same reporter', function() {
        var desc = 'a description';
        var aReporter = {id: 1, name: 'a name'};
        var previousPain = {
          description: desc,
          reporters: [aReporter],
        };
        currentPainsPromise.is(R.always(Promise.resolve([previousPain])));
        description.is(R.always(desc));
        reporter.is(R.always(aReporter))

        it('keeps the DB record the same', function() {
          expect(newPains).to.eql([previousPain]);
        });
      });

      context('by a different reporter', function() {
        var desc = 'a description';
        var aReporter = {id: 1, name: 'a name'};
        var previousPain = {
          description: desc,
          reporters: [{id: 2, name: 'different name'}],
        };
        currentPainsPromise.is(R.always(Promise.resolve([previousPain])));
        description.is(R.always(desc));
        reporter.is(R.always(aReporter))

        it('updates the DB record to include the other reporter', function() {
          expect(newPains).to.eql([{
            description: desc,
            reporters: previousPain.reporters.concat(aReporter),
          }]);
        });
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
});
