if (process.env.NODE_ENV !== "prod") require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const passport = require("./passport-setup");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const attractionsRouter = require("./routers/attractions");
const authRouter = require("./routers/auth");

const app = express();

const dbURL = `mongodb+srv://db-user:${process.env.DB_PASSWORD}@cluster0.1i2oo.mongodb.net/arcane-london?retryWrites=true&w=majority`;

const store = MongoStore.create({ mongoUrl: dbURL, touchAfter: 24 * 3600 });

mongoose.connect(dbURL, { useNewUrlParser: true }, () => {
  console.log("DATABASE CONNECTION ESTABLISHED");
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store,
    cookie: {
      secure: "auto",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "client/build")));


app.use("/api", authRouter);


app.use("/api", attractionsRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/client/build/index.html"));
});

app.listen(process.env.PORT, () => {
  console.log("APP LISTENING ON PORT: ", process.env.PORT);
});
