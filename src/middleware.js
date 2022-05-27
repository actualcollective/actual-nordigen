import dotenv from "dotenv";

dotenv.config();

export const validateTokenMiddleware = async (req, res, next) => {
  if (req.body.token !== process.env.ACTUAL_SECRET) {
    return res.status(401).send({
      status: 'error',
      reason: 'unauthorized',
      details: 'token-not-found',
    });
  }

  return next();
};
