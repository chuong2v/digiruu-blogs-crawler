const puppeteer = require("puppeteer");
const Promise = require("bluebird");
const fs = require("fs");
const _ = require('radash');
// MONGODB_HOST=mongodb+srv://chuong2vdev:W6CVpPbcbmIENvcO@cluster0.s2sjzxq.mongodb.net/blogs?retryWrites=true&w=majority

(async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    args: ["--disable-setuid-sandbox"],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();

  async function fetchData(pageUrl = "https://digiruu.com/blog") {
    await page.goto(pageUrl);

    // Set screen size
    // await page.setViewport({ width: 1080, height: 1024 });

    const links = await page.$$("a.entire-meta-link");
    const images = await page.$$("img.wp-post-image");
    const categories = await page.$$("span.meta-category");

    const postsContent = await Promise.map(links, async (link, i) => {
      const url = await (await link.getProperty("href")).jsonValue();
      const slug = url.split('/').filter(i=>!!i).pop();
      const image = await (await images[i].getProperty("src")).jsonValue();
      const category = await (
        await categories[i].getProperty("textContent")
      ).jsonValue();
      const categoryId = await categories[i].$eval("a", i => i.getAttribute('class'))
      const postPage = await browser.newPage();
      await postPage.goto(url);
      const contentSelector = await postPage.waitForSelector(".post-content");
      const titleSelector = await postPage.waitForSelector(".entry-title");
      const content = await (
        await contentSelector.getProperty("innerHTML")
      ).jsonValue();
      const title = await (
        await titleSelector.getProperty("textContent")
      ).jsonValue();
      return { slug, image, category, categoryId, url, title, content };
    });
    console.log("- DONE page: ", pageUrl);
    const [nextPage] = await page.$$(".next.page-numbers");
    if (nextPage) {
      const nextPageUrl = await (
        await nextPage.getProperty("href")
      ).jsonValue();
      const nextPostsContent = await fetchData(nextPageUrl);
      return postsContent.concat(nextPostsContent);
    } else {
      return postsContent;
    }
  }
  const posts = await fetchData();
  const categories = _.unique(posts.map(i => ({ _id: i.categoryId, name: i.category })), c => c._id)
  console.log("Total posts: ", posts.length);
  fs.writeFileSync("./posts.json", JSON.stringify(posts, null, 2));
  fs.writeFileSync("./categories.json", JSON.stringify(categories, null, 2));
  await browser.close();
  console.log("--- DONE ---");
})();
