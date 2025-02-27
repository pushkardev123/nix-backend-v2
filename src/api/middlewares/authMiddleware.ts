import jwt, { JwtPayload } from "jsonwebtoken";
import asyncErrorHandler from "../helpers/asyncErrorHandler";
import CustomError from "../../config/CustomError";
import StatusCode from "@static/types/backend/httpStatusCode";
import mongoose from "mongoose";

export const protect = asyncErrorHandler(async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // Get token from header
    const token_split = req.headers.authorization.split(" ");
    if (token_split.length !== 2) {
      const err = new CustomError(
        "Invalid JWT token! Please login again",
        StatusCode.BAD_REQUEST,
      );
      return next(err);
    }

    const token = token_split[1];
    if (!token) {
      const err = new CustomError("Not authorized", StatusCode.UNAUTHORIZED);
      return next(err);
    }

    try {
      // Verify token
      const access_secret_key = process.env.ACCESS_SECRET_KEY;
      if (!access_secret_key) {
        const err = new CustomError(
          "Access secret key not found in env",
          StatusCode.INTERNAL_SERVER_ERROR,
        );
        return next(err);
      }
      const { email, user_id }: JwtPayload = jwt.verify(
        token,
        access_secret_key,
      ) as JwtPayload;
      if (!email || !user_id)
        return next(
          new CustomError(
            "Invalid JWT token! Please login again",
            StatusCode.UNAUTHORIZED,
          ),
        );

      // store the email and user_id to res.locals
      res.locals.email = email;
      res.locals.user_id = new mongoose.Types.ObjectId(user_id as string);

      // todo: i had to put this because of multer issue in image route https://github.com/expressjs/multer/issues/952
      // fix when fixable
      req.query.avatar_id = user_id as string;

      // Continue to the next middleware or route handler
      return next();
    } catch (err) {
      // Handle token verification error
      return next(new CustomError(err, StatusCode.UNAUTHORIZED));
    }
  } else {
    const err = new CustomError("Not authorized", StatusCode.UNAUTHORIZED);
    return next(err);
  }
});
