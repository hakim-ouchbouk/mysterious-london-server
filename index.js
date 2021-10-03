require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const passport = require("./passport-setup");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const cors = require("cors");
const upload = multer({ dest: "uploads/" });
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.CLIENT_ID);

const _ = require("lodash");
const {
  cloudinaryUploader,
  getGeocode,
  cloudinaryDeleteImages,
} = require("./tools");

const app = express();

const User = require("./models/user");
const Attraction = require("./models/attraction");

const { isLoggedIn, isAuthor } = require("./middleware");

const dbURL = "mongodb://localhost:27017/arcane-london";

mongoose.connect(dbURL, { useNewUrlParser: true }, () => {
  console.log("DATABASE CONNECTION ESTABLISHED");
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5000"],
    credentials: true,
  })
);
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

//AUTH

app.post("/login", (req, res, next) => {
  passport.authenticate("local", function (err, user, info) {
    if (!user) {
      return res.send("Incorrect password or username");
    }
    req.logIn(user, function (err) {
      return res.send({ id: user._id, username: user.username });
    });
  })(req, res, next);
});

app.post("/oauth", async (req, res) => {
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

app.post("/logout", isLoggedIn, (req, res) => {
  req.logout();
  res.send("YOU ARE LOGGED OUT");
});

app.get("/user", isLoggedIn, (req, res) => {
  res.send(req.user);
});

app.post("/register", async (req, res) => {
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

app.delete("/deregister", isLoggedIn, async (req, res) => {
  await User.findByIdAndDelete(req.user._id);
  req.logout();
  res.send("YOU ACCOUNT HAS BEEN DELETED");
});

app.get("/loggedin", (req, res) => {
  if (req.user) return res.send({ isLoggedIn: true });
  res.send({ isLoggedIn: false });
});

//ATTRACTIONS

app.post(
  "/attractions",
  isLoggedIn,
  upload.array("images"),
  async (req, res) => {
    let attraction = new Attraction({
      ...req.body,
      addedBy: req.user._id,
    });

    for (let file of req.files) {
      attraction.images.push(await cloudinaryUploader(file));
    }

    let geocode = await getGeocode(req.body.location);
    attraction.geocode = geocode;

    let user = await User.findById(req.user._id);
    user.addedAttractions.push(attraction._id);
    await attraction.save();
    await user.save();
    res.send(attraction);
  }
);

app.put(
  "/attractions/:id",
  isLoggedIn,
  upload.array("images"),
  async (req, res) => {
    let { name, description, location, deleteImages } = req.body;

    let deleteImgs = JSON.parse(deleteImages);

    let geocode = await getGeocode(location);

    if (deleteImgs.length > 0) cloudinaryDeleteImages(deleteImgs);

    if (req.files.length > 0) {
      let images = [];

      for (let file of req.files) {
        images.push(await cloudinaryUploader(file));
      }

      let attraction = await Attraction.findOneAndUpdate(
        { _id: req.params.id },
        {
          name,
          description,
          location,
          geocode,
          $pull: {
            images: {
              public_id: {
                $in: deleteImgs,
              },
            },
          },
        },
        { new: true }
      );

      let att = await Attraction.findOneAndUpdate(
        { _id: req.params.id },
        { images: images.concat(attraction.images) },
        { new: true }
      );

      res.send(att);
    } else {
      let attraction = await Attraction.findOneAndUpdate(
        { _id: req.params.id },

        {
          name,
          description,
          location,
          geocode,
          $pull: {
            images: {
              public_id: {
                $in: deleteImgs,
              },
            },
          },
        },
        { new: true }
      );

      res.send(attraction);
    }
  }
);

app.get("/attractions", async (req, res) => {
  let attractions = await Attraction.find({}).limit(8);
  res.send(attractions);
});

app.get("/attractions/search", async (req, res) => {
  let { q } = req.query;
  if (q) {
    let attractions = await Attraction.find({
      name: { $regex: q, $options: "i" },
    });
    return res.send(attractions);
  }

  res.send([]);
});

app.get("/attractions/all", async (req, res) => {
  let attractions = await Attraction.find({});
  res.send(attractions);
});

app.get("/attractions/count", async (req, res) => {
  let count = await Attraction.countDocuments({});
  res.send({ count });
});

app.get("/attractions/:id", async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  await attraction.populate("reviews.author");
  res.send(attraction);
});

app.delete("/attractions/:id", isLoggedIn, isAuthor, async (req, res) => {
  let deletedAttraction = await Attraction.findOneAndDelete({
    _id: req.params.id,
  });
  if (deletedAttraction) {
    cloudinaryDeleteImages(deletedAttraction.images);
    return res.send({ _id: deletedAttraction._id });
  }
  res.send("ATTRACTION NOT FOUND");
});

app.post("/attractions/:id/reviews", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findById(req.params.id);
  if (!attraction) return res.status(400).send("ATTRACTION NOT FOUND");

  let { content, stars } = req.body;
  let review = { content, author: req.user._id, stars };
  attraction.reviews.push(review);
  await attraction.save();
  await attraction.populate("reviews.author");
  res.send(attraction);
});

app.delete(
  "/attractions/:id/reviews/:review_id",
  isLoggedIn,
  async (req, res) => {
    let attraction = await Attraction.findById(req.params.id);
    if (!attraction) return res.status(400).send("ATTRACTION NOT FOUND");

    let reviews = attraction.reviews.filter((review) => {
      if (
        !review._id.equals(req.params.review_id) ||
        !review.author.equals(req.user._id)
      )
        return true;

      return false;
    });
    attraction.reviews = reviews;
    await attraction.populate("reviews.author");
    await attraction.save();
    res.send(attraction);
  }
);

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
      let { beenThere } = await currentUser.populate("beenThere");
      let { wantToVisit } = await currentUser.populate("wantToVisit");
      attraction.visited++;
      if (attraction.wantToVisit - 1 < 0) {
        attraction.wantToVisit = 0;
      } else {
        attraction.wantToVisit--;
      }

      await attraction.save();
      return res.send({ beenThere, wantToVisit });
    }
    return res.send("ALREADY ADDED");
  }

  res.send("ATTRACTION DOES NOT EXIST");
});
app.get("/user/beenthere", isLoggedIn, async (req, res) => {
  let { beenThere } = await User.findById({ _id: req.user._id }).populate(
    "beenThere"
  );
  res.send(beenThere);
});
// WANT TO VISIT
app.post("/attractions/:id/wanttovist", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (
      !currentUser.wantToVisit.includes(req.params.id) &&
      !currentUser.beenThere.includes(req.params.id)
    ) {
      currentUser.wantToVisit.push(req.params.id);
      await currentUser.save();
      let { wantToVisit } = await currentUser.populate("wantToVisit");
      attraction.wantToVisit++;
      await attraction.save();
      return res.send({ wantToVisit });
    }

    return res.send("ALREADY ADDED");
  }

  res.send("ATTRACION DOES NOT EXIST");
});

app.get("/user/wanttovist", isLoggedIn, async (req, res) => {
  let { wantToVisit } = await User.findById({ _id: req.user._id }).populate(
    "wantToVisit"
  );
  res.send(wantToVisit);
});

// list
app.post("/attractions/:id/list", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (!currentUser.list.includes(req.params.id)) {
      currentUser.list.push(req.params.id);
      await currentUser.save();
      let { list } = await currentUser.populate("list");

      return res.send({ list });
    }

    return res.send("ALREADY ADDED");
  }

  res.send("ATTRACION DOES NOT EXIST");
});

app.get("/user/list", isLoggedIn, async (req, res) => {
  let { list } = await User.findById({ _id: req.user._id }).populate("list");
  res.send(list);
});

app.listen(process.env.PORT, () => {
  console.log("APP LISTENING ON PORT: ", process.env.PORT);
});
