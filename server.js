const express = require("express");
const app = express();
const { chromium } = require("playwright-chromium");
const mongoose = require("mongoose");
const multer = require("multer");
const upload = multer();
const story = require(__dirname + "/models/story"); //dtabase model

app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(__dirname + "/public"));

//connecting to database
mongoose.connect(
  "mongodb+srv://appy:appypass@cluster0.mzeud.mongodb.net/insta-scrapper?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));

//function to open a headless browser and scrape instagram, save stories to database
async function scrape(userName, pswd) {
  //open browser
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.instagram.com/accounts/login/");
  //take 1st screen shot
  await page.screenshot({
    path: `./public/snapshots/ig-sign-in.png`,
  });
  //check if the right page loads
  try {
    await page.waitForSelector("[type=submit]", {
      state: "visible",
    });
  } catch (e) {
    throw new Error("Ip blocked by Instagram sentry");
  }

  // Take second screen shot
  await page.screenshot({
    path: `./public/snapshots/ig-sign-in.png`,
  });
  //logging in
  await page.type("[name=username]", userName); // ->
  await page.type('[type="password"]', pswd); // ->

  await page.click("[type=submit]");
  try {
    await page.waitForSelector("[placeholder=Search]", {
      state: "visible",
    });
  } catch (e) {
    throw new Error("Invalid User Name or Password");
  }

  await page.goto("https://www.instagram.com/", {
    state: "visible",
    timeout: 60000,
  });
  await page.waitForSelector("div.Fd_fQ", {
    state: "visible",
    timeout: 60000,
  });

  await page.click("div.EcJQs", { position: { x: 60, y: 40 } });

  await page.waitForSelector("div.qbCDp img", {
    state: "visible",
    timeout: 60000,
  });
  //Take snap shot after opening stories
  await page.screenshot({ path: `./public/snapshots/profile.png` });
  let url = page.url();
  console.log(url);
  let stories = 0;
  //This loop checks if story is prsent and if true saves that story to database
  while (
    url != `https://www.instagram.com/` &&
    url != "https://www.instagram.com/" + userName
  ) {
    let data = await page.evaluate(() => {
      const video = document.querySelectorAll("video.y-yJ5 source");
      if (Object.keys(video) != 0) {
        const urls = Array.from(video).map((v) => v.src);
        return urls;
      }
      const images = document.querySelectorAll("div.qbCDp img");
      const urls = Array.from(images).map((v) => v.src);
      return urls;
    });
    //saving to database
    story.create(
      { userName: userName, storyURL: data[0] },
      function (err, story_inst) {
        if (err) throw new Error(err);
      }
    );
    console.log(data);
    stories++;
    await page.click("button.FhutL");
    await page.waitForSelector("img", {
      state: "visible",
    });
    url = page.url();
    console.log(url);
  }
  console.log(stories + " stories added");
  await browser.close();

  return stories;
}

//root
app.get("/", function (request, response) {
  response.sendFile("./public/index.html");
});

//after stories are added
app.get("/added", function (request, response) {
  response.sendFile("./public/added.html", { root: __dirname });
});

//error page
app.get("/error", function (request, response) {
  response.sendFile("./public/error.html", { root: __dirname });
});

//heroku-error page
app.get("/heroku-error", function (request, response) {
  response.sendFile("./public/heroku-error.html", { root: __dirname });
});

//to view snapshot
app.get("/pic1", function (request, response) {
  response.sendFile("./public/snapshots/ig-sign-in.png", { root: __dirname });
});

//link to added stories
app.get("/stories", async (request, response) => {
  const data = await story.find({});
  let res = "<h2>Link to the added stories</h1>";
  let index = 0;
  if (data.length == 0) {
    res += "<h3>No added stories</h3>";
  } else {
    data.forEach(function (i) {
      res +=
        '<div><a href="' +
        i.storyURL +
        '" target="_blank">link to story {' +
        index++ +
        "}</a></div>";
    });
  }
  res += '<h3><a href=" / ">Add Stories</a></h3>';
  response.send(res);
});

//post request to add stories
app.post("/scrape", upload.none(), async (request, response) => {
  let req = request.body;
  if (req.userName == "" || req.pswd == "") {
    console.log("Please enter username and password");
    response.redirect("/error");
    return;
  }
  console.log("Running for " + req.userName);
  try {
    await scrape(req.userName, req.pswd);
  } catch (e) {
    console.log(e);
    response.redirect("/error");
    return;
  }

  response.redirect("/added");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port);
console.log("App is runung on port " + port);
