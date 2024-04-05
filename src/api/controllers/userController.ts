import * as UserService from "../services/userService";
import asyncErrorHandler from "../helpers/asyncErrorHandler";
import CustomError from "../../config/CustomError";
import mongoose, { FilterQuery } from "mongoose";
import Permission from "../helpers/permissions";
import StatusCode from "../helpers/httpStatusCode";
import bcrypt from "bcrypt";
import { IUser, PopulatedUser, User } from "../models/userModel";
import MainWebsiteRole from "../helpers/mainWebsiteRole";

export const getTeam = asyncErrorHandler(async (req, res) => {
  const filter: FilterQuery<IUser> = {
    team_role: { $ne: MainWebsiteRole.DoNotDisplay },
  };

  const allUsers = await UserService.getAllUsers(filter);

  res.status(StatusCode.OK).json({
    status: "success",
    message: "Users fetched successfully",
    data: allUsers.map((user) => {
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role_id?.name,
        role_id: user.role_id?._id,
        bio: user.bio,
        team_role: user.team_role,
        created_at: user.date_joined,
      };
    }),
  });
});

export const getAllUsers = asyncErrorHandler(async (req, res) => {
  //add logic here

  const allUsers = await UserService.getAllUsers({});

  res.status(StatusCode.OK).json({
    status: "success",
    message: "Users fetched successfully",
    data: allUsers.map((user) => {
      // do a union of permissions here and difference with removed perms
      const allowed_perms: Set<Permission> = new Set();
      user.extra_permissions?.forEach((perm) => allowed_perms.add(perm));
      user.role_id?.permissions?.forEach((perm) => allowed_perms.add(perm));
      user.removed_permissions?.forEach((perm) => allowed_perms.delete(perm));

      const permissions = [...allowed_perms];

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        permissions: permissions,
        role: user.role_id?.name,
        role_id: user.role_id?._id,
        bio: user.bio,
        team_role: user.team_role,
        created_at: user.date_joined,
      };
    }),
  });
});

export const getCurrentUserController = asyncErrorHandler(
  async (req, res, next) => {
    const user_id = new mongoose.Types.ObjectId(req.body.user_id);
    const user = await UserService.checkUserExists({ _id: user_id });
    if (!user) {
      const error = new CustomError(
        "Unable to get current user",
        StatusCode.UNAUTHORIZED,
      );
      return next(error);
    }
    const allowed_perms: Set<Permission> = new Set();
    user.extra_permissions?.forEach((perm) => allowed_perms.add(perm));
    user?.role_id?.permissions?.forEach((perm) => allowed_perms.add(perm));
    user.removed_permissions?.forEach((perm) => allowed_perms.delete(perm));

    const permissions = [...allowed_perms];

    res.status(StatusCode.OK).json({
      status: "success",
      message: "User fetched successfully",
      data: {
        permission: permissions,
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        team_role: user.team_role,
        role: user.role_id?.name,
        role_id: user.role_id?._id,
        created_at: user.date_joined,
        is_superuser:
          user.role_id?._id?.toString() === process.env.SUPERUSER_ROLE_ID,
      },
    });
  },
);

export const getUserController = asyncErrorHandler(async (req, res, next) => {
  const user_id = new mongoose.Types.ObjectId(req.params.id);
  const user = await UserService.checkUserExists({ _id: user_id });
  if (!user) {
    const error = new CustomError(
      "Unable to get current user",
      StatusCode.UNAUTHORIZED,
    );
    return next(error);
  }

  const allowed_perms: Set<Permission> = new Set();
  user.extra_permissions?.forEach((perm) => allowed_perms.add(perm));
  user?.role_id?.permissions?.forEach((perm) => allowed_perms.add(perm));
  user.removed_permissions?.forEach((perm) => allowed_perms.delete(perm));

  const permissions = [...allowed_perms];

  console.log(
    "gettter",
    user.role_id.toString() === process.env.SUPERUSER_ROLE_ID,
    user._id.toString(),
    process.env.SUPERUSER_ROLE_ID,
  );
  res.status(StatusCode.OK).json({
    status: "success",
    message: "User fetched successfully",
    data: {
      permission: permissions,
      id: user._id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      team_role: user.team_role,
      role: user.role_id?.name,
      role_id: user.role_id?._id,
      created_at: user.date_joined,
      is_superuser:
        user.role_id?._id?.toString() === process.env.SUPERUSER_ROLE_ID,
    },
  });
});

