require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const app = express();

const User = require("./models/user");
const Attraction = require("./models/attraction");

const { isLoggedIn, isAuthor } = require("./middleware");
const user = require("./models/user");

const dbURL = "mongodb://localhost:27017/arkhane-london";

mongoose.connect(dbURL, { useNewUrlParser: true }, () => {
  console.log("DATABASE CONNECTION ESTABLISHED");
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const store = MongoStore.create({ mongoUrl: dbURL, touchAfter: 24 * 3600 });

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    store,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {
  res.send("WELCOME TO ARKHANE LONDON");
});

//AUTH

app.post("/login", passport.authenticate("local"), (req, res) => {
  res.send("YOU ARE LOGGED IN");
});

app.post("/logout", isLoggedIn, (req, res) => {
  req.logout();
  res.send("YOU ARE LOGGED OUT");
});

app.get("/user", isLoggedIn, (req, res) => {
  res.send(req.user);
});

app.post("/register", async (req, res) => {
  let { username, password } = req.body;
  let user = await User.register({ username }, password);
  res.send({ username: user.username, id: user._id });
});

app.delete("/deregister", isLoggedIn, async (req, res) => {
  await User.findByIdAndDelete(req.user._id);
  req.logout();
  res.send("YOU ACCOUNT HAS BEEN DELETED");
});

//ATTRACTIONS

app.post(
  "/attractions",
  upload.single("image"),
  isLoggedIn,

  (req, res) => {
    cloudinary.uploader.upload(req.file.path, async (error, { url }) => {
      if (!error) {
        let attraction = await Attraction.create({
          ...req.body,
          addedBy: req.user._id,
          imageURL: url,
        });

        let user = await User.findById(req.user._id);
        user.addedAttractions.push(attraction._id);
        await user.save();
        res.send(attraction);
      } else {
        res.send("IMAGE UPLOAD ERROR");
      }
    });
  }
);

app.get("/attractions", async (req, res) => {
  let attrations = await Attraction.find({});
  res.send(attrations);
});

app.delete("/attractions/:id", isLoggedIn, isAuthor, async (req, res) => {
  let deletedAttraction = await Attraction.findOneAndDelete({
    _id: req.params.id,
  });
  if (deletedAttraction) return res.send("ATTRACTION DELETED");
  res.send("ATTRACTION NOT FOUND");
});

app.put("/attractions/:id", isLoggedIn, isAuthor, async (req, res) => {
  let attraction = await Attraction.findOneAndUpdate(
    { _id: req.params.id },
    { ...req.body },
    { new: true }
  );

  res.send(attraction);
});

//been there
app.post("/attractions/:id/beenthere", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (!currentUser.beenThere.includes(req.params.id)) {
      currentUser.beenThere.push(req.params.id);
      let index = currentUser.wantToVisit.indexOf(req.params.id);
      if (index > -1) currentUser.wantToVisit.splice(index, 1);
      await currentUser.save();

      return res.send("ATTRACTION ADDED TO BEEN THERE");
    }
   return res.send("ALREADY ADDED");
  }

  res.send('ATTRACTION DOES NOT EXIST')

});
// WANT TO VISIT
app.post("/attractions/:id/wanttovist", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (!currentUser.wantToVisit.includes(req.params.id)) {
      currentUser.wantToVisit.push(req.params.id);
      await currentUser.save();
      return res.send("ATTRACTION ADDED TO WANT TO VISIT");
    }

    return res.send("ALREADY ADDED");
  }

  res.send("ATTRACION DOES NOT EXIST");
});
// list
app.post("/attractions/:id/list", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (!currentUser.list.includes(req.params.id)) {
      currentUser.list.push(req.params.id);
      await currentUser.save();
      return res.send("ATTRACTION ADDED TO LIST");
    }

    return res.send("ALREADY ADDED");
  }

  res.send("ATTRACION DOES NOT EXIST");
});
console.log(process.env.NODE_ENVIRONMENT)

app.listen(process.env.PORT, () => {
  console.log("APP LISTENING ON PORT: ", process.env.PORT);
});
