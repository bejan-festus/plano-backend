import express from 'express';
import { validate, isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as planoLibraryController from '../controllers/planoLibrary.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const planoLibraryRouter = express.Router();

planoLibraryRouter
    .post( '/sample', isAllowedSessionHandler, validate( validateDtos.createBuilder ), planoLibraryController.sample );
