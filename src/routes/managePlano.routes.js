import express from 'express';
import * as managePlanoController from '../controllers/managePlano.controller.js';

import { isAllowedSessionHandler } from 'tango-app-api-middleware';

export const managePlanoRouter = express.Router();

managePlanoRouter
    .post( '/updateStorePlano', managePlanoController.updateStorePlano )
    .post( '/getplanoFeedback', managePlanoController.getplanoFeedback )
    .post( '/getStoreFixturesfeedback', managePlanoController.getStoreFixturesfeedback )
    .get( '/fixtureList', managePlanoController.fixtureList )
    .get( '/templateList', managePlanoController.templateList )
    .get( '/fixtureBrandsList', managePlanoController.fixtureBrandsList )
    .get( '/fixtureVMList', managePlanoController.fixtureVMList )
    .post( '/updateFixtureStatus', isAllowedSessionHandler, managePlanoController.updateFixtureStatus )
    .post( '/updateStoreFixture', managePlanoController.updateStoreFixture )
    .post( '/updateredostatus', managePlanoController.updateredostatus )
    .post( '/createRevision', managePlanoController.createPlanoRevision )
    .post( '/getRevisions', managePlanoController.getAllPlanoRevisions )
    .post( '/getRevisionData', managePlanoController.getPlanoRevisionById );
