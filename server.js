const express = require("express");
const app = express();
const playwright = require("playwright");
const mongoose = require("mongoose");
const multer = require("multer");
const upload = multer();
var story = require(__dirname + "/models/story");

app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(__dirname + "/public"));

mongoose.connect(
  "mongodb+srv://appy:appypass@cluster0.mzeud.mongodb.net/insta-scrapper?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));

async function scrape(userName, pswd) {
  const browser = await playwright.chromium.launch({
    headless: true, // set this to true
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.instagram.com/accounts/login/");

  await page.waitForSelector("[type=submit]", {
    state: "visible",
  });
  // You can also take screenshots of pages
  await page.screenshot({
    path: `ig-sign-in.png`,
  });
  await page.type("[name=username]", userName); // ->
  await page.type('[type="password"]', pswd); // ->

  await page.click("[type=submit]");
  try {
    await page.waitForSelector("[placeholder=Search]", { state: "visible" });
  } catch (e) {
    throw new Error("Invalid User Name or Password");
  }

  await page.goto("https://www.instagram.com/stories/" + userName); // ->
  await page.waitForSelector("[type=button]", {
    state: "visible",
  });

  await page.click("[type=button]");

  // Execute code in the DOM
  await page.waitForSelector("img", {
    state: "visible",
  });
  await page.screenshot({ path: `profile.png` });
  let url = page.url();
  console.log(url);
  let stories = 0;
  while (
    url != `https://www.instagram.com/` &&
    url != "https://www.instagram.com/" + userName
  ) {
    let data = await page.evaluate(() => {
      const video = document.querySelectorAll("video.y-yJ5 source");
      if (Object.keys(video) != 0) {
        console.log(video);
        const urls = Array.from(video).map((v) => v.src);
        return urls;
      }
      const images = document.querySelectorAll("div.qbCDp img");
      const urls = Array.from(images).map((v) => v.src);
      return urls;
    });
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

  //   await page.waitForTimeout(5000);
  await browser.close();

  return stories;
  // Return the data in form of json
}
app.get("/", function (request, response) {
  response.sendFile("./public/index.html");
});
app.get("/added", function (request, response) {
  response.sendFile("./public/added.html", { root: __dirname });
});
app.get("/error", function (request, response) {
  response.sendFile("./public/error.html", { root: __dirname });
});
app.post("/scrape", upload.none(), async (request, response) => {
  let req = request.body;
  console.log(req);
  try {
    await scrape(req.userName, req.pswd);
  } catch (e) {
    console.log(e);
    response.redirect("/error");
  }

  response.redirect("/added");
});
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port);
console.log("App is runung on port 3000");
