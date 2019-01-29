const path = require('path')
const routes = require('./routes')
const bodyParser = require('body-parser')

const attach = (app) => {
  var sessionStore = new MySQLStore(Object.assign({}, { port: 3306 }, db.connectionOps))
  require('./helpers/authenticate')
  app.use(cookieParser())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())

  app.use(routes)
  
  return db.init()
    .then(
      () => {
        console.log('Database is OK')
      },
      (err) => console.log(err))
    .then(contentSync.writeAllFiles)
}

module.exports = { attach }
