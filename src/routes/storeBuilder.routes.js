import express from 'express';
import { isAllowedSessionHandler, validate } from 'tango-app-api-middleware';
import * as storeBuilderController from '../controllers/storeBuilder.controller.js';
import * as validateDtos from '../dtos/validation.dtos.js';

export const storeBuilderRouter = express.Router();

storeBuilderRouter
    .post( '/createStoreLayout', validate( validateDtos.createBuilder ), storeBuilderController.createStoreBuilder )
    .post( '/updateStoreLayout', validate( validateDtos.updateStoreLayout ), storeBuilderController.updateStoreLayout )
    .post( '/storeLayoutList', validate( validateDtos.storeLayoutList ), storeBuilderController.getLayoutList )
    .post( '/updateFloor', validate( validateDtos.updateFloor ), storeBuilderController.updateFloor )
    .post( '/uploadBulkStore', storeBuilderController.uploadBulkStore )
    .post( '/uploadFile', storeBuilderController.uploadFile )
    // .post( '/storeLayout', validate( validateDtos.storeList ), storeBuilderController.storeFixtures )
    .post( '/storeDetails', validate( validateDtos.storeDetails ), storeBuilderController.getStoreDetails )
    .delete( '/deleteStoreLayout/:id', validate( validateDtos.deleteStoreLayout ), storeBuilderController.deleteStoreLayout )
    .post( '/removeFile', storeBuilderController.deleteFile )
    .post( '/deleteFloor', storeBuilderController.deleteFloor )
    .post( '/updateStatus', validate( validateDtos.updateStatus ), storeBuilderController.updateStatus )
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
    .post( '/qrFileUpload', storeBuilderController.qrFileUpload )
    .post( '/updateQrCvProcessRequest', storeBuilderController.updateQrCvProcessRequest )
    .post( '/getQrCvProcessRequest', storeBuilderController.getQrCvProcessRequest )
    .post( '/fixtureQrUpdate', storeBuilderController.fixtureQrUpdate )
    .post( '/updateDeatailedDistance', storeBuilderController.updateDetailedDistance )
    .post( '/upsertFixture', storeBuilderController.upsertFixtures );

