const express = require('express');
const async = require('async');

// const creds = require('./creds');
const googleKey = require('./jwt.json');
const google = require('googleapis');
const calendar = google.calendar('v3');

// 0: Johann's Room
// 1: Ari's Room
// 2: Jade's Room
// 3: Shop
// 4: Kitchen/Living room
// 5: Bathrooms

function ISODateString (date) {
  function pad (n) { return n < 10 ? '0' + n : n; }
  return date.getUTCFullYear() + '-' +
    pad(date.getUTCMonth() + 1) + '-' +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) + ':' +
    pad(date.getUTCMinutes()) + ':' +
    pad(date.getUTCSeconds()) + 'Z';
}
1482822624000

const numbers = [0, 1, 2, 3, 4];
const roomLabels = ['Johann\'s Room', 'Ari\'s Room', 'Jade\'s Room', 'Shop', 'Kitchen/Living Room', 'Bathrooms'];

const calendarIDs = [
  '9r73ig7jjdmspud7h66chsv8dk@group.calendar.google.com',
  'e2p3cmh22bf3v050190nrj1pr4@group.calendar.google.com',
  'ekhfat6ro94265i6ute5ij1gts@group.calendar.google.com',
  'osicpn4b2nlc0ugdlvj2qd3nqs@group.calendar.google.com',
  '7begpqh5755hqvn82unh3q4j88@group.calendar.google.com',
  'lt1a5jolbo5cn19ipaikhn6e0s@group.calendar.google.com'
];

const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'big goose', resave: false, saveUninitialized: false }));
app.listen(8082);

const jwtClient = new google.auth.JWT(
  googleKey.client_email,
  null,
  googleKey.private_key,
  ['openid', 'email', 'https://www.googleapis.com/auth/calendar'],
  null
);

jwtClient.authorize((err, tokens) => {
  app.all('/', (req, res) => {
    if (err) return console.log(err);

    const utcMilliseconds = parseInt(req.query.lastUpdatedTime);
    if (isNaN(utcMilliseconds)) return res.status(400).send('lastUpdatedTime is not a number');
    const lastUpdatedTime = new Date(0);
    lastUpdatedTime.setUTCMilliseconds(utcMilliseconds);

    async.mapSeries(numbers, (index, callback) => {
      const id = calendarIDs[index];
      console.log(id);
      calendar.events.list({
        auth: jwtClient,
        calendarId: id,
        maxResults: 10,
        orderBy: 'startTime',
        singleEvents: true,
        timeMin: ISODateString(lastUpdatedTime)
      }, (err, data) => {
        if (err) return callback(err);
        const newItems = data.items.filter(item => {
          const itemStart = new Date(item.start.dateTime);
          return itemStart < new Date();
        });
        if (newItems.length > 0) {
          const ret = {};
          ret[index] = newItems.slice(-1)[0];
          return callback(null, ret);
        }
        return callback(null, {});
      });
    }, (err, results) => {
      if (err) throw err;
      const mostRecentEvent = results.reduce((a, b) => Object.assign(a, b), {});
      const temperatures = numbers.filter(x => mostRecentEvent[x]).map(index => {
        const event = mostRecentEvent[index];
        return `${index}${event.summary}`; // no space, first character is interpreted as sensor index
      }).join('\n');
      res.send(temperatures);
    });
  });
});
