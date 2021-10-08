const express = require("express");
let router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "./uploads/" });
const fs = require("fs");

const {
  cloudinaryUploader,
  getGeocode,
  cloudinaryDeleteImages,
} = require("../tools");

const User = require("../models/user");
const Attraction = require("../models/attraction");

const { isLoggedIn, isAuthor } = require("../middleware");

//ATTRACTIONS

router.post(
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
      fs.unlink(file.path, (err) => {});
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

router.put(
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

router.get("/attractions", async (req, res) => {
  let attractions = await Attraction.find({}).limit(8);
  res.send(attractions);
});

router.get("/attractions/search", async (req, res) => {
  let { q } = req.query;
  if (q) {
    let attractions = await Attraction.find({
      name: { $regex: q, $options: "i" },
    });
    return res.send(attractions);
  }

  res.send([]);
});

router.get("/attractions/all", async (req, res) => {
  let attractions = await Attraction.find({});
  res.send(attractions);
});

router.get("/attractions/count", async (req, res) => {
  let count = await Attraction.countDocuments({});
  res.send({ count });
});

router.get("/attractions/:id", async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  await attraction.populate("reviews.author");
  res.send(attraction);
});

router.delete("/attractions/:id", isLoggedIn, isAuthor, async (req, res) => {
  let deletedAttraction = await Attraction.findOneAndDelete({
    _id: req.params.id,
  });
  if (deletedAttraction) {
    cloudinaryDeleteImages(deletedAttraction.images);
    return res.send({ _id: deletedAttraction._id });
  }
  res.send("ATTRACTION NOT FOUND");
});

router.post("/attractions/:id/reviews", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findById(req.params.id);
  if (!attraction) return res.status(400).send("ATTRACTION NOT FOUND");

  let { content, stars } = req.body;
  let review = { content, author: req.user._id, stars };
  attraction.reviews.push(review);

  let starsSum = 0;
  attraction.reviews.map(({ stars }) => {
    starsSum += stars;
  });

  let averageRating = starsSum / attraction.reviews.length;
  attraction.averageRating = averageRating;

  await attraction.save();
  await attraction.populate("reviews.author");
  res.send(attraction);
});

router.delete(
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

    if (reviews.length > 0) {
      let starsSum = 0;
      reviews.map(({ stars }) => {
        starsSum += stars;
      });

      let averageRating = starsSum / reviews.length;
      attraction.averageRating = averageRating;
    } else {
      attraction.averageRating = 0;
    }

    attraction.reviews = reviews;
    await attraction.populate("reviews.author");
    await attraction.save();
    res.send(attraction);
  }
);

//been there
router.post("/attractions/:id/beenthere", isLoggedIn, async (req, res) => {
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
router.get("/user/beenthere", isLoggedIn, async (req, res) => {
  let { beenThere } = await User.findById({ _id: req.user._id }).populate(
    "beenThere"
  );
  res.send(beenThere);
});
// WANT TO VISIT
router.post("/attractions/:id/wanttovist", isLoggedIn, async (req, res) => {
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

router.get("/user/wanttovist", isLoggedIn, async (req, res) => {
  let { wantToVisit } = await User.findById({ _id: req.user._id }).populate(
    "wantToVisit"
  );
  res.send(wantToVisit);
});

// list
router.post("/attractions/:id/list", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (!currentUser.list.includes(req.params.id)) {
      currentUser.list.push(req.params.id);
      await currentUser.save();
      let { list } = await currentUser.populate("list");

      return res.send({ list });
    }
  }

  res.send("WRONG REQUEST");
});

router.delete("/attractions/:id/list", isLoggedIn, async (req, res) => {
  let attraction = await Attraction.findOne({ _id: req.params.id });
  if (attraction) {
    let currentUser = await User.findById({ _id: req.user._id });
    if (currentUser.list.includes(req.params.id)) {
      let newList = currentUser.list.filter((attractionId) => {
        return !attractionId.equals(req.params.id);
      });
      currentUser.list = newList;
      await currentUser.save();
      let { list } = await currentUser.populate("list");
      return res.send({ list });
    }
  }

  res.send("WRONG REQUEST");
});

router.get("/user/list", isLoggedIn, async (req, res) => {
  let { list } = await User.findById({ _id: req.user._id }).populate("list");
  res.send(list);
});

module.exports = router;
