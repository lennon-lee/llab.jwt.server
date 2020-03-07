var app      = require('express');
var router   = app.Router();
var User     = require('../models/user');
var util     = require('../util');
var config   = require('../config');
var jwt      = require('jsonwebtoken');

// login
router.post('/login',
  function(req,res,next){
    var isValid = true;
    var validationError = {
      name:'ValidationError',
      errors:{}
    };

    if (!req.body.username) {
      isValid = false;
      validationError.errors.username = {message:'Username is required!'};
    }
    if (!req.body.password) {
      isValid = false;
      validationError.errors.password = {message:'Password is required!'};
    }    

    if(!isValid) return res.json(util.successFalse(validationError));
    else next();
  },
  function(req,res,next){
    User.findOne({username:req.body.username})
    .select({password:1,username:1,name:1,email:1,refreshAccessToken:1})
    .exec(function(err,user){
      if (err) {
        // DB 오류
        return res.json(util.successFalse(err));

      } else if(!user||!user.authenticate(req.body.password)) {
        // 접속 계정 정보가 잘못 된경우
        return res.json(util.successFalse(null,'Username or Password is invalid'));

      } else if(req.body.forceDisconnect) {
        // 다른 사용자가 기존 사용자 접속을 강제로 끊고 접속한 경우
        signJwt(req, res, user);

      } else if(user.refreshAccessToken) {
        // 현재 사용중인 계정인 경우
        verifyJwt(req, res, user);

      } else {
        // 처음 사용하는 계정인 경우
        signJwt(req, res, user);

      }
    });
  }
);

var signJwt = function(req, res, user) {
  var payload = {
    _id: user._id,
    username: user.username,
    remoteIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  };

  // accessToken 발급
  jwt.sign(payload, config.accessTokenSecret, {expiresIn: config.accessTokenExpiresIn}, function(err, accessToken){
    if(err) return res.json(util.successFalse(err));

    // refreshAccessToken 발급
    jwt.sign(payload, config.refreshAccessTokenSecret, {expiresIn: config.refreshAccessTokenExpiresIn}, function(err, refreshAccessToken){
      if(err) return res.json(util.successFalse(err));
  
      user.currentPassword = req.body.password;
      user.originalPassword = user.password;
      user.refreshAccessToken = refreshAccessToken;
      
      user.save(function(err,user){
        if(err||!user) return res.json(util.successFalse(err));
        else {
          user.password = undefined;

          var data = {"accessToken": accessToken, "refreshAccessToken": refreshAccessToken};
          res.json(util.successTrue(data));    
        }
      });
    });  
  });			
}

var verifyJwt = function(req, res, user) {
  jwt.verify(user.refreshAccessToken, config.refreshAccessTokenSecret, function(err, decoded) {

    /**
     * 이미 사용중인 계정을 다른 pc에서 같은 계정으로 접속한 경우
     * memberIp: 새로운 연결 IP
     * ip: 기존 연결 IP
     */
    const memberIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!err && decoded && decoded.remoteIp != memberIp) {
      var result = {'code': 'existUser', 'userId': decoded.username, 'ip': decoded.remoteIp, 'memberIp': memberIp};
      return res.json(util.successTrue(result));
    }

    // 계정이 사용중이지 않을 때
    signJwt(req, res, user);          
  });
}

module.exports = router;
