/* eslint-disable object-curly-newline */
import helpers from '../utils/helper';
import sendResult from '../utils/sendResult';
import UserService from '../services/user.service';
import EmailService from '../services/email.service';
import RoleService from '../services/role.service';

const User = {
  async signup(req, res) {
    const { fullname, password, email } = req.body;

    const response = await UserService.createUser({
      email,
      password: helpers.hashPassword(password),
      fullname
    });
    const Role = await RoleService.getRole({ id: response.RoleId });
    delete response.password;
    // SEND VERIFICATION EMAIL TO USER
    await EmailService.sendVerificationEmail(req, response);
    const data = { ...response, Role: Role.roleValue };
    return sendResult(res, 201, 'Account created successfully', data);
  },

  async login(req, res) {
    const { email, password } = req.body;
    const user = await UserService.getUser({ email });
    if (!user) return sendResult(res, 400, 'The email and/or password is invalid');
    const comfirmPass = helpers.comparePassword(password, user.password);
    if (comfirmPass) {
      user.Role = await RoleService.getRole({ id: user.RoleId });
      const {
        id, isverified, Role, fullname, rememberMe
      } = user;
      const token = helpers
        .createToken(id, email, isverified, Role.roleValue, rememberMe, fullname);
      const data = {
        userid: id, fullname, email, isverified, token
      };
      if (!isverified) {
        return sendResult(res, 400, 'Please verify your account first');
      }
      return sendResult(res, 201, 'User logged successfully', data);
    }
    return sendResult(res, 400, 'The email and/or password is invalid');
  },

  async verifyEmail(req, res) {
    try {
      const user = await helpers.verifyToken(helpers.getToken(req));
      if (!user || user.error || !(user.userId) || !(user.email)) return sendResult(res, 401, 'invalid token, try to check your email again');
      await UserService.updateUser({ isverified: true }, { id: user.userId });
      return sendResult(res, 200, 'email verified! try to login with your existing account');
    } catch (error) {
      return sendResult(res, 500, `it is not you, it is us\n${error.message}`);
    }
  },
  async  OauthLogin(req, res) {
    const {
      id, fullname, email, isverified, rememberMe
    } = await UserService.findOrCreateUser(req.user, req.user.email);
    return res.redirect(`${process.env.FRONTEND_BASE_URL}/login?token=${helpers.createToken(id, email, isverified, 'requester', rememberMe, fullname)}`);
  },
  async  OauthLoginFacebook(req, res) {
    const {
      id, fullname, email, isverified, rememberMe
    } = await UserService.findOrCreateUser(req.user, req.user.email);
    return sendResult(res, 201, 'User logged successfully', {
      id,
      fullname,
      email,
      token: helpers.createToken(id, email, isverified, 'requester', rememberMe, fullname)
    });
  },

  async updateProfile(req, res) {
    const { email, role, ...updateData } = {
      ...req.body, avatar: req.imgLink, password: helpers.hashPassword(req.body.password)
    };
    const user = await UserService.updateUser(updateData, { email: req.user.email });
    const { password, ...data } = user;
    return sendResult(res, 200, 'Profile updated successfully', data);
  },

  async getProfile(req, res) {
    const { password, ...data } = req.user;
    return sendResult(res, 200, 'user profile', data);
  },

  async userSubscription(req, res) {
    const { id } = req.user;
    const { subscription } = req.params;
    const receiveEmails = (subscription === 'subscribe');
    await UserService.manageUserSubscription(id, receiveEmails);
    sendResult(res, 200, `you have been ${subscription}ed successfully`);
  },

  async logout(req, res) {
    const data = { lastSeen: new Date() };
    const condition = { id: req.user.userId };
    await UserService.updateUser(data, condition);
    sendResult(res, 200, 'Logout successful');
  },

  async getUsers(req, res) {
    const users = await UserService.getAllUsers();
    sendResult(res, 200, 'all users', users);
  }

};
export default User;
