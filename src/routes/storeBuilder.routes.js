import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as storeBuilderController from '../controllers/storeBuilder.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';

export const storeBuilderRouter = express.Router();

storeBuilderRouter
    .post( '/createStoreLayout', isAllowedSessionHandler, validate( validateDtos.createBuilder ), storeBuilderController.createStoreBuilder )
    .post( '/updateStoreLayout', isAllowedSessionHandler, validate( validateDtos.updateStoreLayout ), storeBuilderController.updateStoreLayout )
    .post( '/storeLayoutList', isAllowedSessionHandler, validate( validateDtos.storeLayoutList ), storeBuilderController.getLayoutList )
    .post( '/updateFloor', isAllowedSessionHandler, validate( validateDtos.updateFloor ), storeBuilderController.updateFloor )
    .post( '/uploadBulkStore', isAllowedSessionHandler, storeBuilderController.uploadBulkStore )
    .post( '/uploadFile', isAllowedSessionHandler, storeBuilderController.uploadFile )
    // .post( '/storeLayout', validate( validateDtos.storeList ), storeBuilderController.storeFixtures )
    .post( '/storeDetails', isAllowedSessionHandler, validate( validateDtos.storeDetails ), storeBuilderController.getStoreDetails )
    .delete( '/deleteStoreLayout/:id', isAllowedSessionHandler, validate( validateDtos.deleteStoreLayout ), storeBuilderController.deleteStoreLayout )
    .post( '/removeFile', isAllowedSessionHandler, storeBuilderController.deleteFile )
    .post( '/deleteFloor', isAllowedSessionHandler, storeBuilderController.deleteFloor )
    .post( '/updateStatus', isAllowedSessionHandler, validate( validateDtos.updateStatus ), storeBuilderController.updateStatus )
    // .post( '/FixtureShelfDetails', storeBuilderController.fixtureShelfProduct )
    // .post( '/scan', storeBuilderController.scan )
    .post( '/storeLayout', validate( validateDtos.storeList ), storeBuilderController.storeLayout )
    .post( '/storeFixtures', validate( validateDtos.storeList ), storeBuilderController.storeFixturesv1 )
    .post( '/FixtureShelfDetails', validate( validateDtos.fixtureShelfProduct ), storeBuilderController.fixtureShelfProductv1 )
    .post( '/scan', storeBuilderController.scanv1 )
    .post( '/updateMissing', storeBuilderController.updateMissing )
    .post( '/bulkFixtureUpload', storeBuilderController.bulkFixtureUpload )
    .post( '/uploadImage', storeBuilderController.uploadImage )
    .post( '/storeFixturesTask', storeBuilderController.storeFixturesTask )
    .post( '/qrVideoUpload', storeBuilderController.qrVideoUpload );


