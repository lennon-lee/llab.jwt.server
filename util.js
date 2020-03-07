var config   = require('./config');
var jwt      = require('jsonwebtoken');
var User     = require('./models/user');
var util     = {};

util.successTrue = function(data){
  return {
    success:true,
    message:null,
    errors:null,
    data:data
  };
};

util.successFalse = function(err, message){
  if(!err&&!message) message = 'data not found';
  return {
    success:false,
    message:message,
    errors:(err)? util.parseError(err): null,
    data:null
  };
};

util.parseError = function(errors){
  var parsed = {};
  if(errors.name == 'ValidationError'){
    for(var name in errors.errors){
      var validationError = errors.errors[name];
      parsed[name] = { message:validationError.message };
    }
  } else if(errors.code == '11000' && errors.errmsg.indexOf('username') > 0) {
    parsed.username = { message:'This username already exists!' };
  } else {
    parsed.unhandled = errors;
  }
  return parsed;
};


// middlewares
util.isLoggedin = function(req,res,next){
  var accessToken = req.headers['x-access-token'];
  var refreshAccessToken = req.headers['x-refresh-access-token'];
  
  if (!accessToken) {
    return res.json(util.successFalse(null,'accessToken is required!'));
  } else if (refreshAccessToken) {
    // 기존 accessToken이 만료되어 refreshAccessToken과 같이 왔을 경우
    jwt.verify(refreshAccessToken, config.refreshAccessTokenSecret, function(err, decoded) {
      if (err) {
        return res.json(util.successFalse(err, "refreshAccessToken is invalid"));
      } else {
        User.findOne({username:decoded.username})
        .sort({username:1})
        .exec(function(errUser,users){
          if (errUser) {
            return res.json(util.successFalse(errUser));
          }
          if (users.refreshAccessToken != refreshAccessToken) {
            return res.json(util.successFalse(errUser, "refreshAccessToken is invalid (db)"));
          }

          var payload = {
            _id : decoded._id,
            username: decoded.username
          };
  
          jwt.sign(payload, config.accessTokenSecret, {expiresIn: config.accessTokenExpiresIn}, function(err, token){
            if(err) return res.json(util.successFalse(err));
  
            var data = {"accessToken": token};
            res.json(util.successTrue(data));
          });
          
        });
      }
    });
  } else {
    jwt.verify(accessToken, config.accessTokenSecret, function(err, decoded) {
      if(err) return res.json(util.successFalse(err, "accessToken is invalid"));
      else{
        req.decoded = decoded;
        next();
      }
    });
  }
};

module.exports = util;
