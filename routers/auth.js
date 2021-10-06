let express = require("express");
let router = express.Router();
require("dotenv").config();
const passport = require("../passport-setup");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.CLIENT_ID);


const User = require("../models/user");

const { isLoggedIn } = require("../middleware");


router.post("/login", (req, res, next) => {
  passport.authenticate("local", function (err, user, info) {
    if (!user) {
      return res.send("Incorrect password or username");
    }
    req.logIn(user, function (err) {
      return res.send({ id: user._id, username: user.username });
    });
  })(req, res, next);
});

router.post("/oauth", async (req, res) => {
  const { token } = req.body;
  const ticket = await client
    .verifyIdToken({
      idToken: token,
      audience: process.env.CLIENT_ID,
    })
    .catch((err) => {
      res.send("COUDLD NOT VERFY TOKEN");
    });
  const { email, given_name } = ticket.getPayload();

  let user = await User.findOne({ email });
  if (user) {
    req.login(user, function (err) {
      if (err) {
        return next(err);
      }
      let { _id, username } = user;
      return res.send({ id: _id, username, oauth: true });
    });
  } else {
    let newUser = await User.create({ email, username: given_name });
    req.login(newUser, function (err) {
      if (err) {
        return next(err);
      }
      let { _id, username } = newUser;
      return res.send({ id: _id, username, oauth: true });
    });
  }
});

router.post("/logout", isLoggedIn, (req, res) => {
  req.logout();
  res.send("YOU ARE LOGGED OUT");
});

router.get("/user", isLoggedIn, (req, res) => {
  res.send(req.user);
});

router.post("/register", async (req, res) => {
  let { username, email, password } = req.body;

  if (await User.findOne({ email })) {
    return res.send("Email already in use");
  }

  if (await User.findOne({ username })) {
    return res.send("Username already in use");
  }

  let user = await User.register({ username, email }, password);
  req.login(user, function (err) {
    if (err) {
      return next(err);
    }
    let { _id, username } = user;
    return res.send({ id: _id, username });
  });
  res.send({ username: user.username, id: user._id });
});

router.delete("/deregister", isLoggedIn, async (req, res) => {
  await User.findByIdAndDelete(req.user._id);
  req.logout();
  res.send("YOU ACCOUNT HAS BEEN DELETED");
});

router.get("/loggedin", (req, res) => {
  if (req.user) return res.send({ isLoggedIn: true });
  res.send({ isLoggedIn: false });
});

module.exports = router;
