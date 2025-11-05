// routes/home.js
module.exports = function (router) {
  router.get("/", (req, res) => {
    res.status(200).json({
      message: "Welcome to Llama.io API",
      data: null,
    });
  });
  return router;
};
