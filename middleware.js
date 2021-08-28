const Attraction = require("./models/attraction");

function isLoggedIn(req, res, next) {
  if (!req.user) return res.status(401).send("YOU ARE NOT LOGGED IN");
  next();
}

async function isAuthor(req, res, next) {
  let attraction = await Attraction.findOne({ _id: req.params.id });

  if (!attraction) return res.send("ATTRACTION NOT FOUND");

  if (!attraction.addedBy.equals(req.user._id))
    return res.status(401).send("UNAUTHORIZED ACTION");
    
  next();
}

module.exports = { isLoggedIn, isAuthor };
