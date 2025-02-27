import CustomError from "../../config/CustomError";
import asyncErrorHandler from "../helpers/asyncErrorHandler";
import StatusCode from "@static/types/backend/httpStatusCode";
import {
  ClientNotification,
  InformationUpdate,
  Notification,
} from "../models/notificationModel";
import { Subscription } from "../models/subscriptionModel";
import webpush from "web-push";

export const push_notification = async (notification: ClientNotification) => {
  const PRIVATE_KEY = process.env.NOTIF_PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("Private key for notification API not configured");
  }

  const subscriptions = await Subscription.find();

  const notificationPayload = JSON.stringify({
    title: notification.title,
    body: notification.description,
  });

  webpush.setVapidDetails(
    `mailto:${process.env.EMAIL_SERVICE_USER}`,
    "BCOsRaxpJeR0KyIPIg1rHx3pUtWVsGDGOxH65dDkqyU5ycF-CjPJxuqiXF4M0LpUMG_rk_YxSZX34uHbrV5umJQ",
    PRIVATE_KEY,
  );

  subscriptions.forEach((subscription) => {
    webpush
      .sendNotification(subscription, notificationPayload)
      .then(console.log)
      .catch(async (err) => {
        console.error("Error sending notification", err);
        await subscription.deleteOne();
      });
  });
};

export const save_notif = asyncErrorHandler(async (req, res, _next) => {
  if (req.body.secret != process.env.NOTIF_SECRET) {
    throw new CustomError("Invalid secret", StatusCode.BAD_REQUEST);
  }
  const data: InformationUpdate = req.body.data;

  const notifications = data.flatMap((tab) => {
    if (tab.update == "Unchanged") {
      const update = tab.data.flatMap((data) => {
        if (data.update == "Unchanged") {
          const update = data.children.flatMap((child) => {
            if (child.update == "Unchanged") {
              return [];
            } else if (child.update == "Modified") {
              const notif = {
                title: `Updated action link for "${child.title}"${data.date ? ` dated ${data.date}` : ""}`,
                description: data.title,
                actions: data.children.map((child) => {
                  return {
                    link: child.link,
                    action: child.title,
                  };
                }),
                link: data.link,
              };

              return notif;
            } else if (child.update == "Added") {
              const notif = {
                title: `Added a new link for "${child.title}"${data.date ? ` dated ${data.date}` : ""}`,
                description: data.title,
                actions: data.children.map((child) => {
                  return {
                    link: child.link,
                    action: child.title,
                  };
                }),
                link: data.link,
              };

              return notif;
            } else if (child.update == "Removed") {
              const notif = {
                title: `Removed a link for "${child.title}"${data.date ? ` dated ${data.date}` : ""}`,
                description: data.title,
                actions: data.children.map((child) => {
                  return {
                    link: child.link,
                    action: child.title,
                  };
                }),
                link: data.link,
              };

              return notif;
            } else {
              throw new CustomError(
                "Unexpected child update status",
                StatusCode.BAD_REQUEST,
              );
            }
          });

          return update;
        } else if (data.update == "Added") {
          const notif: ClientNotification = {
            title: `New update in "${tab.title}"${data.date ? ` dated ${data.date}` : ""}`,
            description: data.title,
            actions: data.children.map((child) => {
              return {
                link: child.link,
                action: child.title,
              };
            }),
            link: data.link,
          };

          return [notif];
        } else if (data.update == "Removed") {
          const notif: ClientNotification = {
            title: `Update removed in "${tab.title}"${data.date ? ` dated ${data.date}` : ""}`,
            description: data.title,
            actions: data.children.map((child) => {
              return {
                link: child.link,
                action: child.title,
              };
            }),
            link: data.link,
          };

          return [notif];
        } else if (data.update == "Modified") {
          const notif: ClientNotification = {
            title: `Link updated in "${tab.title}"${data.date ? ` dated ${data.date}` : ""}`,
            description: data.title,
            actions: data.children.map((child) => {
              return {
                link: child.link,
                action: child.title,
              };
            }),
            link: data.link,
          };

          return [notif];
        } else {
          throw new CustomError(
            "Unexpected data update status",
            StatusCode.BAD_REQUEST,
          );
        }
      });
      return update;
    } else if (tab.update == "Added") {
      const notif: ClientNotification = {
        title: "A new section has been added",
        description: `A new section titled "${tab.title}" has been added to the website`,
        actions: [],
        link: "https://dtu.ac.in/",
      };

      return [notif];
    } else if (tab.update == "Removed") {
      const notif: ClientNotification = {
        title: "A section has been removed",
        description: `A section titled "${tab.title}" has been removed from the website`,
        actions: [],
        link: "https://dtu.ac.in/",
      };

      return [notif];
    } else {
      throw new CustomError(
        "Unexpected tab update status",
        StatusCode.BAD_REQUEST,
      );
    }
  });

  if (notifications.length == 0) {
    return res.json({
      status: "success",
      message: "No new notifications",
    });
  }

  console.log(notifications);

  await Notification.create(
    notifications.map((notif) => {
      return { data: notif };
    }),
  );

  res.json({
    status: "success",
    message: "Notification saved successfully",
  });
  res.end();

  if (notifications.length === 0) return;

  if (notifications.length > 5) {
    push_notification({
      title: "DTU Website Update",
      description: "Multiple updates were made to the website",
      actions: [],
    }).then(() => console.log("Notification sent"));
  } else {
    notifications.forEach((n) =>
      push_notification(n).then(() => console.log("Notification sent")),
    );
  }
});

export const subscribe = asyncErrorHandler(async (req, res, _next) => {
  const subscription: PushSubscriptionJSON = req.body;
  console.log("New subscriber", subscription);

  await Subscription.create(subscription);

  res.json({
    status: "success",
    message: "Subscription successful",
  });
});

export const get_notif = asyncErrorHandler(async (req, res, _next) => {
  const query = req.query.since
    ? {
        // updated_at greater than since
        updated_at: { $gt: new Date(req.query.since as string) },
      }
    : {};

  const notifications = await Notification.find(query).sort({ updated_at: -1 });

  res.json({
    status: "success",
    message: "Notifications fetched successfully",
    data: notifications,
  });
});
