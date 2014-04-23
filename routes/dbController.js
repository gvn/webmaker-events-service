var hatchet = require('hatchet');
var jsonToCSV = require('../util/json-to-csv');

module.exports = function (db) {

  // Check if a user has write access to an event.
  function isAuthorized(req, eventInstance) {
    if (req.session.user && req.devAdmin || req.session.user.isAdmin || eventInstance.organizer === req.session.user.email) {
      return true;
    }
  }

  // MODEL METHODS ------------------------------------------------------------

  /**
   * Store human readable tags in the tag table if they're not already there
   * @param  {Array, String}   tags     Human readable tags as either CSV or String array
   * @param  {Function} callback
   */

  function storeTags(tags, callback) {
    var tagsProcessed = 0;
    var tagsToProcess = 0;
    var eventTags = [];

    function tagProcessed() {
      tagsProcessed++;

      if (tagsProcessed === tagsToProcess) {
        pullTagIDs();
      }
    }

    function pullTagIDs() {
      db.tag
        .findAll({
          where: {
            name: eventTags
          }
        })
        .success(function (records) { // Construct a CSV of tag IDs to send back to caller
          var tagIdCSV = '';

          records.forEach(function (record, index) {
            tagIdCSV += (record.id + ',');
          });

          tagIdCSV = tagIdCSV.slice(0, -1);
          // tags = tagIdCSV;
          callback.call(null, tagIdCSV);
        });
    }

    // Parse CSV or just use array of tags
    if (!Array.isArray(tags)) {
      eventTags = tags.split(',');
    } else {
      eventTags = tags;
    }

    tagsToProcess = eventTags.length;

    eventTags.forEach(function (tag, index) {
      // Make lower case because tags are case insensitive
      eventTags[index] = tag = tag.toLowerCase().trim();

      db.tag
        .find({
          where: {
            name: tag
          }
        })
        .success(function (record) {
          // Create a tag record if it's a new tag
          if (!record) {
            db.tag
              .create({
                name: tag
              })
              .success(function (data) {
                tagProcessed();
              })
              .error(function (err) {
                console.error(err);
              });
          } else {
            tagProcessed();
          }
        });
    });
  }

  // ROUTES -------------------------------------------------------------------

  return {

    get: {
      all: function (req, res) {
        var limit = req.query.limit || null;
        var order = req.query.order || 'beginDate';
        var organizerId = req.query.organizerId;
        var after = req.query.after;

        var query = {};

        if (after) {
          if ((new Date(after)).toString() !== 'Invalid Date') {
            query.beginDate = {
              gte: new Date(after)
            };
          } else {
            res.statusCode = 500;
            res.json({
              error: 'Malformed after date'
            });
          }
        }

        if (organizerId) {
          query.organizerId = organizerId;
        }

        db.event
          .findAll({
            limit: limit,
            order: order,
            where: query
          })
          .success(function (data) {
            var dataCopy = JSON.parse(JSON.stringify(data));

            dataCopy.forEach(function (item, index) {
              // Only show emails for logged in admins to protect user privacy
              if (!req.session.user || !req.session.user.isAdmin) {
                delete dataCopy[index].organizer;
              }

              // Don't return deprecated values to client
              delete dataCopy[index].beginTime;
              delete dataCopy[index].endTime;
            });

            if (!req.query.csv) {
              res.json(dataCopy);
            } else {
              res.setHeader('Content-Type', 'text/csv');
              res.send(jsonToCSV(dataCopy));
            }

          })
          .error(function (err) {
            res.statusCode = 500;
            res.json(err);
          });
      },
      id: function (req, res) {

        var eventRecord;
        var humanTags = [];

        function getHumanTags() {
          var tagIDs = eventRecord.tags.split(',');

          db.tag
            .findAll({
              where: {
                id: tagIDs
              }
            })
            .success(function (data) {
              data.forEach(function (item, index) {
                humanTags.push(item.name);
              });

              console.log(humanTags);

              eventRecord.tags = humanTags;
              finish();
            });
        }

        function finish() {
          res.json(eventRecord);
        }

        db.event
          .find(req.params.id)
          .success(function (data) {
            eventRecord = data;
            getHumanTags();
          });

      }
    },

    post: function (req, res) {

      function saveRecord(tagIdCSV) {
        req.body.tags = tagIdCSV;

        db.event
          .create(req.body)
          .success(function (data) {
            hatchet.send('create_event', {
              eventId: data.getDataValue('id'),
              userId: req.session.user.id,
              username: req.session.user.username,
              email: req.session.user.email,
              sendEventCreationEmails: req.session.user.sendEventCreationEmails
            });
            res.json(data);
          })
          .error(function (err) {
            res.json(500, err);
          });
      }

      // Authentication
      if (!req.body) {
        return res.send(401, 'You may not create an empty event');
      }
      if (!req.session.user || !req.session.user.email) {
        return res.send(403, 'You must sign in with Webmaker to create an event');
      }

      // Save the event
      if (req.body.tags) {
        // Tags need to be stored and turned into a CSV of unique IDs for Event record
        storeTags(req.body.tags, saveRecord);
      } else {
        saveRecord();
      }

    },

    put: function (req, res) {
      var id = req.params.id;
      var updatedAttributes = req.body;

      // First, find the event
      db.event
        .find(id)
        .success(function (eventInstance) {

          function saveRecord(tagIdCSV) {
            updatedAttributes.tags = tagIdCSV;

            eventInstance
              .updateAttributes(updatedAttributes)
              .success(function (data) {
                res.json(data);
              })
              .error(function (err) {
                res.json(500, err);
              });
          }

          // Event doesn't exist
          if (!eventInstance) {
            return res.send(404, 'No event found for id ' + id);
          }

          // Authentication failed
          if (!isAuthorized(req, eventInstance)) {
            return res.send(403, 'You are not authorized to edit this event');
          }

          // Save the event
          if (updatedAttributes.tags) {
            // Tags need to be stored and turned into a CSV of unique IDs for Event record
            storeTags(updatedAttributes.tags, saveRecord);
          } else {
            saveRecord();
          }
        })
        .error(function (err) {
          res.json(500, err);
        });
    },

    delete: function (req, res) {
      var id = req.params.id;

      db.event
        .find(id)
        .success(function (eventInstance) {

          // No event
          if (!eventInstance) {
            return res.send(404, 'No event found for id ' + id);
          }

          // Authentication
          if (!isAuthorized(req, eventInstance)) {
            return res.send(403, 'You are not authorized to edit this event');
          }

          eventInstance
            .destroy()
            .success(function (data) {

              hatchet.send('delete_event', {
                eventId: eventInstance.getDataValue('id'),
                userId: req.session.user.id,
                username: req.session.user.username,
                email: req.session.user.email,
                sendEventCreationEmails: req.session.user.sendEventCreationEmails
              });
              res.json(data);
            })
            .error(function (err) {
              res.statusCode = 500;
              res.json(err);
            });
        })
        .error(function (err) {
          res.json(500, err);
        });
    },

    tag: {
      post: function (req, res) {
        storeTags(req.query.tag, function () {
          res.send('Tags stored');
        });
      },
      get: function (req, res) {
        db.tag
          .findAll()
          .success(function (data) {
            var subset = JSON.parse(JSON.stringify(data));

            for (i = 0, ii = subset.length; i < ii; i += 1) {
              delete subset[i].createdAt;
              delete subset[i].updatedAt;
            }

            res.json(subset);
          })
          .error(function (err) {
            res.json(500, err);
          });
      }
    }

  };

};
