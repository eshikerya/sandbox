let series = require('run-series')
let chalk = require('chalk')
let db = require('./db')
let events = require('./events')
let http = require('./http')
let canUse = require('@architect/utils/port-in-use')
let env = require('@architect/utils/populate-env')
let readArc = require('@architect/utils/read-arc')

module.exports = function start(callback) {

  // setup promise if there is no callback
  var promise
  if (!callback) {
    promise = new Promise(function(res, rej) {
      callback = function(err, result) {
        err ? rej(err) : res(result)
      }
    })
  }

  let client
  let bus
  series([
    // hulk smash
    function _banner(callback) {
      let {arc} = readArc()
      process.env.ARC_APP_NAME = arc.app[0]//name
      //FIXME tmp patch for process.env.SESSION_TABLE_NAME = 'jwe'
      process.env.SESSION_TABLE_NAME = 'arc-sessions'
      if (!process.env.hasOwnProperty('NODE_ENV'))
        process.env.NODE_ENV = 'testing'
      canUse(process.env.PORT || 3333, callback)
    },
    function _env(callback) {
      // populates additional environment variables
      env(callback)
    },
    function _db(callback) {
      // start dynalite with tables enumerated in .arc
      client = db.start(function() {
        let start = chalk.grey(chalk.green.dim('✓'), '@tables created in local database')
        console.log(`${start}`)
        callback()
      })
    },
    function _events(callback) {
      // listens for arc.event.publish events on 3334 and runs them in a child process
      bus = events.start(function() {
        let start = chalk.grey(chalk.green.dim('✓'), '@events and @queues ready on local event bus')
        console.log(`${start}`)
        callback()
      })
    },
    function _http(callback) {
      // vanilla af http server that mounts routes defined by .arc
      http.start(function() {
        let start = chalk.grey('\n', 'Started HTTP "server" @ ')
        let end = chalk.cyan.underline(`http://localhost:${process.env.PORT}`)
        console.log(`${start} ${end}`)
        callback()
      })
    }
  ],
  function _done(err) {
    if (err) callback(err)
    else {
      function end() {
        client.close()
        http.close()
        bus.close()
      }
      // pass a function to shut everything down if this is being used as a module
      callback(null, end)
    }
  })

  return promise
}

