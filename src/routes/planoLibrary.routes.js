import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as planoLibraryController from '../controllers/planoLibrary.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';


export const planoLibraryRouter = express.Router();

planoLibraryRouter
    .post( '/fixtureBulkUpload', isAllowedSessionHandler, planoLibraryController.fixtureBulkUpload )
    .post( '/createFixture', isAllowedSessionHandler, validate( validateDtos.createFixture ), planoLibraryController.createFixture )
    .post( '/updateFixture/:fixtureId', isAllowedSessionHandler, validate( validateDtos.updateFixture ), planoLibraryController.updateFixture )
    .get( '/fixtureDetails/:fixtureId', isAllowedSessionHandler, planoLibraryController.getFixture )
    .post( '/fixtureList', isAllowedSessionHandler, validate( validateDtos.fixtureList ), planoLibraryController.FixtureLibraryList )
    .post( '/duplicateFixture', isAllowedSessionHandler, planoLibraryController.duplicateFixture )
    .post( '/deleteFixture', isAllowedSessionHandler, planoLibraryController.deleteFixture );