export const updateUserController = asyncErrorHandler(
  async (req, res, next) => {
    const user_id = new mongoose.Types.ObjectId(req.body.user_id);
    const target_user_id = new mongoose.Types.ObjectId(req.body.target_user_id);

    const user = await UserService.checkUserExists({ _id: target_user_id });
    req.body.user = user;

    if (!target_user_id.equals(user_id)) {
      return next();
    }

    if (!user) {
      const error = new CustomError(
        "Unable to get current user",
        StatusCode.NOT_FOUND,
      );
      return next(error);
    }

    // Update user properties if provided in request body
    if (req.body.target_name) user.name = req.body.target_name;
    if (req.body.target_email) user.email = req.body.target_email;
    if (req.body.password) {
      const hashed_password: string = await bcrypt.hash(req.body.password, 10);
      user.password = hashed_password;
    }
    if (req.body.target_bio) user.bio = req.body.target_bio;

    await user.save();
    req.body.user = user;
    if (!req.body.permission && !req.body.role_id) {
      const allowed_perms: Set<Permission> = new Set();
      user.extra_permissions?.forEach((perm) => allowed_perms.add(perm));
      user.role_id?.permissions?.forEach((perm) => allowed_perms.add(perm));
      user.removed_permissions?.forEach((perm) => allowed_perms.delete(perm));
      return res.status(StatusCode.OK).json({
        status: "success",
        message: "User updated successfully",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            team_role: user.team_role,
            role: user.role_id.name,
            role_id: user.role_id._id,
            permission: [...allowed_perms],
            created_at: user.date_joined,
            is_superuser:
              user.role_id?._id?.toString() === process.env.SUPERUSER_ROLE_ID,
          },
        },
      });
    }
    return next();
  },
);

export const permsUpdateController = asyncErrorHandler(
  async (req, res, next) => {
    const {
      user,
      permission,
      role_id,
    }: { user: PopulatedUser; permission: Permission[]; role_id: string } =
      req.body;

    if (!user) {
      const error = new CustomError(
        "Requested user not found",
        StatusCode.NOT_FOUND,
      );
      return next(error);
    }

    if (permission !== undefined || permission !== null) {
      const role_perms_taken_away = user.role_id.permissions.filter(
        (perm) => !permission.includes(perm),
      );
      const extra_perms_given = permission.filter(
        (perm) => !user.role_id.permissions.includes(perm),
      );
      user.removed_permissions = role_perms_taken_away;
      user.extra_permissions = extra_perms_given;
    }

    user.team_role =
      (req.body.team_role as MainWebsiteRole) || MainWebsiteRole.DoNotDisplay;

    await user.save();

    if (role_id) {
      await User.findByIdAndUpdate(user, { role_id: role_id });
    }
    // todo: maybe it returns user's old role
    const allowed_perms: Set<Permission> = new Set();
    user.extra_permissions?.forEach((perm) => allowed_perms.add(perm));
    user.role_id?.permissions?.forEach((perm) => allowed_perms.add(perm));
    user.removed_permissions?.forEach((perm) => allowed_perms.delete(perm));
    return res.status(StatusCode.OK).json({
      status: "success",
      message: "User updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          team_role: user.team_role,
          role: user.role_id.name,
          role_id: user.role_id._id,
          permission: [...allowed_perms],
          created_at: user.date_joined,
          is_superuser:
            user.role_id?._id?.toString() === process.env.SUPERUSER_ROLE_ID,
        },
      },
    });
  },
);
