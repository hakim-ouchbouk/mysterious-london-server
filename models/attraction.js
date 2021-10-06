const mongoose = require("mongoose");

const attractionSchema = new mongoose.Schema({
  addedBy: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  images: [{ url: String, public_id: String }],
  reviews: [
    {
      content: String,
      stars: Number,
      author: { type: mongoose.Types.ObjectId, ref: "User" },
    },
  ],
  geocode: {
    lat: Number,
    lng: Number,
  },
  visited: { type: Number, default: 0 },
  wantToVisit: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
});

module.exports = mongoose.model("Attraction", attractionSchema);
