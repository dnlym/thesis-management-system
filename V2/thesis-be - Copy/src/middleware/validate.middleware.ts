import { Request, Response, NextFunction } from "express";
import { badRequest } from "../utils/response";

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { fullName, email, password } = req.body;
  
  if (!fullName || !email || !password) {
    return badRequest(res, "Vui lòng điền đầy đủ thông tin");
  }
  
  if (password.length < 8) {
    return badRequest(res, "Mật khẩu phải có ít nhất 8 ký tự");
  }
  const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
  if (!strongPwd.test(password)) {
    return badRequest(res, "Mật khẩu phải gồm chữ hoa, chữ thường và số");
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return badRequest(res, "Email không hợp lệ");
  }
  
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return badRequest(res, "Email và mật khẩu không được để trống");
  }
  
  next();
};
