import express from 'express';
import { validate, isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as managePlanogramController from '../controllers/managePlanogram.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const managePlanogramRouter = express.Router();

managePlanogramRouter
    .post( '/sample', isAllowedSessionHandler, validate( validateDtos.createBuilder ), managePlanogramController.sample );
