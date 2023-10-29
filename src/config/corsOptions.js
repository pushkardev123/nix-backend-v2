import CustomError from "./CustomError.js";

export const allowedOrigins = ["https://www.ourwebsite.com"];

export let corsOptions = {
  origin: (origin, callback) => {
    if ( allowedOrigins.indexOf(origin) !== -1 || (process.env.NODE_ENV === "development" && !origin)) {
      callback(null, true);
    } else {
      callback(new CustomError("Not allowed by CORS", 401));
    }
  },
  optionsSuccessStatus: 200,
};
