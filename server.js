// var express    = require('express');
// var app        = express();
var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server, {
  pingTimeout: 1000
});

var mongoose   = require('mongoose');
var bodyParser = require('body-parser');

// Database
mongoose.Promise = global.Promise;
mongodb = "mongodb://localhost:27017/admin";
mongoose.connect(mongodb, {useMongoClient: true});
// mongoose.connect(process.env.MONGO_DB_LOGIN_API, {useMongoClient: true});
var db = mongoose.connection;
db.once('open', function () {
   console.log('DB connected!');
});
db.on('error', function (err) {
  console.log('DB ERROR:', err);
});

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'content-type, x-access-token, x-refresh-access-token');
  next();
});

// API
app.use('/api/users', require('./api/users'));
app.use('/api/auth', require('./api/auth'));

// Server
var port = 5000;
server.listen(port, function(){
  console.log('listening on port:' + port);
});

app.get('/', (req, res) => res.send("Hello World!"));

//connection event handler
io.on('connection', function(socket) {
  console.log('Connect from Client: ' + socket);

  const req = socket.request;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(ip + "의 새로운 유저가 접속하였습니다.");

  socket.on('disconnect', function(data) {
    console.log('접속을 해제 하였습니다.');
    console.log(data);
  });

  socket.on('error', function(error) {
    console.log('error 발생하였습니다.');
    console.log(error);
  });

  socket.on('chat', function(data) {
    console.log('message from Client: ' + data);
    console.log(data);

    //send a message to the client
    socket.broadcast.emit('chat', data);
  });
})