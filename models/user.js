const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const User = new Schema({
  addedAttractions: [mongoose.Types.ObjectId],
  beenThere: [mongoose.Types.ObjectId],
  wantToVisit: [mongoose.Types.ObjectId],
  list: [mongoose.Types.ObjectId],
});

User.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", User);
