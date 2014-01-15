Development
============
```
npm install
cp .env-dist .env // For configuration
node server
```

Configuration
============

Configuration is stored in `.env`.

<table>
<tr>
  <td><code>PORT</code></td>
  <td><code>1989</code></td>
  <td>The port the server runs on.</td>
</tr>
<tr>
  <td><code>STORAGE</code></td>
  <td><code>events.sqlite</code></td>
  <td>The name and location of the sqlite file.</td>
</tr>
<tr>
  <td><code>DEV</code></td>
  <td><code>false</code></td>
  <td>If <code>true</code>, fake database generation methods will be exposed as GET routes.</td>
</tr>
<tr>
  <td><code>DB_NAME</code></td>
  <td><code>undefined</code></td>
  <td>Database name</td>
</tr>
<tr>
  <td><code>DB_USER</code></td>
  <td><code>undefined</code></td>
  <td>Database user</td>
</tr>
<tr>
  <td><code>DB_PASSWORD</code></td>
  <td><code>undefined</code></td>
  <td>Database password</td>
</tr>
</table>



Database
============
The database currently uses sqlite. The default location is `events.sqlite` in the root folder, but it can be configured by setting `STORAGE` in your `.env`


Routes
============

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Path</th>
      <th>Query/Body</th>
      <th>Description</th>
    </tr>
  </thead>
  <tr>
    <td><code>GET</code></td>
    <td>/dev/fake</td>
    <td>amount: <code>{{number of events}}</code></td>
    <td>Adds a fake item to the db.</td>
  </tr>
  <tr>
    <td><code>GET</code></td>
    <td>/events</td>
    <td>limit: <code>{{number of events || 30}}</code></td>
    <td>Returns an array of events.</td>
  </tr>
  <tr>
    <td><code>GET</code></td>
    <td>/events/:id</td>
    <td></td>
    <td>Returns a single event object where the id matches <code>:id</code></td>
  </tr>
  <tr>
    <td><code>POST</code></td>
    <td>/events/</td>
    <td><code>{{event object}}</code></td>
    <td>Creates a new event</td>
  </tr>
  <tr>
    <td><code>PUT</code></td>
    <td>/events/:id</td>
    <td><code>{{event object}}</code></td>
    <td>Updates an event with id <code>:id</code> with the attributes specified in the body of the request.</td>
  </tr>
  <tr>
    <td><code>DELETE</code></td>
    <td>/events/:id</td>
    <td></td>
    <td>Deletes an event with id <code>:id</code>.</td>
  </tr>
</table>


Deployment
===========

```
heroku create webmaker-events-service
git push heroku master
```

To add a database:
``
heroku addons:add cleardb
``

Configuration
=============

If you don't already have the Heroku config plugin installed, do it now:

```
heroku plugins:install git://github.com/ddollar/heroku-config.git
```

 Now you can push up your .env config file like this:

```
heroku config:push --overwrite

```
