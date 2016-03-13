var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var R = require('ramda');

// This is the heart of your HipChat Connect add-on. For more information,
// take a look at https://developer.atlassian.com/hipchat/tutorials/getting-started-with-atlassian-connect-express-node-js
module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);
  var pains = require('../lib/pains')(addon);

  // simple healthcheck
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  // Root route. This route will serve the `addon.json` unless a homepage URL is
  // specified in `addon.json`.
  app.get('/',
    function (req, res) {
      // Use content-type negotiation to choose the best way to respond
      res.format({
        // If the request content-type is text-html, it will decide which to serve up
        'text/html': function () {
          var homepage = url.parse(addon.descriptor.links.homepage);
          if (homepage.hostname === req.hostname && homepage.path === req.path) {
            res.render('homepage', addon.descriptor);
          } else {
            res.redirect(addon.descriptor.links.homepage);
          }
        },
        // This logic is here to make sure that the `addon.json` is always
        // served up when requested by the host
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
    );

  // This is an example route that's used by the default for the configuration page
  // https://developer.atlassian.com/hipchat/guide/configuration-page
  app.get('/config',
    // Authenticates the request using the JWT token in the request
    addon.authenticate(),
    function (req, res) {
      // The `addon.authenticate()` middleware populates the following:
      // * req.clientInfo: useful information about the add-on client such as the
      //   clientKey, oauth info, and HipChat account info
      // * req.context: contains the context data accompanying the request like
      //   the roomId
      res.render('config', req.context);
    }
    );

  // This is an example glance that shows in the sidebar
  // https://developer.atlassian.com/hipchat/guide/glances
  app.get('/glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json({
        "label": {
          "type": "html",
          "value": "Hello World!"
        },
        "status": {
          "type": "lozenge",
          "value": {
            "label": "NEW",
            "type": "error"
          }
        }
      });
    }
    );

  // This is an example end-point that you can POST to to update the glance info
  // Room update API: https://www.hipchat.com/docs/apiv2/method/room_addon_ui_update
  // Group update API: https://www.hipchat.com/docs/apiv2/method/addon_ui_update
  // User update API: https://www.hipchat.com/docs/apiv2/method/user_addon_ui_update
  app.post('/update_glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json({
        "label": {
          "type": "html",
          "value": "Hello World!"
        },
        "status": {
          "type": "lozenge",
          "value": {
            "label": "All good",
            "type": "success"
          }
        }
      });
    }
    );

  // This is an example sidebar controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/dialog-and-sidebar-views/sidebar
  app.get('/sidebar',
    addon.authenticate(),
    function (req, res) {
      res.render('sidebar', {
        identity: req.identity
      });
    }
    );

  // This is an example dialog controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/dialog-and-sidebar-views/dialog
  app.get('/dialog',
    addon.authenticate(),
    function (req, res) {
      res.render('dialog', {
        identity: req.identity
      });
    }
    );

  // Sample endpoint to send a card notification back into the chat room
  // See https://developer.atlassian.com/hipchat/guide/sending-messages
  app.post('/send_notification',
    addon.authenticate(),
    function (req, res) {
      var card = {
        "style": "link",
        "url": "https://www.hipchat.com",
        "id": uuid.v4(),
        "title": req.body.messageTitle,
        "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
        "icon": {
          "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
        }
      };
      var msg = '<b>' + card.title + '</b>: ' + card.description;
      var opts = { 'options': { 'color': 'yellow' } };
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg, opts, card);
      res.json({ status: "ok" });
    }
    );

  var getTableOfTop5Pains = function(painList) {
    if (R.either(R.isNil, R.isEmpty)(painList)) {
      return "No! You're pain free?!";
    } else {
      return R.reduce(
        function(html, pain) {
          var nrOfReporters = pain.reporters.length;
          return html + '<tr>' +
            '<td>' + pain.description + '</td>' +
            '<td>' + nrOfReporters + '</td>' +
            '<td>' + pain.id + '</td>' +
            '</tr>';
        },
        'The top 5 pains right now:<br><table><tr>' +
          '<th>Pain</th>' +
          '<th>Reporters</th>' +
          '<th>ID</th>' +
          '</tr>',
        R.take(5, painList)
      ) + '</table>';
    }
  };

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/webhooks/pains',
    addon.authenticate(),
    function (req, res) {
      pains.listPains(req.clientInfo.clientKey).then(function success(painList) {
        return hipchat.sendMessage(
          req.clientInfo,
          req.identity.roomId,
          getTableOfTop5Pains(painList),
          {options: {color: 'gray'}}
        );
      }, function failure(error) {
        console.error('Failed to list pains', req.body.item.message, error);
        return hipchat.sendMessage(
          req.clientInfo,
          req.identity.roomId,
          "I'm afraid something went wrong and I wasn't able to fetch all the pains.",
          {options: {color: 'red'}}
        );
      }).then(function (data) {
          res.sendStatus(200);
        }).catch(function(error) {
          console.error('Failed to send a response to hipchat', error);
          res.sendStatus(500);
          return RSVP.Promise.reject(error);
        });
    }
  );
  app.post('/webhooks/ouch',
    addon.authenticate(),
    function (req, res) {
      var clientKey = req.clientInfo.clientKey;
      var pain = {
        id: req.body.item.message.id,
        description: R.compose(
          R.trim,
          R.replace(/^\/ouch/, '')
        )(req.body.item.message.message),
      };
      var reporter = R.pick(['id', 'name'], req.body.item.message.from);

      pains.reportPain(clientKey, pain, reporter).then(function success() {
        return hipchat.sendMessage(
          req.clientInfo,
          req.identity.roomId,
          "You've got it coming."
        );
      }, function failure(error) {
        console.error('Failed to report a pain', req.body.item.message, error);
        return hipchat.sendMessage(
          req.clientInfo,
          req.identity.roomId,
          "I'm afraid something went wrong and I wasn't able to record your pain.",
          {options: {color: 'red'}}
        );
      }).then(function (data) {
          res.sendStatus(200);
        }).catch(function(error) {
          console.error('Failed to send a response to hipchat', error);
          res.sendStatus(500);
          return RSVP.Promise.reject(error);
        });
    }
  );
  app.post('/webhooks/heal',
    addon.authenticate(),
    function (req, res) {
      var clientKey = req.clientInfo.clientKey;
      var description = R.compose(
        R.trim,
        R.replace(/^\/heal/, '')
      )(req.body.item.message.message);
      var healerName = req.body.item.message.from.name;

      pains.healPain(clientKey, description).then(function success(healedPain) {
        var healedNames = R.join(', ', R.map(R.prop('name'), healedPain.reporters))
        return hipchat.sendMessage(
          req.clientInfo,
          req.identity.roomId,
          healedNames + ', rejoice! ' + healerName + ' has healed your pain!',
          {
            options: {
              color: 'green',
              format: 'text',
            }
          }
        );
      }, function failure(error) {
        console.error('Failed to heal a pain', req.body.item.message, error);
        return hipchat.sendMessage(
          req.clientInfo,
          req.identity.roomId,
          "Hmm. Something went wrong. Are you sure someone has reported that pain?",
          {options: {color: 'red'}}
        );
      }).then(function (data) {
          res.sendStatus(200);
        }).catch(function(error) {
          console.error('Failed to send a response to hipchat', error);
          res.sendStatus(500);
          return RSVP.Promise.reject(error);
        });
    }
  );

  // Notify the room that the add-on was installed. To learn more about
  // Connect's install flow, check out:
  // https://developer.atlassian.com/hipchat/guide/installation-flow
  addon.on('installed', function (clientKey, clientInfo, req) {
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function (id) {
    addon.settings.client.keys(id + ':*', function (err, rep) {
      rep.forEach(function (k) {
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

};
