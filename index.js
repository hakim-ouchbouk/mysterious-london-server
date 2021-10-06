require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const passport = require("./passport-setup");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const { OAuth2Client } = require("google-auth-library");
const attractionsRouter = require("./routers/attractions");
const authRouter = require("./routers/auth");

const app = express();

const dbURL = "mongodb://localhost:27017/arcane-london";
const store = MongoStore.create({ mongoUrl: dbURL, touchAfter: 24 * 3600 });

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

app.use("/", authRouter);

//ATTRACTIONS

app.use("/", attractionsRouter);

app.listen(process.env.PORT, () => {
  console.log("APP LISTENING ON PORT: ", process.env.PORT);
});
