module.exports = async (req, res) => {
  try {
    const app = require("../dist/server").default;
    return app(req, res);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("Failed to load backend handler", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      error: "Failed to load backend handler",
      details,
    }));
  }
};
