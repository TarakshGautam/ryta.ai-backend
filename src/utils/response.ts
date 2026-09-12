import { Response } from "express";

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export const successResponse = <T>(
    res: Response,
    statusCode: number = 200,
    message: string = "Success",
    data?: T
): Response => {
    const payload: ApiResponse<T> = {
        success: true,
        message,
        ...(data !== undefined && { data }),
    };
    return res.status(statusCode).json(payload);
};

export const errorResponse = (
    res: Response,
    statusCode: number = 500,
    error: string = "Internal Server Error"
): Response => {
    const payload: ApiResponse = {
        success: false,
        error,
    };
    return res.status(statusCode).json(payload);
};