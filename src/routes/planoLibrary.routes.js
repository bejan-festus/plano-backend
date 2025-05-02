import express from 'express';
import { isAllowedSessionHandler } from 'tango-app-api-middleware';
import * as planoLibraryController from '../controllers/planoLibrary.controller.js';
// import * as validateDtos from '../dtos/validation.dtos.js';


export const planoLibraryRouter = express.Router();

planoLibraryRouter
    .post( '/fixtureBulkUpload', isAllowedSessionHandler, planoLibraryController.fixtureBulkUpload );
